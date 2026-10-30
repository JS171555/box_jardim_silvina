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

export const SOURCE = { checkin: "Check-in", workout_completed: "Treino concluído", result_logged: "Resultado registrado", achievement: "Conquista",
  event: "Evento", manual_bonus: "Bônus do treinador", adjustment: "Ajuste do treinador", reversal: "Estorno" };
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
// Celebração de XP / nível / conquistas (overlay acessível; fecha com botão ou Esc).
export function celebrate(r) {
  const unlocked = r?.unlocked || [];
  if (!r || (!r.xp && !r.level_up && !unlocked.length)) return;
  const el = document.createElement("div");
  el.className = "celebrate"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Recompensa");
  el.innerHTML = `<div class="celebrate-card">
    ${r.level_up ? `<p class="lvl-up"><i class="fa-solid fa-angles-up"></i> Nível ${Number(r.level)}!</p>` : ""}
    ${r.xp ? `<p class="xp-gain">+<span id="cel-xp">0</span> XP</p>` : ""}
    ${unlocked.map((a) => `<div class="cel-ach rar-${esc(a.rarity)}"><i class="fa-solid ${esc(a.icon)}"></i><div><strong>${esc(a.name)}</strong><small>Conquista desbloqueada${a.xp ? ` · +${Number(a.xp)} XP` : ""}</small></div></div>`).join("")}
    <button class="btn btn-primary" id="cel-close">Continuar</button></div>`;
  document.body.append(el);
  const close = () => { document.removeEventListener("keydown", esc_); el.remove(); };
  const esc_ = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", esc_);
  const btn = el.querySelector("#cel-close"); btn.onclick = close; btn.focus();
  const xpEl = el.querySelector("#cel-xp");
  if (xpEl) {
    if (window.gsap && !reducedMotion()) {
      const o = { v: 0 };
      window.gsap.from(".celebrate-card", { scale: .85, opacity: 0, duration: .45, ease: "back.out(1.6)" });
      window.gsap.to(o, { v: r.xp, duration: .9, ease: "power2.out", onUpdate: () => { xpEl.textContent = Math.round(o.v); } });
    } else xpEl.textContent = r.xp;
  }
}
