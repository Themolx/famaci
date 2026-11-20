/* Famáci 2.0 · lokální archiv. Bez knihoven, bez externích požadavků. */
(function () {
  "use strict";

  const S = {
    data: null,
    lines: null,        // versions.json, loaded lazily
    linesLoading: null,
    reveal: false,      // contacts are masked on every load
    dept: {}, ver: {}, person: [],
    deptVersions: {},   // code -> [version]
    index: [],          // search index for people
  };
  const app = document.getElementById("app");
  const coll = new Intl.Collator("cs", { sensitivity: "base" });

  // ------------------------------------------------------------ helpers
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fold = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const fmtTs = (ts) => ts ? `${+ts.slice(6, 8)}. ${+ts.slice(4, 6)}. ${ts.slice(0, 4)}` : "";
  const yr = (ts) => ts ? ts.slice(0, 4) : "";
  const plural = (n, one, few, many) => `${n} ${n === 1 ? one : n >= 2 && n <= 4 ? few : many}`;
  const href = (...parts) => "#/" + parts.map(encodeURIComponent).join("/");
  const EMAIL = /[\w.+\-]+@[\w\-]+(?:\.[\w\-]+)+/g;
  const PHONE = /(?:\+\s?|00)?\d[\d \-./]*\d/g;

  function maskText(s) {
    s = String(s || "");
    if (S.reveal) return esc(s);
    s = s.replace(EMAIL, (m) => "•••@" + m.split("@")[1]);
    s = s.replace(PHONE, (m) => (m.replace(/\D/g, "").length >= 9 ? m.replace(/\d/g, "•") : m));
    return esc(s);
  }
  function phoneHTML(p) {
    if (S.reveal) return `<a href="tel:${esc(p.replace(/\s/g, ""))}">${esc(p)}</a>`;
    return `<span class="masked" title="Skryto. Zapni „Ukázat kontakty“.">${esc(p.replace(/\d/g, "•"))}</span>`;
  }
  function emailHTML(e) {
    if (S.reveal) return `<a href="mailto:${esc(e)}">${esc(e)}</a>`;
    return `<span class="masked">•••@${esc(e.split("@")[1] || "")}</span>`;
  }
  function urlHTML(u) {
    if (!S.reveal) return `<span class="masked">odkaz skryt</span>`;
    const full = /^https?:/i.test(u) ? u : "http://" + u;
    return `<a class="ext" href="${esc(full)}" target="_blank" rel="noreferrer noopener">${esc(u)}</a>`;
  }
  function contactsHTML(p) {
    const bits = [];
    p.phones.forEach((x) => bits.push(phoneHTML(x)));
    p.emails.forEach((x) => bits.push(emailHTML(x)));
    p.urls.forEach((x) => bits.push(urlHTML(x)));
    return bits.length ? bits.join("<br>") : `<span class="muted">bez kontaktu</span>`;
  }
  function wayback(v, label) {
    return v && v.wayback ? `<a class="ext" href="${esc(v.wayback)}" target="_blank" rel="noreferrer noopener">${esc(label || "Wayback")}</a>` : "";
  }
  function highlight(text, tokens) {
    let h = esc(text);
    if (!tokens || !tokens.length) return h;
    // highlight on folded text, map back by index (fold keeps length for Latin letters)
    const f = fold(text);
    const marks = new Array(text.length).fill(false);
    tokens.forEach((t) => {
      let i = f.indexOf(t);
      while (t && i >= 0) { for (let k = i; k < i + t.length; k++) marks[k] = true; i = f.indexOf(t, i + t.length); }
    });
    if (f.length !== text.length) return h;
    let out = "", on = false;
    for (let i = 0; i < text.length; i++) {
      if (marks[i] !== on) { out += marks[i] ? "<mark>" : "</mark>"; on = marks[i]; }
      out += esc(text[i]);
    }
    return out + (on ? "</mark>" : "");
  }
  function tagsHTML(p) {
    let t = "";
    if (p.level) t += `<span class="tag">${esc(p.level)}</span>`;
    if (p.track) t += `<span class="tag">${esc(p.track)}</span>`;
    if (p.cohort_inferred) t += `<span class="tag warn" title="Na stránce stálo jen „N. ročník“, rok nástupu je dopočítaný z data prvního snímku.">odvozeno</span>`;
    if (p.name_variants.length) t += `<span class="tag" title="Jméno bylo v jiných verzích zapsané jinak">+${p.name_variants.length} zápis</span>`;
    return t;
  }
  function dotsHTML(p) {
    const vs = S.deptVersions[p.dept] || [];
    const seen = new Set(p.seen);
    if (vs.length > 40) return "";
    return `<span class="dots" aria-hidden="true">${vs.map((v) => `<i class="${seen.has(v.id) ? "on" : ""}" title="${esc(fmtTs(v.first_seen))}"></i>`).join("")}</span>`;
  }
  function presence(p) {
    const a = yr(p.first_seen), b = yr(p.last_seen);
    return `${a === b ? a : a + " až " + b} · ${p.seen.length}×`;
  }
  function deptName(code) { return code === "index" ? "Úvodní stránka" : (S.dept[code] ? S.dept[code].name : code); }
  function deptShort(code) { return code === "index" ? "Úvod" : (S.dept[code] ? S.dept[code].short : code); }

  function loadLines() {
    if (S.lines) return Promise.resolve(S.lines);
    if (!S.linesLoading) {
      S.linesLoading = fetch("data/versions.json").then((r) => {
        if (!r.ok) throw new Error("versions.json " + r.status);
        return r.json();
      }).then((j) => (S.lines = j));
    }
    return S.linesLoading;
  }

  // ------------------------------------------------------------ views
  function viewOverview() {
    const d = S.data;
    const cz = d.departments.filter((x) => x.kind === "cz");
    const intl = d.departments.filter((x) => x.kind === "intl");
    const content = d.versions.filter((v) => v.dept !== "index");
    const years = [...new Set(d.versions.map((v) => yr(v.first_seen)))].sort();
    const cohorts = [...new Set(d.people.map((p) => p.cohort_start).filter(Boolean))].sort((a, b) => a - b);
    const card = (x) => `<a class="card" href="${href("katedra", x.code)}">
        <div class="code">${esc(x.short)}</div>
        <div class="name">${esc(x.name)}</div>
        <div class="meta">${plural(x.people, "osoba", "osoby", "osob")} · ${plural(x.cohorts.filter((c) => c.label !== "bez ročníku").length, "ročník", "ročníky", "ročníků")}</div>
        <div class="meta">${plural(x.versions.length, "verze", "verze", "verzí")} · ${yr(x.first_seen)} až ${yr(x.last_seen)}</div>
      </a>`;
    return `
      <h1>Famáci 2008 až 2025</h1>
      <p class="lede">Studentský telefonní seznam FAMU na eStránkách, rekonstruovaný z Wayback Machine. Každá katedra měla jednu stránku s tabulkou za každý ročník. Tady jsou všechny archivované verze rozebrané na ročníky a osoby, s historií změn.</p>
      <div class="kpis">
        <div class="kpi"><b>${d.departments.length}</b><span>kateder a programů</span></div>
        <div class="kpi"><b>${d.people.length}</b><span>osob (katedra + ročník)</span></div>
        <div class="kpi"><b>${cohorts.length ? cohorts[0] + "–" + cohorts[cohorts.length - 1] : "-"}</b><span>roky nástupu</span></div>
        <div class="kpi"><b>${content.length}</b><span>verzí stránek kateder</span></div>
        <div class="kpi"><b>${years[0]}–${years[years.length - 1]}</b><span>snímky v archivu</span></div>
      </div>
      <h2>Katedry</h2>
      <div class="grid">${cz.map(card).join("")}</div>
      <h2>Mezinárodní programy</h2>
      <div class="grid">${intl.map(card).join("")}</div>
      <h2>Ročníky podle katedry</h2>
      <p class="muted small">Počet osob podle roku nástupu. Klik otevře ročník v katedře.</p>
      ${heatCohorts(cohorts)}
      <h2>Archivované verze podle roku</h2>
      <p class="muted small">Kolik různých verzí stránky Wayback Machine zachytil v daném roce. Klik otevře historii.</p>
      ${heatVersions(years)}
    `;
  }
  function level(n, max) {
    if (!n) return 0;
    return Math.max(1, Math.min(6, Math.ceil((n / max) * 6)));
  }
  function legend(max) {
    return `<div class="legend">méně ${[1, 2, 3, 4, 5, 6].map((l) => `<i class="l${l}"></i>`).join("")} více (max ${max})</div>`;
  }
  function heatCohorts(cohorts) {
    const d = S.data;
    const cnt = {};
    let max = 1;
    d.people.forEach((p) => {
      if (!p.cohort_start) return;
      const k = p.dept + "|" + p.cohort_start;
      cnt[k] = (cnt[k] || 0) + 1;
      max = Math.max(max, cnt[k]);
    });
    const head = cohorts.map((c) => `<th class="col">${c}/${String((c + 1) % 100).padStart(2, "0")}</th>`).join("");
    const rows = d.departments.map((x) => `<tr><th class="row"><a href="${href("katedra", x.code)}">${esc(x.short)}</a></th>${cohorts.map((c) => {
      const n = cnt[x.code + "|" + c] || 0;
      const lab = `${c}/${String((c + 1) % 100).padStart(2, "0")}`;
      return `<td class="l${level(n, max)}" title="${esc(x.short)} · ročník ${lab}: ${n}">${n ? `<a href="#/katedra/${x.code}?r=${encodeURIComponent(lab)}">${n}</a>` : ""}</td>`;
    }).join("")}</tr>`).join("");
    return `<div class="scroll-x"><table class="heat" id="heat-cohorts"><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table></div>${legend(max)}`;
  }
  function heatVersions(years) {
    const d = S.data;
    const cnt = {};
    let max = 1;
    d.versions.forEach((v) => {
      const k = v.dept + "|" + yr(v.first_seen);
      cnt[k] = (cnt[k] || 0) + 1;
      max = Math.max(max, cnt[k]);
    });
    const rowsDef = d.departments.map((x) => [x.code, x.short]).concat([["index", "Úvod"]]);
    const rows = rowsDef.map(([code, short]) => `<tr><th class="row"><a href="${href("historie", code)}">${esc(short)}</a></th>${years.map((y) => {
      const n = cnt[code + "|" + y] || 0;
      return `<td class="l${level(n, max)}" title="${esc(short)} · ${y}: ${n}">${n ? `<a href="${href("historie", code)}?y=${y}">${n}</a>` : ""}</td>`;
    }).join("")}</tr>`).join("");
    return `<div class="scroll-x"><table class="heat" id="heat-versions"><thead><tr><th></th>${years.map((y) => `<th class="col">${y}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>${legend(max)}`;
  }

  function viewDept(code, params) {
    const x = S.dept[code];
    if (!x) return `<h1>Neznámá katedra</h1><p><a href="#/">Zpět na přehled</a></p>`;
    const sel = params.get("r") || "";
    const f = params.get("f") || "";
    const onlyC = params.get("c") === "1";
    const ftoks = fold(f).split(/\s+/).filter(Boolean);
    let ps = S.person.filter((p) => p.dept === code);
    if (sel) ps = ps.filter((p) => (p.cohort || "bez ročníku") === sel);
    if (onlyC) ps = ps.filter((p) => p.phones.length || p.emails.length || p.urls.length);
    if (ftoks.length) ps = ps.filter((p) => ftoks.every((t) => S.index[p.id].includes(t)));
    const groups = new Map();
    ps.forEach((p) => {
      const k = p.cohort || "bez ročníku";
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(p);
    });
    const keys = [...groups.keys()].sort((a, b) => (a === "bez ročníku" ? 1 : b === "bez ročníku" ? -1 : b.localeCompare(a)));
    const vs = S.deptVersions[code];
    const chipQ = (r) => {
      const q = new URLSearchParams();
      if (r) q.set("r", r);
      if (f) q.set("f", f);
      if (onlyC) q.set("c", "1");
      const s = q.toString();
      return `#/katedra/${code}${s ? "?" + s : ""}`;
    };
    const sections = keys.map((k) => {
      const list = groups.get(k).sort((a, b) => coll.compare(a.name, b.name));
      return `<section class="cohort" data-cohort="${esc(k)}">
        <header><h3>${k === "bez ročníku" ? "Bez ročníku" : "Ročník " + esc(k)}</h3>
        <span class="muted small">${plural(list.length, "osoba", "osoby", "osob")}</span></header>
        <table class="people"><tbody>${list.map((p) => `<tr>
          <td class="n"><a href="${href("osoba", p.id)}">${highlight(p.name, ftoks)}</a>${tagsHTML(p)}</td>
          <td class="c">${contactsHTML(p)}</td>
          <td class="s" title="V kolika archivovaných verzích stránky se záznam objevil">${presence(p)}${dotsHTML(p)}</td>
        </tr>`).join("")}</tbody></table></section>`;
    }).join("");
    const raws = S.data.raw.filter((r) => S.ver[r.version].dept === code);
    return `
      <div class="chips">${S.data.departments.map((d) => `<a class="chip ${d.code === code ? "on" : ""}" href="${href("katedra", d.code)}">${esc(d.short)}</a>`).join("")}</div>
      <h1>${esc(x.name)}</h1>
      <p class="muted">${esc(x.pages.join(", "))} · ${plural(vs.length, "verze", "verze", "verzí")} od ${fmtTs(x.first_seen)} do ${fmtTs(x.last_seen)} · <a href="${href("historie", code)}">historie změn</a></p>
      <div class="chips" id="cohort-chips">
        <a class="chip ${sel ? "" : "on"}" href="${chipQ("")}">Všechny<span class="n">${x.people}</span></a>
        ${x.cohorts.map((c) => `<a class="chip ${sel === c.label ? "on" : ""}" href="${chipQ(c.label)}">${esc(c.label)}<span class="n">${c.people}</span></a>`).join("")}
      </div>
      <div class="toolbar">
        <input type="search" id="dept-filter" placeholder="Filtrovat v katedře…" value="${esc(f)}" aria-label="Filtrovat v katedře">
        <label><input type="checkbox" id="only-contact" ${onlyC ? "checked" : ""}> jen s kontaktem</label>
        <span>${plural(ps.length, "záznam", "záznamy", "záznamů")}</span>
      </div>
      ${sections || `<div class="empty">Nic nenalezeno.</div>`}
      ${rawHTML(raws)}
    `;
  }
  function rawHTML(raws) {
    if (!raws.length) return "";
    // the same raw row repeats in many versions: show each distinct row once
    const uniq = new Map();
    raws.forEach((r) => {
      const k = r.cells.join("\u0001") + "|" + (r.cohort || "");
      if (!uniq.has(k)) uniq.set(k, { r, vs: [] });
      uniq.get(k).vs.push(r.version);
    });
    const rows = [...uniq.values()].map(({ r, vs }) => {
      const first = S.ver[vs[0]];
      return `<tr><td class="small muted">${fmtTs(first.first_seen)}${vs.length > 1 ? ` (+${vs.length - 1})` : ""}</td><td class="small">${esc(r.cohort || "-")}</td><td class="small muted">${esc(r.why)}</td><td class="mono small">${r.cells.map(maskText).join(" │ ")}</td></tr>`;
    }).join("");
    return `<details class="raw"><summary>Neroztříděné řádky (${uniq.size} různých, ${raws.length} výskytů)</summary>
      <p class="muted small">Řádky, které parser nedokázal spolehlivě rozdělit na osoby. Nic se nezahazuje, jsou tu tak, jak byly na stránce.</p>
      <table><tbody>${rows}</tbody></table></details>`;
  }

  function viewPerson(id) {
    const p = S.person[+id];
    if (!p) return `<h1>Záznam nenalezen</h1>`;
    const x = S.dept[p.dept];
    const vs = p.seen.map((v) => S.ver[v]);
    return `<div class="person">
      <p class="muted"><a href="${href("katedra", p.dept)}">${esc(x.name)}</a>${p.cohort ? ` · <a href="#/katedra/${p.dept}?r=${encodeURIComponent(p.cohort)}">ročník ${esc(p.cohort)}</a>` : ""}</p>
      <h1>${esc(p.name)}</h1>
      <dl>
        <dt>Ročník</dt><dd>${p.cohort ? esc(p.cohort) : "neuveden"}${p.cohort_inferred ? ` <span class="tag warn">odvozeno z „N. ročník“</span>` : ""}</dd>
        ${p.level ? `<dt>Studium</dt><dd>${esc(p.level)}</dd>` : ""}
        ${p.track ? `<dt>Program / obor</dt><dd>${esc(p.track)}</dd>` : ""}
        <dt>Kontakt</dt><dd class="mono">${contactsHTML(p)}</dd>
        ${p.notes.length ? `<dt>Poznámka</dt><dd>${p.notes.map(maskText).join("<br>")}</dd>` : ""}
        ${p.name_variants.length ? `<dt>Jiné zápisy</dt><dd>${p.name_variants.map(esc).join(", ")}</dd>` : ""}
        <dt>V archivu</dt><dd>${presence(p)} ${dotsHTML(p)}</dd>
        ${p.merged_paste ? `<dt>Pozor</dt><dd class="muted">Rozděleno ze sloučené buňky (Word paste 2011), přiřazení jména a čísla může být posunuté.</dd>` : ""}
      </dl>
      <h2>Verze stránky, kde se objevil(a)</h2>
      <ul class="tl">${vs.map((v) => `<li><span class="mono">${fmtTs(v.first_seen)}${v.last_seen !== v.first_seen ? " až " + fmtTs(v.last_seen) : ""}</span>
        <span class="muted">${esc(v.page)}</span>
        <a href="${href("historie", v.dept, v.id)}">verze v historii</a> ${wayback(v)}</li>`).join("")}</ul>
    </div>`;
  }

  function searchPeople(q) {
    const toks = fold(q).split(/\s+/).filter(Boolean);
    if (!toks.length) return { toks, hits: [] };
    const hits = [];
    for (const p of S.person) {
      const hay = S.index[p.id] + (S.reveal ? " " + p.phones.map((x) => x.replace(/\D/g, "")).join(" ") + " " + fold(p.emails.join(" ")) : "");
      if (toks.every((t) => hay.includes(t.replace(/^\+/, "")))) hits.push(p);
    }
    hits.sort((a, b) => coll.compare(a.dept, b.dept) || (b.cohort_start || 0) - (a.cohort_start || 0) || coll.compare(a.name, b.name));
    return { toks, hits };
  }
  function viewSearch(params) {
    const q = params.get("q") || "";
    const k = params.get("k") || "";
    let { toks, hits } = searchPeople(q);
    if (k) hits = hits.filter((p) => p.dept === k);
    const byDept = {};
    searchPeople(q).hits.forEach((p) => (byDept[p.dept] = (byDept[p.dept] || 0) + 1));
    const LIMIT = 400;
    const rows = hits.slice(0, LIMIT).map((p) => `<tr>
      <td class="n"><a href="${href("osoba", p.id)}">${highlight(p.name, toks)}</a>${tagsHTML(p)}</td>
      <td><a href="${href("katedra", p.dept)}">${esc(deptShort(p.dept))}</a> · ${p.cohort ? `<a href="#/katedra/${p.dept}?r=${encodeURIComponent(p.cohort)}">${esc(p.cohort)}</a>` : "bez ročníku"}</td>
      <td class="c">${contactsHTML(p)}</td>
      <td class="s">${presence(p)}</td></tr>`).join("");
    const chipQ = (kk) => `#/hledat?q=${encodeURIComponent(q)}${kk ? "&k=" + kk : ""}`;
    return `
      <h1>Hledat</h1>
      <p class="muted small">Bez ohledu na diakritiku a velikost písmen, všechna slova musí sedět. Hledá ve jménech, katedrách, ročnících, programech a poznámkách${S.reveal ? ", i v telefonech a e-mailech" : ". Telefony a e-maily se prohledávají až po zapnutí „Ukázat kontakty“"}. Pod osobami je fulltext přes surový text všech verzí.</p>
      ${q ? `
      <div class="chips"><a class="chip ${k ? "" : "on"}" href="${chipQ("")}">Vše<span class="n">${toks.length ? searchPeople(q).hits.length : 0}</span></a>
        ${Object.keys(byDept).map((c) => `<a class="chip ${k === c ? "on" : ""}" href="${chipQ(c)}">${esc(deptShort(c))}<span class="n">${byDept[c]}</span></a>`).join("")}</div>
      <h2 id="people-head">Osoby (${hits.length})</h2>
      ${hits.length ? `<div class="cohort"><table class="people" id="search-results"><tbody>${rows}</tbody></table></div>${hits.length > LIMIT ? `<p class="muted small">Zobrazeno prvních ${LIMIT}.</p>` : ""}` : `<div class="empty">Žádná osoba.</div>`}
      <h2>V textu archivovaných stránek</h2>
      <div id="fulltext"><p class="muted">Načítám text verzí…</p></div>
      ` : `<div class="empty">Napiš něco do pole nahoře, třeba příjmení, „KZT 2015“ nebo „magisterské“.</div>`}
    `;
  }
  function fillFulltext(q, k) {
    const box = document.getElementById("fulltext");
    if (!box) return;
    const toks = fold(q).split(/\s+/).filter(Boolean);
    const phoneLike = toks.some((t) => /\d{3,}/.test(t) && !/^(19|20)\d\d(\/\d{2,4})?$/.test(t));
    if (!S.reveal && phoneLike) {
      box.innerHTML = `<div class="empty">Čísla se v textu hledají až po zapnutí „Ukázat kontakty“.</div>`;
      return;
    }
    loadLines().then((L) => {
      if (!document.getElementById("fulltext")) return;
      const uniq = new Map();
      for (const v of S.data.versions) {
        if (k && v.dept !== k) continue;
        const lines = L[v.id] || [];
        for (const l of lines) {
          const text = l[0] === "T" ? l[1] : l[3].filter(Boolean).join(" │ ");
          const f = fold(text);
          if (!toks.every((t) => f.includes(t))) continue;
          const key = v.dept + "|" + text;
          if (!uniq.has(key)) uniq.set(key, { text, dept: v.dept, vs: [] });
          uniq.get(key).vs.push(v);
        }
      }
      const items = [...uniq.values()];
      const LIM = 200;
      box.innerHTML = items.length ? `<p class="muted small">${plural(items.length, "různý řádek", "různé řádky", "různých řádků")}</p>
        <div class="source" id="fulltext-list">${items.slice(0, LIM).map((it) => {
          const a = it.vs[0], b = it.vs[it.vs.length - 1];
          return `<div class="r"><a href="${href("historie", it.dept, a.id)}">${esc(deptShort(it.dept))} ${yr(a.first_seen)}${b !== a ? "–" + yr(b.last_seen) : ""}</a> · ${highlightMasked(it.text, toks)} <span class="muted">(${it.vs.length}×)</span></div>`;
        }).join("")}</div>${items.length > LIM ? `<p class="muted small">Zobrazeno prvních ${LIM}.</p>` : ""}` : `<div class="empty">V textu nic.</div>`;
    }).catch((e) => { box.innerHTML = `<p class="muted">Text verzí se nepodařilo načíst (${esc(e.message)}).</p>`; });
  }
  function highlightMasked(text, toks) {
    if (S.reveal) return highlight(text, toks);
    const masked = maskText(text); // already escaped
    return masked;
  }

  function viewHistory(code, vid, params) {
    const isIndex = code === "index";
    if (!isIndex && !S.dept[code]) return `<h1>Neznámá stránka</h1>`;
    const vs = S.deptVersions[code] || [];
    if (!vs.length) return `<h1>Žádné verze</h1>`;
    const y = params.get("y");
    let cur = vid ? S.ver[vid] : null;
    if (!cur && y) cur = vs.find((v) => yr(v.first_seen) === y);
    if (!cur) cur = vs[vs.length - 1];
    const idx = vs.indexOf(cur);
    const prev = idx > 0 ? vs[idx - 1] : null;
    const curSet = new Set(cur.people), prevSet = new Set(prev ? prev.people : []);
    const added = cur.people.filter((i) => !prevSet.has(i)).map((i) => S.person[i]);
    const removed = prev ? prev.people.filter((i) => !curSet.has(i)).map((i) => S.person[i]) : [];
    const pageName = isIndex ? "Úvodní stránka" : S.dept[code].name;
    let lastYear = "";
    const list = vs.map((v, i) => {
      const pv = i > 0 ? vs[i - 1] : null;
      const ps = new Set(pv ? pv.people : []), cs = new Set(v.people);
      const a = pv ? v.people.filter((x) => !ps.has(x)).length : v.people.length;
      const r = pv ? pv.people.filter((x) => !cs.has(x)).length : 0;
      const yy = yr(v.first_seen);
      const head = yy !== lastYear ? `<div class="vyear">${yy}</div>` : "";
      lastYear = yy;
      return `${head}<a href="${href("historie", code, v.id)}" class="${v === cur ? "on" : ""}" data-vid="${esc(v.id)}">
        <div class="d">${fmtTs(v.first_seen)}${v.last_seen !== v.first_seen ? " až " + fmtTs(v.last_seen) : ""}</div>
        <div class="m">${isIndex ? plural(v.lines, "řádek", "řádky", "řádků") : plural(v.entries || 0, "záznam", "záznamy", "záznamů")} · ${plural(v.captures, "snímek", "snímky", "snímků")}${isIndex ? "" : ` · <span class="plus">+${a}</span> <span class="minus">−${r}</span>`}</div>
      </a>`;
    }).join("");
    const li = (p, cls) => `<li class="${cls}"><a href="${href("osoba", p.id)}">${esc(p.name)}</a> <span class="muted small">${esc(p.cohort || "")}</span></li>`;
    const sortP = (a) => a.sort((x, y) => (y.cohort_start || 0) - (x.cohort_start || 0) || coll.compare(x.name, y.name));
    return `
      <div class="chips">${S.data.departments.map((d) => `<a class="chip ${d.code === code ? "on" : ""}" href="${href("historie", d.code)}">${esc(d.short)}</a>`).join("")}
        <a class="chip ${isIndex ? "on" : ""}" href="${href("historie", "index")}">Úvod</a></div>
      <h1>Historie · ${esc(pageName)}</h1>
      <p class="muted">${plural(vs.length, "verze", "verze", "verzí")} od ${fmtTs(vs[0].first_seen)} do ${fmtTs(vs[vs.length - 1].last_seen)}.${isIndex ? "" : ` <a href="${href("katedra", code)}">Katedra</a>`}</p>
      <div class="hist">
        <nav class="vlist" id="vlist" aria-label="Verze">${list}</nav>
        <div>
          <div class="diffbox" id="version-detail">
            <h3>Verze ${fmtTs(cur.first_seen)}${cur.last_seen !== cur.first_seen ? " až " + fmtTs(cur.last_seen) : ""}</h3>
            <p class="small muted">${esc(cur.page)} · ${esc(cur.title)} · ${plural(cur.captures, "snímek", "snímky", "snímků")} · ${plural(cur.tables, "tabulka", "tabulky", "tabulek")} · kódování ${esc(cur.encoding || "?")}
            ${cur.column_rejoined ? ` · ${cur.column_rejoined} řádků složeno ze sloupců` : ""}</p>
            <p>${wayback(cur, "Otevřít tuto verzi ve Wayback Machine")}
              ${prev ? ` · <a href="${href("historie", code, prev.id)}">← předchozí</a>` : ""}
              ${idx < vs.length - 1 ? ` · <a href="${href("historie", code, vs[idx + 1].id)}">další →</a>` : ""}</p>
            ${isIndex ? "" : `
            <div class="diffcols">
              <div><h3 class="plus">${prev ? "Přibylo" : "V první verzi"} (${added.length})</h3><ul id="added">${sortP(added).map((p) => li(p, "a")).join("") || `<li class="muted">nic</li>`}</ul></div>
              <div><h3 class="minus">Zmizelo (${removed.length})</h3><ul id="removed">${sortP(removed).map((p) => li(p, "r")).join("") || `<li class="muted">nic</li>`}</ul></div>
            </div>`}
          </div>
          <h3>Text verze</h3>
          <div class="source" id="source"><div class="t">Načítám…</div></div>
        </div>
      </div>`;
  }
  const HEAD_RE = /(^\s*(\d\s*\.\s*)?ro[cč]n[ií]k)|(^\s*[A-Z]{0,6}\s*(19|20)\d\d\s*\/\s*\d{2,4}\s*$)|(^\s*\d(st|nd|rd|th)\s+year)|(^\s*(19|20)\d\d\s+year)/i;
  function fillSource(vid) {
    const box = document.getElementById("source");
    if (!box) return;
    loadLines().then((L) => {
      const lines = L[vid] || [];
      let lastT = -1;
      box.innerHTML = lines.map((l) => {
        if (l[0] === "T") {
          lastT = -1;
          return `<div class="${HEAD_RE.test(l[1]) ? "h" : "t"}">${maskText(l[1])}</div>`;
        }
        const first = l[3].find(Boolean) || "";
        const cls = (HEAD_RE.test(first) ? "h" : "r") + (l[1] !== lastT ? " tb" : "");
        lastT = l[1];
        return `<div class="${cls}">${l[3].map((c) => `<span>${maskText(c)}</span>`).join("")}</div>`;
      }).join("") || `<div class="t">Prázdná verze.</div>`;
    }).catch((e) => { box.innerHTML = `<div class="t">Nepodařilo se načíst (${esc(e.message)}).</div>`; });
  }

  function viewStats() {
    const d = S.data;
    // people per cohort year (all departments)
    const byC = {};
    d.people.forEach((p) => { if (p.cohort_start) byC[p.cohort_start] = (byC[p.cohort_start] || 0) + 1; });
    const cs = Object.keys(byC).map(Number).sort((a, b) => a - b);
    // versions per calendar year
    const byY = {};
    d.versions.forEach((v) => { const y = +yr(v.first_seen); byY[y] = (byY[y] || 0) + 1; });
    const ys = Object.keys(byY).map(Number).sort((a, b) => a - b);
    const tbl = d.departments.map((x) => {
      const ps = S.person.filter((p) => p.dept === x.code);
      const withPhone = ps.filter((p) => p.phones.length).length;
      const withMail = ps.filter((p) => p.emails.length).length;
      return `<tr><td><a href="${href("katedra", x.code)}">${esc(x.short)}</a></td><td>${esc(x.name)}</td><td class="mono">${x.people}</td><td class="mono">${withPhone}</td><td class="mono">${withMail}</td><td class="mono">${x.versions.length}</td><td class="mono">${x.raw}</td><td class="mono">${yr(x.first_seen)}–${yr(x.last_seen)}</td></tr>`;
    }).join("");
    return `
      <h1>Statistiky</h1>
      <p class="lede">Historie bez jmen: jen počty. Tahle stránka se dá ukázat i bez souhlasu dotčených, žádné osobní údaje na ní nejsou.</p>
      <h2>Osoby podle roku nástupu</h2>
      <div class="chart" id="chart-cohorts">${barChart(cs.map((c) => [c, byC[c]]), (c) => "’" + String(c).slice(2))}</div>
      <h2>Počet záznamů na stránce v čase</h2>
      <p class="muted small">Kolik osob bylo na stránce katedry v každé archivované verzi. Stránky rostly, protože staré ročníky zůstávaly.</p>
      <div class="smalls">${d.departments.map((x) => `<div class="chart"><h3>${esc(x.short)} <span class="muted small">${esc(x.name)}</span></h3>${lineChart(S.deptVersions[x.code])}</div>`).join("")}</div>
      <h2>Archivované verze podle roku</h2>
      <div class="chart">${barChart(ys.map((y) => [y, byY[y]]), (y) => "’" + String(y).slice(2), true)}</div>
      <h2>Souhrn</h2>
      <div class="scroll-x"><table class="people" id="stats-table"><thead><tr><td><b>Kód</b></td><td><b>Katedra</b></td><td><b>Osob</b></td><td><b>S telefonem</b></td><td><b>S e-mailem</b></td><td><b>Verzí</b></td><td><b>Neroztříděno</b></td><td><b>Snímky</b></td></tr></thead><tbody>${tbl}</tbody></table></div>
    `;
  }
  function barChart(pairs, lab, alt) {
    if (!pairs.length) return "";
    const W = 900, H = 220, pad = 28, bw = (W - pad * 2) / pairs.length;
    const max = Math.max(...pairs.map((p) => p[1]));
    const bars = pairs.map(([k, v], i) => {
      const h = ((H - pad * 2) * v) / max;
      const x = pad + i * bw + 2, y = H - pad - h;
      return `<rect class="${alt ? "bar2" : "bar"}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(2, bw - 4).toFixed(1)}" height="${h.toFixed(1)}" rx="2"><title>${k}: ${v}</title></rect>
        <text x="${(x + (bw - 4) / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle">${v}</text>
        <text x="${(x + (bw - 4) / 2).toFixed(1)}" y="${H - pad + 14}" text-anchor="middle">${esc(lab(k))}</text>`;
    }).join("");
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="sloupcový graf"><line class="axis" x1="${pad}" x2="${W - pad}" y1="${H - pad}" y2="${H - pad}"/>${bars}</svg>`;
  }
  function lineChart(vs) {
    if (!vs || !vs.length) return "";
    const W = 280, H = 90, px = 6, py = 10;
    const t0 = Date.UTC(2008, 0, 1), t1 = Date.UTC(2026, 0, 1);
    const tt = (ts) => Date.UTC(+ts.slice(0, 4), +ts.slice(4, 6) - 1, +ts.slice(6, 8));
    const max = Math.max(1, ...vs.map((v) => v.entries || 0));
    const pts = vs.map((v) => [px + ((tt(v.first_seen) - t0) / (t1 - t0)) * (W - 2 * px), H - py - ((v.entries || 0) / max) * (H - 2 * py), v]);
    const path = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
    const area = path + ` L${pts[pts.length - 1][0].toFixed(1)},${H - py} L${pts[0][0].toFixed(1)},${H - py} Z`;
    const ticks = [2008, 2012, 2016, 2020, 2024].map((y) => {
      const x = px + ((Date.UTC(y, 0, 1) - t0) / (t1 - t0)) * (W - 2 * px);
      return `<line class="axis" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${py}" y2="${H - py}"/><text x="${x.toFixed(1)}" y="${H}" text-anchor="middle">${y}</text>`;
    }).join("");
    return `<svg viewBox="0 0 ${W} ${H + 4}" role="img" aria-label="počet záznamů v čase">${ticks}<path class="area" d="${area}"/><path class="line" d="${path}"/>${pts.map((p) => `<circle class="pt" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2"><title>${fmtTs(p[2].first_seen)}: ${p[2].entries || 0}</title></circle>`).join("")}<text x="${W - px}" y="${py}" text-anchor="end">max ${max}</text></svg>`;
  }

  // ------------------------------------------------------------ router
  function route() {
    const raw = location.hash.replace(/^#\/?/, "");
    const [path, qs] = raw.split("?");
    const parts = path.split("/").filter(Boolean).map(decodeURIComponent);
    const params = new URLSearchParams(qs || "");
    const name = parts[0] || "prehled";
    let html = "", after = null, navKey = name;
    switch (name) {
      case "katedra":
        html = viewDept(parts[1] || "kp", params);
        after = bindDept;
        break;
      case "osoba":
        html = viewPerson(parts[1]); navKey = "katedra";
        break;
      case "hledat": {
        const q = params.get("q") || "";
        html = viewSearch(params);
        if (document.activeElement !== qInput) qInput.value = q;
        after = () => q && fillFulltext(q, params.get("k") || "");
        break;
      }
      case "historie": {
        const code = parts[1] || "kp";
        html = viewHistory(code, parts[2], params);
        after = () => {
          const cur = document.querySelector("#vlist a.on");
          if (cur) { fillSource(cur.dataset.vid); cur.scrollIntoView({ block: "nearest" }); }
        };
        break;
      }
      case "statistiky":
        html = viewStats();
        break;
      default:
        html = viewOverview(); navKey = "prehled";
    }
    app.innerHTML = html;
    document.querySelectorAll("#nav a").forEach((a) => a.classList.toggle("on", a.dataset.nav === navKey));
    if (after) after();
    if (!S.keepScroll) window.scrollTo(0, 0);
    S.keepScroll = false;
  }
  function bindDept() {
    const f = document.getElementById("dept-filter");
    const c = document.getElementById("only-contact");
    const update = (refocus) => {
      const [path, qs] = location.hash.replace(/^#\/?/, "").split("?");
      const p = new URLSearchParams(qs || "");
      f.value ? p.set("f", f.value) : p.delete("f");
      c.checked ? p.set("c", "1") : p.delete("c");
      const s = p.toString();
      S.keepScroll = true;
      history.replaceState(null, "", "#/" + path + (s ? "?" + s : ""));
      route();
      if (refocus) {
        const nf = document.getElementById("dept-filter");
        nf.focus();
        nf.setSelectionRange(nf.value.length, nf.value.length);
      }
    };
    let tm = null;
    f.addEventListener("input", () => { clearTimeout(tm); tm = setTimeout(() => update(true), 150); });
    c.addEventListener("change", () => update(false));
  }

  const qInput = document.getElementById("q");
  let qTimer = null;
  qInput.addEventListener("input", () => {
    clearTimeout(qTimer);
    qTimer = setTimeout(() => {
      const url = "#/hledat?q=" + encodeURIComponent(qInput.value);
      if (location.hash.startsWith("#/hledat")) { history.replaceState(null, "", url); route(); }
      else location.hash = url;
    }, 180);
  });
  document.getElementById("search-form").addEventListener("submit", (e) => {
    e.preventDefault();
    location.hash = "#/hledat?q=" + encodeURIComponent(qInput.value);
  });
  const reveal = document.getElementById("reveal");
  reveal.checked = false;
  reveal.addEventListener("change", () => { S.reveal = reveal.checked; S.keepScroll = true; route(); });
  window.addEventListener("hashchange", route);

  // ------------------------------------------------------------ boot
  fetch("data/famaci.json").then((r) => {
    if (!r.ok) throw new Error("famaci.json " + r.status);
    return r.json();
  }).then((d) => {
    S.data = d;
    if (d.demo) {
      const pv = document.getElementById("privacy");
      if (pv) { pv.textContent = "DEMO · všechna jména, telefony a e-maily jsou smyšlené. Skutečná data z archivu zůstávají jen lokálně."; pv.classList.add("demo"); }
    }
    d.departments.forEach((x) => (S.dept[x.code] = x));
    d.versions.forEach((v) => (S.ver[v.id] = v));
    S.person = d.people;
    d.versions.forEach((v) => (S.deptVersions[v.dept] = S.deptVersions[v.dept] || []).push(v));
    Object.values(S.deptVersions).forEach((a) => a.sort((x, y) => x.first_seen.localeCompare(y.first_seen)));
    S.index = d.people.map((p) => {
      const x = S.dept[p.dept];
      return fold([p.name, ...p.name_variants, x.short, x.name, p.cohort, p.cohort ? "rocnik " + p.cohort : "", p.cohort_start, p.level, p.track, ...p.notes].join(" "));
    });
    window.__famaci = { people: d.people.length, departments: d.departments.length, versions: d.versions.length };
    route();
  }).catch((e) => {
    app.innerHTML = `<h1>Data se nenačetla</h1><p>${esc(e.message)}</p><p class="muted">Spusť nejdřív <code>python3 -I app/build_data.py</code> a otevři appku přes lokální server (ne přes file://).</p>`;
  });
})();
