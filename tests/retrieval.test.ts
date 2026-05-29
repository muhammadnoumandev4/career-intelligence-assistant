import { describe, expect, it } from "vitest";
import {
  chunkDocuments,
  cosineSimilarity,
  lexicalRetrieve,
  reciprocalRankFusion,
  vectorRetrieve,
} from "@/lib/rag";
import type { DocumentInput } from "@/lib/rag";

const documents: DocumentInput[] = [
  { id: "resume", title: "Resume", kind: "resume", text: "Built RAG pipelines with Anthropic Claude and PostgreSQL." },
  { id: "jd", title: "JD", kind: "job", text: "We want Kubernetes, Docker and AWS deployment experience." },
];

describe("lexicalRetrieve", () => {
  it("ranks the chunk that matches query terms first", () => {
    const chunks = chunkDocuments(documents);
    const results = lexicalRetrieve("kubernetes docker aws", chunks, 5);
    expect(results[0].documentId).toBe("jd");
    expect(results[0].score).toBeGreaterThan(0);
  });

  it("returns nothing scored above zero for unrelated queries", () => {
    const chunks = chunkDocuments(documents);
    const results = lexicalRetrieve("zzzzz nonexistent term", chunks, 5);
    expect(results).toHaveLength(0);
  });
});

describe("cosineSimilarity", () => {
  it("is 1 for identical vectors and 0 for orthogonal", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });
});

describe("vectorRetrieve", () => {
  it("orders chunks by cosine similarity to the query embedding", () => {
    const chunks = chunkDocuments(documents);
    const embeddings = [
      [1, 0],
      [0, 1],
    ];
    const results = vectorRetrieve([0.9, 0.1], chunks, embeddings, 2);
    expect(results[0].documentId).toBe("resume");
  });
});

describe("reciprocalRankFusion", () => {
  it("rewards items ranked highly across multiple lists", () => {
    const chunks = chunkDocuments(documents);
    const a = lexicalRetrieve("claude postgresql", chunks, 5);
    const b = lexicalRetrieve("rag pipelines", chunks, 5);
    const fused = reciprocalRankFusion([a, b], 5);
    expect(fused[0].documentId).toBe("resume");
  });
});
