import test from "node:test";
import assert from "node:assert/strict";

import {
  checkSupabaseConnection,
  createSupabaseClient,
  isSupabaseConfigured
} from "./supabaseClient.js";

test("isSupabaseConfigured requires both Supabase env vars", () => {
  assert.equal(isSupabaseConfigured({}), false);
  assert.equal(
    isSupabaseConfigured({
      VITE_SUPABASE_URL: "https://example.supabase.co"
    }),
    false
  );
  assert.equal(
    isSupabaseConfigured({
      VITE_SUPABASE_ANON_KEY: "anon-key"
    }),
    false
  );
  assert.equal(
    isSupabaseConfigured({
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_ANON_KEY: "anon-key"
    }),
    true
  );
});

test("createSupabaseClient returns null when Supabase env vars are missing", () => {
  assert.equal(createSupabaseClient({ env: {} }), null);
});

test("createSupabaseClient builds a client with non-invasive auth settings", () => {
  const calls = [];
  const client = createSupabaseClient({
    env: {
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_ANON_KEY: "anon-key"
    },
    createClientImpl(url, key, options) {
      calls.push({ url, key, options });
      return { url, key, options };
    }
  });

  assert.deepEqual(client, calls[0]);
  assert.deepEqual(calls, [
    {
      url: "https://example.supabase.co",
      key: "anon-key",
      options: {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false
        }
      }
    }
  ]);
});

test("checkSupabaseConnection fails safely when Supabase is not configured", async () => {
  const result = await checkSupabaseConnection({
    client: null,
    env: {}
  });

  assert.deepEqual(result, {
    ok: false,
    configured: false,
    reason: "missing_config"
  });
});

test("checkSupabaseConnection returns session status without throwing", async () => {
  const result = await checkSupabaseConnection({
    client: {
      auth: {
        async getSession() {
          return {
            data: {
              session: null
            },
            error: null
          };
        }
      }
    }
  });

  assert.deepEqual(result, {
    ok: true,
    configured: true,
    session: null
  });
});
