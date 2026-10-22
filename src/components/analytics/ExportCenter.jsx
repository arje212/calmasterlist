import React, { useState } from 'react';
import { FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { downloadCSV, downloadExcel, printTable } from '@/lib/exporters';
import { MASTER_COLUMNS, toExportRow } from '@/lib/masterlistFilter';
import { fmtDate, RESULT_META, groupStats, monthlyTrend, toDate } from '@/lib/calibration';

const VR_COLS = [{ key: 'date', label: 'Verification Date' }, { key: 'equipment_code', label: 'Code' }, { key: 'equipment_name', label: 'Equipment' }, { key: 'res', label: 'Result' }, { key: 'next', label: 'Next Due' }, { key: 'verified_by_name', label: 'Verified By' }, { key: 'report', label: 'Report No.' }, { key: 'findings', label: 'Findings' }, { key: 'remarks', label: 'Remarks' }];
const DEPT_COLS = [{ key: 'name', label: 'Department' }, { key: 'total', label: 'Equipment' }, { key: 'expired', label: 'Expired' }, { key: 'upcoming', label: 'Upcoming' }, { key: 'failed', label: 'Failed' }, { key: 'pending', label: 'Pending Reports' }, { key: 'comp', label: 'Compliance %' }];
const MONTH_COLS = [{ key: 'month', label: 'Month' }, { key: 'verified', label: 'Verified' }, { key: 'passed', label: 'Passed' }, { key: 'failed', label: 'Failed' }];

export default function ExportCenter({ equipment, verifications, reports }) {
  const [type, setType] = useState('complete');
  const year = new Date().getFullYear();
  const vrRows = (list) => list.map((v) => ({ ...v, date: fmtDate(v.verification_date, 'yyyy-MM-dd'), next: fmtDate(v.next_due_date, 'yyyy-MM-dd'), res: RESULT_META[v.result]?.label, report: reports.find((r) => r.verification_id === v.id)?.report_number || '' }));
  const TYPES = {
    complete: { title: 'Complete Masterlist', columns: MASTER_COLUMNS, rows: () => equipment.map(toExportRow) },
    expired: { title: 'Expired Equipment', columns: MASTER_COLUMNS, rows: () => equipment.filter((e) => e.status === 'expired').map(toExportRow) },
    upcoming: { title: 'Upcoming Calibration (60 days)', columns: MASTER_COLUMNS, rows: () => equipment.filter((e) => e.days_left !== null && e.days_left >= 0 && e.days_left <= 60).map(toExportRow) },
    history: { title: 'Verification History', columns: VR_COLS, rows: () => vrRows(verifications) },
    failed: { title: 'Failed Equipment', columns: MASTER_COLUMNS, rows: () => equipment.filter((e) => e.result === 'failed').map(toExportRow) },
    dept: { title: 'Department Compliance', columns: DEPT_COLS, rows: () => groupStats(equipment, verifications).map((g) => ({ ...g, comp: `${g.compliance}%` })) },
    monthly: { title: 'Monthly Verification Report', columns: MONTH_COLS, rows: () => monthlyTrend(verifications) },
    annual: { title: `Annual Calibration Report ${year}`, columns: VR_COLS, rows: () => vrRows(verifications.filter((v) => {
      const date = toDate(v.verification_date);
      return date && date.getFullYear() === year && date <= new Date();
    })) },
  };
  const t = TYPES[type];
  const file = t.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return (
    <div className="panel p-6">
      <p className="eyebrow mb-1">Export Center</p>
      <p className="text-sm text-muted-foreground mb-4">Generate management reports from live data.</p>
      <div className="flex flex-col md:flex-row gap-3">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="md:w-80"><SelectValue /></SelectTrigger>
          <SelectContent>{Object.entries(TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v.title}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={() => printTable(t.title, t.columns, t.rows())}><Printer className="h-4 w-4" />PDF</Button>
          <Button variant="outline" className="gap-2" onClick={() => downloadExcel(file, t.columns, t.rows())}><FileSpreadsheet className="h-4 w-4" />Excel</Button>
          <Button variant="outline" className="gap-2" onClick={() => downloadCSV(file, t.columns, t.rows())}><FileText className="h-4 w-4" />CSV</Button>
        </div>
      </div>
    </div>
  );
}