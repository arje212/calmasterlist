"""Generates mappings/*.json for 16 more templates (same idea as make_mappings.py).
   Re-run after changing a template layout:  python tools/make_mappings_2.py
   Needs the 4 header/option extensions in fill_report.py (see fill_report.py next to this file):
     header.eut_date_offset / eut_due_offset, header.application_limit_is_formula, keep_standard_if_empty,
     required_accuracy_cells as list + "percent", cells[...].keep_if_blank"""
import json, os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "mappings")
os.makedirs(OUT, exist_ok=True)
POS = {"verified": "QA Sr. Staff", "reviewed": "QA Sr. Staff", "approved": "QA Superintendent"}
PEOPLE = {"verified": ["R6", "R7"], "reviewed": ["V6", "V7"], "approved": ["Z6", "Z7"]}
RA = {"sign": "I16", "value": "J16", "unit": "K16"}

def dump(key, m):
    with open(os.path.join(OUT, key + ".json"), "w", encoding="utf-8") as f:
        json.dump(m, f, indent=1, ensure_ascii=False)
def F(id, cell, label, **kw): return {"id": id, "cell": cell, "label": label, "type": kw.pop("type", "number"), **kw}
def M(v): return {"value": v}                                  # literal / formula written into a cell
def H(series, hum, app, eut_row, eut_col, std_rows, std_col, **kw):
    return {"series": series, "humidity": hum, "application_limit": app, "eut_row": eut_row, "eut_first_col": eut_col,
            "std_rows": std_rows, "std_first_col": std_col, **kw}
def stab(c_start, c_end, time_row):                            # Start/End labels sit one row above `time_row`
    return {f"{c_start}{time_row}": "data.stabilization.time_start", f"{c_end}{time_row}": "data.stabilization.time_end",
            f"{c_start}{time_row + 1}": "data.stabilization.temp_start",
            f"{c_end}{time_row + 1}": {"path": "data.stabilization.temp_end", "fallback": "data.temperature"}}
def body(method, phys, note, result=None, issued=None, **extra):
    c = {method: "data.verification_method", phys: "data.physical_condition",
         note: {"path": "data.result_note", "keep_if_blank": True}}
    if result: c[result] = {"path": "data.verification_result", "fallback": "data.status", "upper": True}
    if issued: c[issued] = {"path": "data.equipment_issued_to", "keep_if_blank": True}
    c.update(extra); return c
def _rc(label):
    """'Test point 1 - EUT measured (°C)' -> ('Test point 1', 'EUT measured (°C)');  no ' - ' -> (label, 'Value')"""
    i = label.rfind(" - ")
    return (label[:i], label[i + 3:]) if i > 0 else (label, "Value")
def build(key, label, tpl, match, header, phys, cells, groups, **kw):
    for g in groups or []:                                         # row / col hints -> the UI draws a real table
        for f in g["fields"]:
            if "row" not in f: f["row"], f["col"] = _rc(f["label"])
    m = {"key": key, "label": label, "template": tpl, "sheet": "VERIFICATION_REPORT", "match": match, "header": header}
    m.update({k: v for k, v in kw.items() if k in ("due_date_is_formula", "keep_standard_if_empty", "fixed_standard", "priority", "photo_boxes", "default_attachment_slot")})
    m["required_accuracy_cells"] = kw.get("ra", RA)
    if kw.get("ra", RA) is None: del m["required_accuracy_cells"]
    m["people"] = kw.get("people", PEOPLE); m["default_positions"] = POS
    m["physical_condition_cell"] = phys; m["cells"] = cells
    if groups: m["input_groups"] = groups
    if "print_scale" in kw: m["print_scale"] = kw["print_scale"]
    dump(key, m)
def grid(prefix, rows, cols, label, **kw):                      # rows: [(row, text)], cols: [letters]
    return [F(f"{prefix}{i + 1}_{k + 1}", f"{c}{r}", label(t, k + 1), clear_if_blank=True, **kw)
            for i, (r, t) in enumerate(rows) for k, c in enumerate(cols)]

# ============================================================== Digimatic Indicator  (5 readings per gauge block)
gb = [(30 + i, v) for i, v in enumerate([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12.5])]
build("digimatic_indicator", "Digimatic Indicator", "00. Digimatic Indicator_Blank Form.xlsx", ["digimatic indicator", "digimatic"],
      H("AE11", "AH11", "AK11", 14, "AE", [17], "AF"), "M44",
      {**body("B20", "M44", "Q47"), **stab("P", "V", 24), "P55": M("=AK11")}, [
      {"title": "Height measurement (mm) - EUT readings per gauge block", "fields":
          grid("gb", gb, list("HJLNP"), lambda t, k: f"GB {t} mm - reading {k}")}], due_date_is_formula=True, print_scale=92)

# ============================================================== Dial Indicator  (standard + EUT per test point)
dial = []
for i in range(15):
    dial += [F(f"std_{i + 1}", f"H{29 + i}", f"Test point {i + 1} - standard measured value", clear_if_blank=True),
             F(f"eut_{i + 1}", f"K{29 + i}", f"Test point {i + 1} - EUT measured value", clear_if_blank=True)]
build("dial_indicator", "Dial Indicator", "00. Dial Indicator_Blank Form.xlsx", ["dial indicator"],
      H("AE11", "AH11", "AK11", 14, "AE", [17], "AF"), "N45",
      {**body("B20", "N45", "Q48"), **stab("Q", "V", 24)}, [{"title": "Test points (standard / EUT)", "fields": dial}],
      due_date_is_formula=True, print_scale=90)

# ============================================================== Digital Pressure Gauge  (header block is 1 row higher; humidity = M7)
inc = [(29 + i, v) for i, v in enumerate([0, 100, 200, 300, 400, 500, 600])]
dec = [(38 + i, v) for i, v in enumerate([500, 400, 300, 200, 100, 0])]
dpg = []
for tag, rows, name in (("inc", inc, "Increasing"), ("dec", dec, "Decreasing")):
    for i, (r, v) in enumerate(rows):
        dpg += [F(f"{tag}_std_{i + 1}", f"H{r}", f"{name} {i + 1} - standard (kPa)", default=v),
                F(f"{tag}_eut_{i + 1}", f"K{r}", f"{name} {i + 1} - EUT measured (kPa)", clear_if_blank=True)]
build("digital_pressure_gauge", "Digital Pressure Gauge", "00. Digital Pressure Gauge_Blank Form.xlsx",
      ["digital pressure gauge", "pressure gauge"],
      H("AE10", "M7", "AK10", 13, "AE", [16], "AF", application_limit_is_formula=True),
      "M45", {**body("B20", "M45", "Q48", result="M48", issued=None), **stab("Q", "V", 24)},
      [{"title": "Increasing / decreasing pressure (kPa)", "fields": dpg}],
      ra={**RA, "percent": True}, print_scale=95)

# ============================================================== Digital Tachometer  (header block at AI, dates +16/+17, humidity = O7)
tach_std = [60, 120, 600, 1200, 6000, 12001, 60000, 72000, 84000, 99000]
tach = []
for i, v in enumerate(tach_std):
    tach += [F(f"std_{i + 1}", f"I{32 + i}", f"Check item {i + 1} - standard value (RPM)", default=v),
             F(f"eut_{i + 1}", f"L{32 + i}", f"Check item {i + 1} - EUT measured (RPM)", clear_if_blank=True)]
build("digital_tachometer", "Digital Tachometer", "00. Digital Tachometer_Blank Form.xlsx", ["tachometer"],
      H("AI11", "O7", "AO11", 14, "AI", [17], "AJ", eut_date_offset=16, eut_due_offset=17),
      "M43", {**body("B20", "M43", "Q46", result="M46", issued="M49"), **stab("Q", "U", 25), "L55": M("=AO11"),
       "N5": M('=CONCATENATE("CAL-",J12,"-",AI11)'),                         # template had J12:P12 (range) -> control no. missing
       "Y12": M("=CONCATENATE(AJ17,AK17,AL17)"), "Y13": M("=AP17"), "Y14": M("=AQ17"),   # reference-equipment rows had no formulas
       "Y15": M("=AR17"), "Y16": M("=AS17"), "Y17": M("=AT17")},
      [{"title": "Non-contact (RPM)", "fields": tach}], ra=None,
      people={"verified": ["T6", "T7"], "reviewed": ["X6", "X7"], "approved": ["AB6", "AB7"]}, print_scale=88)

# ============================================================== Flat Bar  (Point A / Point B per test point)
fb = []
for i in range(12):
    fb += [F(f"a_{i + 1}", f"J{39 + i}", f"Test point {i + 1} - Point A (mm)", clear_if_blank=True),
           F(f"b_{i + 1}", f"M{39 + i}", f"Test point {i + 1} - Point B (mm)", clear_if_blank=True)]
build("flat_bar", "Flat Bar", "00. Flat Bar_Blank Form.xlsx", ["flat bar"],
      H("AE11", "AH11", "AK11", 14, "AE", [17], "AF"), "L54", {**body("B20", "L54", "P57"), **stab("Q", "U", 24)},
      [{"title": "Flatness measurement (mm)", "fields": fb}], print_scale=80)

# ============================================================== Handheld Multimeter  (resistance + DCV; standards are fixed in template)
def meter(prefix, rows, units):
    name = {"res_": "Resistance", "dcv_": "DCV"}[prefix]
    return [F(f"{prefix}{i + 1}", f"{col}{r}", f"{name} {i + 1} ({u}) - EUT measured", clear_if_blank=True)
            for i, ((r, col), u) in enumerate(zip(rows, units))]
hm_r = [(29 + i, "L") for i in range(12)]; hm_v = [(44 + i, "L") for i in range(10)]
hm_ru = ["Ω"] * 4 + ["kΩ"] * 8
build("handheld_multimeter", "Handheld Multimeter", "00. Handheld Multimeter_Blank Form.xlsx", ["handheld multimeter", "multimeter"],
      H("AE11", "AH11", "AK11", 14, "AE", [17], "AF", application_limit_is_formula=True), "L56",
      {**body("B20", "L56", "P59"), **stab("P", "T", 24),
       "AK11": M('=CONCATENATE("DCR : ", L29, "Ω ~ ", L40, "kΩ ", "/ DCV : ", L44, "V ~ ", L53, "V")')},   # template had #REF! for the last term
      [{"title": "Resistance measurement", "fields": meter("res_", hm_r, hm_ru)},
       {"title": "Voltage measurement (DCV)", "fields": meter("dcv_", hm_v, ["V"] * 10)}],
      ra={**RA, "percent": True}, print_scale=82)

# ============================================================== Laser Micrometer  (8 diameters x 6 X-positions x 5 trials)
xs = [25, 35, 45, 55, 65, 75]
dias = [(2.1, 44), (2.375, 50), (2.571, 56), (2.752, 74), (3.025, 80), (3.175, 86), (3.3, 92), (3.5, 98)]
lm = []
for di, (d, r0) in enumerate(dias):
    for xi, x in enumerate(xs):
        for k, c in enumerate("IKMOQ"):
            lm.append(F(f"d{di + 1}_x{x}_t{k + 1}", f"{c}{r0 + xi}", f"Ø{d} mm @ {x} mm - trial {k + 1}", clear_if_blank=True))
build("laser_micrometer", "Laser Micrometer", "00. Laser Micrometer_Blank Form.xlsx", ["laser micrometer"],
      H("AE11", "AH11", "AK11", 14, "AE", [17], "AF", application_limit_is_formula=True), "L112",
      {**body("B20", "L112", "Q115"), **stab("P", "T", 24), "F6": M("=AT14")},          # template had F6 = AU14 (due date) by mistake
      [{"title": "Measurement result (mm) - trials 1-5 per diameter / X-position", "fields": lm}], priority=10, print_scale=76)

# ============================================================== Measuring Microscope  (template has NO formulas -> we add them)
ms = [(33 + 2 * i, "X" if i < 6 else "Y") for i in range(11)]
msf, mcells = [], {}
for i, (r, ax) in enumerate(ms):
    msf += [F(f"spec_{i + 1}", f"H{r}", f"Length {ax} #{i + 1} - standard specified value (mm)", clear_if_blank=True),
            F(f"eut_{i + 1}", f"L{r}", f"Length {ax} #{i + 1} - EUT measured (mm)", clear_if_blank=True)]
    mcells.update({f"O{r}": M(f'=IF(AND(ISNUMBER(L{r}),ISNUMBER(H{r})),L{r}-H{r},"")'),
                   f"R{r}": M(f'=IF(ISNUMBER(H{r}),H{r}-$J$16,"")'), f"U{r}": M(f'=IF(ISNUMBER(H{r}),H{r}+$J$16,"")'),
                   f"X{r}": M(f'=IF(AND(ISNUMBER(L{r}),ISNUMBER(H{r})),IF(AND(L{r}>=R{r},L{r}<=U{r}),"PASSED","FAILED"),"")')})
build("measuring_microscope", "Measuring Microscope", "00. Measuring Microscope_Blank Form.xlsx", ["measuring microscope", "microscope"],
      H("AE11", "AH11", "AK11", 14, "AE", [17], "AF"), "L61",
      {**body("B20", "L61", "P64", result="L64"), **stab("P", "T", 24), **mcells},
      [{"title": "Length measurement (mm)", "fields": msf}], print_scale=82)

# ============================================================== Micrometer  (parallelism @ gauge block + 8 measurement points x 5 readings)
mic = [F(f"par_{n}", f"{c}31", f"Parallelism (gauge block 10 mm) - {n.title()}", clear_if_blank=True) for n, c in (("top", "K"), ("middle", "M"), ("bottom", "O"))]
pts = [1, 2, 3, 5, 10, 15, 20, 25]
mic_m = grid("pt", [(36 + i, v) for i, v in enumerate(pts)], list("IKMOQ"), lambda t, k: f"Gauge block {t} mm - reading {k}")
build("micrometer", "Micrometer", "00. Micrometer_Blank Form.xlsx", ["micrometer"],
      H("AE11", "AH11", "AK11", 14, "AE", [17], "AF"), "L49",
      {**body("B20", "L49", "P52", result="L52"), **stab("P", "T", 24)},
      [{"title": "Parallelism (mm)", "fields": mic}, {"title": "Measurement (mm)", "fields": mic_m}], print_scale=80)

# ============================================================== MultiTester
mt_r = [(30 + i, "L") for i in range(12)]; mt_v = [(47 + i, "L") for i in range(10)]
build("multitester", "MultiTester", "00. MultiTester_Blank Form.xlsx", ["multitester", "multi tester", "multi-tester"],
      H("AE11", "AH11", "AK11", 14, "AE", [17], "AF"), "L58", {**body("B20", "L58", "P61"), **stab("P", "T", 24)},
      [{"title": "Resistance measurement", "fields": meter("res_", mt_r, hm_ru)},
       {"title": "Voltage measurement - DCV", "fields": meter("dcv_", mt_v, ["V"] * 10)}],
      ra={**RA, "percent": True}, print_scale=71)

# ============================================================== pH Meter  (header block at AI, standard is fixed in template)
ph = [F("buf1", "E28", "Buffer 1 - indicated value (pH)", default=4), F("buf2", "E31", "Buffer 2 - indicated value (pH)", default=7.03),
      F("buf3", "E34", "Buffer 3 - indicated value (pH)", default=10.06),
      F("t1", "I28", "Buffer 1 - temperature (°C)", clear_if_blank=True), F("t2", "I31", "Buffer 2 - temperature (°C)", clear_if_blank=True),
      F("t3", "I34", "Buffer 3 - temperature (°C)", clear_if_blank=True)]
for b in range(3):
    for k in range(3):
        ph.append(F(f"eut_{b + 1}_{k + 1}", f"L{28 + 3 * b + k}", f"Buffer {b + 1} - EUT reading {k + 1} (pH)", clear_if_blank=True))
build("ph_meter", "pH Meter", "00. pH Meter_Blank Form.xlsx", ["ph meter", "ph-meter"],
      H("AI11", "AL11", "AO11", 14, "AI", [17], "AJ", application_limit_is_formula=True),
      "M39", {**body("B19", "M39", "R42", issued=None), **stab("S", "W", 23)}, [{"title": "pH measurement", "fields": ph}],
      ra={"sign": "J16", "value": "K16", "unit": "L16"}, fixed_standard=True, due_date_is_formula=True,
      people={"verified": ["T6", "T7"], "reviewed": ["X6", "X7"], "approved": ["AB6", "AB7"]}, print_scale=94)

# ============================================================== Plastic / Steel Ruler  (header block at AG, row 13; mm table + inch table)
def ruler(key, label, tpl, h_is_input):
    """Plastic ruler: H (EUT specified value) and K (standard measured) are both inputs.  Steel ruler: H is fixed in template."""
    fs, fi = [], []
    for i in range(16):
        if h_is_input: fs.append(F(f"mm_spec_{i + 1}", f"H{30 + i}", f"mm #{i + 1} - EUT specified value", clear_if_blank=True))
        fs.append(F(f"mm_meas_{i + 1}", f"K{30 + i}", f"mm #{i + 1} - standard measured value", clear_if_blank=True))
    for i in range(12):
        if h_is_input: fi.append(F(f"in_spec_{i + 1}", f"H{62 + i}", f"inch #{i + 1} - EUT specified value", clear_if_blank=True))
        fi.append(F(f"in_meas_{i + 1}", f"K{62 + i}", f"inch #{i + 1} - standard measured value", clear_if_blank=True))
    build(key, label, tpl, [label.lower()], H("AG10", "AJ10", "AM10", 13, "AG", [16], "AH"), "K79",
          {**body("B20", "K79", "N82", result="K82", issued=None), **stab("Q", "V", 24)},
          [{"title": "Length measurement (mm)", "fields": fs}, {"title": "Length measurement (inch)", "fields": fi}],
          ra=[{"sign": "I16", "value": "J16", "unit": "K16"}, {"value": "M16", "unit": "N16"}],
          people={"verified": ["R6", "R7"], "reviewed": ["W6", "W7"], "approved": ["AA6", "AA7"]}, print_scale=99)
ruler("plastic_ruler", "Plastic Ruler", "00. Plastic Ruler_Blank Form.xlsx", True)
ruler("steel_ruler", "Steel Ruler", "00. Steel Ruler_Blank Form.xlsx", False)

# ============================================================== Pocket Weighing Scale  (header block at AF; like Balance + hidden weight table)
pw = [F(f"w_a{i + 1}", f"AH{30 + i}", f"Weight set A #{i + 1} (nominal {n} g) - actual value (g)", default=n)
      for i, n in enumerate([1, 5, 10, 20, 20, 50, 50, 50, 100, 100])]
pw += [F(f"w_b{i + 1}", f"AJ{30 + i}", f"Weight set B #{i + 1} (nominal {n} g) - actual value (g)", default=n)
       for i, n in enumerate([100, 100, 200, 200, 40, 45, 35, 50, 100])]
dep = [F(f"eut_{i + 1}", f"H{30 + i}", f"EUT measured value {i + 1} (g)", clear_if_blank=True) for i in range(9)]
ron = [F(f"rep_on_{i + 1}", f"J{44 + i}", f"Repeatability - Load On #{i + 1}", clear_if_blank=True, row=f"Reading {i + 1}", col="Load On") for i in range(10)]
roff = [F(f"rep_off_{i + 1}", f"M{44 + i}", f"Repeatability - Load Off #{i + 1}", clear_if_blank=True, row=f"Reading {i + 1}", col="Load Off") for i in range(10)]
offc = [F(f"off_{k}", f"{c}69", f"Off-center - {k.title()}", clear_if_blank=True, row="Off-center (g)", col=k.title())
        for k, c in (("center", "H"), ("back", "L"), ("front", "P"), ("left", "T"), ("right", "X"))]
build("pocket_weighing_scale", "Pocket Weighing Scale", "00. Pocket Weighing Scale_Blank Form.xlsx",
      ["pocket weighing scale", "pocket scale"],
      H("AF11", "AI11", "AL11", 14, "AF", [17], "AG", application_limit_is_formula=True), "L107",
      {**body("B20", "L107", "R110", result="L110"), **stab("P", "U", 24)},
      [{"title": "Standard weights - actual values (hidden table AE28:AL39)", "fields": pw},
       {"title": "1. Departure from nominal value (g)", "fields": dep},
       {"title": "2. Repeatability of reading (g)", "fields":
           [F("rep_std", "D44", "Repeatability standard load (g)  [template cell D44 is #REF!]", default=100, row="Standard load (g)", col="Value")] + ron + roff},
       {"title": "3. Off center loading (g)", "fields": offc}], priority=10, print_scale=91)

# ============================================================== Push Pull Gauge Digital  (standards come from hidden AJ32:AJ38)
ppw = [F(f"w{i + 1}", f"AJ{32 + i}", f"Standard weight {i + 1} (nominal {n} g) - actual value (g)", default=n)
       for i, n in enumerate([5, 10, 20, 50, 50, 100, 100])]
ppe = [F(f"eut_{i + 1}", f"K{31 + i}", f"Test point {i + 1} - EUT measured (g-f)", clear_if_blank=True) for i in range(11)]
build("push_pull_gauge", "Push Pull Gauge Digital", "00. Push Pull Gauge Digital_Blank Form.xlsx",
      ["push pull gauge", "push-pull", "push pull"],
      H("AE11", "AH11", "AK11", 14, "AE", [17], "AF"), "L47",
      {**body("B20", "L47", "P50"), **stab("P", "T", 24),
       "L50": M("=UPPER(I17)"), "L51": M("=AK11")},                  # template had L50 = F23, L51 = I23 (both empty cells)
      [{"title": "Standard weights (hidden table AJ32:AJ38)", "fields": ppw},
       {"title": "Mass measurement (g-f)", "fields": ppe}], print_scale=82)

# ============================================================== Scale Lupe  (X and Y length; specified values are fixed)
sx = [F(f"x_{i + 1}", f"K{31 + i}", f"X #{i + 1} - measured value (mm)", clear_if_blank=True) for i in range(11)]
sy = [F(f"y_{i + 1}", f"K{47 + i}", f"Y #{i + 1} - measured value (mm)", clear_if_blank=True) for i in range(11)]
build("scale_lupe", "Scale Lupe", "00. Scale Lupe_Blank Form.xlsx", ["scale lupe", "lupe", "loupe"],
      H("AE11", "AH11", "AK11", 14, "AE", [17], "AF"), "L60", {**body("B20", "L60", "P63"), **stab("P", "T", 24)},
      [{"title": "X value : length measurement (mm)", "fields": sx}, {"title": "Y value : length measurement (mm)", "fields": sy}],
      print_scale=82)

# ####################################################################################################################
#  PART 2 - 12 more templates
#  Template file names follow the upload names:  "00__X_Blank_Form" = "00. X_Blank Form"  (".", " " -> "_")
# ####################################################################################################################
FREE = [{"id": "test_data", "from": "B26", "to": "AC62"}]          # blank body area -> photo / screenshot box (like Air Particle Counter)
def fixed_issued(cell, row=14): return {cell: M(f"=AP{row}")}      # several templates print AP17 (certificate no.) as "issued to"

# ============================================================== Free-form bodies: Tension Meter / Thermometer / Thickness Gauge
for key, label, tpl, match in (
        ("tension_meter", "Tension Meter", "00. Tension Meter_Blank Form.xlsx", ["tension meter"]),
        ("thermometer", "Thermometer", "00. Thermometer_Blank Form.xlsx", ["thermometer"]),
        ("thickness_gauge", "Thickness Gauge", "00. Thickness Gauge_Blank Form.xlsx", ["thickness gauge"])):
    build(key, label, tpl, match, H("AE11", "AH11", "AK11", 14, "AE", [17], "AF"), "L64",
          {**body("B20", "L64", "P67"), **stab("P", "T", 24), **fixed_issued("T70")}, None,
          photo_boxes=FREE, default_attachment_slot="body", print_scale=82)

# ============================================================== Temperature Tester  (template formulas point at merged children -> rewritten)
tt_pts = [-50, -30, -10, 0, 10, 30, 50, 100, 150, 200, 300, 400, 500, 750, 1000]
tt, tcells = [], {}
for i, v in enumerate(tt_pts):
    r = 32 + i
    tt += [F(f"std_{i + 1}", f"G{r}", f"Test point {i + 1} - standard source value (°C)", default=v),
           F(f"eut_{i + 1}", f"J{r}", f"Test point {i + 1} - EUT measured (°C)", clear_if_blank=True)]
    tcells.update({f"N{r}": M(f'=IF(ISNUMBER(J{r}),J{r}-G{r},"")'),
                   f"W{r}": M(f'=IF(ISNUMBER(J{r}),IF(AND(J{r}>=Q{r},J{r}<=T{r}),"PASSED","FAILED"),"")')})   # template used K/H (merged children)
build("temperature_tester", "Temperature Tester", "00. Temperature Tester_Blank Form.xlsx", ["temperature tester"],
      H("AE11", "AH11", "AK11", 14, "AE", [17], "AF"), "L53",
      {**body("B20", "L53", "P56"), **stab("P", "T", 24), **tcells}, [{"title": "Temperature measurement (°C)", "fields": tt}], print_scale=82)

# ============================================================== Thermohygrometer  (3 locations; humidity text + application limit are formulas)
th_loc = [F("loc1", "E32", "Location 1 - temperature test point (End user area)", type="text", default="End User Area\n()"),
          F("loc2", "E33", "Location 2 - temperature test point", type="text", default="Higher Temp. Area\n()"),
          F("loc3", "E34", "Location 3 - temperature test point", type="text", default="Lower Temp. Area\n()"),
          F("rh_loc2", "E40", "Location 2 - RH test point", type="text", default="Higher RH. Area\n()"),
          F("rh_loc3", "E41", "Location 3 - RH test point", type="text", default="Lower RH Area\n()")]
th_stab = [F(f"t_{n}", c + "26", f"Location {i + 1} - time {n}", type="text", clear_if_blank=True)
           for i, (a, b) in enumerate((("N", "P"), ("R", "T"), ("V", "X"))) for n, c in (("start", a), ("end", b))]
th_stab += [F(f"temp_start_{i + 1}", f"{c}27", f"Location {i + 1} - start temperature (°C)", clear_if_blank=True) for i, c in enumerate("NRV")]
th_t = [F(f"{k}_{i + 1}", f"{c}{32 + i}", f"Temp location {i + 1} - {n} (°C)", clear_if_blank=True) for i in range(3) for k, c, n in (("tstd", "J", "standard"), ("teut", "M", "EUT measured"))]
th_h = [F(f"{k}_{i + 1}", f"{c}{39 + i}", f"RH location {i + 1} - {n} (%)", clear_if_blank=True) for i in range(3) for k, c, n in (("hstd", "J", "standard"), ("heut", "M", "EUT measured"))]
build("thermohygrometer", "Thermohygrometer", "00. Thermohygrometer_Blank Form.xlsx", ["thermohygrometer", "thermo-hygrometer", "thermo hygrometer"],
      H("AE11", None, "AK11", 14, "AE", [17], "AF", application_limit_is_formula=True), "L45",
      body("B20", "L45", "R48"), [{"title": "Stabilization details (3 locations)", "fields": th_stab},
                                  {"title": "Test locations", "fields": th_loc},
                                  {"title": "A. Temperature (°C)", "fields": th_t}, {"title": "B. Relative humidity (%)", "fields": th_h}],
      ra=[{"sign": "I16", "value": "J16", "unit": "K16"}, {"value": "L16", "unit": "M16", "percent": True}], priority=10, print_scale=82)

# ============================================================== TMR  (EUT cells hold sample data in the blank -> always overwritten)
tmr_std = [0, 10, 50, 80, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600]
tmr = []
for i, v in enumerate(tmr_std):
    tmr += [F(f"std_{i + 1}", f"F{31 + i}", f"Point {i + 1} - standard source value (°C)", default=v),
            F(f"eut_{i + 1}", f"I{31 + i}", f"Point {i + 1} - EUT measured (°C)", clear_if_blank=True),
            F(f"tol_{i + 1}", f"AF{31 + i}", f"Point {i + 1} - accuracy (±°C)", default=5 if i < 13 else 8)]
build("tmr", "TMR", "00. TMR_Blank Form.xlsx", ["tmr"], H("AE11", "AH11", "AK11", 14, "AE", [17], "AF"), "L55",
      {**body("B20", "L55", "P58"), **stab("P", "T", 24), **fixed_issued("T61", 14)}, [{"title": "Temperature measurement (°C)", "fields": tmr}], print_scale=82)

# ============================================================== Torque Meter  (percent accuracy)
tq = []
for i in range(10):
    tq += [F(f"std_{i + 1}", f"H{30 + i}", f"Trial {i + 1} - standard measured value (N)", clear_if_blank=True),
           F(f"eut_{i + 1}", f"L{30 + i}", f"Trial {i + 1} - EUT measured (N)", clear_if_blank=True)]
build("torque_meter", "Torque Meter", "00. Torque Meter_Blank Form.xlsx", ["torque meter"], H("AE11", "AH11", "AK11", 14, "AE", [17], "AF"), "L52",
      {**body("B20", "L52", "P55"), **stab("P", "T", 24)}, [{"title": "Measurement value (N)", "fields": tq}], ra={**RA, "percent": True}, print_scale=82)

# ============================================================== Weighing Scale  (standard values live in hidden cells AH30.. / AJ43 / AF56)
ws_std = [(f"AH{30 + i}", i + 1) for i in range(12)] + [("AH43", 13), ("AJ43", 14)]
wsf = [F(f"std_{n}", c, f"Test point {n} - standard measured value (g)", clear_if_blank=True) for c, n in ws_std]
wsf += [F(f"eut_{i + 1}", f"H{30 + i}", f"Test point {i + 1} - EUT measured (g)", clear_if_blank=True) for i in range(14)]
ws_rep = [F("rep_std_on", "D48", "Standard load On (g)", default=500, row="Standard load (g)", col="Load On"),
          F("rep_std_off", "AF56", "Standard load Off (g)", default=0, row="Standard load (g)", col="Load Off")]
ws_rep += [F(f"rep_on_{i + 1}", f"J{48 + i}", f"Repeatability - Load On #{i + 1}", clear_if_blank=True, row=f"Reading {i + 1}", col="Load On") for i in range(10)]
ws_rep += [F(f"rep_off_{i + 1}", f"M{48 + i}", f"Repeatability - Load Off #{i + 1}", clear_if_blank=True, row=f"Reading {i + 1}", col="Load Off") for i in range(10)]
ws_off = [F("off_std", "D65", "Off-center standard load (g)", default=500, row="Off-center (g)", col="Standard")] + [F(f"off_{k}", f"{c}65", f"Off-center - {k.title()}", clear_if_blank=True, row="Off-center (g)", col=k.title())
          for k, c in (("center", "H"), ("back", "L"), ("front", "P"), ("left", "T"), ("right", "X"))]
build("weighing_scale", "Weighing Scale", "00. Weighing Scale_Blank Form.xlsx", ["weighing scale"],
      H("AE11", "AH11", "AK11", 14, "AE", [17], "AF"), "L68",
      {**body("B20", "L68", "P71", result="L71"), **stab("P", "T", 24), **fixed_issued("T74"),
       "H66": M("=MAX(H65:AA65)-MIN(H65:AA65)")},                        # template: MIN(H66:AA67) includes the cell itself (circular -> #VALUE!)
      [{"title": "1. Departure from nominal value (g)", "fields": wsf}, {"title": "2. Repeatability of reading (g)", "fields": ws_rep},
       {"title": "3. Off center loading (g)", "fields": ws_off}], priority=5, print_scale=80)

# ============================================================== Dial Tension Gauge  (header block at AF; CW / CCW readings)
dt = []
for i, v in enumerate([100, 140, 200, 220, 260, 300, 340, 400, 440, 500.004]):
    r = 31 + i
    dt += [F(f"std_{i + 1}", f"F{r}", f"Test point {i + 1} - standard measured value (g)", default=v),
           F(f"cw_{i + 1}", f"J{r}", f"Test point {i + 1} - EUT CW (g)", clear_if_blank=True),
           F(f"ccw_{i + 1}", f"N{r}", f"Test point {i + 1} - EUT CCW (g)", clear_if_blank=True)]
build("dial_tension_gauge", "Dial Tension Gauge", "Dial Tension Gauge_Blank Form.xlsx", ["dial tension gauge", "tension gauge"],
      H("AF11", "AI11", "AL11", 14, "AF", [17], "AG"), "L42", {**body("B20", "L42", "O45"), **stab("P", "V", 24),
       "AE61": M('=IF(AL11="","",AL11)')},                               # sticker formula was =IF(AND(#REF!=""),"",(#REF!))
      [{"title": "Measurement result (g)", "fields": dt}], due_date_is_formula=True, print_scale=105)

# ============================================================== UV Meter  (template rows 31-32 use $A$30 instead of $AF$30 -> rewritten)
uv = [F("tol", "AF30", "Tolerance (% of standard)", default=5)]
uvc = {}
for i in range(9):
    r = 30 + i
    uv += [F(f"std_{i + 1}", f"D{r}", f"Point {i + 1} - standard measured value (mJ/cm²)", clear_if_blank=True),
           F(f"eut_{i + 1}", f"H{r}", f"Point {i + 1} - EUT measured (mJ/cm²)", clear_if_blank=True)]
    uvc.update({f"P{r}": M(f"=D{r}-D{r}*$AF$30"), f"T{r}": M(f"=D{r}+D{r}*$AF$30")})
build("uv_meter", "UV Meter", "UV Meter_Blank Form.xlsx", ["uv meter", "uv illuminance"],
      H("AE11", "AH11", "AJ11", 14, "AE", [17], "AE", application_limit_is_formula=True), "L40",
      {**body("B20", "L40", "P43", result="L43"), **stab("N", "R", 24), **uvc}, [{"title": "UV illuminance measurement", "fields": uv}],
      ra=None, due_date_is_formula=True, print_scale=98)

# ============================================================== Temp.Probe Wire / Temp.Probe Deep Sensing
tw_pts = [-20, 20, 50, 60, 70, 80, 90, 100, 110, 120, 150, 200, 250]
tw = []
for i, v in enumerate(tw_pts):
    tw += [F(f"std_{i + 1}", f"H{31 + i}", f"Test point {v} °C - standard measured value (°C)", clear_if_blank=True),
           F(f"eut_{i + 1}", f"K{31 + i}", f"Test point {v} °C - EUT measured (°C)", clear_if_blank=True)]
build("temp_probe_wire", "Temp. Probe (Wire)", "00. Temp.Probe Wire_Blank Form.xlsx", ["temp probe wire", "temp.probe wire", "wire probe", "probe wire"],
      H("AE11", "AH11", "AK11", 14, "AE", [17], "AF", application_limit_is_formula=True), "L46",
      {**body("B20", "L46", "P49", result="L49"), **stab("Q", "U", 24)}, [{"title": "Temperature measurement (°C)", "fields": tw}], priority=5, print_scale=82)
ds = []
for i in range(9):
    ds += [F(f"std_{i + 1}", f"F{31 + i}", f"Point {i + 1} - standard measured value (°C)", clear_if_blank=True),
           F(f"eut_{i + 1}", f"I{31 + i}", f"Point {i + 1} - EUT measured (°C)", clear_if_blank=True)]
build("temp_probe_deep_sensing", "Temp. Probe (Deep Sensing)", "00. Temp.Probe Deep Sensing _Blank Form.xlsx",
      ["deep sensing", "temp probe deep", "temp.probe deep", "probe deep"],
      H("AE11", "AH11", "AK11", 14, "AE", [17], "AF", application_limit_is_formula=True), "L46",
      {**body("B20", "L46", "P49", result="L49"), **stab("Q", "U", 24),
       "AK11": M('=CONCATENATE(I31," ~ ",I39," °C only")')},               # template used I43 (empty row) as the upper end
      [{"title": "Temperature measurement (°C)", "fields": ds}], priority=5, print_scale=82)
print("ok")
