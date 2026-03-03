import { describe, it, expect } from 'vitest';
import { calculatePhysicalShuttleStep, calculateWaxDrive, calculateTanklessStep, calculateMinutesRemaining, calculateStratifiedTankStep } from './ValveModel';

describe('Apollo Mixing Valve Physical Model', () => {
  
  it('contracts (opens HOT) when output is below setpoint', () => {
    const drive = calculateWaxDrive(0.5, 70, 70, 120);
    expect(drive).toBeGreaterThan(0); 
  });

  it('expands (opens COLD) when output is above setpoint', () => {
    const drive = calculateWaxDrive(0.5, 140, 140, 120);
    expect(drive).toBeLessThan(0); 
  });

  it('pins to HOT port if both sources are colder than setpoint', () => {
    let r = 0.5;
    for (let i = 0; i < 60; i++) {
      r = calculatePhysicalShuttleStep(r, 100, 110, 125, 1);
    }
    expect(r).toBeCloseTo(1.0, 2);
  });

  it('pins to COLD port when both sources are above setpoint', () => {
    // Default initial condition: tH=tankless(140), tC=tank(135), setpoint=125.
    // Both above setpoint → valve drives R toward 0 (fully cold/tank).
    let r = 0.5;
    for (let i = 0; i < 120; i++) {
      r = calculatePhysicalShuttleStep(r, 140, 135, 125, 1);
    }
    expect(r).toBeCloseTo(0.0, 2);
  });

  it('settles to equilibrium when sources straddle setpoint', () => {
    // tH=160, tC=100, setpoint=130 → equilibrium R = (130-100)/(160-100) = 0.5
    let r = 0.0;
    for (let i = 0; i < 120; i++) {
      r = calculatePhysicalShuttleStep(r, 160, 100, 130, 1);
    }
    expect(r).toBeCloseTo(0.5, 1);
  });
});

describe('Rinnai RX199iN Tankless Heater Model', () => {

  it('heats cold water to target when BTU capacity is sufficient', () => {
    const result = calculateTanklessStep(140, 2.0, 60);
    expect(result.temp).toBe(140);
    expect(result.isBTULimited).toBe(false);
  });

  it('becomes BTU-limited at high flow rates', () => {
    // At 11 GPM with 60°F inlet wanting 140°F: needs 11*500.4*80 = 440,352 BTU/h
    // Max effective BTU is 199000*0.97 = 193,030. Should be limited.
    const result = calculateTanklessStep(140, 11, 60);
    expect(result.isBTULimited).toBe(true);
    expect(result.temp).toBeLessThan(140);
    expect(result.temp).toBeGreaterThan(60);
  });

  it('passes water through at inlet temp when inlet is already above target', () => {
    // Tank pre-heats to 145°F, tankless target is 140°F.
    // Heater cannot cool — should pass through at 145°F.
    const result = calculateTanklessStep(140, 3.0, 145);
    expect(result.temp).toBe(145);
    expect(result.isBTULimited).toBe(false);
  });

  it('passes water through when inlet equals target', () => {
    const result = calculateTanklessStep(140, 3.0, 140);
    expect(result.temp).toBe(140);
    expect(result.isBTULimited).toBe(false);
  });

  it('returns target temp at zero flow', () => {
    const result = calculateTanklessStep(140, 0, 60);
    expect(result.temp).toBe(140);
    expect(result.isBTULimited).toBe(false);
  });

  it('computes correct BTU-limited output temperature', () => {
    // At 5 GPM with 60°F inlet: maxDeltaT = 193030 / (5 * 500.4) = 77.14°F
    // So max output = 60 + 77.14 = 137.14°F
    const result = calculateTanklessStep(140, 5, 60);
    expect(result.isBTULimited).toBe(true);
    expect(result.temp).toBeCloseTo(137.14, 0);
  });
});

describe('Minutes Remaining Calculation', () => {
  it('uses total flow rate for depletion, not just valve tank port flow', () => {
    // 80-gallon tank, all 10 layers above setpoint (125°F), recovery 40 GPH
    const layers = new Array(10).fill(135);
    // At 2.5 GPM demand: net depletion = 2.5 - (40/60) = 2.5 - 0.667 = 1.833 GPM
    // Hot gallons = 80, so minutes = 80 / 1.833 ≈ 43.6
    const result = calculateMinutesRemaining(layers, 80, 2.5, 40, 125);
    expect(result).toBeCloseTo(43.6, 0);
  });

  it('returns Infinity when recovery rate exceeds demand', () => {
    const layers = new Array(10).fill(135);
    // 0.5 GPM demand, 40 GPH recovery = 0.667 GPM. Recovery > demand.
    const result = calculateMinutesRemaining(layers, 80, 0.5, 40, 125);
    expect(result).toBe(Infinity);
  });

  it('accounts for partially depleted tank (some layers below setpoint)', () => {
    // 5 of 10 layers above setpoint = 40 gallons hot in an 80-gallon tank
    const layers = [135, 135, 135, 135, 135, 100, 100, 100, 100, 100];
    // At 5 GPM, recovery 40 GPH: net = 5 - 0.667 = 4.333 GPM
    // Minutes = 40 / 4.333 ≈ 9.23
    const result = calculateMinutesRemaining(layers, 80, 5, 40, 125);
    expect(result).toBeCloseTo(9.23, 0);
  });

  it('returns Infinity at zero flow', () => {
    const layers = new Array(10).fill(135);
    const result = calculateMinutesRemaining(layers, 80, 0, 40, 125);
    expect(result).toBe(Infinity);
  });
});

describe('Stratified Tank Recovery Energy', () => {

  it('heats cold bottom layers using actual delta (targetTemp - coldInTemp)', () => {
    // 80-gallon tank, 10 layers (8 gal each). All at 60°F (cold).
    // Recovery: 40 GPH, target 135°F, cold inlet 60°F → deltaT = 75°F
    // Energy: (40/3600) * 3600 * 75 = 3000 deg-gal → heats 5 layers to target.
    // But convection smooths the boundary, so we verify total energy conservation:
    // Total heat added should be 3000 deg-gal = 375 degree-avg over 8 gal-layers.
    const layers = new Array(10).fill(60);
    const result = calculateStratifiedTankStep(layers, 80, 0, 60, 40, 135, 3600);
    const totalHeatAdded = result.reduce((sum, t) => sum + (t - 60) * 8, 0);
    // 40 GPH * 75°F deltaT = 3000 deg-gal of energy added
    expect(totalHeatAdded).toBeCloseTo(3000, -1);
    // Bottom layers should be hottest (stratified heat rises)
    expect(result[9]).toBeGreaterThan(result[0]);
  });

  it('recovery energy scales with temperature delta, not hardcoded 90°F', () => {
    // With cold inlet 35°F→135°F (delta 100°F): energy = 40 * 100 = 4000 deg-gal
    // With cold inlet 80°F→135°F (delta 55°F):  energy = 40 * 55  = 2200 deg-gal
    // The cold case should add more total energy than the warm case.
    const coldLayers = new Array(10).fill(35);
    const warmLayers = new Array(10).fill(80);
    const resultCold = calculateStratifiedTankStep(coldLayers, 80, 0, 35, 40, 135, 3600);
    const resultWarm = calculateStratifiedTankStep(warmLayers, 80, 0, 80, 40, 135, 3600);
    const heatCold = resultCold.reduce((sum, t) => sum + (t - 35) * 8, 0);
    const heatWarm = resultWarm.reduce((sum, t) => sum + (t - 80) * 8, 0);
    expect(heatCold).toBeCloseTo(4000, -1);
    expect(heatWarm).toBeCloseTo(2200, -1);
    // Cold case adds ~1.8x more energy than warm case
    expect(heatCold).toBeGreaterThan(heatWarm * 1.5);
  });

  it('does not heat above target temperature', () => {
    const layers = new Array(10).fill(130);
    // Layers at 130, target 135. Small gap. With enough energy, should reach 135 max.
    const result = calculateStratifiedTankStep(layers, 80, 0, 60, 40, 135, 7200);
    result.forEach(t => {
      expect(t).toBeLessThanOrEqual(135.01);
    });
  });
});

describe('UI Status Message Logic Emulation', () => {
  const setpoint = 125;
  const flowRate = 0.5;

  it('identifies OPTIMAL STATE when tank flow matches demand (Tank on Cold Port)', () => {
    // Default config: Left (Tank) is COLD, Right (Tankless) is HOT
    const leftPortIsHot = false;
    const tankLayers = [135];
    const currentShuttleR = 0.0; // Pinned to COLD (Tank)
    const flowRate = 0.5;
    
    // Derived values
    const tankFlow = (1 - currentShuttleR) * flowRate;
    
    const isOptimal = tankFlow > (flowRate - 0.05);
    expect(isOptimal).toBe(true);
  });

  it('does NOT LATCH when pinned to Tank even if Tank is hotter than setpoint', () => {
    const leftPortIsHot = false;
    const currentShuttleR = 0.0; // Pinned to COLD
    const tC_Source = 135; // Tank
    const tH_Source = 140; // Tankless
    const setpoint = 125;

    // A latch is only bad if it's NOT the tank and NOT hitting setpoint
    // Logic: If pinned to COLD, and COLD is the TANK, it's not a failure latch.
    const tankOnPort = 'cold'; 
    const isLatchFailure = (currentShuttleR < 0.02 && tC_Source > setpoint + 0.5 && tankOnPort !== 'cold');
    
    expect(isLatchFailure).toBe(false);
  });

  it('IDENTIFIES LATCH when pinned to Tankless and Tankless is too cold', () => {
    const leftPortIsHot = false; // Tank is COLD port, Tankless is HOT port
    const tankOnPort = 'cold';
    const currentShuttleR = 1.0; // Pinned to HOT (Tankless)
    const tH_Source = 120; // Tankless is 120, setpoint is 125
    const setpoint = 125;

    const isLatchFailure = (currentShuttleR > 0.98 && tH_Source < setpoint - 0.5 && tankOnPort !== 'hot');
    expect(isLatchFailure).toBe(true);
  });
});
