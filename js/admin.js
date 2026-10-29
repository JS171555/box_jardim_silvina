import { requireUser, signIn, signOut } from "./auth.js";
import { supabase } from "./supabase-client.js";
import { toast, guarded, friendly, esc, animateIn } from "./ui.js";
import { todaySP, addDays, mondayOf, fmtDate, fmtDateTime, toSPInput, fromSPInput } from "./dates.js";
import { uploadPublicImage, publicUrl, removeImage } from "./uploads.js";
import { brl } from "./store.js";

const $ = (s, r = document) => r.querySelector(s);
const ok = ({ data, error }) => { if (error) throw error; return data; };
const dlg = $("#dlg"), main = $("#adm-view");
let me, cats = [], weekStart = mondayOf(todaySP()), cache = {};

const input = (id, label, val = "", type = "text", extra = "") => `<label for="${id}">${label}</label><input id="${id}" type="${type}" value="${esc(val)}" ${extra}>`;
const area = (id, label, val = "", ph = "", rows = 3) => `<label for="${id}">${label}</label><textarea id="${id}" rows="${rows}" placeholder="${esc(ph)}">${esc(val)}</textarea>`;
const g = (form, id) => form.querySelector("#" + id).value.trim();
const nn = (v) => (v === "" ? null : v);
const parseMovs = (t) => t.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const [name, ...p] = l.split("|"); return { name: name.trim(), prescription: p.join("|").trim() }; });
const movsText = (m) => (m || []).map((x) => `${x.name} | ${x.prescription}`).join("\n");
const open = (html, onSubmit) => {
  dlg.innerHTML = `<form novalidate>${html}<div class="actions" style="display:flex;gap:.6rem;margin-top:1.1rem"><button type="button" class="btn" id="cancel">Cancelar</button><button type="submit" class="btn btn-primary" id="okbtn">Salvar</button></div></form>`;
  $("#cancel", dlg).onclick = () => dlg.close();
  const f = $("form", dlg);
  f.onsubmit = (e) => { e.preventDefault(); guarded($("#okbtn", dlg), async () => { try { await onSubmit(f); } catch (err) { toast(err.code === "23505" ? "Já existe um treino nessa data." : friendly(err), "error"); } }); };
  dlg.showModal();
};

// ---------- Treinos ----------
async function tabTreinos() {
  if (!cats.length) cats = await supabase.from("workout_categories").select("id,name").order("id").then(ok);
  const rows = await supabase.from("workouts").select("*").gte("workout_date", weekStart).lte("workout_date", addDays(weekStart, 6)).then(ok);
  cache = Object.fromEntries(rows.map((r) => [r.workout_date, r]));
  const days = [...Array(7)].map((_, i) => addDays(weekStart, i)).map((d) => {
    const w = cache[d];
    return `<section class="card adm-day"><div style="display:flex;justify-content:space-between;gap:.6rem"><strong>${fmtDate(d, { weekday: "long", day: "2-digit", month: "2-digit" })}</strong>
      ${w ? `<span class="badge ${w.status === "draft" ? "warn" : ""}">${w.status === "published" ? "Publicado" : "Rascunho"}</span>` : ""}</div>
      ${w ? `<p>${esc(w.title)}</p><div class="actions"><button class="btn" data-act="edit" data-d="${d}">Editar</button><button class="btn" data-act="dup" data-d="${d}">Duplicar</button>
        <button class="btn" data-act="toggle" data-d="${d}">${w.status === "published" ? "Despublicar" : "Publicar"}</button></div>`
        : `<div class="actions"><button class="btn btn-primary" data-act="new" data-d="${d}">Criar treino</button></div>`}</section>`;
  }).join("");
  main.innerHTML = `<div class="weeknav"><button class="link" data-act="prev">‹ Semana anterior</button><button class="link" data-act="today">Hoje</button><button class="link" data-act="next">Próxima ›</button></div>
    <p class="muted">Semana de ${fmtDate(weekStart, { day: "2-digit", month: "long" })}. Um treino por dia; alunos só veem os publicados.</p>${days}`;
}
function workoutForm(date, w = {}) {
  return `<h2>${w.id ? "Editar" : "Novo"} treino · ${fmtDate(date)}</h2>
  ${input("w-title", "Título", w.title)}
  <label for="w-cat">Categoria</label><select id="w-cat"><option value="">—</option>${cats.map((c) => `<option value="${c.id}" ${c.id === w.category_id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
  ${area("w-warmup", "Aquecimento", w.warmup)}${area("w-mobility", "Mobilidade", w.mobility)}${area("w-strength", "Força / técnica", w.strength)}${area("w-wod", "WOD principal", w.wod, "", 4)}
  ${area("w-movs", "Movimentos (um por linha: nome | prescrição)", movsText(w.movements), "Thruster | 21-15-9 · 43/30 kg", 4)}
  ${area("w-scales", "Escalas (Rx, intermediário, iniciante)", w.scales)}${area("w-notes", "Observações do treinador", w.coach_notes)}
  ${input("w-min", "Tempo estimado (min)", w.estimated_minutes ?? "", "number", 'min="1" max="300"')}
  ${input("w-eq", "Equipamentos (separados por vírgula)", (w.equipment || []).join(", "))}
  <label for="w-rt">Formato do resultado</label><select id="w-rt">${[["none", "Sem resultado"], ["time", "Tempo"], ["rounds_reps", "Rounds + reps"], ["load", "Carga"], ["reps", "Repetições"]].map(([v, l]) => `<option value="${v}" ${v === (w.result_type || "none") ? "selected" : ""}>${l}</option>`).join("")}</select>
  <label for="w-status">Status</label><select id="w-status"><option value="draft" ${w.status !== "published" ? "selected" : ""}>Rascunho</option><option value="published" ${w.status === "published" ? "selected" : ""}>Publicado</option></select>`;
}
const rowFrom = (f, date) => ({
  workout_date: date, title: g(f, "w-title"), category_id: g(f, "w-cat") ? Number(g(f, "w-cat")) : null,
  warmup: nn(g(f, "w-warmup")), mobility: nn(g(f, "w-mobility")), strength: nn(g(f, "w-strength")), wod: nn(g(f, "w-wod")),
  movements: parseMovs(g(f, "w-movs")), scales: nn(g(f, "w-scales")), coach_notes: nn(g(f, "w-notes")),
  estimated_minutes: g(f, "w-min") ? Number(g(f, "w-min")) : null,
  equipment: g(f, "w-eq") ? g(f, "w-eq").split(",").map((s) => s.trim()).filter(Boolean) : [],
  result_type: g(f, "w-rt"), status: g(f, "w-status"),
});
function editWorkout(date, w) {
  open(workoutForm(date, w), async (f) => {
    const row = rowFrom(f, date);
    if (!row.title) return toast("Informe o título.", "error");
    if (w?.id) await supabase.from("workouts").update(row).eq("id", w.id).then(ok);
    else await supabase.from("workouts").insert(row).then(ok);
    dlg.close(); toast("Treino salvo."); await show();
  });
}
function dupWorkout(date) {
  const w = cache[date];
  open(`<h2>Duplicar treino</h2><p class="muted">${esc(w.title)}</p>${input("d-date", "Copiar para a data", addDays(date, 7), "date")}<p class="muted">A cópia é criada como rascunho.</p>`, async (f) => {
    const nd = g(f, "d-date"); if (!nd) return toast("Escolha a data.", "error");
    const { id, created_at, updated_at, published_at, created_by, ...copy } = w;
    await supabase.from("workouts").insert({ ...copy, workout_date: nd, status: "draft" }).then(ok);
    dlg.close(); toast("Treino duplicado como rascunho."); await show();
  });
}
async function toggleWorkout(date) {
  const w = cache[date], to = w.status === "published" ? "draft" : "published";
  if (to === "draft" && !confirm("Despublicar? Os alunos deixam de ver este treino.")) return;
  await supabase.from("workouts").update({ status: to }).eq("id", w.id).then(ok);
  toast(to === "published" ? "Publicado." : "Despublicado."); await show();
}

// ---------- Individual ----------
async function tabIndividual() {
  const studs = await supabase.from("profiles").select("id,display_name,email").neq("id", me.id).order("display_name").then(ok);
  main.innerHTML = `<section class="card"><div class="inline">
    <div><label for="i-st">Aluno</label><select id="i-st">${studs.map((s) => `<option value="${s.id}">${esc(s.display_name || s.email)}</option>`).join("")}</select></div>
    <div><label for="i-date">Data do treino</label><input id="i-date" type="date" value="${todaySP()}"></div>
    <button class="btn btn-primary" id="i-load">Carregar</button></div></section><div id="i-out"></div>`;
  $("#i-load").onclick = loadOverride;
}
async function loadOverride() {
  const sid = $("#i-st").value, date = $("#i-date").value, out = $("#i-out");
  const w = await supabase.from("workouts").select("*").eq("workout_date", date).maybeSingle().then(ok);
  if (!w) { out.innerHTML = '<div class="card empty"><p>Não há treino-base nessa data. Crie o treino primeiro.</p></div>'; return; }
  const o = await supabase.from("individual_workout_overrides").select("*").eq("workout_id", w.id).eq("student_id", sid).maybeSingle().then(ok);
  const v = (k) => o?.[k] ?? "";
  out.innerHTML = `<form class="card" id="i-form" novalidate><h3>${esc(w.title)} ${o ? '<span class="badge">Adaptação ativa</span>' : ""}</h3>
    <p class="muted">Campos vazios herdam o treino-base${w.status !== "published" ? " (o treino-base ainda é rascunho)" : ""}.</p>
    ${input("o-title", "Título", v("title"), "text", `placeholder="${esc(w.title)}"`)}
    ${area("o-strength", "Força / técnica", v("strength"), w.strength || "")}${area("o-wod", "WOD", v("wod"), w.wod || "", 4)}
    ${area("o-movs", "Movimentos (nome | prescrição)", movsText(o?.movements), "Vazio = usa os do treino-base", 3)}
    ${area("o-scales", "Escala", v("scales"), w.scales || "")}${area("o-loads", "Cargas do aluno", v("loads"))}
    ${area("o-restr", "Restrições operacionais", v("restrictions"))}${area("o-notes", "Observações", v("coach_notes"), w.coach_notes || "")}
    <button class="btn btn-primary" id="o-save" type="submit" style="margin-top:1rem">Publicar adaptação</button>
    ${o ? '<button class="btn" id="o-del" type="button">Restaurar treino compartilhado</button>' : ""}</form>`;
  const f = $("#i-form");
  f.onsubmit = (e) => { e.preventDefault(); guarded($("#o-save"), async () => {
    try {
      const movs = parseMovs(g(f, "o-movs"));
      const row = { workout_id: w.id, student_id: sid, status: "published", title: nn(g(f, "o-title")), strength: nn(g(f, "o-strength")), wod: nn(g(f, "o-wod")),
        movements: movs.length ? movs : null, scales: nn(g(f, "o-scales")), loads: nn(g(f, "o-loads")), restrictions: nn(g(f, "o-restr")), coach_notes: nn(g(f, "o-notes")) };
      await supabase.from("individual_workout_overrides").upsert(row, { onConflict: "workout_id,student_id" }).then(ok);
      toast("Adaptação publicada."); await loadOverride();
    } catch (err) { toast(friendly(err), "error"); }
  }); };
  $("#o-del")?.addEventListener("click", (e) => guarded(e.currentTarget, async () => {
    if (!confirm("Restaurar o treino compartilhado para este aluno? A adaptação será apagada.")) return;
    try { await supabase.from("individual_workout_overrides").delete().eq("id", o.id).then(ok); toast("Treino compartilhado restaurado."); await loadOverride(); } catch (err) { toast(friendly(err), "error"); }
  }));
}

// ---------- Presença ----------
async function tabPresenca() {
  main.innerHTML = `<section class="card"><div class="inline"><div><label for="p-date">Data</label><input id="p-date" type="date" value="${todaySP()}"></div></div><div id="p-list" style="margin-top:.8rem"></div></section>
    <section class="card"><h3>Frequência e faltas</h3><div class="inline"><div><label for="s-from">De</label><input id="s-from" type="date" value="${addDays(todaySP(), -30)}"></div>
    <div><label for="s-to">Até</label><input id="s-to" type="date" value="${todaySP()}"></div><button class="btn" id="s-go">Atualizar</button></div>
    <p class="muted">Falta = dia com treino publicado sem presença nem justificativa.</p><div class="table-wrap" id="s-out"></div></section>`;
  $("#p-date").onchange = listDay; $("#s-go").onclick = summary;
  await Promise.all([listDay(), summary()]);
}
async function listDay() {
  const date = $("#p-date").value;
  const [studs, att] = await Promise.all([
    supabase.from("profiles").select("id,display_name,email").neq("id", me.id).order("display_name").then(ok),
    supabase.from("attendance").select("*").eq("attendance_date", date).then(ok)]);
  const by = Object.fromEntries(att.map((a) => [a.user_id, a]));
  $("#p-list").innerHTML = studs.length ? `<ul class="rows">${studs.map((s) => { const a = by[s.id];
    return `<li><span style="text-align:left;color:var(--white)">${esc(s.display_name || s.email)}<br><small class="muted">${a ? (a.status === "present" ? "Presente" : "Justificada") + (a.source === "admin" ? " · treinador: " + esc(a.note || "") : "") : "Sem registro"}</small></span>
      <button class="btn" style="width:auto;min-height:40px" data-uid="${s.id}" data-name="${esc(s.display_name || s.email)}">${a ? "Corrigir" : "Registrar"}</button></li>`; }).join("")}</ul>` : '<div class="empty"><p>Nenhum aluno cadastrado ainda.</p></div>';
  $("#p-list").onclick = (e) => { const b = e.target.closest("button[data-uid]"); if (!b) return;
    open(`<h2>${esc(b.dataset.name)} · ${fmtDate(date)}</h2><label for="a-st">Status</label><select id="a-st"><option value="present">Presente</option><option value="justified">Falta justificada</option></select>${area("a-note", "Justificativa (obrigatória)", "")}`, async (f) => {
      await supabase.rpc("admin_set_attendance", { p_user: b.dataset.uid, p_date: date, p_status: g(f, "a-st"), p_note: g(f, "a-note") }).then(ok);
      dlg.close(); toast("Presença salva e auditada."); await listDay(); await summary();
    }); };
}
async function summary() {
  const rows = await supabase.rpc("admin_attendance_summary", { p_from: $("#s-from").value, p_to: $("#s-to").value }).then(ok);
  $("#s-out").innerHTML = rows.length ? `<table><thead><tr><th>Aluno</th><th>Presenças</th><th>Justificadas</th><th>Dias de treino</th><th>Faltas</th></tr></thead><tbody>${rows.map((r) =>
    `<tr><td>${esc(r.display_name)}</td><td>${r.present}</td><td>${r.justified}</td><td>${r.workout_days}</td><td>${r.absences}</td></tr>`).join("")}</tbody></table>` : '<p class="muted">Sem alunos para mostrar.</p>';
}


// ---------- Gamificação ----------
const CRIT = { presences: "Presenças acumuladas", workouts: "Treinos concluídos", streak: "Sequência de frequência", level: "Nível alcançado", throne_hours: "Horas no Trono",
  throne_days: "Dias seguidos no Trono", weekly_champion: "Semanas como campeão", monthly_champion: "Meses como campeão", comeback_days: "Retorno após N dias de ausência", events: "Eventos com participação validada" };
const SRC = { checkin: "Check-in", workout_completed: "Treino", result_logged: "Resultado", achievement: "Conquista", event: "Evento", manual_bonus: "Bônus", adjustment: "Ajuste", reversal: "Estorno" };
let bonusKey = crypto.randomUUID();
async function tabGame() {
  const [rules, studs, tx, achs] = await Promise.all([
    supabase.from("xp_rules").select("*").order("code").then(ok),
    supabase.from("profiles").select("id,display_name,email").neq("id", me.id).order("display_name").then(ok),
    supabase.from("xp_transactions").select("id,amount,source,reason,created_at,reverses_id,profiles(display_name)").order("created_at", { ascending: false }).limit(30).then(ok),
    supabase.from("achievements").select("*").order("sort_order").then(ok)]);
  const reversed = new Set(tx.filter((t) => t.reverses_id).map((t) => t.reverses_id));
  main.innerHTML = `
  <section class="card"><h3>Regras de XP</h3>${rules.map((r) => `<div class="inline" style="margin-top:.5rem"><div><label for="r-${esc(r.code)}">${esc(r.label)}</label><input id="r-${esc(r.code)}" type="number" min="0" max="10000" value="${r.xp}"></div>
    <label style="display:flex;gap:.4rem;align-items:center;margin:0"><input type="checkbox" id="ra-${esc(r.code)}" style="width:auto" ${r.active ? "checked" : ""}> Ativa</label>
    <button class="btn" data-g="rule" data-code="${esc(r.code)}">Salvar</button></div>`).join("")}
    <p class="muted">Eventos, conduta e desafios usam bônus manual (abaixo) ou o valor definido em cada evento.</p></section>
  <section class="card"><h3>Bônus / ajuste manual</h3><div class="inline">
    <div><label for="b-st">Aluno</label><select id="b-st">${studs.map((x) => `<option value="${x.id}">${esc(x.display_name || x.email)}</option>`).join("")}</select></div>
    <div><label for="b-kind">Tipo</label><select id="b-kind"><option value="manual_bonus">Bônus (boa conduta, desafio)</option><option value="adjustment">Ajuste</option></select></div>
    <div><label for="b-amt">XP (ajuste aceita negativo)</label><input id="b-amt" type="number" step="1"></div></div>
    ${area("b-why", "Justificativa (obrigatória)", "")}<button class="btn btn-primary" data-g="bonus" style="margin-top:.8rem">Conceder</button></section>
  <section class="card"><h3>Transações recentes</h3><div class="table-wrap"><table><thead><tr><th>Data</th><th>Aluno</th><th>XP</th><th>Origem</th><th>Motivo</th><th></th></tr></thead><tbody>${tx.map((t) => `<tr>
    <td>${new Date(t.created_at).toLocaleString("pt-BR")}</td><td>${esc(t.profiles?.display_name)}</td><td>${t.amount > 0 ? "+" : ""}${t.amount}</td><td>${SRC[t.source] || t.source}</td>
    <td style="white-space:normal">${esc(t.reason)}</td><td>${t.source !== "reversal" && !reversed.has(t.id) ? `<button class="btn" style="width:auto;min-height:36px" data-g="rev" data-id="${t.id}">Estornar</button>` : reversed.has(t.id) ? "estornada" : ""}</td></tr>`).join("")}</tbody></table></div>
    <button class="btn" data-g="reconcile" style="margin-top:.8rem">Reconciliar saldos com o histórico</button></section>
  <section class="card"><h3>Conquistas</h3><ul class="rows">${achs.map((a) => `<li><span style="text-align:left;color:var(--white)"><i class="fa-solid ${esc(a.icon)}"></i> ${esc(a.name)}<small class="muted" style="display:block">${CRIT[a.criteria_type]} ≥ ${a.criteria_value} · +${a.xp_reward} XP · ${esc(a.rarity)}</small></span>
    <button class="btn" style="width:auto;min-height:36px" data-g="ach" data-id="${a.id}" data-on="${a.active}">${a.active ? "Desativar" : "Ativar"}</button></li>`).join("")}</ul>
    <button class="btn btn-primary" data-g="newach" style="margin-top:.8rem">Nova conquista</button></section>`;
  main.onclick = async (e) => {
    const b = e.target.closest("[data-g]"); if (!b) return;
    const act = b.dataset.g, run = (fn) => guarded(b, async () => { try { await fn(); } catch (err) { toast(friendly(err), "error"); } });
    if (act === "rule") run(async () => { const c = b.dataset.code;
      await supabase.from("xp_rules").update({ xp: Number($("#r-" + c).value), active: $("#ra-" + c).checked, updated_at: new Date().toISOString() }).eq("code", c).then(ok); toast("Regra salva."); });
    else if (act === "bonus") run(async () => {
      const amt = Number($("#b-amt").value), why = $("#b-why").value.trim();
      if (!Number.isInteger(amt) || amt === 0) return toast("Informe um valor de XP válido.", "error");
      if ($("#b-kind").value === "manual_bonus" && amt < 0) return toast("Bônus deve ser positivo; use Ajuste para valores negativos.", "error");
      if (why.length < 3) return toast("Informe a justificativa.", "error");
      await supabase.rpc("admin_grant_xp", { p_user: $("#b-st").value, p_amount: amt, p_kind: $("#b-kind").value, p_reason: why, p_key: bonusKey }).then(ok);
      bonusKey = crypto.randomUUID(); toast("XP concedido e auditado."); await tabGame(); });
    else if (act === "rev") open(`<h2>Estornar transação</h2><p class="muted">Cria uma transação negativa; o histórico original é mantido.</p>${area("x-why", "Justificativa (obrigatória)", "")}`, async (f) => {
      await supabase.rpc("admin_reverse_xp", { p_tx: b.dataset.id, p_reason: g(f, "x-why") }).then(ok); dlg.close(); toast("Estorno registrado."); await tabGame(); });
    else if (act === "reconcile") run(async () => { const r = await supabase.rpc("admin_reconcile_xp").then(ok); toast(r.fixed ? `${r.fixed} saldo(s) corrigido(s).` : "Todos os saldos estão consistentes."); });
    else if (act === "ach") run(async () => { await supabase.from("achievements").update({ active: b.dataset.on !== "true" }).eq("id", b.dataset.id).then(ok); await tabGame(); });
    else if (act === "newach") open(`<h2>Nova conquista</h2>${input("n-name", "Nome")}${area("n-desc", "Descrição", "")}${input("n-icon", "Ícone Font Awesome (ex.: fa-trophy)", "fa-trophy")}${input("n-cat", "Categoria", "geral")}
      <label for="n-rar">Raridade</label><select id="n-rar"><option value="common">Comum</option><option value="rare">Rara</option><option value="epic">Épica</option><option value="legendary">Lendária</option></select>
      <label for="n-crit">Critério</label><select id="n-crit">${Object.entries(CRIT).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>
      ${input("n-val", "Valor necessário", "1", "number", 'min="1"')}${input("n-xp", "Recompensa (XP)", "0", "number", 'min="0" max="10000"')}`, async (f) => {
      const icon = g(f, "n-icon"); if (!/^fa-[a-z0-9-]+$/.test(icon)) return toast("Ícone inválido. Use algo como fa-trophy.", "error");
      if (!g(f, "n-name") || !g(f, "n-desc")) return toast("Informe nome e descrição.", "error");
      await supabase.from("achievements").insert({ code: "custom_" + Date.now(), name: g(f, "n-name"), description: g(f, "n-desc"), icon, category: g(f, "n-cat") || "geral",
        rarity: g(f, "n-rar"), criteria_type: g(f, "n-crit"), criteria_value: Number(g(f, "n-val")), xp_reward: Number(g(f, "n-xp")), sort_order: 200 }).then(ok);
      dlg.close(); toast("Conquista criada."); await tabGame(); });
  };
}


// ---------- Eventos ----------
const EV_ST = { draft: "Rascunho", published: "Publicado", closed: "Encerrado", cancelled: "Cancelado" };
let cacheEv = {};
const fileField = (id, label, bucket, path) => `<label for="${id}">${label} (JPG, PNG, WebP ou AVIF, até 5 MB)</label>${path ? `<img class="cover" alt="" src="${esc(publicUrl(bucket, path))}">` : ""}<input id="${id}" type="file" accept="image/jpeg,image/png,image/webp,image/avif">`;
// Envia a imagem (se houver), grava a linha e limpa o arquivo antigo; se o banco falhar, remove o arquivo novo.
async function saveWithImage(f, fileId, bucket, row, field, old, write) {
  const file = f.querySelector("#" + fileId).files[0]; let fresh = null;
  if (file) { fresh = await uploadPublicImage(bucket, file); row[field] = fresh; }
  try { await write(row); } catch (err) { if (fresh) removeImage(bucket, fresh); throw err; }
  if (fresh && old) removeImage(bucket, old);
}
async function tabEventos() {
  const evs = await supabase.from("events").select("*").order("starts_at", { ascending: false }).limit(100).then(ok);
  cacheEv = Object.fromEntries(evs.map((e) => [e.id, e]));
  main.innerHTML = `<button class="btn btn-primary" data-e="new">Novo evento</button>${evs.length ? evs.map((e) => `<section class="card adm-day"><div style="display:flex;justify-content:space-between;gap:.6rem"><strong>${esc(e.title)}</strong>
    <span class="badge ${e.status === "published" ? "" : "warn"}">${EV_ST[e.status]}</span></div><p class="muted">${fmtDateTime(e.starts_at)}${e.location ? " · " + esc(e.location) : ""}</p>
    <div class="actions"><button class="btn" data-e="edit" data-id="${e.id}">Editar</button><button class="btn" data-e="part" data-id="${e.id}">Participantes</button></div></section>`).join("") : '<div class="card empty"><p>Nenhum evento cadastrado.</p></div>'}`;
  main.onclick = (e) => { const b = e.target.closest("[data-e]"); if (!b) return;
    if (b.dataset.e === "part") return eventParticipants(cacheEv[b.dataset.id]).catch((err) => toast(friendly(err), "error"));
    const ev = b.dataset.e === "edit" ? cacheEv[b.dataset.id] : null;
    open(`<h2>${ev ? "Editar" : "Novo"} evento</h2>${input("e-title", "Título", ev?.title)}${fileField("e-cover", "Banner", "event-banners", ev?.cover_path)}${area("e-desc", "Descrição", ev?.description)}
      ${input("e-start", "Data e horário (Brasília)", ev ? toSPInput(ev.starts_at) : "", "datetime-local")}${input("e-loc", "Local", ev?.location)}${input("e-cat", "Categoria", ev?.category)}
      ${area("e-info", "Informações adicionais", ev?.extra_info)}${area("e-rules", "Regras de participação", ev?.rules)}${input("e-url", "Link externo (https://…)", ev?.external_url)}
      ${input("e-xp", "Recompensa em XP", ev?.xp_reward ?? 0, "number", 'min="0" max="10000"')}
      <label for="e-status">Status</label><select id="e-status">${Object.entries(EV_ST).map(([k, v]) => `<option value="${k}" ${k === (ev?.status || "draft") ? "selected" : ""}>${v}</option>`).join("")}</select>
      <label style="display:flex;gap:.5rem;align-items:center"><input type="checkbox" id="e-reg" style="width:auto" ${ev?.registration_enabled !== false ? "checked" : ""}> Permitir inscrições</label>`, async (f) => {
      const title = g(f, "e-title"), start = g(f, "e-start"), url = g(f, "e-url");
      if (!title || !start) return toast("Informe título e data.", "error");
      if (url && !/^https?:\/\//i.test(url)) return toast("O link deve começar com http:// ou https://", "error");
      const row = { title, description: nn(g(f, "e-desc")), starts_at: fromSPInput(start), location: nn(g(f, "e-loc")), category: nn(g(f, "e-cat")), extra_info: nn(g(f, "e-info")),
        rules: nn(g(f, "e-rules")), external_url: nn(url), xp_reward: Number(g(f, "e-xp") || 0), status: g(f, "e-status"), registration_enabled: f.querySelector("#e-reg").checked };
      await saveWithImage(f, "e-cover", "event-banners", row, "cover_path", ev?.cover_path,
        (r) => (ev ? supabase.from("events").update(r).eq("id", ev.id) : supabase.from("events").insert(r)).then(ok));
      dlg.close(); toast("Evento salvo."); await tabEventos(); });
  };
}
async function eventParticipants(ev) {
  const [studs, regs, parts] = await Promise.all([
    supabase.from("profiles").select("id,display_name,email").neq("id", me.id).order("display_name").then(ok),
    supabase.from("event_registrations").select("user_id,status").eq("event_id", ev.id).then(ok),
    supabase.from("event_participations").select("user_id").eq("event_id", ev.id).then(ok)]);
  const R = Object.fromEntries(regs.map((r) => [r.user_id, r.status])), P = new Set(parts.map((x) => x.user_id));
  const LBL = { confirmed: "Confirmado", interested: "Interessado", cancelled: "Cancelou" };
  dlg.innerHTML = `<h2>${esc(ev.title)}</h2><p class="muted">XP do evento: ${ev.xp_reward}. Validar concede o XP uma única vez, só depois do início do evento.</p>
    <ul class="rows">${studs.map((x) => `<li><span style="text-align:left;color:var(--white)">${esc(x.display_name || x.email)}<small class="muted" style="display:block">${LBL[R[x.id]] || "Sem inscrição"}</small></span>
    ${P.has(x.id) ? '<span class="ok">Validada</span>' : `<button class="btn" style="width:auto;min-height:36px" data-v="${x.id}">Validar</button>`}</li>`).join("")}</ul><button class="btn" id="cls" style="margin-top:1rem">Fechar</button>`;
  $("#cls", dlg).onclick = () => dlg.close();
  dlg.querySelectorAll("[data-v]").forEach((b) => (b.onclick = () => guarded(b, async () => {
    try { await supabase.rpc("admin_validate_participation", { p_event: ev.id, p_user: b.dataset.v }).then(ok); toast("Participação validada."); await eventParticipants(ev); }
    catch (err) { toast(friendly(err), "error"); } })));
  if (!dlg.open) dlg.showModal();
}

// ---------- Loja ----------
const PR_ST = { draft: "Rascunho", published: "Publicado", archived: "Arquivado" };
let cacheP = {};
async function tabLoja() {
  const [prods, wa] = await Promise.all([supabase.from("products").select("*").order("sort_order").then(ok),
    supabase.from("app_settings").select("value").eq("key", "whatsapp_number").maybeSingle().then(ok)]);
  cacheP = Object.fromEntries(prods.map((p) => [p.id, p]));
  main.innerHTML = `<section class="card"><h3>WhatsApp do treinador</h3><div class="inline"><div><label for="wa">Número com DDI, só dígitos (ex.: 5511999999999)</label>
    <input id="wa" inputmode="numeric" value="${esc(typeof wa?.value === "string" ? wa.value : "")}"></div><button class="btn btn-primary" data-p="wa">Salvar</button></div>
    <p class="muted">Sem número válido, os alunos veem "configuração pendente" na loja.</p></section>
    <button class="btn btn-primary" data-p="new">Novo produto</button>${prods.map((p) => `<section class="card"><div style="display:flex;gap:.8rem;align-items:center">
    ${p.image_path ? `<img class="thumb" alt="" src="${esc(publicUrl("product-images", p.image_path))}">` : ""}<div style="flex:1"><strong>${esc(p.title)}</strong>
    <small class="muted" style="display:block">${PR_ST[p.status]} · ${p.availability === "available" ? "Disponível" : "Indisponível"}${p.featured ? " · Destaque" : ""}${p.price != null ? " · " + brl(p.price) : ""}</small></div></div>
    <div class="actions adm-day" style="margin-top:.6rem"><button class="btn" data-p="edit" data-id="${p.id}">Editar</button><button class="btn" data-p="up" data-id="${p.id}" aria-label="Subir">↑</button><button class="btn" data-p="down" data-id="${p.id}" aria-label="Descer">↓</button></div></section>`).join("")}`;
  main.onclick = async (e) => {
    const b = e.target.closest("[data-p]"); if (!b) return; const act = b.dataset.p;
    if (act === "wa") return guarded(b, async () => { try {
      const v = $("#wa").value.replace(/[\s()+-]/g, "");
      if (v && !/^\d{10,15}$/.test(v)) return toast("Use só dígitos com DDI, 10 a 15 números.", "error");
      await supabase.from("app_settings").upsert({ key: "whatsapp_number", value: v || null, updated_by: me.id, updated_at: new Date().toISOString() }, { onConflict: "key" }).then(ok);
      toast(v ? "WhatsApp salvo." : "WhatsApp removido."); } catch (err) { toast(friendly(err), "error"); } });
    if (act === "up" || act === "down") return guarded(b, async () => { try {
      await supabase.rpc("admin_move_product", { p_id: b.dataset.id, p_dir: act === "up" ? -1 : 1 }).then(ok); await tabLoja(); } catch (err) { toast(friendly(err), "error"); } });
    const pr = act === "edit" ? cacheP[b.dataset.id] : null;
    open(`<h2>${pr ? "Editar" : "Novo"} produto</h2>${input("p-title", "Título", pr?.title)}${fileField("p-img", "Imagem", "product-images", pr?.image_path)}${area("p-desc", "Descrição", pr?.description)}
      ${input("p-price", "Preço (R$, opcional)", pr?.price ?? "", "number", 'min="0" step="0.01"')}${input("p-cat", "Categoria", pr?.category)}
      <label for="p-status">Status</label><select id="p-status">${Object.entries(PR_ST).map(([k, v]) => `<option value="${k}" ${k === (pr?.status || "draft") ? "selected" : ""}>${v}</option>`).join("")}</select>
      <label for="p-av">Disponibilidade</label><select id="p-av"><option value="available" ${pr?.availability !== "unavailable" ? "selected" : ""}>Disponível</option><option value="unavailable" ${pr?.availability === "unavailable" ? "selected" : ""}>Indisponível</option></select>
      <label style="display:flex;gap:.5rem;align-items:center"><input type="checkbox" id="p-feat" style="width:auto" ${pr?.featured ? "checked" : ""}> Produto em destaque</label>`, async (f) => {
      if (!g(f, "p-title")) return toast("Informe o título.", "error");
      const price = g(f, "p-price");
      if (price !== "" && !(Number(price) >= 0)) return toast("Preço inválido.", "error");
      const row = { title: g(f, "p-title"), description: nn(g(f, "p-desc")), price: price === "" ? null : Number(price), category: nn(g(f, "p-cat")), status: g(f, "p-status"),
        availability: g(f, "p-av"), featured: f.querySelector("#p-feat").checked };
      if (!pr) row.sort_order = Math.max(0, ...Object.values(cacheP).map((x) => x.sort_order)) + 1;
      await saveWithImage(f, "p-img", "product-images", row, "image_path", pr?.image_path,
        (r) => (pr ? supabase.from("products").update(r).eq("id", pr.id) : supabase.from("products").insert(r)).then(ok));
      dlg.close(); toast("Produto salvo."); await tabLoja(); });
  };
}

// ---------- Navegação ----------
let tab = "treinos";
const TABS = { treinos: tabTreinos, individual: tabIndividual, presenca: tabPresenca, game: tabGame, eventos: tabEventos, loja: tabLoja };
async function show() {
  const tabs = [...document.querySelectorAll(".tabbar .tab")];
  tabs.forEach((t) => { t.setAttribute("aria-selected", t.dataset.tab === tab); t.disabled = true; });
  main.setAttribute("aria-busy", "true");
  main.innerHTML = '<div class="card loading-card" role="status"><span class="btn-spinner" aria-hidden="true"></span><span>Carregando esta área…</span></div>';
  try { await TABS[tab](); animateIn(main); }
  catch (e) { main.innerHTML = `<div class="card" role="alert"><p>${esc(friendly(e))}</p><button class="btn" data-retry> Tentar novamente </button></div>`; main.querySelector("[data-retry]").onclick = show; }
  finally { main.removeAttribute("aria-busy"); tabs.forEach((t) => { t.disabled = false; }); }
}
main.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const d = b.dataset.d, a = b.dataset.act;
  try {
    if (a === "prev") { weekStart = addDays(weekStart, -7); await show(); }
    else if (a === "next") { weekStart = addDays(weekStart, 7); await show(); }
    else if (a === "today") { weekStart = mondayOf(todaySP()); await show(); }
    else if (a === "new") editWorkout(d);
    else if (a === "edit") editWorkout(d, cache[d]);
    else if (a === "dup") dupWorkout(d);
    else if (a === "toggle") await toggleWorkout(d);
  } catch (err) { toast(friendly(err), "error"); }
});
document.querySelectorAll(".tabbar .tab").forEach((t) => (t.onclick = () => { tab = t.dataset.tab; show(); }));

async function gate() {
  const u = await requireUser({ admin: true });
  $("#login").classList.toggle("hidden", !!u); $("#panel").classList.toggle("hidden", !u);
  if (u) { me = u; await show(); }
  return !!u;
}
try { await gate(); } catch (e) { toast(friendly(e), "error"); }
$("#form").addEventListener("submit", (e) => {
  e.preventDefault();
  guarded($("#btn"), async () => {
    try { await signIn($("#email").value.trim(), $("#password").value); if (!(await gate())) toast("Esta conta não tem acesso administrativo.", "error"); }
    catch (err) { toast(friendly(err), "error"); }
  });
});
$("#logout").onclick = signOut;
