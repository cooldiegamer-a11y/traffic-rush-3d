import * as THREE from 'three';

export function createRoadTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const width = 512;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Base dark asphalt
  ctx.fillStyle = '#262b34';
  ctx.fillRect(0, 0, width, height);

  // Subtle asphalt aggregate noise
  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const v = 30 + Math.floor(Math.random() * 26);
    ctx.fillStyle = `rgb(${v}, ${v + 2}, ${v + 6})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Subtle tire wear tracks along the 4 lanes
  const laneCentersPx = [
    width * 0.15,
    width * 0.383,
    width * 0.617,
    width * 0.85,
  ];
  for (const cx of laneCentersPx) {
    const grad = ctx.createLinearGradient(cx - 28, 0, cx + 28, 0);
    grad.addColorStop(0, 'rgba(15, 18, 24, 0)');
    grad.addColorStop(0.5, 'rgba(12, 15, 22, 0.28)');
    grad.addColorStop(1, 'rgba(15, 18, 24, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - 28, 0, 56, height);
  }

  // Solid outer shoulder lines (amber/yellow left & white right, or crisp white edges)
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(10, 0, 7, height);
  ctx.fillRect(width - 17, 0, 7, height);

  // Inner dashed lane dividers (3 dividers separating 4 lanes)
  const dividerPositions = [width * 0.266, width * 0.5, width * 0.734];
  ctx.fillStyle = '#f1f5f9';
  const dashLen = 68;
  const gapLen = 60;
  for (const dx of dividerPositions) {
    const isCenterDivider = Math.abs(dx - width * 0.5) < 2;
    ctx.fillStyle = isCenterDivider ? '#fbbf24' : '#e2e8f0';
    for (let y = 0; y < height; y += dashLen + gapLen) {
      ctx.fillRect(dx - 3, y, 6, dashLen);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 14);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

export function createGrassTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#2d5a36';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 3500; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const g = 75 + Math.floor(Math.random() * 45);
    ctx.fillStyle = `rgb(${Math.floor(g * 0.45)}, ${g}, ${Math.floor(g * 0.5)})`;
    ctx.fillRect(x, y, 2, 4);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(18, 36);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.12,
    size / 2,
    size / 2,
    size * 0.5
  );
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.35)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createBuildingFacadeTexture(
  maxAnisotropy: number,
  isNight: boolean
): THREE.CanvasTexture {
  const width = 256;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = isNight ? '#111827' : '#64748b';
  ctx.fillRect(0, 0, width, height);

  const cols = 6;
  const rows = 14;
  const padX = 10;
  const padY = 12;
  const cellW = (width - padX * 2) / cols;
  const cellH = (height - padY * 2) / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = padX + c * cellW + 4;
      const wy = padY + r * cellH + 5;
      const ww = cellW - 8;
      const wh = cellH - 10;

      if (isNight) {
        const lit = Math.random() > 0.42;
        if (lit) {
          ctx.fillStyle = Math.random() > 0.3 ? '#fde68a' : '#93c5fd';
        } else {
          ctx.fillStyle = '#1e293b';
        }
      } else {
        ctx.fillStyle = Math.random() > 0.2 ? '#cbd5e1' : '#94a3b8';
      }
      ctx.fillRect(wx, wy, ww, wh);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}
