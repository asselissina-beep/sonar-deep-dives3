import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "./auth-middleware";
import { isAdminFromClaims } from "@/lib/admin-auth";
import { syncAdminAllowlist } from "@/lib/admin.server";

export const requireAdminAuth = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { supabase, userId, claims } = context as {
      supabase: import("@supabase/supabase-js").SupabaseClient;
      userId: string;
      claims: Record<string, unknown>;
    };

    if (isAdminFromClaims(claims)) {
      return next({ context: { ...context, isAdmin: true } });
    }

    const email =
      typeof claims.email === "string" ? claims.email : undefined;
    if (email && (await syncAdminAllowlist(userId, email))) {
      return next({ context: { ...context, isAdmin: true } });
    }

    const { data: adminRow, error } = await supabase
      .from("admin_users")
      .select("id")
      .maybeSingle();

    if (error || !adminRow) {
      throw new Response("Forbidden: Admin access required", { status: 403 });
    }

    return next({ context: { ...context, isAdmin: true } });
  });
