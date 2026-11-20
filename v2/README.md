# Famáci 2.0 · lokální prototyp adresáře

Adresář studentů s přihlášením přes školní e-mail, editovatelnými profily, projekty, štábovou listinou a API. Běží jen na tomhle počítači: Python (jen standardní knihovna) + SQLite, server poslouchá na `127.0.0.1`.

> **Osobní údaje.** Databáze obsahuje archiv starých Famáků (jména, telefony) a nově zadané údaje včetně alergií. Kód je v gitu, data ne (`.gitignore` vylučuje `v2/data/`, `v2/outbox/` a `*.db`). v2 je serverový prototyp a na GitHub Pages neběží, nic z něj nenasazovat. Pro vývoj bez skutečných dat: `mkdir -p app/data && cp demo/*.json app/data/`.

## Spuštění

```bash
python3 -I v2/server.py
```

nebo launch config `famaci-v2` (`.claude/launch.json`), pak `http://localhost:8791`. Při prvním běhu se založí `v2/data/famaci.db` a naimportuje archiv z `app/data/famaci.json` (ten musí existovat: `python3 -I app/build_data.py`). Nová databáze od nuly: `python3 -I v2/server.py --reset`.

## Přihlášení a maily

1. Člověk zadá školní e-mail. Projdou jen domény z `FAMACI_DOMAINS` (výchozí `famu.cz,amu.cz`, včetně subdomén typu `f.amu.cz`).
2. Server pošle jednorázový odkaz platný 15 minut (na jednu adresu nejvýš jednou za 30 s).
3. Odkaz otevře stránku s tlačítkem „Přihlásit“, takže ho nespotřebuje náhled v poštovním programu. Po kliknutí dostane prohlížeč session cookie (HttpOnly, 30 dní).

**Bez nastaveného SMTP se nic neodesílá.** Mail se uloží do `v2/outbox/`, vypíše se do konzole serveru a je vidět na `http://localhost:8791/dev/outbox`. Skutečné odesílání zapneš proměnnými:

```bash
FAMACI_SMTP_HOST=smtp.example.cz FAMACI_SMTP_PORT=587 FAMACI_SMTP_USER=… FAMACI_SMTP_PASS=… FAMACI_MAIL_FROM=famaci@… python3 -I v2/server.py
```

(STARTTLS. Odkazy v mailu staví z `FAMACI_BASE_URL`, výchozí `http://localhost:8791`.)

## Profily a párování

- **Identita = školní e-mail.** Upravit nebo smazat profil může jen ten, kdo je přihlášený tím e-mailem, který je u profilu v databázi.
- **Archiv k převzetí:** 1 697 osob ze starých Famáků je v databázi jako nepřevzaté záznamy (bez e-mailu, označené „archiv“). Po prvním přihlášení appka nabídne záznamy podle jména z adresy (`jan.novak@…` → Jan Novák) nebo podle stejného e-mailu v archivu, a jde v nich hledat. „To jsem já“ záznam převezme: dostane tvůj e-mail a dál ho upravuješ jen ty.
- Převzít jde jen nepřevzatý záznam a jen jeden na e-mail. Každé převzetí, úprava a smazání se zapisuje do tabulky `audit`.
- Kdo se v archivu nenajde, založí si nový profil.
- **Profil:** jméno, katedra, ročník, role ve štábu (seznam + vlastní), telefon, kontaktní e-mail, showreel, alergie / strava, poznámka.
- **Alergie** vidí všichni přihlášení (tak jsi to zvolil). Vyplnit je jde jen se zaškrtnutým souhlasem, čas souhlasu se ukládá, smazáním textu údaj zmizí.
- Telefony a e-maily z archivu (nepřevzaté záznamy) jsou v seznamu skryté (•••), ukážou se až po kliknutí. U ověřených profilů je vidět, co člověk sám vyplnil.

## Projekty a štábová listina

- Projekt založí kdokoli přihlášený: název, typ, termín natáčení, místo, popis. Zakladatel se automaticky přidá jako „Produkce“.
- Štáb: vyhledáš člověka (i archivní záznam), dáš mu roli a poznámku (call time, scény). Projekt a štáb upravuje zakladatel a lidé označení „produkce“. Smazat projekt může jen zakladatel.
- **Štábová listina:** tisknutelná stránka (role, jméno, telefon, e-mail, alergie, poznámka), export CSV (středník, UTF-8 s BOM, otevře se v Excelu) a JSON.

## API

Osobní klíč se vytváří na stránce **API** (ukáže se jen jednou, v DB je jen jeho hash). Volání s hlavičkou `Authorization: Bearer fam_…` mají stejná práva jako majitel klíče. Klíčem nejde vytvořit další klíč.

| Metoda | Cesta | Co |
|---|---|---|
| GET | `/api/me` | kdo jsem, můj profil (bez profilu i návrhy z archivu) |
| GET | `/api/meta` | katedry a role |
| GET | `/api/profiles?q=&role=&dept=&cohort=&source=verified\|archive&limit=&offset=` | adresář |
| GET / PUT / DELETE | `/api/profiles/{id}` | profil (úprava a smazání jen vlastního) |
| POST | `/api/profiles` | založit vlastní profil |
| POST | `/api/profiles/{id}/claim` | převzít archivní záznam |
| GET / POST | `/api/projects` | projekty |
| GET / PUT / DELETE | `/api/projects/{id}` | projekt se štábem |
| POST / PUT / DELETE | `/api/projects/{id}/members[/{mid}]` | štáb |
| GET | `/api/projects/{id}/crew`, `/crew.csv` | štábová listina |
| GET / POST / DELETE | `/api/tokens[/{id}]` | moje API klíče |

```bash
curl -H "Authorization: Bearer fam_…" http://localhost:8791/api/projects/1/crew
```

Zápisy z prohlížeče musí být JSON a ze stejného originu (ochrana proti CSRF), API klíč to nepotřebuje.

## Archiv

Původní archivní appka (`app/`) je pod `/archiv/`, jen pro přihlášené. Server z `app/` vydává jen `index.html`, `app.js`, `style.css` a dva datové soubory.

## Ověřeno (13. 11. 2026)

curl a Python test proti běžícímu serveru: cizí doména 400, odkaz jde použít jen jednou, bez přihlášení 401 a archiv 302, CSRF 403, alergie bez souhlasu 400, cizí profil 403, dvojí převzetí 409, štáb může upravovat jen produkce, CSV hlavičky, Bearer klíč, path traversal 404, odhlášení. V prohlížeči: celý tok od přihlášení přes outbox, převzetí, vytvoření profilu s rolemi a alergiemi, projekt, přidání do štábu, listina, API klíč. Konzole čistá, požadavky jen na localhost. Testovací databázi i outbox jsem pak smazal, při dalším startu vznikne čistá DB jen s archivem.

## Známá omezení prototypu (další kroky)

- **Převzetí archivu se neověřuje** jinak než přihlášením: kdokoli se školním mailem si může převzít cizí nepřevzatý záznam. Prototyp to jen loguje. Chybí admin, který převzetí vrátí, a tlačítko „nahlásit“.
- Žádná role admina, žádná moderace, žádné notifikace (třeba „přidali tě do štábu“).
- Odesílání přes SMTP jsem nezkoušel se skutečným serverem.
- Statický server Pythonu je na ukázku, ne na provoz. Pro skutečnou službu by se to dalo přenést na Supabase (přihlášení magickým odkazem, pravidla řádků, REST API) a vyřešit GDPR, hlavně u alergií a importu archivu.
