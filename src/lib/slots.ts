import config from "../data/disponibilita.json";
import type { Slot } from "./types";

const TZ = config._meta.timezone;

/** Parti data/ora di un istante, lette nel fuso orario di Roma. */
function partsInRome(d: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    hour: Number(p.hour === "24" ? "00" : p.hour),
    minute: Number(p.minute),
    weekday: weekdayMap[p.weekday as string] ?? 0,
  };
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function fromMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Genera gli slot disponibili nell'intervallo richiesto, a partire dalle fasce
 * settimanali configurate. Rispetta l'anticipo minimo e il numero massimo di
 * slot restituiti.
 *
 * `busy` è l'elenco di intervalli occupati (ISO) da sottrarre: viene popolato
 * dall'integrazione Google Calendar quando è attiva, altrimenti resta vuoto.
 */
export function generaSlot(opts: {
  daData?: string;
  aData?: string;
  adesso?: Date;
  busy?: Array<{ start: string; end: string }>;
}): Slot[] {
  const now = opts.adesso ?? new Date();
  const primoUtile = new Date(now.getTime() + config.anticipo_minimo_ore * 3_600_000);

  const inizio = opts.daData ? new Date(`${opts.daData}T00:00:00Z`) : primoUtile;
  const fineDefault = addDays(now, config.orizzonte_giorni_default);
  const fine = opts.aData ? new Date(`${opts.aData}T23:59:59Z`) : fineDefault;

  const fasce = new Map<number, Array<{ da: string; a: string }>>();
  for (const f of config.fasce_settimanali) {
    const arr = fasce.get(f.giorno) ?? [];
    arr.push({ da: f.da, a: f.a });
    fasce.set(f.giorno, arr);
  }

  const busy = (opts.busy ?? []).map((b) => ({
    start: new Date(b.start).getTime(),
    end: new Date(b.end).getTime(),
  }));

  const out: Slot[] = [];
  const durata = config.durata_minuti;

  for (let giorno = 0; giorno <= config.orizzonte_giorni_default + 1; giorno++) {
    if (out.length >= config.max_slot_restituiti) break;

    const cursore = addDays(inizio, giorno);
    if (cursore.getTime() > fine.getTime()) break;

    const { date, weekday } = partsInRome(cursore);
    const fasceGiorno = fasce.get(weekday);
    if (!fasceGiorno) continue;

    // Tutti gli slot teoricamente liberi in questa giornata.
    const candidati: Slot[] = [];
    for (const fascia of fasceGiorno) {
      for (let m = toMinutes(fascia.da); m + durata <= toMinutes(fascia.a); m += durata) {
        const oraInizio = fromMinutes(m);
        const oraFine = fromMinutes(m + durata);

        // Istante dello slot, interpretato come ora locale di Roma.
        const slotUtc = istanteRoma(date, oraInizio);
        if (slotUtc.getTime() < primoUtile.getTime()) continue;
        if (slotUtc.getTime() > fine.getTime()) continue;

        const slotFineUtc = slotUtc.getTime() + durata * 60_000;
        const occupato = busy.some((b) => slotUtc.getTime() < b.end && slotFineUtc > b.start);
        if (occupato) continue;

        candidati.push({ data: date, ora_inizio: oraInizio, ora_fine: oraFine });
      }
    }

    // Ne proponiamo pochi per giorno, distribuiti nell'arco della giornata,
    // così la lista copre più date invece di riempirsi con un solo pomeriggio.
    for (const slot of distribuisci(candidati, config.max_slot_per_giorno)) {
      if (out.length >= config.max_slot_restituiti) break;
      out.push(slot);
    }
  }

  return out;
}

/** Sceglie al massimo `quanti` elementi distribuiti uniformemente nell'array. */
function distribuisci<T>(elementi: T[], quanti: number): T[] {
  if (elementi.length <= quanti) return elementi;
  const passo = (elementi.length - 1) / (quanti - 1 || 1);
  const out: T[] = [];
  for (let i = 0; i < quanti; i++) out.push(elementi[Math.round(i * passo)]);
  return out;
}

/**
 * Converte "2026-08-10" + "15:00" (ora di Roma) nell'istante UTC corrispondente,
 * senza dipendere dal fuso del runtime.
 */
function istanteRoma(date: string, hhmm: string): Date {
  const naive = new Date(`${date}T${hhmm}:00Z`);
  const p = partsInRome(naive);
  const offsetMin = p.hour * 60 + p.minute - toMinutes(hhmm);
  return new Date(naive.getTime() - offsetMin * 60_000);
}

export const configDisponibilita = config;
