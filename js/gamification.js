import { supabase } from "./supabase-client.js";
import { esc, reducedMotion } from "./ui.js";
const ok = ({ data, error }) => { if (error) throw error; return data; };
export const myGame = () => supabase.rpc("my_gamification").then(ok);
export const myAchievements = () => supabase.rpc("my_achievements").then(ok);
export const xpRanking = (limit = 50, offset = 0) => supabase.rpc("get_xp_ranking", { p_limit: limit, p_offset: offset }).then(ok);
export const attendanceRanking = (days = 30) => supabase.rpc("get_attendance_ranking", { p_days: days }).then(ok);
export const getThrone = () => supabase.rpc("get_throne").then(ok);
export const myXpTx = (uid, limit = 10) =>
  supabase.from("xp_transactions").select("amount,source,reason,created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(limit).then(ok);
export const claimRewardNotification = async () => {
  const rows = await supabase.rpc("claim_reward_notification").then(ok);
  return rows?.[0] || null;
};
export const ackRewardNotification = (id, token) =>
  supabase.rpc("ack_reward_notification", { p_notification_id: id, p_claim_token: token }).then(ok);

export const SOURCE = { checkin: "Check-in", workout_completed: "Treino concluído", result_logged: "Resultado registrado", achievement: "Conquista",
  event: "Evento", manual_bonus: "Bônus do treinador", adjustment: "Ajuste do treinador", reversal: "Estorno" };
const RARITY = { common: "Comum", rare: "Rara", epic: "Épica", legendary: "Lendária" };
export function fmtDuration(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}min` : `${m}min`;
}
export function animateBar(el, pct) {
  if (!el) return;
  if (!window.gsap || reducedMotion()) { el.style.width = pct + "%"; return; }
  window.gsap.fromTo(el, { width: "0%" }, { width: pct + "%", duration: .9, ease: "power2.out" });
}

// Mostra um único aviso por vez; a fila só é confirmada pelo chamador após a pessoa continuar/fechar.
export function showRewardNotification(notification) {
  if (!notification || !document.body) return Promise.resolve();
  const p = notification.payload || {};
  let heading, body = "", icon = "fa-bolt", detail = "";
  if (notification.event_type === "achievement") {
    const rarity = RARITY[p.rarity] || "Conquista";
    heading = "Conquista desbloqueada";
    icon = p.icon || "fa-trophy";
    body = `<div class="cel-ach rar-${esc(p.rarity || "common")}"><i class="fa-solid ${esc(icon)}" aria-hidden="true"></i><div><strong>${esc(p.name || "Nova conquista")}</strong><small>${esc(rarity)}</small></div></div>`;
    detail = `<p class="xp-gain">+${Number(p.xp) || 0} XP</p><p class="reward-origin">Origem: Conquista</p>`;
  } else if (notification.event_type === "level") {
    heading = "Nível alcançado!";
    icon = "fa-angles-up";
    body = `<p class="reward-level">Nível <strong>${Number(p.level) || 1}</strong></p>`;
    detail = `<p class="reward-origin">Sua evolução continua. Parabéns!</p>`;
  } else {
    const amount = Number(p.amount) || 0;
    const source = SOURCE[p.source] || p.source || "Atividade";
    heading = `+${amount} XP`;
    body = `<p class="reward-origin">Origem: <strong>${esc(source)}</strong></p>${p.reason ? `<p class="reward-reason">${esc(p.reason)}</p>` : ""}`;
    detail = "";
  }
  const el = document.createElement("div");
  el.className = "celebrate";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute("aria-labelledby", "reward-title");
  el.innerHTML = `<section class="celebrate-card reward-card"><div class="reward-emblem" aria-hidden="true"><i class="fa-solid ${esc(icon)}"></i></div>
    <h2 id="reward-title">${esc(heading)}</h2>${body}${detail}<button class="btn btn-primary" id="reward-continue" type="button">Continuar</button></section>`;
  document.body.append(el);
  const previousFocus = document.activeElement;
  const btn = el.querySelector("#reward-continue");
  return new Promise((resolve) => {
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      document.removeEventListener("keydown", onKey);
      el.remove();
      if (previousFocus?.isConnected) previousFocus.focus();
      resolve();
    };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    btn.addEventListener("click", close, { once: true });
    document.addEventListener("keydown", onKey);
    btn.focus();
    if (window.gsap && !reducedMotion()) {
      window.gsap.fromTo(el.querySelector(".celebrate-card"), { scale: .9, opacity: 0, y: 12 }, { scale: 1, opacity: 1, y: 0, duration: .38, ease: "back.out(1.5)" });
    }
  });
}
