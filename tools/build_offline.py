#!/usr/bin/env python3
"""Bundle the deck into one self-contained HTML file for offline presenting.

Usage:  python3 tools/build_offline.py            -> dist/deck-offline.html
Live voting is switched off in the offline file; every game still works with clicks.
"""
import base64, mimetypes, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("font/woff2", ".woff2")


def data_uri(path):
    mime = mimetypes.guess_type(path)[0] or "application/octet-stream"
    with open(path, "rb") as f:
        return "data:%s;base64,%s" % (mime, base64.b64encode(f.read()).decode())


def read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


def inline_css(rel):
    css = read(rel)
    base = os.path.dirname(os.path.join(ROOT, rel))
    def sub(m):
        p = os.path.normpath(os.path.join(base, m.group(1)))
        return "url(%s)" % data_uri(p) if os.path.exists(p) else m.group(0)
    return re.sub(r"url\((?!data:)([^)\"']+)\)", sub, css)


def main():
    html = read("index.html")
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">',
                  lambda m: "<style>\n%s\n</style>" % inline_css(m.group(1)), html)

    def js(m):
        src = m.group(1)
        code = "window.FIREBASE_CONFIG = null;" if src.endswith("config.js") else read(src)
        return "<script>\n%s\n</script>" % code.replace("</script>", "<\\/script>")
    html = re.sub(r'<script src="([^"]+)"></script>', js, html)

    def asset(m):
        p = os.path.join(ROOT, m.group(2))
        return '%s="%s"' % (m.group(1), data_uri(p)) if os.path.exists(p) else m.group(0)
    html = re.sub(r'(src|data-background-image)="(assets/[^"]+)"', asset, html)
    # rounds.js references images by path; rewrite them too
    html = re.sub(r'"(assets/[^"]+\.webp)"',
                  lambda m: '"%s"' % data_uri(os.path.join(ROOT, m.group(1))), html)
    html = html.replace('return { id: k, img: "assets/fake-" + k + ".webp" };',
                        'return { id: k, img: FAKE[k] };')
    fakes = "var FAKE={%s};" % ",".join('"%s":"%s"' % (k, data_uri(os.path.join(ROOT, "assets/fake-%s.webp" % k))) for k in "abcdef")
    html = html.replace("window.ROUNDS = {", fakes + "\nwindow.ROUNDS = {", 1)

    os.makedirs(os.path.join(ROOT, "dist"), exist_ok=True)
    out = os.path.join(ROOT, "dist", "deck-offline.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    left = re.findall(r'(?:src|href)="(?!data:|https?:|#)([^"]+)"', html)
    print("wrote", out, "%.1f MB" % (os.path.getsize(out) / 1e6))
    if left:
        print("WARNING: unresolved references:", left[:10], file=sys.stderr)


if __name__ == "__main__":
    main()
