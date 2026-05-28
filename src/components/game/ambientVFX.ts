// ── Ambient visual effects for atmosphere ──
import { COLORS } from "./drawUtils";

// ── Caustic light ripples (underwater light patterns) ──
export function drawCaustics(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  time: number
) {
  ctx.save();
  ctx.globalAlpha = 0.035;
  ctx.globalCompositeOperation = "lighter";

  for (let i = 0; i < 8; i++) {
    const cx = (w * 0.15) + (i * w * 0.1) + Math.sin(time * 0.4 + i * 1.7) * 60;
    const cy = (h * 0.1) + Math.cos(time * 0.3 + i * 2.1) * 40;
    const r = 80 + Math.sin(time * 0.5 + i) * 30;

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, "rgba(76, 217, 100, 0.5)");
    grad.addColorStop(0.4, "rgba(60, 180, 80, 0.2)");
    grad.addColorStop(1, "rgba(40, 120, 60, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ── Volumetric light shafts from surface ──
export function drawLightShafts(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  time: number
) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (let i = 0; i < 5; i++) {
    const baseX = w * (0.1 + i * 0.2) + Math.sin(time * 0.15 + i * 3.5) * 50;
    const sway = Math.sin(time * 0.2 + i * 1.3) * 30;
    const alpha = 0.015 + Math.sin(time * 0.3 + i * 2) * 0.008;
    const shaftW = 40 + Math.sin(time * 0.4 + i) * 15;

    const grad = ctx.createLinearGradient(baseX, 0, baseX + sway, h * 0.7);
    grad.addColorStop(0, `rgba(76, 217, 100, ${alpha * 2})`);
    grad.addColorStop(0.3, `rgba(60, 180, 80, ${alpha})`);
    grad.addColorStop(1, "rgba(40, 120, 60, 0)");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(baseX - shaftW / 2, 0);
    ctx.lineTo(baseX + sway - shaftW * 1.5, h * 0.7);
    ctx.lineTo(baseX + sway + shaftW * 1.5, h * 0.7);
    ctx.lineTo(baseX + shaftW / 2, 0);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

// ── Floating bioluminescent motes ──
const MOTE_COUNT = 30;
interface Mote {
  x: number; y: number; size: number;
  speedX: number; speedY: number;
  phase: number; hue: number;
}
let motes: Mote[] | null = null;

function initMotes(w: number, h: number) {
  motes = [];
  for (let i = 0; i < MOTE_COUNT; i++) {
    motes.push({
      x: Math.random() * w,
      y: Math.random() * h,
      size: 1.5 + Math.random() * 3,
      speedX: (Math.random() - 0.5) * 8,
      speedY: (Math.random() - 0.5) * 6,
      phase: Math.random() * Math.PI * 2,
      hue: 120 + Math.random() * 30, // green range (Water Linked brand)
    });
  }
}

export function drawBioluminescentMotes(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  time: number
) {
  if (!motes) initMotes(w, h);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (const m of motes!) {
    // Gentle drift
    const x = ((m.x + m.speedX * time) % (w + 40)) - 20;
    const y = ((m.y + m.speedY * time + Math.sin(time * 0.5 + m.phase) * 20) % (h + 40)) - 20;
    const pulse = 0.3 + Math.sin(time * 2 + m.phase) * 0.3;
    const size = m.size * (0.8 + Math.sin(time * 1.5 + m.phase) * 0.2);

    // Outer glow
    const grad = ctx.createRadialGradient(x, y, 0, x, y, size * 6);
    grad.addColorStop(0, `hsla(${m.hue}, 90%, 65%, ${pulse * 0.15})`);
    grad.addColorStop(0.5, `hsla(${m.hue}, 80%, 50%, ${pulse * 0.05})`);
    grad.addColorStop(1, `hsla(${m.hue}, 70%, 40%, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, size * 6, 0, Math.PI * 2);
    ctx.fill();

    // Core
    ctx.fillStyle = `hsla(${m.hue}, 100%, 80%, ${pulse * 0.8})`;
    ctx.beginPath();
    ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ── Depth vignette (darker edges as you go deeper) ──
export function drawDepthVignette(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  depth: number
) {
  const intensity = Math.min(0.6, 0.2 + depth * 0.001);
  const grad = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.8);
  grad.addColorStop(0, "rgba(0, 0, 0, 0)");
  grad.addColorStop(0.7, `rgba(0, 0, 0, ${intensity * 0.3})`);
  grad.addColorStop(1, `rgba(0, 0, 0, ${intensity})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

// ── Floating debris / dust motes ──
export function drawDeepSeaDust(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  time: number
) {
  ctx.save();
  ctx.globalAlpha = 0.06;
  for (let i = 0; i < 25; i++) {
    const x = ((i * 211.7 + time * 3) % (w + 20)) - 10;
    const y = ((i * 173.3 + time * 1.5 + Math.sin(time * 0.8 + i * 0.9) * 15) % (h + 20)) - 10;
    const sz = 0.5 + (i % 5) * 0.3;

    ctx.fillStyle = i % 4 === 0 ? COLORS.accent : COLORS.whiteDim;
    ctx.beginPath();
    ctx.arc(x, y, sz, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ── Screen shake helper ──
export function applyScreenShake(
  ctx: CanvasRenderingContext2D,
  intensity: number,
  time: number
): { dx: number; dy: number } {
  if (intensity <= 0) return { dx: 0, dy: 0 };
  const dx = Math.sin(time * 37) * intensity;
  const dy = Math.cos(time * 43) * intensity;
  ctx.translate(dx, dy);
  return { dx, dy };
}

// ── Explosion ring effect ──
export function drawExplosionRing(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  radius: number,
  alpha: number
) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // Outer ring
  ctx.strokeStyle = `rgba(255, 136, 68, ${alpha * 0.8})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Inner flash
  const innerGrad = ctx.createRadialGradient(x, y, 0, x, y, radius * 0.6);
  innerGrad.addColorStop(0, `rgba(255, 200, 100, ${alpha * 0.4})`);
  innerGrad.addColorStop(0.5, `rgba(255, 100, 50, ${alpha * 0.15})`);
  innerGrad.addColorStop(1, "rgba(255, 50, 20, 0)");
  ctx.fillStyle = innerGrad;
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.6, 0, Math.PI * 2);
  ctx.fill();

  // Hot core
  ctx.fillStyle = `rgba(255, 255, 200, ${alpha * 0.6})`;
  ctx.beginPath();
  ctx.arc(x, y, radius * 0.1, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ── Underwater fog layer (parallax depth) ──
export function drawFogLayer(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  time: number
) {
  ctx.save();
  ctx.globalAlpha = 0.025;

  for (let i = 0; i < 3; i++) {
    const yBase = h * (0.4 + i * 0.2);
    const drift = time * (5 + i * 3);
    
    ctx.fillStyle = i === 0 ? COLORS.sonarDim : "rgba(10, 30, 50, 0.8)";
    ctx.beginPath();
    ctx.moveTo(0, yBase);
    for (let x = 0; x <= w; x += 20) {
      const y = yBase + Math.sin((x + drift) * 0.005) * 40 
                      + Math.sin((x + drift * 0.7) * 0.012) * 20;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}
