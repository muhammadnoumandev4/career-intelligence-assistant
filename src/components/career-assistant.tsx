"use client";

import { useMemo, useState } from "react";
import { defaultDocuments } from "@/lib/sample-data";
import type { ChatResult, DocumentInput, DocumentKind } from "@/lib/rag";

type Message = {
  role: "user" | "assistant";
  content: string;
  result?: ChatResult;
};

const quickQuestions = [
  "How does my experience align with this role?",
  "What skills am I missing for this role?",
  "How should I present this in 10 minutes?",
  "What is the productionization plan?",
  "Explain the RAG architecture and trade-offs.",
];

const ALIGN_QUESTION = "How does my experience align with this role?";

const documentLabels: Record<DocumentKind, string> = {
  resume: "Resume",
  job: "Job description",
  assignment: "Assignment",
  notes: "Notes",
};

const firstJobId = defaultDocuments.find((document) => document.kind === "job")?.id ?? "";

export function CareerAssistant() {
  const [documents, setDocuments] = useState<DocumentInput[]>(defaultDocuments);
  const [activeDocumentId, setActiveDocumentId] = useState(defaultDocuments[0].id);
  const [activeJobId, setActiveJobId] = useState(firstJobId);
  const [input, setInput] = useState(quickQuestions[0]);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "I am ready to compare the resume, job description, and assignment. Ask about fit, gaps, interview prep, RAG choices, or productionization.",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const activeDocument = documents.find((document) => document.id === activeDocumentId) ?? documents[0];
  const jobs = useMemo(() => documents.filter((document) => document.kind === "job"), [documents]);
  const latestResult = [...messages].reverse().find((message) => message.result)?.result;

  function tabLabel(document: DocumentInput): string {
    if (document.kind === "job" && jobs.length > 1) {
      return `Job ${jobs.findIndex((job) => job.id === document.id) + 1}`;
    }
    return documentLabels[document.kind];
  }

  const documentStats = useMemo(() => {
    const words = documents.reduce((total, document) => total + document.text.split(/\s+/).filter(Boolean).length, 0);
    return {
      documents: documents.length,
      words,
    };
  }, [documents]);

  function updateDocumentText(text: string) {
    setDocuments((currentDocuments) =>
      currentDocuments.map((document) =>
        document.id === activeDocument.id
          ? {
              ...document,
              text,
            }
          : document,
      ),
    );
  }

  async function loadTextFile(file: File) {
    const text = await file.text();
    updateDocumentText(text);
  }

  async function sendMessage(nextInput = input, jobId = activeJobId) {
    const message = nextInput.trim();
    if (!message || isLoading) {
      return;
    }

    setError("");
    setIsLoading(true);
    setInput("");
    setMessages((currentMessages) => [...currentMessages, { role: "user", content: message }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message, documents, activeJobId: jobId || undefined }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "The assistant request failed.");
      }

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          role: "assistant",
          content: payload.answer,
          result: payload,
        },
      ]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The assistant request failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f7f8] text-[#18211f]">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 px-4 py-5 lg:px-6">
        <header className="flex flex-col justify-between gap-4 border-b border-[#d8dedb] pb-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#557066]">Career Intelligence Assistant</p>
            <h1 className="mt-2 max-w-3xl text-4xl font-semibold leading-tight text-[#14201c]">
              Resume-to-role analysis for the Newpage AI-Native Builder assignment
            </h1>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="border border-[#d8dedb] bg-white px-4 py-3">
              <strong className="block text-2xl text-[#0f4f3f]">{latestResult?.fit.score ?? 0}%</strong>
              Fit
            </div>
            <div className="border border-[#d8dedb] bg-white px-4 py-3">
              <strong className="block text-2xl text-[#0f4f3f]">{documentStats.documents}</strong>
              Docs
            </div>
            <div className="border border-[#d8dedb] bg-white px-4 py-3">
              <strong className="block text-2xl text-[#0f4f3f]">{documentStats.words}</strong>
              Words
            </div>
          </div>
        </header>

        <section className="grid flex-1 gap-5 lg:grid-cols-[390px_minmax(0,1fr)_330px]">
          <aside className="flex min-h-[680px] flex-col border border-[#d8dedb] bg-white">
            <div className="border-b border-[#d8dedb] p-4">
              <div className="flex flex-wrap gap-2">
                {documents.map((document) => (
                  <button
                    key={document.id}
                    type="button"
                    onClick={() => setActiveDocumentId(document.id)}
                    className={`min-h-12 flex-1 border px-2 text-sm font-semibold transition ${
                      activeDocumentId === document.id
                        ? "border-[#0f4f3f] bg-[#0f4f3f] text-white"
                        : "border-[#d8dedb] bg-[#f8faf9] text-[#42524c] hover:border-[#88a096]"
                    }`}
                  >
                    {tabLabel(document)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-[#d8dedb] px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-[#14201c]">{activeDocument.title}</p>
                <p className="text-xs uppercase tracking-[0.14em] text-[#697b73]">{activeDocument.kind}</p>
              </div>
              <label className="cursor-pointer border border-[#cbd5d1] px-3 py-2 text-xs font-semibold text-[#24342f] hover:bg-[#f2f5f4]">
                TXT
                <input
                  className="sr-only"
                  type="file"
                  accept=".txt,.md,.csv"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void loadTextFile(file);
                    }
                  }}
                />
              </label>
            </div>

            <textarea
              value={activeDocument.text}
              onChange={(event) => updateDocumentText(event.target.value)}
              className="min-h-0 flex-1 resize-none border-0 bg-white p-4 font-mono text-sm leading-6 text-[#263530] outline-none"
            />

            <div className="flex items-center justify-between border-t border-[#d8dedb] p-4">
              <button
                type="button"
                onClick={() => setDocuments(defaultDocuments)}
                className="border border-[#cbd5d1] px-3 py-2 text-sm font-semibold text-[#24342f] hover:bg-[#f2f5f4]"
              >
                Reset
              </button>
              <span className="text-sm text-[#697b73]">{activeDocument.text.split(/\s+/).filter(Boolean).length} words</span>
            </div>
          </aside>

          <section className="flex min-h-[680px] flex-col border border-[#d8dedb] bg-white">
            <div className="border-b border-[#d8dedb] p-4">
              <div className="flex flex-wrap gap-2">
                {quickQuestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => void sendMessage(question)}
                    className="border border-[#d8dedb] bg-[#f8faf9] px-3 py-2 text-sm font-medium text-[#24342f] hover:border-[#0f4f3f] hover:text-[#0f4f3f]"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto bg-[#fbfcfb] p-4">
              {messages.map((message, index) => (
                <article
                  key={`${message.role}-${index}`}
                  className={`max-w-[88%] border p-4 shadow-sm ${
                    message.role === "user"
                      ? "ml-auto border-[#0f4f3f] bg-[#eaf4ef]"
                      : "border-[#d8dedb] bg-white"
                  }`}
                >
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#697b73]">
                    {message.role === "user" ? "Question" : "Assistant"}
                  </p>
                  <p className="whitespace-pre-line text-sm leading-6 text-[#1d2b27]">{message.content}</p>
                  {message.result && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#eef1f0] pt-2 text-[11px] text-[#697b73]">
                      <span className="border border-[#d8dedb] bg-[#f4f7f6] px-2 py-0.5 font-semibold uppercase tracking-[0.1em]">
                        {message.result.trace.mode}
                      </span>
                      <span>{message.result.trace.chunksCited} cited</span>
                      <span>retrieval {message.result.trace.retrievalMs}ms</span>
                      {message.result.trace.answerMs > 0 && <span>answer {message.result.trace.answerMs}ms</span>}
                      {typeof message.result.trace.promptTokens === "number" && (
                        <span>
                          {message.result.trace.promptTokens + (message.result.trace.completionTokens ?? 0)} tok
                        </span>
                      )}
                      <span className={message.result.trace.grounded ? "text-[#0f4f3f]" : "text-[#9a3412]"}>
                        {message.result.trace.grounded ? "grounded" : "ungrounded"}
                      </span>
                    </div>
                  )}
                </article>
              ))}
              {isLoading && (
                <div className="w-fit border border-[#d8dedb] bg-white px-4 py-3 text-sm font-semibold text-[#52655d]">
                  Retrieving evidence...
                </div>
              )}
            </div>

            <form
              className="border-t border-[#d8dedb] bg-white p-4"
              onSubmit={(event) => {
                event.preventDefault();
                void sendMessage();
              }}
            >
              <div className="flex flex-col gap-3 md:flex-row">
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask about fit, gaps, interview prep, RAG, or productionization"
                  className="min-h-12 flex-1 border border-[#cbd5d1] px-4 text-sm outline-none focus:border-[#0f4f3f]"
                />
                <button
                  type="submit"
                  disabled={isLoading}
                  className="min-h-12 bg-[#0f4f3f] px-5 text-sm font-semibold text-white hover:bg-[#0b3f32] disabled:cursor-not-allowed disabled:bg-[#9aaba4]"
                >
                  Send
                </button>
              </div>
              {error && <p className="mt-3 text-sm font-medium text-[#9a3412]">{error}</p>}
            </form>
          </section>

          <aside className="flex min-h-[680px] flex-col gap-5">
            <section className="border border-[#d8dedb] bg-white p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[#14201c]">Fit Signals</h2>
                <span className="bg-[#eaf4ef] px-3 py-1 text-sm font-semibold text-[#0f4f3f]">
                  {latestResult?.fit.score ?? 0}%
                </span>
              </div>

              {jobs.length > 1 && (
                <div className="mt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#697b73]">
                    Score against
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {jobs.map((job, index) => (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => {
                          setActiveJobId(job.id);
                          void sendMessage(ALIGN_QUESTION, job.id);
                        }}
                        title={job.title}
                        className={`border px-3 py-1.5 text-xs font-semibold transition ${
                          activeJobId === job.id
                            ? "border-[#0f4f3f] bg-[#0f4f3f] text-white"
                            : "border-[#d8dedb] bg-[#f8faf9] text-[#42524c] hover:border-[#88a096]"
                        }`}
                      >
                        Job {index + 1}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {latestResult?.fit.jobTitle && (
                <p className="mt-3 text-xs leading-5 text-[#697b73]">
                  Scored against <span className="font-semibold text-[#42524c]">{latestResult.fit.jobTitle}</span>.
                </p>
              )}

              <div className="mt-4 space-y-2">
                {(latestResult?.fit.matched ?? []).slice(0, 5).map((signal) => (
                  <div key={signal.label} className="border border-[#d8dedb] p-3">
                    <p className="text-sm font-semibold text-[#1d2b27]">{signal.label}</p>
                    <p className="mt-1 text-xs leading-5 text-[#697b73]">{signal.evidence}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="border border-[#d8dedb] bg-white p-4">
              <h2 className="text-lg font-semibold text-[#14201c]">Gaps To Cover</h2>
              <div className="mt-4 space-y-2">
                {(latestResult?.fit.gaps ?? []).slice(0, 4).map((signal) => (
                  <div key={signal.label} className="border border-[#ead7c7] bg-[#fffaf6] p-3">
                    <p className="text-sm font-semibold text-[#6b3415]">{signal.label}</p>
                    <p className="mt-1 text-xs leading-5 text-[#7a5a45]">{signal.evidence}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="min-h-0 flex-1 border border-[#d8dedb] bg-white p-4">
              <h2 className="text-lg font-semibold text-[#14201c]">Evidence</h2>
              <div className="mt-4 space-y-3 overflow-y-auto">
                {(latestResult?.citations ?? []).map((citation) => (
                  <article key={citation.id} className="border border-[#d8dedb] p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#0f4f3f]">
                        {citation.title}
                      </p>
                      <span className="text-xs text-[#697b73]">{citation.score.toFixed(1)}</span>
                    </div>
                    <p className="text-xs leading-5 text-[#42524c]">{citation.text.replace(/\s+/g, " ").slice(0, 330)}...</p>
                  </article>
                ))}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
