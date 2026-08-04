import type { Env } from "./types";

export interface Lead {
  nome: string;
  email: string;
  sito: string;
  messaggio?: string;
  slot_preferito?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@,]+\.[a-z]{2,}$/i;
const DOMINI_USA_E_GETTA = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "yopmail.com",
  "tempmail.com",
  "trashmail.com",
]);

export function validaEmail(email: string): string | null {
  const e = email.trim().toLowerCase();
  if (e.length > 254 || !EMAIL_RE.test(e)) return "L'indirizzo email non sembra valido.";
  const dominio = e.split("@")[1];
  if (DOMINI_USA_E_GETTA.has(dominio)) return "Serve un indirizzo email non temporaneo.";
  return null;
}

/** Normalizza il sito e verifica che il dominio sia plausibile. */
export function normalizzaSito(sito: string): { url: string } | { errore: string } {
  let s = sito.trim();
  if (!s) return { errore: "Il sito web è obbligatorio." };
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;

  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return { errore: "L'indirizzo del sito non è valido." };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { errore: "L'indirizzo del sito non è valido." };
  }
  const host = u.hostname.toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) || host.endsWith(".local")) {
    return { errore: "Il dominio del sito non sembra plausibile." };
  }
  if (host === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return { errore: "Serve un dominio pubblico, non un indirizzo locale." };
  }
  return { url: u.origin };
}

export function tronca(valore: string | undefined, max = 1000): string | undefined {
  if (valore === undefined) return undefined;
  const v = valore.trim();
  return v.length > max ? v.slice(0, max) : v;
}

/** Riferimento leggibile della richiesta, es. MCP-8K2Q4P. */
export function generaRiferimento(): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  for (const b of bytes) s += alfabeto[b % alfabeto.length];
  return `MCP-${s}`;
}

/**
 * Invia il lead a FunnelKit. Nessun dato personale resta nel worker:
 * il contatto vive solo nel CRM.
 */
export async function inviaLead(
  env: Env,
  lead: Lead,
  riferimento: string
): Promise<{ ok: true } | { ok: false; errore: string }> {
  const url = env.FUNNELKIT_WEBHOOK_URL;
  if (!url) {
    return { ok: false, errore: "Il canale di invio non è configurato." };
  }

  const payload = {
    email: lead.email,
    nome: lead.nome,
    site_url: lead.sito,
    messaggio: lead.messaggio ?? "",
    slot_preferito: lead.slot_preferito ?? "",
    source: "MCP",
    origine: "mcp",
    tag: "Lead MCP",
    riferimento,
    ricevuto_il: new Date().toISOString(),
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, errore: `Il CRM ha risposto ${res.status}.` };
    return { ok: true };
  } catch {
    return { ok: false, errore: "Il CRM non ha risposto in tempo." };
  }
}
