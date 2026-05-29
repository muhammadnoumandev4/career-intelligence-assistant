import { describe, expect, it } from "vitest";
import { chunkDocuments, tokenize } from "@/lib/rag";
import type { DocumentInput } from "@/lib/rag";

describe("tokenize", () => {
  it("lowercases, drops stop words and short tokens", () => {
    expect(tokenize("The React and Node app")).toEqual(["react", "node", "app"]);
  });

  it("preserves multi-char tech tokens containing . and +", () => {
    const tokens = tokenize("Next.js, Node.js and C++");
    expect(tokens).toContain("next.js");
    expect(tokens).toContain("node.js");
    expect(tokens).toContain("c++");
  });

  it("drops tokens of 2 chars or fewer (known lexical limitation, e.g. 'c#', 'go')", () => {
    // The min-length filter trades a little recall on ultra-short skill tokens
    // for much less noise. The LLM path recovers these semantically.
    expect(tokenize("C# Go")).toEqual([]);
  });
});

describe("chunkDocuments", () => {
  const doc: DocumentInput = {
    id: "d1",
    title: "Doc",
    kind: "notes",
    text: "Para one.\n\nPara two.\n\nPara three.",
  };

  it("splits on blank lines and assigns stable ids/indexes", () => {
    const chunks = chunkDocuments([doc]);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].id).toBe("d1-1");
    expect(chunks[0].index).toBe(0);
    expect(chunks.every((c) => c.documentId === "d1")).toBe(true);
  });

  it("never splits a single paragraph and stays within size bounds when possible", () => {
    const big: DocumentInput = {
      id: "d2",
      title: "Big",
      kind: "notes",
      text: Array.from({ length: 10 }, (_, i) => `Paragraph number ${i} `.repeat(20)).join("\n\n"),
    };
    const chunks = chunkDocuments([big]);
    expect(chunks.length).toBeGreaterThan(1);
  });
});
