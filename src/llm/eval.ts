import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { extractIntent } from "./extract";
import { evalCases } from "./eval.cases";

/**
 * Extraction regression runner (CLAUDE.md: "re-run it after any prompt
 * change to catch regressions"). Drives `extractIntent` against a labelled
 * set of real phrasings and checks the parsed intent/fields — not just that
 * a tool was called, but that amounts, currencies, and VAT were read (or
 * correctly left for code to ask about / default), never invented.
 *
 * Usage: npm test
 */
async function main() {
  const { ANTHROPIC_API_KEY } = process.env;
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required to run extraction evals");

  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  let passed = 0;
  let failed = 0;

  for (const c of evalCases) {
    try {
      const result = await extractIntent(c.message, anthropic, c.defaultCurrency ?? "GBP");
      const failure = c.check(result);
      if (failure) {
        failed++;
        console.log(`✗ ${c.label}`);
        console.log(`    message: "${c.message}"`);
        console.log(`    ${failure}`);
        console.log(`    got: ${JSON.stringify(result)}`);
      } else {
        passed++;
        console.log(`✓ ${c.label}`);
      }
    } catch (err) {
      failed++;
      console.log(`✗ ${c.label} (threw)`);
      console.log(`    ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\n${passed}/${evalCases.length} passed`);
  if (failed > 0) process.exit(1);
}

main();
