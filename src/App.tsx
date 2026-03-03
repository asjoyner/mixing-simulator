import React, { useState, useEffect, useRef } from 'react';
import { calculateStratifiedTankStep, calculatePhysicalShuttleStep, calculateTanklessStep, calculateMinutesRemaining } from './models/ValveModel';

const getTempColor = (t: number) => {
  if (t <= 60) return '#3b82f6';
  if (t >= 140) return '#ef4444';
  if (t < 110) {
    const pct = (t - 60) / 50;
    return `rgb(${Math.floor(59 + pct * (14 - 59))}, ${Math.floor(130 + pct * (165 - 130))}, ${Math.floor(246 + pct * (233 - 246))})`;
  } else if (t < 125) {
    const pct = (t - 110) / 15;
    return `rgb(${Math.floor(14 + pct * (249 - 14))}, ${Math.floor(165 + pct * (115 - 165))}, ${Math.floor(233 + pct * (22 - 233))})`;
  } else {
    const pct = (t - 125) / 15;
    return `rgb(${Math.floor(249 + pct * (239 - 249))}, ${Math.floor(115 + pct * (68 - 115))}, ${Math.floor(22 + pct * (68 - 22))})`;
  }
};

const ModernPlumbingDiagram = ({ 
  currentShuttleR, leftPortIsHot, tankLayers, tTanklessActual, flowRate, setpoint, coldInTemp, tankCapacity, tankFlow, tanklessFlow, isTanklessLimited
}: any) => {
  const bronzeColor = '#b45309';
  const tTankOutput = tankLayers[0];
  const avgTankTemp = tankLayers.reduce((a: number, b: number) => a + b, 0) / tankLayers.length;
  const tH_Source = leftPortIsHot ? tTankOutput : tTanklessActual;
  const tC_Source = leftPortIsHot ? tTanklessActual : tTankOutput;
  const tMixed = currentShuttleR * tH_Source + (1 - currentShuttleR) * tC_Source;
  const mixedColor = getTempColor(tMixed);
  const offset = 50;

  return (
    <div style={{ background: '#18181b', padding: '2rem', borderRadius: '1rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)', marginBottom: '2rem', border: '1px solid #3f3f46' }}>
      <style>{`@keyframes flow { from { stroke-dashoffset: 24; } to { stroke-dashoffset: 0; } } .flow-line { stroke-dasharray: 2 10; animation: flow 1s linear infinite; }`}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#f4f4f5' }}>System Visualization (Series-Hybrid)</h3>
      </div>
      <svg viewBox="0 0 550 250" style={{ width: '100%', height: 'auto', display: 'block' }}>
        <path d={`M ${10+offset} 220 L ${60+offset} 220 L ${60+offset} 180`} fill="none" stroke={getTempColor(coldInTemp)} strokeWidth="4" />
        {flowRate > 0 && <path d={`M ${10+offset} 220 L ${60+offset} 220 L ${60+offset} 180`} fill="none" stroke="white" strokeWidth="2" className="flow-line" style={{ animationDuration: `${2/flowRate}s` }} />}
        <text x={offset} y="240" fill={getTempColor(coldInTemp)} fontSize="10" fontWeight="bold">COLD IN: {coldInTemp}°F</text>
        <rect x={30+offset} y="100" width="60" height="80" rx="5" fill="#27272a" stroke="#3f3f46" strokeWidth="2" />
        {tankLayers.map((temp: number, i: number) => (<rect key={i} x={35+offset} y={105 + (i * 7)} width="50" height="7" fill={getTempColor(temp)} opacity="0.9" />))}
        <text x={60+offset} y="90" textAnchor="middle" fill="#eee" fontSize="10" fontWeight="bold">TANK ({tankCapacity}G)</text>
        <text x={60+offset} y="115" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" style={{ textShadow: '0 0 3px black' }}>{tankLayers[0].toFixed(0)}°F</text>
        <text x={60+offset} y="175" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" style={{ textShadow: '0 0 3px black' }}>{tankLayers[tankLayers.length-1].toFixed(0)}°F</text>
        <text x={25+offset} y="145" textAnchor="end" fill="#a1a1aa" fontSize="10" fontWeight="bold">AVG: {avgTankTemp.toFixed(1)}°F</text>
        <circle cx={110+offset} cy="140" r="4" fill="#52525b" />
        <path d={`M ${90+offset} 140 L ${180+offset} 140 L ${180+offset} 100`} fill="none" stroke={getTempColor(tTankOutput)} strokeWidth="8" rx="5" />
        {tankFlow > 0.1 && <path d={`M ${90+offset} 140 L ${180+offset} 140 L ${180+offset} 100`} fill="none" stroke="white" strokeWidth="2" className="flow-line" style={{ animationDuration: `${2/tankFlow}s` }} />}
        <path d={`M ${110+offset} 140 L ${110+offset} 200 L ${300+offset} 200 L ${300+offset} 180`} fill="none" stroke={getTempColor(tTankOutput)} strokeWidth="4" opacity="0.8" />
        {tanklessFlow > 0.1 && <path d={`M ${110+offset} 140 L ${110+offset} 200 L ${300+offset} 200 L ${300+offset} 180`} fill="none" stroke="white" strokeWidth="2" className="flow-line" style={{ animationDuration: `${2/tanklessFlow}s` }} />}
        <text x={195+offset} y="215" textAnchor="middle" fill="#a1a1aa" fontSize="8" fontWeight="bold">PRE-HEAT ({tTankOutput.toFixed(0)}°F)</text>
        <rect x={270+offset} y="120" width="60" height="60" rx="5" fill="#27272a" stroke={isTanklessLimited ? "#ef4444" : "#3f3f46"} strokeWidth="2" />
        <path d={`M ${280+offset} 135 L ${320+offset} 135 L ${280+offset} 150 L ${320+offset} 150 L ${280+offset} 165 L ${320+offset} 165`} fill="none" stroke={getTempColor(tTanklessActual)} strokeWidth="2" />
        <text x={335+offset} y="185" textAnchor="start" fill={isTanklessLimited ? "#ef4444" : "#eee"} fontSize="10" fontWeight="bold">Rinnai RX199iN</text>
        <text x={300+offset} y="155" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">{tTanklessActual.toFixed(1)}°F</text>
        <path d={`M ${330+offset} 150 L ${380+offset} 150 L ${380+offset} 100`} fill="none" stroke={getTempColor(tTanklessActual)} strokeWidth="8" rx="5" />
        {tanklessFlow > 0.1 && <path d={`M ${330+offset} 150 L ${380+offset} 150 L ${380+offset} 100`} fill="none" stroke="white" strokeWidth="2" className="flow-line" style={{ animationDuration: `${2/tanklessFlow}s` }} />}
        <rect x={150+offset} y="40" width="260" height="60" rx="8" fill={bronzeColor} stroke="#92400e" strokeWidth="2" />
        <circle cx={280+offset} cy="70" r="22" fill="#92400e" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <text x={280+offset} y="74" textAnchor="middle" fill="white" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1px' }}>APOLLO</text>
        <text x={180+offset} y="90" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">{leftPortIsHot ? 'HOT' : 'COLD'}</text>
        <text x={380+offset} y="90" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">{leftPortIsHot ? 'COLD' : 'HOT'}</text>
        <text x={415+offset} y="70" textAnchor="start" fill="#818cf8" fontSize="10" fontWeight="bold">SET: {setpoint}°F</text>
        <rect x={273+offset} y="0" width="14" height="40" fill={mixedColor} rx="2" />
        {flowRate > 0 && <line x1={280+offset} y1="40" x2={280+offset} y2="0" fill="none" stroke="white" strokeWidth="2" className="flow-line" style={{ animationDuration: `${2/flowRate}s` }} />}
        <text x={295+offset} y="20" fill={mixedColor} fontSize="12" fontWeight="bold">{tMixed.toFixed(1)}°F OUT</text>
      </svg>
    </div>
  );
};

function App() {
  const [tankTargetTemp, setTankTargetTemp] = useState(135);
  const [tanklessSetpoint, setTanklessSetpoint] = useState(140);
  const [setpoint, setSetpoint] = useState(125);
  const [leftPortIsHot, setLeftPortIsHot] = useState(false);
  const [flowRate, setFlowRate] = useState(0.5);
  const [coldInTemp, setColdInTemp] = useState(60);
  const [tankCapacity, setTankCapacity] = useState(80);
  const [recoveryRate, setRecoveryRate] = useState(40);
  const [simSpeed, setSimSpeed] = useState(1);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [tankLayers, setTankLayers] = useState(new Array(10).fill(135));
  const [currentTanklessActual, setCurrentTanklessActual] = useState(140);
  const [isTanklessLimited, setIsTanklessLimited] = useState(false);
  
  const getInitialShuttle = () => {
    let r = 0.5;
    for (let i = 0; i < 120; i++) { r = calculatePhysicalShuttleStep(r, 135, 140, 125, 1); }
    return r;
  };
  const [currentShuttleR, setCurrentShuttleR] = useState(getInitialShuttle());

  const tankOnPort = leftPortIsHot ? 'hot' : 'cold';
  const stateRef = useRef({ tankLayers, currentShuttleR, currentTanklessActual });
  stateRef.current = { tankLayers, currentShuttleR, currentTanklessActual };

  useEffect(() => {
    const tickRateMs = 100;
    const timer = setInterval(() => {
      const stepSeconds = (tickRateMs / 1000) * simSpeed;
      setElapsedSeconds(prev => prev + stepSeconds);
      const { tankLayers: layers, currentShuttleR: r, currentTanklessActual: tL } = stateRef.current;
      const tTankOutput = layers[0];
      const tH = leftPortIsHot ? tTankOutput : tL;
      const tC = leftPortIsHot ? tL : tTankOutput;
      const nextShuttleR = calculatePhysicalShuttleStep(r, tH, tC, setpoint, stepSeconds);
      setCurrentShuttleR(nextShuttleR);
      const tankFlowVal = flowRate; 
      const nextLayers = calculateStratifiedTankStep(layers, tankCapacity, tankFlowVal, coldInTemp, recoveryRate, tankTargetTemp, stepSeconds);
      setTankLayers(nextLayers);
      const tanklessFlowVal = leftPortIsHot ? ((1 - nextShuttleR) * flowRate) : (nextShuttleR * flowRate);
      const tanklessResult = calculateTanklessStep(tanklessSetpoint, tanklessFlowVal, tTankOutput);
      setCurrentTanklessActual(tanklessResult.temp);
      setIsTanklessLimited(tanklessResult.isBTULimited);
    }, tickRateMs);
    return () => clearInterval(timer);
  }, [simSpeed, tanklessSetpoint, setpoint, leftPortIsHot, flowRate, tankCapacity, recoveryRate, tankTargetTemp, coldInTemp]);

  const tTankOutput = tankLayers[0];
  const tH_Source = leftPortIsHot ? tTankOutput : currentTanklessActual;
  const tC_Source = leftPortIsHot ? currentTanklessActual : tTankOutput;
  const tMixed = currentShuttleR * tH_Source + (1 - currentShuttleR) * tC_Source;
  
  const tankFlow = leftPortIsHot ? (currentShuttleR * flowRate) : ((1 - currentShuttleR) * flowRate);
  const tanklessFlow = leftPortIsHot ? ((1 - currentShuttleR) * flowRate) : (currentShuttleR * flowRate);
  const minutesRemaining = calculateMinutesRemaining(tankLayers, tankCapacity, flowRate, recoveryRate, setpoint);

  const maxRinnaiBTU = 199000 * 0.97;
  const maxTankBTU = recoveryRate * 8.34 * 90; 
  const totalSystemBTU = maxRinnaiBTU + maxTankBTU;
  let maxSystemGPM = totalSystemBTU / (500.4 * (setpoint - coldInTemp));
  if (tanklessSetpoint < setpoint) { maxSystemGPM = maxTankBTU / (500.4 * (setpoint - coldInTemp)); }
  const maxOptimalGPM = (recoveryRate / 60) * (tankTargetTemp - coldInTemp) / (setpoint - coldInTemp);

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const sliderStyle = { width: '100%', height: '6px', background: '#3f3f46', borderRadius: '5px', outline: 'none', margin: '15px 0' };

  return (
    <div style={{ background: '#09090b', minHeight: '100vh', width: '100%' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '3rem 2rem', color: '#fafafa', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <header style={{ marginBottom: '3rem' }}><h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0 }}>Apollo MVA Physical Simulator</h1><p style={{ color: '#a1a1aa' }}>Comprehensive Series-Hybrid Thermal Modeling</p></header>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '3rem' }}>
          <div>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ flex: 1, background: '#18181b', padding: '1rem 1.5rem', borderRadius: '0.75rem', border: '1px solid #3f3f46', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontSize: '0.875rem', color: '#a1a1aa', fontWeight: 600 }}>SIMULATION CLOCK</span><span style={{ fontFamily: 'monospace', fontSize: '1.5rem', color: '#6366f1', fontWeight: 'bold' }}>{elapsedSeconds.toFixed(0)}s</span></div>
              <div style={{ width: '200px', background: '#18181b', padding: '1rem 1.5rem', borderRadius: '0.75rem', border: '1px solid #3f3f46' }}><label style={{ display: 'block', fontSize: '0.75rem', color: '#a1a1aa', fontWeight: 600, marginBottom: '0.5rem' }}>SPEED: {simSpeed}x</label><input type="range" min="1" max="300" value={simSpeed} onChange={e => setSimSpeed(parseInt(e.target.value))} style={{ width: '100%', margin: 0 }} /></div>
            </div>
            <ModernPlumbingDiagram currentShuttleR={currentShuttleR} leftPortIsHot={leftPortIsHot} tankLayers={tankLayers} tTanklessActual={currentTanklessActual} flowRate={flowRate} setpoint={setpoint} coldInTemp={coldInTemp} tankCapacity={tankCapacity} tankFlow={tankFlow} tanklessFlow={tanklessFlow} isTanklessLimited={isTanklessLimited} />
            <div style={{ background: '#18181b', padding: '2rem', borderRadius: '1rem', border: '1px solid #3f3f46' }}>
              <h3 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.1rem' }}>Simulation Controls</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div><label style={{ display: 'block', fontSize: '0.875rem', color: '#a1a1aa' }}>Output Demand: <span style={{ color: '#fafafa' }}>{flowRate.toFixed(1)} GPM</span></label><input type="range" min="0" max="20" step="0.1" value={flowRate} onChange={e => setFlowRate(parseFloat(e.target.value))} style={sliderStyle} /></div>
                <div><label style={{ display: 'block', fontSize: '0.875rem', color: '#a1a1aa' }}>Mixing Valve Setpoint: <span style={{ color: '#fafafa' }}>{setpoint}°F</span></label><input type="range" min="85" max="160" value={setpoint} onChange={e => setSetpoint(parseInt(e.target.value))} style={sliderStyle} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '1.5rem' }}>
                <div><label style={{ display: 'block', fontSize: '0.875rem', color: '#a1a1aa' }}>Tank Target: <span style={{ color: '#fafafa' }}>{tankTargetTemp}°F</span></label><input type="range" min="100" max="160" value={tankTargetTemp} onChange={e => setTankTargetTemp(parseInt(e.target.value))} style={sliderStyle} /></div>
                <div><label style={{ display: 'block', fontSize: '0.875rem', color: '#a1a1aa' }}>Tankless Output: <span style={{ color: '#fafafa' }}>{tanklessSetpoint}°F</span></label><input type="range" min="100" max="160" value={tanklessSetpoint} onChange={e => setTanklessSetpoint(parseInt(e.target.value))} style={sliderStyle} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '1.5rem' }}>
                <div><label style={{ display: 'block', fontSize: '0.875rem', color: '#a1a1aa' }}>Tank Capacity: <span style={{ color: '#fafafa' }}>{tankCapacity} Gal</span></label><input type="range" min="10" max="120" value={tankCapacity} onChange={e => setTankCapacity(parseInt(e.target.value))} style={sliderStyle} /></div>
                <div><label style={{ display: 'block', fontSize: '0.875rem', color: '#a1a1aa' }}>Recovery Rate: <span style={{ color: '#fafafa' }}>{recoveryRate} GPH</span></label><input type="range" min="10" max="100" value={recoveryRate} onChange={e => setRecoveryRate(parseInt(e.target.value))} style={sliderStyle} /></div>
              </div>
              <div style={{ marginTop: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', color: '#a1a1aa' }}>Cold Inlet Temp: <span style={{ color: '#fafafa' }}>{coldInTemp}°F</span></label>
                <input type="range" min="35" max="80" value={coldInTemp} onChange={e => setColdInTemp(parseInt(e.target.value))} style={sliderStyle} />
              </div>
              <button onClick={() => setLeftPortIsHot(!leftPortIsHot)} style={{ width: '100%', marginTop: '2rem', padding: '0.75rem', background: '#27272a', color: 'white', border: '1px solid #3f3f46', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600 }}>Swap Inputs (Currently {leftPortIsHot ? 'Left is HOT' : 'Right is HOT'})</button>
            </div>
          </div>
          <div>
            <div style={{ background: '#18181b', padding: '2rem', borderRadius: '1rem', border: '1px solid #3f3f46', textAlign: 'center' }}>
              <h3 style={{ marginTop: 0, fontSize: '0.875rem', textTransform: 'uppercase', color: '#a1a1aa' }}>Real-Time Output</h3>
              <div style={{ fontSize: '4.5rem', fontWeight: 800, color: getTempColor(tMixed) }}>{tMixed.toFixed(1)}°F</div>
              <div style={{ borderTop: '1px solid #27272a', marginTop: '1.5rem', paddingTop: '1.5rem', textAlign: 'left' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}><span style={{ color: '#a1a1aa' }}>Tank Flow</span><span style={{ fontWeight: 600 }}>{tankFlow.toFixed(1)} GPM</span></div>
                 <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}><span style={{ color: '#a1a1aa' }}>Tankless Flow</span><span style={{ fontWeight: 600 }}>{tanklessFlow.toFixed(1)} GPM</span></div>
              </div>
            </div>
            <div style={{ marginTop: '1.5rem', background: '#27272a', padding: '1.5rem', borderRadius: '1rem', fontSize: '0.875rem', lineHeight: 1.6 }}>
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#18181b', borderRadius: '0.5rem', border: '1px solid #3f3f46', textAlign: 'center' }}><span style={{ fontSize: '0.75rem', color: '#a1a1aa', display: 'block', marginBottom: '0.25rem' }}>ESTIMATED HOT WATER REMAINING</span><span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: minutesRemaining === Infinity ? '#22c55e' : minutesRemaining < 5 ? '#ef4444' : '#f97316' }}>{minutesRemaining === Infinity ? 'Infinite (Stable)' : `${minutesRemaining.toFixed(1)} Minutes`}</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ background: '#18181b', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #3f3f46', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.65rem', color: '#a1a1aa', display: 'block', textTransform: 'uppercase' }}>System Capacity</span>
                  <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#f4f4f5' }}>{maxSystemGPM.toFixed(1)} GPM</span>
                  <span style={{ fontSize: '0.6rem', color: '#71717a', display: 'block' }}>@ {setpoint}°F Output</span>
                </div>
                <div style={{ background: '#18181b', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #3f3f46', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.65rem', color: '#a1a1aa', display: 'block', textTransform: 'uppercase' }}>Optimal Flow</span>
                  <span style={{ fontSize: '1rem', fontWeight: 'bold', color: '#86efac' }}>{maxOptimalGPM.toFixed(1)} GPM</span>
                  <span style={{ fontSize: '0.6rem', color: '#71717a', display: 'block' }}>Sustainable Tank-Only</span>
                </div>
              </div>
              {isTanklessLimited && <div style={{ marginBottom: '1rem', color: '#ef4444', fontWeight: 'bold', textAlign: 'center', border: '1px solid #ef4444', padding: '0.5rem', borderRadius: '0.5rem' }}>HEATER BTU LIMITED</div>}
              {/* Refined Analysis Logic */}
              {(tankFlow > (flowRate - 0.05) && tMixed >= setpoint - 0.5) ? (
                <div style={{ marginTop: '1rem', color: '#86efac', border: '1px solid #22c55e', padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(34, 197, 94, 0.1)' }}>
                  <strong>OPTIMAL STATE:</strong> Satisfied by Tank alone. Tankless remains dormant.
                </div>
              ) : ((currentShuttleR > 0.98 && tH_Source < setpoint - 0.5 && tankOnPort !== 'hot') || (currentShuttleR < 0.02 && tC_Source > setpoint + 0.5 && tankOnPort !== 'cold')) ? (
                <div style={{ marginTop: '1rem', color: '#fca5a5', border: '1px solid #ef4444', padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(239, 68, 68, 0.1)' }}>
                  <strong>LATCH ALERT:</strong> The valve is mechanically pinned to Tankless. It cannot "see" if the Tank has recovered.
                </div>
              ) : flowRate <= 0.05 ? (
                <div style={{ marginTop: '1rem', color: '#a1a1aa', border: '1px solid #3f3f46', padding: '0.75rem', borderRadius: '0.5rem' }}>
                  <strong>SYSTEM IDLE:</strong> No active demand.
                </div>
              ) : tanklessFlow > (flowRate - 0.05) ? (
                <div style={{ marginTop: '1rem', color: '#93c5fd', border: '1px solid #3b82f6', padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(59, 130, 246, 0.1)' }}>
                  <strong>SERIES BACKUP:</strong> Tank is depleted. Rinnai is providing primary heat.
                </div>
              ) : (
                <div style={{ marginTop: '1rem', color: '#fafafa', border: '1px solid #3f3f46', padding: '0.75rem', borderRadius: '0.5rem' }}>
                  <strong>SERIES BOOST:</strong> Active mixing.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
