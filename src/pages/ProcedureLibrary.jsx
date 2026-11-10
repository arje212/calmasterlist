import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, BookOpen, Download, Eye, FileSpreadsheet, FileText, Folder, FolderUp, RefreshCw, Search, ShieldCheck, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/api/apiClient';
import { useMe } from '@/hooks/useCalData';
import PageHeader from '@/components/common/PageHeader';
import LoadingState from '@/components/common/LoadingState';
import ProcedurePdfViewer from '@/components/documents/ProcedurePdfViewer';

const ACCEPTED_TYPES = '.doc,.xls,.xlsx';
const LIBRARIES = {
  procedure: {
    title: 'Procedures',
    description: 'Mga pamamaraan para sa calibration ng equipment',
    singular: 'procedure',
    queryKey: ['procedure-documents', 'procedure'],
  },
  process_instruction: {
    title: 'Process Instructions',
    description: 'Mga work instruction para sa mga proseso',
    singular: 'process instruction',
    queryKey: ['procedure-documents', 'process_instruction'],
  },
};

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function previewCellValue(cell) {
  return typeof cell === 'string' ? cell : String(cell?.value || '');
}

function getPreviewControlNumber(preview, fileName) {
  const cells = preview?.kind === 'text'
    ? [preview.text || '']
    : (preview?.sheets || []).flatMap((sheet) => (sheet.rows || []).flatMap((row) => (row.cells || []).map(previewCellValue)));
  const text = cells.join(' ');
  const match = text.match(/(?:control\s*(?:no\.?|number|#)|document\s*(?:no\.?|number|code|#)|doc\.?\s*no\.?)\s*[:#-]?\s*([A-Z0-9][A-Z0-9./_-]{2,})/i);
  if (match) return match[1].trim();
  return fileName.match(/\b((?:NPP|KSPI)(?:-[A-Z0-9]+)+)\b/i)?.[1] || '';
}

function ProcedureLibrary({ documentType = 'procedure' }) {
  const library = LIBRARIES[documentType] || LIBRARIES.procedure;
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const folderInput = useRef(null);
  const previewReplaceInput = useRef(null);
  const [filter, setFilter] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [actionError, setActionError] = useState('');
  const [previewDocument, setPreviewDocument] = useState(null);
  const isAdmin = me?.role === 'admin';
  const documentsQuery = useQuery({
    queryKey: library.queryKey,
    queryFn: () => apiClient.procedures.list(documentType),
  });
  const previewQuery = useQuery({
    queryKey: ['procedure-preview', documentType, previewDocument?.id],
    queryFn: () => apiClient.procedures.preview(previewDocument.id, documentType),
    enabled: Boolean(previewDocument),
    staleTime: 0,
    retry: false,
  });
  const documents = documentsQuery.data || [];
  const visibleDocuments = useMemo(() => {
    const query = filter.trim().toLocaleLowerCase();
    return query
      ? documents.filter((document) => `${document.original_name} ${document.relative_path}`.toLocaleLowerCase().includes(query))
      : documents;
  }, [documents, filter]);
  const documentsByFolder = useMemo(() => {
    if (documentType !== 'process_instruction') return [];
    const folders = new Map();
    visibleDocuments.forEach((document) => {
      const segments = String(document.relative_path || document.original_name).replaceAll('\\', '/').split('/').filter(Boolean);
      const folderName = segments.length > 1 ? segments[0] : 'Walang folder';
      if (!folders.has(folderName)) folders.set(folderName, []);
      folders.get(folderName).push(document);
    });
    return [...folders.entries()]
      .sort(([first], [second]) => first.localeCompare(second, undefined, { numeric: true, sensitivity: 'base' }))
      .map(([name, folderDocuments]) => ({ name, documents: folderDocuments }));
  }, [documentType, visibleDocuments]);

  useEffect(() => {
    if (!previewDocument) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setPreviewDocument(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [previewDocument]);

  const uploadFiles = async (files, isFolderUpload = false) => {
    const selected = Array.from(files || []);
    if (!selected.length) return;
    setUploading(true);
    setActionError('');
    let uploaded = 0;
    const errors = [];
    for (let index = 0; index < selected.length; index += 1) {
      const file = selected[index];
      const relativePath = isFolderUpload ? (file.webkitRelativePath || file.name) : file.name;
      setUploadProgress(`Ina-upload ${index + 1} sa ${selected.length}: ${relativePath}`);
      try {
        await apiClient.procedures.upload(file, relativePath, documentType);
        uploaded += 1;
      } catch (error) {
        errors.push(`${relativePath}: ${error.message}`);
      }
    }
    await queryClient.invalidateQueries({ queryKey: library.queryKey });
    setUploading(false);
    setUploadProgress('');
    if (uploaded) toast.success(`${uploaded} ${library.singular} file${uploaded === 1 ? '' : 's'} naidagdag o napalitan`);
    if (errors.length) {
      const detail = errors.slice(0, 5).join('\n');
      setActionError(`${errors.length} file ang hindi na-upload:\n${detail}${errors.length > 5 ? `\n…at ${errors.length - 5} pa.` : ''}`);
      toast.error(`${errors.length} file ang hindi na-upload. Tingnan ang detalye sa page.`);
    }
  };

  const replaceFile = async (document, file) => {
    setActionError('');
    try {
      await apiClient.procedures.replace(document.id, file);
      await queryClient.invalidateQueries({ queryKey: library.queryKey });
      await queryClient.invalidateQueries({ queryKey: ['procedure-preview', documentType, document.id] });
      await queryClient.invalidateQueries({ queryKey: ['procedure-workbook', documentType, document.id] });
      toast.success(`${document.original_name} napalitan na`);
    } catch (error) {
      setActionError(`Hindi napalitan ang ${document.original_name}: ${error.message}`);
      toast.error(`Hindi napalitan ang ${library.singular} file.`);
    }
  };

  const removeFile = async (document) => {
    if (!window.confirm(`Alisin ang "${document.original_name}" sa procedure library?`)) return;
    setActionError('');
    try {
      await apiClient.procedures.remove(document.id);
      await queryClient.invalidateQueries({ queryKey: library.queryKey });
      toast.success(`Inalis na ang ${library.singular} file`);
    } catch (error) {
      setActionError(`Hindi naalis ang ${document.original_name}: ${error.message}`);
      toast.error(`Hindi naalis ang ${library.singular} file.`);
    }
  };

  const downloadFile = async (document) => {
    setActionError('');
    try {
      const file = await apiClient.procedures.download(document.id);
      const url = URL.createObjectURL(file);
      const anchor = window.document.createElement('a');
      anchor.href = url;
      anchor.download = document.original_name;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setActionError(`Hindi ma-download ang ${document.original_name}: ${error.message}`);
      toast.error('Hindi ma-download ang procedure file.');
    }
  };

  const renderDocument = (document) => (
    <article key={document.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${document.extension === '.doc' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-700'}`}>
          {document.extension === '.doc' ? <FileText className="h-4 w-4" /> : <FileSpreadsheet className="h-4 w-4" />}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-all text-xs font-semibold text-slate-900">{document.original_name}</h3>
            {document.archived ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600"><Archive className="h-3 w-3" /> Archive</span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700"><ShieldCheck className="h-3 w-3" /> Ginagamit sa {library.title}</span>
            )}
          </div>
          <p className="mt-1 break-all text-[11px] text-muted-foreground">{document.relative_path}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">{document.extension.toUpperCase().slice(1)} · {formatBytes(document.size)}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 self-end sm:self-auto">
        <button type="button" onClick={() => setPreviewDocument(document)} title="Tingnan ang file" aria-label={`Tingnan ang ${document.original_name}`}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-blue-50 hover:text-primary"><Eye className="h-4 w-4" /></button>
        <button type="button" onClick={() => downloadFile(document)} title="I-download ang original file" aria-label={`I-download ang ${document.original_name}`}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"><Download className="h-4 w-4" /></button>
        {isAdmin && (
          <>
            <label title="Palitan ang file" className="cursor-pointer rounded-lg p-2 text-slate-500 transition hover:bg-blue-50 hover:text-primary">
              <RefreshCw className="h-4 w-4" />
              <span className="sr-only">Palitan ang {document.original_name}</span>
              <input type="file" accept={ACCEPTED_TYPES} className="hidden" disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.item(0);
                  if (file) replaceFile(document, file);
                  event.target.value = '';
                }} />
            </label>
            <button type="button" onClick={() => removeFile(document)} title="Alisin ang file" aria-label={`Alisin ang ${document.original_name}`}
              className="rounded-lg p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
          </>
        )}
      </div>
    </article>
  );

  if (documentsQuery.isLoading) return <LoadingState label="Loading procedure library…" />;

  const activeCount = documents.filter((document) => !document.archived).length;
  const archivedCount = documents.length - activeCount;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="DOCUMENTS" title={library.title} description={library.description} children={null} />

      <section className="panel space-y-4 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-primary"><BookOpen className="h-5 w-5" /></div>
          <div>
            <h2 className="text-sm font-semibold">{library.title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Gagamitin ng Assistant ang active files sa {library.title} para sa tanong tungkol sa library na ito. Kapag tahasang hiniling na ihambing ang Process Instruction at Procedure, maghahanap ito sa dalawang library. Maaaring mag-download ang staff; admin lang ang puwedeng magdagdag, magpalit, o mag-alis ng files.
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              DOC at XLS/XLSX lang ang tinatanggap (hanggang 10 MB bawat file). Hindi mababasa ang scanned image-only documents.
            </p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex flex-col gap-3 rounded-xl border border-dashed border-blue-200 bg-blue-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <FolderUp className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="text-xs font-semibold">Magdagdag ng {library.title.toLocaleLowerCase()} folder</p>
                <p className="mt-1 text-[11px] text-muted-foreground">Piliin ang folder; ia-upload ang lahat ng DOC, XLS, at XLSX sa loob. Ang laman ng folder na `Invalid` ay maitatabi bilang archive at hindi gagamitin ng Assistant.</p>
              </div>
            </div>
            <button type="button" onClick={() => folderInput.current?.click()} disabled={uploading}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
              {uploading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? 'Nag-a-upload…' : 'Pumili ng folder'}
            </button>
            <input ref={(element) => { folderInput.current = element; element?.setAttribute('webkitdirectory', ''); }}
              type="file" multiple accept={ACCEPTED_TYPES} className="hidden"
              onChange={(event) => {
                uploadFiles(event.target.files, true);
                event.target.value = '';
              }} />
          </div>
        )}

        {uploadProgress && <p role="status" aria-live="polite" className="break-all text-xs text-primary">{uploadProgress}</p>}
        {actionError && <p role="alert" className="whitespace-pre-line rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{actionError}</p>}
        {documentsQuery.isError && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            Hindi makuha ang procedure library: {documentsQuery.error.message}
            <button type="button" onClick={() => documentsQuery.refetch()} className="ml-2 inline-flex items-center gap-1 font-semibold underline"><RefreshCw className="h-3 w-3" /> Subukan ulit</button>
          </div>
        )}
      </section>

      <section className="panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">{library.title}</h2>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">{activeCount} active</span>
            {archivedCount > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">{archivedCount} archived</span>}
          </div>
          <label className="relative block sm:w-64">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Hanapin sa documents…"
              className="h-9 w-full rounded-lg border bg-white pl-9 pr-3 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
          </label>
        </div>

        {visibleDocuments.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <BookOpen className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-medium">{documents.length ? 'Walang tugmang document' : `Wala pang ${library.singular} files`}</p>
            <p className="mt-1 text-xs text-muted-foreground">{documents.length ? 'Subukan ang ibang pangalan o folder.' : `Admin ay maaaring pumili ng folder para idagdag ang ${library.title.toLocaleLowerCase()}.`}</p>
          </div>
        ) : (
          documentType === 'process_instruction' ? (
            <div className="space-y-3 p-4">
              {documentsByFolder.map((folder) => {
                const folderArchivedCount = folder.documents.filter((document) => document.archived).length;
                return (
                  <details key={folder.name} className="overflow-hidden rounded-xl border bg-white">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 bg-slate-50 px-4 py-3 hover:bg-blue-50/60">
                      <span className="flex min-w-0 items-center gap-2">
                        <Folder className="h-4 w-4 shrink-0 text-primary" />
                        <span className="break-all text-xs font-semibold text-slate-900">{folder.name}</span>
                      </span>
                      <span className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{folder.documents.length} instruction{folder.documents.length === 1 ? '' : 's'}</span>
                        {folderArchivedCount > 0 && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-slate-600">{folderArchivedCount} archive</span>}
                      </span>
                    </summary>
                    <div className="divide-y border-t">{folder.documents.map(renderDocument)}</div>
                  </details>
                );
              })}
            </div>
          ) : (
            <div className="divide-y">{visibleDocuments.map(renderDocument)}</div>
          )
        )}
        {isAdmin && <div className="flex items-center gap-2 border-t bg-slate-50 px-4 py-3 text-[10px] text-muted-foreground"><Upload className="h-3 w-3" /> Para mag-edit, palitan ang original document gamit ang updated na file.</div>}
      </section>

      {previewDocument && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6">
          <button type="button" aria-label="Isara ang preview" className="absolute inset-0 bg-slate-950/60" onClick={() => setPreviewDocument(null)} />
          <section role="dialog" aria-modal="true" aria-labelledby="procedure-preview-title"
            className="relative z-10 flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border bg-white shadow-2xl">
            <header className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-primary">
                  {previewDocument.extension === '.doc' ? <FileText className="h-4 w-4" /> : <FileSpreadsheet className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <h2 id="procedure-preview-title" className="truncate text-sm font-semibold">{previewDocument.original_name}</h2>
                  <p className="truncate text-[11px] font-semibold text-primary">
                    Control No.: {previewQuery.data?.control_number
                      || getPreviewControlNumber(previewQuery.data, previewDocument.original_name)
                      || (previewQuery.isError ? 'Hindi nakita sa dokumento' : 'Kinukuha…')}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">{previewDocument.relative_path}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" onClick={() => downloadFile(previewDocument)} title="I-download ang original para i-edit sa Excel o Word"
                  className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"><Download className="h-3.5 w-3.5" /><span className="hidden sm:inline">I-download para i-edit</span></button>
                {isAdmin && (
                  <>
                    <button type="button" onClick={() => previewReplaceInput.current?.click()} title="I-upload ang in-edit na original file"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-2 text-xs font-medium text-white hover:bg-primary/90">
                      <Upload className="h-3.5 w-3.5" /><span className="hidden sm:inline">Upload edited file</span>
                    </button>
                    <input ref={previewReplaceInput} type="file" accept={ACCEPTED_TYPES} className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.item(0);
                        if (file) replaceFile(previewDocument, file);
                        event.target.value = '';
                      }} />
                  </>
                )}
                <button type="button" onClick={() => setPreviewDocument(null)} aria-label="Isara ang preview"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"><X className="h-4 w-4" /></button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-auto bg-slate-50 p-3 sm:p-6">
              <ProcedurePdfViewer documentId={previewDocument.id} documentType={documentType} />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default ProcedureLibrary;
