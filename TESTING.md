# Testing & Demo Guide

A short, reviewer-facing walkthrough: how to run the app, what to try, and what
to expect. The app runs **with zero API keys** in deterministic mode, so nothing
below requires setup beyond `npm install`.

---

## 1. Run it

```bash
npm install
npm run dev
```

Open the URL printed in the terminal (typically [http://localhost:3000](http://localhost:3000)).
No `.env` is needed — it boots in **deterministic mode** (offline, repeatable).

Three documents are **pre-loaded** so you can try it instantly: a résumé and two
job descriptions. All of them are editable, and you can upload your own
(PDF / DOCX / TXT) or paste new text at any time.

### Optional: enable the LLM path

Deterministic mode answers from a transparent rubric + templates. To see
LLM-generated answers instead, add **one** provider key to `.env.local` and
restart:

```bash
# any ONE of these is enough
echo 'GEMINI_API_KEY=your-key'      > .env.local   # Google Gemini
# or ANTHROPIC_API_KEY=your-key                    # Anthropic Claude
# or OPENAI_API_KEY=your-key                       # OpenAI GPT
```

Everything below behaves the same either way; LLM mode just phrases answers more
naturally and understands unusual wording semantically.

---

## 2. What you'll see

| Area | What it shows |
|------|---------------|
| **Left panel** | Résumé + Job tabs (`Job 1`, `Job 2`), `+ Job` to add, `Upload`, `Reset` |
| **Middle** | Chat, with quick-question buttons |
| **Right panel** | Fit score %, matched strengths, gaps, and the **Evidence** (cited chunks) |
| **Under each answer** | A trace row: `mode · chunks cited · retrieval ms · grounded` |

---

## 3. Guided test script

Ask these in the chat (or click the quick-question buttons). Expected behaviour
is listed so you can verify correctness.

### A. Core fit & gaps
| Ask | Expect |
|-----|--------|
| How does my experience align with this role? | Fit %, strongest matches, cited evidence |
| What skills am I missing for this role? | Concrete gap list derived from the selected JD |
| What are my chances of getting shortlisted? | Fit-based reasoning + honest caveat |

### B. Multiple job descriptions (the core feature)
1. Click the **Job 1** tab, ask *"How does my experience align with this role?"* → note the score.
2. Click the **Job 2** tab, ask the same question → **the score and gaps change** because fit is scored against the selected JD, not hard-coded.
3. Ask *"Which job is a better fit for me?"* → ranks the postings.

> This is the proof the scoring is dynamic: the same résumé scores differently
> against different jobs.

### C. Free-form / interview questions
| Ask | Expect |
|-----|--------|
| Why should you hire me? | Candidate summary from the fit report |
| Do I have Kubernetes and AWS experience? | Evidence-backed yes/no from the résumé |
| What interview questions should I prepare for? | A tailored prep list |
| Explain the RAG architecture of this project. | A description of the pipeline |

### D. Guardrails (these should be **declined**, not answered)
| Ask | Expect |
|-----|--------|
| What is the capital of France? | Refuses — not in the documents |
| Tell me a joke | Refuses |
| What salary should I ask for? | Refuses — no evidence in the corpus |

> The app refuses rather than fabricating. Off-topic questions never get a
> confident answer.

### E. Document controls
- **`+ Job`** → adds a posting; paste a JD and ask a question against it.
- **`Upload`** → load a PDF/DOCX/TXT résumé or JD (parsed locally).
- **`Reset`** → restores the starter documents.

---

## 4. Run the automated checks

```bash
npm run lint        # ESLint
npm run typecheck   # TypeScript, no emit
npm test            # unit tests (chunking, retrieval, fit, guardrails, intent, API)
npm run eval        # RAG quality gate — retrieval hit-rate, refusal accuracy, grounded rate
npm run build       # production build (Next.js standalone)
```

`npm run eval` is the one worth a look: it runs a golden set through the real
pipeline and **fails (non-zero exit) if retrieval, refusal, or grounding quality
drops below threshold** — a RAG regression breaks the build like a type error.

Docker:

```bash
docker build -t career-assistant .
docker run -p 3000:3000 career-assistant
```

---

## 5. Notes

- **Deterministic by default** — answers are repeatable and need no secrets, which makes the demo reliable. The LLM path is a real upgrade behind one env var, not a dependency.
- **Pre-loaded documents are starter data** — edit or replace them freely.
- Known limitations and what I'd do with more time are documented in the [README](README.md).
