# Famáci 2.0 · struktura webu

Návrh, verze 0.8 (20. 11. 2026), větev `frontend`. Popisuje, jaké stránky web má, co na nich je a jak se mezi nimi chodí. Vizuální styl a technické řešení tu nejsou.

Značení: **[zadání]** = řekl uživatel, **[návrh]** = doplnil jsem já, jde změnit, **[?]** = otevřená otázka (seznam na konci).

## 0. Rozsah [zadání]

- Adresář **studentů FAMU**: v seznamu jsou jen studenti a absolventi, kteří zveřejnili profil.
- **Přístup** (účet) mají všichni s e-mailem **@famu.cz nebo @st.amu.cz**. Účet jde mít i **bez profilu**, jen na prohlížení (pedagogové, nebo kdo nechce nic sdílet).
- U každého člověka je **jen**: jméno, pohlaví, ročník, studijní obor, e-mail a telefon.
- **Pohlaví** je dobrovolné, hodnoty: žena / muž / jiné / neuvádím (výchozí). Bez vysvětlujícího textu ve formuláři. **[zadání]**
- **Ročník** = rok nástupu ve tvaru 2026/2027, nemění se. Na výběr jsou všechny ročníky od založení FAMU (1946/1947) po 2026/2027.
- **Studijní obory** (všude se mluví o studijním oboru, ne o katedře) podle sekcí původních Famáků, doplněné o Herní design a Montage, abecedně: Academy Preparation Program (APP), Animovaná tvorba (KAT), Audiovizuální studia (CAS), Cinema and Digital Media (CDM), Cinematography, master in English (CINKK), Dokumentární tvorba (KDT), Fotografie (KF), Herní design (KHD), Kamera (KK), Montage, master in English (MONTAGE), Production Team Studies (PTS), Produkce (KP), Režie (KR), Scenáristika a dramaturgie (KSD), Střihová skladba (KSS), Zvuková tvorba (KZT).
- **Profilový obrázek** = kolečko s iniciálami, profil fotku nemá.
- **Role:** každý účet má roli **uživatel** (výchozí) nebo **admin**. Role patří k účtu, ne k profilu, a rozlišuje se všude: v hlavičce, v nabídce účtu, v přístupu ke stránkám i na serveru.
- **Absolventi** v seznamu zůstávají a zatím se nijak neodlišují. Když jim zanikne školní schránka, profil zůstane vidět a upravit nebo smazat ho jde žádostí správci e-mailem. Roční ověření se na ně nevztahuje.
- Z prototypu v2 se **nepřebírá**: projekty a štábové listiny, API klíče, archiv starých Famáků, alergie. Z profilu ve v2 odpadají i role ve štábu, showreel a poznámka.

## 1. Mapa webu

```
Veřejné (bez přihlášení)
├── /                     Homepage (statická)                            [zadání]
├── /prihlaseni           Zadání školního e-mailu                        [návrh]
├── /overeni              Stránka z odkazu v e-mailu, tlačítko Přihlásit [návrh, už je ve v2]
├── /ochrana-soukromi     Zásady ochrany OÚ a pravidla užívání (GDPR)   [zadání: odkaz v patičce]
└── /nahlasit             Nahlásit zneužití (i bez přihlášení, s e-mailem pro odpověď) [zadání]

První přihlášení (jen jednou)                                            [návrh, podle GDPR dokumentu]
├── /vitej/pravidla       Krok 1: přijetí pravidel užívání (povinné)
└── /vitej/profil         Krok 2: vyplnění profilu a souhlasy (dobrovolné, jde přeskočit)

Po přihlášení
├── /lide                 Seznam studentů, všechny obory             [zadání]
├── /lide?k=kp            Seznam jednoho oboru (vybráno v levém menu) [zadání]
├── /lide/{id}            Detail studenta                             [zadání]
├── /profil               Úprava mého profilu                         [zadání: „aktualizace profilu“]
├── /nastaveni            Nastavení (souhlasy, skrytí a smazání profilu, role) [zadání]
└── odhlášení             akce v menu, ne stránka                     [zadání]

Jen role admin                                                         [zadání]
├── /admin                Seznam všech účtů, hledání a filtry
├── /admin/uzivatel/{id}  Detail účtu: role, blokace, oprava a mazání údajů, smazání účtu
├── /admin/hlaseni        Nahlášení zneužití: Nová / Vyřešená / Všechna       [zadání]
├── /admin/hlaseni/{id}   Detail nahlášení, odpověď e-mailem, uzavření      [zadání]
└── /admin/zaznam         Záznam změn: každý zásah admina s důvodem
```

Kdo není přihlášený a otevře stránku z části „Po přihlášení“, skončí na `/prihlaseni` a po přihlášení se vrátí tam, kam chtěl. **[návrh]**

## 2. Společné prvky

### Hlavička (po přihlášení) [zadání]

```
┌──────────────────────────────────────────────────────────────────────┐
│ Famáci 2.0    Lidé                                         (JN) ▾    │
└──────────────────────────────────────────────────────────────────────┘
                                                   ┌─────────────────────┐
                                                   │ Jan Novák           │
                                                   │ jan.novak@famu.cz   │
                                                   │─────────────────────│
                                                   │ Upravit profil      │
                                                   │ Nastavení           │
                                                   │─────────────────────│
                                                   │ Odhlásit            │
                                                   └─────────────────────┘
```

- Vlevo logo (odkaz na `/lide`) a menu „Lidé“. Admin má v menu navíc „Administrace“. **[zadání]**
- Vpravo profilový obrázek a šipka dolů, po kliknutí rozbalovací nabídka: aktualizace profilu, nastavení, odhlášení. **[zadání]**
- Profil fotku nemá, proto je „profilový obrázek“ kolečko s iniciálami. **[zadání]**
- Kdo profil nemá, má v nabídce místo „Upravit profil“ položku „Vytvořit profil“. **[návrh]**
- Admin má v nabídce štítek „Admin“ a položku „Administrace“. **[návrh]**
- Nabídka se zavírá klikem mimo ni a klávesou Esc a jde ovládat z klávesnice. **[návrh]**

### Hlavička (veřejné stránky) [návrh]

Logo a vpravo tlačítko „Přihlásit se“ (po přihlášení „Do adresáře“).

### Patička (na všech stránkách) [zadání]

```
Famáci 2.0 · Ochrana soukromí a pravidla · Nahlásit zneužití kontaktu · Kontakt na správce
```

- Odkaz „Ochrana soukromí“ vede na `/ochrana-soukromi` s textem z `docs/gdpr-zasady-a-souhlas.md`, oddíl „Informace o zpracování osobních údajů a pravidla užívání“. **[zadání]**
- „Nahlásit zneužití“ vede na formulář `/nahlasit` (popis, koho se to týká, e-mail pro odpověď), funguje i bez přihlášení. „Kontakt na správce“ je e-mail správce. **[zadání]**
- Na veřejných i neveřejných stránkách je patička stejná. **[návrh]**

## 3. Stránky

### 3.1 Homepage `/` [zadání: statická]

Je pro lidi, kteří přišli poprvé: co to je, pro koho je to určené a jak se dostat dovnitř. Nejsou na ní žádná jména ani čísla, ani ukázkově. **[návrh]**

```
┌──────────────────────────────────────────────┐
│ Famáci 2.0                     [Přihlásit se]│
├──────────────────────────────────────────────┤
│  Kontakty na studenty FAMU, na jednom místě. │
│                                              │
│                 [Přihlásit se školním mailem]│
│                                              │
│  Jak to funguje                              │
│  1. Přihlásíš se školním e-mailem            │
│  2. Vyplníš si profil (nemusíš)              │
│  3. Hledáš lidi podle oboru a ročníku        │
│                                              │
│  Soukromí: vidí to jen studenti FAMU,        │
│  zapisuješ se sám a kdykoli se smažeš.       │
│                                              │
│  Trocha historie: Famáci 2008 až 2025        │
├──────────────────────────────────────────────┤
│ patička                                      │
└──────────────────────────────────────────────┘
```

- „Statická“ chápu tak, že obsah je pevný text a nemění se podle databáze. Žádné počty uživatelů ani novinky. **[návrh]**
- Přihlášeného uživatele homepage nepřesměruje, jen tlačítko změní na „Do adresáře“. **[návrh]**
- Texty homepage se napíšou později.

### 3.2 Přihlášení `/prihlaseni` a ověření `/overeni` [návrh, přebírá se z v2]

1. Pole pro školní e-mail a tlačítko „Poslat přihlašovací odkaz“. Pod ním jsou povolené domény @famu.cz a @st.amu.cz. **[zadání]**
2. Potvrzení „Odkaz jsme poslali na …, platí 24 hodin“. Texty jsou v GDPR dokumentu.
3. Odkaz z e-mailu otevře `/overeni` s tlačítkem „Přihlásit“, aby odkaz nespotřeboval náhled v poštovním programu (tak to dělá už v2).
4. Při prvním přihlášení uživatel pokračuje na `/vitej/pravidla`, jinak na `/lide`.

### 3.3 První přihlášení `/vitej/...` [návrh podle GDPR dokumentu]

- **Krok 1, pravidla:** zaškrtávací políčko „Přečetl/a jsem si … a zavazuji se kontakty používat jen …“ (text je v GDPR dokumentu). Bez něj se do adresáře nedostane.
- **Krok 2, volba:** dvě stejně výrazné možnosti. „Vytvořit profil“ rozbalí formulář jako v `/profil` s oddělenými souhlasy. „Jen prohlížet“ založí účet bez profilu (pedagogové, kdo nechce nic sdílet), profil jde vytvořit kdykoli později z nabídky účtu. **[zadání]**

### 3.4 Seznam studentů `/lide` [zadání]

```
┌───────────────┬─────────────────────────────────────────────────────┐
│ Obory         │ Hledat: [jméno nebo e-mail…              ]          │
│               │ Ročník [vše ▾]  Pohlaví [vše ▾]           ✕ Zrušit  │
│ ● Všechny  312│                                                     │
│   Produkce  58│ Zobrazeno 58 studentů · Produkce                    │
│   Režie     41│                                                     │
│   Kamera    37│ ── Ročník 2025/26 ─────────────────────────── 12 ── │
│   Střih     22│ (JN) Jméno Příjmení   Produkce · 2025/26 · žena     │
│   Zvuk      19│ (PK) Jméno Příjmení   Produkce · 2025/26 · muž      │
│   …           │ …                                                   │
│               │ ── Ročník 2024/25 ─────────────────────────── 15 ── │
│               │ (AB) …                                              │
└───────────────┴─────────────────────────────────────────────────────┘
```

- **Levé menu:** 16 studijních oborů (viz kapitola 0) s počtem studentů, nahoře „Všechny“. Kliknutím se vybere obor a seznam vpravo se přefiltruje. **[zadání]**
- **Pravá část:** seznam seskupený podle ročníku nástupu, nejnovější nahoře. Uvnitř ročníku řazení podle příjmení. **[zadání: řazení podle ročníků; abeceda uvnitř je návrh]**
- **Řádek:** iniciály, jméno, studijní obor, ročník, pohlaví (pokud ho člověk uvedl). **Telefon a e-mail v seznamu nejsou**, ukážou se až v detailu. Tak to chce GDPR dokument kvůli ochraně proti vytěžení. **[návrh]**
- **Textové hledání:** hledá ve jméně a e-mailu, nezáleží na diakritice ani velikosti písmen („novak“ najde „Novák“), výsledky se mění při psaní. **[zadání: textové hledání; rozsah a chování jsou návrh]**
- **Filtry:** studijní obor (levé menu), ročník, pohlaví (vše / žena / muž / jiné; kdo pohlaví neuvedl, ukáže se jen při „vše“). Filtry jdou kombinovat a hledání se uplatní na výsledek filtrů. **[zadání; chování „neuvedeno“ je návrh]**
- Stav filtrů je v adrese stránky, takže funguje tlačítko Zpět a filtr jde poslat odkazem. **[návrh]**
- Když nic neodpovídá, stránka napíše „Nikoho jsme nenašli“ a nabídne „Zrušit filtry“. **[návrh]**
- Stránkování nebo postupné načítání a limit zobrazení za hodinu, podle GDPR dokumentu. **[návrh]**
- **Na mobilu** se levé menu změní na rozbalovací výběr studijního oboru nad seznamem. **[návrh]**

### 3.5 Detail studenta `/lide/{id}` [zadání]

```
┌──────────────────────────────────────────────────────────────┐
│ hlavička s menu a (JN) ▾                                     │
├──────────────────────────────────────────────────────────────┤
│ ← Zpět na seznam                                             │
│                                                              │
│  (JN)  Jméno Příjmení                                        │
│        Produkce · ročník 2024/25 · žena                      │
│                                                              │
│  Telefon  +420 …               [zkopírovat]  [zavolat]       │
│  E-mail   …@famu.cz            [zkopírovat]  [napsat]        │
│                                                              │
│  Nahlásit zneužití profilu                                   │
├──────────────────────────────────────────────────────────────┤
│ patička                                                      │
└──────────────────────────────────────────────────────────────┘
```

- „← Zpět na seznam“ vrací na seznam se stejnými filtry a na stejné místo. **[návrh]**
- Zobrazí se jen údaje, ke kterým dal člověk souhlas. Zobrazení detailu se zaznamená (kdo, koho, kdy), jak říká GDPR dokument. **[návrh]**
- Na vlastním detailu je místo „Nahlásit“ tlačítko „Upravit profil“. **[návrh]**

### 3.6 Úprava profilu `/profil` [zadání: „aktualizace profilu“]

| Pole | Povinné | Poznámka |
|---|---|---|
| Jméno a příjmení | ano | |
| Studijní obor | ano | výběr ze seznamu 16 studijních oborů |
| Ročník | ano | rok nástupu, výběr 2026/2027 až 1946/1947 |
| E-mail | ano | školní e-mail, kterým se přihlašuje, nejde měnit **[návrh]** |
| Telefon | ne | předvolba ze seznamu všech zemí (abecedně podle českého názvu, u každé vlajka a předvolba, hledání podle názvu i čísla, výchozí Česko +420) a číslo; u Česka a Slovenska přesně 9 číslic. Vložené číslo s +/00 přepne předvolbu samo. Vlastní souhlas se zveřejněním. **[zadání: předvolba se seznamem a vlajkami]** |
| Pohlaví | ne | žena / muž / jiné / neuvádím (výchozí), vlastní souhlas, bez vysvětlujícího textu |

Odkaz „Jak bude můj profil vypadat“ otevře vlastní detail. **[návrh]**

### 3.7 Nastavení `/nastaveni` [zadání]

**[návrh, většinu vyžaduje GDPR dokument]**
- Moje souhlasy: co je zveřejněné, kdy a v jaké verzi podmínek. Každý souhlas jde vypnout.
- U účtu bez profilu vysvětlení „Adresář prohlížíš, ale nikdo tě v něm nenajde“ a tlačítko „Vytvořit profil“.
- Skrýt profil (dočasně zmizí z adresáře) a smazat profil (natrvalo).
- Stáhnout moje údaje (JSON), kvůli právu na přenositelnost.
- Odhlásit na všech zařízeních.
- Role účtu (jen ke čtení, mění ji admin).
- Zrušit účet.

### 3.8 Administrace `/admin` [zadání: jen pro roli admin]

Kdo nemá roli admin, dostane na adresách `/admin…` stránku „Sem nemáš přístup“. **[návrh]**

**Seznam účtů `/admin`:** tabulka všech účtů včetně těch bez profilu (účet, obor a ročník, role, stav, registrace, poslední přihlášení). Hledání podle jména a e-mailu, filtry Všechny / Se zveřejněným profilem / Bez profilu / Skrytý profil / Zablokované / Admini s počty, řazení podle posledního přihlášení, registrace nebo jména. **[zadání: seznam všech uživatelů; filtry návrh]**

**Detail účtu `/admin/uzivatel/{id}`:** **[zadání: měnit nastavení, mazat údaje i účty]**
- Účet: **změna přihlašovacího e-mailu** (stejná pravidla jako registrace: jen @famu.cz nebo @st.amu.cz, přesná shoda domény, adresa nesmí mít jiný účet; upozornění na starou i novou adresu), datum registrace a posledního přihlášení, **role** (uživatel / admin), **zablokovat / odblokovat**. **[zadání]**
- Profil: oprava jména, studijního oboru a ročníku, **změna a smazání telefonu** (změnit jde jen zveřejněné číslo, přidat nové může jen uživatel se souhlasem), smazání pohlaví, skrytí a zobrazení profilu, smazání profilu. **[zadání: měnit telefony; omezení u přidání čísla je návrh kvůli souhlasu]**
- Souhlasy jen ke čtení: admin je zapnout nemůže. **[návrh, kvůli GDPR]**
- Smazání celého účtu.
- Historie zásahů u tohoto účtu.
- Každý zásah se potvrzuje v dialogu s povinným **důvodem**. **[návrh]**
- Profil skrytý samotným uživatelem admin znovu zobrazit nemůže. Uživatel v nastavení vidí, že mu profil skryl admin, a proč. **[návrh]**
- Musí zůstat aspoň jeden aktivní admin, posledního admina nejde degradovat, zablokovat ani smazat. **[návrh]**
- Vlastní účet admin v administraci nezablokuje ani nesmaže, to dělá v nastavení. **[návrh]**

**Nahlášení `/admin/hlaseni`:** **[zadání: seznam hlášení o zneužití, e-mail pro odpověď]**
- Nahlášení přichází ze dvou formulářů: tlačítko „Nahlásit zneužití profilu“ v detailu člověka (dialog) a stránka `/nahlasit` z patičky. Oba mají povinný **e-mail pro odpověď** (předvyplněný přihlašovacím, jde změnit) a popis aspoň pár slov.
- Seznam s filtry Nová / Vyřešená / Všechna a počty. Počet nových je i u „Administrace“ v horní liště a na záložce.
- Detail: text, kdy přišlo, od koho (e-mail, případně přihlášený účet), koho se týká (odkaz do správy účtu).
- **Odpověď:** pole „Komu“ (e-mail z nahlášení) a text, tlačítko „Odeslat odpověď a vyřešit“. Odpověď odejde e-mailem a uloží se k nahlášení. Druhá možnost je „Napsat ve vlastní poště“ (mailto) nebo „Uzavřít“ bez odpovědi s důvodem. Vyřešené jde „Znovu otevřít“.
- Odpověď i uzavření se zapisují do záznamu změn. **[návrh]**

**Záznam změn `/admin/zaznam`:** všechny zásahy adminů (kdy, kdo, co, u kterého účtu, důvod). Nejde upravit ani smazat. **[návrh]**

Z detailu člověka v adresáři vede adminovi odkaz „Spravovat v administraci“. **[návrh]**

### 3.9 Ochrana soukromí `/ochrana-soukromi` [zadání: odkaz z patičky]

Je veřejná a čitelná i bez přihlášení, aby si ji člověk mohl přečíst před registrací. Obsahuje text podmínek z GDPR dokumentu s verzí a datem účinnosti. **[návrh]**

## 4. Dopady na GDPR dokument a v2

`docs/gdpr-zasady-a-souhlas.md` je od 20. 11. 2026 upravený podle kapitoly 0 (hotovo):
- celá AMU a zaměstnanci → jen studenti FAMU; povolené domény zúžit na FAMU;
- přidat pohlaví (dobrovolné, vlastní souhlas);
- vyřadit profilovou fotku a další e-mail;
- **absolventi zůstávají**: roční ověření a skrytí po neověření se na ně nevztahuje, úprava a smazání po zániku schránky jde jen žádostí správci e-mailem. Upravit oddíly 6 a 7 a technická opatření.

Ve v2 to znamená odebrat projekty, štábové listiny, API, archiv, alergie, role, showreel a poznámku a přidat pohlaví.

## 5. Otevřené otázky

1. **Kdo bude admin:** jmenovitě, a kolik jich má být.
2. **Adresy @st.amu.cz:** pokud je mají i studenti DAMU a HAMU, mohou se registrovat a prohlížet adresář. Ověřit u IT AMU a případně rozhodnout, zda to vadí.

### Rozhodnuto (20. 11. 2026)

- Role uživatel a admin, administrace se seznamem všech účtů, úpravou a mazáním údajů i účtů.
- Nahlášení zneužití chodí do administrace, formuláře mají e-mail pro odpověď a admin odpovídá z administrace.
- Přístup pro adresy @famu.cz a @st.amu.cz, účet jde mít i bez profilu (jen prohlížení).
- Rozsah: jen studenti FAMU, údaje jméno, pohlaví, ročník, studijní obor, e-mail, telefon.
- Z v2 se nepřebírají projekty, štábové listiny, API, archiv ani alergie.
- Pohlaví dobrovolné, hodnoty žena / muž / jiné / neuvádím, bez vysvětlujícího textu.
- Ročník = rok nástupu, tvar 2026/2027, od 1946/1947.
- Místo kateder studijní obory: 14 sekcí z archivu Famáků (10 českých, CINKK, APP, CDM, PTS) plus Herní design (KHD) a Montage.
- Profilový obrázek = iniciály, bez fotky.
- Absolventi zůstávají bez odlišení, po zániku schránky se mažou žádostí e-mailem.

## 6. Mimo rozsah tohoto dokumentu

Grafický návrh (barvy, písmo), technologie (zda zůstane Python + SQLite z v2, nebo se přejde jinam) a texty homepage.
