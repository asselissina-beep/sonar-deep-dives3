import { vi } from "vitest";

const storage = new Map<string, string>();

vi.stubGlobal("localStorage", {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
  clear: () => {
    storage.clear();
  },
});

vi.stubGlobal("sessionStorage", {
  getItem: (key: string) => storage.get(`s:${key}`) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(`s:${key}`, value);
  },
  removeItem: (key: string) => {
    storage.delete(`s:${key}`);
  },
  clear: () => {
    for (const k of [...storage.keys()]) {
      if (k.startsWith("s:")) storage.delete(k);
    }
  },
});

/** Avoid loading the real Supabase client when tests import modules that reference it. */
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      send: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
}));
