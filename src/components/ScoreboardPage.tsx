import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import WaterLinkedLogo from "@/components/WaterLinkedLogo";
import { ClientOnly } from "@/components/ClientOnly";
import { ChevronDown, ChevronUp, ChevronsUpDown, ArrowLeft, Loader2 } from "lucide-react";

interface ScoreRow {
  id: string;
  session_code: string;
  player_name: string;
  score: number;
  depth: number;
  wave: number;
  created_at: string;
}

type SortKey = "rank" | "player_name" | "score" | "depth" | "wave" | "session_code" | "created_at";
type SortDir = "asc" | "desc";

const scoreNumberFmt = new Intl.NumberFormat("en-US");
const scoreDateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

type ScoreboardPageProps = {
  /** From route loader — same on SSR and client (avoids hydration #418). */
  gameName: string;
  showLogo: boolean;
};

export default function ScoreboardPage({ gameName, showLogo }: ScoreboardPageProps) {

  return (
    <div className="min-h-dvh bg-background text-foreground relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, var(--primary) 2px, var(--primary) 3px)",
        }}
      />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-xs tracking-widest text-muted-foreground hover:text-primary font-body transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            BACK TO BASE
          </Link>
          {showLogo && <WaterLinkedLogo width={140} showSlogan={false} />}
        </div>

        <div className="text-center mb-8">
          <div className="text-[10px] tracking-[0.4em] text-primary font-body mb-2">
            ACOUSTIC RECORDS
          </div>
          <h1
            className="font-display text-3xl sm:text-4xl md:text-5xl font-black tracking-wider text-primary"
            style={{ textShadow: "0 0 40px rgba(76,217,100,0.3)" }}
          >
            SCOREBOARD
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-muted-foreground font-body tracking-wider">
            Top operators of {gameName}
          </p>
        </div>

        <div className="rounded border border-border bg-card/60 backdrop-blur-sm relative">
          <div className="absolute top-0 left-0 w-3 h-3 border-l-2 border-t-2 border-primary" />
          <div className="absolute top-0 right-0 w-3 h-3 border-r-2 border-t-2 border-primary" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-l-2 border-b-2 border-primary" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-r-2 border-b-2 border-primary" />

          <ClientOnly fallback={<ScoreboardTableFallback />}>
            <ScoreboardTable />
          </ClientOnly>
        </div>
      </div>
    </div>
  );
}

function ScoreboardTableFallback() {
  return (
    <>
      <div className="px-4 sm:px-5 py-3 border-b border-border flex items-center justify-between">
        <span className="text-[10px] tracking-widest text-muted-foreground font-body">LOADING…</span>
        <span className="text-[9px] tracking-widest text-muted-foreground/60 font-body hidden sm:inline">
          CLICK COLUMN TO SORT
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[680px]">
          <ScoreboardTableHead />
          <tbody>
            <tr>
              <td colSpan={7} className="px-4 py-16 text-center">
                <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

function ScoreboardTable() {
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { data } = await supabase
        .from("game_scores")
        .select("id, session_code, player_name, score, depth, wave, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (mounted) {
        setScores((data as ScoreRow[]) ?? []);
        setLoading(false);
      }
    };
    void load();

    const channel = supabase
      .channel("public_scores")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_scores" },
        () => void load()
      )
      .subscribe();

    return () => {
      mounted = false;
      void channel.unsubscribe();
    };
  }, []);

  const sortedScores = useMemo(() => {
    const arr = [...scores];
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortKey === "rank") return arr;
    arr.sort((a, b) => {
      const av = a[sortKey as keyof ScoreRow];
      const bv = b[sortKey as keyof ScoreRow];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    return arr;
  }, [scores, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(["score", "depth", "wave", "created_at"].includes(key) ? "desc" : "asc");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (col !== sortKey) return <ChevronsUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  const Th = ({ col, label, className = "" }: { col: SortKey; label: string; className?: string }) => (
    <th className={`px-4 py-3 text-xs font-display tracking-widest text-muted-foreground ${className}`}>
      <button
        type="button"
        onClick={() => handleSort(col)}
        className="inline-flex items-center gap-1.5 hover:text-primary transition-colors uppercase"
      >
        <span>{label}</span>
        <SortIcon col={col} />
      </button>
    </th>
  );

  return (
    <>
      <div className="px-4 sm:px-5 py-3 border-b border-border flex items-center justify-between">
        <span className="text-[10px] tracking-widest text-muted-foreground font-body">
          {loading ? "LOADING…" : `${sortedScores.length} RECORD${sortedScores.length === 1 ? "" : "S"}`}
        </span>
        <span className="text-[9px] tracking-widest text-muted-foreground/60 font-body hidden sm:inline">
          CLICK COLUMN TO SORT
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[680px]">
          <thead>
            <tr className="border-b border-border bg-secondary/20">
              <th className="px-4 py-3 text-xs font-display tracking-widest text-muted-foreground w-14">#</th>
              <Th col="player_name" label="Operator" />
              <Th col="score" label="Score" />
              <Th col="depth" label="Depth" />
              <Th col="wave" label="Wave" />
              <Th col="session_code" label="Session" />
              <Th col="created_at" label="Date" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center">
                  <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" />
                </td>
              </tr>
            ) : sortedScores.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-16 text-center text-sm text-muted-foreground font-body tracking-wider"
                >
                  NO ACOUSTIC SIGNATURES RECORDED YET
                </td>
              </tr>
            ) : (
              sortedScores.map((s, i) => (
                <tr
                  key={s.id}
                  className={`border-b border-border/40 hover:bg-primary/5 transition-colors ${
                    i < 3 && sortKey === "score" && sortDir === "desc" ? "bg-primary/5" : ""
                  }`}
                >
                  <td className="px-4 py-3 text-sm font-display text-muted-foreground/60">{i + 1}</td>
                  <td className="px-4 py-3 text-sm font-body text-foreground">
                    {formatOperator(s.player_name)}
                  </td>
                  <td className="px-4 py-3 text-sm font-display font-semibold text-primary">
                    {scoreNumberFmt.format(s.score)}
                  </td>
                  <td className="px-4 py-3 text-sm font-body text-accent">{s.depth}m</td>
                  <td className="px-4 py-3 text-sm font-body text-muted-foreground">{s.wave}</td>
                  <td className="px-4 py-3 text-xs font-mono tracking-widest text-muted-foreground/70">
                    {s.session_code}
                  </td>
                  <td className="px-4 py-3 text-xs font-body text-muted-foreground/70">
                    {scoreDateFmt.format(new Date(s.created_at))}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ScoreboardTableHead() {
  return (
    <thead>
      <tr className="border-b border-border bg-secondary/20">
        <th className="px-4 py-3 text-xs font-display tracking-widest text-muted-foreground w-14">#</th>
        <th className="px-4 py-3 text-xs font-display tracking-widest text-muted-foreground">Operator</th>
        <th className="px-4 py-3 text-xs font-display tracking-widest text-muted-foreground">Score</th>
        <th className="px-4 py-3 text-xs font-display tracking-widest text-muted-foreground">Depth</th>
        <th className="px-4 py-3 text-xs font-display tracking-widest text-muted-foreground">Wave</th>
        <th className="px-4 py-3 text-xs font-display tracking-widest text-muted-foreground">Session</th>
        <th className="px-4 py-3 text-xs font-display tracking-widest text-muted-foreground">Date</th>
      </tr>
    </thead>
  );
}

function formatOperator(raw: string) {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return raw;
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const lastInitial = parts[parts.length - 1][0]?.toUpperCase() ?? "";
  return lastInitial ? `${first} ${lastInitial}.` : first;
}
