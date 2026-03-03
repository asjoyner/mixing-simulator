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
  if (flowRateGPM <= 0) return { temp: targetTemp, isBTULimited: false };

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
  const k = 0.015;
  let r = currentR;
  const subSteps = 10;
  const dt = seconds / subSteps;

  for (let i = 0; i < subSteps; i++) {
    const drive = calculateWaxDrive(r, tH, tC, tSetpoint);
    r += (drive * k * dt);
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

  // 1. FLOW: Water shifts upward
  if (volMoved > 0 && capacity > 0) {
    // If we move more than one layer's worth, we should handle it, 
    // but at 60x sim speed, 5GPM * 6s = 0.5G. Layer is 8G. 
    // So usually volMoved < volLayer.
    const f = Math.min(1, volMoved / volLayer);
    
    // Each layer i gets some water from layer i+1
    for (let i = 0; i < n - 1; i++) {
      newLayers[i] = layers[i] * (1 - f) + layers[i+1] * f;
    }
    // Bottom layer gets cold water from inlet
    newLayers[n-1] = layers[n-1] * (1 - f) + coldInTemp * f;
  }

  // 2. RECOVERY: Heating from bottom
  // Recovery energy is typically a fixed BTU/hr.
  // Standard 40k BTU gas heater can raise 40G by ~90F in 1 hour.
  // We'll apply this energy starting from the bottom layers that are below target.
  let energyToDeploy = (recoveryRateGPH / 3600) * seconds * 90; // Deg-Gallons equivalent
  
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
  const netDepletionGPM = flowRateGPM - (recoveryRateGPH / 60);
  if (netDepletionGPM <= 0.01) return Infinity;
  const hotGallons = (tankLayers.filter(t => t > setpoint).length / tankLayers.length) * tankCapacity;
  return hotGallons / netDepletionGPM;
}
