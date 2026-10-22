#!/usr/bin/env python3
"""
analyze_template.py  --  draft a mapping JSON from a Nikkoshi verification-report Excel template (.xlsx / .xlsm).

    python tools/analyze_template.py "HP0001RE_Blank_Form.xlsm"                 # prints the draft + notes
    python tools/analyze_template.py "HP0001RE_Blank_Form.xlsm" --out mappings  # writes mappings/hp0001re.json

How it works (nothing is guessed from the file name except the key):
  header      the visible header block is full of formulas (=AT14, =CONCATENATE(AE14,AF14,AG14), MID($AO$14,..)); following
              them tells where the hidden data block (series, humidity, EUT row, standard rows, dates) is.
  tables      every  =IF(AND(x>=lower, x<=upper),"PASSED",..)  marks a table row; the cells that formula (and the Error formula
              next to it) read are the INPUTS, the cells only the limits read are fixed SPEC values.
  other       empty cells read by MAX / AVERAGE / STDEV ... that no table row owns (repeatability, off-center) become inputs too.
  free-form   a report without any such formula is a photo report: a photo box is drawn over its blank body.
  labels      row / column names come from the header texts above each column and the row's first label cell.
The result is a DRAFT: render a test PDF (the report server does) and look at it before using it.  Everything the analyzer is
not sure about is written to  "_notes".
"""
import argparse, json, os, re, sys, warnings
warnings.filterwarnings("ignore")
import openpyxl
from openpyxl.utils import column_index_from_string as ci, get_column_letter as cl

SHEET = "VERIFICATION_REPORT"
REF = re.compile(r"(?<![A-Za-z_.])\$?([A-Z]{1,3})\$?(\d+)(?::\$?([A-Z]{1,3})\$?(\d+))?(?![\w(])")
PURE_REF = re.compile(r"^=\s*\$?([A-Z]{1,3})\$?(\d+)\s*$")
CONTROL_RE = re.compile(r"^[a-z]{1,4}\d{3,5}[a-z]{1,3}$")          # HP0001RE, DG0014ME ...
HEADER_ROWS = 20                                                    # rows <= 20 are the header block, not measurements


def normalize_key(name):
    """same rule as normalizeTemplateKey() in reportEngine.js:  '00. Hot Plate_Blank Form.xlsx' -> 'hot_plate'"""
    s = re.sub(r"\.(xlsx|xlsm)$", "", str(name or ""), flags=re.I)
    s = re.sub(r"^\d+[\s._-]+", "", s)
    s = re.sub(r"[\s_-]*blank?[\s_-]*(form|report)?[\s_-]*$", "", s, flags=re.I)
    return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")


class Sheet:
    def __init__(self, ws):
        self.ws = ws
        self.anchor = {}
        for m in ws.merged_cells.ranges:
            for r in range(m.min_row, m.max_row + 1):
                for c in range(m.min_col, m.max_col + 1):
                    self.anchor[(r, c)] = (m.min_row, m.min_col)
        self.span = {(m.min_row, m.min_col): (m.max_row - m.min_row + 1, m.max_col - m.min_col + 1) for m in ws.merged_cells.ranges}

    def a(self, r, c): return self.anchor.get((r, c), (r, c))
    def val(self, r, c):
        r, c = self.a(r, c); return self.ws.cell(r, c).value
    def text(self, r, c):
        v = self.val(r, c); return v.strip() if isinstance(v, str) and not v.startswith("=") else ""
    def formula(self, r, c):
        v = self.val(r, c); return v if isinstance(v, str) and v.startswith("=") else None
    def addr(self, r, c): r, c = self.a(r, c); return f"{cl(c)}{r}"
    def cells(self, r1=1, r2=None, c1=1, c2=None):
        for row in self.ws.iter_rows(min_row=r1, max_row=r2 or self.ws.max_row, min_col=c1, max_col=c2 or self.ws.max_column):
            for cell in row:
                if type(cell).__name__ != "MergedCell" and cell.value not in (None, ""): yield cell
    def find(self, pattern, r1=1, r2=40, c1=1, c2=29):
        rx = re.compile(pattern, re.I)
        return [(c.row, c.column) for c in self.cells(r1, r2, c1, c2) if isinstance(c.value, str) and not c.value.startswith("=") and rx.search(c.value.strip())]

    def refs(self, formula):
        out = []
        for m in REF.finditer(re.sub(r'"[^"]*"', "", formula)):
            a, b, c2, d = m.groups()
            if c2:
                if (int(d) - int(b) + 1) * (ci(c2) - ci(a) + 1) > 600: continue
                out += [(r, c) for r in range(int(b), int(d) + 1) for c in range(ci(a), ci(c2) + 1)]
            else: out.append((int(b), ci(a)))
        return out

    def leaves(self, rc, seen=None):
        """constants / empty cells that feed rc (follows formulas), as merge anchors"""
        seen = seen if seen is not None else set()
        rc = self.a(*rc)
        if rc in seen: return set()
        seen.add(rc)
        f = self.formula(*rc)
        if f is None: return {rc}
        out = set()
        for ref in self.refs(f): out |= self.leaves(ref, seen)
        return out


# ------------------------------------------------------------------------------------------------ header block
def analyze_direct_standard(S):
    """Layout where 'Standard Equipment Details' has no formulas: the values are typed into the visible cells right of the ':' ."""
    heads = S.find(r"^(Standard|Reference) Equipment Details", 8, 12, 8, 40)
    if not heads: return None
    r_h, c_h = heads[0]
    pats = {"equipment_type": r"^Equipment Type$", "maker_model": r"^Maker\s*/\s*Model$", "control_number": r"^NIPHCO Control Number$", "serial_number": r"^Serial Number$",
            "accuracy": r"^Equipment Accuracy$", "calibrated_by": r"^Calibrated by$", "traceability": r"^Traceability$", "certificate_number": r"^Calibration Certificate No"}
    out = {}
    for key, pat in pats.items():
        hit = S.find(pat, r_h + 1, r_h + 10, c_h, c_h + 3)
        if not hit: return None
        r, c = hit[0]
        end = c + S.span.get(S.a(r, c), (1, 1))[1] - 1
        anchors = []
        for cc in range(end + 1, 30):
            p = S.a(r, cc)
            if p[0] != r or p in anchors or S.text(*p) == ":" or S.formula(*p): continue
            if p in S.span or S.val(*p) not in (None, ""): anchors.append(p)
        if not anchors: return None
        best = max(anchors, key=lambda p: S.span.get(p, (1, 1))[1])        # the widest merged cell is the value cell
        out[key] = S.addr(*best)
    return out


def analyze_header(S, notes):
    m, ws = {}, S.ws
    h = {}
    # control-number formulas in the visible block reveal where the hidden data block is
    ctl = re.compile(r"CONCATENATE\(\s*\$?([A-Z]+)\$?(\d+)\s*,\s*\$?([A-Z]+)\$?\2\s*,\s*\$?([A-Z]+)\$?\2\s*,?\s*\)")
    found = []
    for c in S.cells(8, 20, 1, 29):
        f = c.value if isinstance(c.value, str) else ""
        mm = ctl.search(f)
        if mm: found.append((c.column, c.row, int(mm[2]), ci(mm[1])))
    found.sort()
    eut = (found[0][2], found[0][3]) if found else None            # the formula furthest to the LEFT shows the EUT, the others show standards
    std = [(f[2], f[3]) for f in found[1:]]
    if not eut:
        notes.append("HEADER: no CONCATENATE(control no.) formula found - cannot locate the EUT block");  return None, {}
    h["eut_row"], h["eut_first_col"] = eut[0], cl(eut[1])
    if not std:                                                      # the visible block shows =AM17, =AN17 ... : the first one is the 'type' column (4th item)
        refs = []
        for c in S.cells(9, 18, 15, 29):
            pr = PURE_REF.match(c.value) if isinstance(c.value, str) else None
            if pr and eut[0] < int(pr[2]) <= 20: refs.append((c.row, c.column, int(pr[2]), ci(pr[1])))
        if refs:
            refs.sort(); std = [(refs[0][2], refs[0][3] - 3)] + [(r[2], 0) for r in refs[1:]]
            notes.append("HEADER: standard block located through the visible 'Equipment Type' line (no control-number formula)")
    if std:
        h["std_rows"] = sorted({r for r, _ in std}); h["std_first_col"] = cl(std[0][1])
    else:
        direct = analyze_direct_standard(S)
        if direct:
            m["standard_cells"] = direct
            notes.append("HEADER: the standard-equipment block is typed straight into visible cells (no hidden data block) - mapped as standard_cells")
        else: notes.append("HEADER: no standard-equipment block found")
    # series / humidity / application limit labels (hidden block)
    lab = {}
    for key, pat in (("series", r"^Series$"), ("humidity", r"^Humidity$"), ("application_limit", r"^Application Limit$")):
        hits = [p for p in S.find(pat, 8, 12, 12, 60)]
        if hits: lab[key] = hits[0]
    for key in ("series", "application_limit"):
        if key in lab: h[key] = f"{cl(lab[key][1])}{lab[key][0] + 1}"
        else: notes.append(f"HEADER: label for {key} not found")
    # humidity: the visible "Humidity" cell points at the hidden cell (or holds the value itself)
    hum = None
    vis = S.find(r"^Humidity$", 4, 9, 1, 24)
    if vis:
        r, c = vis[0]
        for cc in range(c + 1, 28):
            if S.a(r, cc) == S.a(r, c): continue                     # still inside the label's own merged range
            v = S.val(r, cc)
            if v in (None, "", ":"): continue
            f = S.formula(r, cc)
            pr = PURE_REF.match(f) if f else None
            hum = (int(pr[2]), ci(pr[1])) if pr else (S.a(r, cc))
            break
    if hum is None and "humidity" in lab: hum = (lab["humidity"][0] + 1, lab["humidity"][1])
    if hum:
        v = ws.cell(*hum).value
        if isinstance(v, str) and not v.startswith("=") and not re.match(r"^[\d.]+%?$", v.strip()):
            h["humidity"] = None; notes.append(f"HEADER: humidity cell {cl(hum[1])}{hum[0]} holds text ('{v[:20]}') - humidity is not written")
        else: h["humidity"] = f"{cl(hum[1])}{hum[0]}"
    # dates
    date_off = due_off = None
    for key, pat in (("date", r"^(Verification|Calibration) Date"), ("due", r"^Due Date")):
        hit = S.find(pat, 4, 9, 1, 24)
        if not hit: continue
        r, c = hit[0]
        for cc in range(c + 1, 28):
            if S.a(r, cc) == S.a(r, c): continue
            f = S.formula(r, cc)
            if f is None: continue
            pr = PURE_REF.match(f)
            if pr and int(pr[2]) == eut[0]:
                off = ci(pr[1]) - eut[1]
                if key == "date": date_off = off
                else:
                    due_off = off
                    if S.formula(int(pr[2]), ci(pr[1])) is not None: m["due_date_is_formula"] = True
            else:
                if key == "due": m["due_date_is_formula"] = True
            break
    if m.get("due_date_is_formula") is None and due_off is None: m["due_date_is_formula"] = True
    if date_off is not None and date_off != 15 and date_off != due_off: h["eut_date_offset"] = date_off
    if due_off is not None and due_off != 16: h["eut_due_offset"] = due_off
    if date_off is not None and date_off == due_off:
        m.setdefault("cells", {})["F6"] = {"value": f"={cl(eut[1] + 15)}{eut[0]}"}
        notes.append(f"HEADER: the verification-date cell points at the DUE-date cell ({cl(eut[1] + due_off)}{eut[0]}) - fixed in cells.F6")
    # application limit that the template computes itself
    if "application_limit" in h:
        r, c = int(re.search(r"\d+", h["application_limit"])[0]), ci(re.match(r"[A-Z]+", h["application_limit"])[0])
        if S.formula(r, c): h["application_limit_is_formula"] = True
    # Report No.: =CONCATENATE(": CAL-",I12,AF11) has no '-' between the control number and the series  ->  CAL-TE0001ME26-0050
    rn = re.compile(r'^=CONCATENATE\(\s*("[^"]*CAL-")\s*,\s*(\$?[A-Z]+\$?\d+)\s*,\s*(\$?[A-Z]+\$?\d+)\s*\)$')
    for c in S.cells(4, 6, 1, 29):
        mm = rn.match(c.value) if isinstance(c.value, str) else None
        if mm:
            m.setdefault("cells", {})[c.coordinate] = {"value": f'=CONCATENATE({mm[1]},{mm[2]},"-",{mm[3]})'}
            notes.append(f"HEADER: the Report No. formula in {c.coordinate} has no '-' before the series - fixed")
    m["header"] = h
    return eut, m


def analyze_people(S, m, eut, notes):
    people = {}
    for role, pat in (("verified", r"^Verified by"), ("reviewed", r"^Reviewed by"), ("approved", r"^Approved by")):
        hit = S.find(pat, 3, 8, 10, 40)
        if hit: people[role] = [S.addr(hit[0][0] + 1, hit[0][1]), S.addr(hit[0][0] + 2, hit[0][1])]
        else: notes.append(f"PEOPLE: label '{role}' not found")
    m["people"] = people
    m["default_positions"] = {"verified": "QA Sr. Staff", "reviewed": "QA Sr. Staff", "approved": "QA Superintendent"}
    # required accuracy: the cells that read the EUT 'required accuracy' cell
    req_col = eut[1] + 10
    ra = []
    for r, c in sorted((p for p in [(c.row, c.column) for c in S.cells(12, 18, 1, 20)]), key=lambda p: (p[0], p[1])):
        f = S.formula(r, c) or ""
        if re.search(rf"\$?{cl(req_col)}\$?{eut[0]}\b", f) and re.search(r"(LEFT|MID|RIGHT)\(", f, re.I): ra.append((r, c))
    if len(ra) == 3: m["required_accuracy_cells"] = {"sign": S.addr(*ra[0]), "value": S.addr(*ra[1]), "unit": S.addr(*ra[2])}
    elif len(ra) == 5: m["required_accuracy_cells"] = [{"sign": S.addr(*ra[0]), "value": S.addr(*ra[1]), "unit": S.addr(*ra[2])}, {"value": S.addr(*ra[3]), "unit": S.addr(*ra[4])}]
    elif ra: notes.append(f"ACCURACY: {len(ra)} cells parse the required accuracy - not mapped (template formulas are kept)")
    if len(ra) == 3:                                   # a body formula that MULTIPLIES by the value cell means a % accuracy
        vc = S.addr(*ra[1]); col, row = re.match(r"[A-Z]+", vc)[0], re.search(r"\d+", vc)[0]
        refpat = r"\$?[A-Z]{1,3}\$?\d+"
        mult = re.compile(rf"(?:{refpat}\s*\*\s*\$?{col}\$?{row}\b)|(?:\$?{col}\$?{row}\s*\*\s*{refpat})")
        if any(mult.search(c.value) for c in S.cells(21, None, 1, 29) if isinstance(c.value, str) and c.value.startswith("=")):
            m["required_accuracy_cells"]["percent"] = True


def analyze_body_cells(S, m, eut, notes):
    cells = m.setdefault("cells", {})
    phys = S.find(r"^1\.\s*Physical Condition", 21, None, 1, 12) or S.find(r"^1\.\s*Visual Condition", 21, None, 1, 12)
    res = S.find(r"^2\.\s*Verification Result", 21, None, 1, 12)
    oth = S.find(r"^3\.\s*Others", 21, None, 1, 12)
    def row_cells(r, c0):
        out = []
        for cc in range(c0 + 1, 30):
            p = S.a(r, cc)
            if p[0] == r and p not in out and (S.val(*p) not in (None, "") or p in S.span): out.append(p)
        return out
    r_txt = S.find(r"^The equipment was verified", 17, 24, 1, 6)
    r_vm = S.find(r"^Verification Method", 17, 24, 1, 6)
    cells[S.addr(r_txt[0][0], 2) if r_txt else S.addr(r_vm[0][0] + 1, 2) if r_vm else "B20"] = {"path": "data.verification_method", "keep_if_blank": True}
    if phys:
        r, c = phys[0]
        nxt = row_cells(r, S.a(r, c)[1] + (S.span.get(S.a(r, c), (1, 1))[1] - 1))
        if nxt:
            m["physical_condition_cell"] = S.addr(*nxt[0]); cells[S.addr(*nxt[0])] = "data.physical_condition"
    else: notes.append("BODY: '1. Physical Condition' not found")
    if res:
        r, c = res[0]
        nxt = row_cells(r, S.a(r, c)[1] + (S.span.get(S.a(r, c), (1, 1))[1] - 1))
        if nxt:
            rc = nxt[0]
            if S.formula(*rc) is None:                                       # constant (e.g. 'PARTIAL') -> map it
                cells[S.addr(*rc)] = {"path": "data.verification_result", "fallback": "data.status", "upper": True}
            if len(nxt) > 1 and S.formula(*nxt[1]) is None:
                cells[S.addr(*nxt[1])] = {"path": "data.result_note", "keep_if_blank": True}
            elif len(nxt) > 1: pass
        else: notes.append("BODY: no cell found after '2. Verification Result'")
    else: notes.append("BODY: '2. Verification Result' not found")
    if oth:
        r, c = oth[0]
        for cc in range(c + 1, 30):
            f = S.formula(r, cc)
            if f:
                pr = PURE_REF.match(f)
                want = f"{cl(eut[1] + 11)}{eut[0]}"                      # the issued-to cell of the EUT row
                if pr and f"{pr[1]}{pr[2]}" != want and int(pr[2]) <= HEADER_ROWS:
                    cells[S.addr(r, cc)] = {"value": f"={want}"}; notes.append(f"BODY: 'Equipment issued to' read {pr[1]}{pr[2]}, but the issued-to cell is {want} - fixed")
                break
            if S.text(r, cc) and not re.search(r"issued to", S.text(r, cc), re.I) and S.a(r, cc) == (r, cc):
                cells[S.addr(r, cc)] = {"path": "data.equipment_issued_to", "keep_if_blank": True}; break
    # stabilization
    starts, ends = S.find(r"^Start$", 18, 28), S.find(r"^End$", 18, 28)
    if len(starts) == 1 and len(ends) == 1:
        (sr, sc), (_, ec) = starts[0], ends[0]
        tr = sr + 1
        if not S.find(r"^Time", tr, tr + 1, 1, 20): notes.append(f"STABILIZATION: no 'Time' label on row {tr} - check the cells")
        cells[S.addr(tr, sc)] = "data.stabilization.time_start"; cells[S.addr(tr, ec)] = "data.stabilization.time_end"
        cells[S.addr(tr + 1, sc)] = "data.stabilization.temp_start"
        cells[S.addr(tr + 1, ec)] = {"path": "data.stabilization.temp_end", "fallback": "data.temperature"}
    else: notes.append(f"STABILIZATION: {len(starts)} 'Start' / {len(ends)} 'End' labels - map the stabilization cells by hand")
    return phys[0][0] if phys else None


# ------------------------------------------------------------------------------------------------ measurement tables
DISP = re.compile(r'IF\(\s*AND\(.*"(?:PASSED|Passed)"', re.I)
CMP = re.compile(r"(\$?[A-Z]{1,3}\$?\d+)\s*(?:>=|<=|>|<)")
DIFF = re.compile(r"^=\s*\$?[A-Z]{1,3}\$?\d+\s*-\s*\$?[A-Z]{1,3}\$?\d+\s*$")


def row_label(S, r, inputs, spec):
    """name of a table row: its first static cell.  When that cell is a vertical group label (one solution for 5 trials) the row's own
    label is added:  '84 uS/cm (F.S.=200uS) . 2'"""
    parts = []
    for cc in range(1, 14):
        p = S.a(r, cc)
        if p in inputs or p in spec or p in [x[1] for x in parts]: continue
        v = S.val(*p)
        if v in (None, "") or (isinstance(v, str) and v.startswith("=")): continue
        txt = f"{v:g}" if isinstance(v, (int, float)) else re.sub(r"\s+", " ", str(v)).strip()
        parts.append((txt, p, S.span.get(p, (1, 1))[0] > 1))
    if not parts: return None
    return f"{parts[0][0]} · {parts[1][0]}" if parts[0][2] and len(parts) > 1 else parts[0][0]


def col_label(S, r_first, c):
    """header text above a column (nearest static text whose merged range covers the column)"""
    if c > 29:
        for r in range(r_first, r_first + 4):
            t = S.text(r, c)
            if t and len(t) < 40: return t.strip()
    for r in range(r_first, max(r_first - 7, 0), -1):
        t = S.text(r, c)
        if t and not re.match(r"^(I|II|III|[0-9]+)\.", t) and len(t) < 60 and S.span.get(S.a(r, c), (1, 1))[1] < 12: return t
    return None


def analyze_tables(S, m, eut, notes):
    ws = S.ws
    disp_rows = {}
    for c in S.cells(HEADER_ROWS + 1, None, 1, 29):
        if isinstance(c.value, str) and DISP.search(c.value): disp_rows.setdefault(c.row, []).append(c)
    header_rows = sorted({r for r, _ in S.find(r"^Disposition$", HEADER_ROWS + 1, None, 1, 29)})
    tables = {}
    for r in sorted(disp_rows):
        hr = max([h for h in header_rows if h < r], default=None)
        tables.setdefault(hr, []).append(r)
    groups, owned = [], set()
    for t_i, (hr, rows) in enumerate(sorted(tables.items(), key=lambda kv: kv[1][0]), start=1):
        title = None
        if hr:
            for rr in range(hr - 1, max(hr - 5, 0), -1):
                tt = [S.text(rr, cc) for cc in range(1, 28) if S.text(rr, cc) and S.span.get(S.a(rr, cc), (1, 1))[1] >= 8]
                if tt: title = tt[0]; break
        fields, first_row, per_label, used_names = [], rows[0], {}, set()
        # Roles, read from the formulas:
        #   measured   = what the PASSED/FAILED formula compares with the limits      -> typed by the user
        #   limit base = what the Lower / Upper limit formulas start from (=D30-$J$16) -> a fixed test point
        #   helper     = only read by the Error formula (A - B)                        -> typed (or pre-filled when whole numbers)
        per_row = {}
        for idx, r in enumerate(rows, start=1):
            measured, base, helper = set(), set(), set()
            for c in disp_rows[r]:
                for ref in CMP.findall(c.value): measured |= S.leaves(S.refs(ref)[0])
            for c in S.cells(r, r, 1, 29):
                f = c.value if isinstance(c.value, str) else ""
                if not f.startswith("=") or DISP.search(f): continue
                body_refs = [x for x in S.refs(f) if x[0] > HEADER_ROWS]
                if DIFF.match(f) and len(body_refs) == len(S.refs(f)): [helper.update(S.leaves(x)) for x in body_refs]   # Error = A - B
                else: [base.update(S.leaves(x)) for x in S.refs(f)]                                                       # =E41-$J$16 -> limit
            body = lambda ps: {p for p in ps if p[0] > HEADER_ROWS}
            per_row[r] = (idx, body(measured), body(base), body(helper))
        all_measured = set().union(*[v[1] for v in per_row.values()])
        all_base = set().union(*[v[2] for v in per_row.values()]) - all_measured
        helper_cols = {}
        for r in rows:
            for p in per_row[r][3] - all_measured - all_base: helper_cols.setdefault(p[1], set()).add(p)
        whole = lambda ps: all(isinstance(S.val(*p), (int, float)) and float(S.val(*p)).is_integer() for p in ps)
        fixed_helpers = {col for col, ps in helper_cols.items() if whole(ps)}          # a helper column of whole numbers (EUT display = set-point) is pre-filled
        for col in sorted(fixed_helpers):
            notes.append(f"FIXED: helper column {cl(col)} of '{title or 'table ' + str(t_i)}' holds only whole numbers - pre-filled with them (editable)")
        for r in rows:                                                # pass 2: fields
            idx, measured, base, helper = per_row[r]
            helper = helper - all_measured - all_base
            spec = {p for p in base if S.val(*p) not in (None, "")} - all_measured                         # fixed test points that are filled in
            inputs = measured | {p for p in base if S.val(*p) in (None, "")} | {p for p in helper if p[1] not in fixed_helpers}
            spec |= {p for p in helper if p[1] in fixed_helpers}
            inputs -= owned; spec -= owned
            label = row_label(S, r, inputs, spec)
            named = [p for p in sorted(spec, key=lambda p: (p[0], p[1])) if p[1] <= 29 and "%" not in (ws.cell(*S.a(*p)).number_format or "")]
            if label is None and named:                               # e.g. 'Range Setting' 90 / 100 / 110: the set-point names the row (never a tolerance)
                v = S.val(*named[0]); label = f"{v:g}" if isinstance(v, (int, float)) else str(v)
            row_name = label or f"Row {idx}"
            if row_name in used_names: row_name = f"Row {idx} ({row_name})" if label else f"Row {idx}"      # two rows must never share a name
            used_names.add(row_name)
            per_label[r] = row_name
            for p in sorted(inputs | spec, key=lambda p: (p[0], p[1])):
                cl_ = col_label(S, hr or first_row, p[1]) or ("Value" if p[1] <= 29 else "Standard value (hidden table)")
                v = S.val(*p); is_input = p in inputs
                pct = "%" in (ws.cell(*S.a(*p)).number_format or "")          # a percent-formatted cell: the app works in percent units (3 = 3 %)
                if pct and p[1] > 29 and cl_ == "Standard value (hidden table)": cl_ = "Tolerance (%)"
                fld = {"id": f"t{t_i}_r{idx}_{cl(p[1])}", "cell": S.addr(*p), "label": f"{row_name} - {cl_}", "type": "text" if isinstance(v, str) else "number",
                       "row": f"{row_name}", "col": cl_}
                if is_input: fld["clear_if_blank"] = True                # a blank input must never print the template's sample value
                elif v not in (None, ""): fld["default"] = round(v * 100, 6) if pct and isinstance(v, (int, float)) else v
                if is_input and v not in (None, ""): notes.append(f"SAMPLE: {S.addr(*p)} holds '{v}' in the template - it is cleared when no value is entered")
                fields.append(fld); owned.add(p)
        # empty columns under a header text (e.g. 'Temperature (°C)') that no formula reads: still something the user types
        skip = re.compile(r"disposition|error|limit|lower|upper|average|^trial|^no\b|^unit|^#|range|point|^item|^location|^row|^page", re.I)
        if hr:
            for cc in range(1, 29):
                ha = S.a(hr, cc)
                if ha != (hr, cc): ha = S.a(hr + 1, cc) if S.a(hr + 1, cc)[1] == cc else ha
                htxt = re.sub(r"\s+", " ", S.text(hr, cc) or S.text(hr + 1, cc)).strip()
                if not htxt or skip.search(htxt) or S.a(hr, cc)[1] != cc and S.a(hr + 1, cc)[1] != cc: continue
                cells_ = [S.a(r, cc) for r in rows]
                if len(set(cells_)) != len(rows) or any(p in owned or S.formula(*p) or S.val(*p) not in (None, "") or p[0] != r for p, r in zip(cells_, rows)): continue
                for idx, (r, p) in enumerate(zip(rows, cells_), start=1):
                    fields.append({"id": f"t{t_i}_r{idx}_{cl(p[1])}", "cell": S.addr(*p), "label": f"{per_label.get(r, f'Row {idx}')} - {htxt}", "type": "text" if re.search(r"remark|note|comment", htxt, re.I) else "number",
                                   "row": per_label.get(r, f"Row {idx}"), "col": htxt, "clear_if_blank": True}); owned.add(p)
                notes.append(f"EXTRA COLUMN: '{htxt}' ({cl(cc)}) is empty and read by no formula - added as an input column")
        # 'Unit' column: text typed per row (mH, uF, ohm ...)
        unit_cols = [c for c in range(1, 14) if hr and re.match(r"^Unit", S.text(hr, c) or S.text(hr + 1, c), re.I)]
        for uc in unit_cols[:1]:
            for idx, r in enumerate(rows, start=1):
                p = S.a(r, uc)
                if p in owned or p[0] != r: continue
                v = S.val(*p)
                if isinstance(v, str) and v.startswith("="): continue
                fld = {"id": f"t{t_i}_r{idx}_{cl(p[1])}", "cell": S.addr(*p), "label": f"Row {idx} - Unit", "type": "text", "row": per_label.get(r, f"Row {idx}"), "col": "Unit"}
                if v not in (None, ""): fld["default"] = v
                else: fld["clear_if_blank"] = True
                fields.append(fld); owned.add(p)
        if fields: groups.append({"title": title or f"Measurement table {t_i}", "fields": fields})
    # empty cells read by aggregate formulas that no table row owns (repeatability, off-center ...)
    extra = {}
    for c in S.cells(HEADER_ROWS + 1, None, 1, 40):
        if isinstance(c.value, str) and c.value.startswith("=") and re.search(r"\b(MAX|MIN|AVERAGE|STDEV|SUM)\(", c.value, re.I):
            for ref in S.refs(c.value):
                p = S.a(*ref)
                if p[0] > HEADER_ROWS and p not in owned and S.formula(*p) is None and S.val(*p) in (None, "") and p not in extra: extra[p] = True
    if extra:
        fields = []
        for i, p in enumerate(sorted(extra), start=1):
            cl_ = col_label(S, p[0], p[1]) or f"Column {cl(p[1])}"
            fields.append({"id": f"x_{cl(p[1])}{p[0]}", "cell": S.addr(*p), "label": f"Row {p[0]} - {cl_}", "type": "number", "row": f"Row {p[0]}", "col": cl_, "clear_if_blank": True})
        groups.append({"title": "Other readings", "fields": fields})
        notes.append(f"OTHER: {len(fields)} cells are read by MAX/MIN/AVERAGE/STDEV but belong to no table row - listed under 'Other readings'; check their labels")
    return groups


def analyze_freeform(S, m, notes, phys_row):
    h = m.get("header", {})
    if h.pop("application_limit_is_formula", False):                 # its formula reads body cells that a photo report does not have
        h["application_limit_always"] = True
        notes.append("FREE-FORM: the template's application-limit formula reads empty body cells - the app's application limit is written instead")
    stab = [c for c in m.get("cells", {}) if isinstance(m["cells"][c], str) and "temp_start" in m["cells"][c]]
    top = (int(re.search(r"\d+", stab[0])[0]) + 2) if stab else 26
    bottom = (phys_row - 2) if phys_row else 62
    m["photo_boxes"] = [{"id": "test_data", "from": f"B{top}", "to": f"AC{bottom}"}]
    m["default_attachment_slot"] = "body"
    notes.append(f"FREE-FORM: no measurement formulas - the body (B{top}:AC{bottom}) is a photo box")


def count_pages(pdf):
    """number of pages of a LibreOffice PDF (no external tool needed)"""
    data = open(pdf, "rb").read()
    return len(re.findall(rb"/Type\s*/Page(?![s\w])", data))


def calibrate_scale(path, ws, expected, notes):
    """LibreOffice lays a page out a little taller than Excel, so a template that is exactly 1 page in Excel can spill a blank page.
    Lower the print scale until the page count equals the 'Page No.  1 of N' printed in the template."""
    import shutil, tempfile
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    try:
        import fill_report as fr
        fr.find_soffice()
    except Exception as e:
        notes.append(f"PRINT: LibreOffice not available - print scale not calibrated ({e})"); return None
    start = int(ws.page_setup.scale or 100)
    tmp = tempfile.mkdtemp(prefix="cal_")
    try:
        for scale in range(start, 49, -2):
            wb = openpyxl.load_workbook(path)
            for n in list(wb.sheetnames):
                if n != ws.title: del wb[n]
            wb[ws.title].page_setup.scale = scale
            x, pdf = os.path.join(tmp, "t.xlsx"), os.path.join(tmp, "t.pdf")
            wb.save(x); fr.to_pdf(x, pdf)
            pages = count_pages(pdf)
            if pages == expected:
                notes.append(f"PRINT: print scale {scale}% gives the {expected} page(s) the template announces" + ("" if scale == start else f" (template says {start}%; LibreOffice needs less)"))
                return scale
        notes.append(f"PRINT: no scale between {start}% and 50% gives {expected} page(s) - check the page breaks")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return None


def analyze(path, calibrate=True):
    wb = openpyxl.load_workbook(path)
    name = SHEET if SHEET in wb.sheetnames else next(n for n in wb.sheetnames if n.upper() not in ("LOGIN", "USERS"))
    ws = wb[name]
    S, notes = Sheet(ws), []
    eut, m = analyze_header(S, notes)
    if eut is None: return {"_notes": notes}
    analyze_people(S, m, eut, notes)
    phys_row = analyze_body_cells(S, m, eut, notes)
    groups = analyze_tables(S, m, eut, notes)
    if groups: m["input_groups"] = groups
    else:
        hdr = S.find(r"^Disposition$", HEADER_ROWS + 1, None, 1, 29)
        if hdr:
            notes.append(f"TABLE WITHOUT FORMULAS: a 'Disposition' header exists (row {hdr[0][0]}) but no cell computes it - add the input cells by hand")
            m["needs_review"] = True
        analyze_freeform(S, m, notes, phys_row)
    exp = S.find(r"^\d+\s+of\s+\d+$", 3, 8, 3, 12)
    expected = int(re.search(r"of\s+(\d+)", S.text(*exp[0]))[1]) if exp else None
    if calibrate and expected:
        scale = calibrate_scale(path, ws, expected, notes)
        if scale: m["print_scale"] = scale
    elif not expected: notes.append("PRINT: no 'Page No. 1 of N' text found - print scale not calibrated")
    base = os.path.basename(path)
    key = normalize_key(base)
    per_equipment = bool(CONTROL_RE.match(key))
    head = {"key": key, "label": (f"{key.upper()}" + (f" - {S.val(eut[0], ci(m['header']['eut_first_col']) + 3)}" if per_equipment and isinstance(S.val(eut[0], ci(m['header']['eut_first_col']) + 3), str) else "")) if per_equipment else key.replace("_", " ").title(),
            "template": base, "sheet": name, "match": [key.replace("_", " ")] if not per_equipment else [key]}
    if per_equipment:
        head["per_equipment"] = True; head["keep_template_values"] = True      # the template already carries this unit's own data
        notes.append("PER-EQUIPMENT: header / standard cells keep the template's own values when the app has none; images in the template (illustration photos) are kept")
    seen = {}
    for g in m.get("input_groups", []):
        for f in g["fields"]:
            k = (g["title"], f["row"], f["col"])
            if k in seen: notes.append(f"DUPLICATE: '{f['row']}' / '{f['col']}' appears twice in '{g['title']}' ({seen[k]} and {f['cell']}) - rename a row"); m["needs_review"] = True
            seen[k] = f["cell"]
    out = {**head, **m}
    if "cells" in out and not out["cells"]: del out["cells"]
    out["_notes"] = notes
    return out


def summarize(mapping):
    groups = mapping.get("input_groups", [])
    flags = [n for n in mapping.get("_notes", []) if re.match(r"^(HEADER|PEOPLE|STABILIZATION|BODY|OTHER|TABLE WITHOUT|ACCURACY|PRINT: no)", n)]
    kind = "free-form (photos)" if mapping.get("photo_boxes") else f"{len(groups)} table(s), {sum(len(g['fields']) for g in groups)} fields"
    return kind, flags


def run_one(path, out, calibrate, quiet):
    mapping = analyze(path, calibrate=calibrate)
    if "key" not in mapping:
        print(f"  {os.path.basename(path):42s} FAILED: {mapping.get('_notes')}"); return None
    if out:
        os.makedirs(out, exist_ok=True)
        with open(os.path.join(out, mapping["key"] + ".json"), "w", encoding="utf-8") as f: json.dump(mapping, f, indent=1, ensure_ascii=False)
    kind, flags = summarize(mapping)
    scale = f"{mapping['print_scale']}%" if mapping.get("print_scale") else "-"
    review = "  <-- REVIEW" if flags or mapping.get("needs_review") else ""
    print(f"  {os.path.basename(path):42s} {mapping['key']:18s} {'per-unit' if mapping.get('per_equipment') else 'type    '} {kind:30s} scale {scale:5s}{review}")
    if not quiet:
        for n in flags: print(f"      ! {n}")
    return mapping


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("template", help="an .xlsx/.xlsm template, OR a folder (every template without a mapping yet is analysed)")
    ap.add_argument("--out", help="folder to write <key>.json into")
    ap.add_argument("--quiet", action="store_true"); ap.add_argument("--force", action="store_true", help="folder mode: also redo templates that already have a mapping")
    ap.add_argument("--no-calibrate", action="store_true", help="skip the LibreOffice print-scale calibration")
    a = ap.parse_args()
    if os.path.isdir(a.template):
        done = 0
        for f in sorted(os.listdir(a.template)):
            if not f.lower().endswith((".xlsx", ".xlsm")) or f.startswith("~$"): continue        # ~$ = Excel lock file
            if a.out and not a.force and os.path.exists(os.path.join(a.out, normalize_key(f) + ".json")):
                print(f"  {f:42s} {normalize_key(f):18s} already mapped (use --force to redo)"); continue
            done += bool(run_one(os.path.join(a.template, f), a.out, not a.no_calibrate, a.quiet))
        print(f"\n{done} template(s) analysed" + (f", written to {a.out}" if a.out else " (no --out: nothing written)"))
        print("Open a test PDF of every REVIEW line before using its mapping.")
    else:
        mapping = analyze(a.template, calibrate=not a.no_calibrate)
        if a.out and "key" in mapping:
            os.makedirs(a.out, exist_ok=True)
            with open(os.path.join(a.out, mapping["key"] + ".json"), "w", encoding="utf-8") as f: json.dump(mapping, f, indent=1, ensure_ascii=False)
            print("wrote", os.path.join(a.out, mapping["key"] + ".json"))
        if not a.quiet:
            shown = {k: v for k, v in mapping.items() if k != "input_groups"}
            print(json.dumps(shown, indent=1, ensure_ascii=False))
            for g in mapping.get("input_groups", []): print(f"  group '{g['title']}': {len(g['fields'])} fields")
