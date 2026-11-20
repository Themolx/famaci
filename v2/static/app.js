/* Famáci 2.0 · lokální prototyp. Bez knihoven. */
(function () {
  "use strict";
  const app = document.getElementById("app");
  const S = { me: null, meta: null };
  const coll = new Intl.Collator("cs", { sensitivity: "base" });

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const href = (...p) => "#/" + p.map(encodeURIComponent).join("/");
  const deptName = (c) => { const d = (S.meta ? S.meta.depts : []).find((x) => x.code === c); return d ? d.name : (c || ""); };
  const fmtDate = (d) => d ? `${+d.slice(8, 10)}. ${+d.slice(5, 7)}. ${d.slice(0, 4)}` : "";
  const plural = (n, a, b, c) => `${n} ${n === 1 ? a : n >= 2 && n <= 4 ? b : c}`;

  async function api(method, path, body) {
    const opt = { method, credentials: "same-origin", headers: {} };
    if (body !== undefined) { opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
    const r = await fetch(path, opt);
    let j = null;
    try { j = await r.json(); } catch (e) { j = null; }
    if (!r.ok) {
      const err = new Error((j && j.error) || "Chyba " + r.status);
      err.status = r.status;
      throw err;
    }
    return j;
  }
  function msg(el, text, kind) { if (el) el.innerHTML = text ? `<div class="msg ${kind || "err"}">${esc(text)}</div>` : ""; }

  // contacts: verified profiles show what the owner filled in; unclaimed archive records stay masked until clicked
  function phoneHTML(p) {
    if (!p.phone) return `<span class="muted">-</span>`;
    if (!p.verified) return `<button class="masked btn small" data-show="${esc(p.phone)}" title="Archivní údaj, člověk ho sám nepotvrdil">${esc(p.phone.replace(/\d/g, "•"))}</button>`;
    return `<a class="mono" href="tel:${esc(p.phone.replace(/\s/g, ""))}">${esc(p.phone)}</a>`;
  }
  function emailOf(p) { return p.contact_email || p.email || ""; }
  function emailHTML(p) {
    const e = emailOf(p);
    if (!e) return `<span class="muted">-</span>`;
    if (!p.verified) return `<button class="masked btn small" data-show="${esc(e)}">•••@${esc(e.split("@")[1] || "")}</button>`;
    return `<a href="mailto:${esc(e)}">${esc(e)}</a>`;
  }
  function badge(p) { return p.verified ? `<span class="pill ok">ověřený</span>` : `<span class="pill arch">archiv</span>`; }
  function rolesHTML(roles) { return (roles || []).map((r) => `<span class="pill">${esc(r)}</span>`).join(""); }
  document.addEventListener("click", (e) => { if (e.target.closest("[data-claim]")) onClaim(e); });
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-show]");
    if (b) { b.replaceWith(Object.assign(document.createElement("span"), { className: "mono", textContent: b.dataset.show })); }
  });

  // ------------------------------------------------------------ auth views
  function viewLogin() {
    const doms = (S.me && S.me.domains || []).map((d) => "@" + d).join(" nebo ");
    app.innerHTML = `<div class="narrow">
      <h1>Přihlášení</h1>
      <p class="muted">Pošleme ti odkaz na školní e-mail (${esc(doms)}). Žádné heslo. Upravovat můžeš jen profil, který patří k tvému e-mailu.</p>
      <form class="f panel" id="login">
        <label><span>Školní e-mail</span><input type="email" name="email" required autocomplete="email" placeholder="jmeno.prijmeni@famu.cz"></label>
        <div class="actions"><button class="btn primary" type="submit">Poslat odkaz</button></div>
        <div id="m"></div>
      </form></div>`;
    const f = document.getElementById("login");
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const m = document.getElementById("m");
      try {
        const r = await api("POST", "/api/auth/request", { email: f.email.value.trim() });
        m.innerHTML = `<div class="msg ok">Odkaz odešel na ${esc(f.email.value.trim())}. Platí 15 minut.</div>` +
          (r.dev_outbox ? `<div class="msg info">Vývojový režim: mail se neodeslal, je v <a href="${esc(r.dev_outbox)}">odchozí poště</a>.</div>` : "");
      } catch (err) { msg(m, err.message); }
    });
  }
  function viewVerify(token) {
    app.innerHTML = `<div class="narrow"><h1>Přihlásit se</h1>
      <p class="muted">Potvrď přihlášení. (Tlačítko je tu schválně, aby odkaz nespotřeboval náhled v poštovním programu.)</p>
      <div class="actions"><button class="btn primary" id="go">Přihlásit</button></div><div id="m"></div></div>`;
    document.getElementById("go").addEventListener("click", async () => {
      try {
        await api("POST", "/api/auth/verify", { token });
        await loadMe();
        location.hash = S.me.profile ? "#/lide" : "#/vitej";
      } catch (err) { msg(document.getElementById("m"), err.message); }
    });
  }

  // ------------------------------------------------------------ onboarding
  function viewWelcome() {
    const sug = S.me.suggestions || [];
    app.innerHTML = `
      <h1>Vítej v Famácích</h1>
      <p class="muted">Přihlášen(a) jako <b>${esc(S.me.email)}</b>. Buď převezmi svůj záznam ze starých Famáků (2008 až 2025), nebo si založ nový profil.</p>
      <div class="panel">
        <h2>Jsi ve starém archivu?</h2>
        ${sug.length ? `<p class="small muted">Podle tvé adresy to vypadá na:</p><ul class="plain suggest" id="sug">${sug.map(sugLi).join("")}</ul>` : `<p class="small muted">Podle adresy jsme nic nenašli. Zkus hledat jméno.</p>`}
        <div class="toolbar"><input type="search" id="aq" placeholder="Hledat své jméno v archivu…"></div>
        <ul class="plain suggest" id="ares"></ul>
        <p class="small muted">Převzetí je jen jednou a jen pro nepřevzatý záznam. Každé převzetí se zapisuje do logu.</p>
      </div>
      <div class="panel"><h2>Nový profil</h2>${profileForm({}, "create")}</div>`;
    bindProfileForm(null);
    const aq = document.getElementById("aq");
    let t = null;
    aq.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(async () => {
        const q = aq.value.trim();
        const box = document.getElementById("ares");
        if (q.length < 2) { box.innerHTML = ""; return; }
        const r = await api("GET", "/api/profiles?source=archive&limit=15&q=" + encodeURIComponent(q));
        box.innerHTML = r.items.map(sugLi).join("") || `<li class="muted">Nic.</li>`;
      }, 200);
    });
  }
  function sugLi(p) {
    return `<li><b>${esc(p.name)}</b> <span class="muted small">${esc(deptName(p.dept))}${p.cohort ? " · " + esc(p.cohort) : ""}${p.why ? " · " + esc(p.why) : ""}</span>
      <button class="btn small" data-claim="${p.id}">To jsem já</button></li>`;
  }
  async function onClaim(e) {
    const b = e.target.closest("[data-claim]");
    if (!b) return;
    const li = b.closest("li");
    if (!confirm("Převzít tenhle archivní záznam jako svůj profil? Potom ho budeš moct upravit nebo smazat.")) return;
    try {
      await api("POST", `/api/profiles/${b.dataset.claim}/claim`, {});
      await loadMe();
      location.hash = "#/ja";
    } catch (err) { li.insertAdjacentHTML("beforeend", `<div class="msg err">${esc(err.message)}</div>`); }
  }

  // ------------------------------------------------------------ profile form
  function profileForm(p, mode) {
    const roles = new Set(p.roles || []);
    const custom = (p.roles || []).filter((r) => !S.meta.roles.includes(r));
    return `<form class="f" id="pform">
      <div class="row2">
        <label><span>Jméno a příjmení</span><input type="text" name="name" required value="${esc(p.name || "")}"></label>
        <label><span>Telefon</span><input type="tel" name="phone" value="${esc(p.phone || "")}" placeholder="777 123 456"></label>
      </div>
      <div class="row2">
        <label><span>Katedra</span><select name="dept"><option value="">-</option>${S.meta.depts.map((d) => `<option value="${d.code}" ${p.dept === d.code ? "selected" : ""}>${esc(d.name)}</option>`).join("")}</select></label>
        <label><span>Ročník (rok nástupu)</span><input type="text" name="cohort" value="${esc(p.cohort || "")}" placeholder="2024/25" pattern="(19|20)\\d\\d/\\d\\d"></label>
      </div>
      <div class="row2">
        <label><span>Kontaktní e-mail</span><input type="email" name="contact_email" value="${esc(p.contact_email || "")}" placeholder="když nechceš školní ${esc(S.me.email)}"></label>
        <label><span>Showreel / portfolio</span><input type="text" name="link" value="${esc(p.link || "")}" placeholder="https://…"></label>
      </div>
      <label><span>Role ve štábu</span></label>
      <div class="roles" id="roles">${S.meta.roles.map((r) => `<span class="role ${roles.has(r) ? "on" : ""}" data-role="${esc(r)}" role="checkbox" aria-checked="${roles.has(r)}" tabindex="0">${esc(r)}</span>`).join("")}</div>
      <label>Další role (oddělené čárkou)<input type="text" name="custom_roles" value="${esc(custom.join(", "))}"></label>
      <label><span>Alergie, strava</span><textarea name="allergies" placeholder="např. ořechy, bezlepková strava">${esc(p.allergies || "")}</textarea></label>
      <label class="check"><input type="checkbox" name="allergies_consent" ${p.allergies ? "checked" : ""}> <span>Souhlasím, že alergie uvidí všichni přihlášení a objeví se ve štábových listinách projektů. Smazáním textu se údaj odstraní.</span></label>
      <label><span>Poznámka</span><textarea name="note">${esc(p.note || "")}</textarea></label>
      <div class="actions"><button class="btn primary" type="submit">${mode === "create" ? "Založit profil" : "Uložit"}</button>
        ${mode === "edit" ? `<a class="btn" href="${href("lide", p.id)}">Zobrazit</a><span class="grow"></span><button class="btn danger" type="button" id="del">Smazat profil</button>` : ""}</div>
      <div id="pm"></div>
    </form>`;
  }
  function bindProfileForm(p) {
    const f = document.getElementById("pform");
    const roles = document.getElementById("roles");
    const toggle = (el) => { el.classList.toggle("on"); el.setAttribute("aria-checked", el.classList.contains("on")); };
    roles.addEventListener("click", (e) => { const r = e.target.closest("[data-role]"); if (r) toggle(r); });
    roles.addEventListener("keydown", (e) => { const r = e.target.closest("[data-role]"); if (r && (e.key === " " || e.key === "Enter")) { e.preventDefault(); toggle(r); } });
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const picked = [...roles.querySelectorAll(".role.on")].map((x) => x.dataset.role);
      const custom = f.custom_roles.value.split(",").map((s) => s.trim()).filter(Boolean);
      const body = {
        name: f.name.value, phone: f.phone.value, dept: f.dept.value, cohort: f.cohort.value,
        contact_email: f.contact_email.value, link: f.link.value, allergies: f.allergies.value,
        allergies_consent: f.allergies_consent.checked, note: f.note.value, roles: [...picked, ...custom],
      };
      try {
        if (p) await api("PUT", "/api/profiles/" + p.id, body);
        else await api("POST", "/api/profiles", body);
        await loadMe();
        if (p) msg(document.getElementById("pm"), "Uloženo.", "ok");
        else location.hash = "#/ja";
      } catch (err) { msg(document.getElementById("pm"), err.message); }
    });
    const del = document.getElementById("del");
    if (del) del.addEventListener("click", async () => {
      if (!confirm("Opravdu smazat profil? Zmizí i ze všech štábů. Nejde to vrátit.")) return;
      try { await api("DELETE", "/api/profiles/" + p.id); await loadMe(); location.hash = "#/vitej"; }
      catch (err) { msg(document.getElementById("pm"), err.message); }
    });
  }
  function viewMe() {
    const p = S.me.profile;
    if (!p) { location.hash = "#/vitej"; return; }
    app.innerHTML = `<h1>Můj profil</h1>
      <p class="muted">Přihlášen(a) jako <b>${esc(S.me.email)}</b>. ${p.source === "archive" ? "Profil vznikl převzetím záznamu ze starých Famáků." : ""}</p>
      <div class="panel">${profileForm(p, "edit")}</div>`;
    bindProfileForm(p);
  }

  // ------------------------------------------------------------ people
  const peopleState = { q: "", role: "", dept: "", source: "", offset: 0 };
  function viewPeople() {
    app.innerHTML = `<h1>Lidé</h1>
      <div class="toolbar">
        <input type="search" id="pq" placeholder="Jméno, role, katedra, ročník…" value="${esc(peopleState.q)}">
        <select id="prole"><option value="">Všechny role</option>${S.meta.roles.map((r) => `<option ${peopleState.role === r ? "selected" : ""}>${esc(r)}</option>`).join("")}</select>
        <select id="pdept"><option value="">Všechny katedry</option>${S.meta.depts.map((d) => `<option value="${d.code}" ${peopleState.dept === d.code ? "selected" : ""}>${esc(d.name)}</option>`).join("")}</select>
        <select id="psrc"><option value="">Ověření i archiv</option><option value="verified" ${peopleState.source === "verified" ? "selected" : ""}>Jen ověření</option><option value="archive" ${peopleState.source === "archive" ? "selected" : ""}>Jen archiv</option></select>
      </div>
      <p class="small muted" id="pcount"></p>
      <div class="scroll-x"><table class="t" id="ptable"><thead><tr><th>Jméno</th><th>Katedra · ročník</th><th>Role</th><th>Telefon</th><th>E-mail</th></tr></thead><tbody></tbody></table></div>
      <div class="actions mt"><button class="btn" id="more" hidden>Načíst další</button></div>`;
    const load = async (append) => {
      const ps = peopleState;
      const qs = new URLSearchParams({ q: ps.q, role: ps.role, dept: ps.dept, source: ps.source, offset: ps.offset, limit: 100 });
      const r = await api("GET", "/api/profiles?" + qs);
      const tb = document.querySelector("#ptable tbody");
      if (!tb) return;
      const rows = r.items.map((p) => `<tr><td><a href="${href("lide", p.id)}">${esc(p.name)}</a> ${badge(p)}</td>
        <td>${esc(deptName(p.dept))}${p.cohort ? ` · ${esc(p.cohort)}` : ""}</td><td>${rolesHTML(p.roles)}</td>
        <td>${phoneHTML(p)}</td><td>${emailHTML(p)}</td></tr>`).join("");
      tb.innerHTML = (append ? tb.innerHTML : "") + (rows || (append ? "" : `<tr><td colspan="5" class="muted">Nikdo.</td></tr>`));
      document.getElementById("pcount").textContent = plural(r.total, "člověk", "lidé", "lidí") + " · archivní kontakty jsou skryté, klikni pro zobrazení";
      document.getElementById("more").hidden = r.offset + r.items.length >= r.total;
    };
    let t = null;
    const reload = () => { peopleState.offset = 0; load(false).catch(fail); };
    document.getElementById("pq").addEventListener("input", (e) => { peopleState.q = e.target.value; clearTimeout(t); t = setTimeout(reload, 200); });
    document.getElementById("prole").addEventListener("change", (e) => { peopleState.role = e.target.value; reload(); });
    document.getElementById("pdept").addEventListener("change", (e) => { peopleState.dept = e.target.value; reload(); });
    document.getElementById("psrc").addEventListener("change", (e) => { peopleState.source = e.target.value; reload(); });
    document.getElementById("more").addEventListener("click", () => { peopleState.offset += 100; load(true).catch(fail); });
    load(false).catch(fail);
  }
  async function viewPerson(id) {
    const p = await api("GET", "/api/profiles/" + id);
    const a = p.archive;
    app.innerHTML = `<p class="muted"><a href="#/lide">← Lidé</a></p>
      <h1>${esc(p.name)} ${badge(p)}</h1>
      <div class="panel"><dl class="kv">
        <dt>Katedra</dt><dd>${esc(deptName(p.dept)) || "-"}</dd>
        <dt>Ročník</dt><dd>${esc(p.cohort || "-")}${a && a.cohort_inferred ? ` <span class="pill arch">odvozený z archivu</span>` : ""}</dd>
        <dt>Role</dt><dd>${rolesHTML(p.roles) || `<span class="muted">-</span>`}</dd>
        <dt>Telefon</dt><dd>${phoneHTML(p)}</dd>
        <dt>E-mail</dt><dd>${emailHTML(p)}</dd>
        ${p.link ? `<dt>Showreel</dt><dd><a href="${esc(p.link)}" target="_blank" rel="noreferrer noopener">${esc(p.link)}</a></dd>` : ""}
        <dt>Alergie, strava</dt><dd>${p.allergies ? esc(p.allergies) : `<span class="muted">-</span>`}</dd>
        ${p.note ? `<dt>Poznámka</dt><dd>${esc(p.note)}</dd>` : ""}
        ${a ? `<dt>Ve starých Famácích</dt><dd>${esc(a.first_seen.slice(0, 4))} až ${esc(a.last_seen.slice(0, 4))} · ${plural(a.versions, "verze", "verze", "verzí")} stránky</dd>` : ""}
        <dt>Projekty</dt><dd>${p.projects.length ? p.projects.map((x) => `<a href="${href("projekty", x.id)}">${esc(x.title)}</a> <span class="muted small">${esc(x.role)}</span>`).join("<br>") : `<span class="muted">-</span>`}</dd>
      </dl>
      <div class="actions">
        ${p.mine ? `<a class="btn primary" href="#/ja">Upravit</a>` : ""}
        ${!p.verified && !S.me.profile ? `<button class="btn" data-claim="${p.id}">To jsem já, převzít</button>` : ""}
        ${!p.verified ? `<span class="small muted">Archivní záznam, nikdo ho zatím nepřevzal. Upravit ho může jen ten, kdo se přihlásí a převezme ho.</span>` : ""}
      </div></div>`;
  }

  // ------------------------------------------------------------ projects
  async function viewProjects() {
    const r = await api("GET", "/api/projects");
    app.innerHTML = `<h1>Projekty</h1>
      <div class="grid">${r.items.map((p) => `<a class="card" href="${href("projekty", p.id)}"><div class="t">${esc(p.title)}</div>
        <div class="m">${esc(p.kind || "")}${p.starts ? " · " + fmtDate(p.starts) : ""}${p.ends && p.ends !== p.starts ? " až " + fmtDate(p.ends) : ""}</div>
        <div class="m">${plural(p.crew_count, "člen", "členové", "členů")} štábu${p.mine ? " · můj" : ""}</div></a>`).join("") || `<p class="muted">Zatím žádný projekt.</p>`}</div>
      <div class="panel"><h2>Nový projekt</h2>${projectForm({})}</div>`;
    bindProjectForm(null);
  }
  function projectForm(p) {
    return `<form class="f" id="prform">
      <div class="row2"><label><span>Název</span><input type="text" name="title" required value="${esc(p.title || "")}"></label>
      <label><span>Typ</span><input type="text" name="kind" list="kinds" value="${esc(p.kind || "")}" placeholder="cvičení, absolventský film…"></label></div>
      <datalist id="kinds"><option>Cvičení 1. ročníku</option><option>Cvičení</option><option>Bakalářský film</option><option>Absolventský film</option><option>Dokument</option><option>Animace</option><option>Videoklip</option><option>Reklama</option></datalist>
      <div class="row2"><label><span>Natáčení od</span><input type="date" name="starts" value="${esc(p.starts || "")}"></label>
      <label><span>Natáčení do</span><input type="date" name="ends" value="${esc(p.ends || "")}"></label></div>
      <label><span>Místo</span><input type="text" name="location" value="${esc(p.location || "")}"></label>
      <label><span>Popis</span><textarea name="description">${esc(p.description || "")}</textarea></label>
      <div class="actions"><button class="btn primary" type="submit">${p.id ? "Uložit" : "Založit projekt"}</button>
      ${p.id && p.owner_email === S.me.email ? `<span class="grow"></span><button class="btn danger" type="button" id="prdel">Smazat projekt</button>` : ""}</div>
      <div id="prm"></div></form>`;
  }
  function bindProjectForm(p) {
    const f = document.getElementById("prform");
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = { title: f.title.value, kind: f.kind.value, starts: f.starts.value, ends: f.ends.value, location: f.location.value, description: f.description.value };
      try {
        if (p) { await api("PUT", "/api/projects/" + p.id, body); route(); }
        else { const r = await api("POST", "/api/projects", body); location.hash = href("projekty", r.id); }
      } catch (err) { msg(document.getElementById("prm"), err.message); }
    });
    const del = document.getElementById("prdel");
    if (del) del.addEventListener("click", async () => {
      if (!confirm("Smazat projekt i se štábem? Nejde to vrátit.")) return;
      try { await api("DELETE", "/api/projects/" + p.id); location.hash = "#/projekty"; } catch (err) { msg(document.getElementById("prm"), err.message); }
    });
  }
  async function viewProject(id) {
    const p = await api("GET", "/api/projects/" + id);
    const ed = p.can_edit;
    app.innerHTML = `<p class="muted"><a href="#/projekty">← Projekty</a></p>
      <h1>${esc(p.title)}</h1>
      <p class="muted">${esc(p.kind || "")}${p.starts ? " · " + fmtDate(p.starts) : ""}${p.ends && p.ends !== p.starts ? " až " + fmtDate(p.ends) : ""}${p.location ? " · " + esc(p.location) : ""} · založil(a) ${esc(p.owner_email)}</p>
      ${p.description ? `<p>${esc(p.description)}</p>` : ""}
      <div class="actions noprint">
        <a class="btn primary" href="${href("projekty", p.id, "listina")}">Štábová listina</a>
        <a class="btn" href="/api/projects/${p.id}/crew.csv">Stáhnout CSV</a>
        <a class="btn" href="/api/projects/${p.id}/crew" target="_blank" rel="noopener">JSON (API)</a>
      </div>
      <h2>Štáb (${p.crew.length})</h2>
      <div class="scroll-x"><table class="t" id="crew"><thead><tr><th>Role</th><th>Jméno</th><th>Telefon</th><th>E-mail</th><th>Alergie</th><th>Poznámka</th>${ed ? "<th></th>" : ""}</tr></thead><tbody>
      ${p.crew.map((m) => `<tr><td>${esc(m.role)}${m.production ? ` <span class="pill ok" title="Může upravovat projekt">produkce</span>` : ""}</td>
        <td><a href="${href("lide", m.profile_id)}">${esc(m.name)}</a> ${m.verified ? "" : `<span class="pill arch">archiv</span>`}</td>
        <td>${phoneHTML(m)}</td><td>${emailHTML(m)}</td><td>${esc(m.allergies || "")}</td><td>${esc(m.call_note || "")}</td>
        ${ed ? `<td class="actions"><button class="btn small" data-prod="${m.member_id}" data-v="${m.production ? 0 : 1}">${m.production ? "zrušit produkci" : "dát produkci"}</button><button class="btn small danger" data-rm="${m.member_id}">odebrat</button></td>` : ""}</tr>`).join("") || `<tr><td colspan="7" class="muted">Zatím nikdo.</td></tr>`}
      </tbody></table></div>
      ${ed ? `<div class="panel noprint"><h2>Přidat do štábu</h2>
        <div class="toolbar"><input type="search" id="mq" placeholder="Hledat člověka (jméno, role, katedra)…"></div>
        <ul class="plain suggest" id="mres"></ul>
        <form class="f" id="mform" hidden>
          <p>Vybráno: <b id="msel"></b></p>
          <div class="row2"><label><span>Role</span><input type="text" name="role" list="rolelist" required></label>
          <label><span>Poznámka (call time, scény…)</span><input type="text" name="call_note"></label></div>
          <datalist id="rolelist">${S.meta.roles.map((r) => `<option>${esc(r)}</option>`).join("")}</datalist>
          <label class="check"><input type="checkbox" name="production"> <span>Patří do produkce (může upravovat projekt a štáb)</span></label>
          <div class="actions"><button class="btn primary" type="submit">Přidat</button></div>
        </form><div id="mm"></div></div>
        <div class="panel noprint"><h2>Upravit projekt</h2>${projectForm(p)}</div>` : `<p class="small muted">Štáb upravuje jen produkce projektu.</p>`}`;
    if (!ed) return;
    bindProjectForm(p);
    document.getElementById("crew").addEventListener("click", async (e) => {
      const rm = e.target.closest("[data-rm]"), pr = e.target.closest("[data-prod]");
      try {
        if (rm && confirm("Odebrat ze štábu?")) { await api("DELETE", `/api/projects/${id}/members/${rm.dataset.rm}`); route(); }
        if (pr) { await api("PUT", `/api/projects/${id}/members/${pr.dataset.prod}`, { production: pr.dataset.v === "1" }); route(); }
      } catch (err) { msg(document.getElementById("mm"), err.message); }
    });
    let sel = null, t = null;
    const mq = document.getElementById("mq"), mres = document.getElementById("mres"), mform = document.getElementById("mform");
    mq.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(async () => {
        const q = mq.value.trim();
        if (q.length < 2) { mres.innerHTML = ""; return; }
        const r = await api("GET", "/api/profiles?limit=8&q=" + encodeURIComponent(q));
        mres.innerHTML = r.items.map((x) => `<li><button class="btn small" data-pick="${x.id}" data-name="${esc(x.name)}" data-roles="${esc((x.roles || []).join("|"))}">vybrat</button>
          <b>${esc(x.name)}</b> ${badge(x)} <span class="muted small">${esc(deptName(x.dept))}${x.cohort ? " · " + esc(x.cohort) : ""}</span> ${rolesHTML(x.roles)}</li>`).join("") || `<li class="muted">Nikdo.</li>`;
      }, 200);
    });
    mres.addEventListener("click", (e) => {
      const b = e.target.closest("[data-pick]");
      if (!b) return;
      sel = +b.dataset.pick;
      document.getElementById("msel").textContent = b.dataset.name;
      mform.hidden = false;
      const roles = b.dataset.roles ? b.dataset.roles.split("|") : [];
      if (roles.length && !mform.role.value) mform.role.value = roles[0];
      mform.role.focus();
    });
    mform.addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        await api("POST", `/api/projects/${id}/members`, { profile_id: sel, role: mform.role.value, call_note: mform.call_note.value, production: mform.production.checked });
        route();
      } catch (err) { msg(document.getElementById("mm"), err.message); }
    });
  }
  async function viewCallsheet(id) {
    const r = await api("GET", `/api/projects/${id}/crew`);
    const p = r.project;
    // every contact on a call sheet is shown: that is its purpose
    app.innerHTML = `<div class="callsheet">
      <p class="noprint"><a href="${href("projekty", id)}">← Projekt</a> · <button class="btn small" id="print">Tisknout</button> · <a class="btn small" href="/api/projects/${id}/crew.csv">CSV</a></p>
      <h1>Štábová listina · ${esc(p.title)}</h1>
      <div class="meta">${p.kind ? `<span>${esc(p.kind)}</span>` : ""}${p.starts ? `<span>${fmtDate(p.starts)}${p.ends && p.ends !== p.starts ? " až " + fmtDate(p.ends) : ""}</span>` : ""}${p.location ? `<span>${esc(p.location)}</span>` : ""}<span>${plural(r.crew.length, "člen", "členové", "členů")} štábu</span></div>
      <table class="t" id="sheet"><thead><tr><th>Role</th><th>Jméno</th><th>Telefon</th><th>E-mail</th><th>Alergie, strava</th><th>Poznámka</th></tr></thead><tbody>
      ${r.crew.slice().sort((a, b) => b.production - a.production || coll.compare(a.role, b.role)).map((m) => `<tr><td>${esc(m.role)}</td><td>${esc(m.name)}</td><td class="mono">${esc(m.phone || "")}</td><td>${esc(m.email || "")}</td><td>${esc(m.allergies || "")}</td><td>${esc(m.call_note || "")}</td></tr>`).join("")}
      </tbody></table>
      <p class="small muted">Vytištěno z Famáků ${fmtDate(new Date().toISOString().slice(0, 10))}. Obsahuje osobní údaje, po natáčení skartovat.</p></div>`;
    document.getElementById("print").addEventListener("click", () => window.print());
  }

  // ------------------------------------------------------------ API page
  async function viewApi() {
    const r = await api("GET", "/api/tokens");
    const base = location.origin;
    app.innerHTML = `<h1>API</h1>
      <p class="muted">Data jde tahat skriptem nebo z tabulky. Přihlašuje se osobním klíčem v hlavičce <code>Authorization: Bearer …</code>. Klíč má stejná práva jako ty: čte všechno, upravuje jen tvůj profil a projekty, kde jsi v produkci.</p>
      <div class="panel"><h2>Moje klíče</h2>
        <ul class="plain" id="tokens">${r.items.map((t) => `<li class="actions">${esc(t.label)} <span class="muted small">založen ${esc(t.created)}${t.last_used ? " · naposledy " + esc(t.last_used) : " · nepoužitý"}</span><button class="btn small danger" data-tdel="${t.id}">zrušit</button></li>`).join("") || `<li class="muted">Žádný klíč.</li>`}</ul>
        <form class="toolbar" id="tform"><input type="search" name="label" placeholder="Název klíče, např. štáb do Google Sheets"><button class="btn primary">Vytvořit klíč</button></form>
        <div id="tnew"></div></div>
      <h2>Endpointy</h2>
      <pre class="code">GET  /api/me                         kdo jsem, můj profil
GET  /api/meta                       katedry a role
GET  /api/profiles?q=&role=&dept=&cohort=&source=verified|archive&limit=&offset=
GET  /api/profiles/{id}
PUT  /api/profiles/{id}              jen vlastní profil
GET  /api/projects
POST /api/projects                   {title, kind, starts, ends, location, description}
GET  /api/projects/{id}              projekt i se štábem
GET  /api/projects/{id}/crew         štábová listina (JSON)
GET  /api/projects/{id}/crew.csv     štábová listina (CSV, středník, UTF-8)
POST /api/projects/{id}/members      {profile_id, role, call_note, production}</pre>
      <h2>Příklad</h2>
      <pre class="code">curl -H "Authorization: Bearer fam_…" ${esc(base)}/api/projects/1/crew
curl -H "Authorization: Bearer fam_…" "${esc(base)}/api/profiles?role=Zvuk&amp;source=verified"</pre>`;
    document.getElementById("tform").addEventListener("submit", async (e) => {
      e.preventDefault();
      try {
        const t = await api("POST", "/api/tokens", { label: e.target.label.value });
        document.getElementById("tnew").innerHTML = `<div class="msg ok">Klíč „${esc(t.label)}“ vytvořen. Zkopíruj si ho teď, znovu se neukáže:</div><div class="tokenbox" id="tokval">${esc(t.token)}</div>`;
        const list = await api("GET", "/api/tokens");
        document.getElementById("tokens").innerHTML = list.items.map((x) => `<li class="actions">${esc(x.label)} <span class="muted small">založen ${esc(x.created)}</span><button class="btn small danger" data-tdel="${x.id}">zrušit</button></li>`).join("");
      } catch (err) { msg(document.getElementById("tnew"), err.message); }
    });
    document.getElementById("tokens").addEventListener("click", async (e) => {
      const b = e.target.closest("[data-tdel]");
      if (b && confirm("Zrušit klíč? Skripty, které ho používají, přestanou fungovat.")) { await api("DELETE", "/api/tokens/" + b.dataset.tdel); viewApi(); }
    });
  }

  // ------------------------------------------------------------ shell
  async function loadMe() {
    S.me = await api("GET", "/api/me");
    if (S.me.email && !S.meta) S.meta = await api("GET", "/api/meta");
    const who = document.getElementById("who");
    document.getElementById("nav").hidden = !S.me.email;
    who.innerHTML = S.me.email ? `<span class="email">${esc(S.me.email)}</span><button class="btn small" id="logout">Odhlásit</button>` : "";
    const lo = document.getElementById("logout");
    if (lo) lo.addEventListener("click", async () => { await api("POST", "/api/auth/logout", {}); S.me = null; S.meta = null; await loadMe(); location.hash = "#/prihlaseni"; route(); });
  }
  function fail(err) {
    if (err && err.status === 401) { loadMe().then(route); return; }
    app.innerHTML = `<div class="msg err">${esc(err && err.message || err)}</div>`;
  }
  async function route() {
    const parts = location.hash.replace(/^#\/?/, "").split("?")[0].split("/").filter(Boolean).map(decodeURIComponent);
    const name = parts[0] || "";
    document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("on", a.dataset.nav === name));
    try {
      if (name === "overit") return viewVerify(parts[1] || "");
      if (!S.me || !S.me.email) return viewLogin();
      if (!S.me.profile && !["vitej", "lide", "projekty", "api"].includes(name)) return viewWelcome();
      switch (name) {
        case "vitej": return S.me.profile ? (location.hash = "#/ja") : viewWelcome();
        case "ja": return viewMe();
        case "lide": return parts[1] ? await viewPerson(parts[1]) : viewPeople();
        case "projekty":
          if (parts[1] && parts[2] === "listina") return await viewCallsheet(parts[1]);
          return parts[1] ? await viewProject(parts[1]) : await viewProjects();
        case "api": return await viewApi();
        default: location.hash = "#/lide";
      }
    } catch (err) { fail(err); }
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  loadMe().then(route).catch(fail);
})();
