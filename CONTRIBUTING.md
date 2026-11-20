# Jak přispívat

1. **Nikdy necommituj skutečná data.** Nic z `data/`, `app/data/`, `v2/data/`, `v2/outbox/`, žádné `.db`. Ani snímek obrazovky se skutečnými jmény v issue nebo PR.
2. Zapni si kontrolu před commitem:

   ```bash
   git config core.hooksPath .githooks
   ```

   Hook spustí `tools/check_public.py` nad soubory, které commituješ. Když máš lokálně skutečná data, porovná je i s nimi (a nikdy je nevypíše).
3. Pracuj ve vlastní větvi a pošli pull request do `main`. CI na každém PR pustí stejnou kontrolu. Merge do `main` nasadí demo na GitHub Pages.
4. Když měníš formát dat (`app/build_data.py`), přegeneruj demo (`tools/make_demo.py`, viz README). Demo musí jít vytvořit jen ze skutečných dat na tvém počítači, ručně ho neupravuj.
5. Texty v UI jsou česky. V textech nepoužívej dlouhé pomlčky (U+2014), místo nich čárku, tečku nebo `·`.

## Kde co je

- `app/` statický archiv, běží na Pages. Žádné externí knihovny, fonty ani analytika (CSP povoluje jen `'self'`).
- `v2/` serverový prototyp, jen lokálně. Otevřené otázky (kdo spravuje, role, souhlas se zveřejněním) jsou v `BRAINSTORM.md`.
- `tools/` scraper a nástroje kolem dat.

Nápady a chyby piš do Issues.
