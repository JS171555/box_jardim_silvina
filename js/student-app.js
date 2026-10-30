import { requireUser, signOut } from "./auth.js";
import { getMyProfile, completeSetup } from "./profile.js";
import { uploadAvatar, avatarUrl, publicUrl } from "./uploads.js";
import * as E from "./events.js";
import * as S from "./store.js";
import { toast, guarded, friendly, esc, countUp, animateIn } from "./ui.js";
import { todaySP, addDays, mondayOf, fmtDate, fmtTime, fmtDateTime } from "./dates.js";
import * as W from "./workouts.js";
import * as A from "./attendance.js";
import * as G from "./gamification.js";
import { celebrate, animateBar, fmtDuration, SOURCE } from "./gamification.js";

const $ = (s) => document.querySelector(s);
const view = $("#view");
let user, profile;
const LOGO = "assets/images/logo-box.png";
const avatarSrc = () => avatarUrl(profile.avatar_path) || profile.avatar_url || LOGO;
const loading = () => { view.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>'; };
const stat = (ic, n, l) => `<div class="stat"><i class="fa-solid ${ic}"></i><strong data-count="${Number(n) || 0}">0</strong><span>${l}</span></div>`;

function bindCheckin() {
  $("#checkin")?.addEventListener("click", (e) => guarded(e.currentTarget, async () => {
    try {
      const r = await A.checkIn();
      toast(r.created ? "Presença registrada." : "Você já fez check-in hoje.");
      await route();
      celebrate(r);
    } catch (err) { toast(friendly(err), "error"); }
  }));
}
const checkinCard = (done) => `<section class="card">${done
  ? '<p class="ok"><i class="fa-solid fa-circle-check"></i> Presença de hoje registrada</p>'
  : '<h3><i class="fa-solid fa-location-dot"></i> Check-in de hoje</h3><p class="muted">Registre sua presença no box.</p><button class="btn btn-primary" id="checkin">Fazer check-in</button>'}</section>`;

const avatarOf = (r) => avatarUrl(r.avatar_path) || r.avatar_url || LOGO;
const dBR = (x) => new Date(x).toLocaleDateString("pt-BR");
const RAR = { common: "Comum", rare: "Rara", epic: "Épica", legendary: "Lendária" };
const animateBars = () => view.querySelectorAll(".xp-fill").forEach((b) => animateBar(b, b.dataset.pct));
const xpCard = (g) => `<section class="card"><div class="lvl-row"><span class="muted">Nível</span><strong>${g.level}</strong></div>
  <div class="xp-track" role="progressbar" aria-label="Progresso até o próximo nível" aria-valuenow="${g.progress_pct}" aria-valuemin="0" aria-valuemax="100"><div class="xp-fill" data-pct="${g.progress_pct}"></div></div>
  <p><strong>${g.xp_total} XP</strong> <span class="muted">${g.next_level_xp != null ? `· faltam ${g.next_level_xp - g.xp_total} para o nível ${g.level + 1}` : "· nível máximo"}</span></p>
  <p class="muted">${g.rank ? `Posição #${g.rank} de ${g.total_students}${g.gap_to_first > 0 ? ` · ${g.gap_to_first} XP atrás do líder` : " · você lidera!"}` : ""}
  ${g.recent_achievements.length ? `<br>Recentes: ${g.recent_achievements.map((a) => `<i class="fa-solid ${esc(a.icon)} rar-${esc(a.rarity)}" title="${esc(a.name)}"></i>`).join(" ")}` : ""}</p></section>`;
const throneBanner = (th) => th.king ? `<a class="card king" href="#ranking/trono" style="text-decoration:none;color:inherit"><i class="fa-solid fa-crown"></i><p class="muted">O Trono</p><strong>${esc(th.king.name)}</strong><small class="muted">no trono há ${fmtDuration(th.king.summary.current_reign_seconds)}</small></a>` : "";

const homeExtras = (evs, prods) => `${evs.length ? `<section class="card"><h3><i class="fa-solid fa-calendar-days"></i> Próximos eventos</h3><ul class="rows">${evs.map((e) => `<li><a href="#evento/${e.id}">${esc(e.title)}</a><span>${fmtDateTime(e.starts_at)}</span></li>`).join("")}</ul></section>` : ""}
  ${prods.length ? `<section class="card"><h3><i class="fa-solid fa-bag-shopping"></i> Em destaque na loja</h3><ul class="rows">${prods.map((p) => `<li><a href="#loja">${esc(p.title)}</a><span>${p.price != null ? S.brl(p.price) : ""}</span></li>`).join("")}</ul></section>` : ""}`;

async function inicio(_arg, routeId) {
  const t = todaySP();
  const [st, w, next, g, th, evs, prods] = await Promise.all([A.myStats(), W.getWorkout(t), W.nextWorkout(t), G.myGame(), G.getThrone(), E.upcoming(2), S.featured(3)]);
  if (!isCurrentRoute(routeId)) return;
  const s = w ? await W.getSession(w.id, user.id) : null;
  if (!isCurrentRoute(routeId)) return;
  const label = !s ? "Iniciar treino" : s.status === "in_progress" ? "Continuar treino" : "Ver resultado";
  view.innerHTML = `
    <header class="hero"><img class="avatar-sm" src="${esc(avatarSrc())}" alt="" referrerpolicy="no-referrer">
      <div><p class="muted">Bora treinar,</p><h1>${esc(profile.display_name)}</h1></div></header>
    <section class="stats stats-home">${stat("fa-calendar-check", st.presences, "presenças")}${stat("fa-dumbbell", st.completed, "treinos")}${stat("fa-fire", st.streak, "sequência")}</section>
    ${xpCard(g)}${throneBanner(th)}${checkinCard(st.checked_in_today)}
    <section class="card"><h3><i class="fa-solid fa-dumbbell"></i> Treino de hoje</h3>
      ${w ? `<p><strong>${esc(w.title)}</strong> ${w.personalized ? '<span class="badge">Personalizado para você</span>' : ""}</p>
             <p class="muted">${esc(w.category || "")}</p>
             <a class="btn btn-primary" href="#treino/${t}">${label}</a>`
          : `<div class="empty"><p>Nenhum treino publicado para hoje.</p></div>`}
      <p class="muted" style="margin-top:.8rem"><a href="#semana">Ver semana</a> · <a href="#presenca">Histórico de presença</a></p>
      ${next[0] ? `<p class="muted" style="margin-top:.8rem">Próximo treino: <a href="#treino/${next[0].workout_date}">${fmtDate(next[0].workout_date)} · ${esc(next[0].title)}</a></p>` : ""}
    </section>${homeExtras(evs, prods)}`;
  bindCheckin(); countUp(view); animateBars();
  celebrate({ unlocked: g.unlocked });
}

const fmtResult = (r, type) => {
  if (!r) return "";
  const p = [];
  if (r.time_seconds != null) p.push(`Tempo ${Math.floor(r.time_seconds / 60)}:${String(r.time_seconds % 60).padStart(2, "0")}`);
  if (r.rounds != null) p.push(`${r.rounds} rounds`);
  if (r.reps != null) p.push(`${r.reps} reps`);
  if (r.load_kg != null) p.push(`${r.load_kg} kg`);
  return p.join(" · ");
};
const num = (id) => { const v = document.getElementById(id)?.value.trim(); return v ? Number(v) : null; };
function collect(type) {
  const r = { notes: $("#rnotes").value.trim() };
  const bad = (m) => { toast(m, "error"); return false; };
  if (type === "time") {
    const m = num("rmin") || 0, s = num("rsec") || 0;
    if (m < 0 || s < 0 || s > 59 || (m === 0 && s === 0)) return bad("Informe o tempo (segundos de 0 a 59).");
    r.time_seconds = m * 60 + s;
  } else if (type === "rounds_reps") {
    r.rounds = num("rrounds"); r.reps = num("rreps");
    if (r.rounds == null && r.reps == null) return bad("Informe rounds e/ou repetições.");
  } else if (type === "load") {
    r.load_kg = num("rload"); if (r.load_kg == null || r.load_kg < 0) return bad("Informe a carga em kg.");
  } else if (type === "reps") {
    r.reps = num("rreps"); if (r.reps == null || r.reps < 0) return bad("Informe as repetições.");
  }
  return r;
}
const resultFields = (type) => ({
  time: '<div class="field-row"><div><label for="rmin">Minutos</label><input id="rmin" type="number" min="0" inputmode="numeric"></div><div><label for="rsec">Segundos</label><input id="rsec" type="number" min="0" max="59" inputmode="numeric"></div></div>',
  rounds_reps: '<div class="field-row"><div><label for="rrounds">Rounds</label><input id="rrounds" type="number" min="0" inputmode="numeric"></div><div><label for="rreps">Repetições</label><input id="rreps" type="number" min="0" inputmode="numeric"></div></div>',
  load: '<label for="rload">Carga (kg)</label><input id="rload" type="number" min="0" step="0.5" inputmode="decimal">',
  reps: '<label for="rreps">Repetições</label><input id="rreps" type="number" min="0" inputmode="numeric">',
}[type] || "");

function sessionBlock(w, s, date, today) {
  if (date > today) return `<section class="card"><p class="muted">O treino é liberado no próprio dia.</p></section>`;
  if (s?.status === "completed") {
    const res = Array.isArray(s.workout_results) ? s.workout_results[0] : s.workout_results;
    return `<section class="card"><p class="ok"><i class="fa-solid fa-circle-check"></i> Treino concluído às ${fmtTime(s.finished_at)}</p>
      ${res ? `<p>${esc(fmtResult(res))}</p>${res.notes ? `<p class="muted pre">${esc(res.notes)}</p>` : ""}` : ""}</section>`;
  }
  if (date < today) return `<section class="card"><p class="muted">Este treino já passou e não foi concluído.</p></section>`;
  if (!s) return `<section class="card"><button class="btn btn-primary" id="start"><i class="fa-solid fa-play"></i> Iniciar treino</button></section>`;
  return `<section class="card"><h3>Em andamento</h3><p class="muted">Iniciado às ${fmtTime(s.started_at)}</p>
    ${resultFields(w.result_type)}
    <label for="rnotes">Observações (opcional)</label><textarea id="rnotes" maxlength="500"></textarea>
    <button class="btn btn-primary" id="finish"><i class="fa-solid fa-flag-checkered"></i> Finalizar treino</button></section>`;
}

async function treino(date, routeId) {
  const t = todaySP(); date = date || t;
  const w = await W.getWorkout(date);
  if (!isCurrentRoute(routeId)) return;
  const head = `<header class="bar"><a class="back" href="#semana/${mondayOf(date)}" aria-label="Voltar para a semana"><i class="fa-solid fa-chevron-left"></i></a><h2>${fmtDate(date, { weekday: "long", day: "2-digit", month: "long" })}</h2></header>`;
  if (!w) { view.innerHTML = head + '<div class="card empty"><i class="fa-solid fa-bed"></i><p>Sem treino publicado neste dia.</p></div>'; return; }
  const s = await W.getSession(w.id, user.id);
  if (!isCurrentRoute(routeId)) return;
  const sec = (ic, title, x) => x ? `<section class="card"><h3><i class="fa-solid ${ic}"></i> ${title}</h3><p class="pre">${esc(x)}</p></section>` : "";
  const movs = (w.movements || []).length ? `<section class="card"><h3><i class="fa-solid fa-list-check"></i> Movimentos</h3><ul class="rows">${w.movements.map((m) => `<li><strong>${esc(m.name)}</strong><span>${esc(m.prescription)}</span></li>`).join("")}</ul></section>` : "";
  view.innerHTML = head + `
    <section class="card"><h3>${esc(w.title)}</h3>
      <div class="meta">${w.category ? `<span class="badge">${esc(w.category)}</span>` : ""}${w.estimated_minutes ? `<span class="badge">${w.estimated_minutes} min</span>` : ""}${w.personalized ? '<span class="badge warn">Versão personalizada para você</span>' : ""}</div>
      ${(w.equipment || []).length ? `<p class="muted">Equipamentos: ${esc(w.equipment.join(", "))}</p>` : ""}</section>
    ${sec("fa-bolt", "Suas cargas", w.loads)}${sec("fa-triangle-exclamation", "Restrições", w.restrictions)}
    ${sec("fa-fire-flame-curved", "Aquecimento", w.warmup)}${sec("fa-person-walking", "Mobilidade", w.mobility)}
    ${sec("fa-dumbbell", "Força / técnica", w.strength)}${sec("fa-stopwatch", "WOD", w.wod)}${movs}
    ${sec("fa-layer-group", "Escalas", w.scales)}${sec("fa-comment", "Recado do treinador", w.coach_notes)}
    ${sessionBlock(w, s, date, t)}`;
  $("#start")?.addEventListener("click", (e) => guarded(e.currentTarget, async () => {
    try { await W.startSession(w.id); toast("Treino iniciado."); await route(); } catch (err) { toast(friendly(err), "error"); }
  }));
  $("#finish")?.addEventListener("click", (e) => guarded(e.currentTarget, async () => {
    const r = collect(w.result_type); if (r === false) return;
    if (!confirm("Finalizar o treino agora? Isso não pode ser desfeito.")) return;
    try { const res = await W.finishSession(s.id, r); toast("Treino finalizado!"); await route(); celebrate(res); } catch (err) { toast(friendly(err), "error"); }
  }));
}

async function semana(arg, routeId) {
  const t = todaySP(), mon = mondayOf(arg || t);
  const rows = await W.listWeek(mon, addDays(mon, 6));
  if (!isCurrentRoute(routeId)) return;
  const by = Object.fromEntries(rows.map((r) => [r.workout_date, r]));
  const days = [...Array(7)].map((_, i) => addDays(mon, i)).map((d) => {
    const w = by[d];
    const inner = `<span><strong>${fmtDate(d)}</strong></span><span>${w ? esc(w.title) : "Sem treino"}</span>`;
    const cls = `day${d === t ? " today" : ""}${w ? "" : " off"}`;
    return w ? `<a class="${cls}" href="#treino/${d}">${inner}</a>` : `<div class="${cls}">${inner}</div>`;
  }).join("");
  view.innerHTML = `<div class="weeknav"><a href="#semana/${addDays(mon, -7)}" aria-label="Semana anterior"><i class="fa-solid fa-chevron-left"></i></a>
    <h2>${fmtDate(mon, { day: "2-digit", month: "short" })} – ${fmtDate(addDays(mon, 6), { day: "2-digit", month: "short" })}</h2>
    <a href="#semana/${addDays(mon, 7)}" aria-label="Próxima semana"><i class="fa-solid fa-chevron-right"></i></a></div>${days}`;
}

async function presenca(_arg, routeId) {
  const [st, hist] = await Promise.all([A.myStats(), A.myAttendance(user.id)]);
  if (!isCurrentRoute(routeId)) return;
  view.innerHTML = `<h2>Presença</h2>
    <section class="stats">${stat("fa-calendar-check", st.presences, "presenças")}${stat("fa-dumbbell", st.completed, "treinos")}${stat("fa-fire", st.streak, "sequência")}</section>
    ${checkinCard(st.checked_in_today)}
    <section class="card"><h3>Histórico</h3>${hist.length
      ? `<ul class="rows">${hist.map((h) => `<li><strong>${fmtDate(h.attendance_date)}</strong><span>${h.status === "present" ? "Presente" : "Falta justificada"}${h.source === "admin" ? " (treinador)" : ""}</span></li>`).join("")}</ul>`
      : '<div class="empty"><p>Nenhuma presença ainda. Faça seu primeiro check-in!</p></div>'}</section>
    <p class="muted">Sequência: dias de treino programado seguidos com presença.</p>`;
  bindCheckin(); countUp(view);
}

const perfilStats = (st, sess) => `<section class="stats">${stat("fa-calendar-check", st.presences, "presenças")}${stat("fa-dumbbell", st.completed, "treinos")}${stat("fa-fire", st.streak, "sequência")}</section>
  <section class="card"><h3><i class="fa-solid fa-list-check"></i> Histórico de treinos</h3>${sess.length ? `<ul class="rows">${sess.map((x) => {
    const workout = x.workouts;
    const workoutDate = workout?.workout_date ? fmtDate(workout.workout_date) : x.finished_at ? dBR(x.finished_at) : "Data indisponível";
    const workoutTitle = workout?.title || "Treino não disponível";
    return `<li><span style="text-align:left;color:var(--white)">${esc(workoutTitle)}<small class="muted" style="display:block">${esc(workoutDate)}</small></span><span>${esc(fmtResult(Array.isArray(x.workout_results) ? x.workout_results[0] : x.workout_results))}</span></li>`;
  }).join("")}</ul>` : '<div class="empty"><p>Nenhum treino concluído ainda.</p></div>'}</section>
  <a class="btn" href="#conquistas"><i class="fa-solid fa-trophy"></i> Ver conquistas</a>`;

async function perfil(_arg, routeId) {
  const [g, tx, st, sess] = await Promise.all([G.myGame(), G.myXpTx(user.id, 8), A.myStats(), W.mySessions(user.id, 8)]);
  if (!isCurrentRoute(routeId)) return;
  const extras = `${xpCard(g)}${perfilStats(st, sess)}<section class="card"><h3><i class="fa-solid fa-clock-rotate-left"></i> Histórico de XP</h3>${tx.length ? `<ul class="rows">${tx.map((t) => `<li><span style="text-align:left;color:var(--white)">${esc(SOURCE[t.source] || t.source)}<small class="muted" style="display:block">${esc(t.reason || "")} · ${dBR(t.created_at)}</small></span><strong class="${t.amount > 0 ? "ok" : ""}">${t.amount > 0 ? "+" : ""}${t.amount}</strong></li>`).join("")}</ul>` : '<div class="empty"><p>Sem XP ainda. Faça check-in!</p></div>'}</section>
    ${g.throne.total_seconds > 0 ? `<section class="card"><h3><i class="fa-solid fa-crown"></i> Seu histórico no Trono</h3><p>Tempo total: <strong>${fmtDuration(g.throne.total_seconds)}</strong></p><p class="muted">Maior sequência de dias no trono: ${g.throne.best_consecutive_days}</p></section>` : ""}
    <section class="card"><h3>Níveis alcançados</h3><ul class="rows">${g.levels.map((l) => `<li><strong>Nível ${l.level}</strong><span>${dBR(l.reached_at)}</span></li>`).join("")}</ul></section>
    <p class="muted"><a href="#presenca">Histórico de presença</a> · <a href="#semana">Semana de treinos</a></p>`;
  view.innerHTML = `<h2>Perfil</h2><section class="card" style="text-align:center">
    <img class="avatar" src="${esc(avatarSrc())}" alt="Sua foto" width="96" height="96" referrerpolicy="no-referrer">
    <p class="muted">No box desde ${new Date(profile.joined_at).toLocaleDateString("pt-BR")}</p>
    <form id="pf" novalidate style="text-align:left"><label for="name">Nome de exibição</label><input id="name" maxlength="40" value="${esc(profile.display_name)}">
    <span class="photo-label">Foto de perfil</span>
    <div class="photo-picker">
      <div class="photo-preview"><img id="photo-preview" src="${esc(avatarSrc())}" alt="Prévia da foto de perfil" width="76" height="76" referrerpolicy="no-referrer"><span><i class="fa-solid fa-camera"></i></span></div>
      <div class="photo-picker-copy"><strong id="photo-title">Sua foto, do seu jeito</strong><small id="photo-hint">JPG, PNG, WebP ou AVIF · escolha uma imagem nítida</small>
        <label class="photo-select" for="photo"><i class="fa-solid fa-arrow-up-from-bracket" aria-hidden="true"></i> Escolher foto</label>
        <span class="photo-filename" id="photo-filename" aria-live="polite">Nenhum arquivo novo selecionado</span>
      </div>
      <input class="photo-input" id="photo" type="file" accept="image/jpeg,image/png,image/webp,image/avif" aria-describedby="photo-hint">
    </div>
    <button class="btn btn-primary" id="save" type="submit" style="margin-top:1rem">Salvar alterações</button></form></section>
    ${extras}<button class="btn" id="logout"><i class="fa-solid fa-right-from-bracket"></i> Sair</button>`;
  animateBars(); countUp(view);
  $("#logout").onclick = signOut;
  $("#photo").addEventListener("change", (e) => {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    const preview = $("#photo-preview");
    const previousUrl = preview.dataset.objectUrl;
    if (previousUrl) URL.revokeObjectURL(previousUrl);
    const objectUrl = URL.createObjectURL(file);
    preview.dataset.objectUrl = objectUrl;
    preview.src = objectUrl;
    $("#photo-title").textContent = "Foto pronta para salvar";
    $("#photo-filename").textContent = file.name;
  });
  $("#pf").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#name").value.trim();
    if (name.length < 2) return toast("Digite um nome com 2+ letras.", "error");
    guarded($("#save"), async () => {
      try {
        const f = $("#photo").files[0];
        const avatar_path = f ? await uploadAvatar(f, user.id) : null;
        await completeSetup(user.id, { display_name: name, avatar_path });
        profile = await getMyProfile(user.id); toast("Perfil atualizado."); await route();
      } catch (err) { toast(friendly(err), "error"); }
    });
  });
}

const rankRows = (rows) => rows.map((r) => `<li class="rk ${r.is_me ? "me" : ""}"><span class="pos">${r.rank === 1 ? '<i class="fa-solid fa-crown" aria-label="1º lugar"></i>' : r.rank}</span>
  <img class="avatar-xs" src="${esc(avatarOf(r))}" alt="" loading="lazy" referrerpolicy="no-referrer"><span><strong>${esc(r.display_name)}</strong>${r.is_me ? " (você)" : ""}<small>Nível ${r.level}</small></span>
  <span class="xp">${r.xp_total} XP${r.gap_to_first > 0 ? `<small>−${r.gap_to_first}</small>` : ""}</span></li>`).join("");

async function ranking(tab = "xp", routeId) {
  const seg = `<nav class="seg" aria-label="Rankings">${[["xp", "XP"], ["freq", "Frequência"], ["trono", "O Trono"]].map(([k, l]) => `<a href="#ranking/${k}" aria-selected="${k === tab}">${l}</a>`).join("")}</nav>`;
  if (tab === "freq") {
    const rows = await G.attendanceRanking(30);
    if (!isCurrentRoute(routeId)) return;
    view.innerHTML = `${seg}<section class="card"><h3>Frequência · 30 dias</h3>${rows.length ? `<ul style="padding:0">${rows.map((r, i) => `<li class="rk ${r.is_me ? "me" : ""}"><span class="pos">${i + 1}</span>
      <img class="avatar-xs" src="${esc(avatarOf(r))}" alt="" loading="lazy" referrerpolicy="no-referrer"><span><strong>${esc(r.display_name)}</strong><small>${r.presences} presenças · ${r.completed} treinos · sequência ${r.streak}${r.absences != null ? ` · faltas ${r.absences}` : ""}</small></span>
      <span class="xp">${r.frequency_pct}%</span></li>`).join("")}</ul>` : '<div class="empty"><p>Sem alunos no ranking ainda.</p></div>'}
      <p class="muted">Frequência = presenças em dias de treino programado. Faltas só aparecem para você e para o treinador.</p></section>`;
  } else if (tab === "trono") {
    const th = await G.getThrone(), k = th.king;
    if (!isCurrentRoute(routeId)) return;
    view.innerHTML = `${seg}${k ? `<section class="card king king-ranking-spotlight"><i class="fa-solid fa-crown"></i><img src="${esc(avatarOf(k))}" alt="" referrerpolicy="no-referrer"><h2>${esc(k.name)}</h2>
      <p class="muted">Nível ${k.level} · ${k.xp} XP</p><p>No trono há <strong>${fmtDuration(k.summary.current_reign_seconds)}</strong></p>
      <p class="muted">Total acumulado: ${fmtDuration(k.summary.total_seconds)} · dias seguidos: ${k.summary.current_consecutive_days}</p></section>`
      : '<section class="card empty"><i class="fa-solid fa-crown"></i><p>O trono está vazio. Ganhe XP para assumir!</p></section>'}
      ${th.hall.length ? `<section class="card"><h3>Mais tempo no trono</h3><ul class="rows">${th.hall.map((h) => `<li><strong>${esc(h.name)}</strong><span>${fmtDuration(h.seconds)}</span></li>`).join("")}</ul></section>` : ""}
      ${th.champions.length ? `<section class="card"><h3>Campeões</h3><ul class="rows">${th.champions.map((c) => `<li><span style="text-align:left;color:var(--white)">${c.type === "week" ? "Semana de " + fmtDate(c.start) : "Mês de " + fmtDate(c.start, { month: "long", year: "numeric" })}</span><span>${esc(c.name)} · ${c.xp} XP</span></li>`).join("")}</ul></section>` : ""}
      ${th.history.length ? `<section class="card"><h3>Antigos líderes</h3><ul class="rows">${th.history.map((h) => `<li><strong>${esc(h.name)}</strong><span>${dBR(h.started_at)}${h.ended_at ? "" : " (atual)"} · ${fmtDuration(h.seconds)}</span></li>`).join("")}</ul></section>` : ""}
      <p class="muted">O líder é quem tem mais XP total; empate: quem chegou primeiro àquele total.</p>`;
  } else {
    const PAGE = 30; let off = 0;
    const first = await G.xpRanking(PAGE, 0);
    if (!isCurrentRoute(routeId)) return;
    view.innerHTML = `${seg}<section class="card"><h3>Ranking de XP</h3>${first.length ? `<ul id="rk" style="padding:0">${rankRows(first)}</ul>` : '<div class="empty"><p>Sem alunos no ranking ainda.</p></div>'}
      ${first.length === PAGE ? '<button class="btn" id="more">Ver mais</button>' : ""}<p class="muted">Aparecem: foto, nome, nível e XP.</p></section>`;
    $("#more")?.addEventListener("click", (e) => guarded(e.currentTarget, async () => {
      try { off += PAGE; const more = await G.xpRanking(PAGE, off); $("#rk").insertAdjacentHTML("beforeend", rankRows(more)); if (more.length < PAGE) e.currentTarget.remove(); } catch (err) { toast(friendly(err), "error"); }
    }));
  }
}

async function conquistas(_arg, routeId) {
  const list = await G.myAchievements(), done = list.filter((a) => a.unlocked_at).length;
  if (!isCurrentRoute(routeId)) return;
  view.innerHTML = `<h2>Conquistas</h2><p class="muted">${done} de ${list.length} desbloqueadas</p><div class="ach-grid">${list.map((a) => {
    const on = !!a.unlocked_at, pct = Math.min(100, Math.round(100 * a.current / a.target)), rw = a.xp_reward ? ` · +${a.xp_reward} XP` : "";
    return `<div class="ach ${on ? "on" : ""}"><i class="fa-solid ${esc(a.icon)}"></i><div><strong>${esc(a.name)}</strong> <span class="badge rar-${esc(a.rarity)}">${RAR[a.rarity] || ""}</span>
      <small>${esc(a.description)}</small>${on ? `<small>Desbloqueada em ${dBR(a.unlocked_at)}${rw}</small>` : `<div class="xp-track"><div class="xp-fill" data-pct="${pct}"></div></div><small>${a.current} / ${a.target}${rw}</small>`}</div></div>`;
  }).join("")}</div>`;
  animateBars();
}

const cover = (bucket, path) => path ? `<img class="cover" loading="lazy" alt="" src="${esc(publicUrl(bucket, path))}">` : "";
const evCard = (e) => `<a class="card" href="#evento/${e.id}" style="text-decoration:none;color:inherit;display:block">${cover("event-banners", e.cover_path)}<h3>${esc(e.title)}</h3>
  <p class="muted">${fmtDateTime(e.starts_at)}${e.location ? " · " + esc(e.location) : ""}</p>
  ${e.status === "cancelled" ? '<span class="badge warn">Cancelado</span>' : e.rescheduled ? '<span class="badge warn">Data alterada</span>' : ""} ${e.xp_reward ? `<span class="badge">+${e.xp_reward} XP</span>` : ""}</a>`;

async function eventos(_arg, routeId) {
  const all = await E.listEvents(), now = Date.now();
  if (!isCurrentRoute(routeId)) return;
  const up = all.filter((e) => e.status === "published" && new Date(e.starts_at) >= now).reverse();
  const past = all.filter((e) => !up.includes(e));
  view.innerHTML = `<h2>Eventos</h2>${up.length ? up.map(evCard).join("") : '<div class="card empty"><i class="fa-solid fa-calendar-xmark"></i><p>Nenhum evento futuro por enquanto.</p></div>'}
    ${past.length ? `<h3>Anteriores</h3>${past.map(evCard).join("")}` : ""}`;
}

async function evento(id, routeId) {
  const e = await E.getEvent(id);
  if (!isCurrentRoute(routeId)) return;
  const back = '<header class="bar"><a class="back" href="#eventos" aria-label="Voltar aos eventos"><i class="fa-solid fa-chevron-left"></i></a><h2>Evento</h2></header>';
  if (!e || e.status === "draft") { view.innerHTML = back + '<div class="card empty"><p>Evento não encontrado.</p></div>'; return; }
  const [reg, part] = await Promise.all([E.myRegistration(id, user.id), E.myParticipation(id, user.id)]);
  if (!isCurrentRoute(routeId)) return;
  const future = new Date(e.starts_at) > Date.now(), canReg = e.status === "published" && e.registration_enabled && future;
  const active = reg && reg.status !== "cancelled";
  const info = (ic, t) => t ? `<p><i class="fa-solid ${ic}" style="color:var(--neon);width:1.4rem"></i> ${esc(t)}</p>` : "";
  view.innerHTML = back + `<section class="card">${cover("event-banners", e.cover_path)}<h3>${esc(e.title)}</h3>
    ${e.status === "cancelled" ? '<p><span class="badge warn">Evento cancelado</span></p>' : e.status === "closed" ? '<p><span class="badge">Encerrado</span></p>' : e.rescheduled ? '<p><span class="badge warn">Data alterada — confira o novo horário</span></p>' : ""}
    ${info("fa-clock", fmtDateTime(e.starts_at))}${info("fa-location-dot", e.location)}${info("fa-tag", e.category)}${e.xp_reward ? info("fa-bolt", `+${e.xp_reward} XP após validação do treinador`) : ""}
    ${e.description ? `<p class="pre" style="margin-top:.6rem">${esc(e.description)}</p>` : ""}${e.extra_info ? `<p class="pre muted">${esc(e.extra_info)}</p>` : ""}
    ${e.rules ? `<h3 style="margin-top:.8rem">Regras</h3><p class="pre muted">${esc(e.rules)}</p>` : ""}
    ${/^https?:\/\//i.test(e.external_url || "") ? `<p><a href="${esc(e.external_url)}" target="_blank" rel="noopener noreferrer">Mais informações <i class="fa-solid fa-arrow-up-right-from-square"></i></a></p>` : ""}</section>
    <section class="card">${part ? '<p class="ok"><i class="fa-solid fa-circle-check"></i> Participação validada pelo treinador</p>'
      : canReg ? `${active ? `<p class="ok">${reg.status === "confirmed" ? "Participação confirmada" : "Você marcou interesse"}</p>` : ""}
        ${!active || reg.status === "interested" ? '<button class="btn btn-primary" data-s="confirmed">Confirmar participação</button>' : ""}
        ${!active ? '<button class="btn" data-s="interested">Tenho interesse</button>' : ""}${active ? '<button class="btn" data-s="cancelled">Cancelar inscrição</button>' : ""}`
      : '<p class="muted">Inscrições indisponíveis para este evento.</p>'}
      <p class="muted" style="margin-top:.6rem">Clicar em participar não gera XP: o treinador valida a participação depois do evento.</p></section>`;
  view.querySelectorAll("[data-s]").forEach((b) => b.addEventListener("click", () => guarded(b, async () => {
    try { await E.setRegistration(id, b.dataset.s); toast("Inscrição atualizada."); await route(); } catch (err) { toast(friendly(err), "error"); }
  })));
}

async function loja(_arg, routeId) {
  const [list, num] = await Promise.all([S.listProducts(), S.whatsapp()]);
  if (!isCurrentRoute(routeId)) return;
  view.innerHTML = `<h2>Loja do Box</h2>${num ? "" : '<p class="muted">Pedidos pelo WhatsApp: configuração pendente (fale com o treinador).</p>'}
    ${list.length ? `<div class="prod-grid">${list.map((p) => {
      const can = p.availability === "available";
      const act = !can ? '<button class="btn" disabled>Indisponível</button>' : num
        ? `<a class="btn btn-primary" target="_blank" rel="noopener noreferrer" href="${esc(S.waLink(num, p.title))}"><i class="fa-brands fa-whatsapp"></i> Pedir pelo WhatsApp</a>`
        : '<button class="btn" data-nowa>Pedir pelo WhatsApp</button>';
      return `<article class="card prod">${cover("product-images", p.image_path)}${p.featured ? '<span class="badge">Destaque</span>' : ""}<strong>${esc(p.title)}</strong>
        ${p.description ? `<small class="muted pre">${esc(p.description)}</small>` : ""}${p.price != null ? `<strong class="ok">${S.brl(p.price)}</strong>` : ""}${act}</article>`;
    }).join("")}</div>` : '<div class="card empty"><i class="fa-solid fa-bag-shopping"></i><p>Nenhum produto disponível ainda.</p></div>'}`;
  view.querySelectorAll("[data-nowa]").forEach((b) => b.addEventListener("click", () => toast("O WhatsApp do treinador ainda não foi configurado.", "error")));
}

function mais() {
  const item = (h, ic, t) => `<a class="day" href="${h}"><span><i class="fa-solid ${ic}" style="color:var(--neon);width:1.6rem"></i> ${t}</span><i class="fa-solid fa-chevron-right"></i></a>`;
  view.innerHTML = `<h2>Mais</h2>${item("#conquistas", "fa-trophy", "Conquistas")}${item("#loja", "fa-bag-shopping", "Loja do Box")}${item("#semana", "fa-calendar-week", "Semana de treinos")}
    ${item("#presenca", "fa-calendar-check", "Presença")}${item("#perfil", "fa-user", "Meu perfil")}`;
}

const ROUTES = { inicio, treino, semana, presenca, perfil, ranking, conquistas, eventos, evento, loja, mais };
let appStarted = false;
let activeRouteId = 0;
let activeRouteHash = location.hash;
const isCurrentRoute = (routeId) => routeId === activeRouteId && location.hash === activeRouteHash;
function startApp() {
  if (!appStarted) {
    appStarted = true;
    window.addEventListener("hashchange", route);
  }
  const requestedRoute = location.hash.slice(1).split("/")[0];
  if (!ROUTES[requestedRoute]) {
    history.replaceState(null, "", `${location.pathname}${location.search}#inicio`);
  }
  $("#nav").classList.remove("hidden");
  return route();
}
async function route() {
  const routeId = ++activeRouteId;
  activeRouteHash = location.hash;
  const [name = "inicio", arg] = location.hash.slice(1).split("/");
  document.querySelectorAll("#nav a").forEach((a) => a.setAttribute("aria-current", a.dataset.r === (["conquistas", "loja", "perfil", "semana", "presenca"].includes(name) ? "mais" : name === "evento" ? "eventos" : name) ? "page" : "false"));
  loading();
  try { await (ROUTES[name] || inicio)(arg, routeId); if (!isCurrentRoute(routeId)) return; animateIn(view); }
  catch (e) { if (!isCurrentRoute(routeId)) return; view.innerHTML = `<div class="card"><p>${esc(friendly(e))}</p><button class="btn" id="retry">Tentar de novo</button></div>`; $("#retry").onclick = route; animateIn(view); }
}

function setup() {
  $("#nav").classList.add("hidden");
  view.innerHTML = `<section class="card"><h2>Monte seu perfil</h2><p class="muted">Você só faz isso uma vez. Dá para mudar depois.</p>
    <form id="sf" novalidate><label for="name">Nome de exibição</label><input id="name" maxlength="40" value="${esc(profile.display_name)}">
    <label for="photo">Foto (opcional)</label><input id="photo" type="file" accept="image/jpeg,image/png,image/webp,image/avif">
    <button class="btn btn-primary" id="sb" type="submit" style="margin-top:1rem">Salvar e continuar</button></form></section>`;
  $("#sf").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = $("#name").value.trim();
    if (name.length < 2) return toast("Digite um nome com 2+ letras.", "error");
    guarded($("#sb"), async () => {
      try {
        const f = $("#photo").files[0];
        const avatar_path = f ? await uploadAvatar(f, user.id) : null;
        await completeSetup(user.id, { display_name: name, avatar_path });
        profile = await getMyProfile(user.id); toast("Perfil salvo."); await startApp();
      } catch (err) { toast(friendly(err), "error"); }
    });
  });
  animateIn(view);
}

try {
  user = await requireUser();
  if (user) {
    profile = await getMyProfile(user.id);
    if (profile.status === "suspended") { toast("Seu acesso está suspenso. Fale com o treinador.", "error"); setTimeout(signOut, 2500); }
    else if (!profile.profile_setup_done) setup();
    else await startApp();
  }
} catch (e) { view.innerHTML = `<div class="card"><p>${esc(friendly(e))}</p></div>`; }
