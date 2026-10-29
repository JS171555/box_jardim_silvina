// Microinterações visuais (GSAP). Não altera dados nem lógica do app.
(() => {
  const reduce = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const g = () => (!reduce() && window.gsap) || null;

  // Efeito de toque nos botões
  document.addEventListener("pointerdown", (e) => {
    const b = e.target.closest(".btn, .tab, .seg a, #nav a");
    if (!b || b.disabled || !g()) return;
    const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height) * 1.4;
    const dot = document.createElement("span");
    dot.className = "ripple";
    Object.assign(dot.style, { width: s + "px", height: s + "px", left: e.clientX - r.left - s / 2 + "px", top: e.clientY - r.top - s / 2 + "px" });
    if (getComputedStyle(b).position === "static") b.style.position = "relative";
    b.style.overflow = "hidden";
    b.append(dot);
    gsap.to(dot, { scale: 1, opacity: 0, duration: .6, ease: "power2.out", onComplete: () => dot.remove() });
  }, { passive: true });

  // Transição suave quando a tela troca de conteúdo
  const watch = (el) => {
    if (!el) return;
    let t;
    new MutationObserver(() => {
      clearTimeout(t);
      t = setTimeout(() => {
        const G = g(); if (!G) return;
        G.fromTo(el.querySelectorAll(":scope > h2, :scope > .muted, :scope > .weeknav, :scope > .seg, .rk, .ach, .day, .stat, .rows li"),
          { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .4, stagger: { each: .025, amount: .35 }, ease: "power3.out", clearProps: "opacity,transform" });
      }, 0);
    }).observe(el, { childList: true });
  };

  // Toasts entram/saem com GSAP
  const toasts = () => {
    const box = document.getElementById("toasts"); if (!box) return;
    new MutationObserver((m) => m.forEach((r) => r.addedNodes.forEach((n) => {
      const G = g(); if (!G || n.nodeType !== 1) return;
      G.fromTo(n, { y: 16, opacity: 0, scale: .96 }, { y: 0, opacity: 1, scale: 1, duration: .45, ease: "back.out(1.7)" });
      setTimeout(() => n.isConnected && G.to(n, { opacity: 0, y: 8, duration: .3 }), 4600);
    }))).observe(box, { childList: true });
  };

  window.addEventListener("load", () => {
    watch(document.getElementById("view"));
    watch(document.getElementById("adm-view"));
    toasts();
    const G = g(); if (!G) return;
    const nav = document.getElementById("nav");
    if (nav) G.from(nav, { y: 40, opacity: 0, duration: .6, ease: "power3.out", delay: .1, clearProps: "transform,opacity" });
    const auth = document.querySelector(".auth:not(.hidden)");
    if (auth) G.from(auth.querySelectorAll("h1, .card, :scope > p"), { y: 18, opacity: 0, duration: .6, stagger: .08, ease: "power3.out", delay: .15, clearProps: "opacity,transform" });
    document.querySelectorAll(".admin > header, .tabbar").forEach((el, i) => G.from(el, { y: -12, opacity: 0, duration: .5, delay: i * .08, clearProps: "opacity,transform" }));
  });
})();
