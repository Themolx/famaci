"""Fail if anything meant for git / GitHub Pages contains real personal data.

Two layers:
1. Always (also in CI, no real data needed): every phone-like number must start with 000
   (the demo prefix) and every e-mail must be @example.cz / @example.com / known service address.
2. If the real local data exists (app/data/famaci.json, not in git): no real name, phone or
   e-mail of any person may appear in the checked files.

Usage: python3 -I tools/check_public.py <file-or-dir> ...
"""
import sys, os, re, json

PHONE = re.compile(r"(?<![\d.])(?:\+\s?\d{3}\s?)?\d{3}\s\d{3}\s\d{3}(?![\d.])|(?<![\d.])\d{9}(?![\d.])")
EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
OK_MAIL = re.compile(r"@(example\.(cz|com|org)|users\.noreply\.github\.com|anthropic\.com|famu\.cz|amu\.cz)$", re.I)
PLACEHOLDERS = {"777123456", "123456789"}  # form placeholders
TEXT_EXT = {".json", ".js", ".html", ".css", ".md", ".py", ".txt", ".yml", ".yaml", ".toml", ".svg", ""}
SKIP_DIRS = {".git", "__pycache__", "node_modules"}
REAL = os.path.join(os.path.dirname(__file__), "..", "app", "data", "famaci.json")

def files(paths):
    for p in paths:
        if os.path.isdir(p):
            for root, dirs, fs in os.walk(p):
                dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not (root.rstrip("/").endswith("app") and d == "data")]
                for f in fs:
                    if os.path.splitext(f)[1] in TEXT_EXT: yield os.path.join(root, f)
        elif os.path.exists(p):
            yield p

def main(paths):
    real_names, real_digits, real_mails = set(), set(), set()
    if os.path.exists(REAL):
        d = json.load(open(REAL, encoding="utf-8"))
        if not d.get("demo"):
            labels = {x.lower() for p in d["people"] for x in (p["track"], p["level"]) if x}
            labels |= {x["name"].lower() for x in d["departments"]}
            for p in d["people"]:
                for n in [p["name"], *p["name_variants"]]:
                    if len(n) >= 6 and " " in n and n.lower() not in labels: real_names.add(n.lower())
                real_digits |= {re.sub(r"\D", "", x)[-9:] for x in p["phones"] if len(re.sub(r"\D", "", x)) >= 9}
                real_mails |= {x.lower() for x in p["emails"]}
    bad = []
    for f in files(paths):
        try: t = open(f, encoding="utf-8").read()
        except UnicodeDecodeError: continue
        low = t.lower()
        for m in PHONE.findall(t):
            dg = re.sub(r"\D", "", m)
            if not dg[-9:].startswith("000") and dg[-9:] not in PLACEHOLDERS: bad.append((f, "phone-like number not in demo range", m))
        for m in EMAIL.findall(t):
            if not OK_MAIL.search(m): bad.append((f, "non-demo e-mail", m))
        if real_names or real_digits:
            digits = re.sub(r"\D", "", t)
            hits = [n for n in real_names if n in low]
            hits += ["(phone)" for x in real_digits if x in digits and re.search(r"\b" + r"\s?".join(x[i:i+3] for i in (0, 3, 6)) + r"\b", t)]
            hits += ["(e-mail)" for x in real_mails if x in low]
            if hits: bad.append((f, f"REAL personal data ({len(hits)} hits)", ""))
    for f, why, m in bad[:40]:
        # never echo real data, only where and what kind
        print(f"FAIL {f}: {why}" + (f" [{m[:3]}...]" if m else ""))
    if bad:
        print(f"{len(bad)} problem(s). Nothing personal may go public."); sys.exit(1)
    print("ok: no personal data found" + (" (checked against real local data too)" if real_names else " (pattern check only)"))

if __name__ == "__main__":
    main(sys.argv[1:] or ["."])
