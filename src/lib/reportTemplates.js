const text = (equipment = {}) => [equipment.equipment_name, equipment.category, equipment.model, equipment.description].filter(Boolean).join(' ').toLowerCase();

export const REPORT_TEMPLATES = {
  CALIPER: 'caliper',
  GENERIC: 'generic',
};

export function reportTemplateForEquipment(equipment) {
  const identity = text(equipment);
  if (/caliper|vernier|micrometer/.test(identity)) return REPORT_TEMPLATES.CALIPER;
  return REPORT_TEMPLATES.GENERIC;
}

export function reportTemplateForReport(report) {
  return report.report_template || reportTemplateForEquipment(report.equipment_snapshot || {});
}
