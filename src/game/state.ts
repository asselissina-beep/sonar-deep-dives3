import type { GameplaySettings } from "@/lib/gameConfig";
import { DEFAULT_GAMEPLAY_SETTINGS } from "@/lib/gameConfig";
import type { Sub, Torpedo, Obstacle, Particle, SonarBeam, Vec2 } from "./types";
import { LORE_ENTRIES } from "./constants";

let nextObstacleId = 0;

export function allocateObstacleId(): number {
  return nextObstacleId++;
}

export function resetObstacleIds(): void {
  nextObstacleId = 0;
}

export function createInitialState(w: number, h: number, settings: GameplaySettings = DEFAULT_GAMEPLAY_SETTINGS) {
  resetObstacleIds();
  const sub: Sub = {
    pos: { x: w / 2, y: h / 2 },
    vel: { x: 0, y: 0 },
    angle: -Math.PI / 2,
    hp: settings.max_hp, maxHp: settings.max_hp,
    sonarCooldown: 0, torpedoCooldown: 0,
    battery: settings.battery_max, maxBattery: settings.battery_max,
  };
  return {
    sub,
    torpedoes: [] as Torpedo[],
    obstacles: [] as Obstacle[],
    particles: [] as Particle[],
    sonarBeam: null as SonarBeam | null,
    score: 0,
    depth: 1000,
    wave: 0,
    spawnTimer: 0,
    loreIndex: 0,
    loreText: LORE_ENTRIES[0],
    loreAlpha: 1,
    loreTimer: 6,
    gameOver: false,
    time: 0,
    sonarSweepAngle: 0,
    acousticIntensity: 0.2,
    thrusting: false,
    lives: settings.lives,
    respawnTimer: 0,
    respawnFlash: 0,
    screenShake: 0,
    explosions: [] as { x: number; y: number; radius: number; maxRadius: number; alpha: number }[],
    playerName: "PILOT",
    sessionCode: "",
    sessionId: null as string | null,
    settings,
    idleTimer: 0,
    hunterTimer: 0,
    lastPos: { x: w / 2, y: h / 2 } as Vec2,
  };
}

export type GameState = ReturnType<typeof createInitialState>;

export function dist(a: Vec2, b: Vec2) {
  const dx = a.x - b.x; const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function wrap(v: Vec2, w: number, h: number): Vec2 {
  return { x: ((v.x % w) + w) % w, y: ((v.y % h) + h) % h };
}

type SpawnWeights = Pick<
  GameplaySettings,
  | "mine_weight"
  | "manta_weight"
  | "swarm_weight"
  | "shipwreck_weight"
  | "beacon_weight"
  | "seafloor_weight"
>;

/** Weighted obstacle kind for spawn (roll in [0, 1)). */
export function pickObstacleKind(roll: number, s: SpawnWeights): Obstacle["kind"] {
  const weights: [Obstacle["kind"], number][] = [
    ["mine", s.mine_weight],
    ["manta", s.manta_weight],
    ["swarm", s.swarm_weight],
    ["shipwreck", s.shipwreck_weight],
    ["beacon", s.beacon_weight],
    ["seafloor", s.seafloor_weight],
  ];
  const totalWeight = weights.reduce((sum, [, w]) => sum + w, 0);
  if (totalWeight <= 0) return "mine";

  let remaining = roll * totalWeight;
  for (const [kind, weight] of weights) {
    remaining -= weight;
    if (remaining <= 0) return kind;
  }
  return weights[weights.length - 1][0];
}

export function spawnObstacle(w: number, h: number, wave: number, s: GameplaySettings): Obstacle {
  const edge = Math.floor(Math.random() * 4);
  let x = 0, y = 0;
  if (edge === 0) { x = Math.random() * w; y = -40; }
  else if (edge === 1) { x = w + 40; y = Math.random() * h; }
  else if (edge === 2) { x = Math.random() * w; y = h + 40; }
  else { x = -40; y = Math.random() * h; }

  const speed = s.enemy_base_speed + Math.random() * s.enemy_speed_variance + wave * s.enemy_wave_speed_bonus;
  const angle = Math.random() * Math.PI * 2;

  const kind = pickObstacleKind(Math.random(), s);

  const radiusMap: Record<string, number> = {
    mine: 10 + Math.random() * 5,
    manta: 22 + Math.random() * 8,
    swarm: 6 + Math.random() * 3,
    shipwreck: 20 + Math.random() * 10,
    beacon: 12 + Math.random() * 4,
    seafloor: 16 + Math.random() * 8,
  };
  const hpMap: Record<string, number> = { mine: s.mine_hp, manta: s.manta_hp, swarm: s.swarm_hp, shipwreck: s.shipwreck_hp, beacon: s.beacon_hp, seafloor: s.seafloor_hp };
  const velMultiplier: Record<string, number> = { mine: 0.6, manta: 1.2, swarm: 1.5, shipwreck: 0.15, beacon: 0.1, seafloor: 0.08 };
  const spd = speed * (velMultiplier[kind] || 1);

  return {
    pos: { x, y }, vel: { x: Math.cos(angle) * spd, y: Math.sin(angle) * spd },
    radius: radiusMap[kind] || 15, hp: hpMap[kind] || 1,
    kind, angle: Math.random() * Math.PI * 2, id: allocateObstacleId(),
  };
}