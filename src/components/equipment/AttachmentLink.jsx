import React, { useState } from 'react';
import { Paperclip, Loader2 } from 'lucide-react';
import { apiClient } from '@/api/apiClient';

export default function AttachmentLink({ uri, name }) {
  const [busy, setBusy] = useState(false);
  if (!uri) return null;
  const open = async (ev) => {
    ev.stopPropagation();
    setBusy(true);
    const { signed_url } = await apiClient.integrations.Core.CreateFileSignedUrl({ file_uri: uri, expires_in: 300 });
    setBusy(false);
    window.open(signed_url, '_blank');
  };
  return (
    <button onClick={open} className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline max-w-[180px]">
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
      <span className="truncate">{name || 'Attachment'}</span>
    </button>
  );
}