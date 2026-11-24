import { BirdSkin } from '../types/game';

interface DrawBirdOptions {
  x: number;
  y: number;
  radius: number;
  dir: 1 | -1; // 1 = facing right, -1 = facing left
  tilt: number; // radians
  wingAngle: number; // radians
  scaleX?: number;
  scaleY?: number;
  isDead?: boolean;
  isBlinking?: boolean;
  skin: BirdSkin;
}

export function drawBird(ctx: CanvasRenderingContext2D, opts: DrawBirdOptions) {
  const {
    x,
    y,
    radius,
    dir,
    tilt,
    wingAngle,
    scaleX = 1,
    scaleY = 1,
    isDead = false,
    isBlinking = false,
    skin,
  } = opts;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir * scaleX, scaleY);
  ctx.rotate(tilt);

  // Tail feathers
  ctx.fillStyle = skin.wingColor;
  ctx.beginPath();
  ctx.moveTo(-radius * 0.78, -radius * 0.15);
  ctx.lineTo(-radius * 1.42, -radius * 0.42);
  ctx.lineTo(-radius * 1.24, 0);
  ctx.lineTo(-radius * 1.4, radius * 0.34);
  ctx.lineTo(-radius * 0.76, radius * 0.25);
  ctx.closePath();
  ctx.fill();

  // Crest / head feather per skin style
  ctx.fillStyle = skin.wingColor;
  if (skin.crestStyle === 'tuft') {
    ctx.beginPath();
    ctx.moveTo(-radius * 0.25, -radius * 0.85);
    ctx.quadraticCurveTo(-radius * 0.55, -radius * 1.38, -radius * 0.02, -radius * 1.15);
    ctx.quadraticCurveTo(radius * 0.12, -radius * 1.32, radius * 0.22, -radius * 0.88);
    ctx.closePath();
    ctx.fill();
  } else if (skin.crestStyle === 'crown') {
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.moveTo(-radius * 0.35, -radius * 0.82);
    ctx.lineTo(-radius * 0.38, -radius * 1.25);
    ctx.lineTo(-radius * 0.1, -radius * 1.02);
    ctx.lineTo(0.05 * radius, -radius * 1.32);
    ctx.lineTo(radius * 0.2, -radius * 1.02);
    ctx.lineTo(radius * 0.42, -radius * 1.2);
    ctx.lineTo(radius * 0.35, -radius * 0.82);
    ctx.closePath();
    ctx.fill();
  } else if (skin.crestStyle === 'sleek') {
    ctx.beginPath();
    ctx.moveTo(radius * 0.1, -radius * 0.9);
    ctx.lineTo(-radius * 0.78, -radius * 1.22);
    ctx.lineTo(-radius * 0.48, -radius * 0.76);
    ctx.closePath();
    ctx.fill();
  } else if (skin.crestStyle === 'plume') {
    ctx.beginPath();
    ctx.moveTo(-radius * 0.1, -radius * 0.88);
    ctx.quadraticCurveTo(-radius * 0.65, -radius * 1.45, -radius * 0.95, -radius * 1.05);
    ctx.quadraticCurveTo(-radius * 0.55, -radius * 0.95, -radius * 0.35, -radius * 0.78);
    ctx.closePath();
    ctx.fill();
  } else if (skin.crestStyle === 'mohawk') {
    ctx.fillStyle = skin.beakColor;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.45, -radius * 0.78);
    ctx.lineTo(-radius * 0.3, -radius * 1.25);
    ctx.lineTo(-radius * 0.08, -radius * 0.95);
    ctx.lineTo(radius * 0.12, -radius * 1.28);
    ctx.lineTo(radius * 0.35, -radius * 0.82);
    ctx.closePath();
    ctx.fill();
  } else if (skin.crestStyle === 'crest') {
    ctx.fillStyle = skin.beakColor;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.2, -radius * 0.88);
    ctx.quadraticCurveTo(0, -radius * 1.45, radius * 0.42, -radius * 1.15);
    ctx.quadraticCurveTo(radius * 0.25, -radius * 0.92, radius * 0.35, -radius * 0.82);
    ctx.closePath();
    ctx.fill();
  }

  // Main body (rounded plump arcade silhouette)
  ctx.fillStyle = skin.bodyColor;
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 1.04, radius * 0.95, 0, 0, Math.PI * 2);
  ctx.fill();

  // Belly patch
  ctx.fillStyle = skin.bellyColor;
  ctx.beginPath();
  ctx.ellipse(radius * 0.12, radius * 0.28, radius * 0.66, radius * 0.52, -0.1, 0, Math.PI * 2);
  ctx.fill();

  // Beak
  ctx.fillStyle = skin.beakColor;
  ctx.beginPath();
  ctx.moveTo(radius * 0.85, -radius * 0.18);
  ctx.lineTo(radius * 1.46, radius * 0.04);
  ctx.lineTo(radius * 0.85, radius * 0.28);
  ctx.closePath();
  ctx.fill();

  // Lower beak shadow line
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.22)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(radius * 0.88, radius * 0.08);
  ctx.lineTo(radius * 1.32, radius * 0.05);
  ctx.stroke();

  // Eye
  const eyeX = radius * 0.44;
  const eyeY = -radius * 0.22;
  if (isDead) {
    // Crisp 'X' eye on crash
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    const s = radius * 0.18;
    ctx.beginPath();
    ctx.moveTo(eyeX - s, eyeY - s);
    ctx.lineTo(eyeX + s, eyeY + s);
    ctx.moveTo(eyeX + s, eyeY - s);
    ctx.lineTo(eyeX - s, eyeY + s);
    ctx.stroke();
  } else if (isBlinking) {
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(eyeX - radius * 0.18, eyeY);
    ctx.lineTo(eyeX + radius * 0.18, eyeY);
    ctx.stroke();
  } else {
    // White sclera + crisp pupil + catchlight
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, radius * 0.27, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = skin.eyeColor;
    ctx.beginPath();
    ctx.arc(eyeX + radius * 0.07, eyeY, radius * 0.14, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(eyeX + radius * 0.11, eyeY - radius * 0.05, radius * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }

  // Animated wing
  ctx.save();
  ctx.translate(-radius * 0.12, radius * 0.05);
  ctx.rotate(wingAngle);
  ctx.fillStyle = skin.wingColor;
  ctx.beginPath();
  ctx.ellipse(-radius * 0.12, 0, radius * 0.56, radius * 0.34, -0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}
