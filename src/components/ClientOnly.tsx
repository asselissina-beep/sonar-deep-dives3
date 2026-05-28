import { useEffect, useState, type ReactNode } from "react";

/**
 * Renders children only after mount. Use for canvas, random IDs, localStorage, etc.
 * Prevents React hydration #418 when server HTML cannot match the client.
 */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return fallback;
  }

  return children;
}
