import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { apiClient } from '@/api/apiClient';

export default function ProcedurePdfViewer({ documentId, documentType }) {
  const [pdfUrl, setPdfUrl] = useState('');
  const pdfQuery = useQuery({
    queryKey: ['procedure-pdf', documentType, documentId],
    queryFn: () => apiClient.procedures.pdf(documentId, documentType),
    enabled: Boolean(documentId),
    retry: false,
  });

  useEffect(() => {
    if (!pdfQuery.data) {
      setPdfUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(pdfQuery.data);
    setPdfUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pdfQuery.data]);

  if (pdfQuery.isLoading || (pdfQuery.isSuccess && !pdfUrl)) {
    return <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground"><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Opening document…</div>;
  }
  if (pdfQuery.isError) {
    return (
      <div role="alert" className="mx-auto mt-8 max-w-lg rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        Could not display the file as a document: {pdfQuery.error.message}
        <button type="button" onClick={() => pdfQuery.refetch()} className="ml-2 font-semibold underline">Try again</button>
      </div>
    );
  }
  return <iframe title="Procedure document view" src={pdfUrl} className="h-[calc(92dvh-120px)] w-full rounded-lg border bg-white" />;
}
