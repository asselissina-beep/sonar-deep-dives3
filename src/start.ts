import { createStart } from "@tanstack/react-start";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

/**
 * Attaches the Supabase session bearer token to server function RPCs from the browser.
 * Required for admin auth middleware on protected server functions.
 */
export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
}));
