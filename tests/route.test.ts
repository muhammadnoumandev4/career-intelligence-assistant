import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/chat/route";

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validDoc = (id: string, text: string) => ({
  id,
  title: `Doc ${id}`,
  kind: "job" as const,
  text,
});

describe("/api/chat input bounds", () => {
  it("rejects a request with no message", async () => {
    const res = await POST(postRequest({ documents: [validDoc("1", "hello world")] }));
    expect(res.status).toBe(400);
  });

  it("rejects more than the allowed number of documents", async () => {
    const documents = Array.from({ length: 13 }, (_, i) => validDoc(`d${i}`, "some content here"));
    const res = await POST(postRequest({ message: "How does my experience align?", documents }));
    expect(res.status).toBe(400);
  });

  it("rejects a single oversized document", async () => {
    const huge = "a ".repeat(30_000); // 60k chars > 50k per-document cap
    const res = await POST(postRequest({ message: "align?", documents: [validDoc("big", huge)] }));
    expect(res.status).toBe(400);
  });

  it("rejects a corpus that exceeds the total size cap", async () => {
    // 5 docs * 45k chars = 225k > 200k total cap (each under the 50k per-doc cap)
    const documents = Array.from({ length: 5 }, (_, i) => validDoc(`d${i}`, "a".repeat(45_000)));
    const res = await POST(postRequest({ message: "align?", documents }));
    expect(res.status).toBe(400);
  });

  it("accepts a well-formed request and returns an answer", async () => {
    const res = await POST(
      postRequest({ message: "How does my experience align with this role?" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.answer).toBe("string");
    expect(body.trace).toBeDefined();
  });

  it("ignores empty draft documents instead of rejecting the whole request", async () => {
    const documents = [
      { id: "resume", title: "Resume", kind: "resume" as const, text: "React TypeScript Node AWS experience." },
      { id: "job", title: "Job", kind: "job" as const, text: "Build React TypeScript cloud applications." },
      { id: "draft-job", title: "Draft job", kind: "job" as const, text: "" },
    ];

    const res = await POST(
      postRequest({
        message: "How should I prepare for the interview based on my experience?",
        documents,
        activeJobId: "draft-job",
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.answer).toMatch(/interview|prepare/i);
  });

  it("rejects when all provided documents are empty drafts", async () => {
    const res = await POST(
      postRequest({
        message: "How should I prepare?",
        documents: [{ id: "draft", title: "Draft", kind: "job", text: "" }],
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/at least one document/i);
  });
});
