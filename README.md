# mcp-dalpralab

Server MCP pubblico di **DalPraLab** — la consulenza SEO e GEO di [Massimiliano Dal Prà](https://dalpralab.it), interrogabile direttamente da Claude e dagli altri client MCP.

> Il primo consulente SEO e GEO in Italia il cui funnel di consulenza — servizi, prezzi, case study, disponibilità, richiesta di audit — è interrogabile direttamente dalle AI tramite server MCP pubblico.

## Endpoint

```
https://mcp.dalpralab.it/mcp
```

Transport: **Streamable HTTP** (spec MCP 2026-07-28, con fallback stateless per i client 2025).
Autenticazione: **nessuna** — tutti i tool sono pubblici e in sola lettura, tranne `richiedi_audit`.

## Collegarlo a Claude

1. Apri Claude → **Customize → Connectors**
2. **+ → Add custom connector**
3. Incolla `https://mcp.dalpralab.it/mcp`
4. **Add**

Poi puoi chiedere, per esempio: *"Quanto costa un audit GEO da DalPraLab e quando c'è posto per una call?"*

## Tool

| Tool | Cosa fa |
|---|---|
| `servizi_e_prezzi` | Servizi (SEO, GEO, audit, retainer) con prezzi aggiornati e cosa include ciascuno |
| `case_study` | Case study reali con risultati misurabili, filtrabili per settore |
| `metodologia_georestore` | L'audit GEO Georestore: cosa analizza, deliverable, tempi, prezzo |
| `verifica_disponibilita` | Slot disponibili per una call conoscitiva nei prossimi 14 giorni |
| `richiedi_audit` | Invia una richiesta di audit o call (nome, email, sito) |

Altri endpoint utili: `/.well-known/mcp.json` (manifest), `/health`, `/` (pagina informativa).

## Sviluppo

```bash
npm install
npm run dev          # server locale su http://127.0.0.1:8787
npm run typecheck
node test-client.mjs # suite di verifica sui 5 tool
```

## Deploy

Il deploy è automatico: ogni push su `main` viene compilato e pubblicato da **Cloudflare Workers Builds**.

### Configurazione richiesta su Cloudflare

**Binding KV** — namespace `RATE_KV`, usato per il limite orario su `richiedi_audit`. L'`id` va inserito in `wrangler.jsonc`.

**Secret** — `FUNNELKIT_WEBHOOK_URL`: webhook del CRM su cui viene creato il contatto con tag `Lead MCP`.

Nessuna chiave API sta nel codice: i secret vivono solo nei Workers Secrets.

## Privacy e sicurezza

- **Nessun dato personale viene salvato nel worker.** I lead esistono solo nel CRM.
- Rate limiting: 30 richieste al minuto per IP; massimo 3 invii di `richiedi_audit` per IP all'ora.
- Log minimi: timestamp, nome del tool, esito. Mai contenuti né dati di contatto.
- I contenuti serviti dai tool sono pubblici di fatto: nessun nome cliente, nessun dato sotto NDA.

## Licenza

MIT — vedi [LICENSE](LICENSE).
