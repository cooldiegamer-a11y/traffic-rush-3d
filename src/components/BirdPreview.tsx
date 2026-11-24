import { useEffect, useRef } from 'react';
import { BirdSkin } from '../types/game';
import { drawBird } from '../utils/birdRenderer';

interface BirdPreviewProps {
  skin: BirdSkin;
  size?: number;
  locked?: boolean;
}

export function BirdPreview({ skin, size = 56, locked = false }: BirdPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    if (locked) {
      ctx.globalAlpha = 0.42;
    }

    drawBird(ctx, {
      x: size * 0.48,
      y: size * 0.54,
      radius: size * 0.27,
      dir: 1,
      tilt: -0.06,
      wingAngle: -0.25,
      skin,
    });

    ctx.restore();
  }, [skin, size, locked]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className="shrink-0 block"
      aria-hidden="true"
    />
  );
}
