#!/usr/bin/env python3
"""
fill_report.py  --  fill an Excel verification template from a JSON context, optionally export PDF.

usage:  python fill_report.py --ctx ctx.json --out out.xlsx [--pdf out.pdf]

ctx.json (written by the Node server):
{
  "template_dir": "C:/.../templates",          # folder that holds the master templates (never modified)
  "mapping_dir":  "C:/.../mappings",
  "template_key": "caliper",
  "report":   {report row: report_number, verification_date, next_due_date, result, verified_by, reviewed_by, approved_by, remarks ...},
  "snapshot": {equipment_snapshot},
  "data":     {report_data},
  "people":   {"verified":{"name","position"}, "reviewed":{...}, "approved":{...}},
  "attachments": [{"path","caption","annotations":[...]}],
  "soffice": "C:/Program Files/LibreOffice/program/soffice.exe"   # optional
}
The master template is only READ.  Output is a new .xlsx (macros / LOGIN / USERS sheets are dropped).

CHANGES vs previous version (all backwards compatible with the 4 old mappings):
  [1] header.eut_date_offset / eut_due_offset        - templates whose date/due cells are not at +15/+16 (Digital Tachometer: +16/+17)
  [2] header.application_limit_is_formula            - template computes the application limit itself -> never overwrite it
  [3] keep_standard_if_empty                         - template already contains the (fixed) standard (pH Meter) -> do not blank it
  [4] required_accuracy_cells: list of token sets    - rulers have two accuracies (mm and inch);  "percent": true -> value stored as a fraction
  [5] cells[...]: "keep_if_blank": true              - keep the template's default text when the app has nothing (result note etc.)
  [6] fill_inputs applies "default" when the value is blank (hidden standard-weight tables would otherwise stay empty)
  [7] put(): None now clears the cell to a real blank instead of "" (an empty string makes  =H30-K30  return #VALUE!)
  [8] attachment slot falls back to mapping.default_attachment_slot (was ignored)
  [14] keep_template_values: true                    - per-equipment template: blank EUT / standard values from the app keep the template's own text
  [19] a CONCATENATE of only-empty header cells prints nothing (second, unused standard row: ' / ')
  [18] header.application_limit_always: true - write the app's application limit even when blank (replaces a formula that reads empty cells)
  [17] standard_cells: {type, maker_model, control_number, ...: cell} - the standard equipment is typed into VISIBLE cells (Curve Tracer family)
  [16] column / row sizes are measured like Excel draws them (the sheet default for unlisted columns) - signature and photo boxes
  [15] a signature picture built into the 'Verified by' box of a template is removed (replaced by the verifier's own signature)
  [13] blank_safe_refs(): =AP14 -> =IF(AP14="","",AP14) in the header block, so an empty field prints nothing instead of 0 / 30-Dec-99
  [12] people.<role>.signature_data (PNG data URL) is printed in that person's box, above the printed name
       (mapping.signature_roles, default ["verified"]).  Drawn with a OneCellAnchor so it keeps its aspect ratio; a bad image only
       adds a warning, the report is still produced.
  [11] ctx.template_path                             - exact template file chosen by reportEngine.js (any folder, any file name)
  [10] header.humidity: null                         - do not write humidity (Thermohygrometer has its own text)
  [9] fixed_standard: true                            - never touch the standard-equipment block (pH Meter: fixed buffer-solution standard)
"""
import argparse, base64, copy, datetime as dt, io, json, os, re, shutil, subprocess, sys, tempfile, warnings
warnings.filterwarnings("ignore")
import openpyxl
from openpyxl.utils import column_index_from_string as ci, get_column_letter as cl
from openpyxl.drawing.image import Image as XLImage
from openpyxl.worksheet.properties import PageSetupProperties

# ----------------------------------------------------------------------------- helpers
NUM_RE = re.compile(r"^[+-]?\d+(\.\d+)?$")

def num(v):
    """'0.02' -> 0.02 ; anything else unchanged.  Excel AVERAGE() ignores text, so numbers MUST be numbers."""
    if isinstance(v, str) and NUM_RE.match(v.strip()):
        f = float(v.strip());  return int(f) if f.is_integer() and "." not in v else f
    return v

def blank(v):
    return v is None or (isinstance(v, str) and v.strip() == "")

def parse_date(v):
    if blank(v): return None
    if isinstance(v, (dt.date, dt.datetime)): return v
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", str(v))          # ISO -> no timezone shift (avoid the fmtDate bug)
    return dt.date(int(m[1]), int(m[2]), int(m[3])) if m else v

def parse_time(v):
    if blank(v): return None
    if isinstance(v, dt.time): return v
    s = str(v).strip().upper()
    m = re.match(r"^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$", s)
    if not m: return v
    h, mi, ap = int(m[1]), int(m[2]), m[3]
    if ap == "PM" and h < 12: h += 12
    if ap == "AM" and h == 12: h = 0
    return dt.time(h % 24, mi)

def resolve(ctx, path):
    """dotted path with optional [key=value] list filter:  data.measurement_sections[title=External Measurement (mm)].rows"""
    cur = ctx
    for part in re.findall(r"[^.\[]+(?:\[[^\]]*\])?", path):
        m = re.match(r"^([^\[]+)(?:\[(.*)\])?$", part)
        key, flt = m[1], m[2]
        cur = cur.get(key) if isinstance(cur, dict) else None
        if cur is None: return None
        if flt is not None:
            if "=" in flt:
                k, v = flt.split("=", 1)
                cur = next((x for x in cur if str(x.get(k)) == v), None)
            else:
                cur = cur[int(flt)] if int(flt) < len(cur) else None
            if cur is None: return None
    return cur

def put(ws, addr, value, text=False):
    """write to a cell; merged cells must use their top-left anchor (mapping always gives anchors)."""
    c = ws[addr]
    if type(c).__name__ == "MergedCell":
        raise ValueError(f"{addr} is inside a merged range - use the anchor cell")
    fmt = c.number_format or ""
    if isinstance(value, str) and value.startswith("="):
        pass                                                     # a formula written by the mapping ("value": "=AT14")
    elif value is not None and "%" in fmt and isinstance(num(value), (int, float)):
        value = num(value) / 100.0                              # humidity cells are formatted 0%
    elif value is not None and ("d-mmm" in fmt or "d\\-mmm" in fmt or "yy" in fmt):
        value = parse_date(value)
    elif value is not None and "AM/PM" in fmt:
        value = parse_time(value)
    elif text:
        value = None if value is None else str(value)            # identifiers: keep leading zeros ("0071", "00012345")
    else:
        value = num(value) if value is not None else None
    c.value = value if value not in ("",) else None             # [7] real blank, not ""

def split_control(code):
    m = re.match(r"^\s*([A-Za-z]+)\s*0*(\d+)\s*([A-Za-z]+)\s*$", str(code or ""))
    return (m[1].upper(), m[2].zfill(4), m[3].upper()) if m else (str(code or ""), "", "")

def series_from(report_number):
    """VR-2026-0001 -> 26-0001 ;  CAL-C0071ME-26-0001 -> 26-0001"""
    s = str(report_number or "")
    m = re.search(r"(\d{4})-(\d{1,5})$", s)
    if m: return f"{m[1][2:]}-{m[2].zfill(4)}"
    m = re.search(r"(\d{2})-(\d{1,5})$", s)
    return f"{m[1]}-{m[2].zfill(4)}" if m else s

def parse_accuracy(text):
    """'± 0.02 mm RDG' -> ('±','0.02','mm RDG')   (fixes the fragile LEFT/MID(2,5)/MID(7,7) parsing in the templates)"""
    s = str(text or "").strip()
    m = re.match(r"^(\+/-|[±+\-])?\s*(\d+(?:\.\d+)?)\s*(.*)$", s)
    return (m[1] or "±", m[2], m[3].strip()) if m else ("", "", s)

TOKEN_RE = re.compile(r"(\+/-|[±+\-])?\s*(\d+(?:\.\d+)?)\s*([A-Za-z\"µ%°]+)")
def parse_accuracy_tokens(text):
    """'± 0.5 mm / ± 0.02 inch' -> [('±','0.5','mm'), ('±','0.02','inch')]"""
    return [(s or "±", v, u) for s, v, u in TOKEN_RE.findall(str(text or ""))]

def write_required_accuracy(ws, spec, text):
    """spec = {"sign","value","unit"[, "percent"]}  or a list of such sets (one per accuracy token in the text)  [4]"""
    if isinstance(spec, dict):
        sign, val, unit = parse_accuracy(text)
        sets = [(spec, sign, val, unit)]
    else:
        toks = parse_accuracy_tokens(text)
        sets = [(s, *t) for s, t in zip(spec, toks)]            # fewer tokens than sets -> remaining cells keep the template formula
    for s, sign, val, unit in sets:
        pct = bool(s.get("percent"))
        if pct:                                                  # template multiplies by this cell:  H*J16  ->  needs a fraction, shown as %
            unit = re.sub(r"^%\s*", "", unit)
        if s.get("sign"): put(ws, s["sign"], sign)
        put(ws, s["value"], val)
        if pct and isinstance(num(val), (int, float)):
            ws[s["value"]].value = num(val) / 100.0
            ws[s["value"]].number_format = "0.0##%"
        if s.get("unit"): put(ws, s["unit"], unit)

# ----------------------------------------------------------------------------- header block (shared layout)
EUT_ORDER = ["control1", "control2", "control3", "type", "status", "maker", "model", "serial", "range",
             "accuracy", "required_accuracy", "issued_to"]
EUT_DATE_OFFSET, EUT_DUE_OFFSET = 15, 16                 # default; override per template with header.eut_date_offset / eut_due_offset  [1]
STD_ORDER = ["control1", "control2", "control3", "type", "maker", "model", "serial", "accuracy",
             "calibrated_by", "traceability", "certificate"]

def fill_header(ws, m, ctx):
    h = m["header"]
    snap, data, rep = ctx.get("snapshot") or {}, ctx.get("data") or {}, ctx.get("report") or {}
    put(ws, h["series"], series_from(rep.get("report_number")), text=True)
    if h.get("humidity"): put(ws, h["humidity"], data.get("humidity"))      # [10] null -> template keeps its own text (Thermohygrometer)
    al = data.get("application_limit") or data.get("result_scope")
    if h.get("application_limit_always") or (not blank(al) and not h.get("application_limit_is_formula")):   # [2] formula / blank -> keep the template's own text
        put(ws, h["application_limit"], al)                          # [18] application_limit_always: the template's own formula reads cells that do not exist (photo reports)

    c1 = ci(h["eut_first_col"]); r = h["eut_row"]
    code = snap.get("equipment_code")
    a, b, c = split_control(code)
    status = data.get("status") or rep.get("result") or ""
    eut = dict(control1=a, control2=b, control3=c, type=snap.get("equipment_name"),
               status=str(status).upper(), maker=snap.get("manufacturer"), model=snap.get("model"),
               serial=snap.get("serial_number"), range=data.get("range") or snap.get("range") or snap.get("description"),
               accuracy=data.get("equipment_accuracy") or snap.get("accuracy"),
               required_accuracy=data.get("required_accuracy") or snap.get("required_accuracy"),
               issued_to=data.get("equipment_issued_to"))
    keep = bool(m.get("keep_template_values"))                          # [14] per-equipment template: it already holds this unit's own data
    for i, k in enumerate(EUT_ORDER):
        if keep and blank(eut[k]): continue                             # the app has nothing for this field -> keep what the template says
        put(ws, f"{cl(c1 + i)}{r}", eut[k], text=True)
    date_off, due_off = h.get("eut_date_offset", EUT_DATE_OFFSET), h.get("eut_due_offset", EUT_DUE_OFFSET)
    if not m.get("due_date_is_formula"):
        put(ws, f"{cl(c1 + due_off)}{r}", rep.get("next_due_date"))
    put(ws, f"{cl(c1 + date_off)}{r}", rep.get("verification_date"))

    # required accuracy: write the display cells directly - no character-position parsing
    ra = m.get("required_accuracy_cells")
    if ra:
        ra_text = eut["required_accuracy"] or eut["accuracy"]
        if keep and blank(ra_text):                                      # [14] the app has none -> use the tolerance printed in the template
            ra_text = ws[f"{cl(c1 + 10)}{r}"].value or ws[f"{cl(c1 + 9)}{r}"].value
        write_required_accuracy(ws, ra, ra_text)

    if m.get("fixed_standard"): return                                    # [9] standard is printed in the template (pH Meter buffer solutions)
    if m.get("standard_cells"):                                           # [17] layout without a hidden block: the standard is typed into visible cells
        std = (ctx.get("standards") or [None])[0] or data.get("standard_equipment") or {}
        vals = dict(std, maker_model=std.get("maker_model") or " / ".join(x for x in (std.get("maker"), std.get("model")) if x))
        vals.setdefault("equipment_type", std.get("type"))
        for key, addr in m["standard_cells"].items():
            v = vals.get(key)
            if key == "control_number" and v:                            # same format as the hidden-block layouts:  GB10ST -> GB0010ST
                a, b, c = split_control(v); v = f"{a}{b}{c}" if b else v
            if keep and blank(v): continue
            put(ws, addr, v, text=True)
        return
    std_list = ctx.get("standards") or ([ctx.get("data", {}).get("standard_equipment")] if data.get("standard_equipment") else [])
    std_list = [x for x in std_list if x and any(not blank(v) for v in x.values())] if keep else std_list
    if not h.get("std_rows"): return
    s1 = ci(h["std_first_col"])
    for row_no, std in zip(h["std_rows"], std_list + [{}] * len(h["std_rows"])):
        if not std and m.get("keep_standard_if_empty"): continue         # [3] pH Meter: standard is printed in the template
        std = std or {}
        if keep and not std: continue                                    # [14] no standard chosen -> keep the one printed in the template
        a, b, c = split_control(std.get("control_number"))
        vals = dict(control1=a, control2=b, control3=c, type=std.get("equipment_type"),
                    maker=std.get("maker") or (std.get("maker_model") or "").split(" / ")[0],
                    model=std.get("model") or " / ".join((std.get("maker_model") or "").split(" / ")[1:]),
                    serial=std.get("serial_number"), accuracy=std.get("accuracy"), calibrated_by=std.get("calibrated_by"),
                    traceability=std.get("traceability"), certificate=std.get("certificate_number"))
        for i, k in enumerate(STD_ORDER):
            if keep and blank(vals[k]): continue
            put(ws, f"{cl(s1 + i)}{row_no}", vals[k], text=True)

# ----------------------------------------------------------------------------- people + signature
def _col_px(ws, c):
    """pixel width of column c.  openpyxl answers 13 for a column the file does not list (and for grouped columns), which is NOT what Excel
    draws: a column that is not listed uses the sheet default width."""
    for dim in ws.column_dimensions.values():                       # explicit or grouped (min..max) column definition
        if dim.min and dim.max and dim.min <= c <= dim.max and dim.width: return int(dim.width * 7 + 5)
    return int((ws.sheet_format.defaultColWidth or 8.43) * 7 + 5)

def _row_px(ws, r):
    h = ws.row_dimensions[r].height if r in ws.row_dimensions else None
    return int((h or ws.sheet_format.defaultRowHeight or 15) * 96 / 72)

def _merged_box(ws, addr):
    """(min_col, min_row, max_col, max_row) of the merged range that holds `addr` (or of the cell itself)"""
    for rng in ws.merged_cells.ranges:
        if addr in rng: return rng.min_col, rng.min_row, rng.max_col, rng.max_row
    c = ws[addr]; return c.column, c.row, c.column, c.row

SIG_RE = re.compile(r"^data:image/(?:png|jpe?g);base64,", re.I)
def _signature_png(data_url):
    """data URL -> (PNG bytes buffer, (w, h)): cropped to the ink; a white background becomes transparent"""
    from PIL import Image, ImageChops
    m = SIG_RE.match(data_url or "")
    if not m: raise ValueError("signature is not a PNG/JPEG data URL")
    im = Image.open(io.BytesIO(base64.b64decode(data_url[m.end():], validate=True)))
    im.thumbnail((1200, 600)); im = im.convert("RGBA")
    r, g, b, a = im.split()
    if a.getextrema()[0] == 255:                                   # no transparency -> near-white = background
        a = ImageChops.darker(ImageChops.darker(r, g), b).point(lambda v: 0 if v > 235 else 255)
        im.putalpha(a)
    box = im.getchannel("A").getbbox()
    if not box: raise ValueError("signature image is empty")
    im = im.crop(box); im.thumbnail((900, 300))
    out = io.BytesIO(); im.save(out, "PNG"); out.seek(0)
    return out, im.size

def place_signature(ws, name_cell, data_url):
    """put the signature in the box of `name_cell`: in the name row, above the printed name (the label row stays clear)."""
    from openpyxl.drawing.spreadsheet_drawing import OneCellAnchor, AnchorMarker
    from openpyxl.drawing.xdr import XDRPositiveSize2D
    from openpyxl.utils.units import pixels_to_EMU
    buf, (iw, ih) = _signature_png(data_url)
    c1, r1, c2, r2 = _merged_box(ws, name_cell)
    W = sum(_col_px(ws, c) for c in range(c1, c2 + 1))
    h_name = sum(_row_px(ws, r) for r in range(r1, r2 + 1))
    avail = max(14, h_name - 14)                                   # the name row, minus the room the printed name needs;  the label above stays clear
    s = min((W - 10) / iw, avail / ih, 1.0)                        # never enlarge
    w, h = max(1, int(iw * s)), max(1, int(ih * s))
    dx, dy = (W - w) // 2, max(0, (avail - h) // 2)
    col, x = c1, dx                                                # keep the offsets inside their cell (Excel and LibreOffice differ otherwise)
    while x >= _col_px(ws, col) and col < c2: x -= _col_px(ws, col); col += 1
    row, y = r1, dy
    while y >= _row_px(ws, row) and row < r2: y -= _row_px(ws, row); row += 1
    img = XLImage(buf); img.width, img.height = w, h
    img.anchor = OneCellAnchor(_from=AnchorMarker(col=col - 1, colOff=pixels_to_EMU(x), row=row - 1, rowOff=pixels_to_EMU(y)),
                               ext=XDRPositiveSize2D(pixels_to_EMU(w), pixels_to_EMU(h)))
    ws.add_image(img)

def strip_signature_images(ws, name_cell):
    """[15] a per-equipment template carries the verifier's signature as a picture inside the 'Verified by' box.  Remove every picture
    whose top-left corner lies in that box (label row .. position row), so a different verifier never prints someone else's signature."""
    c1, r1, c2, r2 = _merged_box(ws, name_cell)
    top, bottom = max(1, r1 - 1), r1 + 1
    keep, removed = [], 0
    for im in ws._images:
        fr = getattr(im.anchor, "_from", None)
        if fr is not None and top <= fr.row + 1 <= bottom and c1 - 1 <= fr.col + 1 <= c2: removed += 1
        else: keep.append(im)
    ws._images[:] = keep
    return removed

def fill_people(ws, m, ctx, warnings_out=None):
    people = ctx.get("people") or {}
    for role, (name_cell, pos_cell) in (m.get("people") or {}).items():
        p = people.get(role) or {}
        put(ws, name_cell, p.get("name") or "")
        put(ws, pos_cell, p.get("position") or m.get("default_positions", {}).get(role, ""))
    for role in m.get("signature_roles", ["verified"]):            # [12]
        cells, sig = (m.get("people") or {}).get(role), (people.get(role) or {}).get("signature_data")
        if not cells: continue
        removed = strip_signature_images(ws, cells[0])             # [15]
        if removed and not sig and warnings_out is not None:
            warnings_out.append(f"no signature on file for the {role} person - the signature built into the template was removed")
        if not sig: continue
        try: place_signature(ws, cells[0], sig)
        except Exception as e:                                     # a bad signature must never block the report
            if warnings_out is not None: warnings_out.append(f"signature ({role}) not printed: {e}")

# ----------------------------------------------------------------------------- blank header values
PURE_REF = re.compile(r"^=\s*\$?([A-Z]{1,3})\$?(\d+)\s*$")
def blank_safe_refs(ws):
    """[13] a formula that only points at ONE header cell (=AP14) prints 0 when that cell is empty - or 30-Dec-99 in a date-formatted
    cell ("Equipment issued to 0", "Calibrated by 30-Dec-99").  Rewrite it as =IF(AP14="","",AP14).  Only the header block
    (rows <= 20) is touched; readings and their formulas are left alone."""
    for row in ws.iter_rows():
        for c in row:
            v = c.value
            if isinstance(v, str) and v.startswith("="):
                m = PURE_REF.match(v)
                if m and int(m[2]) <= 20 and ws[f"{m[1]}{m[2]}"].value in (None, ""):
                    ref = f"{m[1]}{m[2]}"
                    c.value = f'=IF({ref}="","",{ref})'
                elif c.row <= 20 and v.upper().startswith("=CONCATENATE("):         # =CONCATENATE(AK17," / ",AL17) with both cells empty -> " / "
                    refs = [(int(r_), ci(c_)) for c_, r_ in re.findall(r"(?<![A-Za-z_.])\$?([A-Z]{1,3})\$?(\d+)(?![\w(])", re.sub(r'"[^"]*"', "", v))]
                    if refs and all(r_ <= 20 and ws.cell(r_, c_).value in (None, "") for r_, c_ in refs): c.value = '=""'

# ----------------------------------------------------------------------------- tables / cells
def fill_cells(ws, m, ctx):
    for addr, spec in (m.get("cells") or {}).items():
        if isinstance(spec, str) and spec.startswith("="):       # keep formula
            continue
        if isinstance(spec, dict):
            v = resolve(ctx, spec["path"]) if "path" in spec else spec.get("value")
            if spec.get("upper") and isinstance(v, str): v = v.upper()
            if spec.get("fallback") and blank(v): v = resolve(ctx, spec["fallback"])
            if spec.get("upper") and isinstance(v, str): v = v.upper()
            if spec.get("keep_if_blank") and blank(v): continue  # [5]
        else:
            v = resolve(ctx, spec)
        put(ws, addr, v)

def fill_inputs(ws, m, ctx):
    """irregular templates: mapping lists input cells; app stores them as data.inputs = {id: value}"""
    vals = (ctx.get("data") or {}).get("inputs") or {}
    for g in m.get("input_groups") or []:
        for f in g["fields"]:
            v = vals.get(f["id"])
            if blank(v) and "default" in f: v = f["default"]    # [6]
            if blank(v):
                if not f.get("clear_if_blank"): continue        # keep whatever the template already has
                v = None
            put(ws, f["cell"], v)

def fill_tables(ws, m, ctx, warnings_out):
    for t in m.get("tables") or []:
        rows = resolve(ctx, t["source"]) or []
        if len(rows) > t["rows"]:
            warnings_out.append(f"{t['id']}: {len(rows)} rows entered but template has {t['rows']} - extra rows NOT printed")
        for i in range(t["rows"]):
            row = rows[i] if i < len(rows) else {}
            for col, key in t["columns"].items():
                if key.startswith("="): continue
                if t.get("only_if_present") and key not in row and i >= len(rows): continue
                put(ws, f"{col}{t['first_row'] + i}", row.get(key))

# ----------------------------------------------------------------------------- images
def slot_of(a, m):                                              # [8]
    return a.get("slot") or m.get("default_attachment_slot", "sheet")

def px_width(ws, c1, c2): return sum(_col_px(ws, c) for c in range(c1, c2 + 1))

def px_height(ws, r1, r2): return sum(_row_px(ws, r) for r in range(r1, r2 + 1))

def burn(path, annotations, out):
    """draw red circles / arrows (coordinates are fractions 0..1 of the image) and re-encode to JPEG."""
    from PIL import Image, ImageDraw, ImageOps
    im = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    im.thumbnail((1600, 1600))
    d, (w, h) = ImageDraw.Draw(im), im.size
    lw = max(3, w // 200)
    for a in annotations or []:
        if a.get("type") == "circle":
            cx, cy, rx, ry = a["x"] * w, a["y"] * h, a.get("rx", a.get("r", .08)) * w, a.get("ry", a.get("r", .08)) * h
            d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], outline=(220, 0, 0), width=lw)
        elif a.get("type") == "arrow":
            x1, y1, x2, y2 = a["x1"] * w, a["y1"] * h, a["x2"] * w, a["y2"] * h
            d.line([x1, y1, x2, y2], fill=(220, 0, 0), width=lw)
            import math
            ang = math.atan2(y2 - y1, x2 - x1); L = lw * 5
            for s in (-0.5, 0.5):
                d.line([x2, y2, x2 - L * math.cos(ang + s), y2 - L * math.sin(ang + s)], fill=(220, 0, 0), width=lw)
    im.save(out, "JPEG", quality=88)
    return out, im.size

def place_photos(ws, m, ctx, tmp):
    """photo boxes inside the template body (e.g. Air Particle Counter's blank test area)"""
    photos = [a for a in ctx.get("attachments") or [] if slot_of(a, m) == "body"]
    for box in m.get("photo_boxes") or []:
        if not photos: break
        c1, r1 = ci(re.match(r"[A-Z]+", box["from"])[0]), int(re.search(r"\d+", box["from"])[0])
        c2, r2 = ci(re.match(r"[A-Z]+", box["to"])[0]), int(re.search(r"\d+", box["to"])[0])
        W, H = px_width(ws, c1, c2) - 8, px_height(ws, r1, r2) - 8
        cols = 1 if len(photos) == 1 else 2
        rows_n = -(-len(photos) // cols); cw, ch = W // cols, H // rows_n
        for i, p in enumerate(photos):
            out, (iw, ih) = burn(p["path"], p.get("annotations"), os.path.join(tmp, f"box{i}.jpg"))
            s = min((cw - 6) / iw, (ch - 6) / ih)
            img = XLImage(out); img.width, img.height = int(iw * s), int(ih * s)
            ws.add_image(img, f"{cl(c1 + (i % cols) * ((c2 - c1 + 1) // cols))}{r1 + (i // cols) * ((r2 - r1 + 1) // rows_n)}")
        photos = []

def attachments_sheet(wb, m, ctx, tmp):
    atts = [a for a in ctx.get("attachments") or [] if slot_of(a, m) == "sheet"]
    if not atts: return
    ws = wb.create_sheet("ATTACHMENTS")
    ws.sheet_view.showGridLines = False
    ws.page_setup.paperSize = 9; ws.page_setup.orientation = "portrait"
    ws.sheet_properties.pageSetUpPr = PageSetupProperties(fitToPage=True)
    ws.page_setup.fitToWidth = 1; ws.page_setup.fitToHeight = 0
    ws.page_margins.left = ws.page_margins.right = 0.5
    ws.column_dimensions["A"].width = 100
    rn = (ctx.get("report") or {}).get("report_number", "")
    from openpyxl.styles import Font, Alignment
    ws["A1"] = f"ATTACHMENTS — Report No. {rn}"; ws["A1"].font = Font(name="Arial", bold=True, size=12)
    ws["A2"] = "Physical condition / supporting photos"; ws["A2"].font = Font(name="Arial", size=9, italic=True)
    row = 4
    for i, a in enumerate(atts):
        out, (iw, ih) = burn(a["path"], a.get("annotations"), os.path.join(tmp, f"att{i}.jpg"))
        s = min(640 / iw, 430 / ih)
        img = XLImage(out); img.width, img.height = int(iw * s), int(ih * s)
        ws.add_image(img, f"A{row}")
        rows_used = int(img.height / 20) + 1
        ws[f"A{row + rows_used}"] = f"Photo {i + 1}: {a.get('caption') or ''}"
        ws[f"A{row + rows_used}"].font = Font(name="Arial", size=10, bold=True)
        ws[f"A{row + rows_used}"].alignment = Alignment(wrap_text=True)
        row += rows_used + 3

# ----------------------------------------------------------------------------- main
def build(ctx, out_xlsx):
    key = ctx["template_key"]
    with open(os.path.join(ctx["mapping_dir"], f"{key}.json"), encoding="utf-8") as f:
        m = json.load(f)
    tpl = ctx.get("template_path") or os.path.join(ctx["template_dir"], m["template"])      # [11] Node passes the exact file it found
    if not os.path.exists(tpl): raise FileNotFoundError(f"Excel template not found: {tpl}")
    tmp = tempfile.mkdtemp(prefix="rpt_")
    work = os.path.join(tmp, os.path.basename(tpl))
    shutil.copyfile(tpl, work)                                   # never touch the master
    wb = openpyxl.load_workbook(work)                            # keep_vba=False -> macros dropped
    for n in list(wb.sheetnames):
        if n != m["sheet"]: del wb[n]                            # LOGIN / USERS (contains credentials) removed
    ws = wb[m["sheet"]]
    warns = []
    fill_header(ws, m, ctx); fill_people(ws, m, ctx, warns); fill_cells(ws, m, ctx); fill_tables(ws, m, ctx, warns); fill_inputs(ws, m, ctx)
    blank_safe_refs(ws)
    if m.get("print_scale"): ws.page_setup.scale = m["print_scale"]
    for hf in (ws.oddFooter, ws.oddHeader, ws.evenFooter, ws.evenHeader, ws.firstFooter, ws.firstHeader):
        for part in (hf.left, hf.center, hf.right):            # "_x000a_" is an escaped newline that LibreOffice prints literally
            if part.text: part.text = part.text.replace("_x000a_", " ").replace("\r", " ").replace("\n", " ").strip()
    place_photos(ws, m, ctx, tmp)
    atts = ctx.get("attachments") or []
    if atts and m.get("physical_condition_cell") and not [a for a in atts if slot_of(a, m) == "body"]:
        put(ws, m["physical_condition_cell"], (resolve(ctx, "data.physical_condition") or "") + "  (see attached photos)")
    attachments_sheet(wb, m, ctx, tmp)
    wb.save(out_xlsx)
    shutil.rmtree(tmp, ignore_errors=True)
    return warns

def find_soffice(explicit=None):
    """LibreOffice does not add itself to PATH on Windows, so also look in the default install folders."""
    cands = [explicit, os.environ.get("SOFFICE_PATH"), shutil.which("soffice"), shutil.which("soffice.exe")]
    if os.name == "nt":
        for base in (os.environ.get("ProgramFiles"), os.environ.get("ProgramFiles(x86)"), r"C:\Program Files", r"C:\Program Files (x86)"):
            if base: cands.append(os.path.join(base, "LibreOffice", "program", "soffice.exe"))
    for c in cands:
        if c and os.path.exists(c): return c
    raise RuntimeError("LibreOffice was not found. Install it from libreoffice.org, or set SOFFICE_PATH to the full path of soffice.exe")

def to_pdf(xlsx, pdf, soffice=None):
    soffice = find_soffice(soffice)
    outdir = tempfile.mkdtemp(prefix="pdf_"); profile = tempfile.mkdtemp(prefix="lo_")
    uri = "file:///" + profile.replace("\\", "/").lstrip("/")
    r = subprocess.run([soffice, f"-env:UserInstallation={uri}", "--headless", "--convert-to", "pdf", "--outdir", outdir, xlsx],
                       capture_output=True, timeout=120)
    made = os.path.join(outdir, os.path.splitext(os.path.basename(xlsx))[0] + ".pdf")
    if not os.path.exists(made): raise RuntimeError("PDF conversion failed: " + r.stderr.decode(errors="ignore")[:300])
    shutil.move(made, pdf); shutil.rmtree(outdir, ignore_errors=True); shutil.rmtree(profile, ignore_errors=True)

if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--ctx", required=True); ap.add_argument("--out", required=True); ap.add_argument("--pdf")
    a = ap.parse_args()
    ctx = json.load(open(a.ctx, encoding="utf-8"))
    warns = build(ctx, a.out)
    if a.pdf: to_pdf(a.out, a.pdf, ctx.get("soffice"))
    print(json.dumps({"ok": True, "xlsx": a.out, "pdf": a.pdf, "warnings": warns}))
