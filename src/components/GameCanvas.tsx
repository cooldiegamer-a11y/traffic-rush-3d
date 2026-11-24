import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { soundEngine } from '../audio/soundEngine';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BASE_SPEED_X,
  BIRD_RADIUS,
  FLAP_IMPULSE,
  GRAVITY,
  MAX_FALL_SPEED,
  MAX_SPEED_X,
  SIDE_SPIKE_BASE,
  SIDE_SPIKE_HEIGHT,
  SIDE_SPIKE_SLOTS,
  SPEED_X_INCREMENT,
  TOP_BOTTOM_SPIKE_HEIGHT,
  TOP_BOTTOM_SPIKE_WIDTH,
  WALL_THICKNESS,
  getPaletteForScore,
} from '../data/gameConfig';
import { BirdSkin, GameState } from '../types/game';
import { drawBird } from '../utils/birdRenderer';
import { Point, circleIntersectsTriangle } from '../utils/collision';

export interface GameCanvasHandle {
  flap: () => void;
  resetForNewRun: (startImmediately?: boolean) => void;
}

interface GameCanvasProps {
  gameState: GameState;
  skin: BirdSkin;
  onRequestStart: () => void;
  onScoreChange: (score: number) => void;
  onSeedCollect: () => void;
  onGameOver: (finalScore: number, seedsCollected: number) => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  gravity: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

interface TrailDot {
  x: number;
  y: number;
  alpha: number;
  size: number;
}

interface SeedItem {
  x: number;
  y: number;
  phase: number;
}

const SLOT_PITCH = 46;
const FIRST_SLOT_Y = 66;

function generateSpikePattern(score: number): number[] {
  let count = 2;
  if (score >= 35) count = 7;
  else if (score >= 23) count = 6;
  else if (score >= 14) count = 5;
  else if (score >= 7) count = 4;
  else if (score >= 3) count = 3;

  // Pick a guaranteed 2-slot contiguous safe corridor so the player always has room
  const safeGapStart = Math.floor(Math.random() * (SIDE_SPIKE_SLOTS - 1));
  const forbidden = new Set([safeGapStart, safeGapStart + 1]);

  const candidates: number[] = [];
  for (let i = 0; i < SIDE_SPIKE_SLOTS; i++) {
    if (!forbidden.has(i)) candidates.push(i);
  }

  // Fisher-Yates shuffle
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  return candidates.slice(0, Math.min(count, candidates.length)).sort((a, b) => a - b);
}

function createSeed(): SeedItem {
  return {
    x: 135 + Math.random() * (ARENA_WIDTH - 270),
    y: 120 + Math.random() * (ARENA_HEIGHT - 240),
    phase: Math.random() * Math.PI * 2,
  };
}

export const GameCanvas = forwardRef<GameCanvasHandle, GameCanvasProps>(
  function GameCanvas(
    { gameState, skin, onRequestStart, onScoreChange, onSeedCollect, onGameOver },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const gameStateRef = useRef<GameState>(gameState);
    const skinRef = useRef<BirdSkin>(skin);
    const callbacksRef = useRef({
      onRequestStart,
      onScoreChange,
      onSeedCollect,
      onGameOver,
    });

    useEffect(() => {
      gameStateRef.current = gameState;
    }, [gameState]);

    useEffect(() => {
      skinRef.current = skin;
    }, [skin]);

    useEffect(() => {
      callbacksRef.current = {
        onRequestStart,
        onScoreChange,
        onSeedCollect,
        onGameOver,
      };
    }, [onRequestStart, onScoreChange, onSeedCollect, onGameOver]);

    const prefersReducedMotion = useRef(false);
    useEffect(() => {
      if (typeof window !== 'undefined' && window.matchMedia) {
        prefersReducedMotion.current = window.matchMedia(
          '(prefers-reduced-motion: reduce)'
        ).matches;
      }
    }, []);

    // Mutable simulation state inside ref for zero-GC 60fps loop
    const simRef = useRef({
      birdX: ARENA_WIDTH / 2,
      birdY: ARENA_HEIGHT / 2 - 20,
      vy: 0,
      dir: 1 as 1 | -1,
      speedX: BASE_SPEED_X,
      tilt: 0,
      wingAngle: -0.2,
      wingTimer: 0,
      scaleX: 1,
      scaleY: 1,
      blinkTimer: 2.2,
      isBlinking: false,
      dead: false,
      deadSpin: 0,
      score: 0,
      seedsEarned: 0,
      leftSpikes: [] as number[],
      rightSpikes: [] as number[],
      leftExt: 0,
      rightExt: 0,
      leftTargetExt: 0,
      rightTargetExt: 0,
      seed: null as SeedItem | null,
      bouncesSinceSeed: 0,
      particles: [] as Particle[],
      floatingTexts: [] as FloatingText[],
      trail: [] as TrailDot[],
      trailTimer: 0,
      shakeTime: 0,
      idlePhase: 0,
      wallFlashLeft: 0,
      wallFlashRight: 0,
    });

    const spawnParticles = useCallback(
      (
        x: number,
        y: number,
        count: number,
        color: string,
        speedMin: number,
        speedMax: number,
        gravity = 320,
        sizeBase = 4
      ) => {
        const s = simRef.current;
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = speedMin + Math.random() * (speedMax - speedMin);
          const maxLife = 0.32 + Math.random() * 0.35;
          s.particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: sizeBase * (0.65 + Math.random() * 0.7),
            color,
            alpha: 1,
            life: maxLife,
            maxLife,
            gravity,
          });
        }
      },
      []
    );

    const resetSimulation = useCallback((startImmediately = false) => {
      const s = simRef.current;
      s.birdX = ARENA_WIDTH / 2;
      s.birdY = ARENA_HEIGHT / 2 - 20;
      s.vy = startImmediately ? FLAP_IMPULSE : 0;
      s.dir = 1;
      s.speedX = BASE_SPEED_X;
      s.tilt = startImmediately ? -0.35 : 0;
      s.wingAngle = startImmediately ? 0.65 : -0.2;
      s.wingTimer = startImmediately ? 0.16 : 0;
      s.scaleX = startImmediately ? 0.88 : 1;
      s.scaleY = startImmediately ? 1.14 : 1;
      s.dead = false;
      s.deadSpin = 0;
      s.score = 0;
      s.seedsEarned = 0;
      s.leftSpikes = [];
      s.rightSpikes = startImmediately ? generateSpikePattern(0) : [];
      s.leftExt = 0;
      s.rightExt = 0;
      s.leftTargetExt = 0;
      s.rightTargetExt = startImmediately ? 1 : 0;
      s.seed = startImmediately ? createSeed() : null;
      s.bouncesSinceSeed = 0;
      s.particles = [];
      s.floatingTexts = [];
      s.trail = [];
      s.trailTimer = 0;
      s.shakeTime = 0;
      s.wallFlashLeft = 0;
      s.wallFlashRight = 0;

      if (startImmediately) {
        gameStateRef.current = 'PLAYING';
        soundEngine.playFlap();
      }
      callbacksRef.current.onScoreChange(0);
    }, []);

    const performFlap = useCallback(() => {
      const state = gameStateRef.current;
      const s = simRef.current;

      if (state === 'TITLE_MENU') {
        callbacksRef.current.onRequestStart();
        resetSimulation(true);
        return;
      }

      if (state !== 'PLAYING' || s.dead) return;

      s.vy = FLAP_IMPULSE;
      s.wingTimer = 0.17;
      s.scaleX = 0.86;
      s.scaleY = 1.16;
      soundEngine.playFlap();

      // Subtle puff beneath bird
      spawnParticles(
        s.birdX - s.dir * 8,
        s.birdY + 12,
        4,
        'rgba(255,255,255,0.85)',
        30,
        85,
        80,
        3.2
      );
    }, [resetSimulation, spawnParticles]);

    useImperativeHandle(
      ref,
      () => ({
        flap: performFlap,
        resetForNewRun: resetSimulation,
      }),
      [performFlap, resetSimulation]
    );

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      let rafId = 0;
      let lastTime = performance.now();

      const updateAndRender = (now: number) => {
        const rawDt = (now - lastTime) / 1000;
        lastTime = now;
        const dt = Math.min(rawDt, 0.033);

        const state = gameStateRef.current;
        const s = simRef.current;
        const currentSkin = skinRef.current;
        const palette = getPaletteForScore(s.score);

        // Update blink timer
        s.blinkTimer -= dt;
        if (s.blinkTimer <= 0) {
          if (s.isBlinking) {
            s.isBlinking = false;
            s.blinkTimer = 2.0 + Math.random() * 2.8;
          } else {
            s.isBlinking = true;
            s.blinkTimer = 0.11;
          }
        }

        // Recover squash & stretch smoothly
        s.scaleX += (1 - s.scaleX) * Math.min(1, dt * 14);
        s.scaleY += (1 - s.scaleY) * Math.min(1, dt * 14);

        // Wall flash decay
        if (s.wallFlashLeft > 0) s.wallFlashLeft = Math.max(0, s.wallFlashLeft - dt * 3.5);
        if (s.wallFlashRight > 0) s.wallFlashRight = Math.max(0, s.wallFlashRight - dt * 3.5);
        if (s.shakeTime > 0) s.shakeTime = Math.max(0, s.shakeTime - dt);

        if (state === 'TITLE_MENU') {
          s.idlePhase += dt * 3.1;
          s.birdX = ARENA_WIDTH / 2;
          s.birdY = ARENA_HEIGHT / 2 - 22 + Math.sin(s.idlePhase) * 8;
          s.tilt = Math.sin(s.idlePhase) * 0.06;
          s.wingAngle = Math.sin(s.idlePhase * 2.6) * 0.35 - 0.1;
        } else if (state === 'PLAYING') {
          // Smoothly interpolate wall spike extensions
          const extRate = dt * 9.5;
          s.leftExt += (s.leftTargetExt - s.leftExt) * Math.min(1, extRate);
          s.rightExt += (s.rightTargetExt - s.rightExt) * Math.min(1, extRate);

          if (!s.dead) {
            // Physics integration
            s.vy = Math.min(MAX_FALL_SPEED, s.vy + GRAVITY * dt);
            s.birdX += s.dir * s.speedX * dt;
            s.birdY += s.vy * dt;

            // Tilt based on vertical velocity
            const targetTilt = Math.max(-0.48, Math.min(0.62, s.vy / 650));
            s.tilt += (targetTilt - s.tilt) * Math.min(1, dt * 12);

            // Wing animation
            if (s.wingTimer > 0) {
              s.wingTimer -= dt;
              s.wingAngle = Math.sin((s.wingTimer / 0.17) * Math.PI) * 0.85;
            } else {
              s.wingAngle += (-0.22 - s.wingAngle) * Math.min(1, dt * 10);
            }

            // Trail dots
            s.trailTimer += dt;
            if (s.trailTimer >= 0.036) {
              s.trailTimer = 0;
              s.trail.push({
                x: s.birdX - s.dir * 10,
                y: s.birdY,
                alpha: 0.32,
                size: 5.5,
              });
            }

            // Seed collection check
            if (s.seed) {
              s.seed.phase += dt * 4.2;
              const dx = s.birdX - s.seed.x;
              const dy = s.birdY - s.seed.y;
              const pickupR = BIRD_RADIUS + 15;
              if (dx * dx + dy * dy <= pickupR * pickupR) {
                s.seedsEarned += 1;
                soundEngine.playSeed();
                spawnParticles(s.seed.x, s.seed.y, 12, '#F59E0B', 70, 210, 120, 4.2);
                s.floatingTexts.push({
                  x: s.seed.x,
                  y: s.seed.y - 10,
                  text: '+1 Seed',
                  color: '#D97706',
                  life: 0.75,
                  maxLife: 0.75,
                });
                s.seed = null;
                s.bouncesSinceSeed = 0;
                callbacksRef.current.onSeedCollect();
              }
            }

            // Collision hitbox radius (slightly forgiving for crisp arcade feel)
            const hitR = BIRD_RADIUS * 0.84;
            let hitSpike = false;

            // 1. Top ceiling spikes
            const topEdgeY = WALL_THICKNESS;
            if (s.birdY - hitR <= topEdgeY + TOP_BOTTOM_SPIKE_HEIGHT) {
              const count = Math.floor(
                (ARENA_WIDTH - WALL_THICKNESS * 2) / TOP_BOTTOM_SPIKE_WIDTH
              );
              const startX =
                WALL_THICKNESS +
                (ARENA_WIDTH - WALL_THICKNESS * 2 - count * TOP_BOTTOM_SPIKE_WIDTH) / 2;
              for (let i = 0; i < count; i++) {
                const sx = startX + i * TOP_BOTTOM_SPIKE_WIDTH;
                const a: Point = { x: sx, y: topEdgeY };
                const b: Point = { x: sx + TOP_BOTTOM_SPIKE_WIDTH, y: topEdgeY };
                const c: Point = {
                  x: sx + TOP_BOTTOM_SPIKE_WIDTH / 2,
                  y: topEdgeY + TOP_BOTTOM_SPIKE_HEIGHT,
                };
                if (circleIntersectsTriangle(s.birdX, s.birdY, hitR, a, b, c)) {
                  hitSpike = true;
                  break;
                }
              }
              if (s.birdY - hitR <= topEdgeY) {
                hitSpike = true;
              }
            }

            // 2. Bottom floor spikes
            const bottomEdgeY = ARENA_HEIGHT - WALL_THICKNESS;
            if (!hitSpike && s.birdY + hitR >= bottomEdgeY - TOP_BOTTOM_SPIKE_HEIGHT) {
              const count = Math.floor(
                (ARENA_WIDTH - WALL_THICKNESS * 2) / TOP_BOTTOM_SPIKE_WIDTH
              );
              const startX =
                WALL_THICKNESS +
                (ARENA_WIDTH - WALL_THICKNESS * 2 - count * TOP_BOTTOM_SPIKE_WIDTH) / 2;
              for (let i = 0; i < count; i++) {
                const sx = startX + i * TOP_BOTTOM_SPIKE_WIDTH;
                const a: Point = { x: sx, y: bottomEdgeY };
                const b: Point = { x: sx + TOP_BOTTOM_SPIKE_WIDTH, y: bottomEdgeY };
                const c: Point = {
                  x: sx + TOP_BOTTOM_SPIKE_WIDTH / 2,
                  y: bottomEdgeY - TOP_BOTTOM_SPIKE_HEIGHT,
                };
                if (circleIntersectsTriangle(s.birdX, s.birdY, hitR, a, b, c)) {
                  hitSpike = true;
                  break;
                }
              }
              if (s.birdY + hitR >= bottomEdgeY) {
                hitSpike = true;
              }
            }

            // 3. Left wall spikes
            if (!hitSpike && s.leftExt > 0.35 && s.birdX - hitR <= WALL_THICKNESS + SIDE_SPIKE_HEIGHT) {
              const spikeDepth = SIDE_SPIKE_HEIGHT * s.leftExt;
              for (const slot of s.leftSpikes) {
                const sy = FIRST_SLOT_Y + slot * SLOT_PITCH;
                const a: Point = { x: WALL_THICKNESS, y: sy };
                const b: Point = { x: WALL_THICKNESS, y: sy + SIDE_SPIKE_BASE };
                const c: Point = {
                  x: WALL_THICKNESS + spikeDepth,
                  y: sy + SIDE_SPIKE_BASE / 2,
                };
                if (circleIntersectsTriangle(s.birdX, s.birdY, hitR, a, b, c)) {
                  hitSpike = true;
                  break;
                }
              }
            }

            // 4. Right wall spikes
            if (
              !hitSpike &&
              s.rightExt > 0.35 &&
              s.birdX + hitR >= ARENA_WIDTH - WALL_THICKNESS - SIDE_SPIKE_HEIGHT
            ) {
              const spikeDepth = SIDE_SPIKE_HEIGHT * s.rightExt;
              const wallX = ARENA_WIDTH - WALL_THICKNESS;
              for (const slot of s.rightSpikes) {
                const sy = FIRST_SLOT_Y + slot * SLOT_PITCH;
                const a: Point = { x: wallX, y: sy };
                const b: Point = { x: wallX, y: sy + SIDE_SPIKE_BASE };
                const c: Point = {
                  x: wallX - spikeDepth,
                  y: sy + SIDE_SPIKE_BASE / 2,
                };
                if (circleIntersectsTriangle(s.birdX, s.birdY, hitR, a, b, c)) {
                  hitSpike = true;
                  break;
                }
              }
            }

            if (hitSpike) {
              s.dead = true;
              s.vy = -290;
              s.deadSpin = s.dir * 8.5;
              s.shakeTime = prefersReducedMotion.current ? 0 : 0.24;
              soundEngine.playCrash();
              spawnParticles(
                s.birdX,
                s.birdY,
                18,
                currentSkin.bodyColor,
                90,
                320,
                420,
                5.2
              );
              spawnParticles(
                s.birdX,
                s.birdY,
                10,
                currentSkin.bellyColor,
                70,
                240,
                360,
                4
              );
              callbacksRef.current.onGameOver(s.score, s.seedsEarned);
            } else {
              // Check clean wall bounce
              if (s.dir === 1 && s.birdX + BIRD_RADIUS >= ARENA_WIDTH - WALL_THICKNESS) {
                s.birdX = ARENA_WIDTH - WALL_THICKNESS - BIRD_RADIUS;
                s.dir = -1;
                s.score += 1;
                s.speedX = Math.min(MAX_SPEED_X, BASE_SPEED_X + s.score * SPEED_X_INCREMENT);
                s.scaleX = 0.72;
                s.scaleY = 1.28;
                s.wallFlashRight = 1;

                s.rightTargetExt = 0;
                s.leftSpikes = generateSpikePattern(s.score);
                s.leftTargetExt = 1;

                s.bouncesSinceSeed += 1;
                if (!s.seed && s.bouncesSinceSeed >= 1) {
                  s.seed = createSeed();
                }

                soundEngine.playBounce(s.score);
                spawnParticles(
                  ARENA_WIDTH - WALL_THICKNESS,
                  s.birdY,
                  8,
                  palette.accent,
                  60,
                  180,
                  220,
                  3.5
                );
                callbacksRef.current.onScoreChange(s.score);
              } else if (s.dir === -1 && s.birdX - BIRD_RADIUS <= WALL_THICKNESS) {
                s.birdX = WALL_THICKNESS + BIRD_RADIUS;
                s.dir = 1;
                s.score += 1;
                s.speedX = Math.min(MAX_SPEED_X, BASE_SPEED_X + s.score * SPEED_X_INCREMENT);
                s.scaleX = 0.72;
                s.scaleY = 1.28;
                s.wallFlashLeft = 1;

                s.leftTargetExt = 0;
                s.rightSpikes = generateSpikePattern(s.score);
                s.rightTargetExt = 1;

                s.bouncesSinceSeed += 1;
                if (!s.seed && s.bouncesSinceSeed >= 1) {
                  s.seed = createSeed();
                }

                soundEngine.playBounce(s.score);
                spawnParticles(
                  WALL_THICKNESS,
                  s.birdY,
                  8,
                  palette.accent,
                  60,
                  180,
                  220,
                  3.5
                );
                callbacksRef.current.onScoreChange(s.score);
              }
            }
          }
        }

        // Continue tumbling bird & particles during GAME_OVER
        if ((state === 'GAME_OVER' || s.dead) && s.birdY < ARENA_HEIGHT + 60) {
          if (state === 'GAME_OVER' || s.dead) {
            s.vy = Math.min(MAX_FALL_SPEED * 1.2, s.vy + GRAVITY * dt);
            s.birdX -= s.dir * 95 * dt;
            s.birdX = Math.max(
              WALL_THICKNESS + BIRD_RADIUS,
              Math.min(ARENA_WIDTH - WALL_THICKNESS - BIRD_RADIUS, s.birdX)
            );
            s.birdY += s.vy * dt;
            s.tilt += s.deadSpin * dt;
          }
        }

        // Update particles
        for (let i = s.particles.length - 1; i >= 0; i--) {
          const p = s.particles[i];
          p.life -= dt;
          if (p.life <= 0) {
            s.particles.splice(i, 1);
            continue;
          }
          p.vy += p.gravity * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.alpha = p.life / p.maxLife;
        }

        // Update floating texts
        for (let i = s.floatingTexts.length - 1; i >= 0; i--) {
          const ft = s.floatingTexts[i];
          ft.life -= dt;
          if (ft.life <= 0) {
            s.floatingTexts.splice(i, 1);
            continue;
          }
          ft.y -= 36 * dt;
        }

        // Update trail dots
        for (let i = s.trail.length - 1; i >= 0; i--) {
          const tr = s.trail[i];
          tr.alpha -= dt * 1.1;
          tr.size = Math.max(1, tr.size - dt * 5);
          if (tr.alpha <= 0) {
            s.trail.splice(i, 1);
          }
        }

        // --- RENDERING ---
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const targetW = ARENA_WIDTH * dpr;
        const targetH = ARENA_HEIGHT * dpr;
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW;
          canvas.height = targetH;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.save();
        ctx.scale(dpr, dpr);

        // Apply crash screen shake
        if (s.shakeTime > 0) {
          const mag = (s.shakeTime / 0.24) * 7;
          ctx.translate((Math.random() - 0.5) * mag * 2, (Math.random() - 0.5) * mag * 2);
        }

        // 1. Arena Background
        ctx.fillStyle = palette.bg;
        ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

        // Subtle architectural grid lines
        ctx.strokeStyle = palette.gridLine;
        ctx.lineWidth = 1;
        const gridStep = 44;
        ctx.beginPath();
        for (let gx = WALL_THICKNESS + gridStep; gx < ARENA_WIDTH - WALL_THICKNESS; gx += gridStep) {
          ctx.moveTo(gx, WALL_THICKNESS);
          ctx.lineTo(gx, ARENA_HEIGHT - WALL_THICKNESS);
        }
        for (let gy = WALL_THICKNESS + gridStep; gy < ARENA_HEIGHT - WALL_THICKNESS; gy += gridStep) {
          ctx.moveTo(WALL_THICKNESS, gy);
          ctx.lineTo(ARENA_WIDTH - WALL_THICKNESS, gy);
        }
        ctx.stroke();

        // 2. Center Score Medallion (crisp, solid, high contrast)
        const centerX = ARENA_WIDTH / 2;
        const centerY = ARENA_HEIGHT / 2;
        ctx.fillStyle = palette.scoreCircle;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 74, 0, Math.PI * 2);
        ctx.fill();

        if (state === 'PLAYING' || state === 'PAUSED' || state === 'GAME_OVER') {
          ctx.fillStyle = palette.scoreText;
          ctx.font = '800 56px Outfit, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const scoreLabel = s.score < 10 ? `0${s.score}` : `${s.score}`;
          ctx.fillText(scoreLabel, centerX, centerY + 2);
        }

        // 3. Trail dots behind bird
        for (const tr of s.trail) {
          ctx.fillStyle = palette.isDark
            ? `rgba(255, 255, 255, ${tr.alpha})`
            : `rgba(100, 116, 139, ${tr.alpha})`;
          ctx.beginPath();
          ctx.arc(tr.x, tr.y, tr.size, 0, Math.PI * 2);
          ctx.fill();
        }

        // 4. Collectible Golden Seed
        if (s.seed && (state === 'PLAYING' || state === 'PAUSED')) {
          const bobY = s.seed.y + Math.sin(s.seed.phase) * 5;
          const pulse = 1 + Math.sin(s.seed.phase * 1.4) * 0.08;

          // Outer soft halo
          ctx.fillStyle = 'rgba(245, 158, 11, 0.18)';
          ctx.beginPath();
          ctx.arc(s.seed.x, bobY, 19 * pulse, 0, Math.PI * 2);
          ctx.fill();

          // Crisp diamond/seed shape
          ctx.save();
          ctx.translate(s.seed.x, bobY);
          ctx.scale(pulse, pulse);
          ctx.fillStyle = '#F59E0B';
          ctx.beginPath();
          ctx.moveTo(0, -12);
          ctx.quadraticCurveTo(10, -2, 0, 12);
          ctx.quadraticCurveTo(-10, -2, 0, -12);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#FEF3C7';
          ctx.beginPath();
          ctx.ellipse(-2, -3, 2.2, 4.2, -0.25, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // 5. Wall Spikes (Left & Right)
        if (s.leftExt > 0.02) {
          const depth = SIDE_SPIKE_HEIGHT * s.leftExt;
          ctx.fillStyle = palette.spike;
          for (const slot of s.leftSpikes) {
            const sy = FIRST_SLOT_Y + slot * SLOT_PITCH;
            ctx.beginPath();
            ctx.moveTo(WALL_THICKNESS - 1, sy);
            ctx.lineTo(WALL_THICKNESS + depth, sy + SIDE_SPIKE_BASE / 2);
            ctx.lineTo(WALL_THICKNESS - 1, sy + SIDE_SPIKE_BASE);
            ctx.closePath();
            ctx.fill();
          }
        }

        if (s.rightExt > 0.02) {
          const depth = SIDE_SPIKE_HEIGHT * s.rightExt;
          const wallX = ARENA_WIDTH - WALL_THICKNESS;
          ctx.fillStyle = palette.spike;
          for (const slot of s.rightSpikes) {
            const sy = FIRST_SLOT_Y + slot * SLOT_PITCH;
            ctx.beginPath();
            ctx.moveTo(wallX + 1, sy);
            ctx.lineTo(wallX - depth, sy + SIDE_SPIKE_BASE / 2);
            ctx.lineTo(wallX + 1, sy + SIDE_SPIKE_BASE);
            ctx.closePath();
            ctx.fill();
          }
        }

        // 6. Ceiling & Floor Spikes
        const tbCount = Math.floor(
          (ARENA_WIDTH - WALL_THICKNESS * 2) / TOP_BOTTOM_SPIKE_WIDTH
        );
        const tbStartX =
          WALL_THICKNESS +
          (ARENA_WIDTH - WALL_THICKNESS * 2 - tbCount * TOP_BOTTOM_SPIKE_WIDTH) / 2;

        ctx.fillStyle = palette.spike;
        // Top row
        for (let i = 0; i < tbCount; i++) {
          const sx = tbStartX + i * TOP_BOTTOM_SPIKE_WIDTH;
          ctx.beginPath();
          ctx.moveTo(sx, WALL_THICKNESS - 1);
          ctx.lineTo(sx + TOP_BOTTOM_SPIKE_WIDTH / 2, WALL_THICKNESS + TOP_BOTTOM_SPIKE_HEIGHT);
          ctx.lineTo(sx + TOP_BOTTOM_SPIKE_WIDTH, WALL_THICKNESS - 1);
          ctx.closePath();
          ctx.fill();
        }
        // Bottom row
        const bottomY = ARENA_HEIGHT - WALL_THICKNESS;
        for (let i = 0; i < tbCount; i++) {
          const sx = tbStartX + i * TOP_BOTTOM_SPIKE_WIDTH;
          ctx.beginPath();
          ctx.moveTo(sx, bottomY + 1);
          ctx.lineTo(sx + TOP_BOTTOM_SPIKE_WIDTH / 2, bottomY - TOP_BOTTOM_SPIKE_HEIGHT);
          ctx.lineTo(sx + TOP_BOTTOM_SPIKE_WIDTH, bottomY + 1);
          ctx.closePath();
          ctx.fill();
        }

        // 7. Perimeter Walls (drawn over spike bases for razor-sharp seams)
        ctx.fillStyle = palette.wall;
        ctx.fillRect(0, 0, ARENA_WIDTH, WALL_THICKNESS); // Top
        ctx.fillRect(0, ARENA_HEIGHT - WALL_THICKNESS, ARENA_WIDTH, WALL_THICKNESS); // Bottom
        ctx.fillRect(0, 0, WALL_THICKNESS, ARENA_HEIGHT); // Left
        ctx.fillRect(ARENA_WIDTH - WALL_THICKNESS, 0, WALL_THICKNESS, ARENA_HEIGHT); // Right

        // Wall impact flash highlights
        if (s.wallFlashLeft > 0) {
          ctx.fillStyle = `rgba(255, 255, 255, ${s.wallFlashLeft * 0.45})`;
          ctx.fillRect(0, 0, WALL_THICKNESS, ARENA_HEIGHT);
        }
        if (s.wallFlashRight > 0) {
          ctx.fillStyle = `rgba(255, 255, 255, ${s.wallFlashRight * 0.45})`;
          ctx.fillRect(ARENA_WIDTH - WALL_THICKNESS, 0, WALL_THICKNESS, ARENA_HEIGHT);
        }

        // 8. The Bird
        if (s.birdY < ARENA_HEIGHT + 50) {
          drawBird(ctx, {
            x: s.birdX,
            y: s.birdY,
            radius: BIRD_RADIUS,
            dir: s.dir,
            tilt: s.tilt,
            wingAngle: s.wingAngle,
            scaleX: s.scaleX,
            scaleY: s.scaleY,
            isDead: s.dead,
            isBlinking: s.isBlinking,
            skin: currentSkin,
          });
        }

        // 9. Particles
        for (const p of s.particles) {
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // 10. Floating Texts
        for (const ft of s.floatingTexts) {
          const alpha = Math.min(1, (ft.life / ft.maxLife) * 1.4);
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = ft.color;
          ctx.font = '700 14px Plus Jakarta Sans, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(ft.text, ft.x, ft.y);
          ctx.restore();
        }

        ctx.restore();

        rafId = window.requestAnimationFrame(updateAndRender);
      };

      rafId = window.requestAnimationFrame(updateAndRender);
      return () => window.cancelAnimationFrame(rafId);
    }, [spawnParticles]);

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      performFlap();
    };

    return (
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        className="w-full h-full block touch-manipulation select-none cursor-pointer"
        aria-label="Spike Bounce game arena. Tap, click, or press Space to flap."
      />
    );
  }
);
