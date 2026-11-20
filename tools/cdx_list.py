"""List every Wayback capture of a site via the CDX API, paging with resumeKey."""
import sys, time, urllib.request, urllib.parse, json

def fetch(params, tries=6):
    url = "https://web.archive.org/cdx/search/cdx?" + urllib.parse.urlencode(params)
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "famaci-archive/0.1"})
            body = urllib.request.urlopen(req, timeout=120).read().decode("utf-8", "replace")
            if "<html" in body[:200].lower():
                raise RuntimeError("archive returned HTML (offline/ratelimit)")
            return body
        except Exception as e:
            print(f"  retry {i+1}: {e}", file=sys.stderr); time.sleep(10 * (i + 1))
    raise SystemExit("CDX failed: " + url)

def main(host, out, chunk=1500):
    rows, key = [], None
    while True:
        p = {"url": host + "/*", "fl": "urlkey,timestamp,original,mimetype,statuscode,digest,length",
             "limit": chunk, "showResumeKey": "true"}
        if key: p["resumeKey"] = key
        lines = fetch(p).strip("\n").split("\n")
        key = None
        if len(lines) >= 2 and lines[-2] == "":
            key = lines[-1]; lines = lines[:-2]
        rows += [l.split(" ") for l in lines if l.strip()]
        print(f"  {len(rows)} rows", file=sys.stderr)
        if not key: break
        time.sleep(2)
    json.dump(rows, open(out, "w"))
    print(len(rows), "captures ->", out)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
