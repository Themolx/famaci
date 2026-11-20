# Famáci 2.0 · struktura webu

Návrh, verze 0.3 (20. 11. 2026), větev `frontend`. Popisuje, jaké stránky web má, co na nich je a jak se mezi nimi chodí. Vizuální styl a technické řešení tu nejsou.

Značení: **[zadání]** = řekl uživatel, **[návrh]** = doplnil jsem já, jde změnit, **[?]** = otevřená otázka (seznam na konci).

## 0. Rozsah [zadání]

- Adresář **studentů FAMU**. Ne celá AMU a ne zaměstnanci.
- U každého člověka je **jen**: jméno, pohlaví, ročník, katedra, e-mail a telefon.
- **Pohlaví** slouží hlavně k obsazování rolí (hledání herců a hereček). Je dobrovolné, hodnoty: žena / muž / jiné / neuvádím (výchozí).
- **Ročník** = rok nástupu (např. 2024/25), nemění se.
- **Profilový obrázek** = kolečko s iniciálami, profil fotku nemá.
- **Absolventi** v seznamu zůstávají a zatím se nijak neodlišují. Když jim zanikne školní schránka, profil zůstane vidět a upravit nebo smazat ho jde žádostí správci e-mailem. Roční ověření se na ně nevztahuje.
- Z prototypu v2 se **nepřebírá**: projekty a štábové listiny, API klíče, archiv starých Famáků, alergie. Z profilu ve v2 odpadají i role ve štábu, showreel a poznámka.

## 1. Mapa webu

```
Veřejné (bez přihlášení)
├── /                     Homepage (statická)                            [zadání]
├── /prihlaseni           Zadání školního e-mailu                        [návrh]
├── /overeni              Stránka z odkazu v e-mailu, tlačítko Přihlásit [návrh, už je ve v2]
└── /ochrana-soukromi     Zásady ochrany OÚ a pravidla užívání (GDPR)   [zadání: odkaz v patičce]

První přihlášení (jen jednou)                                            [návrh, podle GDPR dokumentu]
├── /vitej/pravidla       Krok 1: přijetí pravidel užívání (povinné)
└── /vitej/profil         Krok 2: vyplnění profilu a souhlasy (dobrovolné, jde přeskočit)

Po přihlášení
├── /lide                 Seznam studentů, všechny katedry           [zadání]
├── /lide?katedra=kp      Seznam jedné katedry (vybráno v levém menu) [zadání]
├── /lide/{id}            Detail studenta                             [zadání]
├── /profil               Úprava mého profilu                         [zadání: „aktualizace profilu“]
├── /nastaveni            Nastavení (souhlasy, skrytí a smazání profilu) [zadání]
└── odhlášení             akce v menu, ne stránka                     [zadání]
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

- Vlevo logo (odkaz na `/lide`) a menu. V menu je zatím jen „Lidé“, protože jiné sekce web nemá. **[návrh]**
- Vpravo profilový obrázek a šipka dolů, po kliknutí rozbalovací nabídka: aktualizace profilu, nastavení, odhlášení. **[zadání]**
- Profil fotku nemá, proto je „profilový obrázek“ kolečko s iniciálami. **[zadání]**
- Kdo profil nemá, má v nabídce místo „Upravit profil“ položku „Vytvořit profil“. **[návrh]**
- Nabídka se zavírá klikem mimo ni a klávesou Esc a jde ovládat z klávesnice. **[návrh]**

### Hlavička (veřejné stránky) [návrh]

Logo a vpravo tlačítko „Přihlásit se“ (po přihlášení „Do adresáře“).

### Patička (na všech stránkách) [zadání]

```
Famáci 2.0 · Ochrana soukromí a pravidla · Nahlásit zneužití kontaktu · Kontakt na správce
```

- Odkaz „Ochrana soukromí“ vede na `/ochrana-soukromi` s textem z `docs/gdpr-zasady-a-souhlas.md`, oddíl „Informace o zpracování osobních údajů a pravidla užívání“. **[zadání]**
- „Nahlásit zneužití“ a „Kontakt na správce“ jsou e-maily správce, GDPR dokument je slibuje. **[návrh]**
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
│  3. Hledáš lidi podle katedry a ročníku      │
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

1. Pole pro školní e-mail a tlačítko „Poslat přihlašovací odkaz“. Pod ním jsou povolené domény FAMU. **[?1]**
2. Potvrzení „Odkaz jsme poslali na …, platí 24 hodin“. Texty jsou v GDPR dokumentu.
3. Odkaz z e-mailu otevře `/overeni` s tlačítkem „Přihlásit“, aby odkaz nespotřeboval náhled v poštovním programu (tak to dělá už v2).
4. Při prvním přihlášení uživatel pokračuje na `/vitej/pravidla`, jinak na `/lide`.

### 3.3 První přihlášení `/vitej/...` [návrh podle GDPR dokumentu]

- **Krok 1, pravidla:** zaškrtávací políčko „Přečetl/a jsem si … a zavazuji se kontakty používat jen …“ (text je v GDPR dokumentu). Bez něj se do adresáře nedostane.
- **Krok 2, profil:** formulář jako v `/profil`, k tomu oddělené souhlasy. Tlačítka „Zveřejnit profil“ a „Pokračovat bez profilu“ jsou stejně výrazná.

### 3.4 Seznam studentů `/lide` [zadání]

```
┌───────────────┬─────────────────────────────────────────────────────┐
│ Katedry       │ Hledat: [jméno nebo e-mail…              ]          │
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

- **Levé menu:** katedry FAMU s počtem studentů, nahoře „Všechny“. Kliknutím se vybere katedra a seznam vpravo se přefiltruje. **[zadání]** Přesný seznam kateder a programů doplníme (archiv zná KP, KAT, KDT, KF, KK, KR, KSD, KSS, KZT, CAS, CINKK a programy FAMU International). **[?2]**
- **Pravá část:** seznam seskupený podle ročníku nástupu, nejnovější nahoře. Uvnitř ročníku řazení podle příjmení. **[zadání: řazení podle ročníků; abeceda uvnitř je návrh]**
- **Řádek:** iniciály, jméno, katedra, ročník, pohlaví (pokud ho člověk uvedl). **Telefon a e-mail v seznamu nejsou**, ukážou se až v detailu. Tak to chce GDPR dokument kvůli ochraně proti vytěžení. **[návrh]**
- **Textové hledání:** hledá ve jméně a e-mailu, nezáleží na diakritice ani velikosti písmen („novak“ najde „Novák“), výsledky se mění při psaní. **[zadání: textové hledání; rozsah a chování jsou návrh]**
- **Filtry:** katedra (levé menu), ročník, pohlaví (vše / žena / muž / jiné; kdo pohlaví neuvedl, ukáže se jen při „vše“). Filtry jdou kombinovat a hledání se uplatní na výsledek filtrů. **[zadání; chování „neuvedeno“ je návrh]**
- Stav filtrů je v adrese stránky, takže funguje tlačítko Zpět a filtr jde poslat odkazem. **[návrh]**
- Když nic neodpovídá, stránka napíše „Nikoho jsme nenašli“ a nabídne „Zrušit filtry“. **[návrh]**
- Stránkování nebo postupné načítání a limit zobrazení za hodinu, podle GDPR dokumentu. **[návrh]**
- **Na mobilu** se levé menu změní na rozbalovací výběr katedry nad seznamem. **[návrh]**

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
| Katedra | ano | výběr ze seznamu kateder FAMU |
| Ročník | ano | rok nástupu (např. 2024/25) |
| E-mail | ano | školní e-mail, kterým se přihlašuje, nejde měnit **[návrh]** |
| Telefon | ne | vlastní souhlas se zveřejněním |
| Pohlaví | ne | žena / muž / jiné / neuvádím (výchozí), vlastní souhlas, s vysvětlením „slouží k obsazování rolí“ |

Odkaz „Jak bude můj profil vypadat“ otevře vlastní detail. **[návrh]**

### 3.7 Nastavení `/nastaveni` [zadání]

**[návrh, většinu vyžaduje GDPR dokument]**
- Moje souhlasy: co je zveřejněné, kdy a v jaké verzi podmínek. Každý souhlas jde vypnout.
- Skrýt profil (dočasně zmizí z adresáře) a smazat profil (natrvalo).
- Stáhnout moje údaje (JSON), kvůli právu na přenositelnost.
- Odhlásit na všech zařízeních.
- Zrušit účet.

### 3.8 Ochrana soukromí `/ochrana-soukromi` [zadání: odkaz z patičky]

Je veřejná a čitelná i bez přihlášení, aby si ji člověk mohl přečíst před registrací. Obsahuje text podmínek z GDPR dokumentu s verzí a datem účinnosti. **[návrh]**

## 4. Dopady na GDPR dokument a v2

`docs/gdpr-zasady-a-souhlas.md` je od 20. 11. 2026 upravený podle kapitoly 0 (hotovo):
- celá AMU a zaměstnanci → jen studenti FAMU; povolené domény zúžit na FAMU;
- přidat pohlaví (účel: obsazování rolí, dobrovolné, vlastní souhlas);
- vyřadit profilovou fotku a další e-mail;
- **absolventi zůstávají**: roční ověření a skrytí po neověření se na ně nevztahuje, úprava a smazání po zániku schránky jde jen žádostí správci e-mailem. Upravit oddíly 6 a 7 a technická opatření.

Ve v2 to znamená odebrat projekty, štábové listiny, API, archiv, alergie, role, showreel a poznámku a přidat pohlaví.

## 5. Otevřené otázky

1. **Povolené domény:** stačí `famu.cz` (a případně studentská varianta), nebo i jiné adresy, které studenti FAMU mají (např. `st.amu.cz`)? Je potřeba ověřit u IT AMU.
2. **Seznam kateder:** které katedry a programy budou v levém menu (včetně CAS, CINKK a anglických programů FAMU International)?

### Rozhodnuto (20. 11. 2026)

- Rozsah: jen studenti FAMU, údaje jméno, pohlaví, ročník, katedra, e-mail, telefon.
- Z v2 se nepřebírají projekty, štábové listiny, API, archiv ani alergie.
- Pohlaví kvůli obsazování rolí, hodnoty žena / muž / jiné / neuvádím.
- Ročník = rok nástupu.
- Profilový obrázek = iniciály, bez fotky.
- Absolventi zůstávají bez odlišení, po zániku schránky se mažou žádostí e-mailem.

## 6. Mimo rozsah tohoto dokumentu

Grafický návrh (barvy, písmo), technologie (zda zůstane Python + SQLite z v2, nebo se přejde jinam) a texty homepage.
