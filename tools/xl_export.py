#!/usr/bin/env python3
"""Turn the demo workbook into js/xl-data.js for the interactive spreadsheet slide.

Usage:  python3 tools/xl_export.py path/to/mouse_overlay_analysis.xlsx
Everything shown on the slide (values, formulas, formats, charts, images) is read from the file.
"""
import io, json, os, re, sys, zipfile
from decimal import Decimal, ROUND_HALF_UP
import xml.etree.ElementTree as ET
import openpyxl
from openpyxl.utils import get_column_letter
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = sys.argv[1]
NS = {"c": "http://schemas.openxmlformats.org/drawingml/2006/chart",
      "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
      "xdr": "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing",
      "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
      "rel": "http://schemas.openxmlformats.org/package/2006/relationships"}
# how far to draw each sheet (columns, rows): a little past the used range, like a real window
EXTENT = {"Analysis": (14, 56), "Mouse data": (20, 36), "Method and source": (11, 24)}
IMG_NAMES = ["xl-source", "xl-tiles"]


def q(v, places):
    return Decimal(repr(float(v))).quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP)


def fmt(v, nf):
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return str(v)
    if nf == "#,##0": return "{:,}".format(int(q(v, 0)))
    if nf == "#,##0.0": return "{:,}".format(q(v, 1))
    if nf == "0.00": return str(q(v, 2))
    if nf == "0.0": return str(q(v, 1))
    if nf == "0": return str(int(q(v, 0)))
    if nf == "0.0%": return str(q(v * 100, 1)) + "%"
    if nf == "General": return ("%.10g" % v)
    raise SystemExit("unhandled number format: " + nf)


def rgb(c):
    return "#" + c.rgb[2:] if c is not None and c.type == "rgb" and c.rgb else None


def colpx(w): return int(w * 7 + 5)
def rowpx(pt): return round(pt * 96 / 72, 2)


zf = zipfile.ZipFile(SRC)
wbf = openpyxl.load_workbook(SRC)
wbv = openpyxl.load_workbook(SRC, data_only=True)


def rels(path):
    d, f = os.path.split(path)
    rp = "%s/_rels/%s.rels" % (d, f)
    if rp not in zf.namelist(): return {}
    out = {}
    for r in ET.fromstring(zf.read(rp).lstrip(b"\xef\xbb\xbf")):
        t = r.get("Target")
        out[r.get("Id")] = t.lstrip("/") if t.startswith("/") else os.path.normpath(os.path.join(d, t))
    return out


def txt(node):
    return "".join(t.text or "" for t in node.iter("{%s}t" % NS["a"])) if node is not None else ""


def ref(f):
    """Resolve a chart range such as 'Analysis'!$A$8:$A$13 to the workbook's stored values."""
    sheet, rng = f.rsplit("!", 1)
    return [c.value for row in wbv[sheet.strip("'")][rng.replace("$", "")] for c in row]


def chart(path):
    x = ET.fromstring(zf.read(path).lstrip(b"\xef\xbb\xbf"))
    ser = x.find(".//c:ser", NS)
    return {"t": "chart", "title": txt(x.find("c:chart/c:title", NS)), "ytitle": txt(x.find(".//c:valAx/c:title", NS)),
            "color": "#" + ser.find("c:spPr/a:solidFill/a:srgbClr", NS).get("val"),
            "cats": ref(ser.find("c:cat//c:f", NS).text), "vals": ref(ser.find("c:val//c:f", NS).text),
            "series": txt(ser.find("c:tx", NS)) or (ser.find("c:tx/c:v", NS).text if ser.find("c:tx/c:v", NS) is not None else "")}


sheet_paths = {}
wr = rels("xl/workbook.xml")
for s in ET.fromstring(zf.read("xl/workbook.xml").lstrip(b"\xef\xbb\xbf")).iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheet"):
    sheet_paths[s.get("name")] = wr[s.get("{%s}id" % NS["r"])]

img_i = 0
book = {"file": "mouse_overlay_analysis.xlsx", "sheets": []}
for ws in wbf:
    wv = wbv[ws.title]
    ncol, nrow = EXTENT[ws.title]
    cw = [colpx(ws.column_dimensions[get_column_letter(c)].width) if get_column_letter(c) in ws.column_dimensions and ws.column_dimensions[get_column_letter(c)].width else 64 for c in range(1, ncol + 1)]
    rh = [rowpx(ws.row_dimensions[r].height or 15) for r in range(1, nrow + 1)]
    styles, sidx, cells = [], {}, []
    for row in ws.iter_rows(min_row=1, max_row=nrow, max_col=ncol):
        for c in row:
            bg = rgb(c.fill.fgColor) if c.fill is not None and c.fill.fill_type == "solid" else None
            if c.value is None and not bg: continue
            a, f = c.alignment, c.font
            st = {"sz": f.sz, "c": rgb(f.color)}
            if f.b: st["b"] = 1
            if bg: st["bg"] = bg
            if a.horizontal: st["h"] = a.horizontal
            if a.vertical: st["v"] = a.vertical
            if a.wrap_text: st["w"] = 1
            key = json.dumps(st, sort_keys=True)
            if key not in sidx: sidx[key] = len(styles); styles.append(st)
            val = wv[c.coordinate].value
            num = isinstance(val, (int, float)) and not isinstance(val, bool)
            disp = "" if val is None else fmt(val, c.number_format)
            raw = c.value if isinstance(c.value, str) and c.value.startswith("=") else (("%.15g" % val) if num else disp)
            cell = [c.row - 1, c.column - 1, disp, sidx[key], 1 if num else 0]
            if raw != disp: cell.append(raw)
            cells.append(cell)
    draw = []
    sp = sheet_paths[ws.title]
    for rid, dpath in rels(sp).items():
        if "drawings/" not in dpath: continue
        dr = rels(dpath)
        for anc in ET.fromstring(zf.read(dpath).lstrip(b"\xef\xbb\xbf")):
            fr = anc.find("xdr:from", NS)
            pos = [int(fr.find("xdr:col", NS).text), int(fr.find("xdr:row", NS).text)]
            ch = anc.find(".//c:chart", NS)
            if ch is not None:
                to = anc.find("xdr:to", NS)
                d = chart(dr[ch.get("{%s}id" % NS["r"])])
                d["from"] = pos; d["to"] = [int(to.find("xdr:col", NS).text), int(to.find("xdr:row", NS).text)]
            else:
                ext = anc.find("xdr:ext", NS)
                blip = anc.find(".//a:blip", NS)
                name = IMG_NAMES[img_i]; img_i += 1
                Image.open(io.BytesIO(zf.read(dr[blip.get("{%s}embed" % NS["r"])]))).convert("RGB").save(
                    os.path.join(ROOT, "assets", name + ".webp"), quality=90, method=6)
                d = {"t": "img", "src": "assets/%s.webp" % name, "from": pos,
                     "w": round(int(ext.get("cx")) / 9525), "h": round(int(ext.get("cy")) / 9525)}
            draw.append(d)
    fp = ws.freeze_panes
    fz = [0, 0]
    if fp:
        m = re.match(r"([A-Z]+)(\d+)", fp)
        fz = [int(m.group(2)) - 1, openpyxl.utils.column_index_from_string(m.group(1)) - 1]
    book["sheets"].append({"name": ws.title, "cw": cw, "rh": rh, "fz": fz, "styles": styles, "cells": cells, "draw": draw})

out = os.path.join(ROOT, "js", "xl-data.js")
with open(out, "w", encoding="utf-8") as f:
    f.write("/* generated by tools/xl_export.py from mouse_overlay_analysis.xlsx; do not edit by hand */\nwindow.XLBOOK = ")
    json.dump(book, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")
print("wrote", out, os.path.getsize(out), "bytes;", sum(len(s["cells"]) for s in book["sheets"]), "cells")
