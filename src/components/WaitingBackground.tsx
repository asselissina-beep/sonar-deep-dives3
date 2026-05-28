import { useRef, useEffect } from "react";
import { COLORS } from "./game/drawUtils";
import {
  drawCaustics,
  drawLightShafts,
  drawBioluminescentMotes,
  drawDeepSeaDust,
  drawFogLayer,
} from "./game/ambientVFX";

/**
 * Full-screen canvas background for the waiting/lobby screen.
 * Water Linked branded deep-ocean atmosphere with 3D sonar multibeam visualization.
 */
export default function WaitingBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };
    resize();
    window.addEventListener("resize", resize);

    // Sonar ring state
    const sonarRings: { x: number; y: number; radius: number; maxRadius: number; alpha: number; speed: number }[] = [];
    let nextRingTime = 0;

    // 3D Multibeam sonar point cloud
    const BEAM_POINTS = 200;
    const beamPoints: { x: number; y: number; z: number; age: number; brightness: number }[] = [];
    for (let i = 0; i < BEAM_POINTS; i++) {
      beamPoints.push({
        x: (Math.random() - 0.5) * 2,
        y: (Math.random() - 0.5) * 2,
        z: Math.random(),
        age: Math.random() * 8,
        brightness: 0.3 + Math.random() * 0.7,
      });
    }

    // Floating jellyfish-like entities
    const jellyfish: { x: number; y: number; size: number; phase: number; speedY: number; tentaclePhase: number }[] = [];
    for (let i = 0; i < 4; i++) {
      jellyfish.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        size: 10 + Math.random() * 14,
        phase: Math.random() * Math.PI * 2,
        speedY: -6 - Math.random() * 10,
        tentaclePhase: Math.random() * Math.PI * 2,
      });
    }

    let animId: number;
    const startTime = performance.now();

    const loop = (now: number) => {
      const time = (now - startTime) / 1000;
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Deep navy gradient background (Water Linked brand)
      const bgGrad = ctx.createRadialGradient(w / 2, h * 0.4, 0, w / 2, h * 0.4, w * 0.9);
      bgGrad.addColorStop(0, "#142636");
      bgGrad.addColorStop(0.4, "#0f1d2e");
      bgGrad.addColorStop(0.8, "#0a1520");
      bgGrad.addColorStop(1, "#060e16");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Light shafts from surface
      drawLightShafts(ctx, w, h, time);

      // Caustic ripples
      drawCaustics(ctx, w, h, time);

      // Fog layers
      drawFogLayer(ctx, w, h, time);

      // Deep sea dust
      drawDeepSeaDust(ctx, w, h, time);

      // Bioluminescent motes
      drawBioluminescentMotes(ctx, w, h, time);

      // ── 3D Multibeam Sonar Fan Visualization ──
      // Inspired by Water Linked Sonar 3D-15: 90° horizontal, 40° vertical FOV
      ctx.save();
      const sonarCx = w * 0.5;
      const sonarCy = h * 0.35;
      const sonarRange = Math.min(w, h) * 0.28;

      // Sweep angle
      const sweepAngle = (time * 0.6) % (Math.PI * 2);

      // Draw sonar fan arc (90° FOV)
      const fanStart = -Math.PI / 2 - Math.PI / 4;
      const fanEnd = -Math.PI / 2 + Math.PI / 4;

      // Fan area glow
      ctx.globalAlpha = 0.04;
      ctx.fillStyle = COLORS.primary;
      ctx.beginPath();
      ctx.moveTo(sonarCx, sonarCy);
      ctx.arc(sonarCx, sonarCy, sonarRange, fanStart, fanEnd);
      ctx.closePath();
      ctx.fill();

      // Sweep line within fan
      const sweepInFan = fanStart + ((sweepAngle / (Math.PI * 2)) * (fanEnd - fanStart));
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = COLORS.primary;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sonarCx, sonarCy);
      ctx.lineTo(
        sonarCx + Math.cos(sweepInFan) * sonarRange,
        sonarCy + Math.sin(sweepInFan) * sonarRange
      );
      ctx.stroke();

      // Sweep trail
      for (let t = 0; t < 8; t++) {
        const trailAngle = sweepInFan - t * 0.02;
        const trailAlpha = 0.12 * (1 - t / 8);
        ctx.globalAlpha = trailAlpha;
        ctx.strokeStyle = COLORS.primary;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sonarCx, sonarCy);
        ctx.lineTo(
          sonarCx + Math.cos(trailAngle) * sonarRange,
          sonarCy + Math.sin(trailAngle) * sonarRange
        );
        ctx.stroke();
      }

      // Range rings within fan
      ctx.globalAlpha = 0.06;
      ctx.strokeStyle = COLORS.primary;
      ctx.lineWidth = 0.5;
      for (let r = 1; r <= 4; r++) {
        const rr = (r / 4) * sonarRange;
        ctx.beginPath();
        ctx.arc(sonarCx, sonarCy, rr, fanStart, fanEnd);
        ctx.stroke();
      }

      // 3D point cloud returns
      ctx.globalCompositeOperation = "lighter";
      for (const pt of beamPoints) {
        pt.age += 1 / 60;
        if (pt.age > 6) {
          pt.x = (Math.random() - 0.5) * 2;
          pt.y = (Math.random() - 0.5) * 2;
          pt.z = Math.random();
          pt.age = 0;
          pt.brightness = 0.3 + Math.random() * 0.7;
        }

        const angle = fanStart + ((pt.x + 1) / 2) * (fanEnd - fanStart);
        const dist = (0.2 + pt.z * 0.8) * sonarRange;
        const px = sonarCx + Math.cos(angle) * dist;
        const py = sonarCy + Math.sin(angle) * dist;
        const fadeIn = Math.min(1, pt.age * 3);
        const fadeOut = Math.max(0, 1 - (pt.age - 4) / 2);
        const alpha = fadeIn * fadeOut * pt.brightness * 0.6;

        if (alpha <= 0) continue;

        // Point glow
        ctx.globalAlpha = alpha * 0.3;
        const glow = ctx.createRadialGradient(px, py, 0, px, py, 8);
        glow.addColorStop(0, `rgba(76, 217, 100, 0.6)`);
        glow.addColorStop(1, `rgba(76, 217, 100, 0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, Math.PI * 2);
        ctx.fill();

        // Point core
        ctx.globalAlpha = alpha;
        ctx.fillStyle = `rgba(76, 217, 100, ${0.8 * pt.brightness})`;
        ctx.beginPath();
        ctx.arc(px, py, 1.5 + pt.z, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.restore();

      // Animated sonar rings (green brand)
      if (time > nextRingTime) {
        sonarRings.push({
          x: w / 2 + (Math.random() - 0.5) * 60,
          y: h / 2 + (Math.random() - 0.5) * 60,
          radius: 10,
          maxRadius: Math.max(w, h) * 0.6 + Math.random() * 100,
          alpha: 0.35,
          speed: 60 + Math.random() * 40,
        });
        nextRingTime = time + 3 + Math.random() * 2.5;
      }

      for (let i = sonarRings.length - 1; i >= 0; i--) {
        const ring = sonarRings[i];
        ring.radius += ring.speed * (1 / 60);
        ring.alpha = 0.35 * (1 - ring.radius / ring.maxRadius);

        if (ring.alpha <= 0 || ring.radius >= ring.maxRadius) {
          sonarRings.splice(i, 1);
          continue;
        }

        for (let r = 0; r < 3; r++) {
          const rr = ring.radius - r * 8;
          if (rr <= 0) continue;
          const a = ring.alpha * (1 - r * 0.3);
          ctx.strokeStyle = `rgba(76, 217, 100, ${a * 0.5})`;
          ctx.lineWidth = 1.5 - r * 0.4;
          ctx.beginPath();
          ctx.arc(ring.x, ring.y, rr, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.strokeStyle = `rgba(76, 217, 100, ${ring.alpha * 0.06})`;
        ctx.lineWidth = 20;
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Jellyfish
      ctx.save();
      for (const j of jellyfish) {
        const jx = j.x + Math.sin(time * 0.3 + j.phase) * 30;
        let jy = ((j.y + j.speedY * time) % (h + 100));
        if (jy < -50) jy += h + 100;

        const pulse = 0.8 + Math.sin(time * 1.5 + j.phase) * 0.2;
        const sz = j.size * pulse;

        ctx.globalAlpha = 0.06;
        const glowGrad = ctx.createRadialGradient(jx, jy, 0, jx, jy, sz * 3);
        glowGrad.addColorStop(0, "rgba(76, 217, 100, 0.25)");
        glowGrad.addColorStop(1, "rgba(76, 217, 100, 0)");
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(jx, jy, sz * 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 0.12;
        ctx.fillStyle = `rgba(76, 217, 100, 0.2)`;
        ctx.beginPath();
        ctx.ellipse(jx, jy, sz * 0.7, sz * 0.5, 0, Math.PI, 0);
        ctx.fill();

        ctx.strokeStyle = `rgba(76, 217, 100, 0.2)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(jx, jy, sz * 0.7, sz * 0.5, 0, Math.PI, 0);
        ctx.stroke();

        ctx.globalAlpha = 0.08;
        ctx.strokeStyle = `rgba(76, 217, 100, 0.15)`;
        ctx.lineWidth = 0.8;
        for (let t = 0; t < 5; t++) {
          const tx = jx - sz * 0.5 + (t / 4) * sz;
          ctx.beginPath();
          ctx.moveTo(tx, jy);
          const wave = Math.sin(time * 2 + j.tentaclePhase + t) * 4;
          ctx.quadraticCurveTo(tx + wave, jy + sz * 0.6, tx + wave * 1.5, jy + sz * 1.2);
          ctx.stroke();
        }
      }
      ctx.restore();

      // Grid overlay
      ctx.save();
      ctx.globalAlpha = 0.012;
      ctx.strokeStyle = COLORS.primary;
      ctx.lineWidth = 0.5;
      const gridSize = 80;
      const gridOffsetX = (time * 2) % gridSize;
      const gridOffsetY = (time * 1.5) % gridSize;
      for (let x = -gridSize + gridOffsetX; x < w + gridSize; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = -gridSize + gridOffsetY; y < h + gridSize; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.restore();

      // Scanlines
      ctx.save();
      ctx.globalAlpha = 0.02;
      ctx.fillStyle = COLORS.primary;
      for (let y = 0; y < h; y += 3) {
        ctx.fillRect(0, y, w, 1);
      }
      ctx.restore();

      // Vignette
      const vigGrad = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.85);
      vigGrad.addColorStop(0, "rgba(0, 0, 0, 0)");
      vigGrad.addColorStop(0.6, "rgba(0, 0, 0, 0.15)");
      vigGrad.addColorStop(1, "rgba(0, 0, 0, 0.5)");
      ctx.fillStyle = vigGrad;
      ctx.fillRect(0, 0, w, h);

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0"
      style={{ width: "100vw", height: "100dvh" }}
    />
  );
}
