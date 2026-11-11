#!/usr/bin/env python3
"""Add ?v=<content hash> to local css/js links so browsers never mix a new page with cached old files."""
import hashlib, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def stamp(page):
    p = os.path.join(ROOT, page); base = os.path.dirname(p)
    html = open(p, encoding="utf-8").read()
    def sub(m):
        attr, path = m.group(1), m.group(2)
        f = os.path.normpath(os.path.join(base, path))
        if not os.path.exists(f): return m.group(0)
        h = hashlib.sha1(open(f, "rb").read()).hexdigest()[:8]
        return '%s="%s?v=%s"' % (attr, path, h)
    html = re.sub(r'(href|src)="((?:\.\./)?(?:css|js|lib)/[^"?]+)(?:\?v=[0-9a-f]+)?"', sub, html)
    open(p, "w", encoding="utf-8").write(html)
for page in ("index.html", "v/index.html"): stamp(page)
print("stamped")
