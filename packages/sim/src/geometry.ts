import type { Platform } from "./types";

export interface HitResult {
  nx: number;
  ny: number;
  penetration: number;
}

export function circleVsAabb(
  x: number,
  y: number,
  radius: number,
  box: Platform,
): HitResult | null {
  const closestX = Math.max(box.x, Math.min(x, box.x + box.w));
  const closestY = Math.max(box.y, Math.min(y, box.y + box.h));
  const dx = x - closestX;
  const dy = y - closestY;
  const distance = Math.hypot(dx, dy);
  if (distance >= radius) return null;
  if (distance > 0.000001) {
    return {
      nx: dx / distance,
      ny: dy / distance,
      penetration: radius - distance,
    };
  }

  const left = x - box.x;
  const right = box.x + box.w - x;
  const top = y - box.y;
  const bottom = box.y + box.h - y;
  const minimum = Math.min(left, right, top, bottom);
  if (minimum === left) return { nx: -1, ny: 0, penetration: minimum + radius };
  if (minimum === right) return { nx: 1, ny: 0, penetration: minimum + radius };
  if (minimum === top) return { nx: 0, ny: -1, penetration: minimum + radius };
  return { nx: 0, ny: 1, penetration: minimum + radius };
}

export function pointInPlatform(x: number, y: number, box: Platform): boolean {
  return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
}

export function touchingSide(
  platforms: Platform[],
  x: number,
  y: number,
  radius: number,
  direction: -1 | 1,
): boolean {
  const probeX = x + direction * (radius + 1);
  for (const platform of platforms) {
    if (
      pointInPlatform(probeX, y, platform) ||
      pointInPlatform(probeX, y - radius * 0.55, platform) ||
      pointInPlatform(probeX, y + radius * 0.55, platform)
    ) {
      return true;
    }
  }
  return false;
}

export function segmentBlocked(
  platforms: Platform[],
  ax: number,
  ay: number,
  bx: number,
  by: number,
): boolean {
  const steps = 20;
  for (let step = 1; step < steps; step += 1) {
    const t = step / steps;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    for (const platform of platforms) {
      if (platform.kind !== "frame" && pointInPlatform(x, y, platform)) return true;
    }
  }
  return false;
}

export interface SegmentHit {
  t: number;
  nx: number;
  ny: number;
  platform: Platform;
}

export function raycastPlatforms(
  platforms: Platform[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): SegmentHit | null {
  const dx = x1 - x0;
  const dy = y1 - y0;
  let best: SegmentHit | null = null;

  for (const platform of platforms) {
    let tMin = 0;
    let tMax = 1;
    let axis = 0;

    const clip = (origin: number, direction: number, min: number, max: number): boolean => {
      if (Math.abs(direction) < 1e-9) {
        return origin >= min && origin <= max;
      }
      const t1 = (min - origin) / direction;
      const t2 = (max - origin) / direction;
      const near = Math.min(t1, t2);
      const far = Math.max(t1, t2);
      if (near > tMin) {
        tMin = near;
        axis = Math.abs(direction) === Math.abs(dx) ? 0 : 1;
      }
      if (far < tMax) tMax = far;
      return tMin <= tMax;
    };

    if (!clip(x0, dx, platform.x, platform.x + platform.w)) continue;
    if (!clip(y0, dy, platform.y, platform.y + platform.h)) continue;
    if (tMin < 0 || tMin > 1) continue;

    const hitX = x0 + dx * tMin;
    const hitY = y0 + dy * tMin;
    const nx = axis === 0 ? (dx > 0 ? -1 : 1) : 0;
    const ny = axis === 1 ? (dy > 0 ? -1 : 1) : 0;
    if (!best || tMin < best.t) {
      best = { t: tMin, nx, ny, platform };
      void hitX;
      void hitY;
    }
  }

  return best;
}