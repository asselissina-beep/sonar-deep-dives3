/**
 * Shared footer attribution shown on every page for consistent branding.
 */
export default function PoweredByFooter({
  className = "",
  variant = "game",
}: {
  className?: string;
  variant?: "game" | "admin";
}) {
  const base =
    variant === "admin"
      ? "text-[11px] tracking-[0.2em] text-zinc-500"
      : "font-display text-[10px] tracking-[0.35em] text-accent/60";
  return (
    <footer
      className={`pointer-events-none w-full py-4 text-center uppercase ${base} ${className}`}
    >
      <span className="pointer-events-auto">Powered by LogiqApps AS</span>
    </footer>
  );
}
