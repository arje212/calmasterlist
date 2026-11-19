import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RESULTS, RESULT_META, calcNextDue, resultDesc } from '@/lib/calibration';

export default function VerifyFormFields({ form, setForm, file, setFile, frequency, settings }) {
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Verification / Calibration Date *</Label>
          <Input type="date" value={form.verification_date || ''} onChange={(e) => setForm((f) => ({ ...f, verification_date: e.target.value, next_due_date: calcNextDue(e.target.value, frequency) }))} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Next Due Date * <span className="text-muted-foreground">(auto: +{frequency || 12} months - 1 day)</span></Label>
          <Input type="date" value={form.next_due_date || ''} onChange={(e) => set('next_due_date', e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Result *</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {RESULTS.map((r) => {
            const m = RESULT_META[r];
            const on = form.result === r;
            return (
              <button type="button" key={r} onClick={() => set('result', r)}
                className={`rounded-lg border-2 px-3 py-3 text-left transition-all ${on ? `${m.border} bg-white shadow-sm` : 'border-slate-200 hover:border-slate-300'}`}>
                <span className={`block h-2 w-2 rounded-full mb-2 ${m.solid}`} />
                <span className={`font-mono text-xs font-semibold ${on ? m.text : 'text-slate-700'}`}>{m.label}</span>
              </button>
            );
          })}
        </div>
        {form.result && <p className="text-xs text-muted-foreground">{resultDesc(settings, form.result)}</p>}
      </div>
      <div className="space-y-1.5"><Label className="text-xs">Verification Method</Label><Input value={form.verification_method || ''} onChange={(e) => set('verification_method', e.target.value)} placeholder="e.g. Comparison against certified reference weights (OIML E2)" /></div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5"><Label className="text-xs">Findings</Label><Textarea rows={3} value={form.findings || ''} onChange={(e) => set('findings', e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Remarks</Label><Textarea rows={3} value={form.remarks || ''} onChange={(e) => set('remarks', e.target.value)} /></div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Certificate / Supporting Document (PDF, JPG, PNG · max 10 MB)</Label>
        <Input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        {file && <p className="text-xs text-muted-foreground">{file.name}</p>}
      </div>
    </div>
  );
}