// ── Types ──────────────────────────────────────────────────────────
export interface Vec2 { x: number; y: number }
export interface Sub {
  pos: Vec2; vel: Vec2; angle: number;
  hp: number; maxHp: number;
  sonarCooldown: number; torpedoCooldown: number;
  battery: number; maxBattery: number;
}
export interface Torpedo { pos: Vec2; vel: Vec2; life: number }
export interface Obstacle {
  pos: Vec2; vel: Vec2; radius: number; hp: number;
  kind: "rock" | "mine" | "manta" | "swarm" | "shipwreck" | "beacon" | "seafloor";
  angle: number; id: number;
}
export interface Particle {
  pos: Vec2; vel: Vec2; life: number; maxLife: number;
  color: string; radius: number; kind: "spark" | "bubble";
}
export interface SonarBeam {
  age: number;
  expandDuration: number; // time to grow from narrow beam to full cone
  holdDuration: number;   // time at full radius/FOV
  fadeDuration: number;   // smooth fade-out
  alpha: number;
  fovFraction: number;    // 0 → 1 (narrow nose beam → full FOV)
}
// ── Touch Input State ──────────────────────────────────────────────
export interface TouchInput {
  joystick: { active: boolean; startX: number; startY: number; currentX: number; currentY: number };
  thrust: boolean;
  fire: boolean;
  sonar: boolean;
}