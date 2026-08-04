import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";

import listino from "./data/listino.json";
import caseStudy from "./data/case-study.json";
import georestore from "./data/georestore.json";

import { generaSlot, configDisponibilita } from "./lib/slots";
import { limiteAudit, limiteGlobale, ipDaRichiesta } from "./lib/rate";
import {
  generaRiferimento,
  inviaLead,
  normalizzaSito,
  tronca,
  validaEmail,
} from "./lib/lead";
import type { Env } from "./lib/types";

const VERSIONE = "1.0.0";

/** Log minimo: timestamp, tool, esito. Nessun dato personale. */
function logTool(tool: string, esito: "ok" | "errore" | "limite", dettaglio?: string) {
  console.log(
    JSON.stringify({ ts: new Date().toISOString(), tool, esito, dettaglio: dettaglio ?? null })
  );
}

function testo(payload: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }] };
}

export function creaServer(env: Env, request?: Request): McpServer {
  const server = new McpServer({
    name: "dalpralab",
    version: VERSIONE,
    title: "DalPraLab — consulenza SEO e GEO",
  });

  const ip = ipDaRichiesta(request);

  // ────────────────────────────────────────────────────────────────
  // 1. servizi_e_prezzi
  // ────────────────────────────────────────────────────────────────
  server.registerTool(
    "servizi_e_prezzi",
    {
      title: "Servizi e prezzi",
      description:
        "Restituisce i servizi di DalPraLab (SEO, GEO, audit Georestore, retainer) con prezzi aggiornati e cosa include ciascuno.",
      inputSchema: z.object({
        categoria: z
          .enum(["seo", "geo", "audit", "retainer", "tutti"])
          .optional()
          .describe("Filtra per categoria di servizio. Se omesso restituisce tutti i servizi."),
      }),
    },
    async ({ categoria }) => {
      const filtro = categoria ?? "tutti";
      const servizi = listino.servizi
        .filter((s) => filtro === "tutti" || s.categoria === filtro)
        .map((s) => ({
          nome: s.nome,
          descrizione_breve: s.descrizione_breve,
          prezzo: s.prezzo,
          prezzo_testo:
            "prezzo_testo" in s && s.prezzo_testo
              ? s.prezzo_testo
              : s.prezzo === 0
                ? "Gratuito"
                : `${s.prezzo!.toLocaleString("it-IT")} € ${s.unita === "mensile" ? "al mese " : ""}+ IVA`,
          unita: s.unita,
          include: s.include,
          url_pagina: s.url_pagina,
        }));

      logTool("servizi_e_prezzi", "ok", filtro);
      return testo({
        servizi,
        nota_iva: listino._meta.note_iva,
        catalogo_esteso: listino.catalogo_esteso,
      });
    }
  );

  // ────────────────────────────────────────────────────────────────
  // 2. case_study
  // ────────────────────────────────────────────────────────────────
  server.registerTool(
    "case_study",
    {
      title: "Case study",
      description: "Restituisce case study reali di DalPraLab con risultati misurabili.",
      inputSchema: z.object({
        settore: z
          .string()
          .max(120)
          .optional()
          .describe("Filtra i case study per settore, es. 'food', 'agricoltura'."),
      }),
    },
    async ({ settore }) => {
      const q = settore?.trim().toLowerCase();
      const risultati = caseStudy.case_study
        .filter((c) => !q || c.settore.toLowerCase().includes(q) || c.titolo.toLowerCase().includes(q))
        .map(({ titolo, settore, sfida, intervento, risultati, anno }) => ({
          titolo,
          settore,
          sfida,
          intervento,
          risultati,
          anno,
        }));

      logTool("case_study", "ok", q ?? "tutti");
      return testo(
        risultati.length > 0
          ? { case_study: risultati }
          : {
              case_study: [],
              messaggio:
                "Nessun case study pubblicato per quel settore. Chiedi senza filtro per vedere tutti i casi disponibili.",
            }
      );
    }
  );

  // ────────────────────────────────────────────────────────────────
  // 3. metodologia_georestore
  // ────────────────────────────────────────────────────────────────
  server.registerTool(
    "metodologia_georestore",
    {
      title: "Metodologia Georestore",
      description:
        "Spiega cos'è l'audit GEO Georestore: cosa analizza, cosa riceve il cliente, tempi e prezzo.",
      inputSchema: z.object({}),
    },
    async () => {
      logTool("metodologia_georestore", "ok");
      return testo(georestore);
    }
  );

  // ────────────────────────────────────────────────────────────────
  // 4. verifica_disponibilita
  // ────────────────────────────────────────────────────────────────
  server.registerTool(
    "verifica_disponibilita",
    {
      title: "Verifica disponibilità",
      description:
        "Verifica gli slot disponibili per una call conoscitiva nei prossimi 14 giorni.",
      inputSchema: z.object({
        da_data: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("Data di inizio ricerca in formato AAAA-MM-GG."),
        a_data: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("Data di fine ricerca in formato AAAA-MM-GG."),
      }),
    },
    async ({ da_data, a_data }) => {
      const slot = generaSlot({ daData: da_data, aData: a_data });
      logTool("verifica_disponibilita", "ok", String(slot.length));
      return testo({
        slot,
        timezone: configDisponibilita._meta.timezone,
        durata_minuti: configDisponibilita.durata_minuti,
        nota: configDisponibilita.nota_per_utente,
        link_prenotazione: configDisponibilita.link_prenotazione,
        come_prenotare:
          "Due strade: prenotare direttamente dal link_prenotazione (call gratuita da 20 minuti su Google Meet), oppure usare il tool richiedi_audit indicando lo slot preferito, così la richiesta arriva a Massimiliano.",
      });
    }
  );

  // ────────────────────────────────────────────────────────────────
  // 5. richiedi_audit
  // ────────────────────────────────────────────────────────────────
  server.registerTool(
    "richiedi_audit",
    {
      title: "Richiedi audit o call",
      description:
        "Invia una richiesta di audit Georestore o call conoscitiva. Servono nome, email e sito web.",
      inputSchema: z.object({
        nome: z.string().min(2).max(1000).describe("Nome e cognome della persona che richiede."),
        email: z.string().max(254).describe("Email di contatto valida."),
        sito: z.string().max(1000).describe("Sito web dell'azienda, es. esempio.it"),
        messaggio: z
          .string()
          .max(1000)
          .optional()
          .describe("Messaggio libero: obiettivi, settore, situazione attuale."),
        slot_preferito: z
          .string()
          .max(1000)
          .optional()
          .describe("Slot preferito per la call, se già individuato con verifica_disponibilita."),
      }),
    },
    async ({ nome, email, sito, messaggio, slot_preferito }) => {
      if (!(await limiteAudit(env, ip))) {
        logTool("richiedi_audit", "limite");
        return testo({
          esito: "errore",
          messaggio:
            "Hai già inviato più richieste nell'ultima ora. Riprova più tardi oppure scrivi a info@dalpralab.it.",
        });
      }

      const erroreEmail = validaEmail(email);
      if (erroreEmail) {
        logTool("richiedi_audit", "errore", "email");
        return testo({ esito: "errore", messaggio: erroreEmail });
      }

      const sitoNorm = normalizzaSito(sito);
      if ("errore" in sitoNorm) {
        logTool("richiedi_audit", "errore", "sito");
        return testo({ esito: "errore", messaggio: sitoNorm.errore });
      }

      const riferimento = generaRiferimento();
      const esito = await inviaLead(
        env,
        {
          nome: tronca(nome)!,
          email: email.trim().toLowerCase(),
          sito: sitoNorm.url,
          messaggio: tronca(messaggio),
          slot_preferito: tronca(slot_preferito),
        },
        riferimento
      );

      if (!esito.ok) {
        logTool("richiedi_audit", "errore", esito.errore);
        return testo({
          esito: "errore",
          messaggio:
            "Non sono riuscito a registrare la richiesta. Scrivi direttamente a info@dalpralab.it e verrai ricontattato.",
        });
      }

      logTool("richiedi_audit", "ok");
      return testo({
        esito: "ok",
        messaggio: "Richiesta ricevuta. Massimiliano ti risponde entro 24 ore lavorative.",
        riferimento,
      });
    }
  );

  return server;
}

export { limiteGlobale, ipDaRichiesta, VERSIONE };
