export interface SimulationState {
  tTank: number;
  tTankless: number;
  tSetpoint: number;
  tankOnPort: 'hot' | 'cold';
}

export interface SimulationResult {
  tMixed: number;
  hotRatio: number;
  coldRatio: number;
}

export function calculateWaxDrive(currentR: number, tH: number, tC: number, tSetpoint: number): number {
  const tMixed = currentR * tH + (1 - currentR) * tC;
  return tSetpoint - tMixed;
}

/**
 * Models the Rinnai SENSEI RX199iN Tankless Heater
 * BTU: 199,000
 * Efficiency: 97%
 * Max Flow: 11.1 GPM
 */
export function calculateTanklessStep(
  targetTemp: number,
  flowRateGPM: number,
  coldInTemp: number
): { temp: number; isBTULimited: boolean } {
  // At zero flow the heater is off and stagnant water sits at inlet temperature.
  // Returning targetTemp here would cause oscillation: the valve would see a
  // phantom temperature change when it cuts flow to the tankless port.
  if (flowRateGPM <= 0) return { temp: coldInTemp, isBTULimited: false };

  // If inlet water is already at or above the target, the heater doesn't fire.
  // A real tankless heater has no cooling capability — it passes water through.
  const requestedDeltaT = targetTemp - coldInTemp;
  if (requestedDeltaT <= 0) {
    return { temp: coldInTemp, isBTULimited: false };
  }

  const maxBTU = 199000;
  const efficiency = 0.97;
  const effectiveBTU = maxBTU * efficiency;

  // BTU Formula: BTU/h = GPM * 500 * deltaT
  // deltaT_max = effectiveBTU / (GPM * 500)
  const maxDeltaT = effectiveBTU / (flowRateGPM * 500.4);

  if (requestedDeltaT <= maxDeltaT) {
    return { temp: targetTemp, isBTULimited: false };
  } else {
    // Heater is firing at 100% and cannot meet the temperature at this flow
    return { temp: coldInTemp + maxDeltaT, isBTULimited: true };
  }
}

export function calculatePhysicalShuttleStep(
  currentR: number,
  tH: number, // Physical source on Hot port
  tC: number, // Physical source on Cold port
  tSetpoint: number,
  seconds: number
): number {
  // Time constant τ = 8 seconds per the Apollo MVA wax capsule spec.
  // Normalizing drive by (tH - tC) makes τ independent of port temperatures:
  //   dR/dt = drive / (τ * (tH - tC))
  // where drive = tSetpoint - tMixed.
  // Linearized: dR/dt = -(R - R_eq) / τ, giving a fixed 8-second response.
  const tau = 8.0;
  const tempSpread = tH - tC;
  let r = currentR;
  const subSteps = 10;
  const dt = seconds / subSteps;

  for (let i = 0; i < subSteps; i++) {
    const drive = calculateWaxDrive(r, tH, tC, tSetpoint);
    if (Math.abs(tempSpread) > 0.01) {
      r += (drive / (tau * tempSpread)) * dt;
    } else {
      // Ports are at the same temperature — drive directly toward setpoint compliance.
      // If both ports equal setpoint, drive=0 and nothing changes.
      // If both are cold, drive>0 pushes R toward 1 (hot); if both hot, toward 0.
      r += drive > 0 ? (dt / tau) : drive < 0 ? -(dt / tau) : 0;
    }
    r = Math.max(0, Math.min(1, r));
  }
  return r;
}

/**
 * MODELS A STRATIFIED TANK (Multi-layer)
 * @param layers Temperature of each layer from TOP (0) to BOTTOM (N-1)
 * @returns Updated layers
 */
export function calculateStratifiedTankStep(
  layers: number[],
  capacity: number,
  flowRateGPM: number,
  coldInTemp: number,
  recoveryRateGPH: number,
  targetTemp: number,
  seconds: number
): number[] {
  const n = layers.length;
  const volLayer = capacity / n;
  const volMoved = (flowRateGPM / 60) * seconds;
  
  let newLayers = [...layers];

  // 1. FLOW: Water shifts upward, sub-stepping if volume moved exceeds one layer.
  // At high sim speeds (300x) and high flow (20 GPM), a single step can move
  // multiple layers' worth of water. Sub-stepping keeps f <= 1 per iteration.
  if (volMoved > 0 && capacity > 0) {
    const advectionSteps = Math.max(1, Math.ceil(volMoved / volLayer));
    const subVolMoved = volMoved / advectionSteps;

    for (let s = 0; s < advectionSteps; s++) {
      const f = subVolMoved / volLayer; // guaranteed <= 1
      const prev = [...newLayers];
      for (let i = 0; i < n - 1; i++) {
        newLayers[i] = prev[i] * (1 - f) + prev[i+1] * f;
      }
      newLayers[n-1] = prev[n-1] * (1 - f) + coldInTemp * f;
    }
  }

  // 2. RECOVERY: Heating from bottom
  // recoveryRateGPH represents the heater's delivery rate calibrated to its actual
  // operating delta (targetTemp - coldInTemp). Energy in degree-gallons per second:
  //   (recoveryRateGPH / 3600) * (targetTemp - coldInTemp)
  const recoveryDeltaT = Math.max(0, targetTemp - coldInTemp);
  let energyToDeploy = (recoveryRateGPH / 3600) * seconds * recoveryDeltaT;
  
  // Apply energy from bottom to top
  for (let i = n - 1; i >= 0 && energyToDeploy > 0; i--) {
    if (newLayers[i] < targetTemp) {
      const needed = (targetTemp - newLayers[i]) * volLayer;
      const applied = Math.min(needed, energyToDeploy);
      newLayers[i] += applied / volLayer;
      energyToDeploy -= applied;
    }
  }

  // 3. CONVECTION (Simple): Hotter water below a colder layer rises instantly
  for (let i = n - 1; i > 0; i--) {
    if (newLayers[i] > newLayers[i-1]) {
      const avg = (newLayers[i] + newLayers[i-1]) / 2;
      newLayers[i] = avg;
      newLayers[i-1] = avg;
    }
  }

  return newLayers;
}

/**
 * Calculates estimated minutes of setpoint-compliant hot water remaining.
 * In the series-hybrid architecture, 100% of demand flows through the tank,
 * so depletion is based on total flowRate, not just the valve's tank port flow.
 */
export function calculateMinutesRemaining(
  tankLayers: number[],
  tankCapacity: number,
  flowRateGPM: number,
  recoveryRateGPH: number,
  setpoint: number
): number {
  const hotGallons = (tankLayers.filter(t => t > setpoint).length / tankLayers.length) * tankCapacity;
  if (hotGallons <= 0) return 0;
  const netDepletionGPM = flowRateGPM - (recoveryRateGPH / 60);
  if (netDepletionGPM <= 0.01) return Infinity;
  return hotGallons / netDepletionGPM;
}
