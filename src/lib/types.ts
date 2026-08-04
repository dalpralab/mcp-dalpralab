export interface Env {
  /** KV usato per il limite orario su richiedi_audit. */
  RATE_KV: KVNamespace;
  /** Rate limiter nativo Cloudflare: 30 richieste/minuto per IP. */
  RATE_LIMITER: { limit(options: { key: string }): Promise<{ success: boolean }> };
  /** Webhook FunnelKit su cui viene creato il contatto (Workers Secret). */
  FUNNELKIT_WEBHOOK_URL?: string;
  /** Chiave API Google Calendar o service account JSON (Workers Secret, opzionale). */
  GOOGLE_CALENDAR_ID?: string;
  GOOGLE_SERVICE_ACCOUNT_JSON?: string;
  /** Ambiente: "production" | "development". */
  ENVIRONMENT?: string;
}

export interface Slot {
  data: string;
  ora_inizio: string;
  ora_fine: string;
}
