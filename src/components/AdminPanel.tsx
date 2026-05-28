import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import WaterLinkedLogo from "./WaterLinkedLogo";
import { supabase } from "@/integrations/supabase/client";
import {
  useGameConfig,
  invalidateGameConfig,
  type GameConfig,
  type GameplaySettings,
  DEFAULT_GAMEPLAY_SETTINGS,
} from "@/hooks/useGameConfig";
import {
  SESSION_BREAK_MINUTE_OPTIONS,
  formatSessionBreakMinutes,
  type SessionBreakMinutes,
} from "@/lib/sessionBreak";
import {
  verifyAdminAccess,
  updateGameConfig,
  resetSessions,
  resetScores,
  killSession,
} from "@/lib/adminServer";
import { getAdminSession, signInAdmin, signOutAdmin } from "@/lib/admin-auth";
import {
  LayoutDashboard,
  Palette,
  BarChart3,
  Gamepad2,
  Trophy,
  Menu,
  X,
  RefreshCw,
  LogOut,
  ToggleRight,
  Trash2,
  Crosshair,
  Octagon,
  Contact,
} from "lucide-react";
import LeadsSection from "@/components/admin/LeadsSection";

interface GameSession {
  id: string;
  session_code: string;
  player_name: string | null;
  status: string;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
}

interface GameScore {
  id: string;
  session_code: string;
  player_name: string;
  score: number;
  depth: number;
  wave: number;
  created_at: string;
}

type Section =
  | "overview"
  | "branding"
  | "toggles"
  | "gameplay"
  | "umami"
  | "sessions"
  | "scores"
  | "leads";

const NAV_ITEMS: { id: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "branding", label: "Branding", icon: Palette },
  { id: "toggles", label: "Feature Toggles", icon: ToggleRight },
  { id: "gameplay", label: "Gameplay Tuning", icon: Crosshair },
  { id: "umami", label: "Umami Analytics", icon: BarChart3 },
  { id: "sessions", label: "Sessions", icon: Gamepad2 },
  { id: "scores", label: "Scoreboard", icon: Trophy },
  { id: "leads", label: "Leads", icon: Contact },
];

export default function AdminPanel() {
  const [authenticated, setAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [scores, setScores] = useState<GameScore[]>([]);
  const [activeSection, setActiveSection] = useState<Section>("overview");
  const [loading, setLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const queryClient = useQueryClient();
  const { config, loading: configLoading } = useGameConfig();

  const confirmAdminSession = useCallback(async () => {
    const result = await verifyAdminAccess();
    setAuthenticated(true);
    setAdminEmail(result.email);
    setAuthError(null);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const session = await getAdminSession();
        if (!session) return;
        await confirmAdminSession();
      } catch {
        await signOutAdmin();
      } finally {
        if (mounted) setAuthChecking(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [confirmAdminSession]);

  const handleSignIn = useCallback(async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      await signInAdmin(email, password);
      await confirmAdminSession();
      setPassword("");
    } catch (err: unknown) {
      await signOutAdmin();
      const message =
        err instanceof Error ? err.message : "Sign in failed";
      setAuthError(
        message.includes("Invalid login")
          ? "Invalid email or password."
          : message.includes("Forbidden")
            ? "This account is not authorized for admin access."
            : message
      );
    } finally {
      setSigningIn(false);
    }
  }, [email, password, confirmAdminSession]);

  const handleSignOut = useCallback(async () => {
    await signOutAdmin();
    setAuthenticated(false);
    setAdminEmail(null);
    setEmail("");
    setPassword("");
  }, []);

  const handleConfigUpdate = useCallback(
    async (updates: Partial<Omit<GameConfig, "id">>) => {
      try {
        await updateGameConfig({
          data: { updates },
        });
        await invalidateGameConfig(queryClient);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Save failed";
        throw new Error(message);
      }
    },
    [queryClient]
  );

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("game_sessions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setSessions((data as GameSession[]) || []);
    setLoading(false);
  }, []);

  const fetchScores = useCallback(async (sessionCode?: string) => {
    setLoading(true);
    let query = supabase
      .from("game_scores")
      .select("*")
      .order("score", { ascending: false })
      .limit(100);
    if (sessionCode) {
      query = query.eq("session_code", sessionCode);
    }
    const { data } = await query;
    setScores((data as GameScore[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    fetchSessions();
    fetchScores();
  }, [authenticated, fetchSessions, fetchScores]);

  // Sessions are not on supabase_realtime publication (PII/isolation); poll instead.
  useEffect(() => {
    if (!authenticated) return;
    const id = setInterval(() => fetchSessions(), 15000);
    return () => clearInterval(id);
  }, [authenticated, fetchSessions]);

  useEffect(() => {
    if (!authenticated) return;
    const channel = supabase
      .channel("admin_updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "game_scores" }, () =>
        fetchScores(selectedSession || undefined)
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [authenticated, fetchScores, selectedSession]);

  if (authChecking) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-100" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <p className="text-sm text-gray-500">Checking session…</p>
      </div>
    );
  }

  // ── Login screen ──────────────────────────────────────────────────
  if (!authenticated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-100" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-lg">
          <div className="flex justify-center mb-4 bg-gray-900 rounded-lg px-4 py-3">
            <WaterLinkedLogo width={160} />
          </div>
          <div className="flex items-center gap-2 mb-1">
            <LayoutDashboard className="w-5 h-5 text-gray-700" />
            <h1 className="text-xl font-semibold text-gray-900">Admin Panel</h1>
          </div>
          <p className="text-sm text-gray-500 mb-6">Sign in with your operator account.</p>

          {authError && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {authError}
            </div>
          )}

          <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="operator@company.com"
            autoComplete="email"
            autoFocus
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />

          <label className="block text-sm font-medium text-gray-700 mb-1.5 mt-4">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            onKeyDown={(e) => { if (e.key === "Enter" && !signingIn) void handleSignIn(); }}
          />

          <button
            onClick={() => void handleSignIn()}
            disabled={signingIn || !email.trim() || !password}
            className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
          >
            {signingIn ? "Signing in…" : "Sign In"}
          </button>
        </div>
      </div>
    );
  }

  // ── Main admin layout ─────────────────────────────────────────────
  const activeSessions = sessions.filter(s => s.status === "playing");
  const totalGames = sessions.filter(s => s.status === "ended").length;
  const topScore = scores.length > 0 ? scores[0] : null;

  const navigateTo = (section: Section) => {
    setActiveSection(section);
    setSidebarOpen(false);
    if (section === "scores") {
      setSelectedSession(null);
      fetchScores();
    }
  };

  return (
    <div className="min-h-dvh bg-gray-100 flex" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col
        transform transition-transform duration-200 ease-in-out
        lg:translate-x-0 lg:static lg:z-auto
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        {/* Sidebar header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-gray-200 shrink-0 bg-gray-900">
          <div className="flex items-center gap-2 min-w-0">
            <WaterLinkedLogo width={120} />
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 rounded hover:bg-gray-800">
            <X className="w-4 h-4 text-gray-300" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => navigateTo(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <item.icon className={`w-4 h-4 shrink-0 ${active ? "text-indigo-600" : "text-gray-400"}`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="p-3 border-t border-gray-200 shrink-0 space-y-1">
          {adminEmail && (
            <p className="px-3 text-xs text-gray-400 truncate" title={adminEmail}>
              {adminEmail}
            </p>
          )}
          <button
            onClick={() => void handleSignOut()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-gray-200 px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100">
              <Menu className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="text-sm font-semibold text-gray-900">
              {NAV_ITEMS.find(i => i.id === activeSection)?.label ?? "Overview"}
            </h1>
          </div>
          <button
            onClick={() => { fetchSessions(); fetchScores(selectedSession || undefined); }}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {loading && <div className="text-center py-16 text-sm text-gray-400">Loading...</div>}

          {!loading && activeSection === "overview" && (
            <OverviewSection
              activeSessions={activeSessions.length}
              totalGames={totalGames}
              topScore={topScore}
              totalPlayers={new Set(scores.map(s => s.player_name)).size}
            />
          )}

          {!loading && activeSection === "branding" && config && (
            <BrandingEditor config={config} onSave={handleConfigUpdate} />
          )}

          {!loading && activeSection === "toggles" && config && (
            <FeatureToggles config={config} onSave={handleConfigUpdate} />
          )}

          {!loading && activeSection === "umami" && config && (
            <UmamiEditor config={config} onSave={handleConfigUpdate} />
          )}

          {!loading && activeSection === "gameplay" && config && (
            <GameplayEditor config={config} onSave={handleConfigUpdate} />
          )}

          {!loading && activeSection === "sessions" && (
            <SessionsTable
              sessions={sessions}
              onViewScores={(code) => {
                setActiveSection("scores");
                setSelectedSession(code);
                fetchScores(code);
              }}
              onKillSession={async (sessionId) => {
                await killSession({ data: { sessionId } });
                fetchSessions();
              }}
              onClearAll={async () => {
                await resetSessions();
                fetchSessions();
              }}
            />
          )}

          {!loading && activeSection === "scores" && (
            <ScoresTable
              scores={scores}
              selectedSession={selectedSession}
              onClearFilter={() => { setSelectedSession(null); fetchScores(); }}
              onClearAll={async () => {
                await resetScores();
                fetchScores();
              }}
            />
          )}

          {activeSection === "leads" && <LeadsSection />}
        </main>
      </div>
    </div>
  );
}

// ── Overview ────────────────────────────────────────────────────────
function OverviewSection({ activeSessions, totalGames, topScore, totalPlayers }: {
  activeSessions: number;
  totalGames: number;
  topScore: { score: number; player_name: string } | null;
  totalPlayers: number;
}) {
  const cards = [
    { label: "Active Now", value: activeSessions, accent: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Total Games", value: totalGames, accent: "text-gray-900", bg: "bg-gray-50" },
    { label: "Top Score", value: topScore?.score?.toLocaleString() ?? "—", accent: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "Unique Players", value: totalPlayers, accent: "text-amber-600", bg: "bg-amber-50" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.label} className={`rounded-xl ${c.bg} p-4 sm:p-5`}>
            <div className="text-xs font-medium text-gray-500 mb-1">{c.label}</div>
            <div className={`text-2xl sm:text-3xl font-bold ${c.accent} truncate`}>{c.value}</div>
          </div>
        ))}
      </div>
      {topScore && (
        <div className="rounded-xl bg-white border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Current Leader</h3>
          <p className="text-sm text-gray-500">
            <span className="font-medium text-gray-900">{topScore.player_name}</span> with{" "}
            <span className="font-semibold text-indigo-600">{topScore.score.toLocaleString()}</span> points
          </p>
        </div>
      )}
    </div>
  );
}

// ── Status Badge ────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    playing: "bg-emerald-50 text-emerald-700 border-emerald-200",
    ended: "bg-gray-100 text-gray-500 border-gray-200",
    waiting: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[status] || styles.waiting}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ── Sessions Table ──────────────────────────────────────────────────
function SessionsTable({ sessions, onViewScores, onKillSession, onClearAll }: {
  sessions: GameSession[];
  onViewScores: (code: string) => void;
  onKillSession: (sessionId: string) => Promise<void>;
  onClearAll: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [killingId, setKillingId] = useState<string | null>(null);
  const [confirmKillId, setConfirmKillId] = useState<string | null>(null);
  const [killError, setKillError] = useState<string | null>(null);

  const handleKill = async (sessionId: string) => {
    setKillingId(sessionId);
    setKillError(null);
    try {
      await onKillSession(sessionId);
      setConfirmKillId(null);
    } catch (err: unknown) {
      setKillError(err instanceof Error ? err.message : "Could not end session");
    } finally {
      setKillingId(null);
    }
  };

  const handleClear = async () => {
    setClearing(true);
    try { await onClearAll(); } finally { setClearing(false); setConfirming(false); }
  };

  return (
    <div>
      {killError && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {killError}
        </div>
      )}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">{sessions.length} session(s)</span>
        {sessions.length > 0 && !confirming && (
          <button onClick={() => setConfirming(true)} className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> Clear All
          </button>
        )}
        {confirming && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-600">Delete all sessions?</span>
            <button onClick={handleClear} disabled={clearing} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700 disabled:opacity-50">
              {clearing ? "Clearing..." : "Confirm"}
            </button>
            <button onClick={() => setConfirming(false)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">Cancel</button>
          </div>
        )}
      </div>
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden overflow-x-auto">
        <table className="w-full text-left min-w-[520px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="px-4 py-3 text-xs font-medium text-gray-500">Code</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500">Player</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500">Status</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500">Created</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3 text-sm font-mono font-semibold text-gray-900">{s.session_code}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{s.player_name || "—"}</td>
                <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                <td className="px-4 py-3 text-sm text-gray-500">{new Date(s.created_at).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {s.status === "playing" && (
                      confirmKillId === s.id ? (
                        <>
                          <span className="text-xs text-amber-700">End this session?</span>
                          <button
                            onClick={() => void handleKill(s.id)}
                            disabled={killingId === s.id}
                            className="rounded-lg bg-amber-600 px-2.5 py-1 text-xs text-white hover:bg-amber-700 disabled:opacity-50"
                          >
                            {killingId === s.id ? "Ending…" : "Confirm"}
                          </button>
                          <button
                            onClick={() => setConfirmKillId(null)}
                            className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setConfirmKillId(s.id)}
                          className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-900"
                          title="Release a stuck booth without deleting history"
                        >
                          <Octagon className="w-3.5 h-3.5" />
                          End session
                        </button>
                      )
                    )}
                    <button
                      onClick={() => onViewScores(s.session_code)}
                      className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      View scores
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {sessions.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">No sessions recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Scores Table ────────────────────────────────────────────────────
function ScoresTable({ scores, selectedSession, onClearFilter, onClearAll }: {
  scores: GameScore[];
  selectedSession: string | null;
  onClearFilter: () => void;
  onClearAll: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handleClear = async () => {
    setClearing(true);
    try { await onClearAll(); } finally { setClearing(false); setConfirming(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm">
          {selectedSession ? (
            <>
              <span className="text-gray-500">Filtered by session:</span>
              <span className="font-mono font-semibold text-gray-900">{selectedSession}</span>
              <button onClick={onClearFilter} className="ml-1 text-red-500 hover:text-red-700 text-xs">✕ Clear</button>
            </>
          ) : (
            <span className="text-gray-500">{scores.length} score(s)</span>
          )}
        </div>
        {scores.length > 0 && !confirming && (
          <button onClick={() => setConfirming(true)} className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors">
            <Trash2 className="w-3.5 h-3.5" /> Clear All
          </button>
        )}
        {confirming && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-600">Delete all scores?</span>
            <button onClick={handleClear} disabled={clearing} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700 disabled:opacity-50">
              {clearing ? "Clearing..." : "Confirm"}
            </button>
            <button onClick={() => setConfirming(false)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">Cancel</button>
          </div>
        )}
      </div>
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden overflow-x-auto">
        <table className="w-full text-left min-w-[620px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              <th className="px-4 py-3 text-xs font-medium text-gray-500 w-12">#</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500">Player</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500">Score</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500">Depth</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500">Wave</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500">Session</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500">Date</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((s, i) => (
              <tr key={s.id} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${i < 3 ? "bg-amber-50/30" : ""}`}>
                <td className="px-4 py-3 text-sm font-medium text-gray-400">{i + 1}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.player_name}</td>
                <td className="px-4 py-3 text-sm font-semibold text-indigo-600">{s.score.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{s.depth}m</td>
                <td className="px-4 py-3 text-sm text-gray-500">{s.wave}</td>
                <td className="px-4 py-3 text-sm font-mono text-gray-500">{s.session_code}</td>
                <td className="px-4 py-3 text-sm text-gray-400">{new Date(s.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {scores.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">No scores recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Branding Editor ─────────────────────────────────────────────────
function BrandingEditor({ config, onSave }: { config: GameConfig; onSave: (updates: Partial<Omit<GameConfig, "id">>) => Promise<void> }) {
  const [form, setForm] = useState({
    game_name: config.game_name,
    title: config.title,
    subtitle: config.subtitle,
    mission_description: config.mission_description,
    controller_header: config.controller_header,
    controller_footer: config.controller_footer,
    footer_text: config.footer_text,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm({
      game_name: config.game_name,
      title: config.title,
      subtitle: config.subtitle,
      mission_description: config.mission_description,
      controller_header: config.controller_header,
      controller_footer: config.controller_footer,
      footer_text: config.footer_text,
    });
  }, [config]);

  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Branding</h2>
        <p className="text-sm text-gray-500 mt-0.5">Customize text shown on the game screen and phone controller. Preview updates live below.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left column — form fields */}
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Game Screen</h3>
            <div>
              <label className={labelClass}>Game Name <span className="text-gray-400 font-normal">(main logo)</span></label>
              <input type="text" value={form.game_name} onChange={(e) => setForm(f => ({ ...f, game_name: e.target.value }))} className={inputClass} maxLength={30} />
            </div>
            <div>
              <label className={labelClass}>Title <span className="text-gray-400 font-normal">(below logo)</span></label>
              <input type="text" value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} className={inputClass} maxLength={50} />
            </div>
            <div>
              <label className={labelClass}>Subtitle <span className="text-gray-400 font-normal">(above logo)</span></label>
              <input type="text" value={form.subtitle} onChange={(e) => setForm(f => ({ ...f, subtitle: e.target.value }))} className={inputClass} maxLength={80} />
            </div>
            <div>
              <label className={labelClass}>Mission Description</label>
              <textarea value={form.mission_description} onChange={(e) => setForm(f => ({ ...f, mission_description: e.target.value }))} className={`${inputClass} min-h-[100px] resize-y`} maxLength={500} />
            </div>
            <div>
              <label className={labelClass}>Footer Text <span className="text-gray-400 font-normal">(bottom of waiting screen)</span></label>
              <input type="text" value={form.footer_text} onChange={(e) => setForm(f => ({ ...f, footer_text: e.target.value }))} className={inputClass} maxLength={100} />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Phone Controller</h3>
            <div>
              <label className={labelClass}>Header Text</label>
              <input type="text" value={form.controller_header} onChange={(e) => setForm(f => ({ ...f, controller_header: e.target.value }))} className={inputClass} maxLength={80} />
            </div>
            <div>
              <label className={labelClass}>Footer Text</label>
              <input type="text" value={form.controller_footer} onChange={(e) => setForm(f => ({ ...f, controller_footer: e.target.value }))} className={inputClass} maxLength={80} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={saving} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {saving ? "Saving..." : "Save Changes"}
            </button>
            {saved && <span className="text-sm text-emerald-600 font-medium">✓ Saved</span>}
            {error && <span className="text-sm text-red-600 font-medium">⚠ {error}</span>}
          </div>
        </div>

        {/* Right column — live preview */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Live Preview</h3>

          {/* Game screen preview */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
              </div>
              <span className="text-[10px] text-gray-400 font-mono">Game Screen</span>
            </div>
            <div className="bg-[#030a12] p-6 sm:p-8 text-center relative overflow-hidden min-h-[280px] flex flex-col items-center justify-center"
                 style={{ fontFamily: "'Orbitron', 'Share Tech Mono', monospace" }}>
              <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
                   style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, #4cd964 2px, #4cd964 3px)" }} />
              <div className="relative z-10">
                <div className="text-[8px] tracking-[0.3em] text-[#4cd964]/50 mb-1.5" style={{ fontFamily: "'Share Tech Mono', monospace" }}>
                  {form.subtitle || "SUBTITLE"}
                </div>
                <div className="text-2xl sm:text-3xl font-black tracking-wider text-[#4cd964]"
                     style={{ textShadow: "0 0 30px rgba(76,217,100,0.3)" }}>
                  {form.game_name || "GAME NAME"}
                </div>
                <div className="text-[9px] tracking-[0.4em] text-[#4cd964]/50 mt-1" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                  {form.title || "TITLE"}
                </div>
                <div className="mt-4 rounded border border-[#4cd964]/20 bg-[#4cd964]/5 p-3 text-left max-w-[260px] mx-auto relative">
                  <div className="absolute top-0 left-0 w-2 h-2 border-l border-t border-[#4cd964]/60" />
                  <div className="absolute top-0 right-0 w-2 h-2 border-r border-t border-[#4cd964]/60" />
                  <div className="absolute bottom-0 left-0 w-2 h-2 border-l border-b border-[#4cd964]/60" />
                  <div className="absolute bottom-0 right-0 w-2 h-2 border-r border-b border-[#4cd964]/60" />
                  <div className="text-[7px] tracking-widest text-[#4cd964]/80 mb-1">MISSION BRIEF</div>
                  <div className="text-[8px] leading-relaxed text-[#4cd964]/40 line-clamp-3" style={{ fontFamily: "'Share Tech Mono', monospace" }}>
                    {form.mission_description || "Mission description..."}
                  </div>
                </div>
                <div className="mt-4 flex flex-col items-center gap-1">
                  <div className="text-[7px] tracking-[0.3em] text-[#4cd964]/60 animate-pulse">SCAN TO PLAY</div>
                  <div className="w-14 h-14 rounded border border-[#4cd964]/30 bg-[#4cd964]/5 flex items-center justify-center">
                    <div className="w-10 h-10 bg-[#4cd964]/10 rounded" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Controller preview */}
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
              </div>
              <span className="text-[10px] text-gray-400 font-mono">Phone Controller</span>
            </div>
            <div className="bg-[#030a12] p-5 text-center relative overflow-hidden"
                 style={{ fontFamily: "'Orbitron', 'Share Tech Mono', monospace" }}>
              <div className="text-[7px] tracking-[0.3em] text-[#4cd964]/50 mb-2" style={{ fontFamily: "'Share Tech Mono', monospace" }}>
                {form.controller_header || "HEADER TEXT"}
              </div>
              <div className="text-xl font-black tracking-wider text-[#4cd964]"
                   style={{ textShadow: "0 0 20px rgba(76,217,100,0.3)" }}>
                {form.game_name || "GAME NAME"}
              </div>
              <div className="text-[8px] tracking-[0.3em] text-[#4cd964]/50 mt-0.5 mb-3" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                FIELD CONTROLLER
              </div>
              <div className="rounded border border-[#4cd964]/20 bg-[#4cd964]/5 p-3 max-w-[200px] mx-auto relative">
                <div className="absolute top-0 left-0 w-2 h-2 border-l border-t border-[#4cd964]/60" />
                <div className="absolute top-0 right-0 w-2 h-2 border-r border-t border-[#4cd964]/60" />
                <div className="absolute bottom-0 left-0 w-2 h-2 border-l border-b border-[#4cd964]/60" />
                <div className="absolute bottom-0 right-0 w-2 h-2 border-r border-b border-[#4cd964]/60" />
                <div className="text-[7px] tracking-widest text-[#4cd964]/80 mb-2">OPERATOR REGISTRATION</div>
                <div className="h-5 rounded border border-[#4cd964]/20 bg-[#030a12] mb-2" />
                <div className="h-5 rounded border border-[#4cd964]/60 bg-[#4cd964]/10 flex items-center justify-center">
                  <span className="text-[7px] tracking-[0.2em] text-[#4cd964]/80">ENGAGE</span>
                </div>
              </div>
              <div className="mt-3 text-[6px] tracking-widest text-[#4cd964]/30">
                {form.controller_footer || "FOOTER TEXT"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Umami Editor ────────────────────────────────────────────────────
function UmamiEditor({ config, onSave }: { config: GameConfig; onSave: (updates: Partial<Omit<GameConfig, "id">>) => Promise<void> }) {
  const [form, setForm] = useState({
    umami_script_url: config.umami_script_url,
    umami_website_id: config.umami_website_id,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm({
      umami_script_url: config.umami_script_url,
      umami_website_id: config.umami_website_id,
    });
  }, [config]);

  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";
  const active = !!(form.umami_script_url && form.umami_website_id);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Umami Analytics</h2>
        <p className="text-sm text-gray-500 mt-0.5">Connect your Umami instance to track visitors, devices, and pageviews across all game pages.</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 space-y-4">
        <div>
          <label className={labelClass}>Script URL <span className="text-gray-400 font-normal">(e.g. https://cloud.umami.is/script.js)</span></label>
          <input type="text" value={form.umami_script_url} onChange={(e) => setForm(f => ({ ...f, umami_script_url: e.target.value }))} className={inputClass} placeholder="https://cloud.umami.is/script.js" />
        </div>
        <div>
          <label className={labelClass}>Website ID <span className="text-gray-400 font-normal">(UUID from Umami dashboard)</span></label>
          <input type="text" value={form.umami_website_id} onChange={(e) => setForm(f => ({ ...f, umami_website_id: e.target.value }))} className={inputClass} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
        </div>

        {active ? (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5 text-sm text-emerald-700">
            ✓ Analytics tracking is active
          </div>
        ) : (
          <div className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2.5 text-sm text-gray-500">
            Both fields are required to enable analytics tracking.
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          {saving ? "Saving..." : "Save Changes"}
        </button>
        {saved && <span className="text-sm text-emerald-600 font-medium">✓ Saved</span>}
        {error && <span className="text-sm text-red-600 font-medium">⚠ {error}</span>}
      </div>
    </div>
  );
}

// ── Feature Toggles ─────────────────────────────────────────────────
function FeatureToggles({ config, onSave }: { config: GameConfig; onSave: (updates: Partial<Omit<GameConfig, "id">>) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localOverrides, setLocalOverrides] = useState<Record<string, boolean>>({});

  const toggleItems: { key: keyof GameConfig; label: string; description: string }[] = [
    { key: "show_logo", label: "Company Logo", description: "Show the Water Linked logo on all pages" },
    { key: "show_slogan", label: "Logo Slogan", description: "Show the tagline below the company logo" },
    { key: "show_qr_code", label: "QR Code", description: "Show the QR code and session code on the waiting screen" },
    { key: "show_mission_description", label: "Mission Description", description: "Show the mission brief panel on the waiting screen" },
    { key: "show_share_buttons", label: "Share Buttons", description: "Show social share buttons on the game over screen" },
    { key: "show_footer_text", label: "Footer Text", description: "Show the configurable footer text at the bottom of all pages" },
  ];

  const getValue = (key: string): boolean => {
    if (key in localOverrides) return localOverrides[key];
    return config[key as keyof GameConfig] as boolean;
  };

  const handleToggle = async (key: keyof GameConfig, value: boolean) => {
    setLocalOverrides(prev => ({ ...prev, [key]: value }));
    setSaving(true);
    setError(null);
    try {
      await onSave({ [key]: value });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      setLocalOverrides(prev => { const next = { ...prev }; delete next[key]; return next; });
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Feature Toggles</h2>
        <p className="text-sm text-gray-500 mt-0.5">Show or hide UI elements across the game and controller screens.</p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
        {toggleItems.map((item) => {
          const isOn = getValue(item.key);
          return (
            <div key={item.key} className="flex items-center justify-between px-5 py-4 sm:px-6">
              <div>
                <div className="text-sm font-medium text-gray-900">{item.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">{item.description}</div>
              </div>
              <button
                onClick={() => handleToggle(item.key, !isOn)}
                disabled={saving}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 ${
                  isOn ? "bg-indigo-600" : "bg-gray-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                    isOn ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>

      {saving && <div className="text-sm text-gray-400">Saving...</div>}
      {saved && <span className="text-sm text-emerald-600 font-medium">✓ Saved</span>}
      {error && <span className="text-sm text-red-600 font-medium">⚠ {error}</span>}

      <SessionBreakSettings config={config} onSave={onSave} saving={saving} />
    </div>
  );
}

function SessionBreakSettings({
  config,
  onSave,
  saving,
}: {
  config: GameConfig;
  onSave: (updates: Partial<Omit<GameConfig, "id">>) => Promise<void>;
  saving: boolean;
}) {
  const [error, setError] = useState<string | null>(null);

  const handleEnabled = async (enabled: boolean) => {
    setError(null);
    try {
      await onSave({ session_break_enabled: enabled });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  };

  const handleMinutes = async (minutes: SessionBreakMinutes) => {
    setError(null);
    try {
      await onSave({ session_break_minutes: minutes });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 sm:px-6 border-b border-gray-100">
        <div>
          <div className="text-sm font-medium text-gray-900">Session break</div>
          <div className="text-xs text-gray-500 mt-0.5">
            Cooldown on the phone controller after a completed game. The TV stays open — new visitors can scan and play while the previous operator waits.
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleEnabled(!config.session_break_enabled)}
          disabled={saving}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 ${
            config.session_break_enabled ? "bg-indigo-600" : "bg-gray-200"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
              config.session_break_enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
      <div className="px-5 py-4 sm:px-6 space-y-3">
        <label className="block text-sm font-medium text-gray-700">Break duration</label>
        <div className="flex flex-wrap gap-2">
          {SESSION_BREAK_MINUTE_OPTIONS.map((m) => (
            <button
              key={m}
              type="button"
              disabled={saving || !config.session_break_enabled}
              onClick={() => void handleMinutes(m)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40 ${
                config.session_break_minutes === m
                  ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {formatSessionBreakMinutes(m)}
            </button>
          ))}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}

// ── Gameplay Editor ─────────────────────────────────────────────────
function GameplayEditor({ config, onSave }: { config: GameConfig; onSave: (updates: Partial<Omit<GameConfig, "id">>) => Promise<void> }) {
  const [form, setForm] = useState<GameplaySettings>(() => ({
    ...DEFAULT_GAMEPLAY_SETTINGS,
    ...(config.gameplay_settings || {}),
  }));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm({ ...DEFAULT_GAMEPLAY_SETTINGS, ...(config.gameplay_settings || {}) });
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave({ gameplay_settings: form });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm({ ...DEFAULT_GAMEPLAY_SETTINGS });
  };

  const set = (key: keyof GameplaySettings, value: number) => {
    setForm(f => ({ ...f, [key]: value }));
  };

  const inputClass = "w-20 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 text-right focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500";

  const NumField = ({ label, field, min = 0, max = 9999, step = 1, hint }: { label: string; field: keyof GameplaySettings; min?: number; max?: number; step?: number; hint?: string }) => (
    <div className="flex items-center justify-between py-2">
      <div>
        <div className="text-sm font-medium text-gray-900">{label}</div>
        {hint && <div className="text-xs text-gray-400 mt-0.5">{hint}</div>}
      </div>
      <input
        type="number"
        value={form[field]}
        onChange={(e) => set(field, Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        className={inputClass}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Gameplay Tuning</h2>
        <p className="text-sm text-gray-500 mt-0.5">Fine-tune every aspect of the game. Changes apply to new sessions.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Submarine */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 space-y-1">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">🚢 Submarine</h3>
          <NumField label="Lives" field="lives" min={1} max={10} hint="Number of respawns before game over" />
          <NumField label="Max HP" field="max_hp" min={1} max={20} hint="Hit points per life" />
          <NumField label="Thrust Power" field="thrust" min={50} max={600} step={10} hint="Acceleration force" />
          <NumField label="Rotation Speed" field="rotation_speed" min={0.5} max={8} step={0.1} hint="Turn rate (rad/s)" />
          <NumField label="Friction" field="friction" min={0.9} max={0.999} step={0.001} hint="Velocity damping per frame" />
          <NumField label="Sub Radius" field="sub_radius" min={10} max={40} hint="Collision hitbox size" />
          <NumField label="Respawn Shield (s)" field="respawn_invincibility" min={0} max={10} step={0.5} hint="Invincibility after respawn" />
        </div>

        {/* Battery */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 space-y-1">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">🔋 Battery</h3>
          <NumField label="Max Battery" field="battery_max" min={10} max={500} step={10} />
          <NumField label="Drain Rate" field="battery_drain" min={0} max={100} step={0.1} hint="Units/second while thrusting" />
          <NumField label="Recharge Rate" field="battery_recharge" min={0} max={100} step={0.5} hint="Units/second while idle" />
        </div>

        {/* Torpedo */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 space-y-1">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">💥 Torpedo</h3>
          <NumField label="Speed" field="torpedo_speed" min={100} max={1000} step={10} hint="Pixels/second" />
          <NumField label="Cooldown (s)" field="torpedo_cooldown" min={0.05} max={3} step={0.05} hint="Time between shots" />
          <NumField label="Battery Cost" field="torpedo_battery_cost" min={0} max={50} step={1} hint="Battery units consumed per shot" />
          <NumField label="Lifetime (s)" field="torpedo_life" min={0.5} max={10} step={0.5} hint="Time before torpedo expires" />
        </div>

        {/* Sonar / Radar */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 space-y-1">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">📡 Sonar / Radar</h3>
          <NumField label="Cooldown (s)" field="sonar_cooldown" min={1} max={20} step={0.5} hint="Time between activations" />
          <NumField label="Duration (s)" field="sonar_duration" min={0.5} max={10} step={0.5} hint="How long the beam stays on" />
          <NumField label="Max Range (px)" field="sonar_max_radius" min={100} max={1500} step={50} hint="Beam reach distance" />
          <NumField label="FOV (degrees)" field="sonar_fov_degrees" min={10} max={360} step={5} hint="Horizontal field of view" />
        </div>

        {/* Spawning */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 space-y-1">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">🌊 Wave Spawning</h3>
          <NumField label="Base Count" field="spawn_base_count" min={1} max={20} hint="Entities per wave at start" />
          <NumField label="Max Count" field="spawn_max_count" min={1} max={40} hint="Cap on entities per wave" />
          <NumField label="Base Interval (s)" field="spawn_base_interval" min={2} max={30} step={0.5} hint="Time between waves at start" />
          <NumField label="Min Interval (s)" field="spawn_min_interval" min={1} max={15} step={0.5} hint="Fastest wave spawn rate" />
          <NumField label="Interval Reduction" field="spawn_interval_reduction" min={0} max={2} step={0.1} hint="Seconds faster per wave" />
        </div>

        {/* Enemy Speed */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 space-y-1">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">⚡ Enemy Speed</h3>
          <NumField label="Base Speed" field="enemy_base_speed" min={5} max={100} step={5} hint="Minimum speed (px/s)" />
          <NumField label="Speed Variance" field="enemy_speed_variance" min={0} max={100} step={5} hint="Random speed range" />
          <NumField label="Wave Speed Bonus" field="enemy_wave_speed_bonus" min={0} max={20} step={1} hint="Extra speed per wave" />
        </div>

        {/* Enemy Weights */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 space-y-1">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">🎲 Spawn Weights</h3>
          <p className="text-xs text-gray-400 mb-2">Relative probability of each enemy type. Higher = more frequent.</p>
          <NumField label="Mines" field="mine_weight" min={0} max={1} step={0.05} />
          <NumField label="Mantas (chasers)" field="manta_weight" min={0} max={1} step={0.05} />
          <NumField label="Swarm Units" field="swarm_weight" min={0} max={1} step={0.05} />
          <NumField label="Shipwrecks" field="shipwreck_weight" min={0} max={1} step={0.05} />
          <NumField label="Beacons" field="beacon_weight" min={0} max={1} step={0.05} />
          <NumField label="Seafloor" field="seafloor_weight" min={0} max={1} step={0.05} />
        </div>

        {/* Enemy HP */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 space-y-1">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">❤️ Enemy Hit Points</h3>
          <NumField label="Mine HP" field="mine_hp" min={1} max={10} />
          <NumField label="Manta HP" field="manta_hp" min={1} max={10} />
          <NumField label="Swarm HP" field="swarm_hp" min={1} max={10} />
          <NumField label="Shipwreck HP" field="shipwreck_hp" min={1} max={10} />
          <NumField label="Beacon HP" field="beacon_hp" min={1} max={10} />
          <NumField label="Seafloor HP" field="seafloor_hp" min={1} max={10} />
        </div>

        {/* Scoring */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 space-y-1">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">🏆 Scoring</h3>
          <NumField label="Mine Score" field="score_mine" min={0} max={2000} step={25} />
          <NumField label="Manta Score" field="score_manta" min={0} max={2000} step={25} />
          <NumField label="Swarm Score" field="score_swarm" min={0} max={2000} step={25} />
          <NumField label="Shipwreck Score" field="score_shipwreck" min={0} max={2000} step={25} />
          <NumField label="Beacon Score" field="score_beacon" min={0} max={2000} step={25} />
          <NumField label="Seafloor Score" field="score_seafloor" min={0} max={2000} step={25} />
          <NumField label="Depth Gain (base)" field="depth_gain_base" min={0} max={200} step={5} />
          <NumField label="Depth Gain (variance)" field="depth_gain_variance" min={0} max={200} step={5} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
          {saving ? "Saving..." : "Save Changes"}
        </button>
        <button onClick={handleReset} className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
          Reset to Defaults
        </button>
        {saved && <span className="text-sm text-emerald-600 font-medium">✓ Saved</span>}
        {error && <span className="text-sm text-red-600 font-medium">⚠ {error}</span>}
      </div>
    </div>
  );
}
