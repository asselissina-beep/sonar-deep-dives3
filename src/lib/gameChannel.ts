/**
 * Cross-device game communication using Supabase Realtime Broadcast.
 * Each game instance uses a unique session code + join token for isolation.
 */
import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export const CHANNEL_PREFIX = "abyssal_session_";
export const SESSION_CODE_LENGTH = 6;
export const SESSION_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SESSION_CODE_PATTERN = new RegExp(
  `^[${SESSION_CODE_CHARS}]{${SESSION_CODE_LENGTH}}$`
);
const JOIN_TOKEN_PATTERN = /^[a-f0-9]{32}$/;

/** ~1.0B combinations (32^6) vs ~32k for 3-char codes. */
export function generateSessionCode(): string {
  let code = "";
  for (let i = 0; i < SESSION_CODE_LENGTH; i++) {
    code += SESSION_CODE_CHARS[Math.floor(Math.random() * SESSION_CODE_CHARS.length)];
  }
  return code;
}

/** Secret join token embedded in QR; rotated when the TV returns to the waiting lobby. */
export function generateJoinToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function isValidSessionCode(code: string): boolean {
  return SESSION_CODE_PATTERN.test(code.toUpperCase());
}

export function isValidJoinToken(token: string): boolean {
  return JOIN_TOKEN_PATTERN.test(token.toLowerCase());
}

export { getAppOrigin } from "@/lib/appUrl";

export function buildControllerUrl(origin: string, sessionCode: string, joinToken: string): string {
  const params = new URLSearchParams({
    session: sessionCode.toUpperCase(),
    token: joinToken.toLowerCase(),
  });
  return `${origin}/controller?${params.toString()}`;
}

export function channelNameForSession(sessionCode: string): string {
  return `${CHANNEL_PREFIX}${sessionCode.toUpperCase()}`;
}

// Message types
export interface PlayerJoinedPayload {
  type: "player_joined";
  playerName: string;
  joinToken: string;
}

export interface ControllerInputPayload {
  type: "controller_input";
  joinToken: string;
  joystickX: number;
  joystickY: number;
  thrust: boolean;
  fire: boolean;
  sonar: boolean;
  restart: boolean;
  playerName: string;
}

export type ControllerInputState = Omit<ControllerInputPayload, "type" | "joinToken" | "playerName">;

export interface GameAckPayload {
  type: "game_ack";
}

export interface GameOverPayload {
  type: "game_over";
  score: number;
  depth: number;
  wave: number;
}

export interface SessionBusyPayload {
  type: "session_busy";
}

export interface PlayerLeftPayload {
  type: "player_left";
  playerName?: string;
  joinToken?: string;
}

/** TV → controller when the booth session was ended externally (admin kill, DB sync). */
export interface SessionEndedPayload {
  type: "session_ended";
}

/** TV → controller: booth cooldown before the next player can join. */
export interface SessionBreakPayload {
  type: "session_break";
  remainingMs: number;
}

export type GameMessage =
  | PlayerJoinedPayload
  | ControllerInputPayload
  | GameAckPayload
  | GameOverPayload
  | SessionBusyPayload
  | PlayerLeftPayload
  | SessionEndedPayload
  | SessionBreakPayload;

export function messageHasJoinToken(
  msg: GameMessage
): msg is PlayerJoinedPayload | ControllerInputPayload | PlayerLeftPayload {
  return (
    msg.type === "player_joined" ||
    msg.type === "controller_input" ||
    (msg.type === "player_left" && msg.joinToken !== undefined)
  );
}

export function createGameChannel(
  sessionCode: string,
  onMessage: (msg: GameMessage) => void
): RealtimeChannel {
  const channel = supabase.channel(channelNameForSession(sessionCode), {
    config: { private: true, broadcast: { self: false } },
  });

  channel.on("broadcast", { event: "game" }, (payload) => {
    if (payload.payload) {
      onMessage(payload.payload as GameMessage);
    }
  });

  channel.subscribe();

  return channel;
}

export function sendGameMessage(channel: RealtimeChannel, message: GameMessage) {
  channel.send({
    type: "broadcast",
    event: "game",
    payload: message,
  });
}

/** TV: no joystick/button activity for this long → waiting lobby (link may still be up). */
export const SESSION_INACTIVITY_MS = 30_000;

/** TV: no controller packets at all for this long → treat link as dead (killed app / network). */
export const SESSION_LINK_LOST_MS = 10_000;

/** Controller: send at least this often while linked so the TV can detect disconnects. */
export const CONTROLLER_HEARTBEAT_MS = 2_000;

/** Cap controller_input broadcasts (~30 Hz per active player — smoother phone control). */
export const CONTROLLER_MAX_INPUT_HZ = 30;
export const CONTROLLER_INPUT_INTERVAL_MS = Math.floor(1000 / CONTROLLER_MAX_INPUT_HZ);

/** Phone stick magnitude below this is treated as centered (avoids network jitter). */
export const REMOTE_JOYSTICK_DEADZONE = 0.12;

/** Maps normalized stick (-1..1) to virtual touch pixel offset for the shared joystick code path. */
export const REMOTE_JOYSTICK_PIXEL_SCALE = 50;

export function isMeaningfulControllerInput(
  input: Pick<ControllerInputState, "joystickX" | "joystickY" | "thrust" | "fire" | "sonar" | "restart">
): boolean {
  const joyMag = Math.sqrt(input.joystickX ** 2 + input.joystickY ** 2);
  return joyMag > REMOTE_JOYSTICK_DEADZONE || input.thrust || input.fire || input.sonar || input.restart;
}

export function controllerInputsEqual(a: ControllerInputState, b: ControllerInputState): boolean {
  return (
    a.joystickX === b.joystickX &&
    a.joystickY === b.joystickY &&
    a.thrust === b.thrust &&
    a.fire === b.fire &&
    a.sonar === b.sonar &&
    a.restart === b.restart
  );
}
