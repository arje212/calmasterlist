import { STATUS_META, fmtDate } from '@/lib/calibration';

// control = Control # (text), etype = Equipment type, location, type = Checking type, from/to = Checking due range.
// status / result / department / report are kept so Dashboard links (?status=..&report=..) keep working.
export const EMPTY_FILTERS = { control: '', etype: 'all', location: 'all', type: 'all', from: '', to: '', status: 'all', result: 'all', department: 'all', report: 'all' };

export const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const codeKey = (s) => String(s ?? '').replace(/\s+/g, '').toUpperCase();

const SEARCH_KEYS = ['equipment_code', 'equipment_name', 'serial_number', 'asset_number', 'manufacturer', 'model', 'department', 'location'];

export function filterEquipment(list, search, f, sort) {
  const q = search.trim().toLowerCase();
  const control = codeKey(f.control);
  const out = list.filter((e) => {
    if (q && !SEARCH_KEYS.some((k) => (e[k] || '').toLowerCase().includes(q))) return false;
    if (control && !codeKey(e.equipment_code).includes(control)) return false;
    if (f.etype !== 'all' && norm(e.equipment_name) !== f.etype) return false;
    if (f.location !== 'all' && norm(e.location) !== f.location) return false;
    if (f.type !== 'all' && norm(e.calibration_type) !== f.type) return false;
    if (f.status !== 'all' && e.status !== f.status) return false;
    if (f.result !== 'all' && e.result !== f.result) return false;
    if (f.department !== 'all' && e.department !== f.department) return false;
    if (f.report === 'pending' && !e.report_required) return false;
    if (!['all', 'pending'].includes(f.report) && e.report_state !== f.report) return false;
    if (f.from && (!e.next_due || e.next_due < f.from)) return false;
    if (f.to && (!e.next_due || e.next_due > f.to)) return false;
    return true;
  });
  const { key, dir } = sort;
  out.sort((a, b) => {
    const av = a[key] ?? '';
    const bv = b[key] ?? '';
    const c = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return dir === 'asc' ? c : -c;
  });
  return out;
}

export const MASTER_COLUMNS = [
  { key: 'no', label: 'No.', sortKey: 'source_row' },
  { key: 'control_no', label: 'NIKKOSHI Control no.', sortKey: 'equipment_code' },
  { key: 'equipment_name', label: 'Equipment Type', sortKey: 'equipment_name' },
  { key: 'status', label: 'Status', sortKey: 'status' },
  { key: 'manufacturer', label: 'Maker', sortKey: 'manufacturer' },
  { key: 'model', label: 'Model', sortKey: 'model' },
  { key: 'serial_number', label: 'Serial No.', sortKey: 'serial_number' },
  { key: 'description', label: 'Range', sortKey: 'description' },
  { key: 'accuracy', label: 'Equipment Accuracy' },
  { key: 'accuracy_2', label: 'Required Accuracy' },
  { key: 'location', label: 'Location', sortKey: 'location' },
  { key: 'frequency_of_use', label: 'Frequency of Use' },
  { key: 'checking_type', label: 'Checking type', sortKey: 'calibration_type' },
  { key: 'checking_frequency', label: 'Checking Frequency' },
  { key: 'checking_date', label: 'Checking Date', sortKey: 'last_date' },
  { key: 'checking_due', label: 'Checking Due', sortKey: 'next_due' },
  { key: 'specific_location', label: 'Specific Location' },
  { key: 'resolution_graduation', label: 'Resolution / Graduation' },
  { key: 'received_date', label: 'Received Date' },
  { key: 'status_2', label: 'Status' },
  { key: 'external_provider_cal_cert_no', label: 'External Provider Cal Cert no.' },
  { key: 'accredited_cal_y_n', label: 'Accredited Cal Y / N ?' },
  { key: 'remarks', label: 'Remarks' },
  { key: 'asset_tag_no', label: 'Asset Tag no.' },
];

const FIELD_KEYS = {
  no: ['no'],
  equipment_name: ['equipment_type'],
  status: ['status'],
  manufacturer: ['maker'],
  model: ['model'],
  serial_number: ['serial_no'],
  description: ['range'],
  accuracy: ['equipment_accuracy', 'equipment'],
  accuracy_2: ['required_accuracy', 'required', 'column_13', 'column_12'],
  location: ['location'],
  frequency_of_use: ['frequency_of_use', 'frequency'],
  checking_type: ['checking_type', 'checking'],
  checking_frequency: ['checking_frequency', 'checking_2'],
  checking_date: ['checking_date', 'checking_3'],
  checking_due: ['checking_due', 'checking_4'],
  specific_location: ['specific_location', 'location_2'],
  resolution_graduation: ['resolution_graduation', 'resolution'],
  received_date: ['received_date'],
  status_2: ['status_2'],
  external_provider_cal_cert_no: ['external_provider_cal_cert_no', 'calibration_report'],
  accredited_cal_y_n: ['accredited_cal_y_n'],
  remarks: ['remarks'],
  asset_tag_no: ['asset_tag_no'],
};

const CONTROL_CODE_KEYS = new Set(['nikkoshi_control_no', 'nikkoshi', 'column_3', 'column_4', 'column_5', 'column_7', 'column_8', 'column_9']);
const MAPPED_SOURCE_KEYS = new Set([...Object.values(FIELD_KEYS).flat(), ...CONTROL_CODE_KEYS]);

export function getMasterColumns(rows) {
  const extraKeys = [...new Set(rows.flatMap((row) => Object.keys(row.excel_data || {})))].filter((key) => !MAPPED_SOURCE_KEYS.has(key));
  const extras = extraKeys.map((key) => ({
    key,
    label: key.replace(/^column_(\d+)$/, 'Excel Column $1').replace(/_\d+$/, (match) => match).split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' '),
  }));
  return [...MASTER_COLUMNS, ...extras];
}

export const toExportRow = (e) => {
  const source = e.excel_data || {};
  const cell = (keys, fallback = '') => keys.map((key) => source[key]).find((value) => value !== undefined && value !== null && value !== '') ?? fallback;
  const sourceKeys = Object.keys(source);
  const controlStart = sourceKeys.findIndex((key) => ['nikkoshi_control_no', 'nikkoshi'].includes(key));
  const equipmentTypeIndex = sourceKeys.indexOf('equipment_type');
  const controlCode = controlStart < 0 ? '' : sourceKeys
    .slice(controlStart, equipmentTypeIndex > controlStart ? equipmentTypeIndex : controlStart + 1)
    .map((key) => source[key])
    .filter(Boolean)
    .join('')
    .replace(/\s+/g, '');
  return {
    ...source,
    no: cell(FIELD_KEYS.no, e.source_row || ''),
    control_no: controlCode || e.equipment_code || '',
    equipment_name: cell(FIELD_KEYS.equipment_name, e.equipment_name),
    status: cell(FIELD_KEYS.status, STATUS_META[e.status]?.label || ''),
    manufacturer: cell(FIELD_KEYS.manufacturer, e.manufacturer),
    model: cell(FIELD_KEYS.model, e.model),
    serial_number: cell(FIELD_KEYS.serial_number, e.serial_number),
    description: cell(FIELD_KEYS.description, e.description),
    accuracy: cell(FIELD_KEYS.accuracy, e.accuracy || ''),
    accuracy_2: cell(FIELD_KEYS.accuracy_2, e.required_accuracy || ''),
    location: cell(FIELD_KEYS.location, e.location),
    frequency_of_use: cell(FIELD_KEYS.frequency_of_use, ''),
    checking_type: cell(FIELD_KEYS.checking_type, e.calibration_type),
    checking_frequency: cell(FIELD_KEYS.checking_frequency, ''),
    checking_date: cell(FIELD_KEYS.checking_date, fmtDate(e.last_date, 'yyyy-MM-dd')),
    checking_due: cell(FIELD_KEYS.checking_due, fmtDate(e.next_due, 'yyyy-MM-dd')),
    specific_location: cell(FIELD_KEYS.specific_location, ''),
    resolution_graduation: cell(FIELD_KEYS.resolution_graduation, ''),
    received_date: cell(FIELD_KEYS.received_date, ''),
    status_2: cell(FIELD_KEYS.status_2, ''),
    external_provider_cal_cert_no: cell(FIELD_KEYS.external_provider_cal_cert_no, e.certificate_number),
    accredited_cal_y_n: cell(FIELD_KEYS.accredited_cal_y_n, ''),
    remarks: cell(FIELD_KEYS.remarks, ''),
    asset_tag_no: cell(FIELD_KEYS.asset_tag_no, ''),
  };
};