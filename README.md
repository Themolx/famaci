# Famáci 2.0

Famáci byl studentský telefonní seznam FAMU na eStránkách (famaci.estranky.cz), který běžel od roku 2008 do jara 2025. Každá katedra měla jednu stránku s tabulkou za každý ročník. Web zmizel a zbyl jen ve Wayback Machine. Tenhle repozitář ho obnovuje a staví na něm novou verzi.

**Demo:** https://themolx.github.io/famaci/ (smyšlená data, viz níž)

## Soukromí na prvním místě

Archiv obsahuje skutečná jména a telefony asi 1 700 studentů. **Tahle data v repozitáři nejsou a nikdy nebudou.**

- Skutečná data si každý stáhne a sestaví lokálně (viz níž). Složky `data/`, `app/data/`, `v2/data/` jsou v `.gitignore`.
- GitHub Pages ukazuje **demo**: stejná struktura, ročníky a historie, ale každé jméno, telefon a e-mail je smyšlený (`tools/make_demo.py`). Telefony v demu začínají na `000`.
- `tools/check_public.py` zkontroluje, že do gitu nejde nic osobního. Běží v CI na každý push a PR a jde zapnout i jako pre-commit hook.
- Nová verze nesmí zveřejnit staré kontakty bez souhlasu dotčených (GDPR). Viz `BRAINSTORM.md`.

## Co tu je

| Složka | Co |
|---|---|
| `tools/` | scraper Wayback Machine (`cdx_list.py`, `download.py`, `extract.py`), generátor dema a kontrola soukromí |
| `app/` | **Famáci 2.0 archiv**: statická appka (HTML, CSS, JS, bez knihoven), přehled kateder a ročníků, hledání, historie verzí, statistiky. Běží i na GitHub Pages |
| `demo/` | smyšlená data pro Pages a pro vývoj bez skutečných dat |
| `v2/` | **prototyp nového adresáře**: Python server (jen standardní knihovna) + SQLite, přihlášení odkazem na školní mail, profily, projekty, štábová listina, API. Jen lokálně, na Pages neběží |
| `BRAINSTORM.md` | co byl starý web, nápady a otevřené otázky pro 2.0 |
| `AGENTS.md` | celý kontext pro AI agenty (Codex, Antigravity, Claude Code přes `CLAUDE.md`) |

## Rychlý start (demo data, nic nestahuješ)

```bash
git clone https://github.com/Themolx/famaci.git
```

```bash
cd famaci && mkdir -p app/data && cp demo/*.json app/data/
```

```bash
python3 -I -m http.server 8790 --bind 127.0.0.1 --directory app
```

Pak `http://localhost:8790`. Prototyp v2: `python3 -I v2/server.py` a `http://localhost:8791`.

## Skutečná data (jen lokálně)

```bash
python3 -I tools/cdx_list.py www.famaci.estranky.cz data/cdx_www.json
```

```bash
python3 -I tools/download.py data/cdx_www.json data/raw
```

```bash
python3 -I tools/extract.py data/raw data/extracted && python3 -I app/build_data.py
```

Stažení trvá asi 10 minut (274 verzí, 1,5 s pauza mezi požadavky, ať archiv nezatěžujeme). CDX API odmítá velké dotazy s hvězdičkou („Temporarily Offline“), proto `cdx_list.py` stránkuje přes `limit` a `resumeKey`. `download.py` umí navázat po přerušení.

Výsledek: 494 snímků, 30 URL, 274 různých verzí (2008 až 2025), z toho 271 HTML. `data/raw/<stránka>/<timestamp>.html` jsou původní bajty (přes `id_`, bez lišty Wayback), `data/extracted/` totéž jako JSON a Markdown.

Demo ze skutečných dat přegeneruješ takhle (klíč pro pseudonymy vznikne v `data/demo_key` a zůstane u tebe):

```bash
python3 -I tools/make_demo.py app/data demo && python3 -I tools/check_public.py .
```

## Spolupráce

Viz [CONTRIBUTING.md](CONTRIBUTING.md). Kód je pod licencí MIT, data z archivu licencovaná nejsou a do repozitáře nepatří.
