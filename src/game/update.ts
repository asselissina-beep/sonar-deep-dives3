import { COLORS } from "@/components/game/drawUtils";
import { LORE_ENTRIES } from "./constants";
import { allocateObstacleId, dist, spawnObstacle, wrap, type GameState } from "./state";
import { saveScore } from "./scoreboard";
import type { TouchInput } from "./types";

export function update(gs: GameState, dt: number, keys: Set<string>, w: number, h: number, touch: TouchInput) {
  if (gs.gameOver) return;
  gs.time += dt;
  const { sub, settings: cfg } = gs;

  // Respawn invincibility countdown
  if (gs.respawnTimer > 0) {
    gs.respawnTimer -= dt;
    gs.respawnFlash = gs.time;
  }

  // Keyboard controls
  const leftKey = keys.has("arrowleft") || keys.has("a");
  const rightKey = keys.has("arrowright") || keys.has("d");
  const thrustKey = keys.has("arrowup") || keys.has("w");
  const fireKey = keys.has("f");
  const sonarKey = keys.has(" ");

  // Touch / phone-remote joystick (remote maps stick → virtual pixel offsets on TV)
  let touchRotate = 0;
  let touchThrust = false;
  if (touch.joystick.active) {
    const dx = touch.joystick.currentX - touch.joystick.startX;
    const dy = touch.joystick.currentY - touch.joystick.startY;
    const magnitude = Math.sqrt(dx * dx + dy * dy);
    if (magnitude > 10) {
      const targetAngle = Math.atan2(dy, dx);
      let diff = targetAngle - sub.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      touchRotate = Math.max(-1, Math.min(1, diff / 0.5));
      touchThrust = magnitude > 25;
    }
  }

  // Apply rotation
  if (leftKey) sub.angle -= cfg.rotation_speed * dt;
  if (rightKey) sub.angle += cfg.rotation_speed * dt;
  if (touchRotate !== 0) sub.angle += touchRotate * cfg.rotation_speed * dt;

  // Apply thrust
  gs.thrusting = thrustKey || touchThrust || touch.thrust;
  if (gs.thrusting && sub.battery > 0) {
    sub.vel.x += Math.cos(sub.angle) * cfg.thrust * dt;
    sub.vel.y += Math.sin(sub.angle) * cfg.thrust * dt;
    sub.battery = Math.max(0, sub.battery - dt * cfg.battery_drain);
    if (Math.random() < 0.4) {
      const backAngle = sub.angle + Math.PI + (Math.random() - 0.5) * 0.5;
      gs.particles.push({
        pos: { x: sub.pos.x - Math.cos(sub.angle) * 18, y: sub.pos.y - Math.sin(sub.angle) * 18 },
        vel: { x: Math.cos(backAngle) * (40 + Math.random() * 30), y: Math.sin(backAngle) * (40 + Math.random() * 30) },
        life: 0.4 + Math.random() * 0.3, maxLife: 0.7,
        color: COLORS.thruster, radius: 1.5 + Math.random() * 1.5, kind: "bubble",
      });
    }
  }
  if (!gs.thrusting) sub.battery = Math.min(sub.maxBattery, sub.battery + dt * cfg.battery_recharge);

  sub.vel.x *= cfg.friction; sub.vel.y *= cfg.friction;
  sub.pos.x += sub.vel.x * dt; sub.pos.y += sub.vel.y * dt;
  sub.pos = wrap(sub.pos, w, h);
  sub.torpedoCooldown = Math.max(0, sub.torpedoCooldown - dt);
  sub.sonarCooldown = Math.max(0, sub.sonarCooldown - dt);

  // Sonar beam — wave expansion: narrow nose beam → grows to full FOV cone → holds → fades
  if ((sonarKey || touch.sonar) && sub.sonarCooldown <= 0 && !gs.sonarBeam) {
    sub.sonarCooldown = cfg.sonar_cooldown;
    const total = cfg.sonar_duration;
    // Distribute total: ~20% expand, ~70% hold, ~10% fade (min floors)
    const expandDuration = Math.max(0.4, total * 0.2);
    const fadeDuration = Math.max(0.6, total * 0.15);
    const holdDuration = Math.max(0.5, total - expandDuration - fadeDuration);
    gs.sonarBeam = { age: 0, expandDuration, holdDuration, fadeDuration, alpha: 0, fovFraction: 0 };
    gs.acousticIntensity = Math.min(1, gs.acousticIntensity + 0.3);
  }

  gs.sonarSweepAngle += dt * 1.5;
  gs.acousticIntensity = Math.max(0.1, gs.acousticIntensity - dt * 0.05);

  if ((fireKey || touch.fire) && sub.torpedoCooldown <= 0 && sub.battery >= cfg.torpedo_battery_cost) {
    sub.torpedoCooldown = cfg.torpedo_cooldown;
    sub.battery = Math.max(0, sub.battery - cfg.torpedo_battery_cost);
    gs.torpedoes.push({
      pos: { ...sub.pos },
      vel: { x: Math.cos(sub.angle) * cfg.torpedo_speed, y: Math.sin(sub.angle) * cfg.torpedo_speed },
      life: cfg.torpedo_life,
    });
  }

  // Torpedoes update
  for (let i = gs.torpedoes.length - 1; i >= 0; i--) {
    const t = gs.torpedoes[i];
    t.pos.x += t.vel.x * dt; t.pos.y += t.vel.y * dt; t.life -= dt;
    if (t.life <= 0 || t.pos.x < -60 || t.pos.x > w + 60 || t.pos.y < -60 || t.pos.y > h + 60) {
      gs.torpedoes.splice(i, 1);
    }
  }

  // Sonar beam update — phases: expanding → hold → fade
  if (gs.sonarBeam) {
    const sb = gs.sonarBeam;
    sb.age += dt;
    const total = sb.expandDuration + sb.holdDuration + sb.fadeDuration;
    if (sb.age < sb.expandDuration) {
      // Expansion phase: narrow beam grows to full FOV, alpha ramps up
      const t = sb.age / sb.expandDuration;
      // Ease-out for smoother growth
      const eased = 1 - Math.pow(1 - t, 2);
      sb.fovFraction = eased;
      sb.alpha = 0.4 + 0.6 * eased;
    } else if (sb.age < sb.expandDuration + sb.holdDuration) {
      sb.fovFraction = 1;
      sb.alpha = 1;
    } else if (sb.age < total) {
      sb.fovFraction = 1;
      const ft = (sb.age - sb.expandDuration - sb.holdDuration) / sb.fadeDuration;
      sb.alpha = Math.max(0, 1 - ft);
    } else {
      gs.sonarBeam = null;
    }
  }

  // Spawn
  gs.spawnTimer -= dt;
  if (gs.spawnTimer <= 0) {
    gs.wave++;
    const count = Math.min(cfg.spawn_base_count + gs.wave, cfg.spawn_max_count);
    for (let i = 0; i < count; i++) gs.obstacles.push(spawnObstacle(w, h, gs.wave, cfg));
    gs.spawnTimer = Math.max(cfg.spawn_min_interval, cfg.spawn_base_interval - gs.wave * cfg.spawn_interval_reduction);
  }

  // Manta + Swarm AI — both home toward player (swarms weaker but persistent)
  for (const o of gs.obstacles) {
    if (o.kind === "manta") {
      const toSub = Math.atan2(sub.pos.y - o.pos.y, sub.pos.x - o.pos.x);
      const speed = Math.sqrt(o.vel.x * o.vel.x + o.vel.y * o.vel.y);
      o.angle = toSub;
      o.vel.x += Math.cos(toSub) * 30 * dt; o.vel.y += Math.sin(toSub) * 30 * dt;
      const curSpeed = Math.sqrt(o.vel.x * o.vel.x + o.vel.y * o.vel.y);
      if (curSpeed > speed * 1.3) { o.vel.x *= (speed * 1.3) / curSpeed; o.vel.y *= (speed * 1.3) / curSpeed; }
    } else if (o.kind === "swarm") {
      const toSub = Math.atan2(sub.pos.y - o.pos.y, sub.pos.x - o.pos.x);
      o.angle = toSub;
      o.vel.x += Math.cos(toSub) * 45 * dt;
      o.vel.y += Math.sin(toSub) * 45 * dt;
      const cap = 140;
      const curSpeed = Math.sqrt(o.vel.x * o.vel.x + o.vel.y * o.vel.y);
      if (curSpeed > cap) { o.vel.x *= cap / curSpeed; o.vel.y *= cap / curSpeed; }
    }
  }

  // Anti-camping: if the sub barely moves, spawn fast hunters near the player
  const moved = dist(sub.pos, gs.lastPos);
  gs.lastPos = { x: sub.pos.x, y: sub.pos.y };
  if (moved < 25 * dt) {
    gs.idleTimer += dt;
  } else {
    gs.idleTimer = Math.max(0, gs.idleTimer - dt * 2);
  }
  if (gs.idleTimer > 4) {
    gs.hunterTimer -= dt;
    if (gs.hunterTimer <= 0) {
      gs.hunterTimer = 2.8;
      // Spawn 1–2 hunters just off-screen on a random side, aimed at the sub
      const hunters = 1 + (Math.random() < 0.4 ? 1 : 0);
      for (let n = 0; n < hunters; n++) {
        const side = Math.floor(Math.random() * 4);
        let hx = 0, hy = 0;
        if (side === 0) { hx = Math.random() * w; hy = -30; }
        else if (side === 1) { hx = w + 30; hy = Math.random() * h; }
        else if (side === 2) { hx = Math.random() * w; hy = h + 30; }
        else { hx = -30; hy = Math.random() * h; }
        const ang = Math.atan2(sub.pos.y - hy, sub.pos.x - hx);
        const sp = cfg.enemy_base_speed * 1.6 + gs.wave * cfg.enemy_wave_speed_bonus;
        const isManta = Math.random() < 0.5;
        gs.obstacles.push({
          pos: { x: hx, y: hy },
          vel: { x: Math.cos(ang) * sp, y: Math.sin(ang) * sp },
          radius: isManta ? 24 : 7,
          hp: isManta ? cfg.manta_hp : cfg.swarm_hp,
          kind: isManta ? "manta" : "swarm",
          angle: ang,
          id: allocateObstacleId(),
        });
      }
    }
  } else {
    gs.hunterTimer = 0;
  }

  // Obstacles + collisions
  for (let i = gs.obstacles.length - 1; i >= 0; i--) {
    const o = gs.obstacles[i];
    o.pos.x += o.vel.x * dt; o.pos.y += o.vel.y * dt;
    o.pos = wrap(o.pos, w, h);
    const isHostile = o.kind === "mine" || o.kind === "manta" || o.kind === "swarm";

    for (let j = gs.torpedoes.length - 1; j >= 0; j--) {
      if (dist(gs.torpedoes[j].pos, o.pos) < o.radius + 6) {
        o.hp--;
        gs.acousticIntensity = Math.min(1, gs.acousticIntensity + 0.15);
        for (let p = 0; p < 10; p++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 50 + Math.random() * 90;
          gs.particles.push({
            pos: { ...gs.torpedoes[j].pos }, vel: { x: Math.cos(a) * sp, y: Math.sin(a) * sp },
            life: 0.5 + Math.random() * 0.5, maxLife: 1,
            color: isHostile ? COLORS.warning : COLORS.primary,
            radius: 2 + Math.random() * 3, kind: "spark",
          });
        }
        gs.torpedoes.splice(j, 1);
        if (o.hp <= 0) {
          const scoreMap: Record<string, number> = {
            mine: cfg.score_mine, manta: cfg.score_manta, swarm: cfg.score_swarm,
            shipwreck: cfg.score_shipwreck, beacon: cfg.score_beacon, seafloor: cfg.score_seafloor,
          };
          gs.score += scoreMap[o.kind] || 100;
          gs.depth += cfg.depth_gain_base + Math.floor(Math.random() * cfg.depth_gain_variance);
          gs.screenShake = Math.max(gs.screenShake, 4);
          gs.explosions.push({ x: o.pos.x, y: o.pos.y, radius: 0, maxRadius: o.radius * 3 + 30, alpha: 1 });
          gs.obstacles.splice(i, 1);
          break;
        }
      }
    }

    if (i < gs.obstacles.length && isHostile && gs.respawnTimer <= 0 && dist(sub.pos, o.pos) < cfg.sub_radius + o.radius) {
      sub.hp--;
      for (let p = 0; p < 14; p++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 30 + Math.random() * 70;
        gs.particles.push({
          pos: { ...sub.pos }, vel: { x: Math.cos(a) * sp, y: Math.sin(a) * sp },
          life: 0.6 + Math.random() * 0.5, maxLife: 1.1,
          color: COLORS.danger, radius: 2 + Math.random() * 2.5, kind: "spark",
        });
      }
      gs.obstacles.splice(i, 1);
      gs.screenShake = Math.max(gs.screenShake, 8);
      gs.explosions.push({ x: sub.pos.x, y: sub.pos.y, radius: 0, maxRadius: 60, alpha: 1 });
      if (sub.hp <= 0) {
        gs.lives--;
        if (gs.lives <= 0) {
          gs.gameOver = true;
          saveScore(gs.score, gs.depth, gs.wave, gs.playerName);
        } else {
          // Respawn: reset HP, brief invincibility, clear nearby obstacles
          sub.hp = sub.maxHp;
          sub.pos = { x: w / 2, y: h / 2 };
          sub.vel = { x: 0, y: 0 };
          sub.battery = sub.maxBattery;
          gs.respawnTimer = cfg.respawn_invincibility;
          // Clear nearby obstacles on respawn
          for (let k = gs.obstacles.length - 1; k >= 0; k--) {
            if (dist(gs.obstacles[k].pos, sub.pos) < 150) {
              gs.obstacles.splice(k, 1);
            }
          }
        }
      }
    }
  }

  // Particles
  for (let i = gs.particles.length - 1; i >= 0; i--) {
    const p = gs.particles[i];
    p.pos.x += p.vel.x * dt; p.pos.y += p.vel.y * dt;
    p.vel.x *= 0.98; p.vel.y *= 0.98;
    p.life -= dt;
    if (p.life <= 0) gs.particles.splice(i, 1);
  }

  // Screen shake decay
  gs.screenShake *= Math.pow(0.05, dt); // fast decay
  if (gs.screenShake < 0.1) gs.screenShake = 0;

  // Explosions
  for (let i = gs.explosions.length - 1; i >= 0; i--) {
    const e = gs.explosions[i];
    e.radius += dt * 200;
    e.alpha -= dt * 2.5;
    if (e.alpha <= 0 || e.radius > e.maxRadius) gs.explosions.splice(i, 1);
  }

  // Lore
  gs.loreTimer -= dt;
  if (gs.loreTimer <= 0) {
    gs.loreIndex = (gs.loreIndex + 1) % LORE_ENTRIES.length;
    gs.loreText = LORE_ENTRIES[gs.loreIndex];
    gs.loreAlpha = 1;
    gs.loreTimer = 14;
  }
  if (gs.loreTimer < 2) gs.loreAlpha = gs.loreTimer / 2;
}