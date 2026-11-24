import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Car,
  ChevronLeft,
  ChevronRight,
  Coins,
  Flame,
  Moon,
  OctagonAlert,
  Pause,
  Play,
  RotateCcw,
  Sun,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { racingAudio } from './audio/racingAudio';
import { CarSelectModal } from './components/CarSelectModal';
import { Speedometer } from './components/Speedometer';
import { SPORTS_CARS } from './data/cars';
import { TrafficRushEngine } from './three/TrafficRushEngine';
import {
  CarSpec,
  ControlState,
  GameMode,
  HudTelemetry,
  OvertakeEvent,
  SavedTrafficData,
  TimeOfDay,
} from './types/traffic';
import { loadTrafficSave, saveTrafficData } from './utils/trafficStorage';

const INITIAL_TELEMETRY: HudTelemetry = {
  speedKmh: 0,
  maxSpeedKmh: 255,
  distanceM: 0,
  score: 0,
  runCoins: 0,
  nitroPct: 100,
  isNitroActive: false,
  isBraking: false,
  overtakeStreak: 0,
};

function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${meters} m`;
}

export default function App() {
  const [save, setSave] = useState<SavedTrafficData>(() => {
    const loaded = loadTrafficSave();
    racingAudio.setMuted(loaded.muted);
    return loaded;
  });

  const [mode, setMode] = useState<GameMode>('START_MENU');
  const [previewCarId, setPreviewCarId] = useState<string>(save.selectedCarId);
  const [telemetry, setTelemetry] = useState<HudTelemetry>(INITIAL_TELEMETRY);
  const [finalRun, setFinalRun] = useState<{
    score: number;
    distanceM: number;
    coins: number;
    isNewHigh: boolean;
  } | null>(null);
  const [overtakeBanner, setOvertakeBanner] = useState<OvertakeEvent | null>(null);
  const [contextLost, setContextLost] = useState(false);

  const [activeControls, setActiveControls] = useState<ControlState>({
    left: false,
    right: false,
    brake: false,
    nitro: false,
  });

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<TrafficRushEngine | null>(null);
  const modeRef = useRef<GameMode>(mode);
  const overtakeTimerRef = useRef<number>(0);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const equippedCar = useMemo(
    () => SPORTS_CARS.find((c) => c.id === save.selectedCarId) ?? SPORTS_CARS[0],
    [save.selectedCarId]
  );

  const previewCar = useMemo(
    () => SPORTS_CARS.find((c) => c.id === previewCarId) ?? equippedCar,
    [previewCarId, equippedCar]
  );

  const updateSave = useCallback(
    (updater: (prev: SavedTrafficData) => SavedTrafficData) => {
      setSave((prev) => {
        const next = updater(prev);
        saveTrafficData(next);
        return next;
      });
    },
    []
  );

  // Initialize Three.js Engine once in isolated ref container
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new TrafficRushEngine(
      mount,
      equippedCar,
      save.timeOfDay,
      {
        onTelemetry: (data) => {
          setTelemetry(data);
        },
        onCoinCollected: () => {
          updateSave((prev) => ({
            ...prev,
            coins: prev.coins + 1,
          }));
        },
        onOvertake: (evt) => {
          setOvertakeBanner(evt);
          window.clearTimeout(overtakeTimerRef.current);
          overtakeTimerRef.current = window.setTimeout(() => {
            setOvertakeBanner(null);
          }, 950);
        },
        onCrash: (finalTelemetry) => {
          setTelemetry(finalTelemetry);
          setActiveControls({
            left: false,
            right: false,
            brake: false,
            nitro: false,
          });
          setSave((prev) => {
            const isNewHigh = finalTelemetry.score > prev.highScore;
            const next: SavedTrafficData = {
              ...prev,
              highScore: Math.max(prev.highScore, finalTelemetry.score),
              bestDistanceM: Math.max(
                prev.bestDistanceM,
                finalTelemetry.distanceM
              ),
            };
            saveTrafficData(next);
            setFinalRun({
              score: finalTelemetry.score,
              distanceM: finalTelemetry.distanceM,
              coins: finalTelemetry.runCoins,
              isNewHigh,
            });
            return next;
          });
          setMode('GAME_OVER');
        },
        onContextLost: () => setContextLost(true),
        onContextRestored: () => setContextLost(false),
      }
    );

    engineRef.current = engine;

    return () => {
      window.clearTimeout(overtakeTimerRef.current);
      engine.dispose();
      engineRef.current = null;
    };
    // Mount once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync car model to 3D engine when previewing or equipping
  useEffect(() => {
    const targetCar = mode === 'CAR_SELECT' ? previewCar : equippedCar;
    engineRef.current?.setCarSpec(targetCar);
  }, [mode, previewCar, equippedCar]);

  // Sync Day / Night mode to 3D engine
  useEffect(() => {
    engineRef.current?.setTimeOfDay(save.timeOfDay);
  }, [save.timeOfDay]);

  const setControlFlag = useCallback(
    (key: keyof ControlState, value: boolean) => {
      setActiveControls((prev) => {
        if (prev[key] === value) return prev;
        const next = { ...prev, [key]: value };
        engineRef.current?.setControls({ [key]: value });
        return next;
      });
    },
    []
  );

  const handleStartRace = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setFinalRun(null);
    setOvertakeBanner(null);
    setActiveControls({ left: false, right: false, brake: false, nitro: false });
    setMode('PLAYING');
    engineRef.current?.startNewRun();
  }, []);

  const handleRestart = useCallback(() => {
    handleStartRace();
  }, [handleStartRace]);

  const handleOpenCarSelect = useCallback(() => {
    setPreviewCarId(save.selectedCarId);
    setMode('CAR_SELECT');
    engineRef.current?.setMode('CAR_SELECT');
  }, [save.selectedCarId]);

  const handleCloseCarSelect = useCallback(() => {
    setPreviewCarId(save.selectedCarId);
    setMode('START_MENU');
    engineRef.current?.setMode('START_MENU');
  }, [save.selectedCarId]);

  const handlePreviewCar = useCallback(
    (car: CarSpec) => {
      setPreviewCarId(car.id);
      if (save.unlockedCarIds.includes(car.id)) {
        updateSave((prev) => ({
          ...prev,
          selectedCarId: car.id,
        }));
      }
    },
    [save.unlockedCarIds, updateSave]
  );

  const handleUnlockCar = useCallback(
    (car: CarSpec) => {
      updateSave((prev) => {
        if (prev.unlockedCarIds.includes(car.id)) return prev;
        if (prev.coins < car.unlockCoins) return prev;
        racingAudio.playCoin();
        return {
          ...prev,
          coins: prev.coins - car.unlockCoins,
          unlockedCarIds: [...prev.unlockedCarIds, car.id],
          selectedCarId: car.id,
        };
      });
      setPreviewCarId(car.id);
    },
    [updateSave]
  );

  const handleToggleTimeOfDay = useCallback(() => {
    updateSave((prev) => {
      const nextTime: TimeOfDay = prev.timeOfDay === 'DAY' ? 'NIGHT' : 'DAY';
      return { ...prev, timeOfDay: nextTime };
    });
  }, [updateSave]);

  const handleToggleMute = useCallback(() => {
    updateSave((prev) => {
      const nextMuted = !prev.muted;
      racingAudio.setMuted(nextMuted);
      if (!nextMuted && modeRef.current === 'PLAYING') {
        racingAudio.startEngine();
      }
      return { ...prev, muted: nextMuted };
    });
  }, [updateSave]);

  const handleTogglePause = useCallback(() => {
    setMode((prev) => {
      if (prev === 'PLAYING') {
        engineRef.current?.setMode('PAUSED');
        setActiveControls({ left: false, right: false, brake: false, nitro: false });
        return 'PAUSED';
      }
      if (prev === 'PAUSED') {
        engineRef.current?.setMode('PLAYING');
        return 'PLAYING';
      }
      return prev;
    });
  }, []);

  const handleBackToMenu = useCallback(() => {
    setMode('START_MENU');
    engineRef.current?.setMode('START_MENU');
  }, []);

  // Keyboard Controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyM') {
        e.preventDefault();
        handleToggleMute();
        return;
      }

      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (modeRef.current === 'PLAYING' || modeRef.current === 'PAUSED') {
          e.preventDefault();
          handleTogglePause();
        }
        return;
      }

      if (modeRef.current !== 'PLAYING') return;

      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault();
        setControlFlag('left', true);
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault();
        setControlFlag('right', true);
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        setControlFlag('brake', true);
      } else if (
        e.code === 'Space' ||
        e.code === 'ArrowUp' ||
        e.code === 'KeyW' ||
        e.code === 'ShiftLeft' ||
        e.code === 'ShiftRight'
      ) {
        e.preventDefault();
        setControlFlag('nitro', true);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        setControlFlag('left', false);
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        setControlFlag('right', false);
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        setControlFlag('brake', false);
      } else if (
        e.code === 'Space' ||
        e.code === 'ArrowUp' ||
        e.code === 'KeyW' ||
        e.code === 'ShiftLeft' ||
        e.code === 'ShiftRight'
      ) {
        setControlFlag('nitro', false);
      }
    };

    const onBlur = () => {
      setActiveControls({ left: false, right: false, brake: false, nitro: false });
      engineRef.current?.setControls({
        left: false,
        right: false,
        brake: false,
        nitro: false,
      });
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [handleToggleMute, handleTogglePause, setControlFlag]);

  // Multi-touch safe pointer helper for Android buttons
  const bindHoldControl = (key: keyof ControlState) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setControlFlag(key, true);
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      setControlFlag(key, false);
    },
    onPointerCancel: () => setControlFlag(key, false),
    onLostPointerCapture: () => setControlFlag(key, false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  return (
    <div className="relative w-full h-dvh overflow-hidden bg-slate-950 select-none">
      {/* Isolated WebGL Viewport Container */}
      <div
        ref={canvasMountRef}
        className="absolute inset-0 w-full h-full"
        aria-label="Traffic Rush 3D Highway Viewport"
      />

      {/* WebGL Context Lost Fallback */}
      {contextLost && (
        <div className="absolute inset-0 z-50 bg-slate-950/95 flex items-center justify-center p-6 text-center">
          <div className="max-w-sm">
            <h2 className="font-display text-xl font-bold text-white">
              Graphics Context Paused
            </h2>
            <p className="text-sm text-slate-300 mt-2">
              Restoring 3D highway rendering. If it does not resume, reload the page.
            </p>
          </div>
        </div>
      )}

      {/* ACTIVE GAMEPLAY HUD */}
      {(mode === 'PLAYING' || mode === 'PAUSED') && (
        <>
          {/* Top HUD Row */}
          <div className="absolute top-3 inset-x-3 sm:top-4 sm:inset-x-5 z-10 flex items-start justify-between gap-3 pointer-events-none">
            {/* Top-Left: Score, Distance, Coins, Best */}
            <div className="bg-[#090d18]/85 border border-white/15 rounded-2xl px-4 py-2.5 pointer-events-auto shadow-lg">
              <div className="flex items-baseline gap-4 sm:gap-5 tabular-nums">
                <div>
                  <span className="block text-[10px] font-semibold text-slate-400 tracking-wider">
                    SCORE
                  </span>
                  <span className="font-display text-xl sm:text-2xl font-extrabold text-white">
                    {telemetry.score.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-semibold text-slate-400 tracking-wider">
                    DISTANCE
                  </span>
                  <span className="font-mono-tabular text-sm sm:text-base font-bold text-slate-100">
                    {formatDistance(telemetry.distanceM)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-semibold text-slate-400 tracking-wider">
                    COINS
                  </span>
                  <span className="font-mono-tabular text-sm sm:text-base font-bold text-amber-400 flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5" />
                    {telemetry.runCoins}
                  </span>
                </div>
              </div>
              <div className="mt-1 pt-1 border-t border-white/10 text-[11px] text-slate-400 flex items-center gap-2 tabular-nums">
                <span>Best {Math.max(save.highScore, telemetry.score).toLocaleString()}</span>
                <span aria-hidden="true">·</span>
                <span>{equippedCar.name}</span>
              </div>
            </div>

            {/* Center Overtake Toast */}
            {overtakeBanner && (
              <div className="hidden sm:flex bg-[#090d18]/90 border border-amber-400/50 rounded-xl px-4 py-2 text-center shadow-lg">
                <span className="font-display text-sm font-bold text-amber-400 tracking-wide">
                  {overtakeBanner.label} +{overtakeBanner.points}
                </span>
              </div>
            )}

            {/* Top-Right: Day/Night, Mute, Pause */}
            <div className="flex items-center gap-2 pointer-events-auto">
              <button
                type="button"
                onClick={handleToggleTimeOfDay}
                className="w-11 h-11 rounded-xl bg-[#090d18]/85 border border-white/15 text-white hover:bg-[#111827] flex items-center justify-center transition-colors"
                aria-label={
                  save.timeOfDay === 'DAY'
                    ? 'Switch to Night mode'
                    : 'Switch to Day mode'
                }
                title={save.timeOfDay === 'DAY' ? 'Night Mode' : 'Day Mode'}
              >
                {save.timeOfDay === 'DAY' ? (
                  <Moon className="w-5 h-5 text-sky-300" />
                ) : (
                  <Sun className="w-5 h-5 text-amber-300" />
                )}
              </button>

              <button
                type="button"
                onClick={handleToggleMute}
                className="w-11 h-11 rounded-xl bg-[#090d18]/85 border border-white/15 text-white hover:bg-[#111827] flex items-center justify-center transition-colors"
                aria-label={save.muted ? 'Unmute audio' : 'Mute audio'}
                title="Mute (M)"
              >
                {save.muted ? (
                  <VolumeX className="w-5 h-5 text-slate-400" />
                ) : (
                  <Volume2 className="w-5 h-5 text-white" />
                )}
              </button>

              <button
                type="button"
                onClick={handleTogglePause}
                className="w-11 h-11 rounded-xl bg-[#090d18]/85 border border-white/15 text-white hover:bg-[#111827] flex items-center justify-center transition-colors"
                aria-label={mode === 'PAUSED' ? 'Resume race' : 'Pause race'}
                title="Pause (P)"
              >
                {mode === 'PAUSED' ? (
                  <Play className="w-5 h-5 fill-current" />
                ) : (
                  <Pause className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Mobile Overtake Toast (above speedometer) */}
          {overtakeBanner && (
            <div className="sm:hidden absolute bottom-24 left-1/2 -translate-x-1/2 z-10 bg-[#090d18]/90 border border-amber-400/50 rounded-xl px-3.5 py-1.5 pointer-events-none">
              <span className="font-display text-xs font-bold text-amber-400">
                {overtakeBanner.label} +{overtakeBanner.points}
              </span>
            </div>
          )}

          {/* Bottom Controls & Speedometer Bar (Android Landscape Friendly) */}
          <div className="absolute bottom-3 inset-x-3 sm:bottom-5 sm:inset-x-6 z-10 flex items-end justify-between gap-2 pointer-events-none">
            {/* Bottom-Left: Steering Arrows */}
            <div className="flex items-center gap-2.5 sm:gap-3 pointer-events-auto">
              <button
                type="button"
                {...bindHoldControl('left')}
                aria-label="Steer Left"
                className={`w-[68px] h-[64px] sm:w-20 sm:h-[68px] rounded-2xl border flex flex-col items-center justify-center transition-transform active:scale-95 touch-none ${
                  activeControls.left
                    ? 'bg-amber-500 border-amber-300 text-slate-950'
                    : 'bg-[#090d18]/85 border-white/20 text-white hover:bg-[#111827]'
                }`}
              >
                <ChevronLeft className="w-8 h-8" />
              </button>

              <button
                type="button"
                {...bindHoldControl('right')}
                aria-label="Steer Right"
                className={`w-[68px] h-[64px] sm:w-20 sm:h-[68px] rounded-2xl border flex flex-col items-center justify-center transition-transform active:scale-95 touch-none ${
                  activeControls.right
                    ? 'bg-amber-500 border-amber-300 text-slate-950'
                    : 'bg-[#090d18]/85 border-white/20 text-white hover:bg-[#111827]'
                }`}
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </div>

            {/* Bottom-Center: Speedometer */}
            <div className="hidden md:block pointer-events-none">
              <Speedometer
                speedKmh={telemetry.speedKmh}
                maxSpeedKmh={telemetry.maxSpeedKmh}
                nitroPct={telemetry.nitroPct}
                isNitroActive={telemetry.isNitroActive}
                isBraking={telemetry.isBraking}
              />
            </div>

            {/* Compact Speedometer on small landscape phones */}
            <div className="md:hidden bg-[#090d18]/85 border border-white/15 rounded-xl px-3 py-1.5 text-center pointer-events-none">
              <div className="font-display text-lg font-extrabold text-white leading-tight tabular-nums">
                {telemetry.speedKmh}{' '}
                <span className="text-[10px] font-semibold text-slate-400">KM/H</span>
              </div>
              <div className="h-1.5 w-20 rounded-full bg-white/15 overflow-hidden mt-1">
                <div
                  className={`h-full ${
                    telemetry.isNitroActive ? 'bg-cyan-400' : 'bg-sky-500'
                  }`}
                  style={{ width: `${telemetry.nitroPct}%` }}
                />
              </div>
            </div>

            {/* Bottom-Right: Brake & Nitro Pedals */}
            <div className="flex items-center gap-2.5 sm:gap-3 pointer-events-auto">
              <button
                type="button"
                {...bindHoldControl('brake')}
                aria-label="Brake"
                className={`w-[68px] h-[64px] sm:w-20 sm:h-[68px] rounded-2xl border flex flex-col items-center justify-center gap-0.5 transition-transform active:scale-95 touch-none ${
                  activeControls.brake
                    ? 'bg-red-600 border-red-300 text-white'
                    : 'bg-[#090d18]/85 border-red-500/40 text-red-400 hover:bg-[#111827]'
                }`}
              >
                <OctagonAlert className="w-5 h-5" />
                <span className="font-display text-[10px] font-bold tracking-wider">
                  BRAKE
                </span>
              </button>

              <button
                type="button"
                {...bindHoldControl('nitro')}
                aria-label="Nitro Boost"
                className={`w-[72px] h-[64px] sm:w-24 sm:h-[68px] rounded-2xl border flex flex-col items-center justify-center gap-0.5 transition-transform active:scale-95 touch-none ${
                  activeControls.nitro && telemetry.nitroPct > 1
                    ? 'bg-cyan-500 border-cyan-200 text-slate-950'
                    : 'bg-[#090d18]/85 border-cyan-400/45 text-cyan-300 hover:bg-[#111827]'
                }`}
              >
                <Flame className="w-5 h-5" />
                <span className="font-display text-[10px] font-bold tracking-wider">
                  NITRO
                </span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* START MENU OVERLAY */}
      {mode === 'START_MENU' && (
        <div className="absolute inset-0 z-20 flex flex-col justify-between p-4 sm:p-6 pointer-events-none">
          {/* Top Bar */}
          <div className="flex items-center justify-between gap-3 pointer-events-auto">
            <div className="bg-[#090d18]/85 border border-white/15 rounded-xl px-4 py-2.5 flex items-center gap-4 text-xs sm:text-sm tabular-nums">
              <div className="flex items-center gap-1.5 text-slate-200">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span className="text-slate-400">Best</span>
                <span className="font-mono-tabular font-bold text-white">
                  {save.highScore.toLocaleString()}
                </span>
              </div>
              <span className="text-white/20" aria-hidden="true">
                ·
              </span>
              <div className="flex items-center gap-1.5 text-amber-300">
                <Coins className="w-4 h-4 text-amber-400" />
                <span className="font-mono-tabular font-bold">{save.coins}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleTimeOfDay}
                className="px-3.5 py-2.5 min-h-[44px] rounded-xl bg-[#090d18]/85 border border-white/15 text-white text-xs sm:text-sm font-semibold hover:bg-[#111827] flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
              >
                {save.timeOfDay === 'DAY' ? (
                  <>
                    <Sun className="w-4 h-4 text-amber-300" />
                    <span>Day</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-sky-300" />
                    <span>Night</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleToggleMute}
                className="w-11 h-11 rounded-xl bg-[#090d18]/85 border border-white/15 text-white hover:bg-[#111827] flex items-center justify-center transition-colors"
                aria-label={save.muted ? 'Unmute sound' : 'Mute sound'}
              >
                {save.muted ? (
                  <VolumeX className="w-5 h-5 text-slate-400" />
                ) : (
                  <Volume2 className="w-5 h-5 text-white" />
                )}
              </button>
            </div>
          </div>

          {/* Title & Action Dock (keeps center 3D car visible!) */}
          <div className="w-full max-w-xl mx-auto bg-[#090d18]/88 border border-white/15 rounded-2xl p-5 sm:p-6 text-center pointer-events-auto shadow-2xl">
            <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              TRAFFIC RUSH 3D
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1.5">
              Weave through highway traffic, collect coins, and unleash Nitro boost.
            </p>

            <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleStartRace}
                className="w-full sm:w-auto min-w-[190px] py-3.5 px-7 rounded-xl bg-amber-500 text-slate-950 font-display font-extrabold text-base hover:bg-amber-400 active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
              >
                Start Race
              </button>

              <button
                type="button"
                onClick={handleOpenCarSelect}
                className="w-full sm:w-auto py-3.5 px-6 rounded-xl bg-white/10 border border-white/15 text-white font-display font-semibold text-sm sm:text-base hover:bg-white/15 transition-colors flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
              >
                <Car className="w-4 h-4 text-amber-400" />
                <span>Select Car ({equippedCar.name})</span>
              </button>
            </div>

            <p className="mt-4 text-[11px] text-slate-400 hidden sm:block">
              Controls: Arrow Left/Right or A/D to Steer · Down/S to Brake · Space/Up to Nitro
            </p>
          </div>
        </div>
      )}

      {/* CAR SELECTION GARAGE */}
      {mode === 'CAR_SELECT' && (
        <CarSelectModal
          selectedCar={previewCar}
          unlockedCarIds={save.unlockedCarIds}
          totalCoins={save.coins}
          onPreviewCar={handlePreviewCar}
          onUnlockCar={handleUnlockCar}
          onClose={handleCloseCarSelect}
          onStartRace={handleStartRace}
        />
      )}

      {/* PAUSED MODAL */}
      {mode === 'PAUSED' && (
        <div className="absolute inset-0 z-30 bg-slate-950/65 flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-[#090d18] border border-white/15 rounded-2xl p-6 text-center shadow-2xl">
            <h2 className="font-display text-2xl font-bold text-white">
              Race Paused
            </h2>
            <p className="text-xs text-slate-400 mt-1 tabular-nums">
              {telemetry.score.toLocaleString()} pts · {formatDistance(telemetry.distanceM)}
            </p>

            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleTogglePause}
                className="w-full py-3 px-5 rounded-xl bg-amber-500 text-slate-950 font-display font-bold text-sm hover:bg-amber-400 transition-colors whitespace-nowrap"
              >
                Resume Race
              </button>
              <button
                type="button"
                onClick={handleRestart}
                className="w-full py-2.5 px-5 rounded-xl bg-white/10 text-white font-semibold text-sm hover:bg-white/15 transition-colors whitespace-nowrap"
              >
                Restart
              </button>
              <button
                type="button"
                onClick={handleBackToMenu}
                className="w-full py-2.5 px-5 rounded-xl bg-transparent border border-white/15 text-slate-300 font-medium text-sm hover:bg-white/5 transition-colors whitespace-nowrap"
              >
                Main Menu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CRASH / GAME OVER MODAL */}
      {mode === 'GAME_OVER' && finalRun && (
        <div className="absolute inset-0 z-30 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#090d18]/95 border border-white/20 rounded-2xl p-6 text-center shadow-2xl">
            <p className="font-display text-xs font-bold tracking-widest text-red-400">
              {finalRun.isNewHigh ? 'CRASH · NEW HIGH SCORE!' : 'WRECKED · GAME OVER'}
            </p>

            <div className="mt-1.5 font-display text-4xl sm:text-5xl font-extrabold text-white tabular-nums">
              {finalRun.score.toLocaleString()}
            </div>

            <div className="mt-4 py-3 border-y border-white/10 grid grid-cols-3 gap-2 text-xs tabular-nums">
              <div>
                <span className="text-slate-400 block">Distance</span>
                <span className="font-mono-tabular font-bold text-sm text-white">
                  {formatDistance(finalRun.distanceM)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Coins</span>
                <span className="font-mono-tabular font-bold text-sm text-amber-400">
                  +{finalRun.coins}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Best</span>
                <span className="font-mono-tabular font-bold text-sm text-white">
                  {save.highScore.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleRestart}
                className="w-full py-3.5 px-6 rounded-xl bg-amber-500 text-slate-950 font-display font-extrabold text-base hover:bg-amber-400 active:scale-[0.98] transition-all flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Restart Race</span>
              </button>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleOpenCarSelect}
                  className="py-2.5 px-4 rounded-xl bg-white/10 text-white font-semibold text-xs sm:text-sm hover:bg-white/15 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <Car className="w-4 h-4 text-amber-400" />
                  <span>Select Car</span>
                </button>
                <button
                  type="button"
                  onClick={handleBackToMenu}
                  className="py-2.5 px-4 rounded-xl bg-white/10 text-slate-200 font-semibold text-xs sm:text-sm hover:bg-white/15 transition-colors whitespace-nowrap"
                >
                  Main Menu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
