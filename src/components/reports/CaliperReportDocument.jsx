import React, { forwardRef } from 'react';
import { Gauge } from 'lucide-react';
import { fmtDate } from '@/lib/calibration';

const fallback = (value) => value || '—';
const Cell = ({ children, className = '' }) => <div className={`border-r border-b border-slate-500 px-1.5 py-1 ${className}`}>{fallback(children)}</div>;
const InfoRow = ({ label, children }) => <div className="grid grid-cols-[42%_58%]"><Cell className="font-semibold">{label}</Cell><Cell>{children}</Cell></div>;
const SectionTitle = ({ children }) => <div className="border-x border-b border-slate-600 bg-slate-100 px-2 py-1 text-center font-bold">{children}</div>;

function MeasurementTable({ section }) {
  const rows = section.rows || [];
  return (
    <div className="mt-3 border border-slate-500 text-[9px]">
      <div className="border-b border-slate-500 bg-slate-100 px-2 py-1 font-bold">{section.title}</div>
      <div className="grid grid-cols-[12%_12%_8%_8%_8%_8%_8%_8%_10%_9%_9%] text-center font-semibold bg-slate-50">
        {['Standard', 'Equivalent Value', '1', '2', '3', '4', '5', 'Average', 'Lower Control Limit', 'Upper Control Limit', 'Disposition'].map((header) => <div key={header} className="border-r border-slate-400 px-1 py-1">{header}</div>)}
      </div>
      {rows.map((row, index) => <div key={`${row.standard}-${index}`} className="grid grid-cols-[12%_12%_8%_8%_8%_8%_8%_8%_10%_9%_9%] text-center">
        <Cell>{row.standard}</Cell><Cell>{row.equivalent}</Cell><Cell>{row.measurements?.[0]}</Cell><Cell>{row.measurements?.[1]}</Cell><Cell>{row.measurements?.[2]}</Cell><Cell>{row.measurements?.[3]}</Cell><Cell>{row.measurements?.[4]}</Cell><Cell>{row.average}</Cell><Cell>{row.lower}</Cell><Cell>{row.upper}</Cell><Cell className={row.disposition === 'PASSED' ? 'font-semibold text-emerald-700' : 'font-semibold text-red-700'}>{row.disposition}</Cell>
      </div>)}
    </div>
  );
}

const PageHeader = ({ report, settings, page }) => <>
  <div className="grid grid-cols-[58%_42%] border-b-2 border-slate-700 h-16">
    <div className="flex items-center gap-3 border-r border-slate-700 px-4">{settings.org_logo_url ? <img src={settings.org_logo_url} crossOrigin="anonymous" alt="logo" className="h-11 w-11 object-contain" /> : <div className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-600"><Gauge className="h-6 w-6 text-white" /></div>}<span className="text-[17px] font-bold">{settings.org_name || 'NIKKOSHI PHILIPPINES CORPORATION'}</span></div>
    <div className="flex items-center justify-center text-[23px] font-black tracking-tight">{settings.document_title || 'VERIFICATION REPORT'}</div>
  </div>
  <div className="grid grid-cols-[30%_30%_40%] border-b border-slate-500">
    <div><InfoRow label="Page No.">{page} of 2</InfoRow><InfoRow label="Verification Date">{fmtDate(report.verification_date)}</InfoRow><InfoRow label="Temperature">{report.report_data?.temperature ? `${report.report_data.temperature}°C` : ''}</InfoRow></div>
    <div><InfoRow label="Report No.">{report.report_number}</InfoRow><InfoRow label="Due Date">{fmtDate(report.next_due_date)}</InfoRow><InfoRow label="Humidity">{report.report_data?.humidity ? `${report.report_data.humidity}%` : ''}</InfoRow></div>
    <div className="grid grid-cols-3 text-center font-semibold"><div className="border-r border-slate-500 py-1">Verified by:<strong className="mt-3 block">{fallback(report.verified_by)}</strong><small>QA Sr. Staff</small></div><div className="border-r border-slate-500 py-1">Reviewed by:<strong className="mt-3 block">{fallback(report.reviewed_by)}</strong><small>QA Sr. Staff</small></div><div className="py-1">Approved by:<strong className="mt-3 block">{fallback(report.approved_by)}</strong><small>QA Superintendent</small></div></div>
  </div>
</>;

const EquipmentDetails = ({ report }) => { const s = report.equipment_snapshot || {}; const d = report.report_data || {}; const standard = d.standard_equipment || {}; return <>
  <div className="grid grid-cols-2"><div><SectionTitle>Equipment Under Test Details:</SectionTitle><InfoRow label="Equipment Type">{s.equipment_name}</InfoRow><InfoRow label="Maker / Model">{[s.manufacturer, s.model].filter(Boolean).join(' / ')}</InfoRow><InfoRow label="NIPHCO Control Number">{s.equipment_code}</InfoRow><InfoRow label="Serial Number">{s.serial_number}</InfoRow><InfoRow label="Range">{s.description}</InfoRow><InfoRow label="Equipment Accuracy">{d.equipment_accuracy || s.accuracy}</InfoRow><InfoRow label="Required Accuracy">{d.required_accuracy || s.required_accuracy}</InfoRow><InfoRow label="Status">{report.result?.toUpperCase()}</InfoRow></div><div><SectionTitle>Standard Equipment Details:</SectionTitle><InfoRow label="Equipment Type">{standard.equipment_type}</InfoRow><InfoRow label="Maker / Model">{standard.maker_model}</InfoRow><InfoRow label="NIPHCO Control Number">{standard.control_number}</InfoRow><InfoRow label="Serial Number">{standard.serial_number}</InfoRow><InfoRow label="Equipment Accuracy">{standard.accuracy}</InfoRow><InfoRow label="Calibrated by">{standard.calibrated_by}</InfoRow><InfoRow label="Traceability">{standard.traceability}</InfoRow><InfoRow label="Calibration Certificate No.">{standard.certificate_number}</InfoRow></div></div>
  <SectionTitle>Verification Method:</SectionTitle><div className="border-x border-b border-slate-500 px-8 py-2 text-center">{d.verification_method || report.verification_method}</div>
</>; };

const ResultBlock = ({ report }) => { const d = report.report_data || {}; return <><div className="grid grid-cols-[28%_44%_28%] border-t border-slate-500"><div className="border-r border-slate-500"><SectionTitle>1. Physical Condition</SectionTitle><div className="p-3">{fallback(d.physical_condition || report.findings)}</div></div><div className="border-r border-slate-500"><SectionTitle>2. Verification Result</SectionTitle><div className="p-3 font-semibold">{fallback(d.verification_result || report.result?.toUpperCase())}</div></div><div><SectionTitle>3. Others</SectionTitle><div className="p-3">Equipment issued to: {fallback(d.equipment_issued_to)}</div></div></div><div className="grid grid-cols-3 border-t border-slate-500 py-2 text-center"><div><strong>NIPHCO - VERIFICATION</strong><br />Control no.: {fallback(report.equipment_snapshot?.equipment_code)}<br />Verification date: {fmtDate(report.verification_date)}<br />Due Date: {fmtDate(report.next_due_date)}</div><div><strong>NIPHCO - APPLICATION LIMIT</strong><br />{fallback(d.application_limit)}</div><div><strong>Disposition:</strong> {fallback(d.verification_result || report.result?.toUpperCase())}<br />Verified by: {fallback(report.verified_by)}</div></div></>; };

const CaliperReportDocument = forwardRef(({ report, settings }, ref) => { const data = report.report_data || {}; const sections = data.measurement_sections || []; return <div ref={ref} className="print-area mx-auto w-[1000px] bg-white text-[11px] text-black shadow-sm">
  <div className="report-page border-2 border-slate-700"><PageHeader report={report} settings={settings} page={1} /><EquipmentDetails report={report} /><div className="mt-2 border-x border-slate-500 px-8 pb-3"><div className="grid grid-cols-4 border border-slate-500 text-center"><div className="row-span-2 flex items-center justify-center border-r border-slate-400 font-bold">Stabilization Details</div><div className="border-r border-b border-slate-400 font-bold">Start</div><div className="border-r border-b border-slate-400 font-bold">End</div><div className="border-b border-slate-400 font-bold">Time</div><div className="col-span-3">{fallback(data.stabilization?.start)} / {fallback(data.stabilization?.end)} / {fallback(data.stabilization?.time)} &nbsp; Temperature [°C]: {fallback(data.stabilization?.temperature)}</div></div>{sections.slice(0, 2).map((section) => <MeasurementTable key={section.title} section={section} />)}</div></div>
  <div className="report-page mt-4 border-2 border-slate-700"><PageHeader report={report} settings={settings} page={2} /><div className="px-8 pb-3">{sections.slice(2).map((section) => <MeasurementTable key={section.title} section={section} />)}</div><ResultBlock report={report} /></div>
</div>; });

export default CaliperReportDocument;
