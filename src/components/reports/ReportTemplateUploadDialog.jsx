import React, { useEffect, useRef, useState } from 'react';
import { FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiClient } from '@/api/apiClient';

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const parseKeywords = (value) => [...new Set(value.split(/[,\n;]/).map((word) => word.trim().toLowerCase()).filter(Boolean))];

export default function ReportTemplateUploadDialog({ onPublished, templates = [] }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [draft, setDraft] = useState(null);
  const [label, setLabel] = useState('');
  const [keywords, setKeywords] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInput = useRef(null);

  const selectDraft = (next) => {
    setDraft(next);
    setLabel(next?.label || '');
    setKeywords((next?.match || []).join(', '));
    setReviewed(false);
    setError('');
  };

  const loadDrafts = async () => {
    const items = await apiClient.reports.templateDrafts();
    setDrafts(items);
    return items;
  };

  const showDialog = async () => {
    setOpen(true);
    setError('');
    setDraft(null);
    setDrafts([]);
    setFile(null);
    setBusy(true);
    try {
      const items = await loadDrafts();
      if (items.length) selectDraft(items[0]);
    } catch (e) {
      setError(e?.message || 'Could not load template drafts');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!open || !draft?.preview?.ok) {
      setPreviewUrl('');
      return undefined;
    }
    let active = true;
    let objectUrl = '';
    setPreviewLoading(true);
    apiClient.reports.templateDraftPreview(draft.id)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch((e) => {
        if (active) setError(e?.message || 'Could not load the generated PDF preview');
      })
      .finally(() => {
        if (active) setPreviewLoading(false);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, draft?.id, draft?.preview?.ok]);

  const upload = async () => {
    if (!file) return setError('Choose a blank Excel template first');
    if (!/\.(xlsx|xlsm)$/i.test(file.name)) return setError('Upload an .xlsx or .xlsm Excel template');
    if (file.size > MAX_FILE_SIZE) return setError('The template must be 25 MB or smaller');
    setBusy(true);
    setError('');
    try {
      const created = await apiClient.reports.uploadTemplateDraft(file);
      selectDraft(created);
      setDrafts((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
      toast.success('Mapping draft generated. Review the test preview before publishing.');
      if (!created.preview?.ok) setError('A test PDF could not be generated. This template cannot be published yet.');
      try {
        const items = await loadDrafts();
        if (!items.some((item) => item.id === created.id)) setDrafts((current) => [created, ...current]);
      } catch {
        setError('The mapping draft was created, but the pending-draft list could not refresh.');
      }
    } catch (e) {
      setError(e?.message || 'Could not analyze the Excel template');
    } finally {
      setBusy(false);
    }
  };

  const publish = async () => {
    if (!draft) return;
    const terms = parseKeywords(keywords);
    if (!label.trim()) return setError('Enter a template name');
    if (terms.length > 12) return setError('Use no more than 12 matching keywords');
    if (!draft.per_equipment && !terms.length) return setError('Add at least one equipment keyword so reports can find this template');
    if (!draft.preview?.ok) return setError('The generated test preview must succeed before publishing');
    if (draft.preview.errors > 0) return setError(`The test preview contains ${draft.preview.errors} spreadsheet formula error(s). Fix the template and upload it again.`);
    if (!reviewed) return setError('Review the PDF preview and check the confirmation before publishing');

    const replace = Boolean(draft.existing?.mapping || draft.existing?.template);
    if (replace && !window.confirm('An existing template or mapping will be archived before this one is published. Continue?')) return;

    setBusy(true);
    setError('');
    try {
      await apiClient.reports.updateTemplateDraft(draft.id, { label: label.trim(), match: terms });
      await apiClient.reports.publishTemplateDraft(draft.id, replace);
      setDrafts((current) => current.filter((item) => item.id !== draft.id));
      toast.success('Template and mapping published');
      setDraft(null);
      setOpen(false);
      try {
        await onPublished?.();
      } catch {
        toast.error('Published successfully, but the template list could not refresh. Reload the page.');
      }
    } catch (e) {
      setError(e?.message || 'Could not publish the template mapping');
    } finally {
      setBusy(false);
    }
  };

  const removeDraft = async () => {
    if (!draft || !window.confirm(`Delete the draft for "${draft.filename}"?`)) return;
    setBusy(true);
    setError('');
    try {
      await apiClient.reports.deleteTemplateDraft(draft.id);
      const items = drafts.filter((item) => item.id !== draft.id);
      setDrafts(items);
      selectDraft(items[0] || null);
      toast.success('Template draft deleted');
    } catch (e) {
      setError(e?.message || 'Could not delete the draft');
    } finally {
      setBusy(false);
    }
  };

  const keywordsList = parseKeywords(keywords);
  const missingTemplates = templates.filter((item) => item.mapping_configured && !item.template_exists);
  const standardTemplates = templates
    .filter((item) => !item.per_equipment)
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }));
  const individualTemplates = templates
    .filter((item) => item.per_equipment)
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' }));
  const replacementRequired = Boolean(draft?.existing?.mapping || draft?.existing?.template);
  const canPublish = Boolean(draft?.preview?.ok) && !draft?.preview?.errors && reviewed && label.trim() &&
    (draft?.per_equipment || keywordsList.length > 0) && keywordsList.length <= 12;

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={showDialog} disabled={busy}>
        <Upload className="h-3.5 w-3.5" /> Upload Template
      </Button>
      <Dialog open={open} onOpenChange={(next) => { if (!busy) setOpen(next); }}>
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upload Excel Report Template</DialogTitle>
            <DialogDescription>
              Upload a blank .xlsx/.xlsm form. The system will draft a mapping and test it; review the PDF before publishing.
              A standard template is the fallback for its equipment type. A template named with an equipment control number is automatically preferred for that individual unit.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 lg:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.2fr)]">
            <div className="space-y-4">
              <div className="rounded-lg border bg-slate-50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium"><FileSpreadsheet className="h-4 w-4 text-emerald-700" />New template</div>
                <p className="text-xs text-muted-foreground">Use a blank template, not an actual report with readings or personal data. Maximum file size: 25 MB.</p>
                <Input
                  ref={fileInput}
                  type="file"
                  accept=".xlsx,.xlsm"
                  onChange={(event) => { setFile(event.target.files?.[0] || null); setError(''); }}
                  disabled={busy}
                />
                <Button type="button" size="sm" className="w-full gap-2" onClick={upload} disabled={busy || !file}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Analyze & Create Mapping Draft
                </Button>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pending drafts</p>
                {drafts.length ? drafts.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`w-full rounded-md border p-3 text-left text-xs ${draft?.id === item.id ? 'border-blue-500 bg-blue-50' : 'bg-white hover:bg-slate-50'}`}
                    onClick={() => selectDraft(item)}
                    disabled={busy}
                  >
                    <span className="block font-medium">{item.label || item.filename}</span>
                    <span className="mt-1 block truncate text-muted-foreground">{item.filename}</span>
                    <span className="mt-1 block text-muted-foreground">{item.key}</span>
                  </button>
                )) : <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">No pending drafts.</p>}
              </div>

              {missingTemplates.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs font-semibold text-amber-900">Mappings waiting for Excel templates ({missingTemplates.length})</p>
                  <p className="mt-1 text-[11px] text-amber-800">Upload each blank form using its expected filename so it matches the existing mapping.</p>
                  <ul className="mt-2 max-h-36 space-y-2 overflow-y-auto text-[11px]">
                    {missingTemplates.map((item) => (
                      <li key={item.key}>
                        <span className="block font-medium text-amber-950">{item.label}</span>
                        <span className="break-all text-amber-800">{item.template || `${item.key}.xlsx`}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-lg border p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Published templates</p>
                <div className="mt-2 max-h-52 space-y-3 overflow-y-auto">
                  <div>
                    <p className="mb-1 text-[11px] font-semibold text-slate-700">Standard · equipment type</p>
                    {standardTemplates.length ? standardTemplates.map((item) => (
                      <p key={item.key} className="truncate py-0.5 text-[11px] text-slate-600">{item.label}</p>
                    )) : <p className="text-[11px] text-muted-foreground">No standard templates published.</p>}
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-semibold text-slate-700">Individual · control number</p>
                    {individualTemplates.length ? individualTemplates.map((item) => (
                      <p key={item.key} className="truncate py-0.5 text-[11px] text-slate-600">{item.label}</p>
                    )) : <p className="text-[11px] text-muted-foreground">No individual templates published.</p>}
                  </div>
                </div>
              </div>
            </div>

            <div className="min-w-0 space-y-4">
              {!draft ? (
                <div className="flex min-h-64 items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Upload a blank Excel form or choose a pending draft to review its generated mapping.
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="template-label" className="text-xs">Template name</Label>
                      <Input id="template-label" value={label} onChange={(e) => setLabel(e.target.value)} disabled={busy} maxLength={80} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="template-keywords" className="text-xs">Equipment matching keywords</Label>
                      <Input id="template-keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} disabled={busy || draft.per_equipment} placeholder="e.g. digimatic indicator, digimatic" />
                      <p className="text-[11px] text-muted-foreground">{draft.per_equipment ? 'This template is matched to its equipment control number.' : `${keywordsList.length}/12 keywords; separate with commas.`}</p>
                    </div>
                  </div>
                  <p className="rounded-md bg-slate-50 p-3 text-xs text-slate-700">
                    {draft.per_equipment
                      ? draft.equipment
                        ? <>Individual template for <strong>{draft.equipment.code}</strong> · {draft.equipment.name}. It will be selected automatically for this control number.</>
                        : <>Individual template detected from its control-number filename. No matching equipment is currently in the Master List; it will apply when that control number is added.</>
                      : <>Standard equipment template. It will be used when an equipment unit has no matching individual template.</>}
                  </p>

                  <div className="rounded-lg border p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">Automated test preview</p>
                        <p className="text-xs text-muted-foreground">{draft.filename} · {draft.tables?.reduce((sum, group) => sum + group.fields, 0) || 0} detected input fields</p>
                      </div>
                      {draft.preview?.ok ? (
                        <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${draft.preview.errors ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {draft.preview.errors ? `${draft.preview.errors} formula errors` : 'Test generated'}
                        </span>
                      ) : <span className="rounded-full bg-red-100 px-2 py-1 text-[11px] font-medium text-red-700">Preview failed</span>}
                    </div>
                    {draft.preview?.ok && (
                      <p className="mb-2 text-xs text-muted-foreground">
                        {draft.preview.pages} page(s){draft.preview.expected_pages ? ` · expected ${draft.preview.expected_pages}` : ''}
                        {' · '}{draft.preview.passed || 0} passed / {draft.preview.failed || 0} failed test result(s)
                      </p>
                    )}
                    {previewLoading ? (
                      <div className="flex h-72 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading PDF preview…</div>
                    ) : previewUrl ? (
                      <iframe title={`Generated preview for ${draft.filename}`} src={previewUrl} className="h-[24rem] w-full rounded border bg-white" />
                    ) : (
                      <div className="flex h-48 items-center justify-center rounded bg-slate-50 p-4 text-center text-xs text-muted-foreground">
                        {draft.preview?.error || 'No PDF preview is available for this draft.'}
                      </div>
                    )}
                  </div>

                  {(draft.warnings?.length > 0 || draft.info?.length > 0) && (
                    <div className="max-h-36 space-y-2 overflow-y-auto rounded-lg bg-amber-50 p-3 text-xs">
                      {draft.warnings?.map((note, index) => <p key={`warning-${index}`} className="text-amber-900">Review: {note}</p>)}
                      {draft.info?.map((note, index) => <p key={`info-${index}`} className="text-slate-600">{note}</p>)}
                    </div>
                  )}

                  {replacementRequired && (
                    <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                      A template or mapping with this key already exists. Publishing will archive the old files first.
                    </p>
                  )}

                  <label className="flex items-start gap-2 text-xs">
                    <input type="checkbox" className="mt-0.5" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} disabled={busy || !draft.preview?.ok} />
                    <span>I reviewed the generated PDF and the mapping analysis notes.</span>
                  </label>

                  {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

                  <DialogFooter className="mt-2">
                    <Button type="button" variant="outline" onClick={removeDraft} disabled={busy}>
                      Delete Draft
                    </Button>
                    <Button type="button" onClick={publish} disabled={busy || !canPublish}>
                      {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {replacementRequired ? 'Archive & Publish' : 'Publish Mapping'}
                    </Button>
                  </DialogFooter>
                </>
              )}
              {error && !draft && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
