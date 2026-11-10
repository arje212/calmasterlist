import { useEffect, useRef, useState } from 'react';
import { Bot, CalendarClock, FileText, MessageCircle, Minimize2, RotateCcw, Send, Sparkles, Wrench, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router-dom';
import { apiClient } from '@/api/apiClient';

const MARKDOWN_COMPONENTS = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  table: ({ children }) => (
    <div className="my-2 max-w-full overflow-x-auto rounded-lg border bg-white">
      <table className="min-w-full border-collapse text-left text-[11px]">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="whitespace-nowrap bg-slate-100 px-2 py-1.5 font-semibold">{children}</th>,
  td: ({ children }) => <td className="max-w-[12rem] break-words border-t px-2 py-1.5 align-top">{children}</td>,
};

const SUGGESTIONS = [
  'Hanapin ang caliper na may number C0034ME',
  'Kailan ang next due date ng equipment na ito?',
  'Aling equipment ang expired o due sa susunod na 30 araw?',
  'Hanapin ang report para sa C0034ME',
  'Hanapin ang calibration procedure para sa equipment na ito',
  'Hanapin ang process instruction para sa equipment na ito',
  'Ihambing ang process instruction sa procedure at magmungkahi ng revision',
];

export default function Assistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [configured, setConfigured] = useState(null);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    let active = true;
    apiClient.assistant.status()
      .then(({ configured: ready, provider }) => { if (active) setConfigured(ready ? (provider || 'AI') : false); })
      .catch((statusError) => {
        if (!active) return;
        if (statusError.status === 404) {
          setError('Hindi pa updated ang API server para sa Assistant. I-restart ang API server (npm run server), saka i-refresh ang page.');
        } else {
          setError(statusError.message || 'Hindi makakonekta sa Assistant API.');
        }
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, waiting, open, error]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const sendMessage = async (value = draft) => {
    const text = value.trim();
    if (!text || waiting) return;
    const nextMessages = [...messages, { role: 'user', content: text }].slice(-12);
    setMessages(nextMessages);
    setDraft('');
    setError('');
    setWaiting(true);
    try {
      const result = await apiClient.assistant.chat(nextMessages);
      setMessages([...nextMessages, { role: 'assistant', content: result.text, sources: result.sources || [] }]);
    } catch (requestError) {
      if (requestError.status === 404) {
        setError('Hindi pa updated ang API server para sa Assistant. I-restart ang API server (npm run server), saka i-refresh ang page.');
      } else {
        setError(requestError.message || 'Hindi makakonekta sa AI service.');
      }
    } finally {
      setWaiting(false);
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setDraft('');
    setError('');
  };

  return (
    <div className="no-print fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <section id="assistant-chat" aria-label="AI Assistant chat" className="panel flex h-[min(680px,calc(100dvh-6.5rem))] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden shadow-2xl shadow-slate-900/20">
          <header className="flex shrink-0 items-center justify-between bg-slate-950 px-4 py-3 text-white">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white"><Sparkles className="h-4 w-4" /></div>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold">QA/QC Nikkoshi System Assistant</h2>
                <p className="text-[11px] text-slate-400">{configured === false ? 'Local records and document search' : configured ? `${configured} AI · Ask anything` : 'Connecting to assistant…'}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {messages.length > 0 && <button type="button" onClick={clearConversation} aria-label="New chat" title="New chat" className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white"><RotateCcw className="h-4 w-4" /></button>}
              <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" title="Close chat" className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white"><Minimize2 className="h-4 w-4" /></button>
            </div>
          </header>

          {configured === false && (
            <div role="status" className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs leading-relaxed text-amber-950">
              Kailangan ng server key para gumawa ng sagot o revision draft mula sa documents. Search ng equipment, report, due date, at document excerpts ay available pa rin. I-configure ang <code className="rounded bg-amber-100 px-1">GROQ_API_KEY</code> o <code className="rounded bg-amber-100 px-1">AI_GATEWAY_API_KEY</code> sa server.
            </div>
          )}

          <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/70 p-3 sm:p-4">
            {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-relaxed text-red-800">{error}</div>}
            {messages.length === 0 ? (
              <div className="flex min-h-full flex-col justify-center py-4">
                <div className="mb-4 text-center">
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-primary"><Bot className="h-5 w-5" /></div>
                  <h3 className="mt-3 text-sm font-semibold">Ano ang hahanapin natin?</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Magtanong tungkol sa equipment, report, procedure, o process instruction.</p>
                </div>
                <div className="grid gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button key={suggestion} type="button" onClick={() => sendMessage(suggestion)}
                      className="rounded-xl border bg-white px-3 py-2.5 text-left text-xs leading-relaxed transition-colors hover:border-primary/40 hover:bg-blue-50/50">
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.role === 'assistant' && <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-primary"><Bot className="h-4 w-4" /></div>}
                <div className={`max-w-[88%] space-y-2 ${message.role === 'user' ? 'rounded-2xl rounded-br-md bg-primary px-3 py-2.5 text-xs text-white' : 'min-w-0 flex-1 pt-1 text-xs leading-relaxed'}`}>
                  {message.role === 'assistant' ? (
                    <div className="break-words">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>{message.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  )}
                  {message.sources?.length > 0 && (
                    <div className="space-y-2">
                      {message.sources.map((source) => {
                        const Icon = source.type === 'report' || source.type === 'procedure' ? FileText : source.next_due_date ? CalendarClock : Wrench;
                        return (
                          <Link key={`${source.type}:${source.id}`} to={source.href} onClick={() => setOpen(false)} className="block rounded-xl border bg-white p-2.5 text-slate-800 transition-colors hover:border-primary/40 hover:bg-blue-50/40">
                            <span className="flex items-start gap-2">
                              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                              <span className="min-w-0">
                                <span className="block break-words text-[11px] font-semibold">{source.title}</span>
                                <span className="mt-1 block text-[10px] text-muted-foreground">
                                  {source.type === 'report'
                                    ? `${source.status || 'Report'}${source.next_due_date ? ` · Due ${source.next_due_date}` : ''}`
                                    : source.type === 'procedure'
                                      ? source.relative_path
                                      : `${source.location || 'Equipment'}${source.next_due_date ? ` · Due ${source.next_due_date}` : ''}`}
                                </span>
                              </span>
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
                {message.role === 'user' && <div aria-hidden="true" className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold text-slate-700">You</div>}
              </div>
            ))}
            {waiting && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status" aria-live="polite">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-primary"><Bot className="h-4 w-4" /></div>
                Naghahanap sa records at documents...
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={(event) => { event.preventDefault(); sendMessage(); }} className="shrink-0 border-t bg-white p-3">
            <label htmlFor="assistant-message" className="sr-only">Mensahe sa AI Assistant</label>
            <div className="flex items-end gap-2">
              <textarea ref={inputRef} id="assistant-message" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1500} rows={2}
                onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }}
                placeholder="Hal. Ihambing ang PI sa procedure..." className="min-h-11 flex-1 resize-none rounded-xl border bg-slate-50 px-3 py-2.5 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
                disabled={waiting} />
              <button type="submit" disabled={!draft.trim() || waiting} aria-label="Ipadala ang mensahe"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">Shift+Enter para sa bagong linya. I-verify ang mahalagang impormasyon sa record.</p>
          </form>
        </section>
      )}

      <button type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? 'Isara ang AI Assistant' : 'Buksan ang AI Assistant'} aria-expanded={open} aria-controls="assistant-chat"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg shadow-primary/30 transition hover:scale-105 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30">
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}
