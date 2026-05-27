import { tokenize } from "./chunk";
import type { Chunk, RetrievedChunk } from "./types";

/**
 * Lexical retrieval using a TF-IDF scoring scheme over the chunk set.
 *
 * Deterministic and dependency-free — this is the default retriever and the
 * fallback when no embedding provider is configured. For short corpora like a
 * resume + a few JDs, exact term overlap (skills, tools, titles) is a strong
 * and explainable signal.
 */
export function lexicalRetrieve(query: string, chunks: Chunk[], limit = 5): RetrievedChunk[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    return chunks.slice(0, limit).map((chunk) => ({ ...chunk, score: 0 }));
  }

  const documentFrequency = new Map<string, number>();
  const chunkTokens = chunks.map((chunk) => {
    const tokens = tokenize(chunk.text);
    for (const token of new Set(tokens)) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
    return tokens;
  });

  const scored = chunks.map((chunk, i) => {
    const termCounts = new Map<string, number>();
    for (const token of chunkTokens[i]) {
      termCounts.set(token, (termCounts.get(token) ?? 0) + 1);
    }

    const score = queryTokens.reduce((total, token) => {
      const tf = termCounts.get(token) ?? 0;
      if (tf === 0) return total;
      const idf = Math.log((chunks.length + 1) / ((documentFrequency.get(token) ?? 0) + 1)) + 1;
      return total + tf * idf;
    }, 0);

    return { ...chunk, score };
  });

  return scored
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

/**
 * Dense retrieval over an in-memory vector index. Used when an embedding
 * provider is configured. In production this is the seam where pgvector /
 * Pinecone / Weaviate would replace the linear scan — for a handful of
 * documents a brute-force cosine scan is exact and instant.
 */
export function vectorRetrieve(
  queryEmbedding: number[],
  chunks: Chunk[],
  chunkEmbeddings: number[][],
  limit = 5,
): RetrievedChunk[] {
  return chunks
    .map((chunk, i) => ({ ...chunk, score: cosineSimilarity(queryEmbedding, chunkEmbeddings[i]) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Reciprocal Rank Fusion of multiple ranked lists. Combines lexical and dense
 * results without needing to calibrate their different score scales — each
 * list contributes 1/(k + rank). This is the hybrid retrieval the JD asks for.
 */
export function reciprocalRankFusion(
  lists: RetrievedChunk[][],
  limit = 5,
  k = 60,
): RetrievedChunk[] {
  const fused = new Map<string, { chunk: RetrievedChunk; score: number }>();

  for (const list of lists) {
    list.forEach((chunk, rank) => {
      const contribution = 1 / (k + rank + 1);
      const existing = fused.get(chunk.id);
      if (existing) {
        existing.score += contribution;
      } else {
        fused.set(chunk.id, { chunk, score: contribution });
      }
    });
  }

  return Array.from(fused.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ chunk, score }) => ({ ...chunk, score }));
}
