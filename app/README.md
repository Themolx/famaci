# Famáci 2.0 · lokální archiv

Statická webová appka nad archivem famaci.estranky.cz (Wayback Machine, 2008 až 2025). Bez databáze, bez backendu, bez externích knihoven, fontů a analytiky.

> **Osobní údaje.** Skutečná data (`app/data/`) obsahují jména a telefony studentů a zůstávají jen na tvém počítači, `.gitignore` je vylučuje. Do gitu a na GitHub Pages jde jen kód a smyšlená demo data z `demo/` (viz hlavní README).

## Spuštění

1. Sestavit data (jen standardní knihovna Pythonu, čte `../data/extracted`, nic v ní nemění):

   ```bash
   python3 -I app/build_data.py
   ```

2. Spustit lokální server. V aplikaci Claude přes launch config `famaci` (`.claude/launch.json`, port 8790), nebo ručně:

   ```bash
   python3 -I -m http.server 8790 --bind 127.0.0.1 --directory app
   ```

   a otevřít `http://localhost:8790`. Přes `file://` to nepojede (prohlížeč nedovolí `fetch` JSONu).

## Soubory

| Soubor | Co |
|---|---|
| `build_data.py` | build: archiv → `data/famaci.json`, `data/versions.json`, `data/stats.txt` |
| `index.html`, `style.css`, `app.js` | celá appka, hash routing, CSP povoluje jen `'self'` |
| `data/famaci.json` | katedry, verze stránek, osoby s historií výskytů, neroztříděné řádky |
| `data/versions.json` | text každé verze po řádcích (pro historii a fulltext), načítá se až když je potřeba |
| `data/stats.txt` | report buildu, jen počty |

## Co appka umí

- **Přehled**: 14 kateder a programů, mapa „katedra × rok nástupu“ a mapa „katedra × rok snímku“ (všechny archivované roky: 2008, 2009, 2011, 2013 až 2025; v letech 2010 a 2012 Wayback nic nezachytil).
- **Katedra**: osoby po ročnících, filtr ročníku, filtr textu, „jen s kontaktem“, u každého v kolika verzích se objevil (tečky = verze stránky), dole neroztříděné řádky.
- **Osoba**: všechny kontakty, jiné zápisy jména, seznam verzí s odkazy do historie a na Wayback.
- **Hledat**: bez diakritiky, všechna slova musí sedět; osoby a pod nimi fulltext přes surový text všech verzí.
- **Historie**: pro každou stránku (i úvodní) seznam verzí, kdo přibyl a kdo zmizel proti předchozí verzi, celý text verze, odkaz na Wayback.
- **Statistiky** (nápad E z BRAINSTORM.md, „historie bez jmen“): počty podle roku nástupu, růst stránek v čase, souhrnná tabulka. Bez osobních údajů.
- **Soukromí v UI**: telefony, e-maily a odkazy jsou při každém načtení skryté (•••), přepínač „Ukázat kontakty“ se neukládá. Dokud jsou skryté, nehledá se podle čísel. Žlutý pruh „Pouze lokálně · osobní údaje“ je vidět pořád.

## Co se parsuje a co zůstává surové

Výsledek posledního buildu (`data/stats.txt`): 271 verzí stránek (250 kateder a programů, 21 úvodní stránky), 20 718 záznamů napříč verzemi, z nich **1 697 různých osob** (katedra + jméno + ročník), 1 519 s telefonem, 69 s e-mailem. **91 řádků zůstalo surových.**

Parser projde každou verzi jako jeden proud řádků (textové bloky i řádky tabulek) a drží stav: aktuální ročník, úroveň studia, program. Rozpozná:

- nadpisy ročníků: `Ročník 13/14`, `ročník 2019/20`, `Ročník 2019/2020`, `1.ročník 10/11`, `první ročník 12/13`, `APP 2019/2020`, `PTS 2021/2022`, `2017 year CDM documentary`, `3rd year CDM directing`, i nadpis vlepený do první buňky tabulky („Katedra kamery ročník 10/11 …“);
- sloupce se detekují po buňkách, ne podle pozice: buňka je telefon, e-mail, odkaz, nebo text (jméno). Funguje pro 1, 2 i 3 sloupce, jméno a telefon v jedné buňce, příjmení a jméno v opačném pořadí;
- jméno, příjmení a telefon na samostatných řádcích (svislé vložení z Wordu), slova rozbitá formátováním („Št“ + „ě“ + „pánková“), e-mail rozdělený na „uživatel“ + „@“ + „doména“;
- 2011: celé sloupce vložené do jedné buňky. Rozdělí se, když počty sedí (58 záznamů, v UI označené jako „Rozděleno ze sloučené buňky“);
- úrovně studia (Bakalářské, Magisterské) a obory u mezinárodních programů (Camera, Directing…);
- šablonu eStránek (menu, reklama, patička, úvodní věta) zahazuje, 823 prvků.

Surově (v UI „Neroztříděné řádky“ dole na stránce katedry) zůstává:

- 56 nerozpoznaných řádků: zbytky slov, podtržítka místo jména, osamocená písmena;
- 20 bloků, kde byla tabulka vložená jako text po sloupcích, ale sloupce nemají stejnou délku (KP, ročník 2009/10: 21 slov na 11 čísel, nejde poznat, komu které jméno patří). **Tenhle ročník KP proto mezi osobami chybí** a je jen v surových řádcích;
- 14 telefonů bez jména;
- 1 sloučená buňka z roku 2011, kde nesedí počty.

## Výchozí volby (BRAINSTORM.md otázky zatím nemá zodpovězené)

1. **Identita osoby** = katedra + jméno bez diakritiky se seřazenými slovy („Novák Jan“ = „Jan Novák“) + rok nástupu. Shodné jméno ve stejné katedře a ročníku je jedna osoba. Napříč katedrami se lidé nespojují.
2. **Ročník = rok nástupu**, zobrazený jako akademický rok `2013/14`. Dvouciferné roky jsou 20xx.
3. **„N. ročník“ bez roku** (2008 až 2010, a staré tabulky, které na stránkách zůstaly do 2019) se přepočítá na rok nástupu podle prvního snímku, kde se ta osoba pod tímhle „N. ročník“ objevila: akademický rok snímku minus (N − 1). Když stejné jméno má jinde výslovný ročník ±1 rok, použije se ten. Takové záznamy mají štítek „odvozeno“ (329 osob).
4. **Osoby bez nadpisu ročníku** dostanou ročník, pokud ho mají v jiné verzi; jinak „bez ročníku“ (30).
5. **Verze** = verze podle `pages.json` (stejný obsah zachycený víckrát je jedna verze s počtem snímků). `stranka/<kat>` (2008 až 2010) a `clanky/<kat>.html` (2011+) se spojují do jedné historie katedry.
6. **Mezinárodní programy** jsou čtyři samostatné „katedry“ (CINKK, APP, CDM, PTS), příjmení psaná VELKÝMI se převádí na „Velká“.
7. **Kontakty skryté vždy po načtení**, přepínač se nepamatuje. Odkaz na Wayback je obyčejný odkaz (otevře web.archive.org až po kliknutí, bez refereru).
8. **Bez frameworku a buildu frontendu**: tři statické soubory, aby to šlo spustit kdekoli offline a dalo se to číst na kurzu.

## Známé limity

- Přiřazení ročníku u „N. ročník“ je odhad, hlavně u tabulek, které se roky nepřepisovaly.
- Stejný člověk zapsaný v různých verzích s překlepem v jiném slově jména se počítá dvakrát (fuzzy spojování není).
- Archiv nemá obrázky ani úvodní stránku po roce 2019; u CAS, KK, KSS a CINKK po roce 2019 žádný snímek není.
