"""docs/gdpr-zasady-a-souhlas.md (oddíl s textem podmínek) -> web/ochrana-soukromi.html.

Použití: python3 -I tools/gdpr_page.py docs/gdpr-zasady-a-souhlas.md web/ochrana-soukromi.html
"""
import sys, re, html
src, out = sys.argv[1], sys.argv[2]
t = open(src, encoding="utf-8").read()
start = t.index("#### Famáci 2.0 – Informace o zpracování osobních údajů a pravidla užívání")
end = t.index("### Text souhlasu při registraci")
blocks = [b.strip() for b in t[start:end].split("\n\n") if b.strip()][1:]
def inline(s):
    s = html.escape(s, quote=False)
    return re.sub(r"\[([^\[\]]*)\]", r'<span class="todo">[\1]</span>', s)
parts = []
for b in blocks:
    if b.startswith("|"):
        rows = [r.strip().strip("|").split(" | ") for r in b.splitlines() if not re.match(r"^\|(-+\|)+$", r.strip())]
        h = "".join(f"<th>{inline(c.strip())}</th>" for c in rows[0])
        body = "".join("<tr>" + "".join(f"<td>{inline(c.strip())}</td>" for c in r) + "</tr>" for r in rows[1:])
        parts.append(f'<div class="table-wrap"><table><thead><tr>{h}</tr></thead><tbody>{body}</tbody></table></div>')
    elif b.startswith("- "):
        parts.append("<ul>" + "".join(f"<li>{inline(l[2:])}</li>" for l in b.splitlines()) + "</ul>")
    elif re.match(r"^\d+\. ", b) and "\n" not in b and len(b) < 60:
        parts.append(f"<h2>{inline(b)}</h2>")
    elif b.startswith("Verze "):
        parts.append(f'<p class="version">{inline(b)}</p>')
    else:
        parts.append(f"<p>{inline(b)}</p>")
body = "\n".join(parts)
page = f"""<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'">
<title>Ochrana soukromí a pravidla · Famáci 2.0</title>
<link rel="stylesheet" href="style.css">
</head>
<body>
<a class="skip" href="#obsah">Přeskočit na obsah</a>
<header class="bar">
  <a class="brand" href="index.html" aria-label="Famáci 2.0, úvod"><span class="brand-word">Famáci</span><span class="brand-tag">2.0</span></a>
  <div class="bar-end"><a class="btn btn-line" href="app.html#/lide">Do adresáře</a></div>
</header>
<main id="obsah" class="doc">
<h1 class="display">Ochrana soukromí a pravidla užívání</h1>
<!-- Vygenerováno z docs/gdpr-zasady-a-souhlas.md (oddíl „Informace o zpracování…“). Text upravuj tam a stránku přegeneruj. -->
{body}
</main>
<footer class="foot">
  <span class="brand-word">Famáci</span>
  <nav aria-label="Patička">
    <a class="foot-gdpr" href="ochrana-soukromi.html" aria-current="page">Ochrana soukromí a pravidla</a>
    <a href="app.html#/nahlasit">Nahlásit zneužití kontaktu</a>
    <a href="mailto:spravce@example.cz">Kontakt na správce</a>
  </nav>
  <p class="foot-note">Prototyp. Hodnoty zvýrazněné červeně je potřeba doplnit před spuštěním. Famáci 2.0 nejsou oficiálním webem FAMU.</p>
</footer>
</body>
</html>
"""
open(out, "w", encoding="utf-8").write(page)
print(len(parts), "blocks")
