#!/usr/bin/env python3
"""Run the Momentum smoke test from the repo (lane L3, D-023 leg 1).

The canonical smoke test lives OUTSIDE the repo, in the operator profile:
  /home/ubuntu/.hermes/profiles/momentum/scripts/momentum-smoke.py
Release checks (release-verify, post-promote probe) must run it, but a GitHub
Actions runner does not have that path — so this wrapper clones the exact
checks for CI. Single source of truth for CHECK CONTENT is still the profile
script; this file must be kept in sync with it (a header test in
tests/release-checks.test.ts asserts the two files implement the same checks).

Usage:
  python3 scripts/run-release-smoke.py <site-url> [more-urls...]
Exit 0 = all checks passed, 1 = at least one FAIL.
"""
import base64, json, re, sys, urllib.request, urllib.error

UA = {"User-Agent": "momentum-release-smoke/1.0"}
results = []  # (site, check, ok, detail)


def http(url, method="GET", headers=None, data=None, timeout=20):
    req = urllib.request.Request(url, method=method, headers={**UA, **(headers or {})}, data=data)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, dict(r.headers), r.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()
    except Exception as e:
        return 0, {}, str(e).encode()


def add(site, check, ok, detail=""):
    results.append((site, check, ok, detail))


def check_site(site):
    """Same checks as the profile smoke test's check_site() (HTTP legs). The
    browser leg and the VPS mail-keys check run on the operator VPS via the
    profile script, not in CI."""
    code, _, body = http(site + "/")
    add(site, "page answers 200", code == 200, f"HTTP {code}")
    if code != 200:
        return
    html = body.decode("utf-8", "replace")
    m = re.search(r"assets/index-[A-Za-z0-9_-]+\.js", html)
    if not m:
        add(site, "app bundle found", False, "no assets/index-*.js in the page")
        return
    code, _, js = http(f"{site}/{m.group(0)}", timeout=40)
    js = js.decode("utf-8", "replace")
    urls = sorted(set(re.findall(r"https://[a-z0-9.-]*(?:supabase\.co|sslip\.io)", js)))
    urls = [u for u in urls if "n8n" not in u]
    keys = sorted(set(re.findall(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", js)))
    add(site, "bundle has one database address and one public key",
        len(urls) == 1 and len(keys) == 1, f"addresses={urls} keys={len(keys)}")
    if not urls or not keys:
        return
    supa, key = urls[0], keys[0]
    try:
        p = key.split(".")[1]
        claims = json.loads(base64.urlsafe_b64decode(p + "=" * (-len(p) % 4)))
    except Exception:
        claims = {}
    cloud_key = "ref" in claims
    cloud_url = "supabase.co" in supa
    add(site, "public key belongs to the same database as the address",
        cloud_key == cloud_url and claims.get("role") == "anon",
        f"address={'cloud' if cloud_url else 'VPS'} key={'cloud project ' + str(claims.get('ref')) if cloud_key else 'VPS'} role={claims.get('role')}")
    auth = {"apikey": key, "Authorization": f"Bearer {key}"}
    code, _, _ = http(f"{supa}/rest/v1/tasks?select=id&limit=1", headers=auth)
    add(site, "database accepts the app's own key (data call)", code == 200, f"HTTP {code}")
    code, hdrs, _ = http(f"{supa}/rest/v1/tasks", method="OPTIONS",
                         headers={"Origin": site, "Access-Control-Request-Method": "GET",
                                  "Access-Control-Request-Headers": "apikey,authorization"})
    allow = {k.lower(): v for k, v in hdrs.items()}.get("access-control-allow-origin", "")
    add(site, "database gateway allows this site's origin (CORS)", allow in (site, "*"),
        f"allow-origin='{allow}'")
    code, _, body = http(f"{supa}/functions/v1/auth-magic-link", method="POST",
                         headers={**auth, "Content-Type": "application/json"}, data=b"{}")
    add(site, "sign-in function reachable", code not in (0, 404, 502, 503), f"HTTP {code}")
    code, _, body = http(f"{supa}/functions/v1/send-email", method="POST",
                         headers={**auth, "Content-Type": "application/json"}, data=b"{}")
    add(site, "email function reachable", code == 400, f"HTTP {code} (400 = up, asks for fields)")


def main():
    sites = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not sites:
        print("usage: run-release-smoke.py <site-url> [more-urls...] (default: production)")
        sites = ["https://social-momentum.netlify.app"]
    for site in sites:
        check_site(site.rstrip("/"))
    failed = [r for r in results if not r[2]]
    for site, check, ok, detail in results:
        name = site.replace("https://", "")
        print(f"{'PASS' if ok else 'FAIL'}  {name:40s} {check}" + (f"  [{detail}]" if detail and not ok else ""))
    print(f"SMOKE: {'PASS' if not failed else 'FAIL'} ({len(results) - len(failed)}/{len(results)} checks passed)")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
