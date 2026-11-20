"""Extract every downloaded version into structured JSON + Markdown.
Usage: python3 -I extract.py data/raw data/extracted

Output:
  extracted/<page>/<timestamp>.json   title, timestamps, text blocks, tables (rows of cells), links, images
  extracted/<page>/<timestamp>.md     readable Markdown of the article
  extracted/pages.json                per page: all versions in time order (first/last seen, sizes)
"""
import sys, os, re, json
from bs4 import BeautifulSoup, NavigableString

def decode(raw):
    m = re.search(rb'charset=["\']?([\w-]+)', raw[:3000], re.I)
    enc = m.group(1).decode().lower() if m else "utf-8"
    try:
        return raw.decode(enc), enc
    except (LookupError, UnicodeDecodeError):
        for e in ("utf-8", "cp1250"):
            try: return raw.decode(e), e
            except UnicodeDecodeError: pass
    return raw.decode("cp1250", "replace"), "cp1250?"

def clean(s):
    return re.sub(r"\s+", " ", s.replace("\xa0", " ")).strip()

def table_rows(t):
    rows = []
    for tr in t.find_all("tr"):
        cells = [clean(td.get_text(" ")) for td in tr.find_all(["td", "th"]) if td.find_parent("tr") is tr]
        if any(cells): rows.append(cells)
    return rows

def md_table(rows):
    w = max(len(r) for r in rows)
    rows = [r + [""] * (w - len(r)) for r in rows]
    esc = lambda c: c.replace("|", "\\|")
    out = ["| " + " | ".join(esc(c) for c in rows[0]) + " |", "|" + "---|" * w]
    out += ["| " + " | ".join(esc(c) for c in r) + " |" for r in rows[1:]]
    return "\n".join(out)

def extract(html):
    s = BeautifulSoup(html, "html.parser")
    for x in s(["script", "style", "noscript"]): x.decompose()
    title = clean(s.title.get_text()) if s.title else ""
    art = s.find(class_="article") or s.find(id="content") or s.body or s
    h = art.find(["h1", "h2"])
    blocks, md = [], []
    if h: md.append("# " + clean(h.get_text(" ")))
    # walk top-level-ish: tables become tables, everything else text paragraphs
    # leaf tables carry the data; outer ones (Word-paste layout wrappers) just flow as text
    for t in art.find_all("table"):
        if t.find("table"): continue
        rows = table_rows(t)
        t.replace_with(s.new_string(f"\n@@TABLE{len(blocks)}@@\n"))
        blocks.append({"type": "table", "rows": rows})
    text = art.get_text("\n")
    out_blocks = []
    for line in text.split("\n"):
        line = clean(line)
        if not line: continue
        m = re.fullmatch(r"@@TABLE(\d+)@@", line)
        if m:
            b = blocks[int(m.group(1))]
            out_blocks.append(b)
            if b["rows"]: md.append(md_table(b["rows"]))
        elif not (h and line == clean(h.get_text(" ")) and not out_blocks):
            out_blocks.append({"type": "text", "text": line})
            md.append(line)
    links = sorted({a["href"] for a in art.find_all("a", href=True)})
    imgs = sorted({i["src"] for i in art.find_all("img", src=True)})
    nav = [clean(a.get_text()) for a in s.select("#menu a, .menu a")] if s.select("#menu a, .menu a") else []
    return {"title": title, "heading": clean(h.get_text(" ")) if h else "", "blocks": out_blocks,
            "links": links, "images": imgs, "menu": nav}, "\n\n".join(md)

def main(raw, out):
    man = json.load(open(os.path.join(raw, "manifest.json")))
    pages = {}
    for rec in man.values():
        if not rec.get("file") or not rec["file"].endswith(".html"): continue
        html, enc = decode(open(os.path.join(raw, rec["file"]), "rb").read())
        data, md = extract(html)
        ts = sorted(rec["timestamps"])
        data.update(path=rec["path"], digest=rec["digest"], encoding=enc,
                    first_seen=ts[0], last_seen=ts[-1], timestamps=ts,
                    wayback=f"https://web.archive.org/web/{ts[0]}/http://www.famaci.estranky.cz/{rec['path'] if rec['path'] != 'index' else ''}")
        d = os.path.join(out, rec["path"].replace("/", "__"))
        os.makedirs(d, exist_ok=True)
        json.dump(data, open(os.path.join(d, ts[0] + ".json"), "w"), ensure_ascii=False, indent=1)
        open(os.path.join(d, ts[0] + ".md"), "w").write(
            f"<!-- {rec['path']} · first seen {ts[0]} · last seen {ts[-1]} · {data['wayback']} -->\n\n{md}\n")
        pages.setdefault(rec["path"], []).append({
            "first_seen": ts[0], "last_seen": ts[-1], "captures": len(ts), "title": data["title"],
            "tables": sum(b["type"] == "table" for b in data["blocks"]),
            "table_rows": sum(len(b["rows"]) for b in data["blocks"] if b["type"] == "table"),
            "file": os.path.join(rec["path"].replace("/", "__"), ts[0] + ".json")})
    for v in pages.values(): v.sort(key=lambda x: x["first_seen"])
    json.dump(dict(sorted(pages.items())), open(os.path.join(out, "pages.json"), "w"), ensure_ascii=False, indent=1)
    print(len(pages), "pages,", sum(len(v) for v in pages.values()), "versions ->", out)

if __name__ == "__main__":
    main(*sys.argv[1:])
