import { createClient } from "@supabase/supabase-js";

function normalizeEnvValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function readSupabaseConfig(env = import.meta.env) {
  const url = normalizeEnvValue(env?.VITE_SUPABASE_URL);
  const anonKey = normalizeEnvValue(env?.VITE_SUPABASE_ANON_KEY);

  return {
    url,
    anonKey
  };
}

export function isSupabaseConfigured(env = import.meta.env) {
  const { url, anonKey } = readSupabaseConfig(env);
  return Boolean(url && anonKey);
}

export function createSupabaseClient({
  env = import.meta.env,
  createClientImpl = createClient
} = {}) {
  const { url, anonKey } = readSupabaseConfig(env);

  if (!url || !anonKey) {
    return null;
  }

  return createClientImpl(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    }
  });
}

let cachedClient = null;
let cachedClientConfigKey = "";

export function getSupabaseClient(env = import.meta.env) {
  const { url, anonKey } = readSupabaseConfig(env);

  if (!url || !anonKey) {
    return null;
  }

  const configKey = `${url}::${anonKey}`;

  if (!cachedClient || cachedClientConfigKey !== configKey) {
    cachedClient = createSupabaseClient({ env });
    cachedClientConfigKey = configKey;
  }

  return cachedClient;
}

export async function checkSupabaseConnection({
  client = getSupabaseClient(),
  env = import.meta.env
} = {}) {
  if (!client) {
    return {
      ok: false,
      configured: isSupabaseConfigured(env),
      reason: "missing_config"
    };
  }

  try {
    const { data, error } = await client.auth.getSession();

    if (error) {
      return {
        ok: false,
        configured: true,
        reason: "session_error",
        errorMessage: error.message || "Unknown Supabase session error"
      };
    }

    return {
      ok: true,
      configured: true,
      session: data?.session ?? null
    };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      reason: "request_failed",
      errorMessage: error instanceof Error ? error.message : String(error)
    };
  }
}
