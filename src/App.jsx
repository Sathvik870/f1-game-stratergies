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

const carImg1 = new Image(); carImg1.src = '/car1.png';
const carImg2 = new Image(); carImg2.src = '/car2.png';

export default function App() {
  const canvasRef = useRef(null);
  const requestRef = useRef(null);

  const [phase, setPhase] = useState('SETUP');
  const [maxLaps, setMaxLaps] = useState(10);
  
  const [setupConfig, setSetupConfig] = useState({
    p1: { startTyre: 'Soft', pit1Lap: 3, pit1Tyre: 'Medium', pit2Lap: 7, pit2Tyre: 'Hard' },
    p2: { startTyre: 'Hard', pit1Lap: 5, pit1Tyre: 'Medium', pit2Lap: 8, pit2Tyre: 'Soft' }
  });

  const [gameState, setGameState] = useState({
    p1: { lap: 0, tyreHealth: 100, speed: 0, currentTyre: 'Soft' },
    p2: { lap: 0, tyreHealth: 100, speed: 0, currentTyre: 'Hard' },
    winner: null,
    matrixData: null,
  });

  const game = useRef(null);

  const startGame = () => {
    game.current = {
      keys: {},
      startTime: Date.now(),
      frameCount: 0,
      p1: { 
          x: 350, y: 130, angle: 0, speed: 0, lap: 0, 
          currentTyre: setupConfig.p1.startTyre, tyreAgeLaps: 0, 
          tyreQueue: [setupConfig.p1.pit1Tyre, setupConfig.p1.pit2Tyre],
          inPit: false, pitTimer: 0, pittedLap: null, finished: false, time: 0 
      },
      p2: { 
          x: 350, y: 170, angle: 0, speed: 0, lap: 0, 
          currentTyre: setupConfig.p2.startTyre, tyreAgeLaps: 0, 
          tyreQueue: [setupConfig.p2.pit1Tyre, setupConfig.p2.pit2Tyre],
          inPit: false, pitTimer: 0, pittedLap: null, finished: false, time: 0 
      }
    };
    setPhase('PLAYING');
  };

  const checkRaceOver = () => {
    const { p1, p2 } = game.current;
    if (p1.finished && p2.finished) {
      const winner = p1.time < p2.time ? 'Player 1' : 'Player 2';
      
      const matrixData = {
          p1Strategy: `Start ${setupConfig.p1.startTyre} -> L${setupConfig.p1.pit1Lap} ${setupConfig.p1.pit1Tyre} -> L${setupConfig.p1.pit2Lap} ${setupConfig.p1.pit2Tyre}`,
          p2Strategy: `Start ${setupConfig.p2.startTyre} -> L${setupConfig.p2.pit1Lap} ${setupConfig.p2.pit1Tyre} -> L${setupConfig.p2.pit2Lap} ${setupConfig.p2.pit2Tyre}`,
          p1Time: (p1.time / 1000).toFixed(2) + 's',
          p2Time: (p2.time / 1000).toFixed(2) + 's',
          p1Payoff: p1.time < p2.time ? 1 : p1.time === p2.time ? 0 : -1,
          p2Payoff: p2.time < p1.time ? 1 : p2.time === p1.time ? 0 : -1,
      };

      setGameState(prev => ({ ...prev, winner, matrixData }));
      setPhase('FINISHED');
    }
  };

  const updateCar = (car, controls, ctx) => {
    if (car.finished) return;

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
        
        if (car.lap >= maxLaps) {
            car.finished = true;
            car.time = Date.now() - game.current.startTime;
            checkRaceOver();
        }
      }
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

    updateCar(game.current.p1, { fwd: 'w', back: 's', left: 'a', right: 'd' }, ctx);
    updateCar(game.current.p2, { fwd: 'ArrowUp', back: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }, ctx);

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

        setGameState(prev => ({
            ...prev,
            p1: { lap: game.current.p1.lap, tyreHealth: Math.max(0, 100 - (game.current.p1.tyreAgeLaps / p1Limit)*100), speed: game.current.p1.speed, currentTyre: game.current.p1.currentTyre },
            p2: { lap: game.current.p2.lap, tyreHealth: Math.max(0, 100 - (game.current.p2.tyreAgeLaps / p2Limit)*100), speed: game.current.p2.speed, currentTyre: game.current.p2.currentTyre }
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
          <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
              <h1 className="text-4xl font-bold mb-6 text-yellow-400">Pre-Race Strategy Setup</h1>
              
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
    <div className="min-h-screen bg-gray-900 text-white font-sans flex flex-col items-center p-6">
      
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold mb-2">F1 Game-Theoretic Simulation</h1>
        <p className="text-gray-400">If you exceed tyre limits, speed drops to 20 km/h! Enter Pitlane to execute your strategy.</p>
      </div>

      <div className="flex flex-row gap-8 items-start justify-center w-full max-w-7xl">
        
        <div className="w-64 bg-gray-800 p-6 rounded-lg border-l-4 border-red-500 shadow-xl flex-shrink-0">
          <h2 className="text-2xl font-bold text-red-500 mb-4">Player 1<br/><span className="text-sm text-gray-400">(WASD)</span></h2>
          <div className="space-y-4 text-lg">
            <p>Lap: <span className="font-bold">{Math.min(gameState.p1.lap, maxLaps)} / {maxLaps}</span></p>
            <p>Tyre: <span className="font-bold text-yellow-400">{gameState.p1.currentTyre}</span></p>
            <div>
              <p className="mb-1 text-sm">Tyre Health: {Math.max(0, gameState.p1.tyreHealth).toFixed(0)}%</p>
              <div className="w-full bg-gray-700 h-6 rounded">
                <div className={`h-6 rounded transition-all duration-300 ${gameState.p1.tyreHealth > 10 ? 'bg-green-500' : 'bg-red-600 animate-pulse'}`} style={{ width: `${gameState.p1.tyreHealth}%` }}></div>
              </div>
            </div>
            <p>Speed: <span className={`font-bold ${gameState.p1.speed < 1.5 ? 'text-red-500' : 'text-white'}`}>{(gameState.p1.speed * 20).toFixed(0)} km/h</span></p>
          </div>
        </div>

        <div className="relative shadow-2xl flex-shrink-0 border-4 border-gray-700 rounded-lg overflow-hidden bg-white">
          <canvas ref={canvasRef} width="800" height="600" className="block"></canvas>
          
          {phase === 'FINISHED' && (
            <div className="absolute inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center p-8">
              <h2 className="text-5xl font-bold text-yellow-400 mb-2">{gameState.winner} Wins!</h2>
              <h3 className="text-3xl font-bold text-white mb-6">🏆 Podium guy, here is your cup! 🏆</h3>
              
              <div className="bg-gray-800 p-8 rounded w-full max-w-3xl shadow-lg">
                  <h3 className="text-2xl font-bold mb-6 border-b border-gray-600 pb-2 text-center">Strategy Game Theory Extraction</h3>
                  
                  <div className="grid grid-cols-2 gap-6 text-lg mb-6">
                      <div>
                          <p className="text-red-400 font-bold mb-1">P1 Strategy Taken:</p>
                          <p className="bg-gray-900 p-3 rounded border border-gray-700 text-sm">{gameState.matrixData.p1Strategy}</p>
                          <p className="mt-2 text-sm text-gray-400">Total Race Time: {gameState.matrixData.p1Time}</p>
                      </div>
                      <div>
                          <p className="text-blue-400 font-bold mb-1">P2 Strategy Taken:</p>
                          <p className="bg-gray-900 p-3 rounded border border-gray-700 text-sm">{gameState.matrixData.p2Strategy}</p>
                          <p className="mt-2 text-sm text-gray-400">Total Race Time: {gameState.matrixData.p2Time}</p>
                      </div>
                  </div>

                  <div className="bg-gray-900 p-4 rounded text-center border border-gray-700">
                      <p className="text-gray-400 mb-2">Nash Matrix Normal-Form Payoff (P1, P2):</p>
                      <p className="text-3xl font-mono text-white tracking-widest">
                          ({gameState.matrixData.p1Payoff}, {gameState.matrixData.p2Payoff})
                      </p>
                  </div>
              </div>

              <button 
                  onClick={() => window.location.reload()} 
                  className="mt-8 px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded text-xl font-bold transition-all shadow-lg">
                  New Match
              </button>
            </div>
          )}
        </div>

        <div className="w-64 bg-gray-800 p-6 rounded-lg border-l-4 border-blue-500 shadow-xl flex-shrink-0">
          <h2 className="text-2xl font-bold text-blue-500 mb-4">Player 2<br/><span className="text-sm text-gray-400">(Arrows)</span></h2>
          <div className="space-y-4 text-lg">
            <p>Lap: <span className="font-bold">{Math.min(gameState.p2.lap, maxLaps)} / {maxLaps}</span></p>
            <p>Tyre: <span className="font-bold text-yellow-400">{gameState.p2.currentTyre}</span></p>
            <div>
              <p className="mb-1 text-sm">Tyre Health: {Math.max(0, gameState.p2.tyreHealth).toFixed(0)}%</p>
              <div className="w-full bg-gray-700 h-6 rounded">
                <div className={`h-6 rounded transition-all duration-300 ${gameState.p2.tyreHealth > 10 ? 'bg-green-500' : 'bg-red-600 animate-pulse'}`} style={{ width: `${gameState.p2.tyreHealth}%` }}></div>
              </div>
            </div>
            <p>Speed: <span className={`font-bold ${gameState.p2.speed < 1.5 ? 'text-red-500' : 'text-white'}`}>{(gameState.p2.speed * 20).toFixed(0)} km/h</span></p>
          </div>
        </div>

      </div>
    </div>
  );
}