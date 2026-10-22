"""Generates mappings/*.json for the 3 irregular templates.  (caliper.json is hand-written.)
   Re-run after changing a template layout:  python tools/make_mappings.py"""
import json, os
OUT = os.path.join(os.path.dirname(__file__), "..", "mappings")
POS = {"verified": "QA Sr. Staff", "reviewed": "QA Sr. Staff", "approved": "QA Superintendent"}
def dump(key, m):
    json.dump(m, open(os.path.join(OUT, key + ".json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
def F(id, cell, label, **kw): return {"id": id, "cell": cell, "label": label, "type": kw.pop("type", "number"), **kw}

# ---------------------------------------------------------------- A-Test Machine
rows = {31: "Resistance Measurement (DC) - Atest machine (Ω)", 32: "Current Measurement (DC) - DMM (mA)", 33: "Voltage (DC) 5.0 V setting - DMM (V)",
        34: "Voltage (DC) 3.0 V setting - DMM (V)", 35: "Frequency Measurement - DMM (kHz)", 36: "Current Measurement (DC) 100 mA - DMM (mA)",
        37: "Voltage (AC) @1 kHz Output - STD value - DMM (mV)", 38: "Voltage (AC) @1 kHz Output - measured - DMM (mV)",
        39: "Voltage (AC) @1 kHz DC change - STD value - DMM (mV)", 40: "Voltage (AC) @1 kHz DC change - measured - Atest (mV)",
        41: "Voltage (AC) @1 kHz White noise - STD value - DMM (mV)", 42: "Voltage (AC) @1 kHz White noise - measured - DMM (mV)",
        43: "Voltage (AC) @20 Hz Piezo noise - STD value - DMM (mV)", 44: "Voltage (AC) @20 Hz Piezo noise - measured - DMM (mV)"}
dump("a_test_machine", {
  "key": "a_test_machine", "label": "A-Test Machine", "template": "00. A-Test Machine_Blank Form.xlsx", "sheet": "VERIFICATION_REPORT",
  "match": ["a-test", "atest", "a test"],
  "header": {"series": "AG11", "humidity": "AJ11", "application_limit": "AM11", "eut_row": 14, "eut_first_col": "AG", "std_rows": [16, 17], "std_first_col": "AH"},
  "due_date_is_formula": True,
  "required_accuracy_cells": {"sign": "I16", "value": "J16", "unit": "K16"},
  "people": {"verified": ["R6", "R7"], "reviewed": ["V6", "V7"], "approved": ["AA6", "AA7"]}, "default_positions": POS,
  "physical_condition_cell": "N49",
  "cells": {"B20": "data.verification_method", "N24": "data.stabilization.time_start", "R24": "data.stabilization.time_end",
            "N25": "data.stabilization.temp_start", "R25": {"path": "data.stabilization.temp_end", "fallback": "data.temperature"},
            "N49": "data.physical_condition", "T52": "data.result_note"},
  "input_groups": [{"title": "A-Test machine verification - measured values", "fields": [F(f"s{r}", f"S{r}", lbl) for r, lbl in rows.items()]}]})

# ---------------------------------------------------------------- Air Particle Counter  (free-form body -> photo box)
dump("air_particle_counter", {
  "key": "air_particle_counter", "label": "Air Particle Counter", "template": "00. Air Particle Counter_Blank Form.xlsx", "sheet": "VERIFICATION_REPORT",
  "match": ["particle counter", "air particle"],
  "header": {"series": "AE11", "humidity": "AH11", "application_limit": "AK11", "eut_row": 14, "eut_first_col": "AE", "std_rows": [17], "std_first_col": "AF"},
  "required_accuracy_cells": {"sign": "I16", "value": "J16", "unit": "K16"},
  "people": {"verified": ["R6", "R7"], "reviewed": ["V6", "V7"], "approved": ["Z6", "Z7"]}, "default_positions": POS,
  "physical_condition_cell": "L64", "default_attachment_slot": "body",
  "photo_boxes": [{"id": "test_data", "from": "B26", "to": "AC62"}],
  "cells": {"B20": "data.verification_method", "P24": "data.stabilization.time_start", "T24": "data.stabilization.time_end",
            "P25": "data.stabilization.temp_start", "T25": {"path": "data.stabilization.temp_end", "fallback": "data.temperature"},
            "L64": "data.physical_condition", "P67": "data.result_note"}})

# ---------------------------------------------------------------- Balance
dep = [F(f"eut_{i+1}", f"H{30+i}", f"EUT measured value {i+1} (g)", clear_if_blank=True) for i in range(12)]
wts = [F(f"std_w{i+1}", f"AJ{30+i}", f"Standard weight {i+1} (g)", default=v) for i, v in enumerate([0.05, 1, 2, 5, 10, 20, 20, 50, 100, 100])]
rep_on = [F(f"rep_on_{i+1}", f"J{46+i}", f"Repeatability - Load On #{i+1}", clear_if_blank=True) for i in range(10)]
rep_off = [F(f"rep_off_{i+1}", f"M{46+i}", f"Repeatability - Load Off #{i+1}", clear_if_blank=True) for i in range(10)]
off = [F("off_std", "D64", "Off-center standard load (g)", default=50)] + [F(f"off_{k}", f"{c}64", f"Off-center - {k.title()}", clear_if_blank=True)
       for k, c in (("center", "H"), ("back", "L"), ("front", "P"), ("left", "T"), ("right", "X"))]
dump("balance", {
  "key": "balance", "print_scale": 76, "label": "Balance", "template": "00. Balance_Blank Report.xlsx", "sheet": "VERIFICATION_REPORT",
  "match": ["balance", "weighing scale"],
  "header": {"series": "AE11", "humidity": "AH11", "application_limit": "AK11", "eut_row": 14, "eut_first_col": "AE", "std_rows": [17], "std_first_col": "AF"},
  "required_accuracy_cells": {"sign": "I16", "value": "J16", "unit": "K16"},
  "people": {"verified": ["R6", "R7"], "reviewed": ["V6", "V7"], "approved": ["Z6", "Z7"]}, "default_positions": POS,
  "physical_condition_cell": "L68",
  "cells": {"B20": "data.verification_method", "P24": "data.stabilization.time_start", "T24": "data.stabilization.time_end",
            "P25": "data.stabilization.temp_start", "T25": {"path": "data.stabilization.temp_end", "fallback": "data.temperature"},
            "L68": "data.physical_condition", "L71": {"path": "data.verification_result", "fallback": "data.status", "upper": True}, "P71": "data.result_note"},
  "input_groups": [{"title": "Standard weights (standard measured value)", "fields": wts},
                   {"title": "1. Departure from nominal value (g)", "fields": dep},
                   {"title": "2. Repeatability of reading (g)", "fields": [F("rep_std_on", "D46", "Standard - Load On (g)", default=100), F("rep_std_off", "G46", "Standard - Load Off (g)", default=100)] + rep_on + rep_off},
                   {"title": "3. Off center loading (g)", "fields": off}]})
print("ok")
