import { createMcpHandler } from "agents/mcp/server";
import { env } from "cloudflare:workers";

import { creaServer, limiteGlobale, ipDaRichiesta, VERSIONE } from "./server";
import type { Env } from "./lib/types";

const ENV = env as unknown as Env;

const handler = createMcpHandler(
  (ctx) => creaServer(ENV, ctx.requestInfo),
  {
    route: "/mcp",
    corsOptions: {
      origin: "*",
      methods: "GET,POST,OPTIONS",
      headers: "Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Accept",
      exposeHeaders: "Mcp-Session-Id",
    },
    // Host ammessi, come protezione contro il DNS rebinding.
    // Deve includere sia il dominio finale sia l'endpoint workers.dev usato
    // per i test: se un host manca, il server risponde 403 "Invalid Host".
    allowedHostnames: [
      "mcp.dalpralab.it",
      "mcp-dalpralab.massimilianodalpra.workers.dev",
      "localhost",
      "127.0.0.1",
    ],
    allowedOriginHostnames: "*",
  }
);

/** Manifest di scoperta servito dall'endpoint stesso. */
const MANIFEST = {
  name: "dalpralab",
  title: "DalPraLab — consulenza SEO e GEO",
  description:
    "Servizi, prezzi, case study, disponibilità e richiesta di audit del consulente SEO e GEO Massimiliano Dal Prà.",
  version: VERSIONE,
  endpoint: "https://mcp.dalpralab.it/mcp",
  transport: "streamable-http",
  authentication: "none",
  website: "https://dalpralab.it",
  documentation: "https://dalpralab.it/mcp/",
  tools: [
    { name: "servizi_e_prezzi", description: "Servizi di DalPraLab con prezzi aggiornati e cosa include ciascuno." },
    { name: "case_study", description: "Case study reali con risultati misurabili." },
    { name: "metodologia_georestore", description: "Cos'è l'audit GEO Georestore: analisi, deliverable, tempi, prezzo." },
    { name: "verifica_disponibilita", description: "Slot disponibili per una call conoscitiva nei prossimi 14 giorni." },
    { name: "richiedi_audit", description: "Invia una richiesta di audit Georestore o call conoscitiva." },
  ],
};

export default {
  async fetch(request: Request, workerEnv: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/mcp") {
      const ip = ipDaRichiesta(request);
      if (!(await limiteGlobale(workerEnv, ip))) {
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32029, message: "Troppe richieste. Riprova tra un minuto." },
            id: null,
          }),
          { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60" } }
        );
      }
      return handler(request, workerEnv, ctx);
    }

    if (url.pathname === "/.well-known/mcp.json" || url.pathname === "/manifest.json") {
      return Response.json(MANIFEST, {
        headers: { "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" },
      });
    }

    if (url.pathname === "/health") {
      return Response.json({ status: "ok", version: VERSIONE });
    }

    if (url.pathname === "/") {
      return new Response(PAGINA_HOME, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
};

const PAGINA_HOME = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>DalPraLab — server MCP</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; background:#0b0b0b; color:#f2f2f2; font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  main { max-width:640px; margin:0 auto; padding:14vh 24px 8vh; }
  h1 { font-size:1.9rem; line-height:1.25; margin:0 0 .4em; }
  .oro { color:#c9a227; }
  p { color:#c9c9c9; }
  code { background:#181818; border:1px solid #262626; border-radius:6px; padding:.2em .45em; font-size:.92em; color:#e8d9a0; }
  ul { padding-left:1.1em; }
  li { margin:.35em 0; color:#c9c9c9; }
  a { color:#c9a227; }
  footer { margin-top:3rem; font-size:.85rem; color:#7a7a7a; }
</style>
</head>
<body>
<main>
  <h1>DalPraLab, <span class="oro">interrogabile dalle AI</span></h1>
  <p>Questo è il server MCP di DalPraLab. Collegandolo a Claude o a un altro client MCP puoi chiedere direttamente all'AI quali servizi offro, quanto costano, che risultati ho ottenuto e quando sono disponibile per una call.</p>
  <p>Endpoint: <code>https://mcp.dalpralab.it/mcp</code></p>
  <p>Tool disponibili:</p>
  <ul>
    <li><code>servizi_e_prezzi</code> — servizi e prezzi aggiornati</li>
    <li><code>case_study</code> — casi reali con risultati misurabili</li>
    <li><code>metodologia_georestore</code> — l'audit GEO nel dettaglio</li>
    <li><code>verifica_disponibilita</code> — slot per una call conoscitiva</li>
    <li><code>richiedi_audit</code> — invio della richiesta</li>
  </ul>
  <p>Istruzioni di collegamento su <a href="https://dalpralab.it/mcp/">dalpralab.it/mcp</a>.</p>
  <footer>DalPraLab — Massimiliano Dal Prà · consulente SEO e GEO</footer>
</main>
</body>
</html>`;
