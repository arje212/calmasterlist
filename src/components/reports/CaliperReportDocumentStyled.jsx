import React, { forwardRef } from 'react';
import './caliper-report.css';
import { MEASURED, PARALLEL_KEYS, computeRow, parseTolerance } from './ReportFormFields';

const ROLES = { verified: 'QA Sr. Staff', reviewed: 'QA Sr. Staff', approved: 'QA Superintendent' };
const v = (x) => (x === undefined || x === null || x === '' ? '—' : x);

const fmtDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${String(d.getDate()).padStart(2, '0')}-${d.toLocaleString('en-US', { month: 'short' })}-${String(d.getFullYear()).slice(2)}`;
};

const dispClass = (d) => (d === 'FAILED' ? 'cr-failed' : 'cr-passed');

function Brand({ logo }) {
  return (
    <div className="cr-brand">
      {logo ? <img src={logo} alt="" /> : <span className="cr-mark" aria-hidden="true"><i /><i /></span>}
      <strong>NIKKOSHI PHILIPPINES CORPORATION</strong>
    </div>
  );
}

function ReportHeader({ page, report, data, logo }) {
  return (
    <>
      <div className="cr-brand-row"><Brand logo={logo} /><h2>VERIFICATION REPORT</h2></div>
      <div className="cr-meta">
        <div className="cr-meta-grid">
          <b>Page No.:</b><span>{page}</span><b>Report No</b><span>{v(report.report_number)}</span>
          <b>Verification Date :</b><span>{fmtDate(report.verification_date)}</span><b>Due Date :</b><span>{fmtDate(report.next_due_date)}</span>
          <b>Temperature :</b><span>{data.temperature ? `${data.temperature}°C` : '—'}</span><b>Humidity :</b><span>{data.humidity ? `${data.humidity}%` : '—'}</span>
        </div>
        <div className="cr-sign">
          <div><b>Verified by :</b><strong>{v(report.verified_by)}</strong><span>{ROLES.verified}</span></div>
          <div><b>Reviewed by :</b><strong>{v(report.reviewed_by)}</strong><span>{ROLES.reviewed}</span></div>
          <div><b>Approved by:</b><strong>{v(report.approved_by)}</strong><span>{ROLES.approved}</span></div>
        </div>
      </div>
    </>
  );
}

function DetailTable({ snap, data }) {
  const std = data.standard_equipment || {};
  const Row = ({ items }) => items.map(([k, val]) => <React.Fragment key={k}><dt>{k}</dt><dd>{v(val)}</dd></React.Fragment>);
  return (
    <div className="cr-detail">
      <section>
        <h3>Equipment Under Test Details:</h3>
        <dl>
          <Row items={[
            ['Equipment Type', snap.equipment_name],
            ['Maker / Model', [snap.manufacturer, snap.model].filter(Boolean).join(' / ')],
            ['NIPHCO Control Number', snap.equipment_code],
            ['Serial Number', snap.serial_number],
            ['Range', data.range || snap.range],
            ['Equipment Accuracy', data.equipment_accuracy],
            ['Required Accuracy', data.required_accuracy],
            ['Status', data.status],
          ]} />
        </dl>
      </section>
      <section>
        <h3>Standard Equipment Details:</h3>
        <dl>
          <Row items={[
            ['Equipment Type', std.equipment_type],
            ['Maker / Model', std.maker_model],
            ['NIPHCO Control Number', std.control_number],
            ['Serial Number', std.serial_number],
            ['Equipment Accuracy', std.accuracy],
            ['Calibrated by', std.calibrated_by],
            ['Traceability', std.traceability],
            ['Calibration Certificate No.', std.certificate_number],
          ]} />
        </dl>
      </section>
    </div>
  );
}

function MeasurementTable({ title, rows, tol }) {
  return (
    <table className="cr-table">
      <caption>{title}</caption>
      <thead>
        <tr><th colSpan={2}>Standard</th><th colSpan={6}>E.U.T Measured Value</th><th rowSpan={2}>Lower<br />Control<br />Limit</th><th rowSpan={2}>Upper<br />Control<br />Limit</th><th rowSpan={2}>Disposition</th></tr>
        <tr><th>Gauge<br />Block</th><th>Equivalent<br />Value</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>Average</th></tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const c = computeRow(row, tol);
          return (
            <tr key={i}>
              <td>{row.gauge}</td><td>{row.specified}</td>
              {MEASURED.map((k) => <td key={k}>{row[k]}</td>)}
              <td>{c.average}</td><td>{c.lower}</td><td>{c.upper}</td>
              <td className={dispClass(c.disposition)}>{c.disposition}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ParallelTable({ rows, tol }) {
  return (
    <table className="cr-table cr-parallel">
      <caption>Parallelism (mm)</caption>
      <thead>
        <tr><th colSpan={2}>Standard</th><th colSpan={5}>E.U.T Measured Value</th><th rowSpan={2}>Lower<br />Control<br />Limit</th><th rowSpan={2}>Upper<br />Control<br />Limit</th><th rowSpan={2}>Disposition</th></tr>
        <tr><th>Gauge<br />Block</th><th>Equivalent<br />Value</th><th>Measurement</th><th>Top</th><th>Middle</th><th>Bottom</th><th>Average</th></tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const c = computeRow(row, tol, PARALLEL_KEYS);
          return (
            <tr key={i}>
              <td>{row.gauge}</td><td>{row.specified}</td><td><b>{row.measurement}</b></td>
              {PARALLEL_KEYS.map((k) => <td key={k}>{row[k]}</td>)}
              <td>{c.average}</td><td>{c.lower}</td><td>{c.upper}</td>
              <td className={dispClass(c.disposition)}>{c.disposition}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Results({ data, report }) {
  return (
    <>
      <div className="cr-result"><b>1. Physical Condition</b><span>{v(data.physical_condition)}</span></div>
      <div className="cr-result cr-result-lg">
        <b>2. Verification Result</b>
        <span>
          <strong>{v(data.verification_result)}</strong>
          <small>{[data.result_scope, data.result_note].filter(Boolean).join('\n')}</small>
        </span>
      </div>
      <div className="cr-result"><b>3. Others</b><span>Equipment issued to {v(data.equipment_issued_to)}</span></div>
      {report.remarks && <div className="cr-remarks"><b>Remarks:</b> {report.remarks}</div>}
    </>
  );
}

// Old X/Y point rows -> same row shape as the caliper sections
const pointRows = (points = []) => points.map((p) => ({
  gauge: p.gauge, specified: p.specified,
  ...Object.fromEntries(MEASURED.map((k, i) => [k, p[k] ?? (i === 0 ? p.measured || '' : '')])),
}));

const CaliperReportDocument = forwardRef(function CaliperReportDocument({ report, settings }, ref) {
  const data = report.report_data || {};
  const snap = report.equipment_snapshot || {};
  const stab = data.stabilization || {};
  const tol = parseTolerance(data.required_accuracy || data.equipment_accuracy);
  const logo = settings?.logo_url || settings?.company_logo;

  const hasCaliper = (data.measurement_sections || []).some((s) => s.rows?.length);
  const sections = hasCaliper
    ? data.measurement_sections.filter((s) => s.rows?.length)
    : [
        { title: 'X Value : Length Measurement (mm)', rows: pointRows(data.x_points) },
        { title: 'Y Value : Length Measurement (mm)', rows: pointRows(data.y_points) },
      ].filter((s) => s.rows.length);
  const parallel = data.parallelism || [];

  const pageOne = sections.slice(0, 2);
  const pageTwo = sections.slice(2);
  const twoPages = pageTwo.length > 0 || parallel.length > 0;

  const timeStart = stab.time_start ?? stab.start;
  const timeEnd = stab.time_end ?? stab.end;
  const tempStart = stab.temp_start ?? stab.temperature;
  const tempEnd = stab.temp_end;

  const head = (page) => <ReportHeader page={page} report={report} data={data} logo={logo} />;

  return (
    <div ref={ref} className="cr-doc">
      <div className="cr-stack">
        <article className={`cr-page ${twoPages ? '' : 'cr-single'}`}>
          {head(twoPages ? '1 of 2' : '1 of 1')}
          <DetailTable snap={snap} data={data} />
          <section className="cr-method">
            <h3>Verification Method:</h3>
            <p>{v(data.verification_method)}</p>
          </section>
          <table className="cr-stab">
            <tbody>
              <tr><th rowSpan={3}>Stabilization Details</th><th /><th>Start</th><th>End</th></tr>
              <tr><th>Time</th><td>{v(timeStart)}</td><td>{v(timeEnd)}</td></tr>
              <tr><th>Temperature (°C)</th><td>{v(tempStart)}</td><td>{v(tempEnd)}</td></tr>
            </tbody>
          </table>
          {pageOne.map((s) => <MeasurementTable key={s.title} title={s.title} rows={s.rows} tol={tol} />)}
          {!twoPages && <Results data={data} report={report} />}
          {!twoPages && <div style={{ height: '1.5rem' }} />}
        </article>

        {twoPages && (
          <article className="cr-page">
            {head('2 of 2')}
            <div style={{ height: '1.5rem' }} />
            {pageTwo.map((s) => <MeasurementTable key={s.title} title={s.title} rows={s.rows} tol={tol} />)}
            {parallel.length > 0 && <ParallelTable rows={parallel} tol={tol} />}
            <Results data={data} report={report} />
          </article>
        )}
      </div>
    </div>
  );
});

export default CaliperReportDocument;