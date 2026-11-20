/* Famáci 2.0 · klikací prototyp. Běží celý v prohlížeči, nic se nikam neposílá.
   Přihlášení, souhlasy a vlastní profil se drží v localStorage (jen u tebe). */
(function () {
  "use strict";
  const { DEPTS, COHORTS, accounts: BASE, ascii } = window.FamaciData;
  const DEPT = Object.fromEntries(DEPTS.map((d) => [d.code, d]));
  const GENDER = { zena: "žena", muz: "muž", jine: "jiné" };
  const DOMAINS = ["famu.cz", "st.amu.cz"];   // rozhodnuto 20. 11. 2026
  const TERMS_VERSION = "1.0";
  const PAGE = 80;                        // po kolika lidech se seznam načítá
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const today = () => new Date().toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });
  const plural = (n, a, b, c) => n + " " + (n === 1 ? a : n >= 2 && n <= 4 ? b : c);
  const initials = (name) => { const p = String(name || "?").trim().split(/\s+/); return ((p[0] || "?")[0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase(); };

  /* ── stav (localStorage, s bezpečným záložním řešením) ── */
  const KEY = "famaci-prototyp-v1";
  let mem = {};
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return mem; } }
  function save(s) { mem = s; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* soukromé okno */ } }
  let S = load();
  // starší uložený formát ročníku 2024/25 -> 2024/2025
  if (S.profile && /^\d{4}\/\d{2}$/.test(S.profile.cohort || "")) { const y = +S.profile.cohort.slice(0, 4); S.profile.cohort = y + "/" + (y + 1); }
  if (S.profile && S.profile.dept && !DEPT[S.profile.dept]) S.profile.dept = "";
  const set = (patch) => { S = { ...S, ...patch }; save(S); };

  const loggedIn = () => !!S.email;
  const me = () => (S.profile ? { ...S.profile, id: "me", email: S.email, mine: true } : null);

  /* ── účty a role ──
     Role patří k účtu (ne k profilu): "user" = běžný uživatel, "admin" = administrátor.
     Zásahy adminů nad smyšlenými účty se ukládají jako změny v S.admin.acc, záznam do S.admin.log. */
  const ROLE = { user: "Uživatel", admin: "Admin" };
  const isAdmin = () => loggedIn() && S.role === "admin";
  const isoToday = () => new Date().toISOString().slice(0, 10);
  const fmtDate = (d) => {
    if (!d) return "";
    if (/^\d{4}-\d{2}-\d{2}/.test(d)) { const x = new Date(d); return x.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" }); }
    return d;
  };
  const fmtTime = (d) => new Date(d).toLocaleString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const adminState = () => ({ acc: {}, log: [], rep: {}, ...(S.admin || {}) });
  // nahlášení = smyšlená z data.js + odeslaná v tomto prohlížeči, se změnami stavu od adminů
  const BASE_REPORTS = window.FamaciData.reports;
  function reportsAll() {
    const R = adminState().rep;
    return [...(S.reports || []), ...BASE_REPORTS].map((r) => ({ ...r, ...(R[r.id] || {}) })).sort((x, y) => y.t.localeCompare(x.t));
  }
  const newReports = () => reportsAll().filter((r) => r.status === "new").length;
  function patchReport(id, p) { const A = adminState(); set({ admin: { ...A, rep: { ...A.rep, [id]: { ...(A.rep[id] || {}), ...p } } } }); }
  function myAccount() {
    return {
      id: "me", email: S.email, role: S.role || "user", created: S.created || isoToday(), lastLogin: isoToday(),
      blocked: false, hidden: !!S.hidden, hiddenBy: S.hidden ? S.hiddenBy || "user" : null, hiddenReason: S.hiddenReason || "",
      profile: S.profile ? { ...S.profile } : null, consents: { ...(S.consents || {}) }, mine: true,
    };
  }
  function merged(a, o) {
    return {
      ...a, ...o,
      profile: o.profileDeleted || !a.profile ? null : { ...a.profile, ...(o.profile || {}) },
      consents: { ...a.consents, ...(o.consents || {}) },
    };
  }
  function accountsAll() {
    const O = adminState().acc;
    const out = [];
    for (const a of BASE) {
      if (loggedIn() && a.email === S.email) continue;      // přihlášený účet je "me"
      const o = O[a.id]; if (o && o.deleted) continue;
      out.push(o ? merged(a, o) : a);
    }
    if (loggedIn()) out.push(myAccount());
    return out;
  }
  const getAcc = (id) => accountsAll().find((a) => a.id === id);
  function patchAcc(id, p) {
    if (id === "me") {
      const n = {};
      if ("role" in p) n.role = p.role;
      if (p.email) { n.email = p.email; n.knownEmail = p.email; }
      if ("hidden" in p) { n.hidden = p.hidden; n.hiddenBy = p.hiddenBy || null; n.hiddenReason = p.hiddenReason || ""; }
      if (p.profile) n.profile = { ...S.profile, ...p.profile };
      if (p.consents) n.consents = { ...(S.consents || {}), ...p.consents };
      if (p.profileDeleted) { n.profile = null; n.consents = {}; n.hidden = false; n.hiddenBy = null; }
      return set(n);
    }
    const A = adminState(); const o = { ...(A.acc[id] || {}) };
    for (const [k, v] of Object.entries(p)) {
      if (k === "profile" || k === "consents") o[k] = { ...(o[k] || {}), ...v };
      else o[k] = v;
    }
    set({ admin: { ...A, acc: { ...A.acc, [id]: o } } });
  }
  function logAction(acc, action, reason) {
    const A = adminState();
    const entry = { t: new Date().toISOString(), admin: S.email, action, target: acc.email, targetId: acc.id, reason };
    set({ admin: { ...A, log: [entry, ...A.log].slice(0, 500) } });
  }
  const adminCount = () => accountsAll().filter((a) => a.role === "admin" && !a.blocked).length;

  // adresář = zveřejněné profily aktivních účtů
  function everyone() {
    return accountsAll().filter((a) => a.profile && !a.hidden && !a.blocked)
      .map((a) => ({ ...a.profile, id: a.id, email: a.email, mine: !!a.mine }));
  }
  const byId = (id) => everyone().find((s) => s.id === id);

  /* ── drobné UI pomocníky ── */
  let toastT;
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("on");
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 2600);
  }
  function dialog(html, onReady) {
    const d = $("#dlg"); $("#dlg-body").innerHTML = html; d.showModal();
    $$("[data-close]", d).forEach((b) => b.addEventListener("click", () => d.close()));
    onReady && onReady(d);
  }
  function view(html, title) {
    const main = $("#obsah"); main.innerHTML = html;
    document.title = title ? title + " · Famáci 2.0" : "Famáci 2.0";
    const h = $("h1", main); if (h) { h.setAttribute("tabindex", "-1"); }
    return main;
  }
  function focusTitle() { const h = $("#obsah h1"); if (h) h.focus({ preventScroll: true }); }

  /* ── hlavička ── */
  const CARET = '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  function renderBar(active) {
    const bar = $("#bar");
    const inside = loggedIn() && S.rules;
    const m = me();
    bar.innerHTML = `
      <a class="brand" href="${inside ? "#/lide" : "index.html"}" aria-label="Famáci 2.0${inside ? ", adresář" : ", úvod"}">
        <span class="brand-word">Famáci</span><span class="brand-tag">2.0</span>
      </a>
      ${inside ? `<nav class="bar-nav" aria-label="Hlavní"><a href="#/lide" ${active === "lide" ? 'aria-current="page"' : ""}>Lidé</a>${isAdmin() ? `<a href="#/admin" class="nav-admin" ${active === "admin" ? 'aria-current="page"' : ""}>Administrace${newReports() ? ` <span class="nav-count" aria-label="${newReports()} nových nahlášení">${newReports()}</span>` : ""}</a>` : ""}</nav>` : ""}
      <div class="bar-end">
        ${loggedIn() ? `
        <div class="me">
          <button class="me-btn" id="me-btn" aria-haspopup="menu" aria-expanded="false" aria-controls="me-menu">
            <span class="ini ini-sm">${esc(initials(m ? m.name : S.email))}</span>${CARET}
            <span class="sr-only">Můj účet</span>
          </button>
          <div class="me-menu" id="me-menu" role="menu" hidden>
            <div class="me-head"><strong>${esc(m ? m.name : "Účet bez profilu")}</strong><span>${esc(S.email)}</span>${isAdmin() ? '<span class="badge badge-admin">Admin</span>' : ""}</div>
            <a role="menuitem" href="#/profil">${m ? "Upravit profil" : "Vytvořit profil"}</a>
            <a role="menuitem" href="#/nastaveni">Nastavení</a>
            ${isAdmin() ? '<a role="menuitem" href="#/admin">Administrace</a>' : ""}
            <hr>
            <button role="menuitem" type="button" id="logout">Odhlásit</button>
          </div>
        </div>` : `<a class="btn btn-line" href="index.html">Úvod</a>`}
      </div>`;
    const btn = $("#me-btn"); if (!btn) return;
    const menu = $("#me-menu");
    const items = () => $$("[role=menuitem]", menu);
    const open = (focusFirst) => { menu.hidden = false; btn.setAttribute("aria-expanded", "true"); if (focusFirst) items()[0].focus(); };
    const close = (refocus) => { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); if (refocus) btn.focus(); };
    btn.addEventListener("click", () => (menu.hidden ? open(false) : close(false)));
    btn.addEventListener("keydown", (e) => { if (e.key === "ArrowDown") { e.preventDefault(); open(true); } });
    menu.addEventListener("keydown", (e) => {
      const list = items(); const i = list.indexOf(document.activeElement);
      if (e.key === "ArrowDown") { e.preventDefault(); list[(i + 1) % list.length].focus(); }
      if (e.key === "ArrowUp") { e.preventDefault(); list[(i - 1 + list.length) % list.length].focus(); }
      if (e.key === "Escape") { e.preventDefault(); close(true); }
      if (e.key === "Tab") close(false);
    });
    document.addEventListener("click", (e) => { if (!menu.hidden && !e.target.closest(".me")) close(false); });
    menu.addEventListener("click", (e) => { if (e.target.closest("a")) close(false); });
    $("#logout").addEventListener("click", () => {
      set({ email: null }); toast("Odhlášeno."); location.hash = "#/prihlaseni";
    });
  }

  /* ── telefon: předvolba ze seznamu zemí (abecedně, s vlajkou) + číslo ──
     Ukládá se "+420 777 123 456" a kód země (phoneCountry), aby šlo rozlišit třeba USA a Kanadu (+1). */
  const { COUNTRIES, BY_ISO, flagOf, isoFromPhone } = window.FamaciCountries;
  const NINE = ["CZ", "SK"];
  const phoneErr = (iso) => (NINE.includes(iso) ? "Číslo bez předvolby má mít 9 číslic." : "Zkontroluj číslo, bez předvolby má mít aspoň 4 číslice.");
  // po trojicích, osamocená poslední číslice se přidá k předchozí skupině (770 090 0123)
  function groupDigits(d) {
    const g = d.match(/\d{1,3}/g) || [];
    if (g.length > 1 && g[g.length - 1].length === 1) g.splice(-2, 2, g[g.length - 2] + g[g.length - 1]);
    return g.join(" ");
  }
  function splitPhone(phone, iso) {
    const c = BY_ISO[iso] || BY_ISO[isoFromPhone(phone)] || BY_ISO.CZ;
    let rest = String(phone || "").replace(/\s+/g, "");
    if (rest.startsWith("+" + c.dial)) rest = rest.slice(c.dial.length + 1);
    const d = rest.replace(/\D/g, "");
    return { c, national: groupDigits(d) };
  }
  // vrací { phone, iso }, nebo null když číslo nesedí
  function normPhone(iso, raw) {
    let c = BY_ISO[iso] || BY_ISO.CZ;
    let s = String(raw).replace(/\s+/g, "");
    if (/^(\+|00)/.test(s)) {                          // vložené celé číslo i s předvolbou
      const full = "+" + s.replace(/^(\+|00)/, "");
      const found = isoFromPhone(full);
      if (found) { c = BY_ISO[found]; s = full.slice(1 + c.dial.length); }
    }
    let d = s.replace(/\D/g, "");
    if (d.startsWith("0") && !["IT", "SM", "VA"].includes(c.iso)) d = d.slice(1);   // národní nula
    if (NINE.includes(c.iso) ? d.length !== 9 : d.length < 4 || d.length + c.dial.length > 15) return null;
    return { phone: "+" + c.dial + " " + groupDigits(d), iso: c.iso };
  }
  function phoneField(px, phone, iso, labelHtml) {
    const { c, national } = splitPhone(phone, iso);
    return `<div class="field"><label for="${px}-phone">${labelHtml}</label>
      <div class="tel" id="${px}-tel">
        <button type="button" class="tel-cc" id="${px}-cc" data-iso="${c.iso}" aria-haspopup="listbox" aria-expanded="false" aria-controls="${px}-pop">
          <span class="tel-flag" aria-hidden="true">${c.flag}</span><span class="tel-dial">+${c.dial}</span>${CARET}<span class="sr-only">Předvolba: ${esc(c.name)}</span></button>
        <input type="tel" id="${px}-phone" autocomplete="tel-national" inputmode="tel" placeholder="777 123 456" value="${esc(national)}" aria-describedby="${px}-phone-err">
        <div class="tel-pop" id="${px}-pop" hidden>
          <label class="sr-only" for="${px}-q">Hledat zemi nebo předvolbu</label>
          <input type="search" id="${px}-q" class="tel-q" placeholder="Hledat zemi nebo předvolbu" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="${px}-list" aria-autocomplete="list">
          <ul role="listbox" id="${px}-list" class="tel-list" aria-label="Země a předvolby"></ul>
        </div>
      </div>
      <span class="error" id="${px}-phone-err" aria-live="polite"></span></div>`;
  }
  function wirePhone(root, px) {
    const btn = $("#" + px + "-cc", root), pop = $("#" + px + "-pop", root), q = $("#" + px + "-q", root);
    const list = $("#" + px + "-list", root), num = $("#" + px + "-phone", root);
    let items = [], act = 0;
    const setIso = (iso) => {
      const c = BY_ISO[iso]; btn.dataset.iso = iso;
      $(".tel-flag", btn).textContent = c.flag; $(".tel-dial", btn).textContent = "+" + c.dial; $(".sr-only", btn).textContent = "Předvolba: " + c.name;
    };
    const mark = () => {
      $$("li[role=option]", list).forEach((li, i) => li.classList.toggle("act", i === act));
      const cur = items[act];
      if (cur) { q.setAttribute("aria-activedescendant", px + "-o-" + cur.iso); const el = $("#" + px + "-o-" + cur.iso, list); if (el) el.scrollIntoView({ block: "nearest" }); }
      else q.removeAttribute("aria-activedescendant");
    };
    const render = () => {
      const t = ascii(q.value.trim()).replace(/^\+/, "");
      items = COUNTRIES.filter((c) => !t || ascii(c.name).includes(t) || c.dial.startsWith(t) || c.iso.toLowerCase() === t);
      act = t ? 0 : Math.max(0, items.findIndex((c) => c.iso === btn.dataset.iso));
      list.innerHTML = items.length ? items.map((c) => `<li role="option" id="${px}-o-${c.iso}" data-iso="${c.iso}" aria-selected="${c.iso === btn.dataset.iso}">
          <span class="tel-flag" aria-hidden="true">${c.flag}</span><span class="tel-name">${esc(c.name)}</span><span class="tel-code">+${c.dial}</span></li>`).join("")
        : `<li class="tel-none">Takovou zemi ani předvolbu neznáme.</li>`;
      mark();
    };
    const open = () => { pop.hidden = false; btn.setAttribute("aria-expanded", "true"); q.value = ""; render(); q.focus(); };
    const close = (refocus) => { pop.hidden = true; btn.setAttribute("aria-expanded", "false"); if (refocus) btn.focus(); };
    const choose = (iso) => { setIso(iso); close(false); num.focus(); };
    btn.addEventListener("click", () => (pop.hidden ? open() : close(true)));
    q.addEventListener("input", render);
    q.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); act = Math.min(items.length - 1, act + 1); mark(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); act = Math.max(0, act - 1); mark(); }
      else if (e.key === "Enter") { e.preventDefault(); if (items[act]) choose(items[act].iso); }
      else if (e.key === "Escape") { e.preventDefault(); close(true); }
      else if (e.key === "Tab") close(false);
    });
    list.addEventListener("mousedown", (e) => e.preventDefault());
    list.addEventListener("click", (e) => { const li = e.target.closest("li[data-iso]"); if (li) choose(li.dataset.iso); });
    document.addEventListener("click", (e) => { if (!pop.hidden && !e.target.closest("#" + px + "-tel")) close(false); });
    // vložené číslo s +/00 přepne předvolbu samo
    num.addEventListener("blur", () => {
      const s = num.value.replace(/\s+/g, "");
      if (!/^(\+|00)/.test(s)) return;
      const r = normPhone(btn.dataset.iso, s);
      if (r) { setIso(r.iso); num.value = splitPhone(r.phone, r.iso).national; }
    });
  }
  function readPhone(root, px) {
    const iso = $("#" + px + "-cc", root).dataset.iso;
    const raw = $("#" + px + "-phone", root).value.trim();
    if (!raw) return { empty: true };
    return normPhone(iso, raw) || { error: phoneErr(iso) };
  }

  /* ── přihlášení ── */
  // stejná pravidla platí pro registraci i pro změnu e-mailu adminem
  function domainOk(addr) {
    const a = String(addr).trim().toLowerCase();
    const at = a.lastIndexOf("@");
    if (at < 1 || at === a.length - 1) return false;
    return DOMAINS.includes(a.slice(at + 1));      // přesná shoda, žádné "končí na"
  }
  function viewLogin() {
    renderBar();
    const main = view(`
      <div class="narrow">
        <form class="panel" id="login" novalidate>
          <h1>Přihlášení</h1>
          <p>Pošleme ti odkaz na školní e-mail. Kliknutím na něj se přihlásíš, heslo nepotřebuješ.</p>
          <div class="field">
            <label for="email">Školní e-mail</label>
            <input type="email" id="email" name="email" autocomplete="email" inputmode="email" placeholder="jmeno.prijmeni@famu.cz" aria-describedby="email-hint email-err" required>
            <span class="hint" id="email-hint">Jen adresy ${DOMAINS.map((d) => "@" + d).join(" a ")}.</span>
            <span class="error" id="email-err" aria-live="polite"></span>
          </div>
          <div class="actions"><button class="btn btn-red" type="submit">Poslat přihlašovací odkaz</button></div>
        </form>
        <p class="small muted mt">Přihlášením souhlasíš s <a href="ochrana-soukromi.html">pravidly užívání</a>. Co se s tvými údaji děje, najdeš tamtéž.</p>
      </div>`, "Přihlášení");
    if (S.pending) $("#email").value = S.pending;
    $("#login").addEventListener("submit", (e) => {
      e.preventDefault();
      const inp = $("#email"); const v = inp.value.trim().toLowerCase();
      if (!domainOk(v)) {
        inp.setAttribute("aria-invalid", "true");
        $("#email-err").textContent = v ? "Tento e-mail nejde použít. Famáci 2.0 jsou jen pro lidi z FAMU, zadej adresu " + DOMAINS.map((d) => "@" + d).join(" nebo ") + "." : "Zadej školní e-mail.";
        inp.focus(); return;
      }
      set({ pending: v }); viewSent(v);
    });
    focusTitle();
  }
  function viewSent(addr) {
    view(`
      <div class="narrow">
        <div class="panel">
          <h1>Mrkni do pošty</h1>
          <p>Na adresu <strong>${esc(addr)}</strong> jsme poslali přihlašovací odkaz. Platí 24 hodin a jde použít jen jednou.</p>
          <p class="muted small">Nepřišel? Zkontroluj spam, nebo si ho nech poslat znovu.</p>
          <div class="actions">
            <button class="btn btn-line" type="button" id="again">Poslat znovu</button>
            <button class="btn-text btn" type="button" id="change">Změnit e-mail</button>
          </div>
          <div class="demo-box"><strong>Prototyp</strong>E-mail se ve skutečnosti neposílá. Odkaz z něj otevřeš tady:
            <div class="actions"><a class="btn btn-black" href="#/overeni">Otevřít odkaz z e-mailu</a></div></div>
        </div>
      </div>`, "Odkaz odeslán");
    $("#again").addEventListener("click", () => toast("Odkaz jsme poslali znovu."));
    $("#change").addEventListener("click", () => viewLogin());
    focusTitle();
  }
  function viewVerify() {
    renderBar();
    if (!S.pending) {
      view(`<div class="narrow"><div class="panel"><h1>Odkaz už neplatí</h1><p>Přihlašovací odkaz vypršel nebo už byl použitý. Nech si poslat nový.</p>
        <div class="actions"><a class="btn btn-red" href="#/prihlaseni">Poslat nový odkaz</a></div></div></div>`, "Odkaz neplatí");
      return focusTitle();
    }
    view(`
      <div class="narrow">
        <div class="panel">
          <h1>Přihlásit se</h1>
          <p>Přihlašuješ se jako <strong>${esc(S.pending)}</strong>.</p>
          <p class="muted small">Tlačítko je tu schválně: některé poštovní programy odkazy samy otevírají a odkaz by se tím spotřeboval.</p>
          <div class="actions"><button class="btn btn-red" type="button" id="go">Přihlásit</button></div>
        </div>
      </div>`, "Přihlásit se");
    $("#go").addEventListener("click", () => {
      // zablokovaný účet se nepřihlásí
      const base = BASE.find((a) => a.email === S.pending);
      const o = base && adminState().acc[base.id];
      const acc = base && (o ? merged(base, o) : base);
      if (acc && !acc.deleted && acc.blocked) {
        view(`<div class="narrow"><div class="panel"><h1>Účet je zablokovaný</h1>
          <p>Administrátor ti zablokoval přístup, protože kontakty z adresáře byly použity v rozporu s pravidly.</p>
          ${acc.blockedReason ? `<p><strong>Důvod:</strong> ${esc(acc.blockedReason)}</p>` : ""}
          <p>Pokud si myslíš, že jde o omyl, napiš správci na <a href="mailto:spravce@example.cz">spravce@example.cz</a>.</p></div></div>`, "Účet je zablokovaný");
        set({ pending: null }); return focusTitle();
      }
      const first = S.knownEmail !== S.pending;
      set({ email: S.pending, pending: null, knownEmail: S.pending, ...(first ? { rules: false, profile: null, hidden: false, hiddenBy: null, consents: {}, role: "user", created: isoToday() } : {}) });
      location.hash = S.rules ? "#/lide" : "#/vitej/pravidla";
    });
    focusTitle();
  }

  /* ── první přihlášení ── */
  function progress(step) { return `<div class="progress" aria-label="Krok ${step} ze 2"><span class="on"></span><span class="${step > 1 ? "on" : ""}"></span></div>`; }
  function viewRules() {
    renderBar();
    view(`
      <div class="narrow">
        <form class="panel" id="rules" novalidate>
          ${progress(1)}
          <p class="kicker">Krok 1 ze 2</p>
          <h1>Pravidla</h1>
          <p>Famáci jsou zavření, aby kontakty nezneužil nikdo zvenku. Proto platí pár pravidel. Kontakty z adresáře:</p>
          <ul>
            <li>použiješ jen ke studiu a tvůrčí spolupráci,</li>
            <li>nebudeš kopírovat, exportovat ani předávat nikomu mimo FAMU,</li>
            <li>nepoužiješ k reklamě, hromadným zprávám ani obtěžování.</li>
          </ul>
          <p>Do profilu dáš jen svoje vlastní údaje.</p>
          <label class="check"><input type="checkbox" id="agree" aria-describedby="agree-err">
            <span>Přečetl/a jsem si <a href="ochrana-soukromi.html" target="_blank" rel="noopener">Informace o zpracování osobních údajů a pravidla užívání</a> a budu kontakty používat jen takhle.</span></label>
          <span class="error" id="agree-err" aria-live="polite"></span>
          <div class="actions"><button class="btn btn-red" type="submit">Pokračovat</button></div>
        </form>
      </div>`, "Pravidla");
    $("#rules").addEventListener("submit", (e) => {
      e.preventDefault();
      if (!$("#agree").checked) { $("#agree-err").textContent = "Bez souhlasu s pravidly se do adresáře nedostaneš."; $("#agree").focus(); return; }
      set({ rules: true, rulesAt: today() }); location.hash = "#/vitej/profil";
    });
    focusTitle();
  }

  /* formulář profilu: sdílí ho krok 2 a stránka Upravit profil */
  function profileFields(p, onboarding) {
    const deptOpts = DEPTS.map((d) => `<option value="${d.code}" ${p.dept === d.code ? "selected" : ""}>${esc(d.full)}</option>`).join("");
    const cohortOpts = COHORTS.map((c) => `<option ${p.cohort === c ? "selected" : ""}>${c}</option>`).join("");
    const g = p.gender || "";
    const c = S.consents || {};
    return `
      ${onboarding ? `<label class="check"><input type="checkbox" id="c-profile">
        <span>Souhlasím se zveřejněním svého profilu (jméno a příjmení, školní e-mail, studijní obor a ročník) pro přihlášené uživatele Famáci 2.0, abychom se mohli navzájem kontaktovat v rámci FAMU. Profil zůstane i po skončení studia, dokud souhlas neodvolám.</span></label>
        <span class="error" id="c-profile-err" aria-live="polite"></span>` : ""}
      <div class="field"><label for="f-name">Jméno a příjmení</label>
        <input type="text" id="f-name" autocomplete="name" value="${esc(p.name)}" aria-describedby="f-name-err" required><span class="error" id="f-name-err"></span></div>
      <div class="grid2">
        <div class="field"><label for="f-dept">Studijní obor</label>
          <select id="f-dept" aria-describedby="f-dept-err" required><option value="">Vyber studijní obor</option>${deptOpts}</select><span class="error" id="f-dept-err"></span></div>
        <div class="field"><label for="f-cohort">Ročník nástupu</label>
          <select id="f-cohort" aria-describedby="f-cohort-err" required><option value="">Vyber rok</option>${cohortOpts}</select><span class="error" id="f-cohort-err"></span></div>
      </div>
      <div class="field"><label for="f-email">Školní e-mail</label>
        <input type="email" id="f-email" value="${esc(S.email)}" readonly aria-describedby="f-email-hint"><span class="hint" id="f-email-hint">Je to tvoje přihlašovací adresa, změnit ji nejde.</span></div>
      ${phoneField("f", p.phone, p.phoneCountry, 'Telefon <span class="muted">(nepovinné)</span>')}
      <label class="check" id="c-phone-wrap" ${p.phone ? "" : "hidden"}><input type="checkbox" id="c-phone" ${c.phone ? "checked" : ""}>
        <span>Souhlasím se zveřejněním svého telefonního čísla pro přihlášené uživatele.</span></label>
      <fieldset>
        <legend class="label">Pohlaví <span class="muted">(nepovinné)</span></legend>
        <div class="radios">
          ${[["", "Neuvádím"], ["zena", "Žena"], ["muz", "Muž"], ["jine", "Jiné"]].map(([v, l]) => `<label><input type="radio" name="gender" value="${v}" ${g === v ? "checked" : ""}><span>${l}</span></label>`).join("")}
        </div>
      </fieldset>
      <label class="check" id="c-gender-wrap" ${g ? "" : "hidden"}><input type="checkbox" id="c-gender" ${c.gender ? "checked" : ""}>
        <span>Souhlasím se zveřejněním svého pohlaví pro přihlášené uživatele.</span></label>
      <span class="error" id="c-err" aria-live="polite"></span>`;
  }
  function wireProfileForm(form) {
    wirePhone(form, "f");
    const phone = $("#f-phone", form);
    phone.addEventListener("input", () => { $("#c-phone-wrap", form).hidden = !phone.value.trim(); });
    $$("input[name=gender]", form).forEach((r) => r.addEventListener("change", () => { $("#c-gender-wrap", form).hidden = !r.value; }));
  }
  function readProfileForm(form, needProfileConsent) {
    $$(".error", form).forEach((e) => (e.textContent = "")); $$("[aria-invalid]", form).forEach((e) => e.removeAttribute("aria-invalid"));
    const bad = [];
    const err = (id, msg, field) => { const el = $("#" + id, form); el.textContent = el.textContent ? el.textContent + " " + msg : msg; if (field) { field.setAttribute("aria-invalid", "true"); } bad.push(field || $("#" + id, form)); };
    const name = $("#f-name", form).value.trim().replace(/\s+/g, " ");
    const dept = $("#f-dept", form).value, cohort = $("#f-cohort", form).value;
    const phoneRaw = $("#f-phone", form).value.trim();
    const gender = ($("input[name=gender]:checked", form) || {}).value || "";
    if (needProfileConsent && !$("#c-profile", form).checked) err("c-profile-err", "Bez tohohle souhlasu profil zveřejnit nejde. Můžeš pokračovat bez profilu.", $("#c-profile", form));
    if (!name || name.split(" ").length < 2) err("f-name-err", "Napiš jméno i příjmení.", $("#f-name", form));
    if (!dept) err("f-dept-err", "Vyber studijní obor.", $("#f-dept", form));
    if (!cohort) err("f-cohort-err", "Vyber rok nástupu.", $("#f-cohort", form));
    let phone = "", phoneCountry = "";
    if (phoneRaw) {
      const r = readPhone(form, "f");
      if (r.error) err("f-phone-err", r.error, $("#f-phone", form)); else { phone = r.phone; phoneCountry = r.iso; }
      if (!$("#c-phone", form).checked) err("c-err", "U telefonu potvrď souhlas se zveřejněním, nebo číslo smaž.", $("#c-phone", form));
    }
    if (gender && !$("#c-gender", form).checked) err("c-err", "U pohlaví potvrď souhlas se zveřejněním, nebo zvol Neuvádím.", $("#c-gender", form));
    if (bad.length) { bad[0].focus(); return null; }
    return { name, dept, cohort, phone, phoneCountry, gender };
  }
  function storeProfile(p, first) {
    const now = today();
    const c = { ...(S.consents || {}) };
    if (first) c.profile = now;
    c.phone = p.phone ? c.phone || now : null;
    c.gender = p.gender ? c.gender || now : null;
    c.version = TERMS_VERSION;
    set({ profile: { ...p, first: p.name.split(" ")[0], last: p.name.split(" ").slice(-1)[0], confirmed: new Date().getFullYear() }, consents: c, hidden: false });
  }
  // krok 2: volba mezi profilem a účtem jen na prohlížení (stejně výrazné možnosti)
  function viewOnboardProfile(later) {
    renderBar();
    view(`
      <div class="narrow">
        <div class="panel">
          ${later ? "" : progress(2) + '<p class="kicker">Krok 2 ze 2</p>'}
          <h1>${later ? "Vytvořit profil" : "Chceš být v adresáři?"}</h1>
          <p>${later ? "Profil uvidí jen přihlášení lidé z FAMU. Souhlas můžeš kdykoli odvolat v nastavení." : "Účet máš hotový. Teď vyber, jestli tě mají ostatní najít, nebo jestli budeš adresář jen prohlížet. Rozmyslet si to můžeš kdykoli později."}</p>
          ${later ? "" : `<div class="choices" id="choices">
            <button class="choice" type="button" data-choice="profile" aria-controls="pf" aria-expanded="false">
              <span class="choice-t">Vytvořit profil</span>
              <span class="choice-d">Ostatní tě najdou podle jména, studijního oboru a ročníku. Pro studenty a absolventy.</span>
            </button>
            <button class="choice" type="button" data-choice="browse">
              <span class="choice-t">Jen prohlížet</span>
              <span class="choice-d">V adresáři tě nikdo neuvidí, uložíme jen přihlašovací e-mail. Hodí se pro pedagogy nebo když nechceš nic sdílet.</span>
            </button>
          </div>`}
          <form id="pf" novalidate ${later ? "" : "hidden"}>
            ${profileFields({}, true)}
            <div class="actions"><button class="btn btn-red" type="submit">Zveřejnit profil</button>
              ${later ? `<a class="btn btn-line" href="#/lide">Zpět</a>` : ""}</div>
          </form>
        </div>
      </div>`, later ? "Vytvořit profil" : "Chceš být v adresáři?");
    const f = $("#pf"); wireProfileForm(f);
    f.addEventListener("submit", (e) => {
      e.preventDefault(); const p = readProfileForm(f, true); if (!p) return;
      storeProfile(p, true); toast("Profil je zveřejněný."); location.hash = "#/lide/me";
    });
    const ch = $("#choices");
    if (ch) ch.addEventListener("click", (e) => {
      const b = e.target.closest("[data-choice]"); if (!b) return;
      if (b.dataset.choice === "browse") { set({ browseOnly: true }); location.hash = "#/lide"; toast("Máš účet bez profilu. Profil si můžeš vytvořit kdykoli v nabídce účtu."); return; }
      $$(".choice", ch).forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      b.setAttribute("aria-expanded", "true"); f.hidden = false; $("#c-profile", f).focus();
    });
    focusTitle();
  }

  /* ── seznam studentů ── */
  let lastList = "#/lide", lastScroll = 0;
  function readQuery() {
    const q = new URLSearchParams((location.hash.split("?")[1] || ""));
    return { k: q.get("k") || "", r: q.get("r") || "", p: q.get("p") || "", q: q.get("q") || "" };
  }
  function queryHash(f) {
    const q = new URLSearchParams();
    for (const k of ["k", "r", "p", "q"]) if (f[k]) q.set(k, f[k]);
    const s = q.toString(); return "#/lide" + (s ? "?" + s : "");
  }
  function match(s, f, skipDept) {
    if (!skipDept && f.k && s.dept !== f.k) return false;
    if (f.r && s.cohort !== f.r) return false;
    if (f.p && s.gender !== f.p) return false;
    if (f.q) {
      const hay = ascii(s.name + " " + s.email);
      if (!ascii(f.q).split(/\s+/).filter(Boolean).every((t) => hay.includes(t))) return false;
    }
    return true;
  }
  const SEARCH_ICON = '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M13 13l5 5" stroke="currentColor" stroke-width="2.2"/></svg>';

  function viewList() {
    renderBar("lide");
    const f = readQuery();
    let limit = PAGE;
    view(`
      <div class="dir">
        <aside class="side" aria-label="Studijní obory"><h2>Studijní obory</h2><ul id="depts"></ul></aside>
        <section class="list">
          <div class="list-head"><h1 id="list-title"></h1><span class="total" id="total" aria-live="polite"></span></div>
          <div class="search" role="search">
            <label class="sr-only" for="q">Hledat podle jména nebo e-mailu</label>
            ${SEARCH_ICON}
            <input type="search" id="q" placeholder="Hledat jméno nebo e-mail" value="${esc(f.q)}" autocomplete="off">
          </div>
          <div class="filters">
            <div class="field side-mobile"><label for="f-k">Studijní obor</label>
              <select id="f-k"><option value="">Všechny</option>${DEPTS.map((d) => `<option value="${d.code}">${esc(d.name)}</option>`).join("")}</select></div>
            <div class="field"><label for="f-r">Ročník nástupu</label>
              <select id="f-r"><option value="">Všechny ročníky</option>${COHORTS.map((c) => `<option>${c}</option>`).join("")}</select></div>
            <div class="field"><label for="f-p">Pohlaví</label>
              <select id="f-p"><option value="">Všechna</option><option value="zena">Žena</option><option value="muz">Muž</option><option value="jine">Jiné</option></select></div>
          </div>
          <div class="chips" id="chips"></div>
          <div id="results"></div>
        </section>
      </div>`, "Lidé");
    $("#f-k").value = f.k; $("#f-r").value = f.r; $("#f-p").value = f.p;

    function update(push) {
      const h = queryHash(f);
      if (location.hash !== h) { if (push) location.hash = h; else history.replaceState(null, "", h); }
      lastList = h;
      const all = everyone();
      // levé menu: počty podle ostatních filtrů
      const counts = {}; let sum = 0;
      for (const s of all) if (match(s, f, true)) { counts[s.dept] = (counts[s.dept] || 0) + 1; sum++; }
      $("#depts").innerHTML = `<li><a href="${queryHash({ ...f, k: "" })}" data-k="" ${!f.k ? 'aria-current="true"' : ""}><span>Všechny</span><span class="count">${sum}</span></a></li>` +
        DEPTS.map((d) => `<li><a href="${queryHash({ ...f, k: d.code })}" data-k="${d.code}" ${f.k === d.code ? 'aria-current="true"' : ""}><span>${esc(d.name)}</span><span class="count">${counts[d.code] || 0}</span></a></li>`).join("");
      $("#list-title").textContent = f.k ? DEPT[f.k].name : "Všichni studenti";
      const hits = all.filter((s) => match(s, f));
      $("#total").textContent = plural(hits.length, "student", "studenti", "studentů");
      // aktivní filtry jako štítky
      const chips = [];
      if (f.k) chips.push(["k", "Obor", DEPT[f.k].name]);
      if (f.r) chips.push(["r", "Ročník", f.r]);
      if (f.p) chips.push(["p", "Pohlaví", GENDER[f.p]]);
      if (f.q) chips.push(["q", "Hledáno", f.q]);
      $("#chips").innerHTML = chips.map(([k, l, v]) => `<button class="chip" type="button" data-rm="${k}" aria-label="Zrušit filtr ${l}: ${esc(v)}"><b>${l}</b> ${esc(v)} <span aria-hidden="true">✕</span></button>`).join("") +
        (chips.length > 1 ? `<button class="btn btn-text" type="button" data-rm="*">Zrušit vše</button>` : "");
      // výsledky po ročnících, nejnovější nahoře
      const res = $("#results");
      if (!hits.length) {
        res.innerHTML = `<div class="empty"><h2>Nikoho jsme nenašli</h2><p>Zkus jiné jméno nebo uvolni filtry.</p><button class="btn btn-black" type="button" data-rm="*">Zrušit filtry</button></div>`;
        return;
      }
      const shown = hits.slice().sort((a, b) => COHORTS.indexOf(a.cohort) - COHORTS.indexOf(b.cohort) || a.last.localeCompare(b.last, "cs") || a.first.localeCompare(b.first, "cs")).slice(0, limit);
      const groups = [];
      for (const s of shown) { const g = groups[groups.length - 1]; if (g && g.c === s.cohort) g.items.push(s); else groups.push({ c: s.cohort, items: [s] }); }
      const perCohort = {}; for (const s of hits) perCohort[s.cohort] = (perCohort[s.cohort] || 0) + 1;
      res.innerHTML = groups.map((g) => `
        <section class="cohort" aria-labelledby="c-${g.c.replace("/", "-")}">
          <div class="cohort-head"><h2 class="cohort-tag" id="c-${g.c.replace("/", "-")}"><span class="sr-only">Ročník </span>${g.c}</h2><span class="rule"></span><span class="n">${plural(perCohort[g.c], "člověk", "lidé", "lidí")}</span></div>
          <ul class="rows">${g.items.map((s) => `
            <li class="row"><a href="#/lide/${s.id}">
              <span class="ini">${esc(initials(s.name))}</span>
              <span class="nm">${esc(s.name)}${s.mine ? ' <span class="muted small">(ty)</span>' : ""}</span>
              <span class="dp">${esc(DEPT[s.dept].name)}</span>
              <span class="gd">${s.gender ? GENDER[s.gender] : ""}</span>
            </a></li>`).join("")}
          </ul>
        </section>`).join("") +
        (hits.length > limit ? `<div class="more"><button class="btn btn-black" type="button" id="more">Zobrazit dalších ${Math.min(PAGE, hits.length - limit)}</button><span class="small muted">Zobrazeno ${limit} z ${hits.length}. Kvůli ochraně kontaktů se seznam načítá po částech.</span></div>` : "");
      const more = $("#more"); if (more) more.addEventListener("click", () => { limit += PAGE; update(false); });
    }

    let t;
    $("#q").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => { f.q = e.target.value.trim(); limit = PAGE; update(false); }, 120); });
    $("#f-k").addEventListener("change", (e) => { f.k = e.target.value; limit = PAGE; update(false); });
    $("#f-r").addEventListener("change", (e) => { f.r = e.target.value; limit = PAGE; update(false); });
    $("#f-p").addEventListener("change", (e) => { f.p = e.target.value; limit = PAGE; update(false); });
    $("#depts").addEventListener("click", (e) => {
      const a = e.target.closest("a[data-k]"); if (!a) return;
      e.preventDefault(); f.k = a.dataset.k; $("#f-k").value = f.k; limit = PAGE; update(false);
      window.scrollTo({ top: 0 });
    });
    $("#obsah").addEventListener("click", (e) => {
      const b = e.target.closest("[data-rm]"); if (!b) return;
      if (b.dataset.rm === "*") { f.k = f.r = f.p = f.q = ""; } else f[b.dataset.rm] = "";
      $("#q").value = f.q; $("#f-k").value = f.k; $("#f-r").value = f.r; $("#f-p").value = f.p;
      limit = PAGE; update(false); $("#q").focus();
    });
    update(false);
    return true;
  }

  /* ── detail ── */
  function viewPerson(id) {
    renderBar("lide");
    const s = byId(id);
    if (!s || (s.mine && S.hidden)) {
      view(`<div class="narrow"><div class="panel"><h1>Profil tu není</h1><p>Profil neexistuje, nebo ho jeho majitel skryl či smazal.</p>
        <div class="actions"><a class="btn btn-black" href="${lastList}">Zpět na seznam</a></div></div></div>`, "Profil nenalezen");
      return focusTitle();
    }
    const d = DEPT[s.dept];
    view(`
      <div class="person-top"><div class="inner">
        <a class="back" href="${lastList}"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M9 2L4 7l5 5" fill="none" stroke="currentColor" stroke-width="2"/></svg>Zpět na seznam</a>
        <div class="person-id">
          <span class="ini ini-xl">${esc(initials(s.name))}</span>
          <div>
            <h1 class="display person-name">${esc(s.name)}</h1>
            <div class="person-meta">
              <span class="tag">${esc(d.full)}</span>
              <span class="tag tag-red">Nástup ${esc(s.cohort)}</span>
              ${s.gender ? `<span class="tag">${GENDER[s.gender]}</span>` : ""}
            </div>
          </div>
        </div>
      </div></div>
      <div class="person-body"><div class="inner">
        <div class="contact">
          <div class="contact-row"><span class="k">Telefon</span><span class="v">${s.phone ? `<span class="tel-flag" aria-hidden="true">${flagOf(s.phoneCountry || isoFromPhone(s.phone) || "CZ")}</span> ` : ""}${esc(s.phone)}</span>
            <span class="do">${s.phone ? `<button class="btn btn-quiet" type="button" data-copy="${esc(s.phone)}" data-what="Číslo">Zkopírovat</button>` : ""}</span></div>
          <div class="contact-row"><span class="k">E-mail</span><span class="v">${esc(s.email)}</span>
            <span class="do"><button class="btn btn-quiet" type="button" data-copy="${esc(s.email)}" data-what="E-mail">Zkopírovat</button></span></div>
        </div>
        <div class="person-foot">
          <span>Údaje naposledy potvrzené v roce ${esc(s.confirmed)}. Zobrazení kontaktu se zaznamenává kvůli ochraně před zneužitím.</span>
          <span class="actions-inline">
            ${isAdmin() ? `<a class="btn btn-line" href="#/admin/uzivatel/${esc(s.id)}">Spravovat v administraci</a>` : ""}
            ${s.mine ? `<a class="btn btn-black" href="#/profil">Upravit profil</a>` : `<button class="btn btn-text btn-danger" type="button" id="report">Nahlásit zneužití profilu</button>`}
          </span>
        </div>
      </div></div>`, s.name);
    $$("[data-copy]").forEach((b) => b.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(b.dataset.copy); toast(b.dataset.what + " je ve schránce."); }
      catch (e) { toast("Kopírování se nepovedlo, označ text ručně."); }
    }));
    const rep = $("#report");
    if (rep) rep.addEventListener("click", () => dialog(`
      <h2 id="dlg-title">Nahlásit zneužití</h2>
      <p>Správce se podívá, jestli profil ${esc(s.name)} neporušuje pravidla (cizí údaje, falešný profil, obtěžování, spam).</p>
      ${reportFields("dr", false)}
      <div class="actions"><button class="btn btn-red" type="button" id="dr-send">Odeslat nahlášení</button><button class="btn btn-line" type="button" data-close>Zrušit</button></div>`,
      (dlg) => {
        $("#dr-text", dlg).focus();
        $("#dr-send", dlg).addEventListener("click", () => {
          const r = readReport(dlg, "dr"); if (!r) return;
          saveReport({ ...r, targetId: s.id === "me" ? null : s.id, targetText: s.name });
          dlg.close(); toast("Nahlášení jsme poslali správci. Odpověď přijde na " + r.from + ".");
        });
      }));
    focusTitle();
  }

  /* ── nahlášení zneužití: formulář (u profilu i samostatná stránka bez přihlášení) ── */
  const MAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
  function reportFields(px, withTarget) {
    return `
      ${withTarget ? `<div class="field"><label for="${px}-target">Kterého člověka nebo čísla se to týká <span class="muted">(nepovinné)</span></label>
        <input type="text" id="${px}-target" autocomplete="off"></div>` : ""}
      <div class="field"><label for="${px}-text">Co se stalo</label>
        <textarea id="${px}-text" rows="4" aria-describedby="${px}-text-err"></textarea><span class="error" id="${px}-text-err" aria-live="polite"></span></div>
      <div class="field"><label for="${px}-from">Tvůj e-mail pro odpověď</label>
        <input type="email" id="${px}-from" autocomplete="email" value="${esc(S.email || "")}" aria-describedby="${px}-from-hint ${px}-from-err">
        <span class="hint" id="${px}-from-hint">Na tuhle adresu ti správce odpoví. Může být i jiná než školní.</span>
        <span class="error" id="${px}-from-err" aria-live="polite"></span></div>`;
  }
  function readReport(root, px) {
    const t = $("#" + px + "-text", root), f = $("#" + px + "-from", root);
    [t, f].forEach((x) => x.removeAttribute("aria-invalid"));
    $("#" + px + "-text-err", root).textContent = ""; $("#" + px + "-from-err", root).textContent = "";
    const text = t.value.trim(), from = f.value.trim().toLowerCase();
    let bad = null;
    if (text.length < 10) { $("#" + px + "-text-err", root).textContent = "Popiš prosím, co se stalo (aspoň pár slov)."; t.setAttribute("aria-invalid", "true"); bad = bad || t; }
    if (!MAIL_RE.test(from)) { $("#" + px + "-from-err", root).textContent = "Zadej e-mail, na který ti můžeme odpovědět."; f.setAttribute("aria-invalid", "true"); bad = bad || f; }
    if (bad) { bad.focus(); return null; }
    const tg = $("#" + px + "-target", root);
    return { text, from, targetText: tg ? tg.value.trim() : "" };
  }
  function saveReport(r) {
    const item = { id: "u" + Date.now(), t: new Date().toISOString(), status: "new", targetId: null, ...r, reporter: S.email || null };
    set({ reports: [item, ...(S.reports || [])] });
  }
  function viewReportPage() {
    renderBar();
    view(`
      <div class="narrow">
        <form class="panel" id="rp" novalidate>
          <h1>Nahlásit zneužití</h1>
          <p>Někdo použil kontakt z Famáků k obtěžování, reklamě nebo spamu? Nebo je tu profil s cizími údaji? Dej nám vědět. Nahlásit může kdokoli, i bez přihlášení.</p>
          ${reportFields("rp", true)}
          <div class="actions"><button class="btn btn-red" type="submit">Odeslat nahlášení</button></div>
        </form>
      </div>`, "Nahlásit zneužití");
    $("#rp").addEventListener("submit", (e) => {
      e.preventDefault();
      const r = readReport($("#rp"), "rp"); if (!r) return;
      saveReport(r);
      view(`<div class="narrow"><div class="panel"><h1>Díky, máme to</h1>
        <p>Nahlášení jsme poslali správci. Odpověď přijde na <strong>${esc(r.from)}</strong>.</p>
        <div class="actions"><a class="btn btn-black" href="${loggedIn() ? "#/lide" : "index.html"}">${loggedIn() ? "Zpět do adresáře" : "Zpět na úvod"}</a></div></div></div>`, "Nahlášení odesláno");
      focusTitle();
    });
    focusTitle();
  }

  /* ── můj profil ── */
  function viewProfile() {
    renderBar();
    const p = S.profile;
    if (!p) return viewOnboardProfile(true);
    view(`
      <div class="page">
        <h1>Upravit profil</h1>
        <p class="lead">Takhle tě uvidí ostatní přihlášení lidé z FAMU.</p>
        <form class="section" id="pf" novalidate>
          ${profileFields(p, false)}
          <div class="actions">
            <button class="btn btn-red" type="submit">Uložit změny</button>
            <a class="btn btn-line" href="#/lide/me">Zobrazit můj profil</a>
          </div>
        </form>
      </div>`, "Upravit profil");
    const f = $("#pf"); wireProfileForm(f);
    f.addEventListener("submit", (e) => {
      e.preventDefault(); const np = readProfileForm(f, false); if (!np) return;
      storeProfile(np, false); renderBar(); toast("Změny jsou uložené.");
    });
    focusTitle();
  }

  /* ── nastavení ── */
  function viewSettings() {
    renderBar();
    const p = S.profile, c = S.consents || {};
    const sw = (id, on, label, sub, disabled) => `
      <div class="setting"><div><strong id="${id}-l">${label}</strong><span class="small muted">${sub}</span></div>
        <span class="switch"><input type="checkbox" role="switch" id="${id}" aria-labelledby="${id}-l" ${on ? "checked" : ""} ${disabled ? "disabled" : ""}><span></span></span></div>`;
    view(`
      <div class="page">
        <h1>Nastavení</h1>
        <p class="lead">Tady rozhoduješ, co o tobě ostatní uvidí.</p>
        <section class="section" aria-labelledby="s1">
          <h2 id="s1">Moje souhlasy</h2>
          ${p ? `
            ${S.hidden && S.hiddenBy === "admin"
              ? sw("sw-profile", false, "Profil v adresáři", `Profil skryl administrátor${S.hiddenReason ? ": " + esc(S.hiddenReason) : "."} Pokud nesouhlasíš, napiš správci.`, true)
              : sw("sw-profile", !S.hidden, "Profil v adresáři", S.hidden ? "Skrytý. Ostatní tě v seznamu nenajdou." : `Zveřejněný od ${esc(fmtDate(c.profile) || today())}, podmínky verze ${esc(c.version || TERMS_VERSION)}.`)}
            ${sw("sw-phone", !!p.phone, "Telefon", p.phone ? `Zveřejněný od ${esc(c.phone || today())}. Vypnutím se číslo smaže.` : "Nevyplněný. Doplníš ho v profilu.", !p.phone)}
            ${sw("sw-gender", !!p.gender, "Pohlaví", p.gender ? `Zveřejněné od ${esc(c.gender || today())}. Vypnutím se údaj smaže.` : "Neuvedené. Doplníš ho v profilu.", !p.gender)}`
          : `<div class="setting"><div><strong>Účet bez profilu</strong><span class="small muted">Adresář prohlížíš, ale nikdo tě v něm nenajde. Uložený je jen tvůj přihlašovací e-mail.</span></div><a class="btn btn-red" href="#/profil">Vytvořit profil</a></div>`}
          <p class="small muted mt">Pravidla užívání jsi přijal/a ${esc(S.rulesAt || today())}. <a href="ochrana-soukromi.html">Přečíst znovu</a></p>
        </section>
        <section class="section" aria-labelledby="s2">
          <h2 id="s2">Moje údaje</h2>
          <div class="setting"><div><strong>Stáhnout moje údaje</strong><span class="small muted">Všechno, co o tobě Famáci mají, v jednom souboru (JSON).</span></div>
            <button class="btn btn-line" type="button" id="export">Stáhnout</button></div>
        </section>
        <section class="section" aria-labelledby="s3">
          <h2 id="s3">Přihlášení</h2>
          <div class="setting"><div><strong>Přihlašovací e-mail</strong><span class="small muted">${esc(S.email)}</span></div></div>
          <div class="setting"><div><strong>Role</strong><span class="small muted">${isAdmin() ? "Admin. Spravuješ účty ostatních v administraci." : "Uživatel. Roli mění jen administrátor."}</span></div>
            <span class="badge ${isAdmin() ? "badge-admin" : ""}">${ROLE[S.role || "user"]}</span></div>
          <div class="demo-box"><strong>Prototyp</strong>Ve skutečnosti roli přiděluje jiný admin v administraci. Pro vyzkoušení si ji můžeš přepnout tady.
            <div class="actions"><button class="btn btn-black" type="button" id="demo-role">${isAdmin() ? "Přepnout na uživatele" : "Přepnout na admina"}</button></div></div>
          <div class="setting"><div><strong>Odhlásit všude</strong><span class="small muted">Odhlásí tě na všech počítačích a telefonech.</span></div>
            <button class="btn btn-line" type="button" id="logout-all">Odhlásit všude</button></div>
        </section>
        <section class="section" aria-labelledby="s4">
          <h2 id="s4">Smazání</h2>
          ${p ? `<div class="setting"><div><strong>Smazat profil</strong><span class="small muted">Profil hned zmizí z adresáře, ze záloh do 30 dnů. Prohlížet můžeš dál.</span></div>
            <button class="btn btn-line btn-danger" type="button" id="del-profile">Smazat profil</button></div>` : ""}
          <div class="setting"><div><strong>Zrušit účet</strong><span class="small muted">Smaže profil i přihlašovací účet.</span></div>
            <button class="btn btn-line btn-danger" type="button" id="del-account">Zrušit účet</button></div>
        </section>
      </div>`, "Nastavení");
    const on = (id, fn) => { const el = $("#" + id); if (el) el.addEventListener("change", fn); };
    on("sw-profile", (e) => { set({ hidden: !e.target.checked, hiddenBy: e.target.checked ? null : "user", hiddenReason: "" }); toast(e.target.checked ? "Profil je zase vidět." : "Profil je skrytý."); viewSettings(); });
    $("#demo-role").addEventListener("click", () => { set({ role: isAdmin() ? "user" : "admin" }); toast(isAdmin() ? "Teď jsi admin. Administrace je v horní liště." : "Teď jsi běžný uživatel."); viewSettings(); });
    on("sw-phone", (e) => { if (!e.target.checked) { set({ profile: { ...S.profile, phone: "" }, consents: { ...c, phone: null } }); toast("Telefon je smazaný."); viewSettings(); } });
    on("sw-gender", (e) => { if (!e.target.checked) { set({ profile: { ...S.profile, gender: "" }, consents: { ...c, gender: null } }); toast("Pohlaví je smazané."); viewSettings(); } });
    $("#export").addEventListener("click", () => {
      const data = { email: S.email, profil: S.profile, skryty: !!S.hidden, souhlasy: S.consents || {}, pravidla_prijata: S.rulesAt || null };
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = document.createElement("a"); a.href = url; a.download = "famaci-moje-udaje.json"; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    $("#logout-all").addEventListener("click", () => { set({ email: null }); toast("Odhlášeno na všech zařízeních."); location.hash = "#/prihlaseni"; });
    const del = $("#del-profile");
    if (del) del.addEventListener("click", () => dialog(`
      <h2 id="dlg-title">Smazat profil?</h2>
      <p>Profil zmizí z adresáře hned. Vrátit to nejde, ale můžeš si kdykoli založit nový.</p>
      <p class="small muted">Kdo si tvůj kontakt už dřív uložil, ten ho mít bude dál. To správce vzít zpět nemůže.</p>
      <div class="actions"><button class="btn btn-red" type="button" id="yes">Smazat profil</button><button class="btn btn-line" type="button" data-close>Nechat</button></div>`,
      (dlg) => $("#yes", dlg).addEventListener("click", () => { dlg.close(); set({ profile: null, consents: {}, hidden: false }); toast("Profil je smazaný."); viewSettings(); })));
    $("#del-account").addEventListener("click", () => dialog(`
      <h2 id="dlg-title">Zrušit účet?</h2>
      <p>Smažeme profil, souhlasy i přihlašovací účet. Příště se budeš registrovat znovu.</p>
      <div class="actions"><button class="btn btn-red" type="button" id="yes">Zrušit účet</button><button class="btn btn-line" type="button" data-close>Nechat</button></div>`,
      (dlg) => $("#yes", dlg).addEventListener("click", () => { dlg.close(); S = {}; save(S); location.href = "index.html"; })));
    focusTitle();
  }

  /* ── administrace (jen role admin) ──
     Admin vidí všechny účty včetně těch bez profilu, opravuje údaje, maže je, skrývá profily,
     blokuje a maže účty a mění role. Souhlasy za uživatele zapnout nemůže, jen údaje odebrat.
     Každý zásah potřebuje důvod a zapisuje se do záznamu změn. */
  const STATE = (a) => (a.blocked ? ["Zablokovaný", "badge-block"] : !a.profile ? ["Bez profilu", ""] : a.hidden ? ["Skrytý profil", "badge-muted"] : ["Profil zveřejněný", "badge-ok"]);
  const accName = (a) => (a.profile ? a.profile.name : "");
  function askReason(o, done) {
    dialog(`
      <h2 id="dlg-title">${esc(o.title)}</h2>
      <p>${o.text}</p>
      <div class="field"><label for="why">Důvod <span class="muted">(uloží se do záznamu změn)</span></label>
        <input type="text" id="why" aria-describedby="why-err" autocomplete="off"><span class="error" id="why-err" aria-live="polite"></span></div>
      <div class="actions"><button class="btn ${o.danger ? "btn-red" : "btn-black"}" type="button" id="ok">${esc(o.confirm)}</button><button class="btn btn-line" type="button" data-close>Zrušit</button></div>`,
      (dlg) => {
        $("#why", dlg).focus();
        $("#ok", dlg).addEventListener("click", () => {
          const r = $("#why", dlg).value.trim();
          if (r.length < 3) { $("#why-err", dlg).textContent = "Napiš krátce, proč to děláš."; $("#why", dlg).setAttribute("aria-invalid", "true"); return; }
          dlg.close(); done(r);
        });
      });
  }
  function noAccess() {
    renderBar();
    view(`<div class="narrow"><div class="panel"><h1>Sem nemáš přístup</h1><p>Administrace je jen pro účty s rolí admin.</p>
      <div class="actions"><a class="btn btn-black" href="#/lide">Zpět do adresáře</a></div></div></div>`, "Bez přístupu");
    focusTitle();
  }
  function adminTabs(active) {
    return `<nav class="adm-tabs" aria-label="Administrace">
      <a href="#/admin" ${active === "users" ? 'aria-current="page"' : ""}>Uživatelé</a>
      <a href="#/admin/hlaseni" ${active === "reports" ? 'aria-current="page"' : ""}>Nahlášení${newReports() ? ` <span class="nav-count">${newReports()}</span>` : ""}</a>
      <a href="#/admin/zaznam" ${active === "log" ? 'aria-current="page"' : ""}>Záznam změn</a></nav>`;
  }

  /* ── administrace: nahlášení zneužití ── */
  const REP_STATE = { new: ["Nové", "badge-admin"], done: ["Vyřešené", "badge-ok"] };
  const repTarget = (r) => { const a = r.targetId && getAcc(r.targetId); return a ? (accName(a) || a.email) : r.targetText || "neuvedeno"; };
  function viewAdminReports() {
    renderBar("admin");
    const q0 = new URLSearchParams(location.hash.split("?")[1] || "");
    let st = q0.get("s") || "new";
    view(`
      <div class="adm">
        <div class="adm-head"><h1>Administrace</h1>${adminTabs("reports")}</div>
        <p class="lead">Nahlášení zneužití kontaktů a falešných profilů. Každé má e-mail, na který jde odpovědět.</p>
        <div class="adm-bar"><div class="seg" id="rseg" role="group" aria-label="Stav nahlášení"></div></div>
        <div id="rep-res"></div>
      </div>`, "Nahlášení · Administrace");
    function update() {
      const h = "#/admin/hlaseni" + (st !== "new" ? "?s=" + st : ""); if (location.hash !== h) history.replaceState(null, "", h);
      const all = reportsAll();
      const F = [["new", "Nová"], ["done", "Vyřešená"], ["all", "Všechna"]];
      $("#rseg").innerHTML = F.map(([k, l]) => `<button type="button" data-s="${k}" aria-pressed="${st === k}">${l} <span>${all.filter((r) => k === "all" || r.status === k).length}</span></button>`).join("");
      const rows = all.filter((r) => st === "all" || r.status === st);
      $("#rep-res").innerHTML = rows.length ? `<div class="table-wrap"><table class="adm-table">
        <thead><tr><th scope="col">Přijato</th><th scope="col">Od (e-mail pro odpověď)</th><th scope="col">Týká se</th><th scope="col">Co se stalo</th><th scope="col">Stav</th></tr></thead>
        <tbody>${rows.map((r) => `<tr>
          <td class="small"><a href="#/admin/hlaseni/${esc(r.id)}">${esc(fmtTime(r.t))}</a></td>
          <td class="small">${esc(r.from)}</td>
          <td class="small">${esc(repTarget(r))}</td>
          <td class="small rep-snip"><a href="#/admin/hlaseni/${esc(r.id)}">${esc(r.text.length > 90 ? r.text.slice(0, 90) + "…" : r.text)}</a></td>
          <td><span class="badge ${REP_STATE[r.status][1]}">${REP_STATE[r.status][0]}</span></td></tr>`).join("")}</tbody></table></div>`
        : `<div class="empty"><h2>${st === "new" ? "Nic nového" : "Žádná nahlášení"}</h2><p>${st === "new" ? "Všechna nahlášení jsou vyřešená." : "Zatím tu nic není."}</p></div>`;
    }
    $("#rseg").addEventListener("click", (e) => { const b = e.target.closest("[data-s]"); if (b) { st = b.dataset.s; update(); } });
    update(); focusTitle();
  }
  function viewAdminReport(id) {
    renderBar("admin");
    const r = reportsAll().find((x) => x.id === id);
    if (!r) {
      view(`<div class="narrow"><div class="panel"><h1>Nahlášení neexistuje</h1><div class="actions"><a class="btn btn-black" href="#/admin/hlaseni">Zpět na nahlášení</a></div></div></div>`, "Nahlášení neexistuje");
      return focusTitle();
    }
    const acc = r.targetId && getAcc(r.targetId);
    const subject = encodeURIComponent("Famáci 2.0: vaše nahlášení zneužití");
    view(`
      <div class="adm">
        <p class="muted"><a class="back-dark" href="#/admin/hlaseni">Zpět na nahlášení</a></p>
        <div class="adm-head"><h1>Nahlášení</h1><span class="badge ${REP_STATE[r.status][1]}">${REP_STATE[r.status][0]}</span></div>
        <div class="adm-grid">
          <section class="section" aria-labelledby="r1">
            <h2 id="r1">Co se stalo</h2>
            <p class="rep-text mt">${esc(r.text)}</p>
            <dl class="kv">
              <div><dt>Přijato</dt><dd>${esc(fmtTime(r.t))}</dd></div>
              <div><dt>Od</dt><dd>${esc(r.from)}${r.reporter && r.reporter !== r.from ? ` <span class="muted small">(přihlášený jako ${esc(r.reporter)})</span>` : ""}</dd></div>
              <div><dt>Týká se</dt><dd>${acc ? `<a href="#/admin/uzivatel/${esc(acc.id)}">${esc(accName(acc) || acc.email)}</a> <span class="muted small">${esc(acc.email)}</span>` : esc(r.targetText || "neuvedeno")}</dd></div>
            </dl>
            ${acc ? `<div class="actions"><a class="btn btn-line" href="#/admin/uzivatel/${esc(acc.id)}">Spravovat účet</a></div>` : ""}
          </section>
          <section class="section" aria-labelledby="r2">
            <h2 id="r2">Odpověď</h2>
            ${r.status === "done" ? `
              ${r.reply ? `<p class="rep-text mt">${esc(r.reply)}</p>` : '<p class="mt muted">Uzavřeno bez odpovědi.</p>'}
              <p class="small muted">${esc(r.repliedBy || "")}${r.repliedAt ? ", " + esc(fmtTime(r.repliedAt)) : ""}${r.note ? ". Poznámka: " + esc(r.note) : ""}</p>
              <div class="actions"><button class="btn btn-line" type="button" id="reopen">Znovu otevřít</button></div>`
            : `
              <form id="reply" novalidate>
                <div class="field"><label for="reply-to">Komu</label><input type="email" id="reply-to" value="${esc(r.from)}" readonly></div>
                <div class="field"><label for="reply-text">Text odpovědi</label>
                  <textarea id="reply-text" rows="5" aria-describedby="reply-err"></textarea><span class="error" id="reply-err" aria-live="polite"></span></div>
                <div class="actions">
                  <button class="btn btn-red" type="submit">Odeslat odpověď a vyřešit</button>
                  <a class="btn btn-line" href="mailto:${esc(r.from)}?subject=${subject}">Napsat ve vlastní poště</a>
                </div>
                <p class="small muted mt">Odpověď odejde e-mailem z adresy správce a uloží se k nahlášení.</p>
              </form>
              <div class="setting"><div><strong>Uzavřít bez odpovědi</strong><span class="small muted">Třeba u duplicitního nebo nesrozumitelného hlášení.</span></div>
                <button class="btn btn-line" type="button" id="close-rep">Uzavřít</button></div>`}
          </section>
        </div>
      </div>`, "Nahlášení · Administrace");
    const logRep = (action, why) => logAction({ email: "nahlášení od " + r.from, id: r.targetId || "" }, action, why);
    const f = $("#reply");
    if (f) f.addEventListener("submit", (e) => {
      e.preventDefault();
      const t = $("#reply-text"); const txt = t.value.trim();
      if (txt.length < 5) { $("#reply-err").textContent = "Napiš odpověď."; t.setAttribute("aria-invalid", "true"); return t.focus(); }
      patchReport(r.id, { status: "done", reply: txt, repliedAt: new Date().toISOString(), repliedBy: S.email });
      logRep("Odpověď na nahlášení", txt.length > 80 ? txt.slice(0, 80) + "…" : txt);
      toast("Odpověď odešla na " + r.from + "."); viewAdminReport(id);
    });
    const cl = $("#close-rep");
    if (cl) cl.addEventListener("click", () => askReason({ title: "Uzavřít bez odpovědi?", text: "Nahlášení se přesune mezi vyřešená.", confirm: "Uzavřít" },
      (why) => { patchReport(r.id, { status: "done", reply: "", note: why, repliedAt: new Date().toISOString(), repliedBy: S.email }); logRep("Uzavření nahlášení bez odpovědi", why); toast("Nahlášení je uzavřené."); viewAdminReport(id); }));
    const ro = $("#reopen");
    if (ro) ro.addEventListener("click", () => { patchReport(r.id, { status: "new" }); toast("Nahlášení je zase otevřené."); viewAdminReport(id); });
    focusTitle();
  }

  let admLast = "#/admin";
  function viewAdmin() {
    renderBar("admin");
    const q0 = new URLSearchParams(location.hash.split("?")[1] || "");
    const f = { q: q0.get("q") || "", s: q0.get("s") || "", sort: q0.get("o") || "login" };
    let limit = 60;
    const FILTERS = [["", "Všechny"], ["profile", "Se zveřejněným profilem"], ["noprofile", "Bez profilu"], ["hidden", "Skrytý profil"], ["blocked", "Zablokované"], ["admin", "Admini"]];
    const test = (a, s) => !s || (s === "profile" && a.profile && !a.hidden && !a.blocked) || (s === "noprofile" && !a.profile) ||
      (s === "hidden" && a.profile && a.hidden) || (s === "blocked" && a.blocked) || (s === "admin" && a.role === "admin");
    view(`
      <div class="adm">
        <div class="adm-head"><h1>Administrace</h1>${adminTabs("users")}</div>
        <div class="search" role="search">
          <label class="sr-only" for="aq">Hledat podle jména nebo e-mailu</label>${SEARCH_ICON}
          <input type="search" id="aq" placeholder="Hledat jméno nebo e-mail" value="${esc(f.q)}" autocomplete="off">
        </div>
        <div class="adm-bar">
          <div class="seg" id="seg" role="group" aria-label="Filtr účtů"></div>
          <div class="field"><label for="ao">Řadit</label>
            <select id="ao"><option value="login">Poslední přihlášení</option><option value="created">Datum registrace</option><option value="name">Jméno a e-mail</option></select></div>
        </div>
        <div id="adm-res"></div>
      </div>`, "Administrace");
    $("#ao").value = f.sort;
    function update() {
      const q = new URLSearchParams(); if (f.q) q.set("q", f.q); if (f.s) q.set("s", f.s); if (f.sort !== "login") q.set("o", f.sort);
      const h = "#/admin" + (q.toString() ? "?" + q : ""); if (location.hash !== h) history.replaceState(null, "", h); admLast = h;
      const all = accountsAll();
      const qq = ascii(f.q).split(/\s+/).filter(Boolean);
      const searched = all.filter((a) => { const hay = ascii(accName(a) + " " + a.email); return qq.every((t) => hay.includes(t)); });
      $("#seg").innerHTML = FILTERS.map(([k, l]) => `<button type="button" data-s="${k}" aria-pressed="${f.s === k}">${l} <span>${searched.filter((a) => test(a, k)).length}</span></button>`).join("");
      const rows = searched.filter((a) => test(a, f.s)).sort((x, y) =>
        f.sort === "name" ? (accName(x) || x.email).localeCompare(accName(y) || y.email, "cs")
        : f.sort === "created" ? y.created.localeCompare(x.created) : y.lastLogin.localeCompare(x.lastLogin));
      if (!rows.length) { $("#adm-res").innerHTML = `<div class="empty"><h2>Žádný účet</h2><p>Takový účet tu není. Zkus jiné hledání nebo filtr.</p></div>`; return; }
      $("#adm-res").innerHTML = `
        <div class="table-wrap"><table class="adm-table">
          <thead><tr><th scope="col">Účet</th><th scope="col">Obor a ročník</th><th scope="col">Role</th><th scope="col">Stav</th><th scope="col">Registrace</th><th scope="col">Poslední přihlášení</th></tr></thead>
          <tbody>${rows.slice(0, limit).map((a) => { const [st, cls] = STATE(a); return `
            <tr>
              <td><a class="adm-user" href="#/admin/uzivatel/${esc(a.id)}"><span class="ini ini-sm">${esc(initials(accName(a) || a.email))}</span>
                <span><strong>${esc(accName(a) || "Bez profilu")}${a.mine ? ' <span class="muted">(ty)</span>' : ""}</strong><span class="small muted">${esc(a.email)}</span></span></a></td>
              <td class="small">${a.profile ? esc(DEPT[a.profile.dept] ? DEPT[a.profile.dept].abbr : "") + " · " + esc(a.profile.cohort) : '<span class="muted">nemá profil</span>'}</td>
              <td><span class="badge ${a.role === "admin" ? "badge-admin" : ""}">${ROLE[a.role]}</span></td>
              <td><span class="badge ${cls}">${st}</span></td>
              <td class="small">${esc(fmtDate(a.created))}</td>
              <td class="small">${esc(fmtDate(a.lastLogin))}</td>
            </tr>`; }).join("")}</tbody>
        </table></div>
        ${rows.length > limit ? `<div class="more"><button class="btn btn-black" type="button" id="amore">Zobrazit dalších ${Math.min(60, rows.length - limit)}</button><span class="small muted">Zobrazeno ${limit} z ${rows.length}.</span></div>` : `<p class="small muted mt">${plural(rows.length, "účet", "účty", "účtů")}.</p>`}`;
      const m = $("#amore"); if (m) m.addEventListener("click", () => { limit += 60; update(); });
    }
    let t;
    $("#aq").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => { f.q = e.target.value.trim(); limit = 60; update(); }, 120); });
    $("#ao").addEventListener("change", (e) => { f.sort = e.target.value; update(); });
    $("#seg").addEventListener("click", (e) => { const b = e.target.closest("[data-s]"); if (!b) return; f.s = b.dataset.s; limit = 60; update(); });
    update(); focusTitle();
  }

  function viewAdminUser(id) {
    renderBar("admin");
    const a = getAcc(id);
    if (!a) {
      view(`<div class="narrow"><div class="panel"><h1>Účet neexistuje</h1><p>Účet byl smazaný, nebo adresa není správná.</p>
        <div class="actions"><a class="btn btn-black" href="${admLast}">Zpět na uživatele</a></div></div></div>`, "Účet neexistuje");
      return focusTitle();
    }
    const p = a.profile, c = a.consents || {};
    const [st, cls] = STATE(a);
    const own = !!a.mine;
    const hist = adminState().log.filter((l) => l.targetId === a.id);
    const deptOpts = DEPTS.map((d) => `<option value="${d.code}" ${p && p.dept === d.code ? "selected" : ""}>${esc(d.name)}</option>`).join("");
    const cohortOpts = COHORTS.map((x) => `<option ${p && p.cohort === x ? "selected" : ""}>${x}</option>`).join("");
    view(`
      <div class="adm-top"><div class="inner">
        <a class="back" href="${admLast}"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M9 2L4 7l5 5" fill="none" stroke="currentColor" stroke-width="2"/></svg>Zpět na uživatele</a>
        <div class="adm-id">
          <span class="ini ini-lg">${esc(initials(accName(a) || a.email))}</span>
          <div><h1 class="display">${esc(accName(a) || a.email)}</h1>
            <div class="person-meta">${accName(a) ? `<span class="tag tag-plain">${esc(a.email)}</span>` : ""}<span class="tag ${a.role === "admin" ? "tag-red" : ""}">${ROLE[a.role]}</span><span class="tag">${st}</span></div></div>
        </div>
      </div></div>
      <div class="adm-body"><div class="inner adm-grid">
        <section class="section" aria-labelledby="ad1">
          <h2 id="ad1">Účet</h2>
          <form id="adm-mail" class="inline-form" novalidate>
            <div class="field"><label for="am-email">Přihlašovací e-mail</label>
              <span class="inline-row"><input type="email" id="am-email" value="${esc(a.email)}" autocomplete="off" aria-describedby="am-hint am-err">
              <button class="btn btn-quiet" type="submit">Uložit e-mail</button></span>
              <span class="hint" id="am-hint">Jen ${DOMAINS.map((d) => "@" + d).join(" nebo ")}, stejně jako při registraci. E-mail je i kontaktem v profilu. Upozornění přijde na starou i novou adresu.</span>
              <span class="error" id="am-err" aria-live="polite"></span></div>
          </form>
          <dl class="kv">
            <div><dt>Registrace</dt><dd>${esc(fmtDate(a.created))}</dd></div>
            <div><dt>Poslední přihlášení</dt><dd>${esc(fmtDate(a.lastLogin))}</dd></div>
          </dl>
          <div class="setting"><div><strong>Role</strong><span class="small muted">Admin vidí všechny účty a může je měnit.</span></div>
            <span class="role-pick"><label class="sr-only" for="role">Role</label><select id="role"><option value="user">Uživatel</option><option value="admin">Admin</option></select>
            <button class="btn btn-quiet" type="button" id="role-save">Uložit roli</button></span></div>
          <div class="setting"><div><strong>Přístup</strong><span class="small muted">${a.blocked ? "Zablokovaný" + (a.blockedReason ? ": " + esc(a.blockedReason) : ".") + " Nepřihlásí se a profil není vidět." : "Aktivní. Zablokovaný účet se nepřihlásí a jeho profil zmizí z adresáře."}</span></div>
            ${own ? '<span class="small muted">vlastní účet</span>' : `<button class="btn btn-line ${a.blocked ? "" : "btn-danger"}" type="button" id="block">${a.blocked ? "Odblokovat" : "Zablokovat"}</button>`}</div>
        </section>

        <section class="section" aria-labelledby="ad2">
          <h2 id="ad2">Profil v adresáři</h2>
          ${!p ? `<p class="mt muted">Účet nemá profil, jen prohlíží adresář. Kromě přihlašovacího e-mailu o něm nic nevíme.</p>` : `
          <form id="adm-pf" novalidate>
            <div class="field"><label for="ap-name">Jméno a příjmení</label><input type="text" id="ap-name" value="${esc(p.name)}"></div>
            <div class="grid2">
              <div class="field"><label for="ap-dept">Studijní obor</label><select id="ap-dept">${deptOpts}</select></div>
              <div class="field"><label for="ap-cohort">Ročník nástupu</label><select id="ap-cohort">${cohortOpts}</select></div>
            </div>
            <span class="error" id="ap-err" aria-live="polite"></span>
            <div class="actions"><button class="btn btn-black" type="submit">Uložit opravu</button></div>
          </form>
          ${p.phone ? `<form id="adm-phone" class="inline-form" novalidate>
            ${phoneField("ap", p.phone, p.phoneCountry, "Telefon")}
            <div class="actions tight"><button class="btn btn-quiet" type="submit">Uložit telefon</button>
              <button class="btn btn-line btn-danger" type="button" id="del-phone">Smazat telefon</button></div>
          </form>`
          : `<div class="setting"><div><strong>Telefon</strong><span class="small muted">Nevyplněný. Přidat ho může jen uživatel sám, protože ke zveřejnění čísla je potřeba jeho souhlas.</span></div></div>`}
          <div class="setting"><div><strong>Pohlaví</strong><span class="small muted">${p.gender ? GENDER[p.gender] : "neuvedené"}</span></div>
            ${p.gender ? '<button class="btn btn-line btn-danger" type="button" id="del-gender">Smazat pohlaví</button>' : ""}</div>
          <div class="setting"><div><strong>Viditelnost</strong><span class="small muted">${a.hidden ? (a.hiddenBy === "admin" ? "Skrytý administrátorem" + (a.hiddenReason ? ": " + esc(a.hiddenReason) : ".") : "Skrytý uživatelem. Zobrazit ho může jen on sám.") : "Zveřejněný v adresáři."}</span></div>
            ${!a.hidden ? '<button class="btn btn-line" type="button" id="hide">Skrýt z adresáře</button>' : a.hiddenBy === "admin" ? '<button class="btn btn-line" type="button" id="unhide">Zobrazit v adresáři</button>' : ""}</div>
          <div class="setting"><div><strong>Smazat profil</strong><span class="small muted">Smaže všechny údaje profilu i souhlasy. Účet zůstane, uživatel může dál prohlížet.</span></div>
            <button class="btn btn-line btn-danger" type="button" id="del-profile">Smazat profil</button></div>`}
        </section>

        <section class="section" aria-labelledby="ad3">
          <h2 id="ad3">Souhlasy</h2>
          <p class="small muted">Souhlasy uděluje a obnovuje jen uživatel sám. Admin je zapnout nemůže, může jen údaje smazat.</p>
          <dl class="kv">
            <div><dt>Pravidla užívání</dt><dd>přijatá při registraci, verze ${esc(c.version || TERMS_VERSION)}</dd></div>
            <div><dt>Zveřejnění profilu</dt><dd>${c.profile && p ? "od " + esc(fmtDate(c.profile)) : "ne"}</dd></div>
            <div><dt>Telefon</dt><dd>${c.phone && p && p.phone ? "od " + esc(fmtDate(c.phone)) : "ne"}</dd></div>
            <div><dt>Pohlaví</dt><dd>${c.gender && p && p.gender ? "od " + esc(fmtDate(c.gender)) : "ne"}</dd></div>
          </dl>
        </section>

        <section class="section" aria-labelledby="ad4">
          <h2 id="ad4">Smazání účtu</h2>
          ${own ? '<p class="small muted mt">Vlastní účet zrušíš v Nastavení.</p>' : `
          <div class="setting"><div><strong>Smazat účet</strong><span class="small muted">Smaže účet, profil i souhlasy. Uživatel dostane e-mail. Zůstane jen záznam o tomto zásahu.</span></div>
            <button class="btn btn-red" type="button" id="del-account">Smazat účet</button></div>`}
        </section>

        <section class="section adm-wide" aria-labelledby="ad5">
          <h2 id="ad5">Historie zásahů</h2>
          ${hist.length ? `<ul class="hist">${hist.map((l) => `<li><span class="small muted">${esc(fmtTime(l.t))} · ${esc(l.admin)}</span><strong>${esc(l.action)}</strong><span>${esc(l.reason)}</span></li>`).join("")}</ul>`
            : '<p class="small muted mt">Zatím žádné zásahy administrátorů.</p>'}
        </section>
      </div></div>`, (accName(a) || a.email) + " · Administrace");

    $("#role").value = a.role;
    const done = (msg) => { toast(msg); viewAdminUser(id); };
    const lastAdminGuard = () => { if (a.role === "admin" && adminCount() <= 1) { toast("Musí zůstat aspoň jeden admin."); return true; } return false; };
    $("#role-save").addEventListener("click", () => {
      const r = $("#role").value; if (r === a.role) return toast("Role se nezměnila.");
      if (r === "user" && lastAdminGuard()) return;
      askReason({ title: r === "admin" ? "Udělit roli admin?" : "Odebrat roli admin?", text: r === "admin" ? `${esc(a.email)} uvidí všechny účty a bude je moct měnit.` : `${esc(a.email)} přijde o přístup do administrace.`, confirm: "Změnit roli" },
        (why) => { patchAcc(id, { role: r }); logAction(a, "Změna role na " + ROLE[r], why); done("Role je změněná."); });
    });
    const blk = $("#block");
    if (blk) blk.addEventListener("click", () => {
      if (!a.blocked && lastAdminGuard()) return;
      if (a.blocked) askReason({ title: "Odblokovat účet?", text: "Uživatel se zase přihlásí a jeho profil bude vidět, pokud ho sám neskryl.", confirm: "Odblokovat" },
        (why) => { patchAcc(id, { blocked: false, blockedReason: "" }); logAction(a, "Odblokování účtu", why); done("Účet je odblokovaný."); });
      else askReason({ title: "Zablokovat účet?", text: "Uživatel se nepřihlásí a jeho profil zmizí z adresáře. Důvod uvidí při pokusu o přihlášení.", confirm: "Zablokovat", danger: true },
        (why) => { patchAcc(id, { blocked: true, blockedReason: why }); logAction(a, "Zablokování účtu", why); done("Účet je zablokovaný."); });
    });
    const pf = $("#adm-pf");
    if (pf) pf.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = $("#ap-name").value.trim().replace(/\s+/g, " "), dept = $("#ap-dept").value, cohort = $("#ap-cohort").value;
      if (name.split(" ").length < 2) { $("#ap-err").textContent = "Jméno musí obsahovat jméno i příjmení."; return $("#ap-name").focus(); }
      const changes = [];
      if (name !== p.name) changes.push("jméno");
      if (dept !== p.dept) changes.push("studijní obor");
      if (cohort !== p.cohort) changes.push("ročník");
      if (!changes.length) return toast("Nic se nezměnilo.");
      askReason({ title: "Opravit profil?", text: "Měníš: " + changes.join(", ") + ". Uživatel dostane e-mail o změně.", confirm: "Uložit opravu" },
        (why) => { patchAcc(id, { profile: { name, first: name.split(" ")[0], last: name.split(" ").slice(-1)[0], dept, cohort } }); logAction(a, "Oprava profilu (" + changes.join(", ") + ")", why); done("Oprava je uložená."); });
    });
    const on = (sel, fn) => { const el = $(sel); if (el) el.addEventListener("click", fn); };
    $("#adm-mail").addEventListener("submit", (e) => {
      e.preventDefault();
      const inp = $("#am-email"), errEl = $("#am-err"); errEl.textContent = ""; inp.removeAttribute("aria-invalid");
      const v = inp.value.trim().toLowerCase();
      const fail = (m) => { errEl.textContent = m; inp.setAttribute("aria-invalid", "true"); inp.focus(); };
      if (v === a.email) return toast("E-mail se nezměnil.");
      if (!domainOk(v)) return fail("Tenhle e-mail nejde použít. Povolené jsou jen adresy " + DOMAINS.map((d) => "@" + d).join(" nebo ") + ".");
      if (accountsAll().some((x) => x.id !== a.id && x.email === v)) return fail("Tenhle e-mail už má jiný účet.");
      askReason({ title: "Změnit e-mail?", text: `Z ${esc(a.email)} na ${esc(v)}. Uživatel se bude přihlašovat novou adresou a ta se ukáže i v adresáři.`, confirm: "Změnit e-mail" },
        (why) => { patchAcc(id, { email: v }); logAction({ ...a }, "Změna e-mailu na " + v, why); done("E-mail je změněný."); });
    });
    const ph = $("#adm-phone");
    if (ph) {
      wirePhone(ph, "ap");
      ph.addEventListener("submit", (e) => {
        e.preventDefault();
        const inp = $("#ap-phone"), errEl = $("#ap-phone-err"); errEl.textContent = ""; inp.removeAttribute("aria-invalid");
        const r = readPhone(ph, "ap");
        if (r.empty || r.error) { errEl.textContent = r.error || "Zadej číslo, nebo telefon smaž."; inp.setAttribute("aria-invalid", "true"); return inp.focus(); }
        if (r.phone === p.phone) return toast("Telefon se nezměnil.");
        askReason({ title: "Změnit telefon?", text: `Z ${esc(p.phone)} na ${esc(r.phone)}. Souhlas se zveřejněním čísla zůstává, uživatel dostane e-mail o změně.`, confirm: "Změnit telefon" },
          (why) => { patchAcc(id, { profile: { phone: r.phone, phoneCountry: r.iso } }); logAction(a, "Změna telefonu", why); done("Telefon je změněný."); });
      });
    }
    on("#del-phone", () => askReason({ title: "Smazat telefon?", text: "Číslo zmizí z profilu i ze souhlasů. Vrátit ho může jen uživatel sám.", confirm: "Smazat telefon", danger: true },
      (why) => { patchAcc(id, { profile: { phone: "" }, consents: { phone: null } }); logAction(a, "Smazání telefonu", why); done("Telefon je smazaný."); }));
    on("#del-gender", () => askReason({ title: "Smazat pohlaví?", text: "Údaj zmizí z profilu i ze souhlasů.", confirm: "Smazat pohlaví", danger: true },
      (why) => { patchAcc(id, { profile: { gender: "" }, consents: { gender: null } }); logAction(a, "Smazání pohlaví", why); done("Pohlaví je smazané."); }));
    on("#hide", () => askReason({ title: "Skrýt profil?", text: "Profil zmizí z adresáře, údaje zůstanou. Uživatel uvidí v nastavení, že ho skryl administrátor, a důvod.", confirm: "Skrýt profil" },
      (why) => { patchAcc(id, { hidden: true, hiddenBy: "admin", hiddenReason: why }); logAction(a, "Skrytí profilu", why); done("Profil je skrytý."); }));
    on("#unhide", () => askReason({ title: "Zobrazit profil?", text: "Profil bude zase vidět v adresáři.", confirm: "Zobrazit" },
      (why) => { patchAcc(id, { hidden: false, hiddenBy: null, hiddenReason: "" }); logAction(a, "Zobrazení profilu", why); done("Profil je zase vidět."); }));
    on("#del-profile", () => askReason({ title: "Smazat profil?", text: "Smažou se všechny údaje profilu a souhlasy. Účet zůstane. Vrátit to nejde.", confirm: "Smazat profil", danger: true },
      (why) => { patchAcc(id, { profileDeleted: true, hidden: false, hiddenBy: null, consents: { profile: null, phone: null, gender: null } }); logAction(a, "Smazání profilu", why); done("Profil je smazaný."); }));
    on("#del-account", () => {
      if (lastAdminGuard()) return;
      askReason({ title: "Smazat účet?", text: `Smaže se účet ${esc(a.email)}, profil i souhlasy. Vrátit to nejde.`, confirm: "Smazat účet", danger: true },
        (why) => { logAction(a, "Smazání účtu", why); patchAcc(id, { deleted: true }); toast("Účet je smazaný."); location.hash = admLast; });
    });
    focusTitle();
  }

  function viewAdminLog() {
    renderBar("admin");
    const log = adminState().log;
    view(`
      <div class="adm">
        <div class="adm-head"><h1>Administrace</h1>${adminTabs("log")}</div>
        <p class="lead">Každý zásah administrátora s časem, autorem a důvodem. Záznam nejde upravit ani smazat.</p>
        ${log.length ? `<div class="table-wrap"><table class="adm-table">
          <thead><tr><th scope="col">Kdy</th><th scope="col">Admin</th><th scope="col">Zásah</th><th scope="col">Účet</th><th scope="col">Důvod</th></tr></thead>
          <tbody>${log.map((l) => `<tr><td class="small">${esc(fmtTime(l.t))}</td><td class="small">${esc(l.admin)}</td><td><strong>${esc(l.action)}</strong></td>
            <td class="small">${getAcc(l.targetId) ? `<a href="#/admin/uzivatel/${esc(l.targetId)}">${esc(l.target)}</a>` : esc(l.target) + ' <span class="muted">(smazaný)</span>'}</td><td class="small">${esc(l.reason)}</td></tr>`).join("")}</tbody>
        </table></div>` : `<div class="empty"><h2>Zatím prázdné</h2><p>Jakmile admin něco změní, objeví se to tady.</p></div>`}
      </div>`, "Záznam změn · Administrace");
    focusTitle();
  }

  /* ── router ── */
  function route() {
    const path = location.hash.replace(/^#\/?/, "").split("?")[0].split("/").filter(Boolean);
    const [a, b, c] = path;
    if (a === "prihlaseni") return viewLogin();
    if (a === "overeni") return viewVerify();
    if (a === "nahlasit") { window.scrollTo(0, 0); return viewReportPage(); }   // jde i bez přihlášení
    if (!loggedIn()) { location.replace("#/prihlaseni"); return; }
    if (!S.rules && a !== "vitej") { location.replace("#/vitej/pravidla"); return; }
    if (a === "vitej") return b === "profil" && S.rules ? viewOnboardProfile() : viewRules();
    if (a === "lide" && b) { lastScroll = lastScroll || 0; window.scrollTo(0, 0); return viewPerson(b); }
    if (a === "lide") { viewList(); requestAnimationFrame(() => window.scrollTo(0, lastScroll)); return; }
    if (a === "profil") { window.scrollTo(0, 0); return viewProfile(); }
    if (a === "nastaveni") { window.scrollTo(0, 0); return viewSettings(); }
    if (a === "admin") {
      window.scrollTo(0, 0);
      if (!isAdmin()) return noAccess();
      if (b === "uzivatel" && c) return viewAdminUser(c);
      if (b === "zaznam") return viewAdminLog();
      if (b === "hlaseni") return c ? viewAdminReport(c) : viewAdminReports();
      return viewAdmin();
    }
    location.replace("#/lide");
  }
  // pamatuj pozici v seznamu, ať "Zpět na seznam" vrací na stejné místo
  window.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#/lide/"]');
    if (a && location.hash.startsWith("#/lide") && !/^#\/lide\/[^?]/.test(location.hash)) lastScroll = window.scrollY;
  }, true);
  // změny filtrů jdou přes replaceState a hashchange nespouští, sem chodí jen skutečná navigace
  window.addEventListener("hashchange", route);
  route();
})();
