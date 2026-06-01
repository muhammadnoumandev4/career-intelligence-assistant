import { describe, expect, it } from "vitest";
import { answerQuestion } from "@/lib/rag";
import { defaultDocuments } from "@/lib/sample-data";

describe("answerQuestion (deterministic)", () => {
  it("answers an aligned intent question with a grounded, cited result", async () => {
    const result = await answerQuestion("How does my experience align with this role?", defaultDocuments);
    expect(result.mode).toBe("deterministic");
    expect(result.trace.grounded).toBe(true);
    expect(result.citations.length).toBeGreaterThan(0);
    expect(result.answer).toMatch(/fit/i);
  });

  it("answers a shortlist-likelihood question from the fit report instead of refusing", async () => {
    // "chances of getting shortlisted" shares almost no vocabulary with the
    // documents, so it must be routed by hiring intent and answered from the fit
    // report — not dropped to the refusal.
    const result = await answerQuestion("What are my chances of getting shortlisted for this role?", defaultDocuments);
    expect(result.mode).toBe("deterministic");
    expect(result.answer).toMatch(/shortlist/i);
    expect(result.answer).toMatch(/%/);
  });

  it("answers interview-question prep instead of refusing", async () => {
    const result = await answerQuestion("What interview questions should I prepare for?", defaultDocuments);
    expect(result.mode).toBe("deterministic");
    expect(result.trace.grounded).toBe(true);
    expect(result.citations.length).toBeGreaterThan(0);
    expect(result.answer).toMatch(/interview questions/i);
    expect(result.answer).toMatch(/architecture/i);
    expect(result.answer).not.toMatch(/^I could not find strong evidence/);
  });

  it("answers free-form candidate questions from the fit report instead of refusing", async () => {
    const refusalStart = "I could not find strong evidence";
    for (const question of [
      "What are his strongest skills?",
      "Does he have Kubernetes and AWS experience?",
      "Why should we hire him?",
      "Summarize the candidate for this role.",
    ]) {
      const result = await answerQuestion(question, defaultDocuments);
      expect(result.answer.startsWith(refusalStart), `should not refuse: ${question}`).toBe(false);
      expect(result.answer).toMatch(/%/);
    }
  });

  it("still refuses a clearly off-topic question even after broadening intents", async () => {
    const result = await answerQuestion("What is the boiling point of water?", defaultDocuments);
    expect(result.trace.grounded).toBe(false);
    expect(result.answer).not.toMatch(/%/);
  });

  it("does not present an off-topic question as grounded, even when a term matches incidentally", async () => {
    // "Milan" appears in the resume, so this clears the lexical relevance gate —
    // but the question is not about the corpus. It must not be reported as
    // grounded, and it must not fabricate a weather answer.
    const result = await answerQuestion("What is the weather in Milan tomorrow?", defaultDocuments);
    expect(result.trace.grounded).toBe(false);
    expect(result.answer).not.toMatch(/sunny|rain|forecast|degrees|°/i);
  });

  it("refuses cleanly when nothing in the corpus is relevant", async () => {
    const result = await answerQuestion("What is the capital of France?", defaultDocuments);
    expect(result.trace.grounded).toBe(false);
    expect(result.citations.length).toBe(0);
  });

  it("answers novel self-referential career phrasings via career-intent routing", async () => {
    // These use no enumerated intent keyword, but are clearly about the candidate
    // and the role, so the assistant should answer them from the fit report.
    for (const question of [
      "What's your honest read on me for this role?",
      "How am I doing against this job?",
      "Give me your assessment of my resume for this position.",
    ]) {
      const result = await answerQuestion(question, defaultDocuments);
      expect(result.answer.startsWith("I could not find strong evidence"), `should not refuse: ${question}`).toBe(false);
    }
  });

  it("still refuses off-topic questions that happen to contain 'me' or 'I'", async () => {
    const result = await answerQuestion("Can you tell me a joke?", defaultDocuments);
    expect(result.trace.grounded).toBe(false);
  });

  it("routes 'what am I lacking compared to the requirements?' to a gaps answer", async () => {
    const result = await answerQuestion("What am I lacking compared to the requirements?", defaultDocuments);
    expect(result.mode).toBe("deterministic");
    expect(result.trace.grounded).toBe(true);
    expect(result.answer).toMatch(/gap/i);
    expect(result.answer).not.toMatch(/^I could not find strong evidence/);
  });

  it("routes 'why should you hire me?' to a candidate answer, not a refusal", async () => {
    const result = await answerQuestion("Why should you hire me?", defaultDocuments);
    expect(result.mode).toBe("deterministic");
    expect(result.trace.grounded).toBe(true);
    expect(result.answer).not.toMatch(/^I could not find strong evidence/);
  });

  it("treats 'do I have RAG/LLM experience?' as a candidate question, not a system-architecture one", async () => {
    // "rag" appears in the question, but it is about the candidate's experience,
    // not how the system is built — so it must answer from the fit report, not
    // describe the pipeline ("parser -> chunker -> retriever").
    const result = await answerQuestion("Do I have RAG and LLM experience?", defaultDocuments);
    expect(result.mode).toBe("deterministic");
    expect(result.answer).toMatch(/match|fit|resume/i);
    expect(result.answer).not.toMatch(/parser -> chunker|clean seams/i);
  });

  it("handles related gap, fit, standout, and shortlist phrasings without canned exact-match questions", async () => {
    const cases = [
      { question: "Where do I fall short for this role?", expected: /gap|gaps|address/i },
      { question: "What's weak in my profile?", expected: /gap|asks for|address/i },
      { question: "What do I need to improve?", expected: /gap|address|mitigation/i },
      { question: "Is this role right for me?", expected: /match|strongest|role/i },
      { question: "What makes me stand out?", expected: /strongest|candidate|brings/i },
      { question: "Will I get called for an interview?", expected: /shortlist|%|odds/i },
    ];

    for (const testCase of cases) {
      const result = await answerQuestion(testCase.question, defaultDocuments);
      expect(result.mode).toBe("deterministic");
      expect(result.trace.grounded, `should be grounded: ${testCase.question}`).toBe(true);
      expect(result.answer, testCase.question).toMatch(testCase.expected);
      expect(result.answer, testCase.question).not.toMatch(/^I could not find strong evidence/);
      expect(result.answer, testCase.question).not.toMatch(/^I don't have a direct, structured answer/);
    }
  });

  it("answers direct skill-capability questions from resume and JD evidence", async () => {
    const cases = [
      { question: "Do I have Python experience?", expected: /yes|python|resume/i },
      { question: "Do I have frontend experience?", expected: /yes|frontend|react|next\.js|resume/i },
      { question: "Do I know microservices?", expected: /yes|microservices|resume/i },
      { question: "What's my experience with PostgreSQL?", expected: /yes|postgresql|resume/i },
    ];

    for (const testCase of cases) {
      const result = await answerQuestion(testCase.question, defaultDocuments);
      expect(result.mode).toBe("deterministic");
      expect(result.trace.grounded, `should be grounded: ${testCase.question}`).toBe(true);
      expect(result.answer, testCase.question).toMatch(testCase.expected);
      expect(result.answer, testCase.question).not.toMatch(/^I could not find strong evidence/);
      expect(result.answer, testCase.question).not.toMatch(/^I don't have a direct, structured answer/);
    }
  });

  it("answers compound in-scope questions instead of dropping one part", async () => {
    const fitAndGaps = await answerQuestion("Does my experience match, or am I missing key skills?", defaultDocuments);
    expect(fitAndGaps.trace.grounded).toBe(true);
    expect(fitAndGaps.answer).toMatch(/fit|%/i);
    expect(fitAndGaps.answer).toMatch(/gap|gaps|missing/i);

    const deployAndChances = await answerQuestion("How do I deploy this and what are my chances?", defaultDocuments);
    expect(deployAndChances.trace.grounded).toBe(true);
    expect(deployAndChances.answer).toMatch(/production|deploy|pgvector/i);
    expect(deployAndChances.answer).toMatch(/shortlist|%|signal/i);
  });

  it("covers broader job-assistant runtime questions a panel may ask live", async () => {
    const cases = [
      { question: "What should I avoid saying?", expected: /interview|gap|prepare/i },
      { question: "How do I defend not using a vector database?", expected: /architecture|retrieval|vector|pgvector/i },
      { question: "How should I answer if they ask about LangGraph?", expected: /interview|gap|agent|mcp|langgraph/i },
      { question: "What examples from my resume prove backend experience?", expected: /yes|backend|resume|node|nestjs/i },
      { question: "Can you write a short recruiter summary for me?", expected: /fit|match|strength|candidate/i },
    ];

    for (const testCase of cases) {
      const result = await answerQuestion(testCase.question, defaultDocuments);
      expect(result.trace.grounded, `should be grounded: ${testCase.question}`).toBe(true);
      expect(result.answer, testCase.question).toMatch(testCase.expected);
      expect(result.answer, testCase.question).not.toMatch(/^I could not find strong evidence/);
      expect(result.answer, testCase.question).not.toMatch(/^I don't have a direct, structured answer/);
    }
  });

  it("compares multiple job descriptions when asked which role is the better fit", async () => {
    const result = await answerQuestion("Which job description is a better fit for me?", defaultDocuments);
    expect(result.trace.grounded).toBe(true);
    expect(result.answer).toMatch(/best fit/i);
    expect(result.answer).toMatch(/Northbridge Fintech Senior Full-Stack JD/);
    expect(result.answer).toMatch(/80%/);
    expect(result.answer).toMatch(/Newpage AI-Native Builder JD/);
  });
});
