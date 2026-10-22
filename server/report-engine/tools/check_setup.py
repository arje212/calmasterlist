#!/usr/bin/env python3
"""
check_setup.py  --  why does a template NOT show up in the report editor?

    python tools/check_setup.py                                   # uses ../templates and ../mappings (next to this tools folder)
    python tools/check_setup.py --equipment "LCR Meter" --code LC0004ME
    python tools/check_setup.py --templates "D:\\...\\templates" --mappings "D:\\...\\mappings"

A template appears in the editor only when ALL of these are true:
  1. mappings/<key>.json exists and is valid JSON
  2. an Excel file whose normalised name equals the normalised mapping["template"] is in the templates folder
       ("00. LCR Meter _ Blank Form.xlsm"  ->  "lcr_meter"   - spaces, dots, underscores, "00." and "Blank Form" do not matter)
  3. the server runs the NEW reportEngine.js (it matches by that normalised name) and was restarted
  4. for an equipment: its name contains one of the mapping's keywords (or its control number is the template's name)
"""
import argparse, difflib, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
try:
    from analyze_template import normalize_key
except Exception:                                                     # same rule as reportEngine.js, if analyze_template.py is not here
    def normalize_key(name):
        s = re.sub(r"\.(xlsx|xlsm)$", "", str(name or ""), flags=re.I)
        s = re.sub(r"^\d+[\s._-]+", "", s)
        s = re.sub(r"[\s_-]*blank?[\s_-]*(form|report)?[\s_-]*$", "", s, flags=re.I)
        return re.sub(r"[^a-z0-9]+", "_", s.lower()).strip("_")

norm_words = lambda s: re.sub(r"[^a-z0-9]+", " ", str(s or "").lower()).strip()


def excel_files(folder):
    out = {}
    for root, _dirs, files in os.walk(folder):
        for f in sorted(files):
            if f.lower().endswith((".xlsx", ".xlsm")) and not f.startswith("~$"):
                out.setdefault(normalize_key(f), []).append(os.path.join(root, f))
    return out


def pick(mappings, name, code):
    """the same choice reportEngine.js templateKeyFor() makes"""
    c = re.sub(r"[^a-z0-9]", "", str(code or "").lower())
    if c and c in mappings: return c, "control number"
    text = f" {norm_words(name)} "
    best, score = None, (0, 0, 0)
    for key, m in mappings.items():
        if m.get("per_equipment"): continue
        for w in [key.replace("_", " "), m.get("label"), *(m.get("match") or [])]:
            w = norm_words(w)
            if not w: continue
            whole = 1 if f" {w} " in text else 0
            if not whole and w not in text: continue
            s = (whole, len(w), m.get("priority", 0))
            if s > score: best, score = (key, w), s
    return (best[0], f'keyword "{best[1]}"') if best else (None, None)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--templates", default=os.path.join(HERE, "..", "templates")); ap.add_argument("--mappings", default=os.path.join(HERE, "..", "mappings"))
    ap.add_argument("--engine", default=os.path.join(HERE, "..", "..", "reportEngine.js"), help="path of server/reportEngine.js")
    ap.add_argument("--equipment", help='equipment name as it is in the masterlist, e.g. "LCR Meter"'); ap.add_argument("--code", help="its control number, e.g. LC0004ME")
    a = ap.parse_args()
    problems = 0
    print(f"templates folder : {os.path.abspath(a.templates)}  ({'found' if os.path.isdir(a.templates) else 'NOT FOUND'})")
    print(f"mappings folder  : {os.path.abspath(a.mappings)}  ({'found' if os.path.isdir(a.mappings) else 'NOT FOUND'})")
    files = excel_files(a.templates) if os.path.isdir(a.templates) else {}
    mappings = {}
    if os.path.isdir(a.mappings):
        for f in sorted(os.listdir(a.mappings)):
            if not f.endswith(".json"): continue
            try: m = json.load(open(os.path.join(a.mappings, f), encoding="utf-8-sig")); mappings[m["key"]] = m
            except Exception as e: print(f"  BAD JSON   {f}: {e}"); problems += 1

    print("\n== 1. mappings")
    shown = hidden = 0
    for key, m in sorted(mappings.items()):
        nk = normalize_key(m.get("template", "")) or key
        hit = files.get(nk) or files.get(key)
        if hit: shown += 1; print(f"  OK       {key:24s} <- {os.path.basename(hit[0])}" + ("   (2 files with this name!)" if len(hit) > 1 else ""))
        else:
            hidden += 1; problems += 1
            close = [k for k in files if (nk in k or k in nk) and len(min(nk, k, key=len)) >= 4] or difflib.get_close_matches(nk, list(files), n=1, cutoff=0.9)
            hint = (f"   -> maybe this file has extra words in its name: {os.path.basename(files[close[0]][0])}" if close else "")
            print(f"  HIDDEN   {key:24s} no Excel file named like \"{m.get('template')}\" (looked for '{nk}')" + hint)
    print("\n== 2. Excel files that have no mapping")
    used = {normalize_key(m.get("template", "")) or k for k, m in mappings.items()} | set(mappings)
    none = True
    for nk, paths in sorted(files.items()):
        if nk in used: continue
        none = False; problems += 1
        print(f"  UNMAPPED {os.path.basename(paths[0]):46s} key '{nk}'  -> python tools/analyze_template.py \"{os.path.basename(paths[0])}\" --out mappings")
    if none: print("  none")

    print("\n== 3. server files")
    engine = a.engine if os.path.exists(a.engine) else None
    if engine:
        t = open(engine, encoding="utf-8", errors="ignore").read()
        new = "per_equipment" in t and "blank?" in t
        print(f"  reportEngine.js  : {'NEW version' if new else 'OLD version - replace it with the one from report-engine-update'}  ({os.path.abspath(engine)})"); problems += (not new)
    else: print(f"  reportEngine.js  : not found at {os.path.abspath(a.engine)} (use --engine)")
    fr = os.path.join(HERE, "..", "fill_report.py")
    if os.path.exists(fr):
        t = open(fr, encoding="utf-8", errors="ignore").read()
        print(f"  fill_report.py   : {'NEW version' if 'standard_cells' in t and 'template_path' in t else 'OLD version - replace it'}"); problems += not ('standard_cells' in t and 'template_path' in t)

    if a.equipment or a.code:
        print(f"\n== 4. which template does equipment \"{a.equipment or ''}\" {('(' + a.code + ') ') if a.code else ''}get?")
        key, why = pick(mappings, a.equipment, a.code)
        if not key: print("  NONE - no keyword of any mapping appears in that name.\n  Add a keyword to the mapping's \"match\" list, or rename the equipment.")
        else:
            nk = normalize_key(mappings[key].get("template", "")) or key
            ok = bool(files.get(nk) or files.get(key))
            print(f"  -> {key} (by {why})  " + ("and its Excel file is there: it WILL show in the editor" if ok else "BUT its Excel file is missing: it will NOT show (see HIDDEN above)"))

    print(f"\nSUMMARY: {shown} mapping(s) will show in the editor, {hidden} are hidden because the Excel file is missing."
          + ("  Restart the Node server after any change." if problems else "  Everything checks out - restart the Node server if you just changed files."))


if __name__ == "__main__":
    main()
