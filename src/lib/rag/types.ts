export type DocumentKind = "resume" | "job" | "assignment" | "notes";

export type DocumentInput = {
  id: string;
  title: string;
  kind: DocumentKind;
  text: string;
};

export type Chunk = {
  id: string;
  documentId: string;
  title: string;
  kind: DocumentKind;
  text: string;
  /** Position of the chunk within its source document, 0-based. */
  index: number;
};

export type RetrievedChunk = Chunk & {
  /** Final ranking score in [0, ~]. Higher is more relevant. */
  score: number;
};

export type FitSignal = {
  label: string;
  present: boolean;
  evidence: string;
};

export type FitReport = {
  score: number;
  matched: FitSignal[];
  gaps: FitSignal[];
  cautions: string[];
};

/** Which retrieval/answer pipeline produced a result. */
export type EngineMode = "deterministic" | "llm";

export type AnswerTrace = {
  mode: EngineMode;
  retrievalMs: number;
  answerMs: number;
  chunksConsidered: number;
  chunksCited: number;
  /** Populated only in llm mode. */
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  grounded: boolean;
};

export type ChatResult = {
  answer: string;
  citations: RetrievedChunk[];
  fit: FitReport;
  mode: EngineMode;
  trace: AnswerTrace;
};
