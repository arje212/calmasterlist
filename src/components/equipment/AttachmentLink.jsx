import React, { useState } from 'react';
import { Paperclip, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/api/apiClient';

export default function AttachmentLink({ uri, name }) {
  const [busy, setBusy] = useState(false);
  if (!uri) return null;
  const open = async (ev) => {
    ev.stopPropagation();
    const popup = window.open('about:blank', '_blank');
    if (!popup) {
      toast.error('Allow pop-ups to open this attachment');
      return;
    }
    setBusy(true);
    try {
      const { signed_url } = await apiClient.integrations.Core.CreateFileSignedUrl({ file_uri: uri, expires_in: 300 });
      popup.location.href = signed_url;
      window.setTimeout(() => URL.revokeObjectURL(signed_url), 60_000);
    } catch (error) {
      popup.close();
      toast.error(error.message || 'Could not open attachment');
    } finally {
      setBusy(false);
    }
  };
  return (
    <button onClick={open} className="inline-flex items-center gap-1 text-xs text-primary hover:underline max-w-[180px]">
      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
      <span className="truncate">{name || 'Attachment'}</span>
    </button>
  );
}