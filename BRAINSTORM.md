# Famáci 2.0 · brainstorm

Stav k 13. 11. 2026. Rozhovor s Martinem, zatím se nic nestaví.

**Pravidlo soukromí:** staré stránky obsahují skutečná jména a telefony studentů. Tady se o lidech mluví jen podle role nebo počtem. Data se nikam nenahrávají a nová verze je bez souhlasu nezveřejní (GDPR).

---

## 1. Co byl starý web (z Wayback Machine)

Zdroj: `data/cdx_www.json` (494 záznamů, 30 URL), všech 274 verzí v `data/raw/` a jejich rozbor v `data/extracted/` (`pages.json`). Ověřeno nad kompletní sadou 13. 11.

**Platforma:** eStránky.cz, kódování windows-1250, od 2013 s reklamami eStránek v patičce i v obsahu.

**Účel (věta z úvodu, beze změny 2008 až 2019):** shromažďovat a aktualizovat kontaktní údaje současných studentů FAMU.

### Vývoj

| Období | Co se dělo |
|---|---|
| 2008 až 2010 | Stránky `/stranka/<katedra>`. Úvod s jednou větou a seznamem 10 sekcí: 9 kateder (KP, KAT, KDT, KF, KK, KR, KSD, KSS, KZT) a Centrum audiovizuálních studií. V menu jen odkaz na FAMU a vyhledávání. Málo snímků (1 až 8 na stránku). |
| 2011 | Přechod na `/clanky/<katedra>.html`, stejných 10 sekcí. |
| 2013 až 2014 | Nová šablona eStránek s reklamou. Přibyla patička „opravy a úpravy hlásit Katedře produkce, 1. ročník" a odkaz „Studijní materiály ke stažení" na Google Drive. |
| 2017 | Čtyři anglické stránky pro mezinárodní programy: CINKK (Cinematography master in English), Academy Preparation Program, Cinema and Digital Media Program, Production Team Studies. |
| 2017 až 2019 | Nejvíc snímků (81, 142 a 126 za rok), web byl evidentně živý. |
| srpen 2019 | Adresy přes http začaly vracet 301. **Jen přechod na https, ne konec webu.** |
| 2020 až 2025 | **Web žil dál a ročníky přibývaly.** Nejnovější ročník 2024/25 je na stránkách KF, KP a KZT (snímky z jara 2025). KAT, KDT, KR a KSD mají poslední snímek s ročníky 2020/21 až 2022/23, u CAS, KK, KSS a CINKK po roce 2019 žádný snímek není, takže nevíme. Mezinárodní Academy Preparation Program narostl z 26 řádků (2019) na 171 (2025). Úvodní stránka po roce 2019 zachycená není. Podle zadání je dnes web smazaný. |

### Jak vypadala stránka katedry

- Ručně dělané tabulky, **jedna tabulka na ročník** (nadpis typu „Ročník 13/14"). Nový ročník se přidával nahoru a staré zůstávaly, takže stránka byla zároveň archivem absolventů.
- Řádek = jméno, příjmení, telefon. Výjimečně odkaz na osobní web. Na českých stránkách skoro žádné e-maily.
- Formát se mezi ročníky lišil (2 nebo 3 sloupce, telefon ve stejné buňce se jménem, nedělitelné mezery), každý ročník psal někdo jiný.
- 2008 až 2010 to byla jedna velká tabulka na katedru (15 až 94 řádků). Ročníky jako samostatné tabulky jsou od 2011.
- Růst: stránky kateder mají v posledních verzích 9 až 14 tabulek a 25 až 184 řádků. Největší je Produkce, v roce 2025 přes 400 telefonních čísel na jedné stránce.
- Mezinárodní programy (2017+) měly jiný formát: seznam, příjmení velkými písmeny, **s e-maily** (15 až 26 adres na stránku) i telefony. České stránky e-maily skoro nemají.
- Obrázky článků archivované nejsou, jen dvě loga.

### Co z toho plyne

- Byl to **telefonní seznam pro skládání štábů**: produkce potřebuje sehnat kameramana, zvukaře, střihače z jiného ročníku a katedry.
- Provozovali ho sami studenti, údržbu měl tradičně 1. ročník produkce. Žádná instituce za tím nestála.
- Fungoval 17 let (2008 až alespoň jaro 2025) na zastaralé platformě, bez přihlášení. Potřeba tedy trvá dodnes, Famáci nezanikli kvůli tomu, že by je nikdo nepoužíval.
- Souhlas se zveřejněním se nikde neřešil, data kdokoli zadal za ostatní, nikdy se nemazala. Přesně tohle 2.0 nesmí opakovat.

---

## 2. Otázky na začátek (čekají na Martina)

1. **Jádro:** najít lidi do štábu (adresář a nástěnka), nebo něco širšího (komunita, alumni, archiv)?
2. **Kdo to provozuje:** Martin, studenti kurzu, Katedra produkce jako dřív, nebo FAMU oficiálně?
3. **Kurz:** studentský projekt v Bloku 2, ukázka, kterou Martin postaví s nimi, nebo reálná služba?
4. **Stará data:** nepoužít vůbec, jen anonymní statistiky (počty po katedrách a ročnících), nebo stránka o historii bez jmen?

---

## 3. Nápady (zatím nerozhodnuté)

### A · Adresář s opt-in (doporučuju jako jádro)
- Každý se zapíše sám: katedra, ročník, role (kamera, zvuk, střih, produkce…), odkaz na showreel nebo portfolio.
- Přihlášení jen s adresou FAMU (magický odkaz na e-mail), kontakty vidí jen přihlášení studenti, ne celý internet.
- Kontakt přes zprávu nebo tlačítko „chci se ozvat", telefon jen když ho člověk sám zveřejní.
- Platnost na jeden akademický rok, pak připomínka „pořád tu chceš být?". Navazuje na starý model ročníků a řeší mrtvé záznamy.

### B · Nástěnka štábů
- „Hledám zvukaře na cvičení 2. ročníku, natáčení 3. až 5. 12." Filtr podle role a termínu.
- Tohle starý web neuměl a dnes to nejspíš běží v Messengeru, WhatsAppu nebo na Facebooku. Otázka pro Martina: kde to studenti dělají teď?

### C · Alumni
- Absolventi zůstávají, pokud chtějí (přechod ze „studenta" na „absolventa" místo smazání). Odpovídá tomu, že staré ročníky na stránkách zůstávaly.

### D · Mezinárodní programy
- Dvojjazyčně CZ / EN od začátku. Zahraniční studenti byli na starém webu oddělení na zvláštních stránkách, v 2.0 by měli být ve stejném adresáři.

### E · Historie bez jmen
- Malá stránka „Famáci 2008 až 2019": jak web vypadal, počty zapsaných po katedrách a letech jako graf. Žádná jména ani čísla.

---

## 4. Souhlas a GDPR (návrhová podmínka, ne volba)

- Stará data se **neimportují**. Nový adresář začíná prázdný.
- Každý záznam zakládá jen jeho majitel, s jasným souhlasem, co se ukáže a komu.
- Mazání jedním tlačítkem, data exportovatelná.
- Výchozí viditelnost: jen přihlášení studenti FAMU. Veřejný profil jen na výslovné přání.
- Zvážit konzultaci s pověřencem pro ochranu osobních údajů AMU, hlavně když by to mělo nést jméno FAMU.

---

## 5. Technika (možnosti)

| Varianta | Plusy | Minusy |
|---|---|---|
| Supabase (přihlášení, databáze, pravidla přístupu) + statický frontend na Vercelu | Martin to zná z jiných projektů, přihlášení e-mailem a omezení na doménu jsou hotové věci, sedí na Blok 2 (web, GitHub, hosting) | Někdo musí hlídat účet a pravidla přístupu po skončení kurzu |
| Formulář a tabulka (Google Forms / Sheets) | Hotové za odpoledne, údržba jako dřív | Slabá kontrola přístupu, souhlas a mazání ručně |
| Oficiální řešení přes FAMU / AMU | Legitimita, přihlášení školním účtem | Pomalé, mimo ruce studentů |

Doporučení: první varianta, data v EU regionu.

---

## 6. Rozhodnutí

Zatím žádná.

## 7. Otevřené

- Odpovědi na otázky v kap. 2.
- Proč web zmizel po roce 2025 (smazaný účet, konec eStránek, nikdo ho nepřevzal?). Odpověď ovlivní, jak řešit provoz 2.0.
- Kdo ho do roku 2025 udržoval: pořád 1. ročník produkce? Mohl by to být první partner pro 2.0.
