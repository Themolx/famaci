"""Make a public demo dataset from the real local one.

Keeps everything that is not personal (departments, cohorts, counts, page versions, dates,
Wayback links) and replaces every person with a fake one. The same real person always gets
the same fake name (keyed HMAC), so the history view still works on the demo site.
The key lives only in data/demo_key (gitignored), so the mapping cannot be reversed.

Usage: python3 -I tools/make_demo.py app/data demo
Then:  python3 -I tools/check_public.py demo app v2 tools README.md ...
"""
import sys, os, re, json, hmac, hashlib, secrets

KEY_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "demo_key")

FIRST = ("Adam Alžběta Anna Barbora Bořek Dana Daniel David Dominik Ema Eliška Filip František Hana "
         "Ivana Jakub Jan Jana Jiří Josef Julie Karel Karolína Klára Kryštof Lenka Lucie Lukáš Marek "
         "Marie Markéta Martin Matěj Michal Natálie Nela Ondřej Pavel Petr Petra Radek Sára Simona "
         "Šimon Štěpán Tereza Tomáš Veronika Viktor Vojtěch Zuzana Zdeněk Žofie").split()
LAST = ("Kolibřík Mlýnek Kotouč Clona Ohnisko Záběr Střih Obrazek Zvoník Klapka Stativ Reflektor "
        "Objektiv Ateliér Políčko Kulisa Rekvizita Dabing Titulek Prolínačka Montáž Šeřík Javor "
        "Kamínek Lucerna Pastelka Komínek Holoubek Vrabec Sýkorka Jeřáb Kopretina Kaštan Ořech "
        "Brusinka Měsíček Mlha Duha Kroupa Jinovatka Vánek Potůček Skála Lesík Pahorek Lípa Bříza").split()
FEM_END = {"Kolibřík": "Kolibříková", "Mlýnek": "Mlýnková", "Kotouč": "Kotoučová", "Zvoník": "Zvoníková",
           "Stativ": "Stativová", "Reflektor": "Reflektorová", "Objektiv": "Objektivová", "Ateliér": "Ateliérová",
           "Dabing": "Dabingová", "Titulek": "Titulková", "Šeřík": "Šeříková", "Javor": "Javorová",
           "Kamínek": "Kamínková", "Komínek": "Komínková", "Holoubek": "Holoubková", "Vrabec": "Vrabcová",
           "Jeřáb": "Jeřábová", "Kaštan": "Kaštanová", "Ořech": "Ořechová", "Měsíček": "Měsíčková",
           "Vánek": "Vánková", "Potůček": "Potůčková", "Lesík": "Lesíková", "Pahorek": "Pahorková"}
FEMALE = set("Alžběta Anna Barbora Dana Ema Eliška Hana Ivana Jana Julie Karolína Klára Lenka Lucie "
             "Marie Markéta Natálie Nela Petra Sára Simona Tereza Veronika Zuzana Žofie".split())

PHONE = re.compile(r"(?:\+\s?\d{3}\s?)?\d{3}\s?\d{3}\s?\d{3}")
EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
URL = re.compile(r"(?:https?://|www\.)\S+")

def key():
    os.makedirs(os.path.dirname(KEY_FILE), exist_ok=True)
    if not os.path.exists(KEY_FILE):
        open(KEY_FILE, "w").write(secrets.token_hex(32))
    return bytes.fromhex(open(KEY_FILE).read().strip())

K = None
def h(s, n=8):
    return int.from_bytes(hmac.new(K, s.strip().lower().encode(), hashlib.sha256).digest()[:n], "big")

def fake_name(real):
    x = h("name:" + real)
    f = FIRST[x % len(FIRST)]
    l = LAST[(x >> 16) % len(LAST)]
    if f in FEMALE:
        l = FEM_END.get(l, l)
    return f"{f} {l}"

def fake_phone(real):
    x = h("tel:" + re.sub(r"\D", "", real)) % 1000000
    return f"000 {x // 1000:03d} {x % 1000:03d}"  # 000 is not a valid Czech prefix

def fake_email(real):
    return "student" + str(h("mail:" + real) % 100000) + "@example.cz"

def fake_text(s):
    """Pseudonymize a free-form cell or line: phones, emails, urls and the leftover name."""
    phones = [fake_phone(p) for p in PHONE.findall(s)]
    mails = [fake_email(e) for e in EMAIL.findall(s)]
    rest = URL.sub(" ", EMAIL.sub(" ", PHONE.sub(" ", s)))
    rest = re.sub(r"[\s,;:/()+|-]+", " ", rest).strip()
    parts = [fake_name(rest)] if re.search(r"[^\W\d_]", rest) else []
    return " ".join(parts + phones + mails)

def main(src, out):
    global K
    K = key()
    d = json.load(open(os.path.join(src, "famaci.json"), encoding="utf-8"))
    lines = json.load(open(os.path.join(src, "versions.json"), encoding="utf-8"))

    # tokens that belong to real people, to catch them in prose lines
    real_tokens = set()
    for p in d["people"]:
        for n in [p["name"], *p["name_variants"]]:
            real_tokens |= {t.lower() for t in re.findall(r"[^\W\d_]{3,}", n)}
    safe_words = set()
    for x in d["departments"]:
        safe_words |= {t.lower() for t in re.findall(r"[^\W\d_]{3,}", x["name"] + " " + x["short"])}
    for v in d["versions"]:
        safe_words |= {t.lower() for t in re.findall(r"[^\W\d_]{3,}", v["title"])}
    for p in d["people"]:
        safe_words |= {t.lower() for t in re.findall(r"[^\W\d_]{3,}", p["track"] + " " + p["level"])}
    personal = real_tokens - safe_words

    def safe_line(s):
        if PHONE.search(s) or EMAIL.search(s): return False
        toks = {t.lower() for t in re.findall(r"[^\W\d_]{3,}", s)}
        return not (toks & personal)

    for p in d["people"]:
        real = p["name"]
        p["name"] = fake_name(real)
        p["name_variants"] = [fake_name(n) for n in p["name_variants"]]
        p["phones"] = [fake_phone(x) for x in p["phones"]]
        p["emails"] = [fake_email(x) for x in p["emails"]]
        p["urls"] = []
        p["notes"] = []
    for r in d["raw"]:
        r["cells"] = [fake_text(c) if c.strip() else c for c in r["cells"]]
        r["src"] = [fake_text(c) if isinstance(c, str) and c.strip() else c for c in r.get("src", [])]

    demo_lines, replaced = {}, 0
    for vid, ls in lines.items():
        new = []
        for l in ls:
            if l[0] == "T":
                if safe_line(l[1]): new.append(l)
                else: new.append(["T", fake_text(l[1])]); replaced += 1
            else:  # ["R", table, row, cells]
                new.append([l[0], l[1], l[2], [fake_text(c) if c.strip() else c for c in l[3]]])
        demo_lines[vid] = new

    d["demo"] = True
    d["privacy"] = "DEMO: všechna jména, telefony a e-maily jsou smyšlené."
    d["generated_from"] = "tools/make_demo.py (pseudonymizovaná kopie lokálních dat)"
    os.makedirs(out, exist_ok=True)
    json.dump(d, open(os.path.join(out, "famaci.json"), "w", encoding="utf-8"), ensure_ascii=False)
    json.dump(demo_lines, open(os.path.join(out, "versions.json"), "w", encoding="utf-8"), ensure_ascii=False)
    print(f"demo: {len(d['people'])} fake people, {len(demo_lines)} versions, {replaced} text lines pseudonymized -> {out}")

if __name__ == "__main__":
    main(*sys.argv[1:])
