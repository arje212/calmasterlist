#!/usr/bin/env python3
"""
preview_template.py  --  render a TEST report from a mapping + template with made-up readings, and say what came out.

    python tools/preview_template.py --mapping mappings/hp0001re.json --template "HP0001RE_Blank_Form.xlsm" --out preview.pdf

Prints one JSON line:
  { "ok": true, "pages": 1, "expected_pages": 1, "errors": 0, "error_cells": [...], "passed": 10, "failed": 0, "warnings": [...] }

Every input gets a plausible reading (its pre-filled test point, or a number found in its row), so a formula that still shows
#DIV/0! / #REF! / #VALUE! means the template or the mapping is wrong - not that a value is missing.
"""
import argparse, json, os, re, shutil, subprocess, sys, tempfile, warnings
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import openpyxl
import fill_report as fr

ERR = re.compile(r"^#(REF!|VALUE!|NAME\?|DIV/0!|N/A|NUM!|NULL!)")


def synth_inputs(m, ws):
    """a plausible reading per input field: the row's test point x (1 +- 0.1 %)"""
    rows = {}
    for g in m.get("input_groups", []):
        for f in g["fields"]:
            rows.setdefault(int(re.search(r"\d+", f["cell"])[0]), []).append(f)
    out = {}
    for r, fs in rows.items():
        spec = next((float(f["default"]) for f in fs if isinstance(f.get("default"), (int, float)) and not isinstance(f.get("default"), bool)), None)
        if spec is None:
            for c in range(2, 12):
                v = ws.cell(r, c).value
                if isinstance(v, (int, float)) and not isinstance(v, bool): spec = float(v); break
        if spec is None:
            for f in fs:
                mm = re.search(r"-?\d+(\.\d+)?", f.get("row", ""))
                if mm: spec = float(mm[0]); break
        spec = 1.0 if spec is None else spec
        for i, f in enumerate(fs):
            if "default" in f: continue
            out[f["id"]] = "A" if f.get("type") == "text" else f"{spec * (1 + 0.001 * ((i % 3) - 1)):.4g}"
    return out


def recalc(xlsx, tmp):
    """LibreOffice opens the file (which recalculates every formula) and saves it again with the values"""
    outdir = os.path.join(tmp, "recalc"); os.makedirs(outdir, exist_ok=True)
    profile = tempfile.mkdtemp(prefix="lo_", dir=tmp)
    uri = "file:///" + profile.replace("\\", "/").lstrip("/")
    subprocess.run([fr.find_soffice(), f"-env:UserInstallation={uri}", "--headless", "--convert-to", "xlsx", "--outdir", outdir, xlsx], capture_output=True, timeout=150)
    return os.path.join(outdir, os.path.basename(xlsx))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mapping", required=True); ap.add_argument("--template", required=True); ap.add_argument("--out", required=True)
    a = ap.parse_args()
    m = json.load(open(a.mapping, encoding="utf-8"))
    tmp = tempfile.mkdtemp(prefix="prev_")
    try:
        ws0 = openpyxl.load_workbook(a.template)[m.get("sheet", "VERIFICATION_REPORT")]
        expected = None
        for row in ws0.iter_rows(min_row=3, max_row=8, max_col=14):
            for c in row:
                mm = re.match(r"^\d+\s+of\s+(\d+)$", str(c.value or "").strip())
                if mm: expected = int(mm[1])
        std = {"control_number": "GB10ST", "equipment_type": "Block Gauge Set", "maker_model": "Mitutoyo / 516-161", "serial_number": "0001537",
               "accuracy": "± 0.12 µm", "calibrated_by": "Test Laboratory", "traceability": "NIST", "certificate_number": "TEST-0001"}
        ctx = {"template_dir": os.path.dirname(a.template), "template_path": a.template, "mapping_dir": os.path.dirname(a.mapping), "template_key": m["key"],
               "report": {"report_number": "VR-2026-0000", "verification_date": "2026-01-15", "next_due_date": "2027-01-15", "result": "Passed"},
               "snapshot": {"equipment_name": m.get("label", m["key"]), "equipment_code": (m["key"].upper() if m.get("per_equipment") else "TE0001ME"), "manufacturer": "TEST", "model": "MODEL-1",
                            "serial_number": "123456", "range": "0 ~ 100", "accuracy": "± 0.5%", "required_accuracy": "± 0.5 % rdg"},
               "data": {"humidity": "55", "temperature": "23.0", "status": "Partial", "application_limit": "0 ~ 100",
                        "verification_method": "TEST - the equipment was verified according to the Nikkoshi standard verification procedure.",
                        "physical_condition": "No physical defect observed", "result_note": "All measured values are within control limit",
                        "equipment_issued_to": "TEST AREA", "inputs": synth_inputs(m, ws0), "standard_equipment": std,
                        "stabilization": {"time_start": "08:30", "time_end": "09:35", "temp_start": "23.0", "temp_end": "23.1"}},
               "standards": [std], "people": {"verified": {"name": "Test Verifier", "position": "QA Sr. Staff"}, "reviewed": {"name": "Test Reviewer", "position": "QA Sr. Staff"},
                                              "approved": {"name": "Test Approver", "position": "QA Superintendent"}}}
        xlsx = os.path.join(tmp, "preview.xlsx")
        warnings_out = fr.build(ctx, xlsx)
        fr.to_pdf(xlsx, a.out)
        pages = len(re.findall(rb"/Type\s*/Page(?![s\w])", open(a.out, "rb").read()))
        err, passed, failed = [], 0, 0
        try:
            wb = openpyxl.load_workbook(recalc(xlsx, tmp), data_only=True)
            for row in wb[m.get("sheet", "VERIFICATION_REPORT")].iter_rows():
                for c in row:
                    v = c.value
                    if isinstance(v, str):
                        if ERR.match(v): err.append(f"{c.coordinate} {v}")
                        elif v.strip().upper() == "PASSED": passed += 1
                        elif v.strip().upper() == "FAILED": failed += 1
        except Exception as e:                                              # the PDF exists; only the value check failed
            warnings_out.append(f"could not check the cell values: {e}")
        print(json.dumps({"ok": True, "pages": pages, "expected_pages": expected, "errors": len(err), "error_cells": err[:12], "passed": passed, "failed": failed, "warnings": warnings_out}))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    try: main()
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)[:400]})); sys.exit(1)
