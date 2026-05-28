import {
  COLORS,
  drawSubmarine,
  drawSonarBeam,
  drawSonarSweep,
  drawManta,
  drawSwarmUnit,
  drawShipwreck,
  drawBeacon,
  drawSeafloorGeometry,
  drawMine,
  drawTorpedo,
  drawHUDPanel,
  drawBatteryMeter,
  drawAcousticGraph,
  drawBubble,
} from "@/components/game/drawUtils";
import {
  drawCaustics,
  drawLightShafts,
  drawBioluminescentMotes,
  drawDepthVignette,
  drawDeepSeaDust,
  drawFogLayer,
  applyScreenShake,
  drawExplosionRing,
} from "@/components/game/ambientVFX";
import { getScoreboard } from "./scoreboard";
import type { GameState } from "./state";
import type { TouchInput } from "./types";
import { getVisibility } from "./visibility";

export function render(ctx: CanvasRenderingContext2D, gs: GameState, w: number, h: number, isMobile: boolean) {
  ctx.save();

  // Screen shake
  applyScreenShake(ctx, gs.screenShake, gs.time);

  // Background
  const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.75);
  grad.addColorStop(0, "#0d1b2a"); grad.addColorStop(0.6, "#091420"); grad.addColorStop(1, "#030a12");
  ctx.fillStyle = grad;
  ctx.fillRect(-10, -10, w + 20, h + 20);

  // Light shafts from surface
  drawLightShafts(ctx, w, h, gs.time);

  // Caustic ripples
  drawCaustics(ctx, w, h, gs.time);

  // Fog layer
  drawFogLayer(ctx, w, h, gs.time);

  // Deep sea dust
  drawDeepSeaDust(ctx, w, h, gs.time);

  // Ambient plankton
  ctx.globalAlpha = 0.12;
  for (let i = 0; i < 50; i++) {
    const px = ((i * 137.5 + gs.time * 6) % w);
    const py = ((i * 97.3 + gs.time * 2 + Math.sin(gs.time * 0.7 + i) * 25) % h);
    ctx.fillStyle = i % 3 === 0 ? COLORS.primary : COLORS.accent;
    ctx.beginPath(); ctx.arc(px, py, 0.8 + Math.sin(i * 2.3) * 0.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Bioluminescent motes
  drawBioluminescentMotes(ctx, w, h, gs.time);

  // Depth scanlines
  ctx.globalAlpha = 0.03; ctx.strokeStyle = COLORS.primary; ctx.lineWidth = 0.5;
  for (let y = 0; y < h; y += 40) {
    const offset = (gs.time * 5) % 40;
    ctx.beginPath(); ctx.moveTo(0, y + offset); ctx.lineTo(w, y + offset); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Sonar beam (flashlight cone from sub position — grows during expand phase)
  if (gs.sonarBeam) drawSonarBeam(ctx, gs.sub.pos.x, gs.sub.pos.y, gs.sub.angle, gs.settings.sonar_max_radius, gs.sonarBeam.alpha, gs.time, gs.sonarBeam.fovFraction, gs.settings.sonar_fov_degrees);

  // Obstacles
  for (const o of gs.obstacles) {
    const vis = getVisibility(o.pos, gs.sub.pos, gs.sonarBeam, gs.sub.angle, gs.settings);
    switch (o.kind) {
      case "manta": drawManta(ctx, o.pos.x, o.pos.y, o.angle, gs.time, o.radius, vis); break;
      case "swarm": drawSwarmUnit(ctx, o.pos.x, o.pos.y, gs.time, o.radius, vis); break;
      case "mine": drawMine(ctx, o.pos.x, o.pos.y, gs.time, o.radius, vis); break;
      case "shipwreck": drawShipwreck(ctx, o.pos.x, o.pos.y, o.angle, o.radius, vis); break;
      case "beacon": drawBeacon(ctx, o.pos.x, o.pos.y, gs.time, o.radius, vis); break;
      case "seafloor": drawSeafloorGeometry(ctx, o.pos.x, o.pos.y, o.radius, vis); break;
    }
  }

  // Torpedoes
  for (const t of gs.torpedoes) {
    drawTorpedo(ctx, t.pos.x, t.pos.y, Math.atan2(t.vel.y, t.vel.x), gs.time);
  }

  // Particles
  for (const p of gs.particles) {
    const a = p.life / p.maxLife;
    if (p.kind === "bubble") { drawBubble(ctx, p.pos.x, p.pos.y, p.radius * a, a * 0.6); }
    else { ctx.globalAlpha = a; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.pos.x, p.pos.y, p.radius * a, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
  }

  // Explosion rings
  for (const e of gs.explosions) {
    drawExplosionRing(ctx, e.x, e.y, e.radius, e.alpha);
  }

  // Submarine (flash when invincible)
  if (gs.respawnTimer <= 0 || Math.floor(gs.time * 10) % 2 === 0) {
    drawSubmarine(ctx, gs.sub.pos.x, gs.sub.pos.y, gs.sub.angle, gs.thrusting, gs.time);
  }

  // ── HUD (responsive) ────────────────────────────────────────────
  const { sub } = gs;
  const hudFont = '"Share Tech Mono", monospace';
  const fontSize = isMobile ? 10 : 12;
  const smFontSize = isMobile ? 9 : 11;
  const panelPad = isMobile ? 6 : 10;

  // Top-left: Compact status
  const tlW = isMobile ? 150 : 200;
  const tlH = isMobile ? 60 : 82;
  drawHUDPanel(ctx, panelPad, panelPad, tlW, tlH, "STATUS");

  ctx.font = `${smFontSize}px ${hudFont}`;
  const hpFrac = sub.hp / sub.maxHp;
  const hpColor = hpFrac > 0.5 ? COLORS.primary : hpFrac > 0.25 ? COLORS.warning : COLORS.danger;
  const barX = panelPad + 8;
  const barW = tlW - 16;

  // Hull bar
  ctx.fillStyle = COLORS.whiteDim;
  ctx.fillText(`HULL ${sub.hp}/${sub.maxHp}`, barX, panelPad + 22);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(barX, panelPad + 26, barW, 6);
  ctx.fillStyle = hpColor;
  ctx.fillRect(barX, panelPad + 26, barW * hpFrac, 6);

  // Battery bar
  if (!isMobile) {
    drawBatteryMeter(ctx, barX, panelPad + 56, barW - 40, sub.battery / sub.maxBattery, "BATTERY");
  } else {
    ctx.fillStyle = COLORS.whiteDim;
    ctx.fillText(`BAT ${Math.round(sub.battery)}%`, barX, panelPad + 44);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(barX + 60, panelPad + 37, barW - 68, 6);
    ctx.fillStyle = sub.battery > 30 ? COLORS.primary : COLORS.warning;
    ctx.fillRect(barX + 60, panelPad + 37, (barW - 68) * (sub.battery / sub.maxBattery), 6);
  }

  // Lives display
  ctx.font = `${smFontSize}px ${hudFont}`;
  ctx.fillStyle = COLORS.whiteDim;
  const livesY = isMobile ? panelPad + 52 : panelPad + 72;
  ctx.fillText("LIVES", barX, livesY);
  for (let i = 0; i < 3; i++) {
    if (i < gs.lives) {
      ctx.fillStyle = COLORS.primary;
      ctx.shadowColor = COLORS.primary;
      ctx.shadowBlur = 4;
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.shadowBlur = 0;
    }
    ctx.beginPath();
    ctx.arc(barX + 42 + i * 18, livesY - 3, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  if (isMobile) {
    ctx.font = `${fontSize}px ${hudFont}`;
    ctx.fillStyle = COLORS.primary;
    ctx.fillText(`${gs.score}`, panelPad + 8, panelPad + tlH + 16);
    ctx.fillStyle = COLORS.accent;
    ctx.fillText(`${gs.depth}m`, panelPad + 60, panelPad + tlH + 16);
    ctx.fillStyle = COLORS.whiteDim;
    ctx.fillText(`W${gs.wave}`, panelPad + 120, panelPad + tlH + 16);
  } else {
    drawHUDPanel(ctx, panelPad, panelPad + tlH + 6, tlW, 55, "MISSION DATA");
    ctx.font = `${fontSize}px ${hudFont}`;
    ctx.fillStyle = COLORS.primary;
    ctx.fillText(`SCORE: ${gs.score}`, panelPad + 8, panelPad + tlH + 32);
    ctx.fillStyle = COLORS.accent;
    ctx.fillText(`DEPTH: ${gs.depth}m`, panelPad + 8, panelPad + tlH + 47);
    ctx.fillStyle = COLORS.whiteDim;
    ctx.fillText(`WAVE ${gs.wave}`, panelPad + tlW - 55, panelPad + tlH + 32);
  }

  // Top-right: Weapons (smaller on mobile)
  if (!isMobile) {
    const wrX = w - 220;
    drawHUDPanel(ctx, wrX, panelPad, 210, 55, "WEAPONS");
    ctx.font = `${fontSize}px ${hudFont}`;
    const sonarReady = sub.sonarCooldown <= 0;
    const sonarOn = !!gs.sonarBeam;
    ctx.fillStyle = sonarOn ? COLORS.accent : sonarReady ? COLORS.primary : COLORS.whiteDim;
    ctx.fillText(`SONAR ${gs.settings.sonar_fov_degrees}° [SPACE] ${sonarOn ? "◉ ACTIVE" : sonarReady ? "▶ READY" : sub.sonarCooldown.toFixed(1) + "s"}`, wrX + 8, panelPad + 28);
    const torpReady = sub.torpedoCooldown <= 0;
    ctx.fillStyle = torpReady ? COLORS.primary : COLORS.whiteDim;
    ctx.fillText(`TORPEDO  [F]  ${torpReady ? "▶ READY" : "·  ·  ·"}`, wrX + 8, panelPad + 43);
  }

  // Mini sonar sweep (bottom-right, directional 90° FOV)
  if (!isMobile) {
    const sweepR = 50;
    const sweepX = w - sweepR - 20;
    const sweepY = h - sweepR - 20;
    drawSonarSweep(ctx, sweepX, sweepY, sweepR, gs.sonarSweepAngle, 0.6, sub.angle);
    const halfFov = (gs.settings.sonar_fov_degrees / 2) * (Math.PI / 180);
    for (const o of gs.obstacles) {
      const dx = o.pos.x - sub.pos.x; const dy = o.pos.y - sub.pos.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 400) {
        // Only show blips within the 90° FOV
        let da = Math.atan2(dy, dx) - sub.angle;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        if (Math.abs(da) > halfFov) continue;
        const isHostile = o.kind === "mine" || o.kind === "manta" || o.kind === "swarm";
        ctx.fillStyle = isHostile ? COLORS.warning : COLORS.primary;
        ctx.globalAlpha = 0.8;
        ctx.beginPath(); ctx.arc(sweepX + (dx / 400) * sweepR, sweepY + (dy / 400) * sweepR, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    ctx.fillStyle = COLORS.white;
    ctx.beginPath(); ctx.arc(sweepX, sweepY, 2, 0, Math.PI * 2); ctx.fill();
  }

  // Acoustic graph (desktop only)
  if (!isMobile) {
    drawAcousticGraph(ctx, 10, h - 75, 220, 65, gs.time, gs.acousticIntensity);
  }

  // Lore text
  if (gs.loreAlpha > 0 && !isMobile) {
    ctx.globalAlpha = gs.loreAlpha * 0.75;
    ctx.font = `12px ${hudFont}`;
    ctx.fillStyle = COLORS.accent;
    const tw = ctx.measureText(gs.loreText).width;
    ctx.fillText(gs.loreText, w / 2 - tw / 2, h - 85);
    ctx.globalAlpha = 1;
  }

  // Game Over
  if (gs.gameOver) {
    ctx.fillStyle = "rgba(3, 10, 18, 0.88)";
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.05;
    for (let y = 0; y < h; y += 3) { ctx.fillStyle = COLORS.primary; ctx.fillRect(0, y, w, 1); }
    ctx.globalAlpha = 1;

    const centerX = w / 2;
    let cy = isMobile ? h * 0.18 : h * 0.2;

    const goFontSize = isMobile ? 28 : 48;
    ctx.font = `bold ${goFontSize}px "Orbitron", ${hudFont}`;
    ctx.fillStyle = COLORS.danger;
    ctx.shadowColor = COLORS.danger; ctx.shadowBlur = 25;
    const goText = "HULL BREACH";
    ctx.fillText(goText, centerX - ctx.measureText(goText).width / 2, cy);
    ctx.shadowBlur = 0;

    cy += isMobile ? 22 : 30;
    ctx.font = `bold ${isMobile ? 12 : 16}px "Orbitron", ${hudFont}`;
    ctx.fillStyle = COLORS.warning;
    const subText = "ALL DRONES LOST";
    ctx.fillText(subText, centerX - ctx.measureText(subText).width / 2, cy);

    cy += isMobile ? 22 : 30;
    ctx.font = `${isMobile ? 11 : 14}px ${hudFont}`;
    ctx.fillStyle = COLORS.primary;
    const scoreText = `SCORE: ${gs.score}  ──  DEPTH: ${gs.depth}m  ──  WAVE: ${gs.wave}`;
    ctx.fillText(scoreText, centerX - ctx.measureText(scoreText).width / 2, cy);

    // Scoreboard
    cy += isMobile ? 24 : 35;
    const scores = getScoreboard();
    const boardW = isMobile ? 260 : 360;
    const boardH = Math.min(scores.length, 10) * (isMobile ? 18 : 22) + 36;
    const boardX = centerX - boardW / 2;
    drawHUDPanel(ctx, boardX, cy, boardW, boardH, "TOP SCORES");

    ctx.font = `${isMobile ? 10 : 12}px ${hudFont}`;
    const entryH = isMobile ? 18 : 22;
    for (let i = 0; i < Math.min(scores.length, 10); i++) {
      const entry = scores[i];
      const ey = cy + 24 + i * entryH;
      const isCurrentScore = entry.score === gs.score && entry.wave === gs.wave && entry.isNew;

      ctx.fillStyle = isCurrentScore ? COLORS.warning : COLORS.whiteDim;
      const rank = `${(i + 1).toString().padStart(2, " ")}.`;
      ctx.fillText(rank, boardX + 8, ey);

      // Player name
      ctx.fillStyle = isCurrentScore ? COLORS.warning : COLORS.accent;
      const displayName = (entry.name || "PILOT").slice(0, 10);
      ctx.fillText(displayName, boardX + 32, ey);

      ctx.fillStyle = isCurrentScore ? COLORS.warning : COLORS.white;
      ctx.fillText(`${entry.score}`, boardX + (isMobile ? 110 : 140), ey);
      ctx.fillStyle = isCurrentScore ? COLORS.warning : COLORS.primaryDim;
      ctx.fillText(`${entry.depth}m`, boardX + (isMobile ? 160 : 200), ey);
      ctx.fillText(`W${entry.wave}`, boardX + (isMobile ? 205 : 255), ey);
      if (isCurrentScore) {
        ctx.fillStyle = COLORS.warning;
        ctx.fillText("← NEW", boardX + (isMobile ? 230 : 295), ey);
      }
    }
    if (scores.length === 0) {
      ctx.fillStyle = COLORS.whiteDim;
      ctx.fillText("No scores yet", boardX + 8, cy + 28);
    }

    cy += boardH + (isMobile ? 14 : 20);
    ctx.fillStyle = COLORS.accent;
    ctx.font = `${isMobile ? 12 : 14}px ${hudFont}`;
    const restartText = isMobile ? "TAP TO RESURFACE" : "[ R ] RESURFACE";
    ctx.fillText(restartText, centerX - ctx.measureText(restartText).width / 2, cy);
  }

  // Depth vignette (after all game elements, before restore)
  drawDepthVignette(ctx, w, h, gs.depth);

  ctx.restore();
}

// ── Touch Controls Overlay ─────────────────────────────────────────
export function drawTouchControls(ctx: CanvasRenderingContext2D, touch: TouchInput, w: number, h: number) {
  const hudFont = '"Share Tech Mono", monospace';

  // Joystick — dynamic position (follows where user touches)
  const joyR = 55;
  let joyX: number, joyY: number;

  if (touch.joystick.active) {
    joyX = touch.joystick.startX;
    joyY = touch.joystick.startY;
  } else {
    joyX = 85;
    joyY = h - 105;
  }

  // Outer ring
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = COLORS.primary;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(joyX, joyY, joyR, 0, Math.PI * 2);
  ctx.stroke();

  // Inner guide ring
  ctx.globalAlpha = 0.1;
  ctx.beginPath();
  ctx.arc(joyX, joyY, joyR * 0.45, 0, Math.PI * 2);
  ctx.stroke();

  // Cross lines
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.12;
  ctx.beginPath(); ctx.moveTo(joyX - joyR, joyY); ctx.lineTo(joyX + joyR, joyY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(joyX, joyY - joyR); ctx.lineTo(joyX, joyY + joyR); ctx.stroke();

  // Direction arrows
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = COLORS.primary;
  ctx.font = `16px ${hudFont}`;
  ctx.fillText("▲", joyX - 5, joyY - joyR + 16);
  ctx.fillText("▼", joyX - 5, joyY + joyR - 4);
  ctx.fillText("◀", joyX - joyR + 4, joyY + 5);
  ctx.fillText("▶", joyX + joyR - 14, joyY + 5);

  if (touch.joystick.active) {
    const dx = touch.joystick.currentX - touch.joystick.startX;
    const dy = touch.joystick.currentY - touch.joystick.startY;
    const mag = Math.sqrt(dx * dx + dy * dy);
    const clampedMag = Math.min(mag, joyR);
    const angle = Math.atan2(dy, dx);
    const knobX = joyX + Math.cos(angle) * clampedMag;
    const knobY = joyY + Math.sin(angle) * clampedMag;
    const isThrusting = mag > 25;

    // Direction line
    ctx.strokeStyle = COLORS.primary;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.25;
    ctx.beginPath(); ctx.moveTo(joyX, joyY); ctx.lineTo(knobX, knobY); ctx.stroke();

    // Knob
    ctx.globalAlpha = isThrusting ? 0.6 : 0.35;
    ctx.fillStyle = COLORS.primary;
    ctx.shadowColor = COLORS.primary;
    ctx.shadowBlur = isThrusting ? 15 : 5;
    ctx.beginPath(); ctx.arc(knobX, knobY, 20, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // Thrust indicator ring
    if (isThrusting) {
      ctx.strokeStyle = COLORS.primary;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.4;
      ctx.beginPath(); ctx.arc(knobX, knobY, 24, 0, Math.PI * 2); ctx.stroke();
    }
  } else {
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = COLORS.primary;
    ctx.beginPath(); ctx.arc(joyX, joyY, 14, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Right-side buttons — larger touch targets
  const btnSize = 38;
  const btnGap = 16;
  const btnBaseX = w - 65;
  const btnBaseY = h - 85;

  // Fire button (bottom)
  const fireActive = touch.fire;
  ctx.globalAlpha = fireActive ? 0.7 : 0.25;
  ctx.fillStyle = fireActive ? COLORS.primary : "transparent";
  ctx.strokeStyle = COLORS.primary;
  ctx.lineWidth = 2;
  ctx.shadowColor = fireActive ? COLORS.primary : "transparent";
  ctx.shadowBlur = fireActive ? 15 : 0;
  ctx.beginPath(); ctx.arc(btnBaseX, btnBaseY, btnSize, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = fireActive ? 1 : 0.45;
  ctx.font = `bold 13px ${hudFont}`;
  ctx.fillStyle = fireActive ? COLORS.bg : COLORS.primary;
  ctx.fillText("TRP", btnBaseX - 12, btnBaseY + 5);

  // Sonar button (above fire)
  const sonarActive = touch.sonar;
  const sonarY = btnBaseY - btnSize * 2 - btnGap;
  ctx.globalAlpha = sonarActive ? 0.7 : 0.25;
  ctx.fillStyle = sonarActive ? COLORS.accent : "transparent";
  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 2;
  ctx.shadowColor = sonarActive ? COLORS.accent : "transparent";
  ctx.shadowBlur = sonarActive ? 15 : 0;
  ctx.beginPath(); ctx.arc(btnBaseX, sonarY, btnSize, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = sonarActive ? 1 : 0.45;
  ctx.fillStyle = sonarActive ? COLORS.bg : COLORS.accent;
  ctx.fillText("SNR", btnBaseX - 12, sonarY + 5);

  // Sonar ripple decoration
  if (!sonarActive) {
    ctx.globalAlpha = 0.1;
    ctx.strokeStyle = COLORS.accent;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(btnBaseX, sonarY, btnSize + 8, 0, Math.PI * 2); ctx.stroke();
  }

  ctx.globalAlpha = 1;
}