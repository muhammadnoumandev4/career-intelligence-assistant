import type { EngineMode } from "./rag/types";

/**
 * Runtime configuration, resolved from environment variables.
 *
 * The app is designed to run with ZERO secrets: if no provider keys are
 * present it serves a fully deterministic RAG pipeline. When keys are
 * supplied it upgrades to embeddings + LLM generation. This keeps the local
 * demo reproducible while leaving a real production path one env var away.
 */
export type ChatProvider = "anthropic" | "openai" | "google";
export type EmbeddingProvider = "openai" | "google";

export type AppConfig = {
  mode: EngineMode;
  chatProvider?: ChatProvider;
  embeddingProvider?: EmbeddingProvider;
  anthropicApiKey?: string;
  googleApiKey?: string;
  openaiApiKey?: string;
  chatModel: string;
  embeddingModel: string;
};

export function getConfig(): AppConfig {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY?.trim() || undefined;
  const googleApiKey =
    process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() || undefined;
  const openaiApiKey = process.env.OPENAI_API_KEY?.trim() || undefined;

  // Generation is provider-agnostic: any one of Anthropic, OpenAI, or Google
  // enables LLM mode. Precedence (anthropic → openai → google) only decides the
  // default when several keys are set; embeddings are resolved independently
  // below, so generation and embeddings can come from different vendors at once.
  const chatProvider: ChatProvider | undefined = anthropicApiKey
    ? "anthropic"
    : openaiApiKey
      ? "openai"
      : googleApiKey
        ? "google"
        : undefined;
  const mode: EngineMode = chatProvider ? "llm" : "deterministic";

  const defaultModelByProvider: Record<ChatProvider, string> = {
    anthropic: "claude-3-5-sonnet-latest",
    openai: "gpt-4o-mini",
    google: "gemini-flash-latest",
  };
  const defaultModel = chatProvider ? defaultModelByProvider[chatProvider] : defaultModelByProvider.anthropic;

  // Embeddings are provider-agnostic: use OpenAI when its key is present,
  // otherwise fall back to the Google key (same key as Gemini generation). This
  // means a user with only a Gemini key still gets hybrid vector + lexical
  // retrieval — no second vendor required.
  const embeddingProvider: EmbeddingProvider | undefined = openaiApiKey
    ? "openai"
    : googleApiKey
      ? "google"
      : undefined;
  const defaultEmbeddingModel =
    embeddingProvider === "google" ? "gemini-embedding-001" : "text-embedding-3-small";

  return {
    mode,
    chatProvider,
    embeddingProvider,
    anthropicApiKey,
    googleApiKey,
    openaiApiKey,
    chatModel: process.env.CHAT_MODEL?.trim() || defaultModel,
    embeddingModel: process.env.EMBEDDING_MODEL?.trim() || defaultEmbeddingModel,
  };
}
