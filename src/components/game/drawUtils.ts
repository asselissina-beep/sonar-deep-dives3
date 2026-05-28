// ── Canvas-based drawing helpers matching the reference art style ──
// Colors from the reference sheet
export const COLORS = {
  bg: "#0f1d2e",
  bgLight: "#1a2d42",
  panel: "#152535",
  panelBorder: "#2a4a60",
  primary: "#4cd964",       // Water Linked green
  primaryDim: "#2a8c3a",
  primaryGlow: "rgba(76, 217, 100, 0.3)",
  accent: "#5ce570",
  warning: "#ff8844",
  warningDim: "#cc5500",
  danger: "#ff4444",
  white: "#e8f0f4",
  whiteDim: "#8899aa",
  sonar: "#4cd964",
  sonarDim: "rgba(76, 217, 100, 0.15)",
  thruster: "#3399ff",
  thrusterGlow: "rgba(51, 153, 255, 0.5)",
  manta: "#55aacc",
  shipwreck: "#cc7733",
};

// ── Submarine Drawing ──
export function drawSubmarine(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  angle: number,
  thrusting: boolean,
  time: number,
  scale: number = 1
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);

  // Thruster glow when moving
  if (thrusting) {
    const flicker = 0.7 + Math.sin(time * 30) * 0.3;
    // Main thruster
    const thrustGrad = ctx.createLinearGradient(-22, 0, -45, 0);
    thrustGrad.addColorStop(0, `rgba(51, 153, 255, ${0.9 * flicker})`);
    thrustGrad.addColorStop(0.5, `rgba(76, 217, 100, ${0.5 * flicker})`);
    thrustGrad.addColorStop(1, "rgba(76, 217, 100, 0)");
    ctx.fillStyle = thrustGrad;
    ctx.beginPath();
    ctx.moveTo(-20, -5);
    ctx.lineTo(-42 - Math.random() * 6, 0);
    ctx.lineTo(-20, 5);
    ctx.closePath();
    ctx.fill();

    // Side thrusters
    ctx.fillStyle = `rgba(51, 153, 255, ${0.4 * flicker})`;
    ctx.beginPath();
    ctx.moveTo(-16, -8);
    ctx.lineTo(-28 - Math.random() * 3, -10);
    ctx.lineTo(-16, -6);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-16, 8);
    ctx.lineTo(-28 - Math.random() * 3, 10);
    ctx.lineTo(-16, 6);
    ctx.closePath();
    ctx.fill();
  }

  // Hull shadow/glow
  ctx.shadowColor = COLORS.primary;
  ctx.shadowBlur = 12;

  // Main body - sleek diamond shape
  ctx.fillStyle = "#1a3a4a";
  ctx.strokeStyle = COLORS.primary;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(22, 0);        // nose
  ctx.lineTo(6, -10);       // top forward
  ctx.lineTo(-4, -12);      // top mid
  ctx.lineTo(-18, -8);      // top rear
  ctx.lineTo(-22, 0);       // tail
  ctx.lineTo(-18, 8);       // bottom rear
  ctx.lineTo(-4, 12);       // bottom mid
  ctx.lineTo(6, 10);        // bottom forward
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Cockpit window
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.accent;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(10, -5);
  ctx.lineTo(4, -4);
  ctx.lineTo(4, 4);
  ctx.lineTo(10, 5);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // Wing details (teal panels)
  ctx.fillStyle = COLORS.primaryDim;
  // Top wing
  ctx.beginPath();
  ctx.moveTo(-2, -10);
  ctx.lineTo(-8, -16);
  ctx.lineTo(-16, -14);
  ctx.lineTo(-14, -9);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = COLORS.primary;
  ctx.lineWidth = 1;
  ctx.stroke();
  // Bottom wing
  ctx.beginPath();
  ctx.moveTo(-2, 10);
  ctx.lineTo(-8, 16);
  ctx.lineTo(-16, 14);
  ctx.lineTo(-14, 9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Conning tower (small)
  ctx.fillStyle = "#1a3a4a";
  ctx.fillRect(-6, -14, 8, 3);
  ctx.strokeStyle = COLORS.primary;
  ctx.strokeRect(-6, -14, 8, 3);

  // Headlight beam
  ctx.shadowBlur = 0;
  const beamGrad = ctx.createLinearGradient(22, 0, 90, 0);
  beamGrad.addColorStop(0, "rgba(76, 217, 100, 0.12)");
  beamGrad.addColorStop(1, "rgba(76, 217, 100, 0)");
  ctx.fillStyle = beamGrad;
  ctx.beginPath();
  ctx.moveTo(22, 0);
  ctx.lineTo(90, -20);
  ctx.lineTo(90, 20);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

// ── Sonar Flashlight Beam (90° FOV cone) ──
export function drawSonarBeam(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  angle: number,
  maxRange: number,
  alpha: number,
  time: number,
  fovFraction: number = 1,
  fullFovDegrees: number = 90
) {
  // Min half-FOV at expansion start (narrow nose beam) → grows to fullFov/2
  const fullHalfFov = (fullFovDegrees / 2) * (Math.PI / 180);
  const minHalfFov = Math.PI / 22; // ~8°
  const halfFov = minHalfFov + (fullHalfFov - minHalfFov) * fovFraction;
  // Range also grows from 35% → 100% during expansion
  const range = maxRange * (0.35 + 0.65 * fovFraction);
  const startAngle = angle - halfFov;
  const endAngle = angle + halfFov;

  // Filled cone — radial gradient flashlight
  const grad = ctx.createRadialGradient(x, y, 0, x, y, range);
  grad.addColorStop(0, `rgba(0, 255, 221, ${alpha * 0.18})`);
  grad.addColorStop(0.6, `rgba(0, 255, 221, ${alpha * 0.08})`);
  grad.addColorStop(1, `rgba(0, 255, 221, 0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, startAngle, endAngle);
  ctx.closePath();
  ctx.fill();

  // Bright edge lines — brighter while expanding to emphasize the wave growing
  const edgeBoost = 1 + (1 - fovFraction) * 0.6;
  ctx.strokeStyle = `rgba(0, 255, 221, ${alpha * 0.4 * edgeBoost})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(startAngle) * range, y + Math.sin(startAngle) * range);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(endAngle) * range, y + Math.sin(endAngle) * range);
  ctx.stroke();

  // Leading-edge wavefront arc at current range — emphasizes "wave reaching outward"
  ctx.strokeStyle = `rgba(0, 255, 221, ${alpha * 0.35})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(x, y, range, startAngle, endAngle);
  ctx.stroke();

  // Inner range rings (only once mostly expanded)
  if (fovFraction > 0.4) {
    ctx.strokeStyle = `rgba(0, 255, 221, ${alpha * 0.08 * (fovFraction - 0.4) / 0.6})`;
    ctx.lineWidth = 0.8;
    for (let r = 1; r <= 3; r++) {
      const rr = (r / 3) * range;
      ctx.beginPath();
      ctx.arc(x, y, rr, startAngle, endAngle);
      ctx.stroke();
    }
  }

  // Subtle scan line sweeping inside the cone (only at hold)
  if (fovFraction >= 1) {
    const sweep = startAngle + ((time * 1.2) % 1) * (endAngle - startAngle);
    ctx.strokeStyle = `rgba(0, 255, 221, ${alpha * 0.4})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(sweep) * range, y + Math.sin(sweep) * range);
    ctx.stroke();
  }
}

export function drawSonarSweep(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  radius: number,
  sweepAngle: number,
  alpha: number,
  subAngle: number = 0
) {
  const halfFov = Math.PI / 4; // 90° FOV
  const fovStart = subAngle - halfFov;
  const fovEnd = subAngle + halfFov;

  ctx.save();
  ctx.translate(x, y);

  // Background circle (dim)
  ctx.strokeStyle = `rgba(0, 255, 221, ${alpha * 0.06})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  // FOV cone outline
  ctx.strokeStyle = `rgba(0, 255, 221, ${alpha * 0.2})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(fovStart) * radius, Math.sin(fovStart) * radius);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(fovEnd) * radius, Math.sin(fovEnd) * radius);
  ctx.stroke();

  // FOV arc
  ctx.strokeStyle = `rgba(0, 255, 221, ${alpha * 0.15})`;
  ctx.beginPath();
  ctx.arc(0, 0, radius, fovStart, fovEnd);
  ctx.stroke();

  // Concentric range rings within FOV
  for (let i = 1; i <= 4; i++) {
    ctx.strokeStyle = `rgba(0, 255, 221, ${alpha * 0.06})`;
    ctx.beginPath();
    ctx.arc(0, 0, (radius / 4) * i, fovStart, fovEnd);
    ctx.stroke();
  }

  // FOV filled area
  ctx.fillStyle = `rgba(0, 255, 221, ${alpha * 0.04})`;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, radius, fovStart, fovEnd);
  ctx.closePath();
  ctx.fill();

  // Sweep line within FOV
  const sweepInFov = fovStart + ((sweepAngle % (Math.PI * 2)) / (Math.PI * 2)) * (fovEnd - fovStart);
  const sweepGrad = ctx.createConicGradient(sweepInFov - 0.3, 0, 0);
  sweepGrad.addColorStop(0, "rgba(0, 255, 221, 0)");
  sweepGrad.addColorStop(0.8, `rgba(0, 255, 221, ${alpha * 0.2})`);
  sweepGrad.addColorStop(1, `rgba(0, 255, 221, ${alpha * 0.35})`);
  ctx.fillStyle = sweepGrad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, radius, sweepInFov - 0.3, sweepInFov);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = `rgba(0, 255, 221, ${alpha * 0.7})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(sweepInFov) * radius, Math.sin(sweepInFov) * radius);
  ctx.stroke();

  ctx.restore();
}

// ── Enemy: Abyssal Manta ──
export function drawManta(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  angle: number,
  time: number,
  radius: number,
  alpha: number = 1
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = alpha;

  const wingFlap = Math.sin(time * 3) * 0.15;

  // Body
  ctx.fillStyle = "#2a5566";
  ctx.strokeStyle = COLORS.manta;
  ctx.lineWidth = 1.5;

  // Left wing
  ctx.beginPath();
  ctx.moveTo(radius * 0.6, 0);
  ctx.quadraticCurveTo(radius * 0.2, -radius * (0.8 + wingFlap), -radius * 0.5, -radius * (1.2 + wingFlap));
  ctx.quadraticCurveTo(-radius * 0.8, -radius * 0.4, -radius * 0.6, 0);
  ctx.fill();
  ctx.stroke();

  // Right wing
  ctx.beginPath();
  ctx.moveTo(radius * 0.6, 0);
  ctx.quadraticCurveTo(radius * 0.2, radius * (0.8 + wingFlap), -radius * 0.5, radius * (1.2 + wingFlap));
  ctx.quadraticCurveTo(-radius * 0.8, radius * 0.4, -radius * 0.6, 0);
  ctx.fill();
  ctx.stroke();

  // Central body
  ctx.fillStyle = "#3a6677";
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 0.6, radius * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Tail
  ctx.strokeStyle = COLORS.manta;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-radius * 0.5, 0);
  ctx.quadraticCurveTo(-radius * 0.9, Math.sin(time * 2) * 5, -radius * 1.2, Math.sin(time * 2.5) * 8);
  ctx.stroke();

  // Eyes
  ctx.fillStyle = COLORS.primary;
  ctx.beginPath();
  ctx.arc(radius * 0.3, -radius * 0.15, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(radius * 0.3, radius * 0.15, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.restore();
}

// ── Enemy: Swarming targets ──
export function drawSwarmUnit(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  time: number,
  radius: number,
  alpha: number = 1
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;

  const pulse = 1 + Math.sin(time * 6) * 0.15;
  ctx.fillStyle = COLORS.warning;
  ctx.shadowColor = COLORS.warning;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(0, 0, radius * pulse, 0, Math.PI * 2);
  ctx.fill();

  // Inner
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.warningDim;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.5 * pulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.restore();
}

// ── Object: Shipwreck ──
export function drawShipwreck(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  angle: number,
  radius: number,
  alpha: number = 1
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = alpha;

  ctx.strokeStyle = COLORS.shipwreck;
  ctx.lineWidth = 2;
  ctx.fillStyle = "rgba(204, 119, 51, 0.1)";

  // Hull
  ctx.beginPath();
  ctx.moveTo(-radius, radius * 0.3);
  ctx.lineTo(-radius * 0.7, radius * 0.5);
  ctx.lineTo(radius * 0.7, radius * 0.5);
  ctx.lineTo(radius, radius * 0.3);
  ctx.lineTo(radius * 0.8, -radius * 0.1);
  ctx.lineTo(-radius * 0.8, -radius * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Mast
  ctx.beginPath();
  ctx.moveTo(-radius * 0.2, -radius * 0.2);
  ctx.lineTo(-radius * 0.15, -radius * 0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(radius * 0.3, -radius * 0.1);
  ctx.lineTo(radius * 0.25, -radius * 0.6);
  ctx.stroke();

  // Broken crossbeam
  ctx.beginPath();
  ctx.moveTo(-radius * 0.4, -radius * 0.5);
  ctx.lineTo(0, -radius * 0.55);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.restore();
}

// ── Object: Acoustic Beacon ──
export function drawBeacon(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  time: number,
  radius: number,
  alpha: number = 1
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;

  // Beacon body
  ctx.strokeStyle = COLORS.primary;
  ctx.lineWidth = 2;
  ctx.strokeRect(-radius * 0.4, -radius * 0.4, radius * 0.8, radius * 0.8);

  // Inner glow
  const pulse = 0.4 + Math.sin(time * 4) * 0.3;
  ctx.fillStyle = `rgba(76, 217, 100, ${pulse})`;
  ctx.fillRect(-radius * 0.2, -radius * 0.2, radius * 0.4, radius * 0.4);

  // Bracket corners
  ctx.strokeStyle = `rgba(76, 217, 100, 0.5)`;
  ctx.lineWidth = 1.5;
  const s = radius * 0.6;
  // TL
  ctx.beginPath(); ctx.moveTo(-s, -s + 6); ctx.lineTo(-s, -s); ctx.lineTo(-s + 6, -s); ctx.stroke();
  // TR
  ctx.beginPath(); ctx.moveTo(s, -s + 6); ctx.lineTo(s, -s); ctx.lineTo(s - 6, -s); ctx.stroke();
  // BL
  ctx.beginPath(); ctx.moveTo(-s, s - 6); ctx.lineTo(-s, s); ctx.lineTo(-s + 6, s); ctx.stroke();
  // BR
  ctx.beginPath(); ctx.moveTo(s, s - 6); ctx.lineTo(s, s); ctx.lineTo(s - 6, s); ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.restore();
}

// ── Object: Seafloor Geometry ──
export function drawSeafloorGeometry(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  radius: number,
  alpha: number = 1
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;

  ctx.fillStyle = "rgba(42, 74, 90, 0.5)";
  ctx.strokeStyle = COLORS.primaryDim;
  ctx.lineWidth = 1.5;

  // Pyramid/crystal shape
  ctx.beginPath();
  ctx.moveTo(0, -radius);
  ctx.lineTo(radius * 0.8, radius * 0.5);
  ctx.lineTo(-radius * 0.8, radius * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Inner face lines
  ctx.strokeStyle = `rgba(0, 122, 106, 0.5)`;
  ctx.beginPath();
  ctx.moveTo(0, -radius);
  ctx.lineTo(0, radius * 0.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -radius);
  ctx.lineTo(radius * 0.4, radius * 0.2);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.restore();
}

// ── Mine (improved) ──
export function drawMine(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  time: number,
  radius: number,
  alpha: number = 1
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;

  const pulse = 1 + Math.sin(time * 4) * 0.08;

  ctx.fillStyle = "#441111";
  ctx.strokeStyle = COLORS.danger;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = COLORS.danger;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(0, 0, radius * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Spikes
  ctx.strokeStyle = COLORS.warning;
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + time * 0.5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * radius * pulse, Math.sin(a) * radius * pulse);
    ctx.lineTo(Math.cos(a) * (radius + 7) * pulse, Math.sin(a) * (radius + 7) * pulse);
    ctx.stroke();
  }

  // Center warning dot
  ctx.fillStyle = COLORS.warning;
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.restore();
}

// ── Torpedo ──
export function drawTorpedo(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  angle: number,
  time: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Trail
  const trailGrad = ctx.createLinearGradient(0, 0, -25, 0);
  trailGrad.addColorStop(0, "rgba(76, 217, 100, 0.5)");
  trailGrad.addColorStop(1, "rgba(76, 217, 100, 0)");
  ctx.strokeStyle = trailGrad;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-25, Math.sin(time * 20) * 2);
  ctx.stroke();

  // Body
  ctx.shadowColor = COLORS.primary;
  ctx.shadowBlur = 10;
  ctx.fillStyle = COLORS.primary;
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-4, -3);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-4, 3);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.restore();
}

// ── HUD Panel ──
export function drawHUDPanel(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  label?: string
) {
  ctx.fillStyle = "rgba(13, 27, 42, 0.85)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = COLORS.panelBorder;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);

  // Corner accents
  const cs = 6;
  ctx.strokeStyle = COLORS.primary;
  ctx.lineWidth = 1.5;
  // TL
  ctx.beginPath(); ctx.moveTo(x, y + cs); ctx.lineTo(x, y); ctx.lineTo(x + cs, y); ctx.stroke();
  // TR
  ctx.beginPath(); ctx.moveTo(x + w - cs, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cs); ctx.stroke();
  // BL
  ctx.beginPath(); ctx.moveTo(x, y + h - cs); ctx.lineTo(x, y + h); ctx.lineTo(x + cs, y + h); ctx.stroke();
  // BR
  ctx.beginPath(); ctx.moveTo(x + w - cs, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - cs); ctx.stroke();

  if (label) {
    ctx.font = '11px "Share Tech Mono", monospace';
    ctx.fillStyle = COLORS.whiteDim;
    ctx.fillText(label, x + 8, y + 14);
  }
}

// ── Battery Meter ──
export function drawBatteryMeter(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number,
  fraction: number,
  label: string
) {
  ctx.font = '11px "Share Tech Mono", monospace';
  ctx.fillStyle = COLORS.whiteDim;
  ctx.fillText(label, x, y - 4);

  const barW = w;
  const barH = 10;
  ctx.fillStyle = "rgba(13, 27, 42, 0.8)";
  ctx.fillRect(x, y, barW, barH);
  ctx.strokeStyle = COLORS.panelBorder;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, barW, barH);

  // Filled segments
  const segments = 15;
  const segW = (barW - 4) / segments;
  const filledSegs = Math.round(fraction * segments);
  const color = fraction > 0.5 ? COLORS.primary : fraction > 0.25 ? COLORS.warning : COLORS.danger;
  for (let i = 0; i < filledSegs; i++) {
    ctx.fillStyle = color;
    ctx.fillRect(x + 2 + i * segW, y + 2, segW - 1, barH - 4);
  }

  // Percentage text
  ctx.fillStyle = COLORS.white;
  ctx.fillText(`${Math.round(fraction * 100)}%`, x + barW + 6, y + 9);
}

// ── Acoustic Signature Graph ──
export function drawAcousticGraph(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  w: number, h: number,
  time: number,
  intensity: number // 0-1
) {
  drawHUDPanel(ctx, x, y, w, h, "ACOUSTIC SIGNATURE");

  const graphY = y + 20;
  const graphH = h - 28;
  const graphW = w - 16;
  const gx = x + 8;

  // Waveform
  ctx.strokeStyle = COLORS.primary;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < graphW; i++) {
    const t = (i / graphW) * 8 + time * 2;
    const amp = graphH * 0.3 * intensity *
      (Math.sin(t * 1.5) + Math.sin(t * 3.7) * 0.5 + Math.sin(t * 7.1) * 0.2);
    const py = graphY + graphH / 2 + amp;
    if (i === 0) ctx.moveTo(gx + i, py);
    else ctx.lineTo(gx + i, py);
  }
  ctx.stroke();

  // Baseline
  ctx.strokeStyle = `rgba(76, 217, 100, 0.2)`;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(gx, graphY + graphH / 2);
  ctx.lineTo(gx + graphW, graphY + graphH / 2);
  ctx.stroke();
}

// ── Particles (bubbles, debris) ──
export function drawBubble(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  radius: number,
  alpha: number
) {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = COLORS.sonar;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
  // Highlight
  ctx.fillStyle = COLORS.sonar;
  ctx.beginPath();
  ctx.arc(x - radius * 0.3, y - radius * 0.3, radius * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}
