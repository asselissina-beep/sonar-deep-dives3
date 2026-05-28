import { useRef, useEffect, useCallback, useState } from "react";
import WaterLinkedLogo from "./WaterLinkedLogo";
import WaitingBackground from "./WaitingBackground";
import { useGameConfig, DEFAULT_GAMEPLAY_SETTINGS } from "@/hooks/useGameConfig";
import QRCodeDisplay from "./QRCodeDisplay";
import {
  createGameChannel,
  sendGameMessage,
  generateSessionCode,
  generateJoinToken,
  buildControllerUrl,
  getAppOrigin,
  SESSION_INACTIVITY_MS,
  SESSION_LINK_LOST_MS,
  REMOTE_JOYSTICK_DEADZONE,
  REMOTE_JOYSTICK_PIXEL_SCALE,
  isMeaningfulControllerInput,
  type GameMessage,
} from "@/lib/gameChannel";
import { sessionBreakDurationMs } from "@/lib/sessionBreak";
import { supabase } from "@/integrations/supabase/client";
import { persistSessionStart, persistGameOver, persistSessionAbort } from "@/lib/gamePersistence";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  createInitialState,
  update,
  render,
  drawTouchControls,
  type GameState,
  type TouchInput,
} from "@/game";

const SSR_VIEWPORT_WIDTH = 1280;
const SSR_VIEWPORT_HEIGHT = 800;

type LobbyDensity = "comfortable" | "compact" | "tight";

function lobbyDensity(height: number): LobbyDensity {
  if (height < 720) return "tight";
  if (height < 900) return "compact";
  return "comfortable";
}

function logoWidthForViewport(isMobile: boolean, width: number, height: number): number {
  const d = lobbyDensity(height);
  if (isMobile) return d === "tight" ? 200 : d === "compact" ? 240 : 280;
  if (width >= 1920) return d === "tight" ? 260 : d === "compact" ? 300 : 360;
  if (width >= 1280) return d === "tight" ? 220 : d === "compact" ? 280 : 320;
  return d === "tight" ? 200 : d === "compact" ? 240 : 280;
}

function qrSizeForViewport(isMobile: boolean, width: number, height: number): number {
  const d = lobbyDensity(height);
  if (isMobile) return d === "tight" ? 96 : d === "compact" ? 108 : 120;
  if (width >= 1920) return d === "tight" ? 128 : d === "compact" ? 152 : 180;
  if (width >= 1280) return d === "tight" ? 120 : d === "compact" ? 140 : 160;
  return d === "tight" ? 108 : d === "compact" ? 120 : 140;
}

// ── Component ──────────────────────────────────────────────────────
export default function SubmarineGame() {
  const { config, loading: configLoading } = useGameConfig();
  const gpSettings = config?.gameplay_settings ?? DEFAULT_GAMEPLAY_SETTINGS;
  const gpSettingsRef = useRef(gpSettings);
  gpSettingsRef.current = gpSettings;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const keysRef = useRef(new Set<string>());
  const touchRef = useRef<TouchInput>({
    joystick: { active: false, startX: 0, startY: 0, currentX: 0, currentY: 0 },
    thrust: false, fire: false, sonar: false,
  });
  const remoteRef = useRef<TouchInput>({
    joystick: { active: false, startX: 0, startY: 0, currentX: 0, currentY: 0 },
    thrust: false,
    fire: false,
    sonar: false,
  });
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [gamePhase, setGamePhase] = useState<"waiting" | "playing">("waiting");
  const [isMobile, setIsMobile] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(SSR_VIEWPORT_WIDTH);
  const [viewportHeight, setViewportHeight] = useState(SSR_VIEWPORT_HEIGHT);
  const [controllerUrl, setControllerUrl] = useState("");
  /** Client-only: random codes must not run during SSR (React hydration #418). */
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [joinToken, setJoinToken] = useState<string | null>(null);
  const joinTokenRef = useRef("");
  const [playerName, setPlayerName] = useState<string | null>(null);
  const playerNameRef = useRef<string>("PILOT");
  const sessionActiveRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const lastGameOverSentRef = useRef(false);
  const lastPersistDoneRef = useRef(false);
  const lastControllerPacketRef = useRef(0);
  const lastMeaningfulInputRef = useRef(0);
  const [persistenceWarning, setPersistenceWarning] = useState<string | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  const rotateJoinToken = useCallback(() => {
    if (!sessionCode) return;
    const token = generateJoinToken();
    joinTokenRef.current = token;
    setJoinToken(token);
    if (typeof window === "undefined") return;
    setControllerUrl(buildControllerUrl(getAppOrigin(window.location.origin), sessionCode, token));
  }, [sessionCode]);

  const returnToWaitingLobby = useCallback(
    (opts?: { skipAbort?: boolean; startBreak?: boolean; force?: boolean }) => {
      const sessionId = sessionIdRef.current;
      const shouldAbortSession =
        !opts?.skipAbort &&
        sessionActiveRef.current &&
        sessionId &&
        !lastPersistDoneRef.current;
      const hadActivePlay = sessionActiveRef.current || lastGameOverSentRef.current;

      // Stay on the results screen until the operator leaves or the booth resets.
      if (!opts?.force && gameRef.current?.gameOver) {
        return;
      }

      sessionActiveRef.current = false;
      sessionIdRef.current = null;
      lastPersistDoneRef.current = false;

      if (shouldAbortSession) {
        void persistSessionAbort(sessionCode, sessionId);
      }

      if (hadActivePlay && channelRef.current) {
        sendGameMessage(channelRef.current, { type: "session_ended" });
      }

      const booth = configRef.current;
      const startBreak = opts?.startBreak ?? lastGameOverSentRef.current;
      if (startBreak && booth?.session_break_enabled && channelRef.current) {
        sendGameMessage(channelRef.current, {
          type: "session_break",
          remainingMs: sessionBreakDurationMs(booth.session_break_minutes),
        });
      }

      lastGameOverSentRef.current = false;
      setPlayerName(null);
      setGamePhase("waiting");
      gameRef.current = null;
      remoteRef.current = {
        joystick: { active: false, startX: 0, startY: 0, currentX: 0, currentY: 0 },
        thrust: false,
        fire: false,
        sonar: false,
      };
      rotateJoinToken();
    },
    [rotateJoinToken, sessionCode]
  );

  useEffect(() => {
    const code = generateSessionCode();
    const token = generateJoinToken();
    joinTokenRef.current = token;
    setSessionCode(code);
    setJoinToken(token);
    setControllerUrl(buildControllerUrl(getAppOrigin(window.location.origin), code, token));
  }, []);

  useEffect(() => {
    if (!sessionCode || !joinTokenRef.current) return;
    const check = () => {
      setViewportWidth(window.innerWidth);
      setViewportHeight(window.innerHeight);
      setIsMobile(window.innerWidth < 768 || "ontouchstart" in window);
    };
    check();
    window.addEventListener("resize", check);
    setControllerUrl(
      buildControllerUrl(getAppOrigin(window.location.origin), sessionCode, joinTokenRef.current)
    );
    return () => window.removeEventListener("resize", check);
  }, [sessionCode, joinToken]);

  const matchesJoinToken = useCallback((token: string | undefined) => {
    return !!token && token === joinTokenRef.current;
  }, []);

  // Supabase Realtime channel — active once booth session exists (client-only)
  useEffect(() => {
    if (!sessionCode) return;

    const handleMessage = (msg: GameMessage) => {
      if (msg.type === "player_joined") {
        if (!matchesJoinToken(msg.joinToken)) {
          if (channelRef.current) {
            sendGameMessage(channelRef.current, { type: "session_busy" });
          }
          return;
        }
        if (sessionActiveRef.current) {
          // Reject — session already in progress
          if (channelRef.current) {
            sendGameMessage(channelRef.current, { type: "session_busy" });
          }
          return;
        }
        // Accept player
        sessionActiveRef.current = true;
        const now = Date.now();
        lastControllerPacketRef.current = now;
        lastMeaningfulInputRef.current = now;
        playerNameRef.current = msg.playerName;
        setPlayerName(msg.playerName);
        setGamePhase("playing");
        lastGameOverSentRef.current = false;
        lastPersistDoneRef.current = false;
        setPersistenceWarning(null);
        void persistSessionStart(sessionCode, msg.playerName).then((id) => {
          sessionIdRef.current = id;
          if (gameRef.current) gameRef.current.sessionId = id;
          if (!id && import.meta.env.DEV) {
            setPersistenceWarning("Session could not be saved to the database.");
          }
        });
        // ACK the controller
        if (channelRef.current) {
          sendGameMessage(channelRef.current, { type: "game_ack" });
        }
      }

      if (msg.type === "controller_input") {
        if (!matchesJoinToken(msg.joinToken)) return;
        const now = Date.now();
        lastControllerPacketRef.current = now;
        if (isMeaningfulControllerInput(msg)) {
          lastMeaningfulInputRef.current = now;
        }
        const joyMag = Math.hypot(msg.joystickX, msg.joystickY);
        const joy = remoteRef.current.joystick;
        joy.active = joyMag > REMOTE_JOYSTICK_DEADZONE;
        if (joy.active) {
          joy.startX = 0;
          joy.startY = 0;
          joy.currentX = msg.joystickX * REMOTE_JOYSTICK_PIXEL_SCALE;
          joy.currentY = msg.joystickY * REMOTE_JOYSTICK_PIXEL_SCALE;
        } else {
          joy.currentX = 0;
          joy.currentY = 0;
        }
        remoteRef.current.thrust = msg.thrust;
        remoteRef.current.fire = msg.fire;
        remoteRef.current.sonar = msg.sonar;
        if (msg.playerName) {
          playerNameRef.current = msg.playerName;
          if (gameRef.current) gameRef.current.playerName = msg.playerName;
        }
        if (msg.restart && gameRef.current?.gameOver) {
          gameRef.current = createInitialState(window.innerWidth, window.innerHeight, gpSettingsRef.current);
          gameRef.current.playerName = playerNameRef.current;
          gameRef.current.sessionCode = sessionCode;
          gameRef.current.sessionId = sessionIdRef.current;
          lastPersistDoneRef.current = false;
        }
      }

      if (msg.type === "player_left") {
        // Ignore leave events from non-active controllers (e.g. rejected joiners
        // unmounting their channel after a session_busy bounce).
        if (!sessionActiveRef.current) return;
        if (msg.joinToken && !matchesJoinToken(msg.joinToken)) return;
        if (
          msg.playerName &&
          playerNameRef.current &&
          msg.playerName !== playerNameRef.current
        ) {
          return;
        }
        returnToWaitingLobby({
          startBreak: lastGameOverSentRef.current,
          force: true,
        });
      }
    };

    const channel = createGameChannel(sessionCode, handleMessage);
    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [sessionCode, matchesJoinToken, returnToWaitingLobby]);

  // Release stuck session: link lost (no packets) or idle (no meaningful input)
  useEffect(() => {
    if (gamePhase !== "playing") return;
    const id = setInterval(() => {
      if (!sessionActiveRef.current) return;
      if (gameRef.current?.gameOver) return;
      const now = Date.now();
      if (now - lastControllerPacketRef.current > SESSION_LINK_LOST_MS) {
        returnToWaitingLobby();
        return;
      }
      if (now - lastMeaningfulInputRef.current > SESSION_INACTIVITY_MS) {
        returnToWaitingLobby();
      }
    }, 2000);
    return () => clearInterval(id);
  }, [gamePhase, returnToWaitingLobby]);

  // Operator kill switch: poll DB while playing so admin-ended sessions release the booth
  useEffect(() => {
    if (gamePhase !== "playing") return;

    const checkSessionStillActive = async () => {
      const id = sessionIdRef.current;
      if (!id || !sessionActiveRef.current) return;

      const { data, error } = await supabase
        .from("game_sessions")
        .select("status")
        .eq("id", id)
        .maybeSingle();

      if (error || !data || data.status === "playing") return;
      if (gameRef.current?.gameOver) return;

      lastPersistDoneRef.current = true;
      if (channelRef.current) {
        sendGameMessage(channelRef.current, { type: "session_ended" });
      }
      returnToWaitingLobby({ skipAbort: true, force: true });
    };

    void checkSessionStillActive();
    const pollId = setInterval(() => void checkSessionStillActive(), 4000);
    return () => clearInterval(pollId);
  }, [gamePhase, returnToWaitingLobby]);

  // Game loop — runs when playing
  useEffect(() => {
    if (gamePhase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const logicalW = () => window.innerWidth;
    const logicalH = () => window.innerHeight;

    gameRef.current = createInitialState(logicalW(), logicalH(), gpSettingsRef.current);
    gameRef.current.playerName = playerNameRef.current;
    gameRef.current.sessionCode = sessionCode;
    gameRef.current.sessionId = sessionIdRef.current;
    lastPersistDoneRef.current = false;

    // Keyboard
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key === " " ? " " : e.key.toLowerCase();
      keysRef.current.add(key);
      if (key === "r" && gameRef.current?.gameOver) {
        gameRef.current = createInitialState(logicalW(), logicalH(), gpSettingsRef.current);
        gameRef.current.playerName = playerNameRef.current;
        gameRef.current.sessionCode = sessionCode;
        gameRef.current.sessionId = sessionIdRef.current;
        lastPersistDoneRef.current = false;
      }
      if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) e.preventDefault();
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key === " " ? " " : e.key.toLowerCase());
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    // Touch handlers (for direct mobile play)
    const touchIds: Map<number, string> = new Map();

    const getButtonHit = (x: number, y: number): string | null => {
      const w = logicalW();
      const h = logicalH();
      const btnBaseX = w - 60;
      const btnBaseY = h - 80;
      const btnSize = 40;
      const sonarY = btnBaseY - 34 * 2 - 14;
      if (Math.sqrt((x - btnBaseX) ** 2 + (y - btnBaseY) ** 2) < btnSize) return "fire";
      if (Math.sqrt((x - btnBaseX) ** 2 + (y - sonarY) ** 2) < btnSize) return "sonar";
      return null;
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const w = logicalW();
      if (gameRef.current?.gameOver) {
        gameRef.current = createInitialState(logicalW(), logicalH(), gpSettingsRef.current);
        gameRef.current.playerName = playerNameRef.current;
        gameRef.current.sessionCode = sessionCode;
        gameRef.current.sessionId = sessionIdRef.current;
        lastPersistDoneRef.current = false;
        return;
      }
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const x = t.clientX;
        const y = t.clientY;
        const btn = getButtonHit(x, y);
        if (btn === "fire") {
          touchIds.set(t.identifier, "fire");
          touchRef.current.fire = true;
        } else if (btn === "sonar") {
          touchIds.set(t.identifier, "sonar");
          touchRef.current.sonar = true;
        } else if (x < w * 0.5) {
          touchIds.set(t.identifier, "joystick");
          touchRef.current.joystick = { active: true, startX: x, startY: y, currentX: x, currentY: y };
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const role = touchIds.get(t.identifier);
        if (role === "joystick") {
          touchRef.current.joystick.currentX = t.clientX;
          touchRef.current.joystick.currentY = t.clientY;
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const role = touchIds.get(t.identifier);
        if (role === "joystick") {
          touchRef.current.joystick.active = false;
          touchRef.current.thrust = false;
        } else if (role === "fire") {
          touchRef.current.fire = false;
        } else if (role === "sonar") {
          touchRef.current.sonar = false;
        }
        touchIds.delete(t.identifier);
      }
    };

    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd);
    canvas.addEventListener("touchcancel", handleTouchEnd);

    let lastTime = performance.now();
    let animId: number;
    const mobile = window.innerWidth < 768 || "ontouchstart" in window;

    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const lw = logicalW();
      const lh = logicalH();

      if (gameRef.current) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const mergedTouch: TouchInput = {
          joystick: remoteRef.current.joystick.active
            ? remoteRef.current.joystick
            : touchRef.current.joystick,
          thrust: touchRef.current.thrust || remoteRef.current.thrust,
          fire: touchRef.current.fire || remoteRef.current.fire,
          sonar: touchRef.current.sonar || remoteRef.current.sonar,
        };
        const wasGameOver = gameRef.current.gameOver;
        update(gameRef.current, dt, keysRef.current, lw, lh, mergedTouch);
        const g = gameRef.current;

        if (g.gameOver && !wasGameOver && !lastPersistDoneRef.current) {
          lastPersistDoneRef.current = true;
          void persistGameOver(
            g.sessionCode,
            g.sessionId,
            g.playerName,
            g.score,
            g.depth,
            g.wave
          ).then((ok) => {
            if (!ok) {
              setPersistenceWarning("Score could not be saved to the leaderboard.");
            }
          });
        }

        render(ctx, g, lw, lh, mobile);
        if (mobile && !gameRef.current.gameOver) {
          drawTouchControls(ctx, touchRef.current, lw, lh);
        }

        if (gameRef.current.gameOver && !lastGameOverSentRef.current && channelRef.current) {
          lastGameOverSentRef.current = true;
          sendGameMessage(channelRef.current, {
            type: "game_over",
            score: gameRef.current.score,
            depth: gameRef.current.depth,
            wave: gameRef.current.wave,
          });
        }
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
      canvas.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [gamePhase, returnToWaitingLobby, sessionCode]);

  // ── Waiting screen (TV idle) ──────────────────────────────────────
  const lobbyLayout = lobbyDensity(viewportHeight);
  const logoMb = lobbyLayout === "tight" ? "mb-2" : lobbyLayout === "compact" ? "mb-3" : "mb-5";
  const sectionMt = lobbyLayout === "tight" ? "mt-3" : lobbyLayout === "compact" ? "mt-4" : "mt-6";
  const missionClamp =
    lobbyLayout === "tight"
      ? "line-clamp-2 text-xs"
      : lobbyLayout === "compact"
        ? "line-clamp-3 text-sm"
        : "text-sm lg:text-base";

  if (gamePhase === "waiting") {
    if (!config) {
      return (
        <div className="relative min-h-dvh overflow-x-hidden overflow-y-auto px-4 sm:px-6 py-4">
          <WaitingBackground />
          <div className="relative z-10 w-full max-w-5xl mx-auto text-center space-y-4">
            <div className="h-4 w-48 mx-auto rounded bg-muted-foreground/20 animate-pulse" />
            <div className="h-16 sm:h-20 md:h-24 w-72 sm:w-96 mx-auto rounded bg-primary/10 animate-pulse" />
            <div className="h-4 w-56 mx-auto rounded bg-muted-foreground/20 animate-pulse" />
            <div className="mt-8 rounded border border-border bg-card/60 p-6 space-y-3">
              <div className="h-3 w-24 rounded bg-primary/20 animate-pulse" />
              <div className="h-3 w-full rounded bg-muted-foreground/10 animate-pulse" />
              <div className="h-3 w-5/6 rounded bg-muted-foreground/10 animate-pulse" />
              <div className="h-3 w-3/4 rounded bg-muted-foreground/10 animate-pulse" />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="relative min-h-dvh overflow-x-hidden overflow-y-auto px-4 sm:px-6 py-3 sm:py-5">
        <WaitingBackground />

        <div className="relative z-10 w-full max-w-5xl mx-auto text-center">
          {/* Water Linked Logo */}
          {config.show_logo !== false && (
            <div className={`${logoMb} flex justify-center`}>
              <WaterLinkedLogo
                width={logoWidthForViewport(isMobile, viewportWidth, viewportHeight)}
                className="drop-shadow-[0_0_30px_rgba(76,217,100,0.15)] max-w-full h-auto"
                showSlogan={config.show_slogan !== false && lobbyLayout !== "tight"}
              />
            </div>
          )}

          <div className="mb-1 text-[10px] sm:text-xs tracking-[0.2em] sm:tracking-[0.3em] text-muted-foreground font-body">
            {config.subtitle}
          </div>

          <h1
            className="font-display font-black text-primary whitespace-nowrap text-[clamp(1.25rem,min(5.5vw,4.5vh),2.75rem)] tracking-[0.06em] sm:tracking-[0.12em] mx-auto px-1"
            style={{ textShadow: "0 0 40px rgba(76,217,100,0.3)" }}
          >
            {config.game_name}
          </h1>
          <p className="mt-0.5 font-display text-xs sm:text-sm md:text-base tracking-[0.2em] sm:tracking-[0.28em] text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis max-w-full px-2">
            {config.title}
          </p>

          <div className="mt-4 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-4 lg:gap-6 items-start">
          {/* Lore panel */}
          {config.show_mission_description !== false && (
            <div
              className={`${sectionMt} lg:mt-0 rounded border border-border bg-card/60 p-3 sm:p-4 text-left backdrop-blur-sm relative order-2 lg:order-1 ${lobbyLayout === "tight" ? "hidden sm:block" : ""}`}
            >
              <div className="absolute top-0 left-0 w-3 h-3 border-l-2 border-t-2 border-primary" />
              <div className="absolute top-0 right-0 w-3 h-3 border-r-2 border-t-2 border-primary" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-l-2 border-b-2 border-primary" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-r-2 border-b-2 border-primary" />

              <div className="text-[9px] sm:text-[10px] lg:text-xs 2xl:text-sm tracking-widest text-primary mb-2">MISSION BRIEF</div>
              <p className={`leading-relaxed text-muted-foreground font-body ${missionClamp}`}>
                {config.mission_description}
              </p>
            </div>
          )}

          <div className={`flex flex-col items-center order-1 lg:order-2 lg:sticky lg:top-4 ${sectionMt} lg:mt-0`}>
          {/* QR Code — primary CTA (session codes are client-only) */}
          {sessionCode && controllerUrl && config.show_qr_code !== false && (
            <div className="flex flex-col items-center gap-2 sm:gap-3">
              <div className="text-[10px] sm:text-xs tracking-[0.25em] text-primary font-body animate-pulse whitespace-nowrap">
                SCAN TO PLAY
              </div>
              <QRCodeDisplay url={controllerUrl} size={qrSizeForViewport(isMobile, viewportWidth, viewportHeight)} />
              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 mt-0.5">
                <span className="text-[9px] sm:text-[10px] tracking-widest text-muted-foreground font-body shrink-0">SESSION</span>
                <span
                  className="font-display text-xl sm:text-2xl md:text-3xl tracking-[0.28em] sm:tracking-[0.35em] text-primary whitespace-nowrap"
                  style={{ textShadow: "0 0 20px rgba(76,217,100,0.4)" }}
                >
                  {sessionCode}
                </span>
              </div>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground/60 font-body leading-snug max-w-[280px]">
                Scan to accept the mission — threats are incoming
              </p>
            </div>
          )}

          {isMobile && (
            <button
              type="button"
              onClick={() => {
                playerNameRef.current = "PILOT";
                setPlayerName("PILOT");
                sessionActiveRef.current = true;
                setGamePhase("playing");
              }}
              className="mt-4 rounded border border-primary bg-primary/10 px-10 py-2.5 font-display text-base tracking-[0.3em] text-primary transition-all hover:bg-primary/20 active:bg-primary/30"
            >
              DIVE
            </button>
          )}
          </div>
          </div>

          {persistenceWarning && (
            <div className="mt-3 sm:mt-4 rounded border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-[9px] sm:text-[10px] lg:text-xs tracking-wider text-amber-200 max-w-md mx-auto">
              ⚠ {persistenceWarning}
            </div>
          )}

          {/* Warning */}
          <div className="mt-3 sm:mt-4 rounded border border-destructive/40 bg-destructive/5 px-3 py-1.5 text-[9px] sm:text-[10px] tracking-wider text-destructive whitespace-nowrap overflow-x-auto max-w-full mx-auto">
            ⚠ HOSTILE CONTACTS DETECTED — AWAITING OPERATOR
          </div>

          <div className="mt-4 sm:mt-5 lg:mt-6">
            <a
              href="/scoreboard"
              className="inline-flex items-center gap-2 rounded border border-primary/40 bg-primary/5 px-4 py-2 font-display text-[10px] sm:text-xs lg:text-sm tracking-[0.3em] text-primary transition-all hover:bg-primary/15 hover:shadow-[0_0_20px_rgba(76,217,100,0.2)]"
            >
              ▣ VIEW SCOREBOARD
            </a>
          </div>

          {/* Footer text removed — global "Powered by LogiqApps AS" footer renders site-wide. */}
        </div>
      </div>
    );
  }

  // ── Game canvas ──────────────────────────────────────────────────
  return (
    <div className="relative">
      {/* Player name banner on TV */}
      {playerName && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 bg-card/80 border border-primary/30 rounded-b px-6 py-1.5 backdrop-blur-sm">
          <span className="text-[10px] tracking-[0.3em] text-muted-foreground font-body">OPERATOR: </span>
          <span className="text-sm tracking-wider text-primary font-display">{playerName}</span>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="block cursor-none"
        style={{ touchAction: "none", background: "#0a1520", width: "100vw", height: "100dvh" }}
      />
      {config?.show_logo !== false && (
        <div className="absolute bottom-3 right-3 z-10 opacity-60 hover:opacity-100 transition-opacity">
          <WaterLinkedLogo width={120} showSlogan={config?.show_slogan !== false} />
        </div>
      )}
    </div>
  );
}
