import { useEffect, useRef, useState } from 'react';
import {
  CalendarClock, FileText, MessageCircle, Minimize2, RotateCcw,
  Send, Wrench, X, Mic, MicOff, Volume2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link } from 'react-router-dom';
import { apiClient } from '@/api/apiClient';
import './assistant-mascot.css';

const HISTORY_KEY = 'qa-qc-assistant-history-v1';
const GREETING = "Hi! I'm Arjay — your AI assistant. How may I help you?";

const MARKDOWN_COMPONENTS = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  table: ({ children }) => (
    <div className="my-2 max-w-full overflow-x-auto rounded-lg border bg-white">
      <table className="min-w-full border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="whitespace-nowrap bg-slate-100 px-2 py-1.5 font-semibold">{children}</th>,
  td: ({ children }) => <td className="max-w-[12rem] break-words border-t px-2 py-1.5 align-top">{children}</td>,
};

const SUGGESTIONS = [
  'When is the next due date of this equipment?',
  'Which equipment is expired or due in the next 30 days?',
  'Find the calibration procedure for this equipment',
  'Find the process instruction for this equipment',
  'Compare the process instruction with the procedure and suggest a revision',
];

function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(saved) ? saved.slice(-12) : [];
  } catch {
    return [];
  }
}

function AssistantMascot({ small = false }) {
  return (
    <div className={`qa-mascot ${small ? 'qa-mascot-small' : ''}`} role="img" aria-label="Arjay the AI assistant robot">
      <span className="qa-mascot-spark qa-mascot-spark-one">✦</span>
      <span className="qa-mascot-spark qa-mascot-spark-two">✧</span>
      <div className="qa-mascot-shadow" />
      <div className="qa-mascot-character">
        <div className="qa-mascot-antenna"><i /></div>
        <div className="qa-mascot-ear qa-mascot-ear-left" />
        <div className="qa-mascot-ear qa-mascot-ear-right" />
        <div className="qa-mascot-face">
          <div className="qa-mascot-eyes"><i /><i /></div>
          <div className="qa-mascot-cheeks"><i /><i /></div>
          <div className="qa-mascot-mouth" />
        </div>
        <div className="qa-mascot-body"><span>✦</span></div>
        <div className="qa-mascot-arm qa-mascot-arm-left" />
        <div className="qa-mascot-arm qa-mascot-arm-right" />
      </div>
    </div>
  );
}

export default function Assistant({ initiallyOpen = false }) {
  const [open, setOpen] = useState(initiallyOpen);
  const [messages, setMessages] = useState(loadHistory);
  const [draft, setDraft] = useState('');
  const [configured, setConfigured] = useState(null);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState('');
  const [listening, setListening] = useState(false);
  const [typedGreeting, setTypedGreeting] = useState('');
  const [suggestionsVisible, setSuggestionsVisible] = useState(0);
  const [introRun, setIntroRun] = useState(0);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);

  const latestAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant');
  const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user');
  const companionIsExplaining = Boolean(open && latestAssistantMessage && latestUserMessage
    && messages.lastIndexOf(latestAssistantMessage) > messages.lastIndexOf(latestUserMessage));
  const companionText = waiting
    ? 'I’m checking that for you…'
    : latestAssistantMessage?.content
      ? latestAssistantMessage.content.replace(/[#>*_`\\[\\]()]/g, ' ').replace(/\\s+/g, ' ').trim().slice(0, 150)
      : '';

  const startIntro = () => {
    setTypedGreeting('');
    setSuggestionsVisible(0);
    setIntroRun((run) => run + 1);
  };

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-12)));
    } catch (storageError) {
      console.warn('Could not save assistant chat history:', storageError);
    }
  }, [messages]);

  useEffect(() => {
    let active = true;
    apiClient.assistant.status()
      .then(({ configured: ready, provider }) => {
        if (active) setConfigured(ready ? (provider || 'AI') : false);
      })
      .catch((statusError) => {
        if (!active) return;
        if (statusError.status === 404) {
          setError('The API server has not been updated for the Assistant yet. Restart the API server (npm run server), then refresh the page.');
        } else {
          setError(statusError.message || 'Could not connect to the Assistant API.');
        }
      });
    return () => { active = false; };
  }, []);

  // Type the welcome message, then reveal suggestions one by one.
  useEffect(() => {
    if (!open || messages.length > 0) return undefined;
    let charIndex = 0;
    let suggestionIndex = 0;
    let suggestionTimer;
    const typeTimer = window.setInterval(() => {
      charIndex += 1;
      setTypedGreeting(GREETING.slice(0, charIndex));
      if (charIndex >= GREETING.length) {
        window.clearInterval(typeTimer);
        suggestionTimer = window.setInterval(() => {
          suggestionIndex += 1;
          setSuggestionsVisible(suggestionIndex);
          if (suggestionIndex >= SUGGESTIONS.length) {
            window.clearInterval(suggestionTimer);
            window.setTimeout(() => inputRef.current?.focus(), 180);
          }
        }, 105);
      }
    }, 34);
    return () => {
      window.clearInterval(typeTimer);
      if (suggestionTimer) window.clearInterval(suggestionTimer);
    };
  }, [open, messages.length, introRun]);

  // Only auto-scroll when actual chat activity happens.
  // Do NOT scroll when the panel opens or when suggestions are revealed:
  // that was pushing the welcome area upward and hiding Arjay behind the header.
  useEffect(() => {
    if (open && (messages.length > 0 || waiting || error)) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, waiting, error]);

  useEffect(() => {
    if (open && messages.length > 0) inputRef.current?.focus();
  }, [open, messages.length]);

  useEffect(() => () => {
    recognitionRef.current?.stop?.();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }, []);

  const sendMessage = async (value = draft) => {
    const text = value.trim();
    if (!text || waiting) return;
    const nextMessages = [...messages, { role: 'user', content: text }].slice(-12);
    setMessages(nextMessages);
    setDraft('');
    setError('');
    setWaiting(true);
    try {
      // Keep the existing API message format (user/assistant only).
      // Put the language preference in the latest user prompt instead of adding
      // a system-role message, because this endpoint validates chat message roles.
      const requestMessages = nextMessages.map((message, index) => {
        if (index !== nextMessages.length - 1 || message.role !== 'user') return message;
        return {
          ...message,
          content: `${message.content}\n\n[Reply in the same language as this message: English for English, Filipino/Tagalog for Filipino/Tagalog, and natural Taglish for Taglish. Preserve equipment IDs and official document names.]`,
        };
      });
      const result = await apiClient.assistant.chat(requestMessages);
      setMessages([...nextMessages, {
        role: 'assistant',
        content: result.text,
        sources: result.sources || [],
      }].slice(-12));
    } catch (requestError) {
      if (requestError.status === 404) {
        setError('The API server has not been updated for the Assistant yet. Restart the API server (npm run server), then refresh the page.');
      } else {
        setError(requestError.message || 'Could not connect to the AI service.');
      }
    } finally {
      setWaiting(false);
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setDraft('');
    setError('');
    setListening(false);
    recognitionRef.current?.stop?.();
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    startIntro();
    window.setTimeout(() => inputRef.current?.focus(), 1600);
  };

  const togglePanel = () => {
    if (open) {
      setOpen(false);
    } else {
      setOpen(true);
      if (messages.length === 0) startIntro();
    }
  };

  const toggleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Voice input is not supported in this browser. Please use a recent version of Chrome or Edge.');
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    setError('');
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      setDraft((current) => current ? `${current} ${transcript}` : transcript);
    };
    recognition.onerror = (event) => {
      setError(event.error === 'not-allowed'
        ? 'Microphone permission was denied. Allow microphone access in your browser.'
        : 'Voice input could not start. Please try again.');
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
      setError('Could not start microphone input. Please try again.');
    }
  };

  const speakMessage = (text) => {
    if (!('speechSynthesis' in window)) {
      setError('Text-to-speech is not supported in this browser.');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1;
    utterance.pitch = 1.08;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className={`no-print qa-assistant-root fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6 ${open ? 'is-open' : 'is-closed'}`}>
      {!open && (
        <div className="qa-outside-companion" aria-hidden="true">
          <div className="qa-leaning-robot"><AssistantMascot /></div>
          <span className="qa-companion-hello">Hey! I’m Arjay.</span>
        </div>
      )}
      {open && companionIsExplaining && (
        <div className={`qa-popout-companion ${waiting ? 'is-thinking' : 'is-explaining'}`} aria-live="polite">
          <div className="qa-popout-bubble">
            <strong>{waiting ? 'Arjay is thinking' : 'Here’s what I found'}</strong>
            <span>{waiting ? companionText : `${companionText}${companionText.length >= 150 ? '…' : ''}`}</span>
          </div>
          <div className="qa-popout-robot"><AssistantMascot /></div>
        </div>
      )}
      {open && (
        <section
          id="assistant-chat"
          aria-label="QA/QC AI Assistant chat"
          className="qa-chat-panel panel flex h-[min(700px,calc(100dvh-6.5rem))] w-[min(440px,calc(100vw-2rem))] flex-col overflow-hidden shadow-2xl shadow-slate-900/20"
        >
          <header className="flex shrink-0 items-center justify-between bg-slate-950 px-4 py-3 text-white">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-violet-100">
                <AssistantMascot small />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold">QA Nikkoshi System Assistant</h2>
                <p className="text-xs text-slate-400">
                  {configured === false ? 'Local records and document search' : configured ? `${configured} AI · Ask anything` : 'Connecting to assistant…'}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {messages.length > 0 && (
                <button type="button" onClick={clearConversation} aria-label="New chat" title="New chat"
                  className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white">
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" title="Close chat"
                className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white">
                <Minimize2 className="h-4 w-4" />
              </button>
            </div>
          </header>

          {configured === false && (
            <div role="status" className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs leading-relaxed text-amber-950">
              A server key is required to generate answers or revision drafts from documents. Searching equipment, reports, due dates, and document excerpts still works. Configure <code className="rounded bg-amber-100 px-1">GROQ_API_KEY</code> or <code className="rounded bg-amber-100 px-1">AI_GATEWAY_API_KEY</code> on the server.
            </div>
          )}

          <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/70 p-3 sm:p-4">
            {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-relaxed text-red-800">{error}</div>}

            {messages.length === 0 ? (
              <div className="flex min-h-full flex-col items-center justify-start px-0 pb-4 pt-3">
                <div className="qa-arjay-entry mb-1">
                  <AssistantMascot />
                </div>
                <div className="qa-speech-bubble" aria-live="polite">
                  <span>{typedGreeting}</span>{typedGreeting.length < GREETING.length && <i className="qa-type-cursor" aria-hidden="true" />}
                </div>
                <div className="mt-2 mb-3 text-center">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> ARJAY IS READY
                  </span>
                  <p className="mt-1 text-xs text-muted-foreground">Ask about equipment, reports, procedures, or process instructions.</p>
                </div>
                <div className="grid w-full gap-2">
                  {SUGGESTIONS.map((suggestion, index) => (
                    <button key={suggestion} type="button" onClick={() => sendMessage(suggestion)}
                      style={{ animationDelay: `${index * 70}ms` }}
                      className={`qa-suggestion rounded-xl border bg-white px-3 py-2.5 text-left text-xs leading-relaxed transition-colors hover:border-primary/40 hover:bg-blue-50/50 ${index < suggestionsVisible ? 'is-visible' : ''}`}
                      tabIndex={index < suggestionsVisible ? 0 : -1}>
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`qa-message-row flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.role === 'assistant' && (
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-violet-100">
                    <AssistantMascot small />
                  </div>
                )}
                <div className={`max-w-[88%] space-y-2 ${message.role === 'user'
                  ? 'rounded-2xl rounded-br-md bg-primary px-3 py-2.5 text-xs text-white'
                  : 'min-w-0 flex-1 pt-1 text-xs leading-relaxed'}`}>
                  {message.role === 'assistant' ? (
                    <div className="break-words">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>{message.content}</ReactMarkdown>
                    </div>
                  ) : <p className="whitespace-pre-wrap break-words">{message.content}</p>}
                  {message.role === 'assistant' && (
                    <button type="button" onClick={() => speakMessage(message.content)}
                      className="inline-flex items-center gap-1 rounded-md px-1 py-1 text-[10px] text-violet-700 hover:bg-violet-50"
                      title="Read response aloud"><Volume2 className="h-3 w-3" /> Listen</button>
                  )}
                  {message.sources?.length > 0 && (
                    <div className="space-y-2">
                      {message.sources.map((source) => {
                        const Icon = source.type === 'report' || source.type === 'procedure' ? FileText : source.next_due_date ? CalendarClock : Wrench;
                        return (
                          <Link key={`${source.type}:${source.id}`} to={source.href} onClick={() => setOpen(false)}
                            className="block rounded-xl border bg-white p-2.5 text-slate-800 transition-colors hover:border-primary/40 hover:bg-blue-50/40">
                            <span className="flex items-start gap-2">
                              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                              <span className="min-w-0">
                                <span className="block break-words text-xs font-semibold">{source.title}</span>
                                <span className="mt-1 block text-xs text-muted-foreground">
                                  {source.type === 'report' ? `${source.status || 'Report'}${source.next_due_date ? ` · Due ${source.next_due_date}` : ''}`
                                    : source.type === 'procedure' ? source.relative_path
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
                {message.role === 'user' && <div aria-hidden="true" className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">You</div>}
              </div>
            ))}

            {waiting && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status" aria-live="polite">
                <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl bg-violet-100"><AssistantMascot small /></div>
                <span className="qa-thinking-dots" aria-label="Arjay is thinking"><i /><i /><i /></span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={(event) => { event.preventDefault(); sendMessage(); }} className="shrink-0 border-t bg-white p-3">
            <label htmlFor="assistant-message" className="sr-only">Message to Arjay</label>
            <div className="flex items-end gap-2">
              <button type="button" onClick={toggleVoiceInput} aria-label={listening ? 'Stop voice input' : 'Start voice input'}
                title={listening ? 'Stop listening' : 'Voice input'}
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${listening ? 'bg-rose-100 text-rose-700 animate-pulse' : 'border bg-slate-50 text-slate-600 hover:bg-violet-50 hover:text-violet-700'}`}>
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <textarea ref={inputRef} id="assistant-message" value={draft} onChange={(event) => setDraft(event.target.value)}
                maxLength={1500} rows={2}
                onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }}
                placeholder={listening ? 'Listening... speak now' : 'Ask about equipment or documents...'}
                className="min-h-11 flex-1 resize-none rounded-xl border bg-slate-50 px-3 py-2.5 text-xs outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60"
                disabled={waiting} />
              <button type="submit" disabled={!draft.trim() || waiting} aria-label="Send message"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {listening ? 'Microphone is active. Tap the mic to stop.' : 'Shift+Enter for a new line. Verify important information against the record.'}
            </p>
          </form>
        </section>
      )}

      <button type="button" onClick={togglePanel}
        aria-label={open ? 'Close AI Assistant' : 'Open AI Assistant'}
        aria-expanded={open} aria-controls="assistant-chat"
        className="qa-chat-launcher group relative flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-900/30 transition hover:scale-105 hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-300">
        {!open && <span className="qa-launcher-pulse" aria-hidden="true" />}
        {!open && <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-400" />}
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}
