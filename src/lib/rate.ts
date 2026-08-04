import type { Env } from "./types";

/** Limite globale: 30 richieste al minuto per IP (rate limiter nativo Cloudflare). */
export async function limiteGlobale(env: Env, ip: string): Promise<boolean> {
  if (!env.RATE_LIMITER) return true;
  try {
    const { success } = await env.RATE_LIMITER.limit({ key: ip });
    return success;
  } catch {
    // Il rate limiter non deve mai far cadere il servizio.
    return true;
  }
}

/**
 * Limite specifico su richiedi_audit: massimo 3 invii per IP all'ora.
 * Implementato su KV con TTL, perché il rate limiter nativo non supporta
 * finestre superiori a 60 secondi.
 */
export async function limiteAudit(env: Env, ip: string): Promise<boolean> {
  if (!env.RATE_KV) return true;
  const finestra = Math.floor(Date.now() / 3_600_000);
  const chiave = `audit:${ip}:${finestra}`;
  try {
    const attuale = Number((await env.RATE_KV.get(chiave)) ?? "0");
    if (attuale >= 3) return false;
    await env.RATE_KV.put(chiave, String(attuale + 1), { expirationTtl: 3600 });
    return true;
  } catch {
    return true;
  }
}

export function ipDaRichiesta(request?: Request): string {
  return (
    request?.headers.get("CF-Connecting-IP") ??
    request?.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "sconosciuto"
  );
}
