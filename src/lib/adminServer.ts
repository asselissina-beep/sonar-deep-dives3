import { createServerFn } from "@tanstack/react-start";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { requireAdminAuth } from "@/integrations/supabase/admin-auth-middleware";
import { parseGameConfigUpdates } from "@/lib/gameConfig.schema";
import { z } from "zod";
import {
  updateConfigInDb,
  clearAllSessions,
  clearAllScores,
  killGameSessionInDb,
  LEADS_PAGE_SIZE,
  listPlayerRegistrationsForExport,
  listPlayerRegistrationsPage,
} from "./admin.server";

const adminMiddleware = [attachSupabaseAuth, requireAdminAuth];

/** Confirms the bearer session belongs to an admin (used after client sign-in). */
export const verifyAdminAccess = createServerFn({ method: "GET" })
  .middleware(adminMiddleware)
  .handler(async ({ context }) => {
    const ctx = (context ?? {}) as { userId?: string; claims?: Record<string, unknown> };
    const email = typeof ctx.claims?.email === "string" ? ctx.claims.email : null;
    return { ok: true as const, userId: ctx.userId ?? "", email };
  });

export const updateGameConfig = createServerFn({ method: "POST" })
  .middleware(adminMiddleware)
  .inputValidator((input: { updates: Record<string, unknown> }) => {
    const updates = parseGameConfigUpdates(input.updates);
    return { updates };
  })
  .handler(async ({ data }) => {
    if (Object.keys(data.updates).length === 0) {
      return { validated: true };
    }
    return await updateConfigInDb(data.updates);
  });

export const resetSessions = createServerFn({ method: "POST" })
  .middleware(adminMiddleware)
  .handler(async () => clearAllSessions());

export const resetScores = createServerFn({ method: "POST" })
  .middleware(adminMiddleware)
  .handler(async () => clearAllScores());

export const killSession = createServerFn({ method: "POST" })
  .middleware(adminMiddleware)
  .inputValidator((input: { sessionId: string }) =>
    z.object({ sessionId: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data }) => killGameSessionInDb(data.sessionId));

const leadsSearchSchema = z.object({
  search: z.string().max(200).optional(),
});

const leadsPageSchema = leadsSearchSchema.extend({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(LEADS_PAGE_SIZE),
});

export const fetchPlayerRegistrations = createServerFn({ method: "GET" })
  .middleware(adminMiddleware)
  .inputValidator((input?: { page?: number; pageSize?: number; search?: string }) =>
    leadsPageSchema.parse(input ?? {})
  )
  .handler(async ({ data }) =>
    listPlayerRegistrationsPage(data.page, data.pageSize, data.search)
  );

export const fetchPlayerRegistrationsForExport = createServerFn({ method: "GET" })
  .middleware(adminMiddleware)
  .inputValidator((input?: { search?: string }) => leadsSearchSchema.parse(input ?? {}))
  .handler(async ({ data }) => listPlayerRegistrationsForExport(data.search));
