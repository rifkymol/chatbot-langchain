"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  FileText,
  Library,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";

type ChatMode = "auto" | "qa" | "summary" | "action_plan" | "checklist" | "priority";

type SourceItem = {
  title?: string | null;
  source?: string | null;
  source_type?: string | null;
  page?: number | null;
  chunk_index?: number | null;
  relevance_score?: number | null;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceItem[];
};

type KnowledgeSource = {
  title?: string | null;
  source?: string | null;
  source_type?: string | null;
  chunks?: number | null;
};

type StatusToast = {
  id: string;
  message: string;
  tone: "success" | "error";
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

const starterMessages: Message[] = [
  {
    id: "welcome",
    role: "assistant",
    content:
      "Hi, I am ready to help you!",
  },
];

function createSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `session-${Date.now()}`;
}

function getBrowserSessionId() {
  if (typeof window === "undefined") {
    return "";
  }

  const storedSessionId = window.localStorage.getItem("chatbot-session-id");
  const nextSessionId = storedSessionId ?? createSessionId();

  window.localStorage.setItem("chatbot-session-id", nextSessionId);
  return nextSessionId;
}

function sourceLabel(source: SourceItem) {
  return source.title || source.source || "Knowledge source";
}

function knowledgeSourceLabel(source: KnowledgeSource) {
  return source.title || source.source || "Untitled knowledge";
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>(starterMessages);
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<ChatMode>("auto");
  const [sourceInput, setSourceInput] = useState("");
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>(
    [],
  );
  const [showKnowledge, setShowKnowledge] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [deletingSource, setDeletingSource] = useState("");
  const [error, setError] = useState("");
  const [knowledgeMessage, setKnowledgeMessage] = useState("");
  const [statusToast, setStatusToast] = useState<StatusToast | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [sessionId, setSessionId] = useState(() => getBrowserSessionId());

  const canSend = message.trim().length > 0 && !isSending;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  useEffect(() => {
    if (!statusToast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setStatusToast(null);
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [statusToast]);

  const sessionBadge = useMemo(() => {
    if (!sessionId) {
      return "Starting session";
    }

    return sessionId.slice(0, 8);
  }, [sessionId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const userText = message.trim();
    if (!userText || isSending || !sessionId) {
      return;
    }

    const userMessage: Message = {
      id: createSessionId(),
      role: "user",
      content: userText,
    };
    const typedSource = sourceInput.trim();
    const requestSources = typedSource
      ? Array.from(new Set([...selectedSources, typedSource]))
      : selectedSources;

    setMessages((current) => [...current, userMessage]);
    setMessage("");
    setSourceInput("");
    setSelectedSources(requestSources);
    setError("");
    setIsSending(true);

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: sessionId,
          message: userText,
          mode,
          source: requestSources.length > 0 ? requestSources : null,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const detail =
          typeof data?.detail === "string"
            ? data.detail
            : "The chatbot API returned an error.";
        throw new Error(detail);
      }

      setMessages((current) => [
        ...current,
        {
          id: createSessionId(),
          role: "assistant",
          content: data.answer ?? "No answer was returned.",
          sources: data.sources ?? [],
        },
      ]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to reach the chatbot API.",
      );
    } finally {
      setIsSending(false);
    }
  }

  function addSelectedSource(nextSource: string) {
    const normalizedSource = nextSource.trim();

    if (!normalizedSource) {
      return;
    }

    setSelectedSources((current) => {
      if (current.includes(normalizedSource)) {
        return current;
      }

      return [...current, normalizedSource];
    });
  }

  function showStatus(message: string, tone: StatusToast["tone"] = "success") {
    setStatusToast({
      id: createSessionId(),
      message,
      tone,
    });
  }

  function removeSelectedSource(sourceToRemove: string) {
    setSelectedSources((current) =>
      current.filter((item) => item !== sourceToRemove),
    );
  }

  function addTypedSource() {
    addSelectedSource(sourceInput);
    setSourceInput("");
  }

  function clearConversation() {
    const nextSessionId = createSessionId();

    window.localStorage.setItem("chatbot-session-id", nextSessionId);
    setSessionId(nextSessionId);
    setMessages(starterMessages);
    setMessage("");
    setError("");
    setKnowledgeMessage("");
    setSelectedSources([]);
    setSourceInput("");
    setShowKnowledge(false);
  }

  async function loadKnowledgeSources() {
    setError("");
    setKnowledgeMessage("");
    setIsLoadingSources(true);

    try {
      const response = await fetch(`${API_BASE_URL}/knowledge/sources`);
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const detail =
          typeof data?.detail === "string"
            ? data.detail
            : "Unable to load knowledge sources.";
        throw new Error(detail);
      }

      setKnowledgeSources(data.sources ?? []);
      setShowKnowledge(true);
      setKnowledgeMessage(`Loaded ${data.count ?? data.sources?.length ?? 0} sources.`);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to load knowledge sources.",
      );
    } finally {
      setIsLoadingSources(false);
    }
  }

  async function handlePdfUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError("");
    setKnowledgeMessage("");
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_BASE_URL}/knowledge/upload-pdf`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const detail =
          typeof data?.detail === "string"
            ? data.detail
            : "Unable to upload PDF.";
        throw new Error(detail);
      }

      setKnowledgeMessage(
        `${data.filename ?? file.name} uploaded. ${data.chunks ?? 0} chunks added.`,
      );
      showStatus(`${data.filename ?? file.name} uploaded successfully.`);
      await loadKnowledgeSources();
    } catch (caughtError) {
      const nextError =
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to upload PDF.";

      setError(nextError);
      showStatus(nextError, "error");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  async function deleteKnowledgeSource(sourceToDelete: string) {
    const normalizedSource = sourceToDelete.trim();

    if (!normalizedSource || deletingSource) {
      return;
    }

    setError("");
    setDeletingSource(normalizedSource);

    try {
      const response = await fetch(
        `${API_BASE_URL}/knowledge/source?source=${encodeURIComponent(
          normalizedSource,
        )}`,
        {
          method: "DELETE",
        },
      );
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const detail =
          typeof data?.detail === "string"
            ? data.detail
            : "Unable to delete knowledge source.";
        throw new Error(detail);
      }

      setKnowledgeSources((current) =>
        current.filter(
          (item) => (item.source ?? item.title ?? "") !== normalizedSource,
        ),
      );
      removeSelectedSource(normalizedSource);
      setKnowledgeMessage(`${normalizedSource} deleted.`);
      showStatus(`${normalizedSource} deleted successfully.`);
    } catch (caughtError) {
      const nextError =
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to delete knowledge source.";

      setError(nextError);
      showStatus(nextError, "error");
    } finally {
      setDeletingSource("");
    }
  }

  return (
    <main className="h-screen overflow-hidden bg-[var(--surface)] text-[var(--ink)]">
      {statusToast && (
        <div
          className={`fixed right-4 top-4 z-50 max-w-sm rounded-md border px-4 py-3 text-sm shadow-lg ${
            statusToast.tone === "success"
              ? "border-[var(--success-line)] bg-[var(--success)] text-[var(--success-ink)]"
              : "border-[var(--warning-line)] bg-[var(--warning)] text-[var(--warning-ink)]"
          }`}
          role="status"
        >
          <div className="flex items-start gap-3">
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-current" />
            <p className="leading-5">{statusToast.message}</p>
            <button
              type="button"
              onClick={() => setStatusToast(null)}
              className="ml-auto rounded text-current opacity-70 transition hover:opacity-100"
              aria-label="Close status"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <div className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="shrink-0 flex flex-col gap-4 border-b border-[var(--line)] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs font-medium text-[var(--muted)] shadow-sm">
              <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
              API {API_BASE_URL}
            </div>
            <h1 className="text-2xl font-semibold tracking-normal sm:text-3xl">
              Chatbot workspace
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              Ask questions, keep context in one session, and review returned
              knowledge sources without leaving the conversation.
            </p>
          </div>

          <div className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-xs text-[var(--muted)] shadow-sm">
            Session <span className="font-semibold text-[var(--ink)]">{sessionBadge}</span>
          </div>
        </header>

        <section className="flex min-h-0 flex-1 flex-col gap-4 py-5">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-[var(--line)] bg-white shadow-sm">
            <div className="shrink-0 flex flex-col gap-3 border-b border-[var(--line)] px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-[var(--accent)]" />
                Conversation
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handlePdfUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="inline-flex items-center gap-2 rounded border border-[var(--line)] bg-white px-3 py-2 text-xs font-medium text-[var(--ink)] transition hover:bg-[var(--soft)] disabled:cursor-not-allowed disabled:text-[var(--muted)]"
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Upload PDF
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (showKnowledge) {
                      setShowKnowledge(false);
                      return;
                    }

                    void loadKnowledgeSources();
                  }}
                  disabled={isLoadingSources}
                  className="inline-flex items-center gap-2 rounded border border-[var(--line)] bg-white px-3 py-2 text-xs font-medium text-[var(--ink)] transition hover:bg-[var(--soft)] disabled:cursor-not-allowed disabled:text-[var(--muted)]"
                >
                  {isLoadingSources ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Library className="h-4 w-4" />
                  )}
                  {showKnowledge ? "Hide Knowledge" : "List Knowledge"}
                </button>
                <button
                  type="button"
                  onClick={clearConversation}
                  className="rounded px-2 py-1 text-xs font-medium text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--ink)]"
                >
                  Clear
                </button>
              </div>
            </div>

            {(knowledgeMessage || showKnowledge) && (
              <div className="shrink-0 border-b border-[var(--line)] bg-[var(--surface)] px-4 py-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase text-[var(--muted)]">
                      <FileText className="h-4 w-4" />
                      Knowledge
                    </div>
                    {knowledgeMessage && (
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {knowledgeMessage}
                      </p>
                    )}
                  </div>
                  {showKnowledge && (
                    <button
                      type="button"
                      onClick={loadKnowledgeSources}
                      className="inline-flex items-center gap-2 rounded px-2 py-1 text-xs font-medium text-[var(--muted)] transition hover:bg-white hover:text-[var(--ink)]"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Refresh
                    </button>
                  )}
                </div>

                {showKnowledge && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {knowledgeSources.length > 0 ? (
                      knowledgeSources.map((item, index) => (
                        <div
                          key={`${knowledgeSourceLabel(item)}-${index}`}
                          className="flex max-w-full items-stretch overflow-hidden rounded border border-[var(--line)] bg-white text-xs text-[var(--muted)] transition hover:border-[var(--accent)]"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              addSelectedSource(item.source ?? item.title ?? "")
                            }
                            className="min-w-0 px-3 py-2 text-left transition hover:bg-[var(--soft)] hover:text-[var(--ink)]"
                          >
                            <span className="block max-w-56 truncate font-medium text-[var(--ink)]">
                              {knowledgeSourceLabel(item)}
                            </span>
                            <span>
                              {item.source_type ?? "source"}
                              {typeof item.chunks === "number"
                                ? `, ${item.chunks} chunks`
                                : ""}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void deleteKnowledgeSource(
                                item.source ?? item.title ?? "",
                              )
                            }
                            disabled={
                              deletingSource === (item.source ?? item.title ?? "")
                            }
                            className="flex w-9 shrink-0 items-center justify-center border-l border-[var(--line)] text-[var(--muted)] transition hover:bg-[var(--warning)] hover:text-[var(--warning-ink)] disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label={`Delete ${knowledgeSourceLabel(item)}`}
                          >
                            {deletingSource ===
                            (item.source ?? item.title ?? "") ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--muted)]">
                        No knowledge sources found yet.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[linear-gradient(180deg,#ffffff_0%,#f7faf8_100%)] p-4">
              {messages.map((item) => (
                <article
                  key={item.id}
                  className={`flex gap-3 ${
                    item.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {item.role === "assistant" && (
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--soft)] text-[var(--accent)]">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[82%] rounded-md px-4 py-3 text-sm leading-6 ${
                      item.role === "user"
                        ? "bg-[var(--ink)] text-white"
                        : "border border-[var(--line)] bg-white text-[var(--ink)]"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{item.content}</p>

                    {item.sources && item.sources.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--line)] pt-3">
                        {item.sources.map((sourceItem, index) => (
                          <span
                            key={`${sourceLabel(sourceItem)}-${index}`}
                            className="rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--muted)]"
                          >
                            {sourceLabel(sourceItem)}
                            {sourceItem.page ? ` p.${sourceItem.page}` : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {item.role === "user" && (
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-white">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </article>
              ))}

              {isSending && (
                <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--soft)] text-[var(--accent)]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                  Thinking through the context...
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {error && (
              <div className="border-t border-[var(--line)] bg-[var(--warning)] px-4 py-3 text-sm text-[var(--warning-ink)]">
                {error}
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="shrink-0 border-t border-[var(--line)] bg-white p-3"
            >
              <div className="flex gap-3">
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder="Ask your chatbot..."
                  rows={1}
                  className="max-h-32 min-h-11 flex-1 resize-none rounded border border-[var(--line)] bg-[var(--surface)] px-3 py-3 text-sm leading-5 outline-none transition focus:border-[var(--accent)] focus:bg-white"
                />
                <button
                  type="submit"
                  disabled={!canSend}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-[var(--accent)] text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:bg-[var(--line)]"
                  aria-label="Send message"
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-[160px_1fr]">
                <label className="flex min-h-11 items-center gap-2 rounded border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--muted)]">
                  <span className="font-semibold text-[var(--ink)]">Mode</span>
                  <select
                    value={mode}
                    onChange={(event) => setMode(event.target.value as ChatMode)}
                    className="min-w-0 flex-1 bg-transparent text-sm capitalize text-[var(--ink)] outline-none"
                  >
                    <option value="auto">Auto</option>
                    <option value="qa">QA</option>
                    <option value="summary">Summary</option>
                    <option value="action_plan">Action Plan</option>
                    <option value="checklist">Checklist</option>
                    <option value="priority">Priority</option>
                  </select>
                </label>

                <div className="flex min-h-11 flex-wrap items-center gap-2 rounded border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--muted)]">
                  <span className="font-semibold text-[var(--ink)]">Source</span>
                  {selectedSources.map((item) => (
                    <span
                      key={item}
                      className="inline-flex max-w-full items-center gap-1 rounded border border-[var(--line)] bg-white px-2 py-1 text-xs text-[var(--ink)]"
                    >
                      <span className="max-w-48 truncate">{item}</span>
                      <button
                        type="button"
                        onClick={() => removeSelectedSource(item)}
                        className="rounded text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--ink)]"
                        aria-label={`Remove ${item}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                  <input
                    value={sourceInput}
                    onChange={(event) => setSourceInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addTypedSource();
                      }
                    }}
                    onBlur={addTypedSource}
                    placeholder={
                      selectedSources.length > 0
                        ? "Add another source"
                        : "Optional file/source"
                    }
                    className="min-w-36 flex-1 bg-transparent text-sm text-[var(--ink)] outline-none"
                  />
                </div>
              </div>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
