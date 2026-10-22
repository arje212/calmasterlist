"""Generates mappings/*.json for the TESTING EQUIPMENT templates (batch 3) - same idea as make_mappings_2.py, but the cells are
   found by tools/analyze_template.py instead of being typed in by hand.  Only the names and the keywords live here.

   python tools/make_mappings_3.py "D:\\...\\Testing Equipment\\Blank Form"           # folder that holds the .xlsm / .xlsx templates
   python tools/make_mappings_3.py <folder> --out mappings --no-calibrate         # skip the LibreOffice print-scale calibration

   Re-run it after a template changes.  Anything the analyzer is unsure about is written to "_notes" in the JSON."""
import argparse, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import analyze_template as an

# key (= template file name without "00. " / "_Blank Form")  ->  (label, keywords).   Longest keyword wins when the app picks a template.
BATCH = {
    "conductivity_meter":  ("Conductivity Meter",  ["conductivity meter", "conductivity"]),
    "digital_light_meter": ("Digital Light Meter", ["digital light meter", "light meter", "lux meter", "illuminance meter"]),
    "layer_short":         ("Layer Short",         ["layer short", "layer short tester"]),
    "lcr_meter":           ("LCR Meter",           ["lcr meter", "lcr"]),
    "polarity_tester":     ("Polarity Tester",     ["polarity tester", "polarity"]),
    "resistance_tester":   ("Resistance Tester",   ["resistance tester"]),
    "curve_tracer":        ("Curve Tracer",        ["curve tracer"]),
    "digital_multimeter":  ("Digital Multimeter",  ["digital multimeter"]),          # a bare "multimeter" stays with handheld_multimeter
}

if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("folder"); ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "mappings"))
    ap.add_argument("--no-calibrate", action="store_true")
    a = ap.parse_args(); os.makedirs(a.out, exist_ok=True); done = set()
    for f in sorted(os.listdir(a.folder)):
        key = an.normalize_key(f)
        if key not in BATCH or f.startswith("~$") or not f.lower().endswith((".xlsx", ".xlsm")): continue
        m = an.analyze(os.path.join(a.folder, f), calibrate=not a.no_calibrate)
        if "key" not in m: print("FAILED", f, m.get("_notes")); continue
        m["label"], m["match"] = BATCH[key]
        with open(os.path.join(a.out, key + ".json"), "w", encoding="utf-8") as fh: json.dump(m, fh, indent=1, ensure_ascii=False)
        done.add(key); kind, flags = an.summarize(m)
        print(f"  {key:20s} {kind:28s} scale {m.get('print_scale', '-')}" + ("   <-- REVIEW" if flags else ""))
    print("not found in the folder:", sorted(set(BATCH) - done) or "none")
