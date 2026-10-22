import React, { forwardRef } from 'react';
import { fmtDate, REPORT_STATUS_META } from '@/lib/calibration';
import { reportTemplateForReport } from '@/lib/reportTemplates';
import './caliper-report.css';

const display = (item) => item === null || item === undefined || item === '' ? '—' : item;
const measuredKeys = ['measured_1', 'measured_2', 'measured_3', 'measured_4', 'measured_5'];

function Brand() {
  return <div className="cr-brand"><span className="cr-mark" aria-hidden="true"><i /><i /></span><strong>NIKKOSHI PHILIPPINES CORPORATION</strong></div>;
}

function ReportHeader({ report, page }) {
  const data = report.report_data || {};
  return <>
    <div className="cr-brand-row"><Brand /><h2>VERIFICATION REPORT</h2></div>
    <div className="cr-meta">
      <div className="cr-meta-grid">
        <b>Page No.:</b><span>{page} of 2</span><b>Report No.:</b><span>{display(report.report_number)}</span>
        <b>Verification Date:</b><span>{report.verification_date ? fmtDate(report.verification_date) : '—'}</span><b>Due Date:</b><span>{report.next_due_date ? fmtDate(report.next_due_date) : '—'}</span>
        <b>Temperature:</b><span>{data.temperature === '' || data.temperature == null ? '—' : `${data.temperature}°C`}</span><b>Humidity:</b><span>{data.humidity === '' || data.humidity == null ? '—' : `${data.humidity}%`}</span>
      </div>
      <div className="cr-sign">
        <div><b>Verified by:</b><strong>{display(report.verified_by)}</strong><span>QA Sr. Staff</span></div>
        <div><b>Reviewed by:</b><strong>{display(report.reviewed_by)}</strong><span>QA Sr. Staff</span></div>
        <div><b>Approved by:</b><strong>{display(report.approved_by)}</strong><span>QA Superintendent</span></div>
      </div>
    </div>
  </>;
}

function Details({ title, rows }) {
  return <section><h3>{title}</h3><dl>{rows.map(([label, item]) => <React.Fragment key={label}><dt>{label}</dt><dd>{display(item)}</dd></React.Fragment>)}</dl></section>;
}

function MeasurementTable({ title, points = [] }) {
  return <table className="cr-table">
    <caption>{title}</caption>
    <thead>
      <tr><th colSpan={2}>Standard</th><th colSpan={6}>E.U.T Measured Value</th><th rowSpan={2}>Lower<br />Control<br />Limit</th><th rowSpan={2}>Upper<br />Control<br />Limit</th><th rowSpan={2}>Disposition</th></tr>
      <tr><th>Gauge<br />Block</th><th>Equivalent<br />Value</th>{['1', '2', '3', '4', '5', 'Average'].map((label) => <th key={label}>{label}</th>)}</tr>
    </thead>
    <tbody>{points.map((point, index) => {
      const readings = Array.isArray(point.measurements) && point.measurements.length
        ? point.measurements
        : measuredKeys.map((key, readingIndex) => point[key] ?? (readingIndex === 0 ? point.measured : ''));
      const complete = readings.length >= 5 && readings.slice(0, 5).every((reading) => reading !== '' && reading != null);
      const average = point.average !== '' && point.average != null
        ? point.average
        : complete ? (readings.slice(0, 5).reduce((sum, reading) => sum + Number(reading), 0) / 5).toFixed(2) : '';
      return <tr key={`${point.point ?? point.gauge ?? 'measurement'}-${index}`}>
        <td>{display(point.gauge ?? point.standard)}</td><td>{display(point.specified ?? point.equivalent)}</td>
        {Array.from({ length: 5 }, (_, readingIndex) => <td key={readingIndex}>{display(readings[readingIndex])}</td>)}
        <td>{display(average)}</td><td>{display(point.lower)}</td><td>{display(point.upper)}</td>
        <td className={point.disposition === 'FAILED' ? 'cr-failed' : 'cr-passed'}>{display(point.disposition)}</td>
      </tr>;
    })}</tbody>
  </table>;
}

function ParallelismTable({ rows = [] }) {
  return <table className="cr-table cr-parallel">
    <caption>Parallelism (mm)</caption>
    <thead><tr><th colSpan={2}>Standard</th><th colSpan={5}>E.U.T Measured Value</th><th rowSpan={2}>Lower<br />Control Limit</th><th rowSpan={2}>Upper<br />Control Limit</th><th rowSpan={2}>Disposition</th></tr><tr><th>Gauge Block</th><th>Equivalent</th>{['Measurement', 'Top', 'Middle', 'Bottom', 'Average'].map((label) => <th key={label}>{label}</th>)}</tr></thead>
    <tbody>{rows.map((row, index) => <tr key={`parallel-${index}`}>
      <td>{display(row.gauge ?? row.standard)}</td><td>{display(row.specified ?? row.equivalent)}</td><td>{display(row.measurement)}</td>
      {['top', 'middle', 'bottom', 'average'].map((key) => <td key={key}>{display(row[key])}</td>)}
      <td>{display(row.lower)}</td><td>{display(row.upper)}</td><td className={row.disposition === 'FAILED' ? 'cr-failed' : 'cr-passed'}>{display(row.disposition)}</td>
    </tr>)}</tbody>
  </table>;
}

function Stabilization({ data }) {
  return <table className="cr-stab"><tbody>
    <tr><th rowSpan={2}>Stabilization Details</th><th>Start</th><th>End</th><th>Time</th></tr>
    <tr><td>{display(data.start)}</td><td>{display(data.end)}</td><td>{display(data.time)}</td></tr>
    <tr><th>Temperature (°C)</th><td colSpan={3}>{display(data.temperature)}</td></tr>
  </tbody></table>;
}

function Results({ report }) {
  const data = report.report_data || {};
  const result = data.verification_result || report.result?.toUpperCase();
  const scope = data.result_scope || data.application_limit;
  return <>
    <div className="cr-result"><b>1. Physical Condition</b><span>{display(data.physical_condition || report.findings)}</span></div>
    <div className="cr-result cr-result-lg"><b>2. Verification Result</b><span><strong>{display(result)}</strong>{scope && <small>{scope}</small>}</span></div>
    <div className="cr-result"><b>3. Others</b><span>Equipment issued to {display(data.equipment_issued_to)}</span></div>
  </>;
}

const VerificationReportDocument = forwardRef(({ report }, ref) => {
  const snapshot = report.equipment_snapshot || {};
  const data = report.report_data || {};
  const standard = data.standard_equipment || {};
  const equipmentRows = [
    ['Equipment Type', snapshot.equipment_name],
    ['Maker / Model', [snapshot.manufacturer, snapshot.model].filter(Boolean).join(' / ')],
    ['NIPHCO Control Number', snapshot.equipment_code],
    ['Serial Number', snapshot.serial_number],
    ['Range', data.range || snapshot.description || snapshot.range],
    ['Equipment Accuracy', data.equipment_accuracy || snapshot.accuracy],
    ['Required Accuracy', data.required_accuracy || snapshot.required_accuracy],
    ['Status', data.status || report.result?.toUpperCase()],
  ];
  const standardRows = [
    ['Equipment Type', standard.equipment_type],
    ['Maker / Model', standard.maker_model],
    ['NIPHCO Control Number', standard.control_number],
    ['Serial Number', standard.serial_number],
    ['Equipment Accuracy', standard.accuracy],
    ['Calibrated by', standard.calibrated_by],
    ['Traceability', standard.traceability],
    ['Calibration Certificate No.', standard.certificate_number],
  ];
  const savedSections = data.measurement_sections || [];
  const isCaliper = reportTemplateForReport(report) === 'caliper';
  const sections = savedSections.some((section) => section.rows?.length)
    ? savedSections
    : [
        { title: isCaliper ? 'External Measurement (mm)' : 'X Value: Length Measurement (mm)', rows: data.x_points || [] },
        { title: isCaliper ? 'Internal Measurement (mm)' : 'Y Value: Length Measurement (mm)', rows: data.y_points || [] },
        ...(isCaliper ? [
          { title: 'Step Measurement (mm)', rows: [] },
          { title: 'Depth Measurement (mm)', rows: [] },
          { title: 'Parallelism (mm)', rows: [] },
        ] : []),
      ];
  const parallelism = Array.isArray(data.parallelism) ? data.parallelism : sections[4]?.rows || [];

  return <div ref={ref} className="cr-doc"><div className="cr-stack">
    <article className="cr-page">
      <ReportHeader report={report} page="1" />
      <div className="cr-detail"><Details title="Equipment Under Test Details:" rows={equipmentRows} /><Details title="Standard Equipment Details:" rows={standardRows} /></div>
      <section className="cr-method"><h3>Verification Method:</h3><p>{display(data.verification_method || report.verification_method || 'The equipment was verified according to the applicable Nikkoshi standard procedure using traceable standard equipment under the stated environmental conditions.')}</p></section>
      <Stabilization data={data.stabilization || {}} />
      <MeasurementTable title={sections[0]?.title || 'External Measurement (mm)'} points={sections[0]?.rows} />
      <MeasurementTable title={sections[1]?.title || 'Internal Measurement (mm)'} points={sections[1]?.rows} />
    </article>
    <article className="cr-page">
      <ReportHeader report={report} page="2" />
      {sections[2] && <MeasurementTable title={sections[2].title || 'Step Measurement (mm)'} points={sections[2].rows} />}
      {sections[3] && <MeasurementTable title={sections[3].title || 'Depth Measurement (mm)'} points={sections[3].rows} />}
      {parallelism.length > 0 && <ParallelismTable rows={parallelism} />}
      <Results report={report} />
      <div className="cr-remarks"><strong>NIKKOSHI - VERIFICATION</strong><br />Control no.: {display(snapshot.equipment_code)}<br />Verification date: {report.verification_date ? fmtDate(report.verification_date) : '—'}<br />Due date: {report.next_due_date ? fmtDate(report.next_due_date) : '—'}<br /><strong>Disposition:</strong> {display(data.verification_result || report.result?.toUpperCase())}<br /><strong>Verified by:</strong> {display(report.verified_by)}<br /><strong>Report status:</strong> {REPORT_STATUS_META[report.status]?.label || display(report.status)}</div>
    </article>
  </div></div>;
});

export default VerificationReportDocument;