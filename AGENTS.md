# Famáci 2.0 · kontext pro AI agenty

Tenhle soubor čtou Codex, Antigravity i Claude Code (`CLAUDE.md` ho jen načte). Je to předávací dokument: přečti ho celý, než začneš cokoli měnit. Mluví se česky.

## 1. O co jde

**Famáci** (famaci.estranky.cz) byl studentský telefonní seznam FAMU na webovém builderu eStránky.cz. Běžel od jara 2008 do jara 2025. Každá katedra měla jednu stránku a na ní tabulku za každý ročník: jméno a telefon, později i e-mail. Úvodní věta webu: shromažďování a aktualizace kontaktních údajů současných studentů FAMU. Opravy se hlásily Katedře produkce (1. ročník), takže web nejspíš udržovala produkce. Pak zmizel a zbyl jen ve Wayback Machine.

Repo dělá dvě věci:
1. **Obnovuje archiv** ze všech snímků ve Wayback Machine (`tools/`, `app/`).
2. **Staví novou verzi** (`v2/`), kde se lidé zapisují sami a se souhlasem.

## 2. Soukromí (tvrdé pravidlo, platí vždycky)

Archiv obsahuje skutečná jména a telefony asi 1 700 lidí.

- **Skutečná data nikdy do gitu.** Jsou v `data/`, `app/data/`, `v2/data/` (SQLite), `v2/outbox/`, všechno v `.gitignore`. Nic z toho nekopíruj do jiných souborů, issue, PR, commit message ani do testů.
- **Ani do chatu.** O lidech mluv jen podle role nebo počtem („KP 2014/15: 18 osob“). Při ladění vypisuj struktury a počty, ne hodnoty. Když potřebuješ ukázat řádek, zamaskuj ho (písmena na `x`, číslice na `9`) a maskuj i vnořené seznamy.
- **Pages je veřejné** a běží na `demo/` (smyšlená data). Demo se generuje jen ze skutečných dat skriptem `tools/make_demo.py`. Ručně ho neupravuj. Pseudonymy jsou deterministické přes HMAC s klíčem `data/demo_key`, který zůstává lokálně.
- **Před každým commitem** musí projít `python3 -I tools/check_public.py .` (pre-commit hook: `git config core.hooksPath .githooks`). Kontrola hlídá telefony mimo demo prefix `000`, cizí e-maily a, pokud existují lokální data, i skutečná jména, čísla a adresy. Nikdy je nevypisuje.
- Nová verze nesmí zveřejnit staré kontakty bez souhlasu (GDPR). U citlivých údajů (alergie ve v2) jen se souhlasem.

## 3. Struktura

| Cesta | Co |
|---|---|
| `tools/cdx_list.py` | seznam všech snímků z CDX API (stránkuje `limit` + `resumeKey`) |
| `tools/download.py` | stáhne každou různou verzi jednou (podle digestu) přes `id_`, navazuje po přerušení, `manifest.json` |
| `tools/extract.py` | HTML → JSON + Markdown (`data/extracted/`, `pages.json`) |
| `tools/make_demo.py` | skutečná data → `demo/` se smyšlenými lidmi |
| `tools/check_public.py` | kontrola, že nic osobního nejde ven |
| `app/` | statická appka archivu (vanilla HTML/CSS/JS, hash routing, CSP jen `'self'`). `app/build_data.py` sestaví `app/data/famaci.json` a `versions.json` |
| `demo/` | `famaci.json` + `versions.json` pro Pages a pro vývoj bez dat |
| `v2/` | prototyp nového adresáře: `server.py` (jen standardní knihovna Pythonu + SQLite), `static/` frontend |
| `.github/workflows/` | `pages.yml` (push do `main` → kontrola → nasazení dema), `check.yml` (kontrola na PR a ostatních větvích) |
| `BRAINSTORM.md` | co byl starý web, nápady A až E, otevřené otázky |
| `docs/struktura-webu.md` | **zadání nové verze**: stránky, hlavička, patička, seznam a filtry, detail, profil, nastavení, rozhodnutí a otevřené otázky |
| `docs/gdpr-zasady-a-souhlas.md` | zásady ochrany osobních údajů, texty souhlasu při registraci, technická opatření (pracovní kopie Word dokumentu, upravuje se tady) |

## 4. Spuštění

Bez skutečných dat (stačí pro většinu práce):

```bash
mkdir -p app/data && cp demo/*.json app/data/
```

```bash
python3 -I -m http.server 8790 --bind 127.0.0.1 --directory app
```

`v2`: `python3 -I v2/server.py`, pak `http://localhost:8791`. Přihlašuje se školním mailem (`famu.cz`, `amu.cz`, proměnná `FAMACI_DOMAINS`). Bez SMTP se nic neodesílá, odkaz je na `http://localhost:8791/dev/outbox`. `--reset` založí čistou databázi. Při prvním startu v2 naimportuje archiv z `app/data/famaci.json`.

Skutečná data: tři příkazy v README (`cdx_list.py`, `download.py`, `extract.py` + `app/build_data.py`). Stažení trvá asi 10 minut. Nezkracuj pauzu 1,5 s mezi požadavky, archiv to nezatěžuje.

## 5. Data a jejich záludnosti

- Archiv: 494 snímků, 30 URL, 274 různých verzí (2008 až 2025), 271 HTML. Stránky `stranka/<kat>` (2008 až 2010) a `clanky/<kat>.html` (2011 až 2025) pro kp, kat, kdt, kf, kk, kr, ksd, kss, kzt, cas, od 2017 i cinkk a tři programy FAMU International. V letech 2010 a 2012 archiv nic nezachytil.
- **CDX API** odmítá velké dotazy s hvězdičkou odpovědí „Temporarily Offline“ (HTML místo dat). Malé stránky s `limit` fungují. `www.` a bez `www.` vrací stejný index.
- 58 snímků nemá obsah: 49× 301 (od srpna 2019), 2× 404, 2× 302, 5× `warc/revisit`. Čtyři snímky jsou v indexu dvakrát.
- **Kódování:** starší stránky `windows-1250`, novější UTF-8. Vždy čti `charset` z meta, nehádej.
- Obsah je v `div.article`. Novější stránky mají jednu layoutovou tabulku z Wordu (`o:p`, `span`) a skutečné tabulky vnořené v ní. Data jsou v **listových tabulkách** (bez vnořené tabulky).
- Sloupce se mezi roky liší: jméno a telefon zvlášť, nebo v jedné buňce, nadpisy ročníků jako text mezi tabulkami. Co nejde rozparsovat, `build_data.py` nechává v `raw` (91 řádků), nic se nezahazuje.
- Parser občas pozná jako osobu nadpis programu (třeba „Directing Fiction“). `check_public.py` proto ignoruje jména shodná s názvem programu, úrovně nebo katedry.
- Obrázky z článků archivované nejsou (jen dvě loga).
- Výstup `app/build_data.py`: 14 kateder a programů, 1 697 osob (katedra + jméno + ročník), ročníky nástupu 2002/03 až 2024/25.

## 6. Stav (20. 11. 2026)

- Archiv stažený a rozparsovaný. `app/` hotová: přehled, katedra, osoba, hledání bez diakritiky, historie verzí (kdo přibyl a zmizel), statistiky bez jmen. Telefony jsou ve výchozím stavu skryté.
- Pages nasazené s demem: https://themolx.github.io/famaci/
- `v2/` je funkční prototyp: přihlášení odkazem, profily, převzetí archivního záznamu („To jsem já“), projekty, štábová listina (tisk, CSV, JSON), API s Bearer klíčem, audit log. Na Pages neběží.
- Firebase ani jiná cloudová služba se zatím nepoužívá, záměrně.
- **Nový směr (20. 11. 2026, větev `frontend`):** zadání v `docs/struktura-webu.md`, GDPR texty v `docs/gdpr-zasady-a-souhlas.md` jsou s ním sladěné. `v2/` zatím zadání neodpovídá (viz kap. 7).

## 7. Zadání nové verze (shrnutí `docs/struktura-webu.md`)

- **Rozsah:** neveřejný adresář jen **studentů FAMU** (ne celá AMU, ne zaměstnanci). Absolventi zůstávají, zatím bez odlišení.
- **Údaje u člověka, nic víc:** jméno, pohlaví (dobrovolné, žena / muž / jiné / neuvádím, účel obsazování rolí), ročník (= rok nástupu, např. 2024/25), katedra, e-mail (školní), telefon (dobrovolný). Bez fotky.
- **Stránky:** statická homepage · přihlášení odkazem na školní e-mail · první přihlášení (krok 1 pravidla, krok 2 profil a souhlasy) · seznam `/lide` (vlevo katedry s počty, vpravo studenti po ročnících od nejnovějšího, textové hledání bez diakritiky, filtry katedra, ročník, pohlaví) · detail studenta (telefon a e-mail až tady, ne v seznamu) · úprava profilu · nastavení (souhlasy, skrýt / smazat profil, stažení vlastních dat) · `/ochrana-soukromi`.
- **Hlavička po přihlášení:** vlevo logo a menu, vpravo kolečko s iniciálami a šipka, rozbalí nabídku Upravit profil / Nastavení / Odhlásit.
- **Patička na každé stránce** s odkazem na ochranu soukromí (GDPR), nahlášení zneužití a kontakt na správce.
- **Z v2 se nepřebírá:** projekty, štábové listiny, CSV/JSON export, API klíče, archiv starých Famáků (ani import do adresáře), alergie, role ve štábu, showreel, poznámka.
- **GDPR pravidla pro kód:** souhlasy nikdy předem zaškrtnuté, každý volitelný údaj má vlastní souhlas, evidence souhlasu (kdo, kdy, verze podmínek, rozsah), žádný hromadný export, zobrazení kontaktu se loguje, kontrola domény na serveru přesnou shodou, roční připomínka bez automatického skrytí.
- **Otevřené:** povolené e-mailové domény FAMU (ověřit u IT AMU), přesný seznam kateder v levém menu, kdo je správce údajů, ověření totožnosti absolventa při žádosti o smazání, zastarávání telefonů absolventů.

## 8. Otevřené otázky (rozhoduje Martin, nestav bez jeho souhlasu)

1. **Jádro 2.0:** zadání z 20. 11. 2026 počítá s adresářem studentů FAMU (kap. 7), bez komunity a archivu.
2. **Kdo to provozuje:** studenti kurzu, Katedra produkce jako dřív, nebo FAMU oficiálně? Od toho se odvíjí správce údajů v GDPR dokumentu.
3. **Vazba na kurz** vibe codingu na FAMU: studentský projekt, ukázka, nebo skutečná služba?
4. **Stará data:** zadání z 20. 11. 2026 je do nové verze neimportuje. `v2` je zatím importuje jako záznamy k převzetí, to se má odstranit.
5. ~~Role produkce jako správce ve v2~~ a 6. ~~převzetí archivního záznamu~~: odpadají, nová verze nemá projekty ani archivní záznamy.
7. Provoz naostro: přenos na Supabase nebo podobné (magický odkaz, pravidla řádků), konzultace s pověřencem pro ochranu osobních údajů AMU, SMTP neotestované.

## 9. Styl a pravidla práce

- UI a dokumentace česky, kód a commit message klidně anglicky.
- **Žádné dlouhé pomlčky (U+2014)** nikde, ani v UI, ani v souborech, ani v odpovědích. Místo nich čárka, tečka nebo `·`.
- `app/` bez externích knihoven, fontů, CDN a analytiky. Musí fungovat offline a z podsložky (`/famaci/` na Pages), takže jen relativní cesty.
- Práce ve větvích, PR do `main`. Merge do `main` nasazuje Pages.
- Nejdřív navrhni, pak stav. U větších rozhodnutí (viz kap. 8) se zeptej.
- Při změně rozsahu údajů nebo stránek uprav oba dokumenty v `docs/` současně, ať si neodporují.
- Pre-commit kontrolu zapni po klonu: `git config core.hooksPath .githooks`.
- Python spouštěj s `-I` (izolovaný režim), jak je v příkazech výše.
