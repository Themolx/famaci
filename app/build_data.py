#!/usr/bin/env python3
"""Famáci 2.0 · build step.

Reads the scraped Wayback archive in ../data/extracted (read-only) and writes:
  app/data/famaci.json    departments, cohorts, person entries with version history, unparsed rows
  app/data/versions.json  every archived version as linear lines (for the history view)
  app/data/stats.txt      counts only, no names or numbers

Stdlib only. Run:  python3 -I app/build_data.py
"""
import json
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "data", "extracted")
OUT = os.path.join(HERE, "data")

# ---------------------------------------------------------------- departments

DEPTS = [
    # code, short, name, kind
    ("kp", "KP", "Katedra produkce", "cz"),
    ("kat", "KAT", "Katedra animované tvorby", "cz"),
    ("kdt", "KDT", "Katedra dokumentární tvorby", "cz"),
    ("kf", "KF", "Katedra fotografie", "cz"),
    ("kk", "KK", "Katedra kamery", "cz"),
    ("kr", "KR", "Katedra režie", "cz"),
    ("ksd", "KSD", "Katedra scenáristiky a dramaturgie", "cz"),
    ("kss", "KSS", "Katedra střihové skladby", "cz"),
    ("kzt", "KZT", "Katedra zvukové tvorby", "cz"),
    ("cas", "CAS", "Centrum audiovizuálních studií", "cz"),
    ("cinkk", "CINKK", "Cinematography master in English", "intl"),
    ("app", "APP", "FAMU International · Academy Preparation Program", "intl"),
    ("cdm", "CDM", "FAMU International · Cinema and Digital Media Program", "intl"),
    ("pts", "PTS", "FAMU International · Production Team Studies", "intl"),
]


def dept_of(page):
    if page == "index":
        return None
    leaf = page.split("/")[-1].replace(".html", "")
    if leaf.startswith("famu-international-academy"):
        return "app"
    if leaf.startswith("famu-international-cinema"):
        return "cdm"
    if leaf.startswith("famu-international-production"):
        return "pts"
    return leaf


# ---------------------------------------------------------------- text helpers

def clean(s):
    s = (s or "").replace("\xa0", " ")
    s = re.sub("[​-‏‪-‮⁠﻿]", "", s)
    s = s.replace("\u2013", "-").replace("\u2014", "-")
    return re.sub(r"\s+", " ", s).strip()


def fold(s):
    s = unicodedata.normalize("NFKD", s.lower())
    return "".join(c for c in s if not unicodedata.combining(c))


CHROME = {
    "reklama", "uvod", "menu", ">>", "oblibene odkazy", "famu", "vyhledavani", "estranky.cz",
    "produkce", "animovana tvorba", "dokumentarni tvorba", "fotografie", "kamera", "rezie",
    "scenaristika a dramaturgie", "stizhova skladba", "strihova skladba", "zvukova tvorba",
    "audiovizualni studia", "centrum audiovizualnich studii", "cinematography master in english (cinkk)",
    "famu international academy preparation program", "famu international cinema and digital media program",
    "famu international production team studies", "cas - audiovizualni studia",
}
CHROME_RE = re.compile(
    r"(estranky|vytvoreno sluzbou|predmetem tohoto webu|v pripade oprav|studjni materialy|studijni materialy"
    r"|opravy a upravy|^katedra [a-z ]+\.?$|^©)",
)
HEADER_WORDS = {"jmeno", "prijmeni", "telefon", "tel", "tel.", "kontakt", "e-mail", "email", "mail",
                "name", "surname", "phone", "mobil", "first name", "last name", "jmeno a prijmeni"}
LEVEL_RE = re.compile(r"^(bakalarsk\w*|magistersk\w*|navazujici\w*.*|doktorsk\w*|doktorand\w*|bca\.?|mga\.?|ph\.?d\.?)$")
TRACK_WORDS = {"camera", "directing", "documentary", "production", "screenwriting", "editing", "sound",
               "animation", "cinematography", "photography", "acting", "fiction", "dramaturgy"}

PHONE_CAND = re.compile(r"(?:\+\s?|00)?\d[\d \-./]*\d")
EMAIL_RE = re.compile(r"[\w.+\-]+@[\w\-]+(?:\.[\w\-]+)+")
URL_RE = re.compile(r"(?:https?://|www\.)\S+", re.I)
LABEL_RE = re.compile(r"\b(tel|mob|mobil|telefon|e-?mail|phone)\b\.?\s*:?", re.I)
NAME_TOKEN = re.compile(r"^[^\W\d_][\w'’.\-]*$")


def split_phones(text):
    """Return (phones, residue)."""
    phones = []

    def take(m):
        raw = m.group(0)
        digits = re.sub(r"\D", "", raw)
        intl = raw.strip().startswith("+") or digits.startswith("00")
        if len(digits) < 9:
            return raw
        if intl and digits.startswith("00"):
            digits = digits[2:]
        chunk = 12 if intl else 9
        if len(digits) % chunk == 0 and len(digits) > chunk:
            for i in range(0, len(digits), chunk):
                phones.append(fmt_phone(digits[i:i + chunk], intl))
        else:
            phones.append(fmt_phone(digits, intl))
        return " "

    residue = PHONE_CAND.sub(take, text)
    return phones, residue


def fmt_phone(d, intl):
    if intl:
        if d.startswith("00"):
            d = d[2:]
        cc, rest = (d[:3], d[3:]) if len(d) >= 12 else (d[:-9], d[-9:])
        body = " ".join(rest[i:i + 3] for i in range(0, len(rest), 3))
        return ("+" + cc + " " + body).strip()
    return " ".join(d[i:i + 3] for i in range(0, len(d), 3))


def extract(text):
    """Pull contacts out of a string. Returns dict(name, note, phones, emails, urls)."""
    t = clean(text)
    urls = URL_RE.findall(t)
    t = URL_RE.sub(" ", t)
    emails = [e.rstrip(".") for e in EMAIL_RE.findall(t)]
    t = EMAIL_RE.sub(" ", t)
    phones, t = split_phones(t)
    t = LABEL_RE.sub(" ", t)
    note = ""
    stray = re.findall(r"(?<!\w)[\d,+]+(?!\w)", t)
    if stray:
        t = re.sub(r"(?<!\w)[\d,+]+(?!\w)", " ", t)
        note = " ".join(x for x in stray if re.search(r"\d", x))
    m = re.search(r"\((.*?)\)", t)
    if m:
        note = m.group(1)
        t = t[:m.start()] + " " + t[m.end():]
    if " - " in t:
        head, _, tail = t.partition(" - ")
        if head.strip() and tail.strip():
            t, note = head, (note + " " + tail).strip()
    t = clean(re.sub(r"[,;:|/]+", " ", t)).strip(" -.+")
    return {"name": t, "note": clean(note).strip(" -"), "phones": phones, "emails": emails, "urls": urls}


def valid_name(s):
    toks = s.split()
    if not 1 <= len(toks) <= 6 or len(s) > 70:
        return False
    if not all(NAME_TOKEN.match(x) for x in toks):
        return False
    if not toks[0][0].isupper():
        return False
    if fold(s) in CHROME or fold(s) in HEADER_WORDS:
        return False
    return True


def name_key(s):
    toks = re.findall(r"[a-z0-9]+", fold(s))
    return " ".join(sorted(toks))


def pretty_name(s):
    """SURNAME Given -> Surname Given (international pages use caps surnames)."""
    out = []
    for t in s.split():
        if len(t) > 2 and t.isupper():
            t = "-".join(p.capitalize() for p in t.split("-"))
        out.append(t)
    return " ".join(out)


# ---------------------------------------------------------------- cohort headings

def ay_label(start):
    return "%d/%02d" % (start, (start + 1) % 100)


def year4(a):
    a = int(a)
    if a < 100:
        a += 2000 if a < 60 else 1900
    return a


def academic_year(ts):
    y, m = int(ts[:4]), int(ts[4:6])
    return y if m >= 9 else y - 1


HEAD_PATTERNS = [
    re.compile(r"^(?:(?P<n>\d)\s*\.\s*|(?:první|druhý|třetí|čtvrtý|pátý|šestý)\s+)?ro[cč]n[ií]k\s*(?P<a>\d{1,4})\s*/\s*(?P<b>\d{1,4})(?P<rest>.*)$", re.I),
    re.compile(r"^(?P<n>\d)\s*\.\s*ro[cč]n[ií]k\b(?P<rest>.*)$", re.I),
    re.compile(r"^(?P<prog>[A-Za-z]{2,6})?\s*(?P<a>(?:19|20)\d{2})\s*/\s*(?P<b>\d{2,4})(?P<rest>.*)$"),
    re.compile(r"^(?P<n>\d)(?:st|nd|rd|th)\s+year\b(?P<rest>.*)$", re.I),
    re.compile(r"^(?P<a>(?:19|20)\d{2})\s+year\b(?P<rest>.*)$", re.I),
]


def parse_heading(text, ts):
    t = clean(text)
    if not t:
        return None
    pre = ""
    m0 = re.search(r"(?:\d\s*\.\s*)?ro[cč]n[ií]k", t, re.I)
    if m0 and m0.start() > 0:
        prefix = fold(t[:m0.start()])
        if prefix.startswith("katedra") or "studia" in prefix or prefix.startswith("cas"):
            pre, t = t[:m0.start()], t[m0.start():]
    for pat in HEAD_PATTERNS:
        m = pat.match(t)
        if not m:
            continue
        g = m.groupdict()
        rest = clean(g.get("rest") or "")
        if g.get("a"):
            start, inferred = year4(g["a"]), False
        else:
            start, inferred = academic_year(ts) - (int(g["n"]) - 1), True
        if not 1990 <= start <= 2030:
            return None
        track = ""
        if pat.pattern.find("year") >= 0 and rest:
            track, rest = clean(rest.strip(" -")), ""
        if g.get("prog"):
            track = g["prog"].upper()
        # A heading line must be short unless it carries merged data (2011 Word pastes).
        if rest and not re.search(r"\d{3}", rest) and len(rest.split()) < 2:
            rest = ""
        return {"start": start, "label": ay_label(start), "inferred": inferred, "track": track,
                "rest": rest, "pre": pre, "year_of_study": int(g["n"]) if g.get("n") else None}
    return None


# ---------------------------------------------------------------- parsing one version

def linearize(blocks):
    """Blocks -> list of lines: ('T', text) or ('R', table_index, row_index, cells)."""
    lines = []
    ti = 0
    for b in blocks:
        if b.get("type") == "table":
            for ri, row in enumerate(b.get("rows") or []):
                cells = [clean(c) for c in row]
                if any(cells):
                    lines.append(("R", ti, ri, cells))
            ti += 1
        else:
            t = clean(b.get("text", ""))
            if not t:
                continue
            # an e-mail split over lines: "user" + "@" + "host"
            if lines and lines[-1][0] == "T" and (t.startswith("@") or lines[-1][1].endswith("@")):
                lines[-1] = ("T", lines[-1][1] + t)
                continue
            lines.append(("T", t))
    return lines


def rejoin_columns(lines):
    """A table pasted as text column by column: k surnames, k first names, k phones.
    Returns (lines, count) with such runs zipped back into one line per person."""
    def word(l):
        return l[0] == "T" and " " not in l[1] and not re.search(r"\d", l[1]) and valid_name(l[1])

    def phone(l):
        if l[0] != "T":
            return False
        x = extract(l[1])
        return bool(x["phones"]) and not x["name"]

    out, i, fixed = [], 0, 0
    while i < len(lines):
        j = i
        while j < len(lines) and word(lines[j]):
            j += 1
        n = j - i
        k = 0
        while j + k < len(lines) and phone(lines[j + k]):
            k += 1
        if n >= 4 and k >= 2 and n in (k, 2 * k):
            a = [l[1] for l in lines[i:i + n]]
            c = [l[1] for l in lines[j:j + k]]
            for x in range(k):
                nm = a[x] + (" " + a[k + x] if n == 2 * k else "")
                out.append(("T", nm + " " + c[x]))
            fixed += k
            i = j + k
            continue
        if n >= 4 and k >= 3:
            # column paste whose columns do not line up: keep it as one raw block
            out.append(("X", [l[1] for l in lines[i:j + k]]))
            i = j + k
            continue
        if n:
            out.extend(lines[i:j])
            i = j
        else:
            out.append(lines[i])
            i += 1
    return out, fixed


class Parser:
    def __init__(self, dept, vid, ts):
        self.dept, self.vid, self.ts = dept, vid, ts
        self.cohort = None
        self.level = ""
        self.track = ""
        self.entries = []
        self.raw = []
        self.open = None
        self.stats = Counter()

    # -- state
    def set_cohort(self, h):
        self.close()
        self.cohort = h
        self.level = ""
        self.track = h["track"] or ""

    def ctx(self):
        c = self.cohort
        return {
            "cohort": c["label"] if c else None,
            "cohort_start": c["start"] if c else None,
            "cohort_inferred": bool(c and c["inferred"]),
            "year_of_study": c["year_of_study"] if c and c["inferred"] else None,
            "level": self.level,
            "track": self.track,
        }

    def new_entry(self, name, info, src, single=False):
        self.close()
        e = {"name": name, "phones": list(info["phones"]), "emails": list(info["emails"]),
             "urls": list(info["urls"]), "notes": [info["note"]] if info["note"] else [],
             "src": src, "parts": 1 if single else 2}
        e.update(self.ctx())
        self.open = e

    def attach(self, info):
        e = self.open
        e["phones"] += [p for p in info["phones"] if p not in e["phones"]]
        e["emails"] += [x for x in info["emails"] if x not in e["emails"]]
        e["urls"] += [x for x in info["urls"] if x not in e["urls"]]
        if info["note"]:
            e["notes"].append(info["note"])

    def has_contact(self, e):
        return bool(e["phones"] or e["emails"] or e["urls"])

    def close(self):
        if self.open:
            e = self.open
            e.pop("parts", None)
            e["name"] = pretty_name(clean(e["name"]))
            if valid_name(e["name"]):
                self.entries.append(e)
                self.stats["entries"] += 1
            else:
                self.keep_raw([e["name"]] + e["phones"] + e["emails"], e["src"], "neplatné jméno")
        self.open = None

    def keep_raw(self, cells, src, why):
        r = {"cells": [c for c in cells if c], "why": why, "src": src}
        r.update(self.ctx())
        self.raw.append(r)
        self.stats["raw"] += 1

    # -- feeding
    def feed(self, line, li):
        if line[0] == "X":
            self.close()
            self.keep_raw(line[1], ("T", li), "sloupce nejdou spárovat")
        elif line[0] == "T":
            self.feed_cells([line[1]], ("T", li), first_row=False)
        else:
            _, ti, ri, cells = line
            self.feed_cells(cells, ("R", li, ti), first_row=(ri == 0))

    def feed_cells(self, cells, src, first_row):
        nonempty = [c for c in cells if c]
        joined = clean(" ".join(nonempty))
        f = fold(joined)
        if not nonempty:
            return
        # chrome / boilerplate
        if f in CHROME or CHROME_RE.search(f):
            self.stats["chrome"] += 1
            return
        if all(fold(c).strip(" :") in HEADER_WORDS for c in nonempty):
            self.stats["header"] += 1
            return
        # cohort heading (whole row, or the first cell of a merged row)
        h = parse_heading(nonempty[0], self.ts) if nonempty else None
        if h is None and len(nonempty) == 1:
            h = parse_heading(joined, self.ts)
        if h is not None:
            self.set_cohort(h)
            self.stats["headings"] += 1
            rest_cells = ([h["rest"]] if h["rest"] else []) + nonempty[1:]
            if any(re.search(r"\d{3}|\w{2,}", c) for c in rest_cells) and h["rest"]:
                self.merged(rest_cells, src)
            elif rest_cells and len(nonempty) > 1:
                # e.g. ['', '2017 year CDM documentary', ''] already consumed; leftovers are captions
                pass
            return
        # study level / track markers
        if len(nonempty) == 1 and LEVEL_RE.match(f):
            self.close()
            self.level = joined.rstrip(":")
            self.stats["levels"] += 1
            return
        if len(nonempty) == 1 and not re.search(r"\d", joined) and (
                f in TRACK_WORDS or (src[0] == "R" and first_row and len(joined.split()) <= 3 and len(cells) > 1)):
            self.close()
            self.track = joined
            self.stats["tracks"] += 1
            return
        # merged Word paste: many phones in one row
        allph = sum(len(split_phones(c)[0]) for c in nonempty)
        words = sum(len(extract(c)["name"].split()) for c in nonempty)
        if allph >= 2 and words >= 4 and words >= 2 * allph - 1:
            self.merged(nonempty, src)
            return
        # ordinary row or line
        infos = [extract(c) for c in nonempty]
        name = clean(" ".join(i["name"] for i in infos if i["name"]))
        info = {"phones": sum((i["phones"] for i in infos), []),
                "emails": sum((i["emails"] for i in infos), []),
                "urls": sum((i["urls"] for i in infos), []),
                "note": clean(" ".join(i["note"] for i in infos if i["note"]))}
        contact = bool(info["phones"] or info["emails"] or info["urls"])
        if name and not valid_name(name):
            # maybe "Name" + free text note
            if contact and len(name.split()) > 6:
                self.keep_raw(nonempty, src, "dlouhý text s kontaktem")
            else:
                self.close()
                self.keep_raw(nonempty, src, "nerozpoznaný řádek")
            return
        if name:
            single = len(name.split()) == 1
            o = self.open
            if o and not self.has_contact(o) and name[0].islower():
                o["name"] += name  # word broken by formatting ("Št" + "ě" + "pánková")
                if contact:
                    self.attach(info)
                return
            if o and not self.has_contact(o) and single and o["parts"] < 2 and not contact:
                o["name"] += " " + name
                o["parts"] += 1
                return
            if o and not self.has_contact(o) and single and o["parts"] < 2 and contact:
                o["name"] += " " + name
                o["parts"] += 1
                self.attach(info)
                return
            self.new_entry(name, info, src, single=single)
            return
        if contact:
            if self.open:
                self.attach(info)
            else:
                self.keep_raw(nonempty, src, "kontakt bez jména")
            return
        if info["note"] and self.open:
            self.open["notes"].append(info["note"])
            return
        self.keep_raw(nonempty, src, "nerozpoznaný řádek")

    def merged(self, cells, src):
        """2011-era rows where a whole column was pasted into one cell."""
        self.close()
        cols = []
        for c in cells:
            ph, res = split_phones(c)
            cols.append((ph, clean(res)))
        # A: one cell, names interleaved with phones
        for c in cells:
            parts = [clean(p) for p in PHONE_CAND.split(c)]
            ph = split_phones(c)[0]
            names = [p for p in parts if p]
            if len(ph) >= 2 and len(names) == len(ph) and all(valid_name(n) for n in names) and \
                    sum(1 for x in cells if x) == 1:
                for n, p in zip(names, ph):
                    e = {"name": pretty_name(n), "phones": [p], "emails": [], "urls": [], "notes": [],
                         "src": src, "merged": True}
                    e.update(self.ctx())
                    self.entries.append(e)
                    self.stats["entries"] += 1
                    self.stats["merged_entries"] += 1
                return
        # B: columns, k words each, one phone column with k phones
        phone_cols = [ph for ph, res in cols if len(ph) >= 2]
        text_cols = [res.split() for ph, res in cols if res]
        if len(phone_cols) == 1 and text_cols:
            k = len(phone_cols[0])
            if all(len(t) == k for t in text_cols):
                for i in range(k):
                    n = " ".join(t[i] for t in text_cols)
                    if not valid_name(n):
                        continue
                    e = {"name": pretty_name(n), "phones": [phone_cols[0][i]], "emails": [], "urls": [],
                         "notes": [], "src": src, "merged": True}
                    e.update(self.ctx())
                    self.entries.append(e)
                    self.stats["entries"] += 1
                    self.stats["merged_entries"] += 1
                return
        self.keep_raw(cells, src, "sloučené buňky (nelze rozdělit)")

    def finish(self):
        self.close()


# ---------------------------------------------------------------- main

def main():
    pages = json.load(open(os.path.join(SRC, "pages.json"), encoding="utf-8"))
    os.makedirs(OUT, exist_ok=True)

    versions = []          # metadata
    version_lines = {}     # vid -> lines
    all_entries = []       # (vid, entry)
    raw_rows = []
    intro = []
    pstats = Counter()

    for page in sorted(pages):
        dept = dept_of(page)
        for v in pages[page]:
            d = json.load(open(os.path.join(SRC, v["file"]), encoding="utf-8"))
            ts = d.get("first_seen") or v["first_seen"]
            vid = "%s@%s" % (dept or "index", ts)
            lines = linearize(d.get("blocks") or [])
            meta = {
                "id": vid, "dept": dept or "index", "page": page,
                "first_seen": ts, "last_seen": d.get("last_seen") or v["last_seen"],
                "captures": len(d.get("timestamps") or []) or v.get("captures", 1),
                "wayback": d.get("wayback"), "title": clean(d.get("title")),
                "tables": v.get("tables", 0), "lines": len(lines),
                "encoding": d.get("encoding"),
            }
            version_lines[vid] = [list(l) for l in lines]
            if dept is None:
                intro.append(meta)
                versions.append(meta)
                continue
            p = Parser(dept, vid, ts)
            plines, fixed = rejoin_columns(lines)
            p.stats["column_rejoined"] += fixed
            if fixed:
                meta["column_rejoined"] = fixed
            for li, line in enumerate(plines):
                p.feed(line, li)
            p.finish()
            pstats.update(p.stats)
            meta["entries"] = len(p.entries)
            meta["raw"] = len(p.raw)
            for e in p.entries:
                all_entries.append((vid, ts, e))
            for r in p.raw:
                r["version"] = vid
                raw_rows.append(r)
            versions.append(meta)

    versions.sort(key=lambda m: (m["dept"], m["first_seen"]))
    vmeta = {m["id"]: m for m in versions}

    # ---- identity across versions: (dept, name key, cohort start); inferred cohorts snap to an
    #      explicit cohort of the same name within +/-1 year.
    # "N. ročník" headings: the cohort is counted from the first capture where that
    # name appeared under that year of study (old tables stayed on the page for years).
    first_ts = {}
    for vid, ts, e in all_entries:
        if e["cohort_inferred"]:
            k = (vmeta[vid]["dept"], name_key(e["name"]), e["year_of_study"])
            first_ts[k] = min(first_ts.get(k, ts), ts)
    for vid, ts, e in all_entries:
        if e["cohort_inferred"]:
            k = (vmeta[vid]["dept"], name_key(e["name"]), e["year_of_study"])
            e["cohort_start"] = academic_year(first_ts[k]) - (e["year_of_study"] - 1)
            e["cohort"] = ay_label(e["cohort_start"])
    known = defaultdict(set)
    for vid, ts, e in all_entries:
        if e["cohort_start"]:
            known[(vmeta[vid]["dept"], name_key(e["name"]))].add(e["cohort_start"])
    explicit = defaultdict(set)
    for vid, ts, e in all_entries:
        if e["cohort_start"] and not e["cohort_inferred"]:
            explicit[(vmeta[vid]["dept"], name_key(e["name"]))].add(e["cohort_start"])
    people = {}
    for vid, ts, e in sorted(all_entries, key=lambda x: x[1]):
        dept = vmeta[vid]["dept"]
        nk = name_key(e["name"])
        cs = e["cohort_start"]
        if cs is None and len(known.get((dept, nk), ())) == 1:
            cs = next(iter(known[(dept, nk)]))  # listed above the first heading in some versions
        if e["cohort_inferred"] and cs:
            cands = [c for c in explicit.get((dept, nk), ()) if abs(c - cs) <= 1]
            if cands:
                cs = min(cands, key=lambda c: abs(c - cs))
        key = (dept, nk, cs)
        p = people.get(key)
        if p is None:
            p = people[key] = {
                "dept": dept, "cohort_start": cs, "cohort": ay_label(cs) if cs else None,
                "cohort_inferred": e["cohort_inferred"], "names": Counter(), "phones": [], "emails": [],
                "urls": [], "notes": [], "levels": Counter(), "tracks": Counter(), "seen": [],
                "merged_paste": False,
            }
        p["names"][e["name"]] += 1
        p["latest_name"] = e["name"]
        if not e["cohort_inferred"]:
            p["cohort_inferred"] = False
        for f in ("phones", "emails", "urls", "notes"):
            for x in e[f]:
                if x not in p[f]:
                    p[f].append(x)
        if e["level"]:
            p["levels"][e["level"]] += 1
        if e["track"]:
            p["tracks"][e["track"]] += 1
        if e.get("merged"):
            p["merged_paste"] = True
        if vid not in p["seen"]:
            p["seen"].append(vid)

    plist = []
    for key, p in people.items():
        seen = sorted(p["seen"], key=lambda v: vmeta[v]["first_seen"])
        plist.append({
            "dept": p["dept"],
            "cohort": p["cohort"],
            "cohort_start": p["cohort_start"],
            "cohort_inferred": p["cohort_inferred"],
            "name": p["latest_name"],
            "name_variants": [n for n in p["names"] if n != p["latest_name"]],
            "level": p["levels"].most_common(1)[0][0] if p["levels"] else "",
            "track": p["tracks"].most_common(1)[0][0] if p["tracks"] else "",
            "phones": p["phones"], "emails": p["emails"], "urls": p["urls"], "notes": p["notes"],
            "seen": seen,
            "first_seen": vmeta[seen[0]]["first_seen"],
            "last_seen": max(vmeta[v]["last_seen"] for v in seen),
            "merged_paste": p["merged_paste"],
        })
    plist.sort(key=lambda x: (x["dept"], -(x["cohort_start"] or 0), fold(x["name"])))
    for i, x in enumerate(plist):
        x["id"] = i

    # per version: which people appear (for the history diff)
    vpeople = defaultdict(list)
    for x in plist:
        for v in x["seen"]:
            vpeople[v].append(x["id"])
    for m in versions:
        m["people"] = vpeople.get(m["id"], [])

    # ---- departments
    depts = []
    for code, short, name, kind in DEPTS:
        vs = [m for m in versions if m["dept"] == code]
        ps = [x for x in plist if x["dept"] == code]
        coh = Counter(x["cohort"] or "bez ročníku" for x in ps)
        depts.append({
            "code": code, "short": short, "name": name, "kind": kind,
            "pages": sorted({m["page"] for m in vs}),
            "versions": [m["id"] for m in vs],
            "first_seen": min((m["first_seen"] for m in vs), default=None),
            "last_seen": max((m["last_seen"] for m in vs), default=None),
            "people": len(ps),
            "cohorts": [{"label": c, "people": n} for c, n in
                        sorted(coh.items(), key=lambda kv: kv[0], reverse=True)],
            "raw": sum(1 for r in raw_rows if vmeta[r["version"]]["dept"] == code),
        })

    for r in raw_rows:
        r["src"] = list(r["src"])

    out = {
        "generated_from": "data/extracted (Wayback Machine scrape of famaci.estranky.cz)",
        "privacy": "Obsahuje osobní údaje. Pouze lokálně, nesdílet.",
        "departments": depts,
        "versions": versions,
        "people": plist,
        "raw": raw_rows,
    }
    with open(os.path.join(OUT, "famaci.json"), "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(OUT, "versions.json"), "w", encoding="utf-8") as fh:
        json.dump(version_lines, fh, ensure_ascii=False, separators=(",", ":"))

    # ---- stats (counts only)
    rep = []
    rep.append("Famáci 2.0 · build report (jen počty, žádná jména)")
    rep.append("")
    rep.append("verze stránek: %d (z toho úvod: %d)" % (len(versions), len(intro)))
    rep.append("záznamy v jednotlivých verzích: %d" % len(all_entries))
    rep.append("  z toho rozdělené ze sloučených buněk: %d" % pstats["merged_entries"])
    rep.append("  z toho poskládané z textu vloženého po sloupcích: %d" % pstats["column_rejoined"])
    rep.append("unikátní osoby (katedra + jméno + ročník): %d" % len(plist))
    rep.append("  s telefonem: %d, s e-mailem: %d, s odkazem: %d" % (
        sum(1 for x in plist if x["phones"]), sum(1 for x in plist if x["emails"]),
        sum(1 for x in plist if x["urls"])))
    rep.append("  ročník odvozený z 'N. ročník' a data snímku: %d" % sum(1 for x in plist if x["cohort_inferred"]))
    rep.append("  bez ročníku: %d" % sum(1 for x in plist if not x["cohort"]))
    rep.append("ponechané surové řádky: %d" % len(raw_rows))
    for why, n in Counter(r["why"] for r in raw_rows).most_common():
        rep.append("  %s: %d" % (why, n))
    rep.append("nadpisy ročníků: %d, úrovně studia: %d, programy/obory: %d, odfiltrované prvky šablony: %d" % (
        pstats["headings"], pstats["levels"], pstats["tracks"], pstats["chrome"]))
    rep.append("")
    rep.append("%-6s %5s %6s %5s  %-9s %-9s  ročníky" % ("kat.", "verzí", "osob", "raw", "od", "do"))
    for d in depts:
        labs = [c["label"] for c in d["cohorts"] if c["label"] != "bez ročníku"]
        rep.append("%-6s %5d %6d %5d  %-9s %-9s  %s" % (
            d["short"], len(d["versions"]), d["people"], d["raw"],
            (d["first_seen"] or "")[:8], (d["last_seen"] or "")[:8],
            ("%s až %s (%d)" % (labs[-1], labs[0], len(labs))) if labs else "-"))
    text = "\n".join(rep) + "\n"
    with open(os.path.join(OUT, "stats.txt"), "w", encoding="utf-8") as fh:
        fh.write(text)
    sys.stdout.write(text)


if __name__ == "__main__":
    main()
