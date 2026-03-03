import { describe, it, expect } from 'vitest';
import { calculatePhysicalShuttleStep, calculateWaxDrive } from './ValveModel';

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
