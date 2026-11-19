import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RESULTS, RESULT_META } from '@/lib/calibration';

const TEXT = [
  ['equipment_code', 'Control Number *'], ['equipment_name', 'Equipment Name *'], ['category', 'Equipment Type *'],
  ['manufacturer', 'Maker'], ['model', 'Model'], ['serial_number', 'Serial Number'],
  ['asset_number', 'Asset Number'], ['location', 'Location *'], ['department', 'Department *'],
  ['responsible_person', 'Responsible Person'], ['certificate_number', 'Certificate Number'],
];

// The values used in the masterlist data.
const VERIFICATION_TYPES = ['In-House Verification', 'External Provider Calibration', 'Customer Calibration', 'Customer Property', 'Reference'];

export default function EquipmentFormFields({ form, setForm, errors }) {
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const field = (k, label, props = {}) => (
    <div key={k} className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input value={form[k] ?? ''} onChange={(e) => set(k, e.target.value)} className={errors[k] ? 'border-red-400' : ''} {...props} />
      {errors[k] && <p className="text-xs text-red-600">{errors[k]}</p>}
    </div>
  );
  // If an equipment still has an older value (e.g. "Calibration"), keep it in the list so it shows and is not lost on save.
  const current = form.calibration_type;
  const typeOptions = !current || VERIFICATION_TYPES.includes(current) ? VERIFICATION_TYPES : [current, ...VERIFICATION_TYPES];
  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TEXT.map(([k, l]) => field(k, l))}
        <div className="space-y-1.5">
          <Label className="text-xs">Verification *</Label>
          <Select value={form.calibration_type} onValueChange={(v) => set('calibration_type', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{typeOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
          {errors.calibration_type && <p className="text-xs text-red-600">{errors.calibration_type}</p>}
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 rounded-lg bg-slate-50 p-4">
        {field('frequency_months', 'Frequency (months) *', { type: 'number', min: 1 })}
        {field('last_verification_date', 'Last Verification Date', { type: 'date' })}
        {field('next_due_date', 'Next Due Date (auto if blank)', { type: 'date' })}
        <div className="space-y-1.5">
          <Label className="text-xs">Result</Label>
          <Select value={form.last_result || 'none'} onValueChange={(v) => set('last_result', v === 'none' ? '' : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="none">—</SelectItem>{RESULTS.map((r) => <SelectItem key={r} value={r}>{RESULT_META[r].label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5"><Label className="text-xs">Range</Label><Textarea rows={2} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} /></div>
        <div className="space-y-1.5"><Label className="text-xs">Remarks</Label><Textarea rows={2} value={form.remarks ?? ''} onChange={(e) => set('remarks', e.target.value)} /></div>
      </div>
    </div>
  );
}