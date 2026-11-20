#!/usr/bin/env python3
"""Famáci 2.0 · lokální prototyp adresáře s přihlášením.

Jen standardní knihovna. SQLite v v2/data/famaci.db, server jen na 127.0.0.1.

  python3 -I v2/server.py            # spustí server (port 8791), při prvním běhu založí DB a naimportuje archiv
  python3 -I v2/server.py --reset    # smaže DB a založí ji znovu

Přihlášení: magický odkaz na školní e-mail (domény z FAMACI_DOMAINS, výchozí famu.cz, amu.cz).
Maily: bez FAMACI_SMTP_HOST se nic neodesílá, zpráva se uloží do v2/outbox/ a vypíše do konzole
(a je vidět na http://localhost:8791/dev/outbox). S FAMACI_SMTP_* se posílá přes SMTP.
"""
import csv
import hashlib
import io
import json
import os
import re
import secrets
import smtplib
import sqlite3
import sys
import threading
import time
import unicodedata
from email.message import EmailMessage
from http import cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

HERE = os.path.dirname(os.path.abspath(__file__))
STATIC = os.path.join(HERE, "static")
ARCHIVE_APP = os.path.join(os.path.dirname(HERE), "app")
DATA = os.path.join(HERE, "data")
OUTBOX = os.path.join(HERE, "outbox")
DB_PATH = os.path.join(DATA, "famaci.db")

PORT = int(os.environ.get("FAMACI_PORT", "8791"))
BASE_URL = os.environ.get("FAMACI_BASE_URL", "http://localhost:%d" % PORT).rstrip("/")
DOMAINS = [d.strip().lower() for d in os.environ.get("FAMACI_DOMAINS", "famu.cz,amu.cz").split(",") if d.strip()]
SMTP_HOST = os.environ.get("FAMACI_SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("FAMACI_SMTP_PORT", "587"))
SMTP_USER = os.environ.get("FAMACI_SMTP_USER", "")
SMTP_PASS = os.environ.get("FAMACI_SMTP_PASS", "")
MAIL_FROM = os.environ.get("FAMACI_MAIL_FROM", "famaci@localhost")
DEV_MAIL = not SMTP_HOST

LOGIN_TTL = 15 * 60
SESSION_TTL = 30 * 24 * 3600

DEPTS = [
    ("kp", "Produkce"), ("kat", "Animovaná tvorba"), ("kdt", "Dokumentární tvorba"), ("kf", "Fotografie"),
    ("kk", "Kamera"), ("kr", "Režie"), ("ksd", "Scenáristika a dramaturgie"), ("kss", "Střihová skladba"),
    ("kzt", "Zvuková tvorba"), ("cas", "Centrum audiovizuálních studií"), ("cinkk", "CINKK"),
    ("app", "FAMU International APP"), ("cdm", "FAMU International CDM"), ("pts", "FAMU International PTS"),
    ("jine", "Jiná škola / externista"),
]
ROLES = [
    "Režie", "Asistent režie", "Produkce", "Vedoucí produkce", "Asistent produkce", "Kamera", "Asistent kamery",
    "Ostření", "DIT", "Osvětlovač", "Grip", "Zvuk", "Mikrofonista", "Střih", "Barevné korekce", "VFX",
    "Animace", "Scénář", "Dramaturgie", "Architekt", "Rekvizity", "Kostýmy", "Maskér", "Skript",
    "Fotograf", "Making-of", "Herec / herečka", "Hudba", "Řidič", "Catering",
]

_lock = threading.Lock()
_rate = {}


# ---------------------------------------------------------------- utils

def now_iso():
    return time.strftime("%Y-%m-%dT%H:%M:%S")


def sha(s):
    return hashlib.sha256(s.encode()).hexdigest()


def fold(s):
    s = unicodedata.normalize("NFKD", (s or "").lower())
    return "".join(c for c in s if not unicodedata.combining(c))


def clean(s, maxlen=500):
    if s is None:
        return None
    s = re.sub(r"\s+", " ", str(s)).strip()
    return s[:maxlen] if s else None


def email_ok(email):
    m = re.fullmatch(r"[A-Za-z0-9._%+\-]+@([A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)+)", email or "")
    if not m:
        return False
    dom = m.group(1).lower()
    return any(dom == d or dom.endswith("." + d) for d in DOMAINS)


def db():
    con = sqlite3.connect(DB_PATH, timeout=10)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    return con


SCHEMA = """
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE COLLATE NOCASE,          -- školní mail = identita; NULL u nepřevzatého archivu
  name TEXT NOT NULL,
  dept TEXT, cohort TEXT,
  roles TEXT NOT NULL DEFAULT '[]',
  phone TEXT, contact_email TEXT,
  allergies TEXT, allergies_consent_at TEXT,
  note TEXT, link TEXT,
  source TEXT NOT NULL DEFAULT 'self',       -- self | archive
  archive_id INTEGER, archive_json TEXT,
  claimed_at TEXT, created_at TEXT, updated_at TEXT
);
CREATE INDEX IF NOT EXISTS profiles_source ON profiles(source);
CREATE TABLE IF NOT EXISTS login_tokens (hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires REAL, used INTEGER DEFAULT 0, created REAL);
CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires REAL, created REAL);
CREATE TABLE IF NOT EXISTS api_tokens (id INTEGER PRIMARY KEY, email TEXT NOT NULL, hash TEXT UNIQUE, label TEXT, created TEXT, last_used TEXT);
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY, title TEXT NOT NULL, kind TEXT, starts TEXT, ends TEXT, location TEXT,
  description TEXT, owner_email TEXT NOT NULL, created_at TEXT, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL, call_note TEXT, production INTEGER NOT NULL DEFAULT 0,
  added_by TEXT, created_at TEXT,
  UNIQUE(project_id, profile_id, role)
);
CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY, at TEXT, email TEXT, action TEXT, target TEXT);
"""


def init_db(reset=False):
    os.makedirs(DATA, exist_ok=True)
    os.makedirs(OUTBOX, exist_ok=True)
    if reset and os.path.exists(DB_PATH):
        for suffix in ("", "-wal", "-shm"):
            if os.path.exists(DB_PATH + suffix):
                os.remove(DB_PATH + suffix)
    con = db()
    con.executescript(SCHEMA)
    n = con.execute("SELECT COUNT(*) FROM profiles WHERE source='archive'").fetchone()[0]
    if n == 0:
        imported = import_archive(con)
        print("archiv: naimportováno %d záznamů k převzetí" % imported)
    con.commit()
    con.close()


def import_archive(con):
    """Archive people -> unclaimed profiles (email NULL). Only what the old site showed."""
    path = os.path.join(ARCHIVE_APP, "data", "famaci.json")
    if not os.path.exists(path):
        print("archiv: %s chybí, spusť python3 -I app/build_data.py" % path)
        return 0
    data = json.load(open(path, encoding="utf-8"))
    rows = []
    for p in data["people"]:
        rows.append((
            p["name"], p["dept"], p["cohort"], json.dumps([], ensure_ascii=False),
            p["phones"][0] if p["phones"] else None,
            p["emails"][0] if p["emails"] else None,
            "archive", p["id"],
            json.dumps({"phones": p["phones"], "emails": p["emails"], "first_seen": p["first_seen"],
                        "last_seen": p["last_seen"], "versions": len(p["seen"]), "level": p["level"],
                        "track": p["track"], "cohort_inferred": p["cohort_inferred"]}, ensure_ascii=False),
            now_iso(), now_iso(),
        ))
    con.executemany(
        "INSERT INTO profiles(name, dept, cohort, roles, phone, contact_email, source, archive_id, archive_json,"
        " created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)", rows)
    return len(rows)


def audit(con, email, action, target):
    con.execute("INSERT INTO audit(at, email, action, target) VALUES (?,?,?,?)", (now_iso(), email, action, str(target)))


def rate_ok(key, seconds):
    with _lock:
        t = time.time()
        last = _rate.get(key, 0)
        if t - last < seconds:
            return False
        _rate[key] = t
        return True


# ---------------------------------------------------------------- mail

def send_mail(to, subject, body):
    msg = EmailMessage()
    msg["From"] = MAIL_FROM
    msg["To"] = to
    msg["Subject"] = subject
    if DEV_MAIL:
        msg.set_content(body, cte="8bit")  # readable .eml, links not wrapped by quoted-printable
    else:
        msg.set_content(body)
    if DEV_MAIL:
        name = "%s_%s.eml" % (time.strftime("%Y%m%d-%H%M%S"), secrets.token_hex(3))
        with open(os.path.join(OUTBOX, name), "wb") as fh:
            fh.write(bytes(msg))
        print("\n[mail · dev] komu: %s · %s\n%s\n" % (to, subject, body), flush=True)
        return
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as s:
        s.starttls()
        if SMTP_USER:
            s.login(SMTP_USER, SMTP_PASS)
        s.send_message(msg)


def outbox_list():
    items = []
    if not os.path.isdir(OUTBOX):
        return items
    import email
    for name in sorted(os.listdir(OUTBOX), reverse=True)[:30]:
        if not name.endswith(".eml"):
            continue
        with open(os.path.join(OUTBOX, name), "rb") as fh:
            m = email.message_from_bytes(fh.read())
        body = m.get_payload(decode=True)
        items.append({"file": name, "to": m["To"], "subject": m["Subject"],
                      "body": body.decode("utf-8", "replace") if body else ""})
    return items


# ---------------------------------------------------------------- serialization

def profile_out(r, full=True):
    d = {
        "id": r["id"], "name": r["name"], "dept": r["dept"], "cohort": r["cohort"],
        "roles": json.loads(r["roles"] or "[]"), "source": r["source"],
        "verified": bool(r["email"]), "claimed_at": r["claimed_at"], "updated_at": r["updated_at"],
    }
    if full:
        d.update({
            "email": r["email"], "phone": r["phone"], "contact_email": r["contact_email"],
            "allergies": r["allergies"], "note": r["note"], "link": r["link"],
            "archive": json.loads(r["archive_json"]) if r["archive_json"] else None,
        })
    return d


def project_out(r):
    return {k: r[k] for k in ("id", "title", "kind", "starts", "ends", "location", "description",
                              "owner_email", "created_at", "updated_at")}


def crew(con, pid):
    rows = con.execute(
        "SELECT m.id AS mid, m.role, m.call_note, m.production, p.* FROM members m JOIN profiles p ON p.id = m.profile_id"
        " WHERE m.project_id = ? ORDER BY m.production DESC, m.role COLLATE NOCASE, p.name COLLATE NOCASE", (pid,)).fetchall()
    out = []
    for r in rows:
        out.append({
            "member_id": r["mid"], "role": r["role"], "call_note": r["call_note"], "production": bool(r["production"]),
            "profile_id": r["id"], "name": r["name"], "dept": r["dept"], "cohort": r["cohort"],
            "phone": r["phone"], "email": r["contact_email"] or r["email"], "allergies": r["allergies"],
            "verified": bool(r["email"]),
        })
    return out


def can_edit_project(con, email, pid):
    p = con.execute("SELECT owner_email FROM projects WHERE id = ?", (pid,)).fetchone()
    if not p:
        return None
    if p["owner_email"].lower() == email.lower():
        return True
    r = con.execute("SELECT 1 FROM members m JOIN profiles pr ON pr.id = m.profile_id WHERE m.project_id = ?"
                    " AND m.production = 1 AND pr.email = ? COLLATE NOCASE", (pid, email)).fetchone()
    return bool(r)


def suggestions(con, email):
    """Unclaimed archive records that might be this person: same archived e-mail, or name tokens from the address."""
    local = email.split("@")[0]
    toks = [t for t in re.split(r"[._\-+0-9]+", fold(local)) if len(t) >= 3]
    out, seen = [], set()
    for r in con.execute("SELECT * FROM profiles WHERE source='archive' AND email IS NULL AND contact_email = ? COLLATE NOCASE",
                         (email,)):
        out.append(profile_out(r, full=False) | {"why": "stejný e-mail v archivu"})
        seen.add(r["id"])
    if toks:
        for r in con.execute("SELECT * FROM profiles WHERE source='archive' AND email IS NULL"):
            if r["id"] in seen:
                continue
            nf = fold(r["name"])
            hit = sum(1 for t in toks if t in nf.split() or any(w.startswith(t) for w in nf.split()))
            if hit >= min(2, len(toks)):
                out.append(profile_out(r, full=False) | {"why": "jméno podle adresy"})
            if len(out) >= 12:
                break
    return out


# ---------------------------------------------------------------- HTTP

class ApiError(Exception):
    def __init__(self, status, msg):
        super().__init__(msg)
        self.status, self.msg = status, msg


ROUTES = []


def route(method, pattern, auth=True):
    def deco(fn):
        ROUTES.append((method, re.compile("^" + pattern + "$"), fn, auth))
        return fn
    return deco


class Handler(BaseHTTPRequestHandler):
    server_version = "Famaci/2"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.command, self.path.split("?")[0]))

    # -- responses
    def send(self, status, body, ctype="application/json; charset=utf-8", headers=None):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, ensure_ascii=False).encode()
        elif isinstance(body, str):
            body = body.encode()
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def body_json(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n > 200_000:
            raise ApiError(413, "Příliš velký požadavek.")
        raw = self.rfile.read(n) if n else b""
        if not raw:
            return {}
        try:
            return json.loads(raw)
        except ValueError:
            raise ApiError(400, "Neplatný JSON.")

    # -- auth
    def who(self):
        """Returns e-mail of the logged-in user (session cookie or API token), or None."""
        authz = self.headers.get("Authorization", "")
        con = db()
        try:
            if authz.startswith("Bearer "):
                h = sha(authz[7:].strip())
                r = con.execute("SELECT id, email FROM api_tokens WHERE hash = ?", (h,)).fetchone()
                if r:
                    con.execute("UPDATE api_tokens SET last_used = ? WHERE id = ?", (now_iso(), r["id"]))
                    con.commit()
                    self.via_token = True
                    return r["email"]
                return None
            c = cookies.SimpleCookie(self.headers.get("Cookie", ""))
            if "sid" in c:
                r = con.execute("SELECT email, expires FROM sessions WHERE hash = ?", (sha(c["sid"].value),)).fetchone()
                if r and r["expires"] > time.time():
                    return r["email"]
            return None
        finally:
            con.close()

    def csrf_ok(self):
        if getattr(self, "via_token", False):
            return True
        if not (self.headers.get("Content-Type", "").startswith("application/json")):
            return False
        origin = self.headers.get("Origin")
        if origin and urlparse(origin).netloc not in (urlparse(BASE_URL).netloc, self.headers.get("Host")):
            return False
        return True

    # -- dispatch
    def handle_any(self):
        self.via_token = False
        u = urlparse(self.path)
        path, qs = u.path, parse_qs(u.query)
        try:
            if path.startswith("/api/"):
                for method, pat, fn, need_auth in ROUTES:
                    m = pat.match(path)
                    if m and method == self.command:
                        email = self.who()
                        if need_auth and not email:
                            raise ApiError(401, "Nejsi přihlášený.")
                        if self.command in ("POST", "PUT", "DELETE") and not self.csrf_ok():
                            raise ApiError(403, "Požadavek musí být JSON ze stejné stránky.")
                        res = fn(self, email, qs, *m.groups())
                        if isinstance(res, tuple):
                            self.send(*res)
                        else:
                            self.send(200, res)
                        return
                raise ApiError(404, "Neznámá adresa API.")
            if self.command not in ("GET", "HEAD"):
                raise ApiError(405, "Metoda není povolená.")
            if path == "/dev/outbox":
                return self.dev_outbox()
            if path == "/archiv" or path.startswith("/archiv/"):
                if not self.who():
                    return self.send(302, "", headers={"Location": "/#/prihlaseni"})
                rel = path[len("/archiv"):].lstrip("/") or "index.html"
                return self.static(ARCHIVE_APP, rel, allow=("index.html", "app.js", "style.css", "data/famaci.json",
                                                             "data/versions.json"))
            rel = path.lstrip("/") or "index.html"
            return self.static(STATIC, rel)
        except ApiError as e:
            self.send(e.status, {"error": e.msg})
        except Exception as e:  # pragma: no cover
            import traceback
            traceback.print_exc()
            self.send(500, {"error": "Chyba serveru: %s" % e.__class__.__name__})

    do_GET = do_POST = do_PUT = do_DELETE = do_HEAD = handle_any

    def static(self, base, rel, allow=None):
        if allow is not None and rel not in allow:
            return self.send(404, "nenalezeno", "text/plain; charset=utf-8")
        full = os.path.realpath(os.path.join(base, rel))
        if not full.startswith(os.path.realpath(base) + os.sep) or not os.path.isfile(full):
            return self.send(404, "nenalezeno", "text/plain; charset=utf-8")
        ext = os.path.splitext(full)[1]
        ctype = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
                 ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
                 ".svg": "image/svg+xml"}.get(ext, "application/octet-stream")
        with open(full, "rb") as fh:
            self.send(200, fh.read(), ctype)

    def dev_outbox(self):
        if not DEV_MAIL:
            return self.send(404, "nenalezeno", "text/plain; charset=utf-8")
        import html
        items = outbox_list()
        li = "".join("<article><h3>%s</h3><p class=m>komu: %s · %s</p><pre>%s</pre></article>" % (
            html.escape(i["subject"] or ""), html.escape(i["to"] or ""), html.escape(i["file"]),
            re.sub(r"(https?://\S+)", r'<a href="\1">\1</a>', html.escape(i["body"]))) for i in items)
        page = ("<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'>"
                "<title>Famáci · odchozí pošta</title><link rel=stylesheet href='/style.css'>"
                "<main class='wrap outbox'><h1>Odchozí pošta (dev)</h1><p class=muted>SMTP není nastavené, "
                "maily se neodesílají, jen se ukládají do <code>v2/outbox/</code>.</p>%s</main>") % (
            li or "<p>Zatím nic.</p>")
        self.send(200, page, "text/html; charset=utf-8")


# ---------------------------------------------------------------- API: auth

@route("POST", "/api/auth/request", auth=False)
def api_auth_request(h, email, qs):
    b = h.body_json()
    addr = (b.get("email") or "").strip().lower()
    if not email_ok(addr):
        raise ApiError(400, "Použij školní e-mail (%s)." % ", ".join("@" + d for d in DOMAINS))
    if not rate_ok("login:" + addr, 30):
        raise ApiError(429, "Odkaz už odešel, zkus to za chvíli znovu.")
    token = secrets.token_urlsafe(32)
    con = db()
    con.execute("INSERT INTO login_tokens(hash, email, expires, created) VALUES (?,?,?,?)",
                (sha(token), addr, time.time() + LOGIN_TTL, time.time()))
    con.execute("DELETE FROM login_tokens WHERE expires < ?", (time.time() - 3600,))
    con.commit()
    con.close()
    link = "%s/#/overit/%s" % (BASE_URL, token)
    send_mail(addr, "Famáci · přihlášení",
              "Ahoj,\n\npro přihlášení do Famáků otevři tenhle odkaz (platí 15 minut, jen jednou):\n\n%s\n\n"
              "Pokud jsi o přihlášení nežádal(a), mail ignoruj.\n" % link)
    return {"ok": True, "dev_outbox": "/dev/outbox" if DEV_MAIL else None}


@route("POST", "/api/auth/verify", auth=False)
def api_auth_verify(h, email, qs):
    b = h.body_json()
    token = b.get("token") or ""
    con = db()
    r = con.execute("SELECT email, expires, used FROM login_tokens WHERE hash = ?", (sha(token),)).fetchone()
    if not r or r["used"] or r["expires"] < time.time():
        con.close()
        raise ApiError(400, "Odkaz je neplatný nebo prošlý. Požádej o nový.")
    con.execute("UPDATE login_tokens SET used = 1 WHERE hash = ?", (sha(token),))
    sid = secrets.token_urlsafe(32)
    con.execute("INSERT INTO sessions(hash, email, expires, created) VALUES (?,?,?,?)",
                (sha(sid), r["email"], time.time() + SESSION_TTL, time.time()))
    audit(con, r["email"], "login", "")
    con.commit()
    con.close()
    cookie = "sid=%s; HttpOnly; SameSite=Lax; Path=/; Max-Age=%d" % (sid, SESSION_TTL)
    return 200, {"ok": True, "email": r["email"]}, "application/json; charset=utf-8", {"Set-Cookie": cookie}


@route("POST", "/api/auth/logout")
def api_logout(h, email, qs):
    c = cookies.SimpleCookie(h.headers.get("Cookie", ""))
    if "sid" in c:
        con = db()
        con.execute("DELETE FROM sessions WHERE hash = ?", (sha(c["sid"].value),))
        con.commit()
        con.close()
    return 200, {"ok": True}, "application/json; charset=utf-8", {"Set-Cookie": "sid=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax"}


@route("GET", "/api/me", auth=False)
def api_me(h, email, qs):
    if not email:
        return {"email": None, "domains": DOMAINS, "dev_mail": DEV_MAIL}
    con = db()
    r = con.execute("SELECT * FROM profiles WHERE email = ? COLLATE NOCASE", (email,)).fetchone()
    out = {"email": email, "domains": DOMAINS, "dev_mail": DEV_MAIL, "profile": profile_out(r) if r else None}
    if not r:
        out["suggestions"] = suggestions(con, email)
    con.close()
    return out


@route("GET", "/api/meta")
def api_meta(h, email, qs):
    return {"depts": [{"code": c, "name": n} for c, n in DEPTS], "roles": ROLES}


# ---------------------------------------------------------------- API: profiles

PROFILE_FIELDS = ("name", "dept", "cohort", "phone", "contact_email", "allergies", "note", "link")


def read_profile_input(b, require_name=True):
    vals = {}
    for f in PROFILE_FIELDS:
        if f in b:
            vals[f] = clean(b.get(f), 1000 if f in ("note", "allergies") else 200)
    if require_name and not vals.get("name"):
        raise ApiError(400, "Jméno je povinné.")
    if "name" in vals and vals["name"] is None:
        raise ApiError(400, "Jméno je povinné.")
    if vals.get("dept") and vals["dept"] not in dict(DEPTS):
        raise ApiError(400, "Neznámá katedra.")
    if vals.get("cohort") and not re.fullmatch(r"(19|20)\d\d/\d\d", vals["cohort"]):
        raise ApiError(400, "Ročník zadej jako 2024/25.")
    if vals.get("contact_email") and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", vals["contact_email"]):
        raise ApiError(400, "Neplatný kontaktní e-mail.")
    if vals.get("link") and not re.match(r"https?://", vals["link"]):
        vals["link"] = "https://" + vals["link"]
    if "roles" in b:
        roles = b.get("roles") or []
        if not isinstance(roles, list):
            raise ApiError(400, "Role musí být seznam.")
        vals["roles"] = json.dumps([clean(x, 60) for x in roles if clean(x, 60)][:12], ensure_ascii=False)
    if vals.get("allergies"):
        if not b.get("allergies_consent"):
            raise ApiError(400, "U alergií potvrď souhlas se zobrazením přihlášeným.")
        vals["allergies_consent_at"] = now_iso()
    elif "allergies" in vals:
        vals["allergies_consent_at"] = None
    return vals


@route("GET", "/api/profiles")
def api_profiles(h, email, qs):
    q = fold((qs.get("q") or [""])[0])
    role = (qs.get("role") or [""])[0]
    dept = (qs.get("dept") or [""])[0]
    cohort = (qs.get("cohort") or [""])[0]
    source = (qs.get("source") or [""])[0]  # verified | archive
    limit = max(1, min(500, int((qs.get("limit") or ["50"])[0] or 50)))
    offset = max(0, int((qs.get("offset") or ["0"])[0] or 0))
    con = db()
    sql, args = "SELECT * FROM profiles WHERE 1=1", []
    if dept:
        sql += " AND dept = ?"; args.append(dept)
    if cohort:
        sql += " AND cohort = ?"; args.append(cohort)
    if source == "verified":
        sql += " AND email IS NOT NULL"
    elif source == "archive":
        sql += " AND email IS NULL"
    sql += " ORDER BY (email IS NULL), cohort DESC, name COLLATE NOCASE"
    rows = con.execute(sql, args).fetchall()
    con.close()
    toks = q.split()
    out = []
    for r in rows:
        roles = json.loads(r["roles"] or "[]")
        if role and role not in roles:
            continue
        if toks:
            hay = fold(" ".join(filter(None, [r["name"], r["dept"], r["cohort"], " ".join(roles), r["note"]])))
            if not all(t in hay for t in toks):
                continue
        out.append(r)
    return {"total": len(out), "offset": offset, "limit": limit,
            "items": [profile_out(r) for r in out[offset:offset + limit]]}


@route("GET", r"/api/profiles/(\d+)")
def api_profile(h, email, qs, pid):
    con = db()
    r = con.execute("SELECT * FROM profiles WHERE id = ?", (pid,)).fetchone()
    if not r:
        con.close()
        raise ApiError(404, "Profil neexistuje.")
    projects = [dict(x) for x in con.execute(
        "SELECT pr.id, pr.title, pr.starts, m.role FROM members m JOIN projects pr ON pr.id = m.project_id"
        " WHERE m.profile_id = ? ORDER BY pr.starts DESC", (pid,))]
    con.close()
    d = profile_out(r)
    d["projects"] = projects
    d["mine"] = bool(r["email"] and r["email"].lower() == email.lower())
    return d


@route("POST", "/api/profiles")
def api_profile_create(h, email, qs):
    b = h.body_json()
    vals = read_profile_input(b)
    con = db()
    if con.execute("SELECT 1 FROM profiles WHERE email = ? COLLATE NOCASE", (email,)).fetchone():
        con.close()
        raise ApiError(409, "Profil už máš.")
    vals.update({"email": email, "source": "self", "created_at": now_iso(), "updated_at": now_iso()})
    vals.setdefault("roles", "[]")
    cols = ",".join(vals)
    cur = con.execute("INSERT INTO profiles(%s) VALUES (%s)" % (cols, ",".join("?" * len(vals))), list(vals.values()))
    audit(con, email, "profile.create", cur.lastrowid)
    con.commit()
    r = con.execute("SELECT * FROM profiles WHERE id = ?", (cur.lastrowid,)).fetchone()
    con.close()
    return 201, profile_out(r)


@route("POST", r"/api/profiles/(\d+)/claim")
def api_profile_claim(h, email, qs, pid):
    con = db()
    if con.execute("SELECT 1 FROM profiles WHERE email = ? COLLATE NOCASE", (email,)).fetchone():
        con.close()
        raise ApiError(409, "Profil už máš, další převzít nejde.")
    cur = con.execute("UPDATE profiles SET email = ?, claimed_at = ?, updated_at = ? WHERE id = ? AND email IS NULL"
                      " AND source = 'archive'", (email, now_iso(), now_iso(), pid))
    if cur.rowcount != 1:
        con.close()
        raise ApiError(409, "Tenhle záznam už někdo převzal nebo neexistuje.")
    audit(con, email, "profile.claim", pid)
    con.commit()
    r = con.execute("SELECT * FROM profiles WHERE id = ?", (pid,)).fetchone()
    con.close()
    return profile_out(r)


def own_profile(con, email, pid):
    r = con.execute("SELECT * FROM profiles WHERE id = ?", (pid,)).fetchone()
    if not r:
        raise ApiError(404, "Profil neexistuje.")
    if not r["email"] or r["email"].lower() != email.lower():
        raise ApiError(403, "Upravit můžeš jen profil se svým e-mailem.")
    return r


@route("PUT", r"/api/profiles/(\d+)")
def api_profile_update(h, email, qs, pid):
    b = h.body_json()
    con = db()
    try:
        own_profile(con, email, pid)
        vals = read_profile_input(b, require_name=False)
        if not vals:
            raise ApiError(400, "Nic ke změně.")
        vals["updated_at"] = now_iso()
        con.execute("UPDATE profiles SET %s WHERE id = ?" % ",".join("%s = ?" % k for k in vals),
                    list(vals.values()) + [pid])
        audit(con, email, "profile.update", pid)
        con.commit()
        return profile_out(con.execute("SELECT * FROM profiles WHERE id = ?", (pid,)).fetchone())
    finally:
        con.close()


@route("DELETE", r"/api/profiles/(\d+)")
def api_profile_delete(h, email, qs, pid):
    con = db()
    try:
        own_profile(con, email, pid)
        con.execute("DELETE FROM profiles WHERE id = ?", (pid,))
        audit(con, email, "profile.delete", pid)
        con.commit()
        return {"ok": True}
    finally:
        con.close()


# ---------------------------------------------------------------- API: projects

def read_project_input(b, require=True):
    vals = {}
    for f in ("title", "kind", "starts", "ends", "location", "description"):
        if f in b:
            vals[f] = clean(b.get(f), 2000 if f == "description" else 200)
    if require and not vals.get("title"):
        raise ApiError(400, "Název projektu je povinný.")
    for f in ("starts", "ends"):
        if vals.get(f) and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", vals[f]):
            raise ApiError(400, "Datum zadej jako RRRR-MM-DD.")
    return vals


@route("GET", "/api/projects")
def api_projects(h, email, qs):
    con = db()
    rows = con.execute("SELECT pr.*, (SELECT COUNT(*) FROM members m WHERE m.project_id = pr.id) AS crew_count"
                       " FROM projects pr ORDER BY COALESCE(pr.starts, pr.created_at) DESC").fetchall()
    con.close()
    return {"items": [project_out(r) | {"crew_count": r["crew_count"], "mine": r["owner_email"].lower() == email.lower()}
                      for r in rows]}


@route("POST", "/api/projects")
def api_project_create(h, email, qs):
    vals = read_project_input(h.body_json())
    con = db()
    vals.update({"owner_email": email, "created_at": now_iso(), "updated_at": now_iso()})
    cur = con.execute("INSERT INTO projects(%s) VALUES (%s)" % (",".join(vals), ",".join("?" * len(vals))), list(vals.values()))
    pid = cur.lastrowid
    me = con.execute("SELECT id FROM profiles WHERE email = ? COLLATE NOCASE", (email,)).fetchone()
    if me:
        con.execute("INSERT INTO members(project_id, profile_id, role, production, added_by, created_at) VALUES (?,?,?,?,?,?)",
                    (pid, me["id"], "Produkce", 1, email, now_iso()))
    audit(con, email, "project.create", pid)
    con.commit()
    r = con.execute("SELECT * FROM projects WHERE id = ?", (pid,)).fetchone()
    con.close()
    return 201, project_out(r)


@route("GET", r"/api/projects/(\d+)")
def api_project(h, email, qs, pid):
    con = db()
    r = con.execute("SELECT * FROM projects WHERE id = ?", (pid,)).fetchone()
    if not r:
        con.close()
        raise ApiError(404, "Projekt neexistuje.")
    d = project_out(r)
    d["crew"] = crew(con, pid)
    d["can_edit"] = bool(can_edit_project(con, email, pid))
    con.close()
    return d


def require_edit(con, email, pid):
    ok = can_edit_project(con, email, pid)
    if ok is None:
        raise ApiError(404, "Projekt neexistuje.")
    if not ok:
        raise ApiError(403, "Projekt upravuje jen produkce projektu.")


@route("PUT", r"/api/projects/(\d+)")
def api_project_update(h, email, qs, pid):
    con = db()
    try:
        require_edit(con, email, pid)
        vals = read_project_input(h.body_json(), require=False)
        if "title" in vals and not vals["title"]:
            raise ApiError(400, "Název projektu je povinný.")
        vals["updated_at"] = now_iso()
        con.execute("UPDATE projects SET %s WHERE id = ?" % ",".join("%s = ?" % k for k in vals), list(vals.values()) + [pid])
        audit(con, email, "project.update", pid)
        con.commit()
        return project_out(con.execute("SELECT * FROM projects WHERE id = ?", (pid,)).fetchone())
    finally:
        con.close()


@route("DELETE", r"/api/projects/(\d+)")
def api_project_delete(h, email, qs, pid):
    con = db()
    try:
        r = con.execute("SELECT owner_email FROM projects WHERE id = ?", (pid,)).fetchone()
        if not r:
            raise ApiError(404, "Projekt neexistuje.")
        if r["owner_email"].lower() != email.lower():
            raise ApiError(403, "Smazat projekt může jen ten, kdo ho založil.")
        con.execute("DELETE FROM projects WHERE id = ?", (pid,))
        audit(con, email, "project.delete", pid)
        con.commit()
        return {"ok": True}
    finally:
        con.close()


@route("POST", r"/api/projects/(\d+)/members")
def api_member_add(h, email, qs, pid):
    b = h.body_json()
    con = db()
    try:
        require_edit(con, email, pid)
        prof = int(b.get("profile_id") or 0)
        role = clean(b.get("role"), 60)
        if not role:
            raise ApiError(400, "Vyber roli.")
        if not con.execute("SELECT 1 FROM profiles WHERE id = ?", (prof,)).fetchone():
            raise ApiError(404, "Profil neexistuje.")
        try:
            cur = con.execute("INSERT INTO members(project_id, profile_id, role, call_note, production, added_by, created_at)"
                              " VALUES (?,?,?,?,?,?,?)", (pid, prof, role, clean(b.get("call_note"), 300),
                                                          1 if b.get("production") else 0, email, now_iso()))
        except sqlite3.IntegrityError:
            raise ApiError(409, "Tenhle člověk už v projektu tuhle roli má.")
        audit(con, email, "member.add", "%s:%s" % (pid, prof))
        con.commit()
        return 201, {"member_id": cur.lastrowid}
    finally:
        con.close()


@route("PUT", r"/api/projects/(\d+)/members/(\d+)")
def api_member_update(h, email, qs, pid, mid):
    b = h.body_json()
    con = db()
    try:
        require_edit(con, email, pid)
        vals = {}
        if "role" in b:
            vals["role"] = clean(b["role"], 60)
            if not vals["role"]:
                raise ApiError(400, "Vyber roli.")
        if "call_note" in b:
            vals["call_note"] = clean(b["call_note"], 300)
        if "production" in b:
            vals["production"] = 1 if b["production"] else 0
        if not vals:
            raise ApiError(400, "Nic ke změně.")
        cur = con.execute("UPDATE members SET %s WHERE id = ? AND project_id = ?" % ",".join("%s = ?" % k for k in vals),
                          list(vals.values()) + [mid, pid])
        if cur.rowcount != 1:
            raise ApiError(404, "Člen štábu neexistuje.")
        con.commit()
        return {"ok": True}
    finally:
        con.close()


@route("DELETE", r"/api/projects/(\d+)/members/(\d+)")
def api_member_delete(h, email, qs, pid, mid):
    con = db()
    try:
        require_edit(con, email, pid)
        con.execute("DELETE FROM members WHERE id = ? AND project_id = ?", (mid, pid))
        audit(con, email, "member.delete", "%s:%s" % (pid, mid))
        con.commit()
        return {"ok": True}
    finally:
        con.close()


CREW_COLS = [("role", "Role"), ("name", "Jméno"), ("phone", "Telefon"), ("email", "E-mail"),
             ("allergies", "Alergie"), ("dept", "Katedra"), ("cohort", "Ročník"), ("call_note", "Poznámka")]


@route("GET", r"/api/projects/(\d+)/crew")
def api_crew(h, email, qs, pid):
    con = db()
    p = con.execute("SELECT * FROM projects WHERE id = ?", (pid,)).fetchone()
    if not p:
        con.close()
        raise ApiError(404, "Projekt neexistuje.")
    c = crew(con, pid)
    con.close()
    return {"project": project_out(p), "crew": c}


@route("GET", r"/api/projects/(\d+)/crew\.csv")
def api_crew_csv(h, email, qs, pid):
    con = db()
    p = con.execute("SELECT * FROM projects WHERE id = ?", (pid,)).fetchone()
    if not p:
        con.close()
        raise ApiError(404, "Projekt neexistuje.")
    c = crew(con, pid)
    con.close()
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";")
    w.writerow([label for _, label in CREW_COLS])
    for m in c:
        w.writerow([m.get(k) or "" for k, _ in CREW_COLS])
    fname = "stab_%s.csv" % re.sub(r"[^a-z0-9]+", "-", fold(p["title"])).strip("-")
    return 200, "﻿" + buf.getvalue(), "text/csv; charset=utf-8", {"Content-Disposition": 'attachment; filename="%s"' % fname}


# ---------------------------------------------------------------- API: tokens

@route("GET", "/api/tokens")
def api_tokens(h, email, qs):
    con = db()
    rows = con.execute("SELECT id, label, created, last_used FROM api_tokens WHERE email = ? ORDER BY id DESC", (email,)).fetchall()
    con.close()
    return {"items": [dict(r) for r in rows]}


@route("POST", "/api/tokens")
def api_token_create(h, email, qs):
    if getattr(h, "via_token", False):
        raise ApiError(403, "Nový klíč se zakládá jen z přihlášeného prohlížeče.")
    b = h.body_json()
    label = clean(b.get("label"), 80) or "klíč"
    token = "fam_" + secrets.token_urlsafe(30)
    con = db()
    cur = con.execute("INSERT INTO api_tokens(email, hash, label, created) VALUES (?,?,?,?)", (email, sha(token), label, now_iso()))
    audit(con, email, "token.create", cur.lastrowid)
    con.commit()
    con.close()
    return 201, {"id": cur.lastrowid, "label": label, "token": token}


@route("DELETE", r"/api/tokens/(\d+)")
def api_token_delete(h, email, qs, tid):
    con = db()
    con.execute("DELETE FROM api_tokens WHERE id = ? AND email = ?", (tid, email))
    con.commit()
    con.close()
    return {"ok": True}


# ---------------------------------------------------------------- main

def main():
    init_db(reset="--reset" in sys.argv)
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("Famáci 2.0 běží na %s (jen localhost) · domény: %s · maily: %s" % (
        BASE_URL, ", ".join(DOMAINS), "dev outbox %s/dev/outbox" % BASE_URL if DEV_MAIL else "SMTP " + SMTP_HOST), flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
