export function toast(msg, type = "ok") {
  const box = document.getElementById("toasts");
  if (!box) return;
  const el = document.createElement("div");
  el.className = "toast " + (type === "error" ? "error" : "");
  el.setAttribute("role", type === "error" ? "alert" : "status");
  el.textContent = msg;
  box.append(el);
  setTimeout(() => el.remove(), 5000);
}
// Evita envio duplicado: desabilita o botão enquanto a ação roda.
export async function guarded(btn, fn) {
  if (btn.disabled) return;
  btn.disabled = true;
  try { return await fn(); } finally { btn.disabled = false; }
}
export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const MSGS = {
  "Invalid login credentials": "E-mail ou senha incorretos.",
  "Email not confirmed": "Confirme seu e-mail antes de entrar.",
  "User already registered": "Este e-mail já tem cadastro. Tente entrar.",
};
export const friendly = (e) =>
  MSGS[e?.message] || (e?.message?.includes("fetch") ? "Sem conexão. Verifique a internet e tente de novo." : e?.message || "Algo deu errado.");
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Contador com incremento suave (GSAP). Sem GSAP ou com movimento reduzido, mostra o valor direto.
export function countUp(root = document) {
  root.querySelectorAll("[data-count]").forEach((el) => {
    const to = Number(el.dataset.count) || 0;
    if (!window.gsap || reducedMotion() || !to) { el.textContent = to; return; }
    const o = { v: 0 };
    gsap.to(o, { v: to, duration: .8, ease: "power2.out", onUpdate: () => { el.textContent = Math.round(o.v); } });
  });
}
