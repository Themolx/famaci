@AGENTS.md

# Pro Claude Code: co jsme udělali a jak navázat

AGENTS.md (načtený výš) je společný kontext pro všechny agenty. Tady je navíc deník práce v Claude Code a praktické poznámky, abychom mohli kdykoli navázat. Stav k 20. 11. 2026.

## Deník práce (20. 11. 2026, větev `frontend`)

1. **Klon repa** do `famaci_2_0`. Repo je veřejné, klíč k GitHubu nebyl potřeba. Přihlášení k pushi je uložené v macOS Keychain (`credential.helper osxkeychain`).
2. **GDPR dokument** od uživatele (Word, originál mimo repo v `~/Documents`) převedený do `docs/gdpr-zasady-a-souhlas.md`. Upravuje se jen Markdown.
3. **Struktura webu** sepsaná v `docs/struktura-webu.md` (značky **[zadání]** / **[návrh]** / **[?]**, kapitola „Rozhodnuto“).
4. **Commit `78e0c1d`** (docs + AGENTS.md) pushnutý do `origin/frontend`. Novější práce (`web/`, `tools/gdpr_page.py`, úpravy docs) může být necommitnutá, ověř `git status`.
5. **Klikací prototyp `web/`** podle struktury: homepage, přihlášení, první přihlášení, adresář, detail, profil, nastavení, ochrana soukromí, administrace, nahlášení. Postupně přibylo:
   - domény jen `@famu.cz` a `@st.amu.cz`, účet bez profilu („Jen prohlížet“, pro pedagogy),
   - telefon i e-mail na profilu stejně velké, prázdný řádek Telefon, bez tlačítek Zavolat / Napsat (jen Zkopírovat),
   - ročníky 1946/1947 až 2026/2027 (FAMU založena 27. 10. 1946),
   - **studijní obory místo kateder** (16 = 14 sekcí archivu + Herní design a Montage),
   - role `user` / `admin` a administrace (účty, změna e-mailu a telefonu, blokace, mazání, záznam změn),
   - předvolba telefonu ze seznamu zemí s vlajkami a hledáním,
   - nahlášení zneužití s e-mailem pro odpověď a jejich vyřizování v administraci.
6. **Paměť** v `~/.claude/projects/.../memory/` drží rozhodnutí (`gdpr-dokument`, `struktura-webu`).

## Rozhodnutí uživatele, která nesmíš vrátit

- Famáci **nikoho neobsazují**. Nikde nepiš o obsazování rolí, hercích do role apod. U pohlaví **žádný vysvětlující text**.
- Všude **„studijní obor“**, ne „katedra“. Seznam oborů je v `web/data.js` (`DEPTS`, v kódu pole `dept`). Zkratky podle archivu Famáků.
- Ročník = rok nástupu ve tvaru `2026/2027`.
- Rozlišení rolí uživatel / admin je důležité, drž ho v celém návrhu (UI, dokumenty, budoucí server).
- Admin nesmí zapnout souhlas za uživatele, přidat telefon bez souhlasu ani zobrazit profil, který skryl uživatel. Každý zásah s důvodem do záznamu změn. Aspoň jeden admin musí zůstat.
- Nový e-mail (registrace i změna adminem) jen `@famu.cz` / `@st.amu.cz`, přesná shoda domény, neobsazená adresa.
- Vzhled podle webu FAMU (černá, červená `#e50000`, bílá, úzké verzálky Barlow Condensed, hranaté tvary), jen hezčí. UI tyká, právní texty vykají.

## Jak prototyp spustit a ověřit

```bash
python3 -I -m http.server 8792 --bind 127.0.0.1 --directory web
```

- Náhled v panelu prohlížeče: lokální `.claude/launch.json` (složka je v `.gitignore`, případně ji vytvoř znovu) má konfiguraci `famaci-web`, která se jen **připojí** na `http://localhost:8792`. Server pusť přes Bash na pozadí. Panel ho sám spustit neumí, macOS mu nepovolí číst složku Dokumenty (`PermissionError` u `os.getcwd`).
- Prohlížeč drží staré `app.js` v mezipaměti, po změně dej `location.reload()`.
- Roli admin si v prototypu přepneš v Nastavení (rámeček „Prototyp“). Stav (přihlášení, profil, zásahy adminů, nahlášení) je v `localStorage` pod klíčem `famaci-prototyp-v1`. Po testech smaž `admin` a `reports`, ať má uživatel čistou ukázku.
- Formuláře se dají testovat přes `javascript_tool` (vyplnit pole, kliknout, přečíst `.error` a stav). Ověřeno 20. 11.: přihlášení (včetně blokovaného účtu), pravidla, volba profilu, profil, nastavení, nahlášení (dialog i `/nahlasit` bez přihlášení), všechny formuláře administrace.
- Po každé úpravě:

```bash
node --check web/app.js && python3 -I tools/check_public.py web docs AGENTS.md
```

- Stránka `web/ochrana-soukromi.html` se **generuje** z GDPR dokumentu, ručně ji neupravuj:

```bash
python3 -I tools/gdpr_page.py docs/gdpr-zasady-a-souhlas.md web/ochrana-soukromi.html
```

## Záludnosti prostředí

- `pandoc` ani `gh` nejsou nainstalované. Word čti přes `zipfile` a `word/document.xml`, GitHub ovládej přes `git` (push funguje díky Keychain).
- Zapnutí `core.hooksPath` zablokovala kontrola oprávnění. Kontrolu soukromí proto spouštěj ručně před commitem.
- Delší úpravy souborů skriptem piš do souboru ve scratchpadu a spusť ho (`python3 -I skript.py`). Dlouhé heredoky s backticky umí bezpečnostní kontrola odmítnout.
- CSP v `web/` je jen `'self'`: žádné inline `style=` ani inline skripty, písma jsou lokálně ve `web/fonts/` (Barlow, OFL).
- Emoji vlajky Windows nezobrazuje (ukáže dvě písmena).
- Dlouhá pomlčka (U+2014) je zakázaná všude, kontroluj `grep -rl $'\u2014' web docs AGENTS.md CLAUDE.md`.

## Otevřené otázky

Kdo bude admin a správce údajů, zda `@st.amu.cz` nemají i studenti DAMU/HAMU, ověření totožnosti absolventa při žádosti e-mailem, zastarávání telefonů absolventů, oficiální názvy studijních programů (teď podle archivu). Plus otázky v kapitole 8 AGENTS.md.

## Další krok

Napojit `web/` na skutečný server: buď předělat `v2/server.py` podle kapitoly 7 AGENTS.md (odebrat projekty, API, archiv, alergie; přidat role, souhlasy, nahlášení, záznam změn), nebo Supabase. Role a souhlasy kontrolovat na serveru.
