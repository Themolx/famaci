# Famáci 2.0 · návrh nového webu (klikací prototyp)

Grafický a funkční návrh podle `docs/struktura-webu.md`. Běží celý v prohlížeči, bez serveru a bez knihoven. **Všechna data jsou smyšlená** (`data.js` je generuje při načtení, telefony začínají na `000`). Přihlášení, souhlasy a vlastní profil se drží jen v `localStorage` daného prohlížeče.

```bash
python3 -I -m http.server 8792 --bind 127.0.0.1 --directory web
```

Pak `http://localhost:8792`.

## Soubory

| Soubor | Co |
|---|---|
| `index.html` | statická homepage |
| `app.html` + `app.js` | přihlášení, první přihlášení (pravidla, profil), seznam `#/lide`, detail `#/lide/{id}`, úprava profilu `#/profil`, nastavení `#/nastaveni`, nahlášení zneužití `#/nahlasit` (i bez přihlášení), pro roli admin administrace `#/admin`, `#/admin/uzivatel/{id}`, `#/admin/hlaseni[/{id}]`, `#/admin/zaznam` |
| `ochrana-soukromi.html` | text podmínek, **generovaný** z `docs/gdpr-zasady-a-souhlas.md` skriptem `python3 -I tools/gdpr_page.py docs/gdpr-zasady-a-souhlas.md web/ochrana-soukromi.html`, ručně neupravovat |
| `countries.js` | země a předvolby pro telefon: názvy česky z prohlížeče (`Intl.DisplayNames`), vlajky jako emoji, řazení abecedně |
| `data.js` | smyšlené účty (s profilem i bez), role, nahlášení, studijní obory, ročníky |
| `style.css` | vzhled |
| `fonts/` | Barlow a Barlow Condensed (SIL OFL, `fonts/OFL.txt`), hostované lokálně |

## Vzhled

- Vychází z webu FAMU: černá, červená FAMU `#e50000`, bílá, úzké verzálky, hranaté tvary bez zaoblení.
- Veřejné stránky jsou černé, adresář má světlou pracovní plochu kvůli čitelnosti dlouhých seznamů.
- Ročníky jsou červené štítky jako data u aktualit na famu.cz.
- Jediná animace je „závěrečné titulky“ se studijními obory na homepage. Při `prefers-reduced-motion` stojí.
- CSP jen `'self'`, žádné inline styly ani skripty, žádné externí zdroje.

## Co prototyp jen předstírá

Roli admin si v prototypu přepneš v Nastavení (rámeček „Prototyp“), ve skutečnosti ji přiděluje jiný admin. Zásahy adminů nad smyšlenými účty se ukládají jen do `localStorage`. E-mail se neposílá (místo něj je tlačítko „Otevřít odkaz z e-mailu“), odpověď na nahlášení se neodesílá, odhlášení všude a záznam zobrazení kontaktu nic nedělají. Odeslaná nahlášení se ukládají jen do `localStorage`. Napojení na server (`v2/` nebo jiný) je další krok.
