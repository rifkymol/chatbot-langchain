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
  Plus,
  Check,
  ChevronDown,
  Copy,
  File,
  Search,
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

type UploadResponse = {
  filename?: string;
  chunks?: number;
  detail?: string;
};

type UploadStage = "idle" | "uploading" | "processing";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

const chatModes: Array<{ value: ChatMode; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "qa", label: "QA" },
  { value: "summary", label: "Summary" },
  { value: "action_plan", label: "Action Plan" },
  { value: "checklist", label: "Checklist" },
  { value: "priority", label: "Priority" },
];

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

function getKnowledgeSourceValue(source: KnowledgeSource) {
  return source.source || source.title || "";
}

function dedupeKnowledgeSources(sources: KnowledgeSource[]) {
  const sourceMap = new Map<string, KnowledgeSource>();

  for (const item of sources) {
    const key = getKnowledgeSourceValue(item).trim().toLowerCase();
    if (!key) {
      continue;
    }

    const existing = sourceMap.get(key);

    if (!existing) {
      sourceMap.set(key, item);
      continue;
    }

    sourceMap.set(key, {
      ...existing,
      title: existing.title || item.title,
      source: existing.source || item.source,
      source_type: existing.source_type || item.source_type,
      chunks: (existing.chunks ?? 0) + (item.chunks ?? 0),
    });
  }

  return Array.from(sourceMap.values());
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
  const [showSourceSuggestions, setShowSourceSuggestions] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState<UploadStage>("idle");
  const [uploadFileName, setUploadFileName] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isLoadingSources, setIsLoadingSources] = useState(false);
  const [deletingSource, setDeletingSource] = useState("");
  const [error, setError] = useState("");
  const [knowledgeMessage, setKnowledgeMessage] = useState("");
  const [statusToast, setStatusToast] = useState<StatusToast | null>(null);
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const modeMenuRef = useRef<HTMLDivElement | null>(null);
  const sourcePickerRef = useRef<HTMLDivElement | null>(null);
  const [sessionId, setSessionId] = useState(() => getBrowserSessionId());

  const canSend = message.trim().length > 0 && !isSending;
  const filteredKnowledgeSources = useMemo(() => {
    const query = sourceInput.trim().toLowerCase();

    if (!query) {
      return knowledgeSources;
    }

    return knowledgeSources.filter((item) => {
      const label = knowledgeSourceLabel(item).toLowerCase();
      const value = getKnowledgeSourceValue(item).toLowerCase();

      return label.includes(query) || value.includes(query);
    });
  }, [knowledgeSources, sourceInput]);

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

  useEffect(() => {
    function closeModeMenu(event: MouseEvent) {
      if (
        modeMenuRef.current &&
        !modeMenuRef.current.contains(event.target as Node)
      ) {
        setIsModeMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", closeModeMenu);

    return () => document.removeEventListener("mousedown", closeModeMenu);
  }, []);

  useEffect(() => {
    function closeSourceSuggestions(event: MouseEvent) {
      if (
        sourcePickerRef.current &&
        !sourcePickerRef.current.contains(event.target as Node)
      ) {
        setShowSourceSuggestions(false);
      }
    }

    document.addEventListener("mousedown", closeSourceSuggestions);

    return () =>
      document.removeEventListener("mousedown", closeSourceSuggestions);
  }, []);

  const sessionBadge = useMemo(() => {
    if (!sessionId) {
      return "Starting session";
    }

    return sessionId.slice(0, 8);
  }, [sessionId]);

  const activeModeLabel = chatModes.find((item) => item.value === mode)?.label;

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

  async function copyReply(messageId: string, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      showStatus("Reply copied.");

      window.setTimeout(() => {
        setCopiedMessageId((current) => (current === messageId ? "" : current));
      }, 1600);
    } catch {
      showStatus("Unable to copy reply.", "error");
    }
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
    setShowSourceSuggestions(false);
  }

  async function loadKnowledgeSources(options?: {
    showPanel?: boolean;
    showSuggestions?: boolean;
  }) {
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

      const uniqueSources = dedupeKnowledgeSources(data.sources ?? []);

      setKnowledgeSources(uniqueSources);
      setShowKnowledge(options?.showPanel ?? false);
      setShowSourceSuggestions(options?.showSuggestions ?? false);
      setKnowledgeMessage(
        options?.showPanel ? `Loaded ${uniqueSources.length} sources.` : "",
      );
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
    setUploadStage("uploading");
    setUploadFileName(file.name);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const data = await new Promise<UploadResponse>((resolve, reject) => {
        const request = new XMLHttpRequest();

        request.open("POST", `${API_BASE_URL}/knowledge/upload-pdf`);

        request.upload.onprogress = (progressEvent) => {
          if (!progressEvent.lengthComputable) {
            return;
          }

          const nextProgress = Math.round(
            (progressEvent.loaded / progressEvent.total) * 100,
          );
          const boundedProgress = Math.min(nextProgress, 100);

          setUploadProgress(boundedProgress);

          if (boundedProgress >= 100) {
            setUploadStage("processing");
          }
        };

        request.onload = () => {
          let parsedData: UploadResponse = {};

          try {
            parsedData = request.responseText
              ? JSON.parse(request.responseText)
              : {};
          } catch {
            parsedData = {};
          }

          if (request.status >= 200 && request.status < 300) {
            setUploadStage("processing");
            resolve(parsedData);
            return;
          }

          reject(
            new Error(
              typeof parsedData?.detail === "string"
                ? parsedData.detail
                : "Unable to upload PDF.",
            ),
          );
        };

        request.onerror = () => reject(new Error("Unable to upload PDF."));
        request.send(formData);
      });

      setKnowledgeMessage(
        `${data.filename ?? file.name} uploaded. ${data.chunks ?? 0} chunks added.`,
      );
      showStatus(`${data.filename ?? file.name} uploaded successfully.`);
      await loadKnowledgeSources({
        showPanel: true,
        showSuggestions: false,
      });
    } catch (caughtError) {
      const nextError =
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to upload PDF.";

      setError(nextError);
      showStatus(nextError, "error");
    } finally {
      setIsUploading(false);
      setUploadStage("idle");
      setUploadProgress(0);
      event.target.value = "";
    }
  }

  function openKnowledgePicker() {
    setShowSourceSuggestions(true);

    if (knowledgeSources.length > 0 || isLoadingSources) {
      return;
    }

    void loadKnowledgeSources({
      showPanel: false,
      showSuggestions: true,
    });
  }

  function handleSourceInputChange(value: string) {
    setSourceInput(value);
    openKnowledgePicker();
  }

  function selectKnowledgeSource(sourceValue: string) {
    addSelectedSource(sourceValue);
    setSourceInput("");
    setShowSourceSuggestions(false);
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
        dedupeKnowledgeSources(
          current.filter(
            (item) => getKnowledgeSourceValue(item) !== normalizedSource,
          ),
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
                  className="inline-flex items-center gap-2 rounded border border-[var(--line)] bg-white px-3 py-2 text-xs font-medium text-[var(--ink)] shadow-sm transition hover:border-[var(--accent)] hover:bg-[var(--soft)] disabled:cursor-not-allowed disabled:text-[var(--muted)]"
                >
                  <Upload className="h-4 w-4" />
                  {isUploading
                    ? uploadStage === "processing"
                      ? "Processing"
                      : `${uploadProgress}%`
                    : "Upload PDF"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (showKnowledge) {
                      setShowKnowledge(false);
                      setShowSourceSuggestions(false);
                      setKnowledgeMessage("");
                      return;
                    }

                    void loadKnowledgeSources({
                      showPanel: true,
                      showSuggestions: false,
                    });
                  }}
                  disabled={isLoadingSources}
                  className="inline-flex items-center gap-2 rounded border border-[var(--line)] bg-white px-3 py-2 text-xs font-medium text-[var(--ink)] shadow-sm transition hover:border-[var(--accent)] hover:bg-[var(--soft)] disabled:cursor-not-allowed disabled:text-[var(--muted)]"
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
                  className="rounded px-3 py-2 text-xs font-medium text-[var(--muted)] transition hover:bg-[var(--soft)] hover:text-[var(--ink)]"
                >
                  Clear
                </button>
              </div>
            </div>

            {isUploading && uploadFileName && (
              <div className="shrink-0 border-b border-[var(--line)] bg-white px-4 py-3">
                <div className="overflow-hidden rounded border border-[var(--line)] bg-[var(--surface)]">
                  {uploadStage === "processing" ? (
                    <div className="h-1 overflow-hidden bg-[var(--line)]">
                      <div className="h-full w-1/3 animate-[upload-processing_1.2s_ease-in-out_infinite] bg-[var(--accent)]" />
                    </div>
                  ) : (
                    <div
                      className="h-1 bg-[var(--accent)] transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  )}
                  <div className="flex items-center gap-3 px-3 py-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-white text-[var(--accent)] shadow-sm">
                      <File className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--ink)]">
                        {uploadFileName}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {uploadStage === "processing"
                          ? "Processing knowledge in the API"
                          : "Uploading PDF knowledge"}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-[var(--accent)]">
                      {uploadStage === "processing"
                        ? "Processing"
                        : `${uploadProgress}%`}
                    </span>
                  </div>
                </div>
              </div>
            )}

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
                      onClick={() =>
                        void loadKnowledgeSources({
                          showPanel: true,
                          showSuggestions: false,
                        })
                      }
                      className="inline-flex items-center gap-2 rounded px-2 py-1 text-xs font-medium text-[var(--muted)] transition hover:bg-white hover:text-[var(--ink)]"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Refresh
                    </button>
                  )}
                </div>

                {showKnowledge && (
                  <div className="mt-3 flex max-h-40 flex-wrap gap-2 overflow-y-auto pr-1">
                    {knowledgeSources.length > 0 ? (
                      knowledgeSources.map((item, index) => {
                        const sourceValue = getKnowledgeSourceValue(item);
                        const isSelected =
                          selectedSources.includes(sourceValue);

                        return (
                          <div
                            key={`${knowledgeSourceLabel(item)}-${index}`}
                            className={`flex max-w-full items-stretch overflow-hidden rounded border bg-white text-xs text-[var(--muted)] transition ${
                              isSelected
                                ? "border-[var(--accent)]"
                                : "border-[var(--line)] hover:border-[var(--accent)]"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => selectKnowledgeSource(sourceValue)}
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
                                void deleteKnowledgeSource(sourceValue)
                              }
                              disabled={deletingSource === sourceValue}
                              className="flex w-9 shrink-0 items-center justify-center border-l border-[var(--line)] text-[var(--muted)] transition hover:bg-[var(--warning)] hover:text-[var(--warning-ink)] disabled:cursor-not-allowed disabled:opacity-60"
                              aria-label={`Delete ${knowledgeSourceLabel(item)}`}
                            >
                              {deletingSource === sourceValue ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        );
                      })
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

                  <div className="flex min-w-0 max-w-[82%] flex-col items-start gap-1">
                    <div
                      className={`min-w-0 rounded-md px-4 py-3 text-sm leading-6 ${
                        item.role === "user"
                          ? "bg-[var(--ink)] text-white"
                          : "border border-[var(--line)] bg-white text-[var(--ink)]"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">
                        {item.content}
                      </p>

                      {item.sources && item.sources.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2 border-t border-[var(--line)] pt-3">
                          {item.sources.map((sourceItem, index) => (
                            <span
                              key={`${sourceLabel(sourceItem)}-${index}`}
                              className="max-w-full rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--muted)]"
                            >
                              <span className="inline-block max-w-48 truncate align-bottom">
                                {sourceLabel(sourceItem)}
                              </span>
                              {sourceItem.page ? ` p.${sourceItem.page}` : ""}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {item.role === "assistant" && (
                      <button
                        type="button"
                        onClick={() => void copyReply(item.id, item.content)}
                        className="ml-1 flex h-7 w-7 items-center justify-center rounded text-[var(--muted)] transition hover:bg-white hover:text-[var(--ink)]"
                        aria-label="Copy reply"
                      >
                        {copiedMessageId === item.id ? (
                          <Check className="h-3.5 w-3.5 text-[var(--accent)]" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
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
                <div ref={modeMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsModeMenuOpen((current) => !current)}
                    className="flex min-h-11 w-full items-center gap-3 rounded border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-left text-xs text-[var(--muted)] transition hover:border-[var(--accent)] hover:bg-white"
                    aria-haspopup="listbox"
                    aria-expanded={isModeMenuOpen}
                  >
                    <span className="font-semibold text-[var(--ink)]">Mode</span>
                    <span className="min-w-0 flex-1 truncate rounded bg-[var(--accent)] px-2 py-1 text-sm font-semibold text-white">
                      {activeModeLabel}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 transition ${
                        isModeMenuOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isModeMenuOpen && (
                    <div
                      className="absolute bottom-full left-0 z-30 mb-2 w-56 overflow-hidden rounded-md border border-[var(--line)] bg-white p-1 shadow-xl"
                      role="listbox"
                    >
                      {chatModes.map((item) => {
                        const isActive = item.value === mode;

                        return (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => {
                              setMode(item.value);
                              setIsModeMenuOpen(false);
                            }}
                            className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm transition ${
                              isActive
                                ? "bg-[var(--soft)] text-[var(--ink)]"
                                : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"
                            }`}
                            role="option"
                            aria-selected={isActive}
                          >
                            <span className="min-w-0 flex-1">{item.label}</span>
                            {isActive && (
                              <Check className="h-4 w-4 text-[var(--accent)]" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div ref={sourcePickerRef} className="relative">
                  <div className="flex min-h-11 flex-wrap items-center gap-2 rounded border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--muted)] transition focus-within:border-[var(--accent)] focus-within:bg-white">
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
                    <div className="flex min-w-40 flex-1 items-center gap-2">
                      <Search className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
                      <input
                        value={sourceInput}
                        onChange={(event) =>
                          handleSourceInputChange(event.target.value)
                        }
                        onFocus={openKnowledgePicker}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addTypedSource();
                            setShowSourceSuggestions(false);
                          }
                        }}
                        placeholder={
                          selectedSources.length > 0
                            ? "Add another source"
                            : "Search knowledge source"
                        }
                        className="min-w-0 flex-1 bg-transparent text-sm text-[var(--ink)] outline-none"
                      />
                      {sourceInput && (
                        <button
                          type="button"
                          onClick={() => setSourceInput("")}
                          className="rounded text-[var(--muted)] transition hover:text-[var(--ink)]"
                          aria-label="Clear source search"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={addTypedSource}
                      disabled={!sourceInput.trim()}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-white text-[var(--muted)] shadow-sm transition hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Add typed source"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {showSourceSuggestions && (
                    <div className="absolute bottom-full left-0 right-0 z-40 mb-2 overflow-hidden rounded-md border border-[var(--line)] bg-white p-1 shadow-xl">
                      {isLoadingSources ? (
                        <div className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--muted)]">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading knowledge...
                        </div>
                      ) : filteredKnowledgeSources.length > 0 ? (
                        filteredKnowledgeSources.map((item, index) => {
                          const sourceValue = getKnowledgeSourceValue(item);
                          const isSelected =
                            selectedSources.includes(sourceValue);

                          return (
                            <button
                              key={`${knowledgeSourceLabel(item)}-${index}`}
                              type="button"
                              onClick={() => selectKnowledgeSource(sourceValue)}
                              className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm transition hover:bg-[var(--surface)]"
                            >
                              <Search className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
                              <span className="min-w-0 flex-1 truncate">
                                <span className="font-semibold text-[var(--accent)]">
                                  {knowledgeSourceLabel(item)}
                                </span>
                                <span className="ml-1 text-xs text-[var(--muted)]">
                                  {item.source_type ?? "source"}
                                  {typeof item.chunks === "number"
                                    ? `, ${item.chunks} chunks`
                                    : ""}
                                </span>
                              </span>
                              {isSelected && (
                                <Check className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                              )}
                            </button>
                          );
                        })
                      ) : (
                        <div className="px-3 py-2 text-sm text-[var(--muted)]">
                          {sourceInput.trim()
                            ? "No matching knowledge sources."
                            : "No knowledge sources found yet."}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
