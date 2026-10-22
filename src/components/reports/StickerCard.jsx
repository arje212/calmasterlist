import React, { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { RESULT_META } from '@/lib/calibration';

// { w, h, label } sa mm. Pareho ang aspect ratio ng tatlo (64 x 50).
export const STICKER_SIZES = {
  small: { w: 48, h: 37.5, label: 'Small · 48×37.5 mm' },
  medium: { w: 64, h: 50, label: 'Medium · 64×50 mm' },
  large: { w: 96, h: 75, label: 'Large · 96×75 mm' },
};

const BLUE = '#1F4E9C';
const LINE = '0.12em solid #9ca3af';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toDate(v) {
  if (!v) return null;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00`) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
// 3-Aug-26
function stickerDate(v) {
  const d = toDate(v);
  return d ? `${d.getDate()}-${MONTHS[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}` : '—';
}

function NiphcoLogo() {
  return (
    <svg viewBox="0 0 40 40" style={{ height: '3.3em', width: '3.3em', flexShrink: 0 }} aria-hidden>
      <circle cx="20" cy="20" r="18" fill="none" stroke="#fff" strokeWidth="2.5" />
      <path d="M12 28 V12 L28 28 V12" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Isang cell ng detalye. May ellipsis kapag masyadong mahaba.
function Cell({ children, bold, nowrap = true, title, pad = '0 0.47em' }) {
  return (
    <div
      title={title}
      style={{
        borderRight: LINE,
        borderBottom: LINE,
        padding: pad,
        display: 'flex',
        alignItems: 'center',
        minWidth: 0,
        fontWeight: bold ? 700 : 600,
      }}
    >
      <span
        style={{
          display: 'block',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: nowrap ? 'nowrap' : 'normal',
        }}
      >
        {children}
      </span>
    </div>
  );
}

const StickerCard = forwardRef(({ report: r, settings, size }, ref) => {
  const { w, h } = STICKER_SIZES[size] || STICKER_SIZES.medium;
  const m = RESULT_META[r.result] || RESULT_META.pass;
  const s = r.equipment_snapshot || {};
  const reportUrl = new URL(`/reports/${r.id}`, window.location.origin).toString();
  const due = toDate(r.next_due_date);

  // Application limit: isang linya bawat hati. Palitan ang field name kung iba ang gamit mo.
  const limitRaw = s.application_limit || s.measuring_range || s.range || r.application_limit || '';
  const limits = String(limitRaw).split('\n').map((x) => x.trim()).filter(Boolean);

  const rows = [
    ['Control no.', s.equipment_code || r.report_number],
    ['Verification date', stickerDate(r.verification_date)],
    ['Due Date', stickerDate(r.next_due_date)],
    ['Disposition', m.label],
    ['Verified by', r.verified_by || '—'],
  ];

  return (
    <div
      ref={ref}
      className="print-area flex flex-col overflow-hidden bg-white text-black"
      style={{
        width: `${w}mm`,
        height: `${h}mm`,
        fontSize: `${(w / 64) * 8.5}px`,
        fontFamily: 'Arial, Helvetica, sans-serif',
        // I-reset ang anumang global style ng app (uppercase, small-caps, letter-spacing)
        textTransform: 'none',
        fontVariant: 'normal',
        letterSpacing: 'normal',
        lineHeight: 1.3,
      }}
    >
      {/* Verification header */}
      <div style={{ backgroundColor: BLUE, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.94em', padding: '0.6em 0.94em' }}>
        <NiphcoLogo />
        <div style={{ lineHeight: 1.15 }}>
          <div style={{ fontSize: '1.53em', fontWeight: 700, letterSpacing: '0.03em' }}>NIPHCO</div>
          <div style={{ fontSize: '1.06em', letterSpacing: '0.15em' }}>VERIFICATION</div>
        </div>
      </div>

      <div style={{ display: 'flex', flex: '1 1 0', minHeight: 0 }}>
        {/* Details: grid na div (hindi table) para hindi tamaan ng global table styles */}
        <div
          style={{
            flex: '1 1 0',
            minWidth: 0,
            display: 'grid',
            gridTemplateColumns: 'max-content max-content minmax(0, 1fr)',
            gridTemplateRows: 'repeat(5, 1fr)',
            borderTop: LINE,
            borderLeft: LINE,
          }}
        >
          {rows.map(([k, v]) => (
            <React.Fragment key={k}>
              <Cell>{k}</Cell>
              <Cell pad="0 0.3em">:</Cell>
              <Cell bold title={String(v)}>{v}</Cell>
            </React.Fragment>
          ))}
        </div>

        {/* Due month + QR */}
        <div
          style={{
            width: '26%',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            borderTop: LINE,
            borderRight: LINE,
            borderBottom: LINE,
          }}
        >
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '4em', fontWeight: 900, lineHeight: 1 }}>
            {due ? due.getMonth() + 1 : ''}
          </div>
          <div style={{ padding: '0.4em', lineHeight: 0 }}>
            <QRCodeSVG
              value={reportUrl}
              size={240}
              level="M"
              bgColor="#ffffff"
              fgColor="#000000"
              title={`Open approved report ${r.report_number}`}
              style={{ height: '5.4em', width: '5.4em' }}
            />
          </div>
        </div>
      </div>

      {/* Application limit */}
      <div style={{ backgroundColor: BLUE, color: '#fff', textAlign: 'center', fontSize: '1.18em', fontWeight: 700, letterSpacing: '0.04em', padding: '0.35em 0.85em' }}>
        NIPHCO - APPLICATION LIMIT
      </div>
      <div style={{ border: LINE, borderTop: 'none', textAlign: 'center', padding: '0.4em 0.94em', lineHeight: 1.35 }}>
        {limits.length ? limits.map((line, i) => <div key={i}>{line}</div>) : <div>—</div>}
      </div>
    </div>
  );
});

export default StickerCard;