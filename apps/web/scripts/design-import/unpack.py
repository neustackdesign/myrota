import sys, re, json, base64, gzip, os, html
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
s = open(src, encoding="utf-8").read()
def block(t):
    m = re.search(r'<script type="%s">(.*?)</script>' % re.escape(t), s, re.S)
    return m.group(1) if m else None
for t in ["__bundler/manifest", "__bundler/template", "__bundler/page_order", "__bundler/ext_resources"]:
    b = block(t)
    print(t, len(b) if b else None)
man = json.loads(block("__bundler/manifest"))
print("manifest type", type(man).__name__, "entries", len(man))
assets = os.path.join(out, "assets"); os.makedirs(assets, exist_ok=True)
items = man.items() if isinstance(man, dict) else enumerate(man)
for k, v in items:
    info = {kk: (vv if not isinstance(vv, str) or len(vv) < 200 else f"<{len(vv)} chars>") for kk, vv in (v.items() if isinstance(v, dict) else [("value", v)])}
    print("asset", k, info)
    if isinstance(v, dict):
        data = v.get("data") or v.get("content") or v.get("b64")
        if isinstance(data, str):
            raw = base64.b64decode(data)
            if v.get("compressed") or v.get("encoding") == "gzip" or raw[:2] == b"\x1f\x8b":
                try: raw = gzip.decompress(raw)
                except Exception as e: print("  gunzip fail", e)
            name = re.sub(r"[^A-Za-z0-9._-]", "_", str(k))[:80]
            ext = {"text/javascript": ".js", "application/javascript": ".js", "text/css": ".css", "text/html": ".html", "font/woff2": ".woff2", "image/png": ".png", "image/svg+xml": ".svg", "image/jpeg": ".jpg", "image/webp": ".webp"}.get(v.get("mime") or v.get("type") or "", "")
            open(os.path.join(assets, name + ext), "wb").write(raw)
tpl = json.loads(block("__bundler/template"))
open(os.path.join(out, "template.html"), "w").write(tpl if isinstance(tpl, str) else json.dumps(tpl))
print("template chars", len(tpl) if isinstance(tpl, str) else "obj")
for t in ["__bundler/page_order", "__bundler/ext_resources"]:
    b = block(t)
    if b: open(os.path.join(out, t.split("/")[1] + ".json"), "w").write(b)
