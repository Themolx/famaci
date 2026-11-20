"""Download every distinct 200 capture (one file per content digest) as raw bytes via id_.
Usage: python3 -I download.py data/cdx_www.json data/raw [limit]"""
import sys, os, json, time, urllib.request

def get(url, tries=6):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "famaci-archive/0.1"})
            with urllib.request.urlopen(req, timeout=90) as r:
                return r.read(), r.headers.get("Content-Type", "")
        except Exception as e:
            print(f"  retry {i+1} {url}: {e}", file=sys.stderr, flush=True); time.sleep(8 * (i + 1))
    return None, None

def main(cdx, outdir, limit=None):
    rows = json.load(open(cdx))
    man_path = os.path.join(outdir, "manifest.json")
    os.makedirs(outdir, exist_ok=True)
    man = json.load(open(man_path)) if os.path.exists(man_path) else {}
    todo, seen = [], set()
    for key, ts, orig, mime, st, dig, ln in rows:
        if st != "200": continue
        path = key.split(")/", 1)[1] or "index"
        rec = man.setdefault(dig + "|" + path, {"path": path, "digest": dig, "mime": mime, "timestamps": []})
        if ts not in rec["timestamps"]: rec["timestamps"].append(ts)
        if (dig, path) not in seen:
            seen.add((dig, path)); todo.append((rec, ts, orig))
    if limit: todo = todo[:int(limit)]
    n = 0
    for rec, ts, orig in todo:
        if rec.get("file") and os.path.exists(os.path.join(outdir, rec["file"])): continue
        ext = ".html" if "html" in rec["mime"] else ""
        rel = os.path.join(rec["path"].replace("/", "__"), ts + ext)
        body, ctype = get(f"https://web.archive.org/web/{ts}id_/{orig}")
        if body is None: continue
        os.makedirs(os.path.join(outdir, os.path.dirname(rel)), exist_ok=True)
        open(os.path.join(outdir, rel), "wb").write(body)
        rec.update(file=rel, first=ts, content_type=ctype, bytes=len(body))
        n += 1
        print(f"[{n}/{len(todo)}] {rel} {len(body)}B", flush=True)
        json.dump(man, open(man_path, "w"), indent=1)
        time.sleep(1.5)
    json.dump(man, open(man_path, "w"), indent=1)
    print("done", n, "files;", sum(1 for r in man.values() if r.get("file")), "in manifest")

if __name__ == "__main__":
    main(*sys.argv[1:])
