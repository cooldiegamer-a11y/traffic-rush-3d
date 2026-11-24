export interface Point {
  x: number;
  y: number;
}

function distSq(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function pointToSegmentDistSq(p: Point, v: Point, w: Point): number {
  const l2 = distSq(v, w);
  if (l2 === 0) return distSq(p, v);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = v.x + t * (w.x - v.x);
  const projY = v.y + t * (w.y - v.y);
  const dx = p.x - projX;
  const dy = p.y - projY;
  return dx * dx + dy * dy;
}

function sign(p1: Point, p2: Point, p3: Point): number {
  return (p1.x - p3.x) * (p2.y - p3.y) - (p2.x - p3.x) * (p1.y - p3.y);
}

function pointInTriangle(pt: Point, v1: Point, v2: Point, v3: Point): boolean {
  const d1 = sign(pt, v1, v2);
  const d2 = sign(pt, v2, v3);
  const d3 = sign(pt, v3, v1);

  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

/**
 * Checks whether a circle centered at (cx, cy) with radius r intersects
 * the triangle defined by vertices a, b, c.
 */
export function circleIntersectsTriangle(
  cx: number,
  cy: number,
  r: number,
  a: Point,
  b: Point,
  c: Point
): boolean {
  const center = { x: cx, y: cy };
  if (pointInTriangle(center, a, b, c)) return true;

  const rSq = r * r;
  if (pointToSegmentDistSq(center, a, b) <= rSq) return true;
  if (pointToSegmentDistSq(center, b, c) <= rSq) return true;
  if (pointToSegmentDistSq(center, c, a) <= rSq) return true;

  return false;
}
