import React, { useEffect, useRef, useState } from 'react';

const TYRE_SPECS = {
  Soft:   { maxSpeed: 4.0, limitLaps: 3, displaySpeed: 80 },
  Medium: { maxSpeed: 3.5, limitLaps: 5, displaySpeed: 70 },
  Hard:   { maxSpeed: 3.0, limitLaps: 6, displaySpeed: 60 }
};

const MIN_DEGRADED_SPEED = 1.0; 
const PIT_TIME_PENALTY = 1000; 

const trackPath = new Path2D();
trackPath.moveTo(200, 450);  
trackPath.lineTo(200, 150);  
trackPath.lineTo(500, 150);  
trackPath.lineTo(500, 250);  
trackPath.lineTo(700, 250);  
trackPath.lineTo(700, 450);  
trackPath.closePath();       

const pitPath = new Path2D();
pitPath.moveTo(600, 450);    
pitPath.lineTo(600, 530);    
pitPath.lineTo(300, 530);    
pitPath.lineTo(300, 450);    

const carImg1 = new Image(); 
carImg1.src = '/car1.png';

const carImg2 = new Image(); 
carImg2.src = '/car2.png';

export default function App() {
  const canvasRef = useRef(null);
  const requestRef = useRef(null);

  const [phase, setPhase] = useState('SETUP');
  const [maxLaps, setMaxLaps] = useState(10);
  const [showGuide, setShowGuide] = useState(false);
  
  const [setupConfig, setSetupConfig] = useState({
    p1: { startTyre: 'Soft', pit1Lap: 3, pit1Tyre: 'Medium', pit2Lap: 7, pit2Tyre: 'Hard' },
    p2: { startTyre: 'Hard', pit1Lap: 5, pit1Tyre: 'Medium', pit2Lap: 8, pit2Tyre: 'Soft' }
  });

  const [gameState, setGameState] = useState({
    p1: { lap: 0, tyreHealth: 100, speed: 0, currentTyre: 'Soft', message: "Awaiting race start...", computations: {} },
    p2: { lap: 0, tyreHealth: 100, speed: 0, currentTyre: 'Hard', message: "Awaiting race start...", computations: {} },
    winner: null,
    matrixData: null,
  });

  const game = useRef(null);

  const startGame = () => {
    game.current = {
      keys: {},
      startTime: Date.now(),
      frameCount: 0,
      raceEnded: false,
      p1: { 
          x: 420, y: 130, angle: 0, speed: 0, lap: 0, 
          currentTyre: setupConfig.p1.startTyre, tyreAgeLaps: 0, 
          tyreQueue: [setupConfig.p1.pit1Tyre, setupConfig.p1.pit2Tyre],
          inPit: false, pitTimer: 0, pittedLap: null, finished: false, time: 0, message: "Race Started! Establishing Mixed Strategy...",
          speedHistory: []
      },
      p2: { 
          x: 420, y: 170, angle: 0, speed: 0, lap: 0, 
          currentTyre: setupConfig.p2.startTyre, tyreAgeLaps: 0, 
          tyreQueue: [setupConfig.p2.pit1Tyre, setupConfig.p2.pit2Tyre],
          inPit: false, pitTimer: 0, pittedLap: null, finished: false, time: 0, message: "Race Started! Establishing Mixed Strategy...",
          speedHistory: []
      }
    };
    setPhase('PLAYING');
  };

  const checkRaceOver = (winnerId, winTime) => {
    const winnerName = winnerId === 'p1' ? 'Player 1' : 'Player 2';
    
    const matrixData = {
        p1Strategy: `Start ${setupConfig.p1.startTyre} -> L${setupConfig.p1.pit1Lap} ${setupConfig.p1.pit1Tyre} -> L${setupConfig.p1.pit2Lap} ${setupConfig.p1.pit2Tyre}`,
        p2Strategy: `Start ${setupConfig.p2.startTyre} -> L${setupConfig.p2.pit1Lap} ${setupConfig.p2.pit1Tyre} -> L${setupConfig.p2.pit2Lap} ${setupConfig.p2.pit2Tyre}`,
        p1Time: winnerId === 'p1' ? (winTime / 1000).toFixed(2) + 's' : 'DNF',
        p2Time: winnerId === 'p2' ? (winTime / 1000).toFixed(2) + 's' : 'DNF',
        p1Payoff: winnerId === 'p1' ? 1 : -1,
        p2Payoff: winnerId === 'p2' ? 1 : -1,
    };

    setGameState(prev => ({ ...prev, winner: winnerName, matrixData }));
    setPhase('FINISHED');
  };

  const generateAIAdvice = (car, opponent, maxL) => {
      const health = Math.max(0, 100 - (car.tyreAgeLaps / TYRE_SPECS[car.currentTyre].limitLaps) * 100);
      if (car.inPit) return "Goal Programming constraint satisfied: Minimizing pit time penalty.";
      if (car.lap >= maxL) return "Six Sigma Target Reached. Finish line crossed!";
      if (health < 15) return "Decision Tree Output: IF Health < 15 THEN PIT IMMEDIATELY! Maximize Random Forest payoff.";
      if (health < 40) return "Markov Chain Probability: 85% chance of dropping to Critical State next lap. Prepare to Pit!";
      if (car.speed < 2.0 && health > 50) return "Six Sigma Check: Speed Variance detected. Maintain optimal racing line to improve Cpk.";
      if (car.lap === 1) return "Nash Equilibrium: Mixed Strategy Oddments suggest maintaining pace to read opponent.";
      if (opponent.currentTyre !== car.currentTyre) {
          if (TYRE_SPECS[car.currentTyre].maxSpeed > TYRE_SPECS[opponent.currentTyre].maxSpeed) {
              return "MCDA Analysis: You have speed advantage. Push to maximize time delta!";
          } else {
              return "MCDA Analysis: Defend inner lines to optimize Goal Programming constraints against faster opponent.";
          }
      }
      return "Process Capability (Cp) optimal. Maintain current trajectory.";
  };

  const calculateLiveComputations = (car) => {
      const limit = TYRE_SPECS[car.currentTyre].limitLaps;
      const displaySpeed = car.speed * 20;
      
      car.speedHistory.push(displaySpeed);
      if (car.speedHistory.length > 60) car.speedHistory.shift();

      const n = car.speedHistory.length;
      const mean = car.speedHistory.reduce((a, b) => a + b, 0) / (n || 1);
      const variance = car.speedHistory.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n || 1);
      const sigma = Math.sqrt(variance) + 0.001; 

      const USL = TYRE_SPECS[car.currentTyre].displaySpeed;
      const LSL = 20;
      const cpk = Math.min((USL - mean) / (3 * sigma), (mean - LSL) / (3 * sigma));

      const markovProb = Math.min(99.9, Math.pow(car.tyreAgeLaps / limit, 2) * 100);

      const health = Math.max(0, 100 - (car.tyreAgeLaps / limit) * 100);
      const dtPath = `Root -> IF(Health<15):[${health < 15 ? 'TRUE->PIT' : 'FALSE->TRACK'}]`;

      const gpObj = car.inPit ? "Constraint=Penalty(1s)" : `MaxSpeed=${USL}`;

      return {
          sixSigma: `μ: ${mean.toFixed(1)}, σ: ${sigma.toFixed(2)}, Cpk: ${cpk.toFixed(2)}`,
          markov: `P(S_critical | S_current) = ${markovProb.toFixed(1)}%`,
          dtree: dtPath,
          mcda: gpObj
      };
  };

  const updateCar = (car, opponent, controls, ctx, playerId) => {
    if (game.current.raceEnded || car.finished) return;

    const specs = TYRE_SPECS[car.currentTyre];

    if (car.inPit) {
      car.speed = 0;
      if (Date.now() - car.pitTimer > PIT_TIME_PENALTY) {
        const nextTyre = car.tyreQueue.shift();
        if (nextTyre) car.currentTyre = nextTyre;
        car.tyreAgeLaps = 0; 
        car.inPit = false;
        car.pittedLap = car.lap;
      }
      return; 
    }

    if (car.x > 430 && car.x < 470 && car.y > 510) {
        if (car.pittedLap !== car.lap) {
            car.inPit = true;
            car.pitTimer = Date.now();
            car.speed = 0;
            return;
        }
    }

    let actualMaxSpeed = specs.maxSpeed;
    if (car.tyreAgeLaps >= specs.limitLaps) {
        actualMaxSpeed = MIN_DEGRADED_SPEED; 
    }

    if (game.current.keys[controls.fwd]) car.speed = Math.min(car.speed + 0.1, actualMaxSpeed);
    else if (game.current.keys[controls.back]) car.speed = Math.max(car.speed - 0.1, -1.5);
    else car.speed *= 0.95; 

    if (game.current.keys[controls.left]) car.angle -= 0.055;
    if (game.current.keys[controls.right]) car.angle += 0.055;

    let nextX = car.x + Math.cos(car.angle) * car.speed;
    let nextY = car.y + Math.sin(car.angle) * car.speed;

    ctx.lineWidth = 90;
    const onMain = ctx.isPointInStroke(trackPath, nextX, nextY);
    ctx.lineWidth = 40;
    const onPit = ctx.isPointInStroke(pitPath, nextX, nextY);

    if (onMain || onPit) {
        car.x = nextX;
        car.y = nextY;
    } else {
        car.speed = -car.speed * 0.6; 
    }

    if (car.x > 375 && car.x < 390 && car.y < 200 && Math.cos(car.angle) > 0) {
      if (!car.lapCooldown) {
        car.lap += 1;
        car.tyreAgeLaps += 1;
        car.lapCooldown = true;
        setTimeout(() => (car.lapCooldown = false), 2000);
        
        if (car.lap >= maxLaps && !game.current.raceEnded) {
            game.current.raceEnded = true;
            car.finished = true;
            car.time = Date.now() - game.current.startTime;
            checkRaceOver(playerId, car.time);
        }
      }
    }

    if (game.current.frameCount % 120 === 0) {
        car.message = generateAIAdvice(car, opponent, maxLaps);
    }
  };

  const gameLoop = () => {
    if (phase !== 'PLAYING') return;
    const ctx = canvasRef.current.getContext('2d');
    
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(0, 0, 800, 600);

    ctx.lineWidth = 40;
    ctx.strokeStyle = '#444';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke(pitPath);

    ctx.lineWidth = 90;
    ctx.strokeStyle = '#333';
    ctx.stroke(trackPath);

    ctx.fillStyle = 'white';
    ctx.fillRect(380, 105, 5, 90);

    ctx.fillStyle = 'rgba(255, 255, 0, 0.4)';
    ctx.fillRect(430, 510, 40, 40);

    ctx.fillStyle = 'white';
    ctx.fillRect(410, 560, 80, 20);
    ctx.fillStyle = 'black';
    ctx.font = "12px Arial";
    ctx.fillText("PITLANE", 425, 575);

    updateCar(game.current.p1, game.current.p2, { fwd: 'w', back: 's', left: 'a', right: 'd' }, ctx, 'p1');
    updateCar(game.current.p2, game.current.p1, { fwd: 'ArrowUp', back: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }, ctx, 'p2');

    const p1 = game.current.p1;
    const p2 = game.current.p2;

    if (!p1.finished && !p2.finished && !p1.inPit && !p2.inPit) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = 22; 
        
        if (distance < minDistance && distance > 0) {
            const overlap = minDistance - distance;
            const nx = dx / distance;
            const ny = dy / distance;
            
            p1.x -= nx * (overlap / 2);
            p1.y -= ny * (overlap / 2);
            p2.x += nx * (overlap / 2);
            p2.y += ny * (overlap / 2);

            p1.speed *= 0.85;
            p2.speed *= 0.85;
        }
    }

    const drawCar = (car, color, img) => {
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);
      
      if (img && img.complete && img.naturalWidth > 0) {
          ctx.rotate(Math.PI / 2); 
          ctx.drawImage(img, -10, -15, 20, 30);
      } else {
          ctx.fillStyle = color;
          ctx.fillRect(-10, -5, 20, 10);
      }
      
      if (car.inPit) {
        ctx.rotate(-Math.PI / 2); 
        ctx.fillStyle = 'yellow';
        ctx.font = "bold 14px Arial";
        ctx.fillText("PITTING", -30, -20);
      }
      ctx.restore();
    };

    drawCar(game.current.p1, 'red', carImg1); 
    drawCar(game.current.p2, '#3b82f6', carImg2); 

    game.current.frameCount++;
    if (game.current.frameCount % 10 === 0) {
        const p1Limit = TYRE_SPECS[game.current.p1.currentTyre].limitLaps;
        const p2Limit = TYRE_SPECS[game.current.p2.currentTyre].limitLaps;

        const p1Comps = calculateLiveComputations(game.current.p1);
        const p2Comps = calculateLiveComputations(game.current.p2);

        setGameState(prev => ({
            ...prev,
            p1: { lap: game.current.p1.lap, tyreHealth: Math.max(0, 100 - (game.current.p1.tyreAgeLaps / p1Limit)*100), speed: game.current.p1.speed, currentTyre: game.current.p1.currentTyre, message: game.current.p1.message, computations: p1Comps },
            p2: { lap: game.current.p2.lap, tyreHealth: Math.max(0, 100 - (game.current.p2.tyreAgeLaps / p2Limit)*100), speed: game.current.p2.speed, currentTyre: game.current.p2.currentTyre, message: game.current.p2.message, computations: p2Comps }
        }));
    }

    requestRef.current = requestAnimationFrame(gameLoop);
  };
  
  useEffect(() => {
    if (phase === 'PLAYING') {
        const handleKeyDown = (e) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
            game.current.keys[e.key] = true;
        };
        const handleKeyUp = (e) => (game.current.keys[e.key] = false);

        window.addEventListener('keydown', handleKeyDown, { passive: false });
        window.addEventListener('keyup', handleKeyUp);
        requestRef.current = requestAnimationFrame(gameLoop);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            cancelAnimationFrame(requestRef.current);
        };
    }
  }, [phase]);

  if (phase === 'SETUP') {
      return (
          <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6 relative">
              <h1 className="text-4xl font-bold mb-6 text-yellow-400">Pre-Race Strategy Setup</h1>
              
              <button onClick={() => setShowGuide(true)} className="absolute top-6 right-6 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded font-bold">
                  View Academic Strategy Guide
              </button>

              {showGuide && (
                  <div className="absolute inset-0 bg-opacity-50 z-50 flex items-center justify-center p-8">
                      <div className="bg-gray-800 p-8 rounded-lg max-w-3xl border border-gray-600 shadow-2xl">
                          <h2 className="text-3xl font-bold text-yellow-400 mb-4">Academic Strategy Application</h2>
                          <div className="space-y-4 text-gray-300">
                              <p><strong className="text-white">Oddments & Nash Equilibrium:</strong> Your 3 tyre choices form a 3x3 Payoff Matrix. Use a Mixed Strategy to remain unpredictable and find the Equilibrium.</p>
                              <p><strong className="text-white">Markov Chains:</strong> Tyre health transitions through states (Optimal -&gt; Degraded -&gt; Critical). The AI will predict transition probabilities so you can pit before reaching the Critical state.</p>
                              <p><strong className="text-white">Decision Trees:</strong> Build mental conditional trees. IF opponent is on Softs AND your health is &gt; 50%, THEN defend defensively.</p>
                              <p><strong className="text-white">Six Sigma (Cp/Cpk):</strong> Treat your lap driving as a manufacturing process. Minimize steering variance to improve your Process Capability Index (Cpk).</p>
                              <p><strong className="text-white">MCDA & Goal Programming:</strong> Optimize multiple constraints simultaneously (Minimize time, satisfy tyre limits, maximize track position).</p>
                          </div>
                          <button onClick={() => setShowGuide(false)} className="mt-6 px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded">Close Guide</button>
                      </div>
                  </div>
              )}

              <div className="mb-6 flex items-center gap-4 bg-gray-800 p-4 rounded-lg border-2 border-yellow-500">
                  <label className="text-xl font-bold">Total Race Laps:</label>
                  <input type="number" min="3" max="50" value={maxLaps} onChange={(e) => setMaxLaps(Number(e.target.value))} className="bg-gray-700 p-2 rounded text-white font-bold w-20 text-center text-xl"/>
              </div>

              <div className="flex gap-8 w-full max-w-5xl">
                  <div className="flex-1 bg-gray-800 p-6 rounded-lg border-t-8 border-red-500 shadow-xl">
                      <h2 className="text-2xl font-bold text-red-400 mb-6">Player 1 (WASD)</h2>
                      <div className="flex flex-col gap-6">
                          <div className="p-4 bg-gray-700 rounded-lg">
                              <label className="block text-sm text-yellow-300 font-bold mb-1">Starting Tyre</label>
                              <select value={setupConfig.p1.startTyre} onChange={(e) => setSetupConfig(p => ({...p, p1: {...p.p1, startTyre: e.target.value}}))} className="w-full p-2 bg-gray-900 rounded font-bold">
                                  <option value="Soft">Soft (80km/h - 3 Laps)</option>
                                  <option value="Medium">Medium (70km/h - 5 Laps)</option>
                                  <option value="Hard">Hard (60km/h - 6 Laps)</option>
                              </select>
                          </div>

                          <div className="p-4 bg-gray-700 rounded-lg border-l-4 border-blue-400">
                              <h3 className="font-bold text-blue-300 mb-2">Strategy 1 (1st Pit Stop)</h3>
                              <div className="flex gap-2">
                                  <div className="w-1/3">
                                      <label className="block text-xs text-gray-400 mb-1">Lap to Pit</label>
                                      <input type="number" min="1" max={maxLaps} value={setupConfig.p1.pit1Lap} onChange={(e) => setSetupConfig(p => ({...p, p1: {...p.p1, pit1Lap: Number(e.target.value)}}))} className="w-full p-2 bg-gray-900 rounded"/>
                                  </div>
                                  <div className="w-2/3">
                                      <label className="block text-xs text-gray-400 mb-1">Change To</label>
                                      <select value={setupConfig.p1.pit1Tyre} onChange={(e) => setSetupConfig(p => ({...p, p1: {...p.p1, pit1Tyre: e.target.value}}))} className="w-full p-2 bg-gray-900 rounded">
                                          <option value="Soft">Soft</option><option value="Medium">Medium</option><option value="Hard">Hard</option>
                                      </select>
                                  </div>
                              </div>
                          </div>

                          <div className="p-4 bg-gray-700 rounded-lg border-l-4 border-green-400">
                              <h3 className="font-bold text-green-300 mb-2">Strategy 2 (2nd Pit Stop)</h3>
                              <div className="flex gap-2">
                                  <div className="w-1/3">
                                      <label className="block text-xs text-gray-400 mb-1">Lap to Pit</label>
                                      <input type="number" min="1" max={maxLaps} value={setupConfig.p1.pit2Lap} onChange={(e) => setSetupConfig(p => ({...p, p1: {...p.p1, pit2Lap: Number(e.target.value)}}))} className="w-full p-2 bg-gray-900 rounded"/>
                                  </div>
                                  <div className="w-2/3">
                                      <label className="block text-xs text-gray-400 mb-1">Change To</label>
                                      <select value={setupConfig.p1.pit2Tyre} onChange={(e) => setSetupConfig(p => ({...p, p1: {...p.p1, pit2Tyre: e.target.value}}))} className="w-full p-2 bg-gray-900 rounded">
                                          <option value="Soft">Soft</option><option value="Medium">Medium</option><option value="Hard">Hard</option>
                                      </select>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>

                  <div className="flex-1 bg-gray-800 p-6 rounded-lg border-t-8 border-blue-500 shadow-xl">
                      <h2 className="text-2xl font-bold text-blue-400 mb-6">Player 2 (Arrows)</h2>
                      <div className="flex flex-col gap-6">
                          <div className="p-4 bg-gray-700 rounded-lg">
                              <label className="block text-sm text-yellow-300 font-bold mb-1">Starting Tyre</label>
                              <select value={setupConfig.p2.startTyre} onChange={(e) => setSetupConfig(p => ({...p, p2: {...p.p2, startTyre: e.target.value}}))} className="w-full p-2 bg-gray-900 rounded font-bold">
                                  <option value="Soft">Soft (80km/h - 3 Laps)</option>
                                  <option value="Medium">Medium (70km/h - 5 Laps)</option>
                                  <option value="Hard">Hard (60km/h - 6 Laps)</option>
                              </select>
                          </div>

                          <div className="p-4 bg-gray-700 rounded-lg border-l-4 border-blue-400">
                              <h3 className="font-bold text-blue-300 mb-2">Strategy 1 (1st Pit Stop)</h3>
                              <div className="flex gap-2">
                                  <div className="w-1/3">
                                      <label className="block text-xs text-gray-400 mb-1">Lap to Pit</label>
                                      <input type="number" min="1" max={maxLaps} value={setupConfig.p2.pit1Lap} onChange={(e) => setSetupConfig(p => ({...p, p2: {...p.p2, pit1Lap: Number(e.target.value)}}))} className="w-full p-2 bg-gray-900 rounded"/>
                                  </div>
                                  <div className="w-2/3">
                                      <label className="block text-xs text-gray-400 mb-1">Change To</label>
                                      <select value={setupConfig.p2.pit1Tyre} onChange={(e) => setSetupConfig(p => ({...p, p2: {...p.p2, pit1Tyre: e.target.value}}))} className="w-full p-2 bg-gray-900 rounded">
                                          <option value="Soft">Soft</option><option value="Medium">Medium</option><option value="Hard">Hard</option>
                                      </select>
                                  </div>
                              </div>
                          </div>

                          <div className="p-4 bg-gray-700 rounded-lg border-l-4 border-green-400">
                              <h3 className="font-bold text-green-300 mb-2">Strategy 2 (2nd Pit Stop)</h3>
                              <div className="flex gap-2">
                                  <div className="w-1/3">
                                      <label className="block text-xs text-gray-400 mb-1">Lap to Pit</label>
                                      <input type="number" min="1" max={maxLaps} value={setupConfig.p2.pit2Lap} onChange={(e) => setSetupConfig(p => ({...p, p2: {...p.p2, pit2Lap: Number(e.target.value)}}))} className="w-full p-2 bg-gray-900 rounded"/>
                                  </div>
                                  <div className="w-2/3">
                                      <label className="block text-xs text-gray-400 mb-1">Change To</label>
                                      <select value={setupConfig.p2.pit2Tyre} onChange={(e) => setSetupConfig(p => ({...p, p2: {...p.p2, pit2Tyre: e.target.value}}))} className="w-full p-2 bg-gray-900 rounded">
                                          <option value="Soft">Soft</option><option value="Medium">Medium</option><option value="Hard">Hard</option>
                                      </select>
                                  </div>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>

              <button onClick={startGame} className="mt-8 px-16 py-4 bg-green-600 hover:bg-green-500 text-2xl font-bold rounded-xl shadow-[0_0_20px_rgba(74,222,128,0.5)] transition-all hover:scale-105">
                  START RACE
              </button>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans flex flex-col items-center p-4">
      <div className="text-center mb-2">
        <h1 className="text-2xl font-bold mb-1">F1 Game-Theoretic Simulation</h1>
      </div>

      <div className="flex flex-row gap-6 items-stretch justify-center w-full max-w-screen-2xl">
        <div className="w-80 bg-gray-800 p-5 rounded-lg border-l-4 border-red-500 shadow-xl flex-shrink-0 flex flex-col justify-start">
          <div className="mb-4">
              <h2 className="text-xl font-bold text-red-500 mb-3">Player 1 <span className="text-xs text-gray-400">(WASD)</span></h2>
              <div className="space-y-2 text-base">
                <p>Lap: <span className="font-bold">{Math.min(gameState.p1.lap, maxLaps)} / {maxLaps}</span></p>
                <p>Tyre: <span className="font-bold text-yellow-400">{gameState.p1.currentTyre}</span></p>
                <div>
                  <p className="mb-1 text-xs">Tyre Health: {Math.max(0, gameState.p1.tyreHealth).toFixed(0)}%</p>
                  <div className="w-full bg-gray-700 h-4 rounded">
                    <div className={`h-4 rounded transition-all duration-300 ${gameState.p1.tyreHealth > 10 ? 'bg-green-500' : 'bg-red-600 animate-pulse'}`} style={{ width: `${gameState.p1.tyreHealth}%` }}></div>
                  </div>
                </div>
                <p>Speed: <span className={`font-bold ${gameState.p1.speed < 1.5 ? 'text-red-500' : 'text-white'}`}>{(gameState.p1.speed * 20).toFixed(0)} km/h</span></p>
              </div>
          </div>
          
          <div className="p-3 bg-gray-900 rounded border border-gray-600 text-xs h-24 overflow-hidden mb-4">
              <span className="text-yellow-400 font-bold block mb-1">Race Engineer AI:</span>
              <span className="text-gray-300 italic">{gameState.p1.message}</span>
          </div>

          <div className="flex-grow bg-black rounded border border-green-500 p-3 font-mono text-xs overflow-hidden flex flex-col justify-start shadow-[inset_0_0_10px_rgba(0,255,0,0.1)]">
              <span className="text-green-500 font-bold border-b border-green-800 pb-1 mb-2 block"> LIVE_COMPUTATIONS</span>
              <div className="space-y-2 text-green-400">
                  <p><span className="text-gray-400">SixSigma[Cpk]:</span><br/>{gameState.p1.computations.sixSigma}</p>
                  <p><span className="text-gray-400">MarkovChain:</span><br/>{gameState.p1.computations.markov}</p>
                  <p><span className="text-gray-400">DecisionTree:</span><br/>{gameState.p1.computations.dtree}</p>
                  <p><span className="text-gray-400">MCDA/GoalProg:</span><br/>{gameState.p1.computations.mcda}</p>
              </div>
          </div>
        </div>

        <div className="relative shadow-2xl flex-shrink-0 border-4 border-gray-700 rounded-lg overflow-hidden bg-white self-center">
          <canvas ref={canvasRef} width="800" height="600" className="block"></canvas>
          
          {phase === 'FINISHED' && (
            <div className="absolute inset-0 bg-black bg-opacity-95 flex flex-col items-center justify-center p-8 z-50">
              <h2 className="text-6xl font-extrabold text-yellow-400 mb-2 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]">{gameState.winner} Wins!</h2>
              <h3 className="text-3xl font-bold text-white mb-6 animate-bounce mt-4">🏆 Podium Guy: "Here is your Cup!" 🏆</h3>
              
              <div className="bg-gray-800 p-8 rounded w-full max-w-3xl shadow-lg border border-gray-600">
                  <h3 className="text-2xl font-bold mb-6 border-b border-gray-600 pb-2 text-center text-yellow-300">Strategy Game Theory Extraction</h3>
                  
                  <div className="grid grid-cols-2 gap-6 text-lg mb-6">
                      <div className="bg-gray-900 p-4 rounded border-l-4 border-red-500">
                          <p className="text-red-400 font-bold mb-1">P1 Strategy Executed:</p>
                          <p className="text-sm text-gray-200">{gameState.matrixData.p1Strategy}</p>
                          <p className="mt-3 text-sm font-bold text-gray-400">Total Race Time: <span className="text-white">{gameState.matrixData.p1Time}</span></p>
                      </div>
                      <div className="bg-gray-900 p-4 rounded border-l-4 border-blue-500">
                          <p className="text-blue-400 font-bold mb-1">P2 Strategy Executed:</p>
                          <p className="text-sm text-gray-200">{gameState.matrixData.p2Strategy}</p>
                          <p className="mt-3 text-sm font-bold text-gray-400">Total Race Time: <span className="text-white">{gameState.matrixData.p2Time}</span></p>
                      </div>
                  </div>

                  <div className="bg-gray-900 p-4 rounded text-center border border-gray-700">
                      <p className="text-yellow-400 mb-2 font-bold">Nash Matrix Normal-Form Payoff (P1, P2):</p>
                      <p className="text-4xl font-mono text-white tracking-widest drop-shadow-md">
                          ({gameState.matrixData.p1Payoff}, {gameState.matrixData.p2Payoff})
                      </p>
                  </div>
              </div>

              <button 
                  onClick={() => window.location.reload()} 
                  className="mt-8 px-10 py-4 bg-blue-600 hover:bg-blue-500 rounded text-xl font-bold transition-all shadow-lg hover:scale-105">
                  Play Again
              </button>
            </div>
          )}
        </div>

        <div className="w-80 bg-gray-800 p-5 rounded-lg border-l-4 border-blue-500 shadow-xl flex-shrink-0 flex flex-col justify-start">
          <div className="mb-4">
              <h2 className="text-xl font-bold text-blue-500 mb-3">Player 2 <span className="text-xs text-gray-400">(Arrows)</span></h2>
              <div className="space-y-2 text-base">
                <p>Lap: <span className="font-bold">{Math.min(gameState.p2.lap, maxLaps)} / {maxLaps}</span></p>
                <p>Tyre: <span className="font-bold text-yellow-400">{gameState.p2.currentTyre}</span></p>
                <div>
                  <p className="mb-1 text-xs">Tyre Health: {Math.max(0, gameState.p2.tyreHealth).toFixed(0)}%</p>
                  <div className="w-full bg-gray-700 h-4 rounded">
                    <div className={`h-4 rounded transition-all duration-300 ${gameState.p2.tyreHealth > 10 ? 'bg-green-500' : 'bg-red-600 animate-pulse'}`} style={{ width: `${gameState.p2.tyreHealth}%` }}></div>
                  </div>
                </div>
                <p>Speed: <span className={`font-bold ${gameState.p2.speed < 1.5 ? 'text-red-500' : 'text-white'}`}>{(gameState.p2.speed * 20).toFixed(0)} km/h</span></p>
              </div>
          </div>
          
          <div className="p-3 bg-gray-900 rounded border border-gray-600 text-xs h-24 overflow-hidden mb-4">
              <span className="text-yellow-400 font-bold block mb-1">Race Engineer AI:</span>
              <span className="text-gray-300 italic">{gameState.p2.message}</span>
          </div>

          <div className="flex-grow bg-black rounded border border-blue-500 p-3 font-mono text-xs overflow-hidden flex flex-col justify-start shadow-[inset_0_0_10px_rgba(0,0,255,0.1)]">
              <span className="text-blue-500 font-bold border-b border-blue-800 pb-1 mb-2 block"> LIVE_COMPUTATIONS</span>
              <div className="space-y-2 text-blue-400">
                  <p><span className="text-gray-400">SixSigma[Cpk]:</span><br/>{gameState.p2.computations.sixSigma}</p>
                  <p><span className="text-gray-400">MarkovChain:</span><br/>{gameState.p2.computations.markov}</p>
                  <p><span className="text-gray-400">DecisionTree:</span><br/>{gameState.p2.computations.dtree}</p>
                  <p><span className="text-gray-400">MCDA/GoalProg:</span><br/>{gameState.p2.computations.mcda}</p>
              </div>
          </div>
        </div>

      </div>
    </div>
  );
}