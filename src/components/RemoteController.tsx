import { useRef, useEffect, useState, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import {
  createGameChannel,
  sendGameMessage,
  SESSION_CODE_LENGTH,
  CONTROLLER_HEARTBEAT_MS,
  CONTROLLER_INPUT_INTERVAL_MS,
  REMOTE_JOYSTICK_DEADZONE,
  controllerInputsEqual,
  type GameMessage,
  type ControllerInputState,
} from "@/lib/gameChannel";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useGameConfig } from "@/hooks/useGameConfig";
import { supabase } from "@/integrations/supabase/client";
import { derivePlayerDisplayName } from "@/lib/playerRegistration";
import {
  hasRegisteredForSession,
  isProfileComplete,
  loadPlayerProfile,
  markRegisteredForSession,
  savePlayerProfile,
} from "@/lib/playerProfileStorage";
import { SessionBreakCountdown } from "@/components/SessionBreakCountdown";
import { useSessionBreakCountdown } from "@/hooks/useSessionBreakCountdown";
import ShareButtons from "./ShareButtons";
import WaterLinkedLogo from "./WaterLinkedLogo";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function ScoreboardLink({ className = "" }: { className?: string }) {
  return (
    <Link
      to="/scoreboard"
      className={`inline-block rounded border border-accent/40 bg-accent/5 px-4 py-2 font-display text-[11px] tracking-[0.3em] text-accent transition-all hover:bg-accent/15 hover:shadow-[0_0_20px_rgba(78,205,196,0.2)] ${className}`}
    >
      ▣ VIEW SCOREBOARD
    </Link>
  );
}

interface RemoteControllerProps {
  sessionCode?: string;
  joinToken?: string;
}

export default function RemoteController({ sessionCode, joinToken }: RemoteControllerProps) {
  const { config } = useGameConfig();
  const [displayName, setDisplayName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [gdprConsent, setGdprConsent] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [missingSession, setMissingSession] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [maxPlaysReached, setMaxPlaysReached] = useState(false);
  const [breakEndsAt, setBreakEndsAt] = useState<number | null>(null);
  const { remainingMs: breakRemainingMs, active: breakActive } =
    useSessionBreakCountdown(breakEndsAt);

  const MAX_PLAYS = 3;

  useEffect(() => {
    if (!sessionCode || sessionCode.length !== SESSION_CODE_LENGTH || !joinToken) {
      setMissingSession(true);
    }
  }, [sessionCode, joinToken]);

  useEffect(() => {
    const profile = loadPlayerProfile();
    if (!profile) return;
    setFirstName(profile.firstName);
    setLastName(profile.lastName);
    setCompany(profile.company);
    setEmail(profile.email);
    setGdprConsent(profile.gdprConsent);
    if (isProfileComplete(profile)) {
      setDisplayName(derivePlayerDisplayName(profile.firstName, profile.lastName));
      setRegistered(true);
    }
  }, []);

  useEffect(() => {
    if (breakEndsAt !== null && !breakActive) {
      setBreakEndsAt(null);
    }
  }, [breakActive, breakEndsAt]);

  const handleRegister = useCallback(async () => {
    const fn = firstName.trim();
    const ln = lastName.trim();
    const co = company.trim();
    const em = email.trim();
    const playerDisplayName = derivePlayerDisplayName(fn, ln);
    if (fn.length < 1 || ln.length < 1) return;
    if (co.length < 1) {
      setRegisterError("Please enter your company name.");
      return;
    }
    if (!EMAIL_RE.test(em)) {
      setRegisterError("Please enter a valid email address.");
      return;
    }
    if (!gdprConsent) {
      setRegisterError("You must accept the privacy notice to continue.");
      return;
    }
    savePlayerProfile({
      firstName: fn,
      lastName: ln,
      company: co,
      email: em,
      gdprConsent: true,
    });

    setRegistering(true);
    setRegisterError(null);

    const code = sessionCode ?? "";
    if (!hasRegisteredForSession(code)) {
      const { error } = await supabase.from("player_registrations").insert({
        session_code: code,
        first_name: fn,
        last_name: ln,
        company: co,
        email: em,
        gdpr_consent: true,
      });
      if (error) {
        setRegistering(false);
        setRegisterError("Could not register. Please try again.");
        return;
      }
      markRegisteredForSession(code);
    }

    setRegistering(false);
    setDisplayName(playerDisplayName);
    setRegistered(true);
    setRejected(false);
  }, [firstName, lastName, company, email, gdprConsent, sessionCode]);

  const showingResultsRef = useRef(false);

  const handleRejected = useCallback(() => {
    setRejected(true);
    if (!breakActive && !showingResultsRef.current) {
      setRegistered(false);
    }
  }, [breakActive]);

  const handleSessionBreak = useCallback((remainingMs: number) => {
    setBreakEndsAt(Date.now() + remainingMs);
    setRejected(false);
    setRegistered(true);
  }, []);

  const handleExit = useCallback(() => {
    setRegistered(false);
    setRejected(false);
    setPlayCount(0);
    setMaxPlaysReached(false);
    setDisplayName("");
    setBreakEndsAt(null);
    setRegisterError(null);
    const profile = loadPlayerProfile();
    if (profile) {
      setFirstName(profile.firstName);
      setLastName(profile.lastName);
      setCompany(profile.company);
      setEmail(profile.email);
      setGdprConsent(profile.gdprConsent);
    }
  }, []);

  const handleGameEnded = useCallback(() => {
    setPlayCount((prev) => {
      const next = prev + 1;
      if (next >= MAX_PLAYS) setMaxPlaysReached(true);
      return next;
    });
  }, []);

  if (!config) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="animate-pulse text-primary text-sm tracking-widest">LOADING...</div>
      </div>
    );
  }

  if (missingSession) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background select-none px-6" style={{ touchAction: "none" }}>
        <div className="text-center max-w-sm">
          {config.show_logo !== false && (
            <div className="mb-4 flex justify-center">
              <WaterLinkedLogo width={180} className="drop-shadow-[0_0_20px_rgba(76,217,100,0.1)]" showSlogan={config.show_slogan !== false} />
            </div>
          )}
          <h1 className="font-display text-xl font-black tracking-wider text-primary mb-4" style={{ textShadow: "0 0 40px rgba(76,217,100,0.3)" }}>
            {config.game_name}
          </h1>
          <div className="rounded border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm tracking-wider text-destructive">
            ⚠ INVALID OR INCOMPLETE SESSION LINK
          </div>
          <p className="mt-4 text-xs text-muted-foreground font-body tracking-wider">
            Scan the QR code on the game screen. Do not share or type the link manually.
          </p>
          <div className="mt-6">
            <ScoreboardLink />
          </div>
        </div>
      </div>
    );
  }

  if (breakActive && registered) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6">
        <SessionBreakCountdown remainingMs={breakRemainingMs} className="max-w-sm w-full" />
        <p className="mt-6 text-center text-xs tracking-wider text-muted-foreground font-body max-w-xs">
          The booth is resetting for the next operator. Your details are saved — you can dive again when the timer ends.
        </p>
      </div>
    );
  }

  if (!registered) {
    return (
      <RegistrationScreen
        firstName={firstName}
        setFirstName={setFirstName}
        lastName={lastName}
        setLastName={setLastName}
        company={company}
        setCompany={setCompany}
        email={email}
        setEmail={setEmail}
        gdprConsent={gdprConsent}
        setGdprConsent={setGdprConsent}
        onRegister={handleRegister}
        registering={registering}
        registerError={registerError}
        rejected={rejected}
        sessionCode={sessionCode!}
        config={config!}
      />
    );
  }

  return (
    <ControllerPad
      playerName={displayName}
      sessionCode={sessionCode!}
      joinToken={joinToken!}
      config={config!}
      onRejected={handleRejected}
      onSessionBreak={handleSessionBreak}
      onExit={handleExit}
      onGameEnded={handleGameEnded}
      showingResultsRef={showingResultsRef}
      breakActive={breakActive}
      breakRemainingMs={breakRemainingMs}
      playCount={playCount}
      maxPlays={MAX_PLAYS}
      maxPlaysReached={maxPlaysReached}
    />
  );
}

const REG_LABEL =
  "mb-2 block text-left text-sm font-semibold tracking-wide text-foreground/90 sm:text-base";
const REG_INPUT =
  "min-h-[48px] w-full rounded-md border border-primary/40 bg-background/90 px-4 py-3 text-base text-primary font-body placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 sm:text-lg";
const REG_HINT = "mb-2 text-left text-sm leading-relaxed text-muted-foreground sm:text-base";

// ── Registration Screen ────────────────────────────────────────────
function RegistrationScreen({
  firstName,
  setFirstName,
  lastName,
  setLastName,
  company,
  setCompany,
  email,
  setEmail,
  gdprConsent,
  setGdprConsent,
  onRegister,
  registering,
  registerError,
  rejected,
  sessionCode,
  config,
}: {
  firstName: string;
  setFirstName: (v: string) => void;
  lastName: string;
  setLastName: (v: string) => void;
  company: string;
  setCompany: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  gdprConsent: boolean;
  setGdprConsent: (v: boolean) => void;
  onRegister: () => void;
  registering: boolean;
  registerError: string | null;
  rejected: boolean;
  sessionCode: string;
  config: { game_name: string; controller_header: string; controller_footer: string; title: string; show_logo?: boolean; show_slogan?: boolean; footer_text?: string; show_footer_text?: boolean };
}) {
  const emailValid = EMAIL_RE.test(email.trim());
  const canSubmit =
    firstName.trim().length >= 1 &&
    lastName.trim().length >= 1 &&
    company.trim().length >= 1 &&
    emailValid &&
    gdprConsent &&
    !registering;

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-y-auto bg-background px-4 py-6 sm:px-6 sm:py-10">
      {/* Animated sonar rings */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="absolute h-48 w-48 rounded-full border border-primary/20 animate-ping" style={{ animationDuration: "3s" }} />
        <div className="absolute h-80 w-80 rounded-full border border-primary/10 animate-ping" style={{ animationDuration: "4.5s" }} />
      </div>

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, var(--primary) 2px, var(--primary) 3px)" }}
      />

      <div className="relative z-10 w-full max-w-md text-center sm:max-w-lg">
        {config.show_logo !== false && (
          <div className="mb-4 flex justify-center">
            <WaterLinkedLogo
              width={200}
              className="h-auto w-[min(200px,70vw)] drop-shadow-[0_0_20px_rgba(76,217,100,0.1)]"
              showSlogan={config.show_slogan !== false}
            />
          </div>
        )}
        <p className="mb-1 text-xs tracking-[0.2em] text-muted-foreground font-body sm:text-sm">
          {config.controller_header}
        </p>

        {canSubmit && (
          <p className="mb-2 text-sm text-accent/90 font-body tracking-wide">
            Welcome back — your details are saved. Tap Engage to continue.
          </p>
        )}

        <h1
          className="font-display text-2xl font-black tracking-wider text-primary mb-1 sm:text-3xl"
          style={{ textShadow: "0 0 40px rgba(76,217,100,0.3)" }}
        >
          {config.game_name}
        </h1>
        <p className="font-display text-sm tracking-[0.3em] text-muted-foreground mb-4 sm:text-base">
          FIELD CONTROLLER
        </p>

        <div className="mb-6 inline-block rounded border border-primary/40 bg-primary/10 px-4 py-2">
          <span className="text-xs tracking-widest text-muted-foreground font-body sm:text-sm">SESSION </span>
          <span className="font-display text-xl tracking-[0.35em] text-primary sm:text-2xl">{sessionCode}</span>
        </div>

        {/* Registration card */}
        <div
          className="relative rounded-lg border border-border bg-card/80 p-5 text-left backdrop-blur-sm sm:p-6"
          role="form"
          aria-label="Operator registration"
        >
          <div className="absolute top-0 left-0 w-3 h-3 border-l-2 border-t-2 border-primary" />
          <div className="absolute top-0 right-0 w-3 h-3 border-r-2 border-t-2 border-primary" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-l-2 border-b-2 border-primary" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-r-2 border-b-2 border-primary" />

          <h2 className="mb-5 text-center font-display text-sm font-bold tracking-[0.25em] text-primary sm:text-base">
            OPERATOR REGISTRATION
          </h2>

          {rejected && (
            <div
              className="mb-4 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm leading-snug text-destructive sm:text-base"
              role="alert"
            >
              Session in progress — another operator is active. Please wait.
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
            <div>
              <label htmlFor="reg-first-name" className={REG_LABEL}>
                First name
              </label>
              <input
                id="reg-first-name"
                type="text"
                name="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value.slice(0, 80))}
                placeholder="Jane"
                autoComplete="given-name"
                autoFocus
                className={REG_INPUT}
              />
            </div>
            <div>
              <label htmlFor="reg-last-name" className={REG_LABEL}>
                Last name
              </label>
              <input
                id="reg-last-name"
                type="text"
                name="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value.slice(0, 80))}
                placeholder="Doe"
                autoComplete="family-name"
                className={REG_INPUT}
              />
            </div>
          </div>

          <div className="mt-4 sm:mt-5">
            <label htmlFor="reg-company" className={REG_LABEL}>
              Company
            </label>
            <input
              id="reg-company"
              type="text"
              name="organization"
              value={company}
              onChange={(e) => setCompany(e.target.value.slice(0, 120))}
              placeholder="Your organization"
              autoComplete="organization"
              className={REG_INPUT}
            />
          </div>

          <div className="mt-4 sm:mt-5">
            <label htmlFor="reg-email" className={REG_LABEL}>
              Email address
            </label>
            <p id="reg-email-hint" className={REG_HINT}>
              Use your work email — it will be used to send winner notifications.
            </p>
            <input
              id="reg-email"
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.slice(0, 255))}
              placeholder="you@company.com"
              inputMode="email"
              autoComplete="email"
              aria-describedby="reg-email-hint"
              className={REG_INPUT}
            />
          </div>

          <label htmlFor="reg-gdpr" className="mt-5 flex cursor-pointer items-start gap-3 sm:mt-6">
            <input
              id="reg-gdpr"
              type="checkbox"
              checked={gdprConsent}
              onChange={(e) => setGdprConsent(e.target.checked)}
              className="mt-1 h-6 w-6 shrink-0 cursor-pointer accent-primary"
            />
            <span className="text-sm leading-relaxed text-foreground/85 sm:text-base">
              I agree that Water Linked may store my contact details and contact me about
              products and events, in accordance with the GDPR.
            </span>
          </label>

          {registerError && (
            <div
              id="reg-error"
              className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive sm:text-base"
              role="alert"
            >
              {registerError}
            </div>
          )}

          <button
            type="button"
            onClick={onRegister}
            disabled={!canSubmit}
            aria-describedby={registerError ? "reg-error" : undefined}
            className="mt-5 min-h-[52px] w-full rounded-md border border-primary bg-primary/10 px-6 py-4 font-display text-lg tracking-[0.2em] text-primary transition-all hover:bg-primary/20 active:bg-primary/30 hover:shadow-[0_0_40px_rgba(76,217,100,0.25)] focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40 sm:mt-6 sm:text-xl"
          >
            {registering ? "Registering…" : "Engage"}
          </button>

        </div>

        <div className="mt-5">
          <ScoreboardLink />
        </div>

        {/* Footer text removed — global "Powered by LogiqApps AS" footer renders site-wide. */}
      </div>
    </div>
  );
}

// ── Controller Pad ─────────────────────────────────────────────────
function ControllerPad({
  playerName,
  sessionCode,
  joinToken,
  config,
  onRejected,
  onSessionBreak,
  onExit,
  onGameEnded,
  showingResultsRef,
  playCount,
  maxPlays,
  maxPlaysReached,
  breakActive,
  breakRemainingMs,
}: {
  playerName: string;
  sessionCode: string;
  joinToken: string;
  config: { game_name: string; controller_header: string; controller_footer: string; show_share_buttons?: boolean; footer_text?: string; show_footer_text?: boolean };
  onRejected: () => void;
  onSessionBreak: (remainingMs: number) => void;
  onExit: () => void;
  onGameEnded: () => void;
  showingResultsRef: React.MutableRefObject<boolean>;
  playCount: number;
  maxPlays: number;
  maxPlaysReached: boolean;
  breakActive: boolean;
  breakRemainingMs: number;
}) {
  const joystickRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [connected, setConnected] = useState(false);
  const [linkExpired, setLinkExpired] = useState(false);
  const [gameOver, setGameOver] = useState<{ score: number; depth: number; wave: number } | null>(null);
  const [joyPos, setJoyPos] = useState({ x: 0, y: 0 });
  const [fireActive, setFireActive] = useState(false);
  const [sonarActive, setSonarActive] = useState(false);
  const touchIdRef = useRef<number | null>(null);
  const inputRef = useRef<ControllerInputState>({
    joystickX: 0,
    joystickY: 0,
    thrust: false,
    fire: false,
    sonar: false,
    restart: false,
  });
  const lastSentInputRef = useRef<ControllerInputState>({ ...inputRef.current });
  const lastSendTimeRef = useRef(0);

  const notifyPlayerLeft = useCallback(() => {
    if (channelRef.current) {
      sendGameMessage(channelRef.current, { type: "player_left", playerName, joinToken });
    }
  }, [playerName, joinToken]);

  // Connect Supabase Realtime
  useEffect(() => {
    const connectTimeout = setTimeout(() => {
      setLinkExpired(true);
    }, 8000);

    const handleMessage = (msg: GameMessage) => {
      if (msg.type === "game_ack") {
        clearTimeout(connectTimeout);
        setConnected(true);
        setLinkExpired(false);
        setGameOver(null);
        showingResultsRef.current = false;
      }
      if (msg.type === "session_break") {
        onSessionBreak(msg.remainingMs);
      }
      if (msg.type === "session_busy" || msg.type === "session_ended") {
        onRejected();
      }
      if (msg.type === "game_over") {
        const results = { score: msg.score, depth: msg.depth, wave: msg.wave };
        setGameOver(results);
        showingResultsRef.current = true;
        onGameEnded();
      }
    };

    const channel = createGameChannel(sessionCode, handleMessage);
    channelRef.current = channel;

    // Announce player
    const announceTimer = setTimeout(() => {
      sendGameMessage(channel, { type: "player_joined", playerName, joinToken });
    }, 500);

    // Send on input change or periodic heartbeat (so TV can detect link loss)
    const interval = setInterval(() => {
      const input = inputRef.current;
      const now = Date.now();
      const changed = !controllerInputsEqual(input, lastSentInputRef.current);
      const heartbeatDue = now - lastSendTimeRef.current >= CONTROLLER_HEARTBEAT_MS;
      if (!changed && !heartbeatDue) return;

      sendGameMessage(channel, {
        type: "controller_input",
        joinToken,
        ...input,
        playerName,
      });
      lastSentInputRef.current = { ...input };
      lastSendTimeRef.current = now;
    }, CONTROLLER_INPUT_INTERVAL_MS);

    return () => {
      clearTimeout(announceTimer);
      clearTimeout(connectTimeout);
      clearInterval(interval);
      sendGameMessage(channel, { type: "player_left", playerName, joinToken });
      channel.unsubscribe();
    };
  }, [playerName, sessionCode, joinToken, onRejected, onSessionBreak, onGameEnded, showingResultsRef]);

  // Best-effort leave when the phone tab/app closes or is backgrounded
  useEffect(() => {
    const onPageHide = () => notifyPlayerLeft();
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onPageHide);
    };
  }, [notifyPlayerLeft]);

  useEffect(() => {
    let hiddenTimer: ReturnType<typeof setTimeout> | null = null;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenTimer = setTimeout(() => {
          notifyPlayerLeft();
          if (!showingResultsRef.current) onExit();
        }, 3000);
      } else if (hiddenTimer) {
        clearTimeout(hiddenTimer);
        hiddenTimer = null;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      if (hiddenTimer) clearTimeout(hiddenTimer);
    };
  }, [notifyPlayerLeft, onExit, showingResultsRef]);

  useEffect(() => {
    if (connected) setLinkExpired(false);
  }, [connected]);

  // Joystick touch handling
  const handleJoystickTouch = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const el = joystickRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxR = rect.width / 2;

    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i];
      const dx = t.clientX - centerX;
      const dy = t.clientY - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (touchIdRef.current === null || touchIdRef.current === t.identifier) {
        touchIdRef.current = t.identifier;
        const clampedDist = Math.min(dist, maxR);
        const norm = clampedDist / maxR;
        const angle = Math.atan2(dy, dx);
        const nx = norm > REMOTE_JOYSTICK_DEADZONE ? (Math.cos(angle) * norm) : 0;
        const ny = norm > REMOTE_JOYSTICK_DEADZONE ? (Math.sin(angle) * norm) : 0;

        setJoyPos({ x: nx * 40, y: ny * 40 });
        inputRef.current.joystickX = nx;
        inputRef.current.joystickY = ny;
        inputRef.current.thrust = norm > 0.3;

        if (navigator.vibrate && clampedDist / maxR > 0.8) {
          navigator.vibrate(5);
        }
        break;
      }
    }
  }, []);

  const handleJoystickEnd = useCallback(() => {
    touchIdRef.current = null;
    setJoyPos({ x: 0, y: 0 });
    inputRef.current.joystickX = 0;
    inputRef.current.joystickY = 0;
    inputRef.current.thrust = false;
  }, []);

  const handleFireStart = useCallback(() => {
    setFireActive(true);
    inputRef.current.fire = true;
    if (navigator.vibrate) navigator.vibrate(15);
  }, []);
  const handleFireEnd = useCallback(() => {
    setFireActive(false);
    inputRef.current.fire = false;
  }, []);

  const handleSonarStart = useCallback(() => {
    setSonarActive(true);
    inputRef.current.sonar = true;
    if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
  }, []);
  const handleSonarEnd = useCallback(() => {
    setSonarActive(false);
    inputRef.current.sonar = false;
  }, []);

  const handleRestart = useCallback(() => {
    if (maxPlaysReached || breakActive) return;
    inputRef.current.restart = true;
    setGameOver(null);
    showingResultsRef.current = false;
    setTimeout(() => { inputRef.current.restart = false; }, 200);
  }, [maxPlaysReached, breakActive, showingResultsRef]);

  const handleExitClick = useCallback(() => {
    notifyPlayerLeft();
    onExit();
  }, [onExit, notifyPlayerLeft]);

  const handleEndSession = useCallback(() => {
    notifyPlayerLeft();
  }, [notifyPlayerLeft]);

  const playsRemaining = Math.max(0, maxPlays - playCount);

  return (
    <div
      className="flex min-h-dvh flex-col bg-background select-none overflow-hidden"
      style={{ touchAction: "none" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-2 h-2 rounded-full shrink-0 ${connected ? "bg-primary animate-pulse" : "bg-destructive"}`} />
          <span className="text-xs font-body tracking-wider text-muted-foreground truncate">
            {connected ? "LINKED" : "..."}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] tracking-wider text-accent font-body truncate max-w-[80px]">{playerName}</span>
          <div className="rounded border border-primary/30 bg-primary/10 px-2 py-0.5">
            <span className="font-display text-xs tracking-[0.3em] text-primary">{sessionCode}</span>
          </div>
          <span className="text-[9px] tracking-wider text-muted-foreground font-body">
            {playCount}/{maxPlays}
          </span>
          {!gameOver && (
            <button
              onClick={handleExitClick}
              className="rounded border border-destructive/40 bg-destructive/10 px-2.5 py-1 font-display text-[10px] tracking-[0.2em] text-destructive transition-all hover:bg-destructive/20 active:bg-destructive/30"
            >
              EXIT
            </button>
          )}
        </div>
      </div>

      {linkExpired && !connected && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/95 px-6">
          <div className="text-sm font-display tracking-wider text-destructive mb-2">LINK EXPIRED</div>
          <p className="text-xs text-muted-foreground text-center tracking-wider mb-4">
            Scan the QR code again on the game screen for a fresh link.
          </p>
          <button
            onClick={handleExitClick}
            className="rounded border border-primary bg-primary/10 px-6 py-2 font-display text-xs tracking-[0.2em] text-primary"
          >
            BACK
          </button>
        </div>
      )}

      {breakActive && !gameOver && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/95 px-6">
          <SessionBreakCountdown remainingMs={breakRemainingMs} className="max-w-sm w-full" />
        </div>
      )}

      {/* Game Over overlay on controller */}
      {gameOver && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/90 px-6 overflow-y-auto">
          <div className="text-2xl font-display font-black text-destructive tracking-wider mb-2" style={{ textShadow: "0 0 20px rgba(239,68,68,0.3)" }}>
            HULL BREACH
          </div>
          <div className="text-sm font-body text-muted-foreground tracking-wider mb-4">
            SCORE: <span className="text-primary">{gameOver.score}</span> ── DEPTH: <span className="text-accent">{gameOver.depth}m</span> ── WAVE: <span className="text-muted-foreground">{gameOver.wave}</span>
          </div>
          {maxPlaysReached ? (
            <div className="text-center">
              <div className="text-sm font-display tracking-[0.2em] text-accent mb-2">
                ── MISSION LIMIT REACHED ──
              </div>
              <div className="text-xs text-muted-foreground tracking-wider mb-4">
                You've completed {maxPlays} dives. Thanks for playing!
              </div>
              <button
                onClick={handleEndSession}
                className="rounded border border-primary/40 bg-primary/5 px-6 py-2 font-display text-xs tracking-[0.25em] text-primary transition-all hover:bg-primary/15"
              >
                RELEASE BOOTH
              </button>
            </div>
          ) : (
            <>
              <div className="text-[10px] text-muted-foreground tracking-wider mb-3">
                {playsRemaining} {playsRemaining === 1 ? "dive" : "dives"} remaining
              </div>
              <button
                onClick={handleRestart}
                className="rounded border border-primary bg-primary/10 px-8 py-3 font-display text-base tracking-[0.3em] text-primary transition-all hover:bg-primary/20 active:bg-primary/30"
              >
                RESURFACE
              </button>
            </>
          )}
          <ScoreboardLink className="mt-4" />
          {config.show_share_buttons !== false && <ShareButtons score={gameOver.score} depth={gameOver.depth} wave={gameOver.wave} gameName={config.game_name} />}
        </div>
      )}

      {/* Main controller area */}
      <div className="flex flex-1 items-end justify-between px-4 sm:px-8 md:px-16 lg:px-24 py-4 pb-10 sm:pb-14">
        {/* Left: Joystick */}
        <div className="flex flex-col items-center gap-2">
          <div
            ref={joystickRef}
            className="relative w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52 lg:w-60 lg:h-60 rounded-full border-2 border-primary/30 bg-secondary/20"
            onTouchStart={handleJoystickTouch}
            onTouchMove={handleJoystickTouch}
            onTouchEnd={handleJoystickEnd}
            onTouchCancel={handleJoystickEnd}
          >
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="absolute w-full h-px bg-primary/10" />
              <div className="absolute w-px h-full bg-primary/10" />
            </div>
            <div className="absolute inset-2 rounded-full border border-primary/10 pointer-events-none" />
            <div
              className="absolute w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full border-2 transition-colors duration-100 pointer-events-none"
              style={{
                left: `calc(50% - 1.5rem + ${joyPos.x}px)`,
                top: `calc(50% - 1.5rem + ${joyPos.y}px)`,
                backgroundColor: inputRef.current.thrust
                  ? "rgba(76, 217, 100, 0.4)"
                  : "rgba(76, 217, 100, 0.15)",
                borderColor: "rgba(76, 217, 100, 0.6)",
                boxShadow: inputRef.current.thrust
                  ? "0 0 20px rgba(76, 217, 100, 0.3)"
                  : "none",
              }}
            />
          </div>
          <span className="text-[10px] sm:text-xs tracking-widest text-muted-foreground font-body">NAVIGATE</span>
        </div>

        {/* Right: Action buttons */}
        <div className="flex flex-col items-center gap-4 sm:gap-5 md:gap-6">
          <button
            className="relative w-18 h-18 sm:w-22 sm:h-22 md:w-24 md:h-24 lg:w-28 lg:h-28 rounded-full border-2 transition-all duration-100 flex items-center justify-center"
            style={{
              width: "clamp(6rem, 11vw, 9rem)",
              height: "clamp(6rem, 11vw, 9rem)",
              borderColor: sonarActive ? "rgba(78, 205, 196, 1)" : "rgba(78, 205, 196, 0.4)",
              backgroundColor: sonarActive ? "rgba(78, 205, 196, 0.3)" : "rgba(78, 205, 196, 0.05)",
              boxShadow: sonarActive ? "0 0 30px rgba(78, 205, 196, 0.4)" : "none",
            }}
            onTouchStart={handleSonarStart}
            onTouchEnd={handleSonarEnd}
            onTouchCancel={handleSonarEnd}
          >
            <div className="flex flex-col items-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mb-1">
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" className="text-accent" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-accent" />
                <path d="M12 5a7 7 0 0 1 7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-accent" />
              </svg>
              <span className="text-[9px] sm:text-[10px] tracking-widest font-body text-accent">SONAR</span>
            </div>
          </button>

          <button
            className="relative rounded-full border-2 transition-all duration-100 flex items-center justify-center"
            style={{
              width: "clamp(6rem, 11vw, 9rem)",
              height: "clamp(6rem, 11vw, 9rem)",
              borderColor: fireActive ? "rgba(76, 217, 100, 1)" : "rgba(76, 217, 100, 0.4)",
              backgroundColor: fireActive ? "rgba(76, 217, 100, 0.3)" : "rgba(76, 217, 100, 0.05)",
              boxShadow: fireActive ? "0 0 30px rgba(76, 217, 100, 0.4)" : "none",
            }}
            onTouchStart={handleFireStart}
            onTouchEnd={handleFireEnd}
            onTouchCancel={handleFireEnd}
          >
            <div className="flex flex-col items-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mb-1">
                <path d="M12 2L15 8H9L12 2Z" fill="currentColor" className="text-primary" />
                <rect x="10" y="8" width="4" height="12" rx="1" fill="currentColor" className="text-primary" />
              </svg>
              <span className="text-[9px] sm:text-[10px] tracking-widest font-body text-primary">TORPEDO</span>
            </div>
          </button>

          <button
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-muted-foreground/30 flex items-center justify-center active:bg-muted/30"
            onTouchStart={handleRestart}
          >
            <span className="text-[8px] sm:text-[9px] tracking-wider font-body text-muted-foreground">RST</span>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border text-center">
        <span className="text-[9px] tracking-widest text-muted-foreground/50 font-body">
          {config.controller_footer}
        </span>
      </div>
    </div>
  );
}
