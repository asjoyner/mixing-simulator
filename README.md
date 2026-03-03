# Apollo Mixing Valve Physical Simulator (v8.1)

## Project Overview
This high-fidelity simulator models a complex residential hot water architecture. It specifically evaluates a **Series-Hybrid** configuration where a primary **Stratified Storage Tank** feeds a secondary **Rinnai SENSEI RX199iN** Tankless heater, both managed by an **Apollo MVA (34A) Series 1" Mixing Valve**.

## Key Simulation Features (v8.1)
- **Series-Hybrid Plumbing Logic:** 
    - Modeled as a sequential system where 100% of demand passes through the tank first.
    - The Tankless heater acts as a "booster," receiving pre-heated water from the tank output.
- **Stratified Thermal Tank Model:** 
    - Replaces simple mixing with a **10-layer vertical stratification model**. 
    - Captures the "cold front" behavior where output temperature remains high until the hot water volume is truly exhausted.
    - Includes bottom-up heat recovery (GPH) and simple convective mixing.
- **Rinnai RX199iN BTU Modeling:** 
    - Models the 199,000 BTU/h burner with 97% efficiency. 
    - Dynamically derates output temperature when GPM demand exceeds the unit's thermal capacity (BTU-limiting).
- **Physical Wax Element Dynamics:** 
    - Uses a differential equation ($dR/dt$) to model the 8-second time constant of the Apollo valve's thermostatic wax capsule.
    - Accurately captures **Inverted Loop Latching**—a physical failure state where the valve pins itself to a cold source because it is physically "blind" to the other port's recovery.
- **Advanced Real-Time Analytics:**
    - **Time Remaining:** Predicts exactly how many minutes of setpoint-compliant water remain in the tank.
    - **System Capacity:** Calculates the combined steady-state flow limit (~8.1 GPM) using both the Rinnai burner and the Tank recovery burner.
    - **Optimal Flow:** Identifies the maximum sustainable flow rate that can be met indefinitely without ever firing the tankless unit.

## Visual Interface
- **Dynamic SVG Diagram:** A modern, high-contrast dashboard showing the temperature gradient in the tank, actual port labels on the Apollo valve, and animated flow particles that scale with demand.
- **Unified Color Language:** A standardized thermal scale where **Blue** is 60°F, **Orange** is 125°F, and **Red** is 140°F+.
- **Time Controls:** A simulation clock and speed slider (defaulting to 1x, adjustable to 300x) for observing long-term thermal cycles.

## Project Structure
- **Source:** `/_source/src/` (React/TS code and Physics models)
- **Deployment:** `/` (Static production assets served by Apache)
- **Tests:** `/_source/src/models/ValveModel.test.ts` (Verified edge cases and physical drive logic)
