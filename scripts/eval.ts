/**
 * Eval harness. Runs the golden set through the real pipeline and prints a
 * scorecard: retrieval hit-rate, refusal accuracy, grounded-rate, latency.
 * Exits non-zero if quality drops below thresholds so it can gate CI.
 *
 * Usage: npm run eval   (deterministic by default; set ANTHROPIC_API_KEY to
 * evaluate the LLM pipeline instead — same dataset, same thresholds).
 */
import { goldenSet } from "../eval/dataset";
import { answerQuestion } from "../src/lib/rag";
import { getConfig } from "../src/lib/config";
import { defaultDocuments } from "../src/lib/sample-data";
import { REFUSAL_MESSAGE } from "../src/lib/rag/guardrails";

const THRESHOLDS = { retrievalHitRate: 0.8, refusalAccuracy: 1, groundedRate: 0.8 };

type Row = {
  id: string;
  pass: boolean;
  notes: string[];
  latencyMs: number;
};

async function run() {
  const config = getConfig();
  console.log(`\nEval mode: ${config.mode}  •  cases: ${goldenSet.length}\n`);

  const rows: Row[] = [];
  let retrievalHits = 0;
  let retrievalApplicable = 0;
  let refusalCorrect = 0;
  let refusalApplicable = 0;
  let grounded = 0;
  let groundedApplicable = 0;

  for (const c of goldenSet) {
    const started = performance.now();
    const result = await answerQuestion(c.question, defaultDocuments, config);
    const latencyMs = Math.round(performance.now() - started);
    const notes: string[] = [];
    let pass = true;

    if (c.expectRefuse) {
      refusalApplicable++;
      const refused = result.answer === REFUSAL_MESSAGE || !result.trace.grounded;
      if (refused) refusalCorrect++;
      else {
        pass = false;
        notes.push("expected refusal, got an answer");
      }
    } else {
      groundedApplicable++;
      if (result.trace.grounded) grounded++;
      else {
        pass = false;
        notes.push("answer not grounded");
      }
    }

    if (c.expectKind) {
      retrievalApplicable++;
      const hit = result.citations.some((chunk) => chunk.kind === c.expectKind);
      if (hit) retrievalHits++;
      else {
        pass = false;
        notes.push(`no cited chunk of kind "${c.expectKind}"`);
      }
    }

    if (c.mustInclude) {
      const lower = result.answer.toLowerCase();
      const missing = c.mustInclude.filter((s) => !lower.includes(s.toLowerCase()));
      if (missing.length) {
        pass = false;
        notes.push(`missing substrings: ${missing.join(", ")}`);
      }
    }

    rows.push({ id: c.id, pass, notes, latencyMs });
  }

  for (const row of rows) {
    const status = row.pass ? "PASS" : "FAIL";
    console.log(`  [${status}] ${row.id.padEnd(22)} ${row.latencyMs}ms ${row.notes.join("; ")}`);
  }

  const retrievalHitRate = retrievalApplicable ? retrievalHits / retrievalApplicable : 1;
  const refusalAccuracy = refusalApplicable ? refusalCorrect / refusalApplicable : 1;
  const groundedRate = groundedApplicable ? grounded / groundedApplicable : 1;
  const avgLatency = Math.round(rows.reduce((t, r) => t + r.latencyMs, 0) / rows.length);

  console.log("\n  Scorecard");
  console.log(`    retrieval hit-rate : ${(retrievalHitRate * 100).toFixed(0)}%  (threshold ${THRESHOLDS.retrievalHitRate * 100}%)`);
  console.log(`    refusal accuracy   : ${(refusalAccuracy * 100).toFixed(0)}%  (threshold ${THRESHOLDS.refusalAccuracy * 100}%)`);
  console.log(`    grounded rate      : ${(groundedRate * 100).toFixed(0)}%  (threshold ${THRESHOLDS.groundedRate * 100}%)`);
  console.log(`    avg latency        : ${avgLatency}ms\n`);

  const failed =
    retrievalHitRate < THRESHOLDS.retrievalHitRate ||
    refusalAccuracy < THRESHOLDS.refusalAccuracy ||
    groundedRate < THRESHOLDS.groundedRate;

  if (failed) {
    console.error("Eval failed: one or more metrics below threshold.\n");
    process.exit(1);
  }
  console.log("Eval passed.\n");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
