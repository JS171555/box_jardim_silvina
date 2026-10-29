// Todas as datas de negócio usam America/Sao_Paulo (o banco usa a mesma regra em today_sp()).
const TZ = "America/Sao_Paulo";
export const todaySP = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
export function addDays(iso, n) { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export function mondayOf(iso) { const w = (new Date(iso + "T12:00:00Z").getUTCDay() + 6) % 7; return addDays(iso, -w); }
export const fmtDate = (iso, o = { weekday: "short", day: "2-digit", month: "2-digit" }) =>
  new Date(iso + "T12:00:00Z").toLocaleDateString("pt-BR", { ...o, timeZone: "UTC" });
export const fmtTime = (ts) => new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
export const fmtDateTime = (ts) => new Date(ts).toLocaleString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
// <input type="datetime-local"> <-> horário de São Paulo (UTC-3, sem horário de verão desde 2019)
export const toSPInput = (ts) => new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, dateStyle: "short", timeStyle: "short" }).format(new Date(ts)).replace(" ", "T");
export const fromSPInput = (v) => new Date(v + ":00-03:00").toISOString();
