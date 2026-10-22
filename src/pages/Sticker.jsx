import React, { forwardRef, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, Download, Loader2, Lock } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { useCalibrationData } from '@/hooks/useCalData';
import { downloadElementPdf } from '@/lib/pdf';
import PageHeader from '@/components/common/PageHeader';
import LoadingState from '@/components/common/LoadingState';
import EmptyState from '@/components/common/EmptyState';

/* ═════════════════════════════════════════════════════════════
   NIPHCO STICKER DESIGN
   ═════════════════════════════════════════════════════════════ */

// 'details' = nasa QR mismo ang equipment details (gumagana kahit offline)
// 'link'    = link sa approved report (kailangan ng sign-in)
const QR_MODE = 'details';
const REPORT_PATH = (id) => `/reports/${id}`; // gagamitin lang kapag QR_MODE = 'link'

const INK = '#111';
const BLUE = '#1f4e9c';
const FONT = "'Roboto Condensed', 'Arial Narrow', Arial, sans-serif";
const DESIGN_WIDTH = 520; // lapad ng original na design, sa px

// MGA SUKAT (mm). Sinukat sa litrato ng totoong sticker: mga 34 × 18 mm (±1 mm).
// "Medium" ang totoong sukat. Palitan ang mga numero rito kung kailangan.
// May mga alias na key (w/h/widthMm/heightMm) para tugma sa kahit anong binabasa ng downloadElementPdf.
const mk = (label, w, h) => ({ label, width: w, height: h, w, h, widthMm: w, heightMm: h });
const STICKER_SIZES = {
  small: mk('Small · 28×15 mm', 28, 15),
  medium: mk('Actual · 34×18 mm', 34, 18),
  large: mk('Large · 51×27 mm', 51, 27),
};

// Kunin ang unang value na may laman at hindi object
const pick = (...vals) =>
  vals.find((v) => v !== undefined && v !== null && v !== '' && typeof v !== 'object');
const str = (v, fallback = '—') => (v === undefined || v === null || v === '' ? fallback : String(v));

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
    .replace(/ /g, '-'); // 4-Dec-25
};

const NiphcoSticker = forwardRef(function NiphcoSticker({ report = {}, settings = {}, size = 'medium' }, ref) {
  const { width: W, height: H } = STICKER_SIZES[size] || STICKER_SIZES.medium;
  const snap = report?.equipment_snapshot || {};

  // px sa original na design -> mm sa napiling sukat
  const u = (px) => `${((px * W) / DESIGN_WIDTH).toFixed(3)}mm`;
  const line = `max(${u(2)}, .25mm) solid ${INK}`;

  // ── FIELD MAPPING: dagdagan o palitan ang mga pangalan ayon sa database mo ──
  // Kung walang control field, kunin mula sa report number: "CAL-PR0001ME_26-01" -> "PR0001ME"
  const fromReportNo = /^CAL-(.+?)_\d{2}-\d+$/i.exec(str(report.report_number, ''))?.[1];
  const control = str(
    pick(
      snap.asset_id, snap.control_number, snap.control_no, snap.equipment_id, snap.tag_number, snap.id_number,
      report.asset_id, report.control_number, fromReportNo, report.report_number
    )
  );
  const calibratedOn = fmtDate(
    pick(report.calibration_date, report.calibrated_on, report.date_calibrated, report.verification_date)
  );
  const dueOn = fmtDate(pick(report.next_due_date, report.due_date, report.due_on, report.calibration_due_date));
  const result = str(pick(report.result, report.disposition, report.overall_result)).toUpperCase();
  const calibratedBy = str(
    pick(report.calibrated_by, report.approved_by_name, report.verified_by, report.technician_name, report.performed_by)
  );

  const rows = [
    ['Verification date :', calibratedOn],
    ['Due Date :', dueOn],
    ['Disposition :', result],
    ['Verified by :', calibratedBy],
  ];

  // ── Laman ng QR ──
  const detailLines = [
    ['Control no.', control],
    ['Equipment', pick(snap.equipment_name, snap.name)],
    ['Model', pick(snap.model)],
    ['Serial No.', pick(snap.serial_number, snap.serial_no)],
  ]
    .filter(([, v]) => v !== undefined && v !== '—')
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const qrValue = QR_MODE === 'link' ? `${origin}${REPORT_PATH(str(report.id, ''))}` : detailLines;

  return (
    <section
      ref={ref}
      aria-label="Verification sticker"
      style={{
        width: `${W}mm`,
        height: `${H}mm`,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        border: line,
        background: '#fff',
        color: INK,
        fontFamily: FONT,
        overflow: 'hidden',
        printColorAdjust: 'exact',
        WebkitPrintColorAdjust: 'exact',
      }}
    >
      {/* HEADER: logo + title */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: line, padding: `${u(8)} ${u(16)}` }}>
        {settings?.logo_url ? (
          <img
            src={settings.logo_url}
            alt="Logo"
            crossOrigin="anonymous"
            style={{ width: u(40), height: u(40), objectFit: 'contain', flexShrink: 0 }}
          />
        ) : (
          <svg viewBox="0 0 40 40" aria-label="NIPHCO logo" style={{ width: u(40), height: u(40), flexShrink: 0 }}>
            <circle cx="20" cy="20" r="19" fill={BLUE} />
            <path
              d="M12 30 L16 11 L24 25 L27 10"
              fill="none"
              stroke="#fff"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        <p style={{ flex: 1, margin: 0, textAlign: 'center', fontSize: u(30), lineHeight: 1.2, letterSpacing: '.025em' }}>
          NIPHCO - VERIFICATION
        </p>
      </div>

      {/* KATAWAN */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', flex: 1, minHeight: 0 }}>
        {/* Kaliwa: details */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: `${u(4)} ${u(12)}`, minWidth: 0 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: u(16), minWidth: 0 }}>
            <span style={{ fontSize: u(24), lineHeight: 1.2, whiteSpace: 'nowrap' }}>Control no.</span>
            <span style={{ fontSize: u(30), lineHeight: 1.2, fontWeight: 700, overflowWrap: 'anywhere', minWidth: 0 }}>
              {control}
            </span>
          </div>
          {rows.map(([label, value]) => (
            <div
              key={label}
              style={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: `${u(176)} minmax(0, 1fr)`,
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: u(20), lineHeight: 1.2 }}>{label}</span>
              <span
                style={{
                  fontSize: u(20),
                  lineHeight: 1.2,
                  fontWeight: 700,
                  textAlign: 'center',
                  overflowWrap: 'anywhere',
                }}
              >
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Kanan: QR + equipment details */}
        <div style={{ display: 'flex', flexDirection: 'column', width: u(168) }}>
          <p
            style={{
              margin: 0,
              padding: `${u(8)} 0`,
              textAlign: 'center',
              fontSize: u(12),
              lineHeight: u(16),
              letterSpacing: '.025em',
              borderBottom: line,
              borderLeft: line,
            }}
          >
            EQUIPMENT DETAILS
          </p>
          <div
            style={{
              flex: 1,
              display: 'grid',
              placeItems: 'center',
              padding: u(8),
              borderLeft: line,
              minHeight: 0,
            }}
          >
            {qrValue ? (
              <QRCodeCanvas
                value={qrValue}
                size={320}
                level="M"
                marginSize={1}
                bgColor="#ffffff"
                fgColor="#000000"
                style={{ width: u(144), height: u(144) }}
              />
            ) : (
              <div
                style={{
                  width: u(144),
                  height: u(144),
                  display: 'grid',
                  placeItems: 'center',
                  border: '1px dashed #999',
                  fontSize: u(12),
                }}
              >
                QR
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
});

/* ═════════════════════════════════════════════════════════════
   PAGE (walang binago sa layout, buttons, at PDF/print)
   ═════════════════════════════════════════════════════════════ */
export default function Sticker() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { reports, settings, isLoading } = useCalibrationData();
  const [size, setSize] = useState('medium');
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  if (isLoading) return <LoadingState />;
  const r = reports.find((x) => x.id === id);
  if (!r || r.status !== 'approved') return <div className="panel"><EmptyState icon={Lock} title="Sticker unavailable" description="Stickers can be generated once the report is approved." /></div>;

  const pdf = async () => { setBusy(true); await downloadElementPdf(ref.current, `sticker-${r.report_number}.pdf`, STICKER_SIZES[size]); setBusy(false); };

  return (
    <div>
      <Button variant="ghost" size="sm" className="gap-1.5 mb-4 no-print" onClick={() => navigate(-1)}><ArrowLeft className="h-3.5 w-3.5" />Back</Button>
      <PageHeader eyebrow="Equipment Label" title="Calibration Sticker" description={`${r.report_number} · ${r.equipment_snapshot?.equipment_name}`}>
        <Button variant="outline" className="gap-2" onClick={() => window.print()}><Printer className="h-4 w-4" />Print Sticker</Button>
        <Button className="gap-2" onClick={pdf} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Download PDF</Button>
      </PageHeader>
      <div className="flex flex-wrap gap-2 mb-6 no-print">
        {Object.entries(STICKER_SIZES).map(([k, v]) => (
          <button key={k} onClick={() => setSize(k)} className={`rounded-full px-4 py-1.5 text-xs font-medium border transition-all ${size === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white hover:border-slate-400'}`}>{v.label}</button>
        ))}
      </div>
      <div className="panel flex min-h-[340px] items-center justify-center overflow-x-auto bg-[#fcfbf8] p-10 md:p-16">
        <div className="shadow-2xl fade-up" key={size}><NiphcoSticker ref={ref} report={r} settings={settings} size={size} /></div>
      </div>
      <p className="text-xs text-muted-foreground mt-3 no-print">
        {QR_MODE === 'link'
          ? 'Scanning the QR code opens this approved report. Sign-in is required to view it.'
          : 'Scanning the QR code shows the equipment details.'}
      </p>
    </div>
  );
}