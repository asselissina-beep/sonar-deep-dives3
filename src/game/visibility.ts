import type { GameplaySettings } from "@/lib/gameConfig";
import { dist } from "./state";
import type { SonarBeam, Vec2 } from "./types";

export function isInSonarCone(pos: Vec2, origin: Vec2, angle: number, halfFov: number = Math.PI / 4): boolean {
  const dx = pos.x - origin.x;
  const dy = pos.y - origin.y;
  let da = Math.atan2(dy, dx) - angle;
  // Normalize to [-PI, PI]
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  return Math.abs(da) <= halfFov;
}

export function getVisibility(pos: Vec2, subPos: Vec2, sonarBeam: SonarBeam | null, subAngle: number, cfg: GameplaySettings): number {
  const d = dist(pos, subPos);
  const sonarHalfFov = (cfg.sonar_fov_degrees / 2) * (Math.PI / 180);
  // Close-range visibility (headlight cone — narrower, ~60°)
  if (d < 180) {
    const inHeadlight = isInSonarCone(pos, subPos, subAngle, Math.PI / 6);
    if (d < 80 && inHeadlight) return 1;
    if (d < 180 && inHeadlight) return 0.3 + 0.7 * (1 - (d - 80) / 100);
  }
  // Very close all-around ambient visibility
  if (d < 50) return 0.6;
  // Sonar beam — flashlight cone that grows during expand phase, then holds at full FOV
  if (sonarBeam && sonarBeam.alpha > 0) {
    // Min FOV at start = ~8° half-angle (narrow nose beam); grows to full sonarHalfFov
    const minHalfFov = Math.PI / 22;
    const currentHalfFov = minHalfFov + (sonarHalfFov - minHalfFov) * sonarBeam.fovFraction;
    // Range also grows with expansion for a "wave reaching outward" feel
    const currentRange = cfg.sonar_max_radius * (0.35 + 0.65 * sonarBeam.fovFraction);
    if (d <= currentRange && isInSonarCone(pos, subPos, subAngle, currentHalfFov)) {
      const distFade = 1 - (d / currentRange) * 0.4;
      return sonarBeam.alpha * 0.9 * distFade;
    }
  }
  return 0.06;
}