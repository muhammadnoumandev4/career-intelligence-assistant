import type { Chunk, DocumentInput } from "./types";

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have",
  "in", "into", "is", "it", "of", "on", "or", "that", "the", "their", "this",
  "to", "using", "with", "you", "your",
  // Interrogatives and auxiliaries: question words add no retrieval signal but
  // collide with stray corpus tokens, which previously let off-topic questions
  // slip past the guardrail.
  "what", "how", "why", "when", "where", "which", "who", "whom", "whose",
  "does", "did", "can", "could", "should", "would", "will", "about",
]);

/** Target chunk size in characters. Resumes/JDs are short, dense documents, so
 *  paragraph-aware chunks around this size keep each chunk semantically whole
 *  while staying small enough for precise retrieval. */
const MAX_CHUNK_CHARS = 850;

/**
 * Lowercases and splits text into content tokens, dropping stop words and very
 * short tokens. Keeps `+`, `#`, `.` so terms like `c++`, `c#`, `node.js`,
 * `next.js` survive — important for skill matching.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

/**
 * Paragraph-aware chunker: packs whole paragraphs into chunks up to
 * MAX_CHUNK_CHARS, never splitting mid-paragraph. This preserves the natural
 * structure of resumes (one role per block) and JDs (one responsibility group
 * per block), which improves both retrieval precision and citation readability.
 */
export function chunkDocuments(documents: DocumentInput[]): Chunk[] {
  return documents.flatMap((document) => {
    const paragraphs = document.text
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean);

    const chunks: string[] = [];
    let buffer = "";

    for (const paragraph of paragraphs) {
      if ((buffer + "\n\n" + paragraph).length > MAX_CHUNK_CHARS && buffer.length > 0) {
        chunks.push(buffer);
        buffer = paragraph;
      } else {
        buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
      }
    }

    if (buffer) {
      chunks.push(buffer);
    }

    return chunks.map((text, index) => ({
      id: `${document.id}-${index + 1}`,
      documentId: document.id,
      title: document.title,
      kind: document.kind,
      text,
      index,
    }));
  });
}
