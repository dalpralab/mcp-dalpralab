import { Client } from "@modelcontextprotocol/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const url = new URL("http://127.0.0.1:8787/mcp");
const client = new Client({ name: "test-accettazione", version: "1.0.0" });
await client.connect(new StreamableHTTPClientTransport(url));

const { tools } = await client.listTools();
console.log("TOOL TROVATI:", tools.length);
for (const t of tools) console.log(` - ${t.name}: ${t.description}`);

console.log("\n--- metodologia_georestore ---");
let r = await client.callTool({ name: "metodologia_georestore", arguments: {} });
console.log(r.content[0].text.slice(0, 260));

console.log("\n--- servizi_e_prezzi (retainer) ---");
r = await client.callTool({ name: "servizi_e_prezzi", arguments: { categoria: "retainer" } });
console.log(r.content[0].text.slice(0, 400));

console.log("\n--- verifica_disponibilita ---");
r = await client.callTool({ name: "verifica_disponibilita", arguments: {} });
console.log(r.content[0].text.slice(0, 400));

console.log("\n--- case_study (food) ---");
r = await client.callTool({ name: "case_study", arguments: { settore: "food" } });
console.log(r.content[0].text.slice(0, 220));

console.log("\n--- richiedi_audit (email non valida) ---");
r = await client.callTool({ name: "richiedi_audit", arguments: { nome: "Test", email: "non-una-email", sito: "esempio.it" } });
console.log(r.content[0].text);

console.log("\n--- richiedi_audit (dati validi, CRM non configurato) ---");
r = await client.callTool({ name: "richiedi_audit", arguments: { nome: "Mario Rossi", email: "test@esempio.it", sito: "esempio.it", messaggio: "prova" } });
console.log(r.content[0].text);

await client.close();
