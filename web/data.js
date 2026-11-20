/* Famáci 2.0 · prototyp. Smyšlená data, generovaná při načtení.
   Žádná skutečná jména ani čísla: jména se skládají náhodně ze seznamů,
   telefony začínají na 000 (demo rozsah, hlídá tools/check_public.py). */
(function () {
  "use strict";

  /* Studijní obory. Vychází ze sekcí původních Famáků (archiv: 10 českých + CINKK a tři programy
     FAMU International), doplněné o obory, které archiv nezná: Herní design (KHD, nová katedra)
     a Montage (magisterský program FAMU International). Zkratky jako v archivu a na famu.cz.
     `code` se v datech jmenuje dept kvůli kompatibilitě, ve všech textech je to „studijní obor“. */
  const DEPTS = [
    { code: "app", abbr: "APP", name: "Academy Preparation Program", intl: true },
    { code: "kat", abbr: "KAT", name: "Animovaná tvorba" },
    { code: "cas", abbr: "CAS", name: "Audiovizuální studia" },
    { code: "cdm", abbr: "CDM", name: "Cinema and Digital Media", intl: true },
    { code: "cinkk", abbr: "CINKK", name: "Cinematography (master in English)", intl: true },
    { code: "kdt", abbr: "KDT", name: "Dokumentární tvorba" },
    { code: "kf", abbr: "KF", name: "Fotografie" },
    { code: "khd", abbr: "KHD", name: "Herní design" },
    { code: "kk", abbr: "KK", name: "Kamera" },
    { code: "montage", abbr: "MONTAGE", name: "Montage (master in English)", intl: true },
    { code: "pts", abbr: "PTS", name: "Production Team Studies", intl: true },
    { code: "kp", abbr: "KP", name: "Produkce" },
    { code: "kr", abbr: "KR", name: "Režie" },
    { code: "ksd", abbr: "KSD", name: "Scenáristika a dramaturgie" },
    { code: "kss", abbr: "KSS", name: "Střihová skladba" },
    { code: "kzt", abbr: "KZT", name: "Zvuková tvorba" },
  ];
  DEPTS.sort((a, b) => a.name.localeCompare(b.name, "cs"));
  for (const d of DEPTS) d.full = d.name;
  const WEIGHT = { app: 6, kat: 7, cas: 5, cdm: 2, cinkk: 2, kdt: 7, kf: 8, khd: 4, kk: 8, montage: 2, pts: 4, kp: 12, kr: 9, ksd: 6, kss: 6, kzt: 6 };

  const FIRST_F = ["Adéla", "Alžběta", "Anna", "Barbora", "Bára", "Dominika", "Ela", "Eliška", "Ema", "Hana", "Johana", "Josefína", "Kamila", "Karolína", "Klára", "Kristýna", "Lucie", "Magdaléna", "Marie", "Markéta", "Natálie", "Nela", "Pavla", "Petra", "Rozálie", "Sabina", "Sára", "Simona", "Tereza", "Veronika", "Viktorie", "Zuzana"];
  const FIRST_M = ["Adam", "Albert", "Antonín", "Daniel", "David", "Dominik", "Filip", "František", "Jakub", "Jan", "Jindřich", "Jonáš", "Josef", "Kryštof", "Lukáš", "Marek", "Martin", "Matěj", "Matyáš", "Michal", "Ondřej", "Patrik", "Petr", "Radek", "Šimon", "Štěpán", "Tadeáš", "Tobiáš", "Tomáš", "Vojtěch", "Vít", "Václav"];
  // [mužský tvar, ženský tvar]
  const LAST = [["Bartoš", "Bartošová"], ["Beneš", "Benešová"], ["Blažek", "Blažková"], ["Brabec", "Brabcová"], ["Čermák", "Čermáková"], ["Doležal", "Doležalová"], ["Dvořák", "Dvořáková"], ["Fiala", "Fialová"], ["Havel", "Havlová"], ["Holub", "Holubová"], ["Horák", "Horáková"], ["Hruška", "Hrušková"], ["Jelínek", "Jelínková"], ["Kadlec", "Kadlecová"], ["Kolář", "Kolářová"], ["Kopecký", "Kopecká"], ["Kratochvíl", "Kratochvílová"], ["Krejčí", "Krejčí"], ["Kučera", "Kučerová"], ["Lukeš", "Lukešová"], ["Malý", "Malá"], ["Marek", "Marková"], ["Mareš", "Marešová"], ["Navrátil", "Navrátilová"], ["Novotný", "Novotná"], ["Pokorný", "Pokorná"], ["Polák", "Poláková"], ["Procházka", "Procházková"], ["Říha", "Říhová"], ["Růžička", "Růžičková"], ["Sedláček", "Sedláčková"], ["Skála", "Skálová"], ["Soukup", "Soukupová"], ["Staněk", "Staňková"], ["Svoboda", "Svobodová"], ["Šimek", "Šimková"], ["Tichý", "Tichá"], ["Urban", "Urbanová"], ["Vacek", "Vacková"], ["Valenta", "Valentová"], ["Vaněk", "Vaňková"], ["Veselý", "Veselá"], ["Vlček", "Vlčková"], ["Zeman", "Zemanová"], ["Žák", "Žáková"]];

  // deterministický generátor, ať je prototyp při každém načtení stejný
  let seed = 20261120;
  function rnd() {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  function weighted(obj) {
    const total = Object.values(obj).reduce((a, b) => a + b, 0);
    let r = rnd() * total;
    for (const [k, w] of Object.entries(obj)) { if ((r -= w) < 0) return k; }
    return Object.keys(obj)[0];
  }
  const ascii = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

  // ročníky nástupu od založení FAMU (27. 10. 1946) po aktuální 2026/2027, nejnovější první
  const FIRST_YEAR = 1946, LAST_YEAR = 2026;
  const COHORTS = [];
  for (let y = LAST_YEAR; y >= FIRST_YEAR; y--) COHORTS.push(y + "/" + (y + 1));
  const GEN_YEARS = 13;   // smyšlení lidé jen v posledních 13 ročnících

  const students = [];
  const used = new Set();
  let id = 100;
  while (students.length < 340) {
    const female = rnd() < 0.5;
    const first = pick(female ? FIRST_F : FIRST_M);
    const lastPair = pick(LAST);
    const last = female ? lastPair[1] : lastPair[0];
    const name = first + " " + last;
    if (used.has(name)) continue;
    used.add(name);
    // novější ročníky jsou početnější (víc lidí si profil vyplní)
    const yIdx = Math.min(GEN_YEARS - 1, Math.floor(Math.pow(rnd(), 1.6) * GEN_YEARS));
    const g = rnd();
    const gender = g < 0.16 ? "" : g < 0.19 ? "jine" : female ? "zena" : "muz";
    const hasPhone = rnd() < 0.82;
    const n = () => String(Math.floor(rnd() * 1000)).padStart(3, "0");
    const dept = weighted(WEIGHT);
    // část studentů anglických programů má zahraniční číslo
    const intl = ["app", "cdm", "cinkk", "montage", "pts"].includes(dept);
    const cc = intl && rnd() < 0.6 ? pick(["49", "44", "1", "33", "39", "48", "421"]) : "420";
    students.push({
      id: String(id++),
      first, last, name,
      dept,
      cohort: COHORTS[yIdx],
      gender,
      email: ascii(first) + "." + ascii(last) + "@" + (rnd() < 0.6 ? "st.amu" : "famu") + ".cz",
      phone: hasPhone ? "+" + cc + " 000 " + n() + " " + n() : "",
      confirmed: LAST_YEAR - Math.floor(rnd() * 3),
    });
  }

  /* Účty. Každý profil patří k účtu, k tomu účty bez profilu (pedagogové, kdo jen prohlíží).
     role: "user" (výchozí) nebo "admin". Data jsou smyšlená jako všechno ostatní. */
  const DAY = 864e5, NOW = Date.UTC(2026, 10, 20);
  const iso = (t) => new Date(t).toISOString().slice(0, 10);
  function stamps() {
    const created = NOW - (1 + Math.floor(rnd() * 80)) * DAY;
    return { created: iso(created), lastLogin: iso(Math.min(NOW, created + Math.floor(rnd() * 80) * DAY)) };
  }
  const accounts = students.map((s) => {
    const t = stamps();
    return {
      id: s.id, email: s.email, role: "user", ...t, blocked: false, hidden: false, hiddenBy: null,
      profile: s,
      consents: { profile: t.created, phone: s.phone ? t.created : null, gender: s.gender ? t.created : null, version: "1.0" },
    };
  });
  const usedMail = new Set(accounts.map((a) => a.email));
  let aid = 900;
  while (accounts.length < 340 + 34) {
    const f = rnd() < 0.5 ? pick(FIRST_F) : pick(FIRST_M);
    const female = FIRST_F.includes(f);
    const l = pick(LAST)[female ? 1 : 0];
    const email = ascii(f) + "." + ascii(l) + "@famu.cz";
    if (usedMail.has(email)) continue;
    usedMail.add(email);
    accounts.push({ id: "a" + aid++, email, role: "user", ...stamps(), blocked: false, hidden: false, hiddenBy: null, profile: null, consents: { version: "1.0" } });
  }
  // ukázkové stavy pro administraci
  accounts.push({ id: "a800", email: "spravce.famaci@famu.cz", role: "admin", created: "2026-09-01", lastLogin: "2026-11-19", blocked: false, hidden: false, hiddenBy: null, profile: null, consents: { version: "1.0" } });
  accounts[2].role = "admin";
  accounts[7].hidden = true; accounts[7].hiddenBy = "user";
  accounts[15].hidden = true; accounts[15].hiddenBy = "user";
  accounts[350].blocked = true; accounts[350].blockedReason = "Rozesílal hromadné zprávy s nabídkou služeb.";

  /* Nahlášení zneužití (smyšlená). from = e-mail pro odpověď, targetId = účet, kterého se týká (nebo null). */
  const reports = [
    { id: "r1", t: "2026-11-19T09:12:00Z", from: accounts[30].email, targetId: accounts[44].id, targetText: "",
      text: "Přišla mi od tohoto člověka hromadná SMS s nabídkou placeného focení. Psal stejně i spolužákům z ročníku.", status: "new" },
    { id: "r2", t: "2026-11-17T17:40:00Z", from: "soused@example.cz", targetId: null, targetText: "neznámé číslo",
      text: "Volá mi někdo, kdo tvrdí, že má moje číslo z Famáků. Na FAMU nestuduju a nikdy jsem nestudoval.", status: "new" },
    { id: "r3", t: "2026-11-03T08:05:00Z", from: accounts[12].email, targetId: accounts[350].id, targetText: "",
      text: "Tenhle účet rozesílá všem z adresáře nabídky služeb.", status: "done",
      reply: "Díky za upozornění. Účet jsme zablokovali.", repliedAt: "2026-11-03T10:30:00Z", repliedBy: "spravce.famaci@famu.cz" },
  ];

  window.FamaciData = { DEPTS, COHORTS, students, accounts, reports, ascii };
})();
