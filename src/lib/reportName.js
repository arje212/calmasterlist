// Report name format: CAL-<control number>_<YY>-<NN>   e.g. CAL-DG0014ME_26-01
//  YY = year of the verification date (26 = 2026)
//  NN = running number of reports for THAT equipment in THAT year (01, 02, ...). Starts again at 01 every new year.
export function reportNameFor(equipment, verificationDate, reports = [], ignoreId = null) {
  const code = String(equipment?.equipment_code || '').replace(/\s+/g, '');
  const year = /^\d{4}/.test(String(verificationDate || '')) ? String(verificationDate).slice(0, 4) : String(new Date().getFullYear());
  const prefix = `CAL-${code}_${year.slice(2)}-`;
  const mine = reports.filter((r) => r.id !== ignoreId && r.equipment_id === equipment?.id);
  // highest number already used in a name with this prefix (safe even if an older report was deleted)
  const maxUsed = Math.max(0, ...mine.map((r) => {
    const name = String(r.report_number || '');
    const n = name.startsWith(prefix) ? parseInt(name.slice(prefix.length), 10) : 0;
    return Number.isFinite(n) ? n : 0;
  }));
  // reports of this equipment verified in this year, whatever their name (covers older "VR-..." names)
  const sameYear = mine.filter((r) => String(r.verification_date || '').slice(0, 4) === year).length;
  return `${prefix}${String(Math.max(maxUsed, sameYear) + 1).padStart(2, '0')}`;
}
