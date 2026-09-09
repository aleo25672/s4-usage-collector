#!/usr/bin/env npx tsx
/**
 * CLI extract of ST03N-shaped workload aggregates.
 *
 * Usage:
 *   npm run extract -- --periodType D --periodStart 2026-09-08 --out ./output
 *
 * Provider:
 *   SAP_PROVIDER=mock (default) or rfc (requires NWRFC wiring)
 */

import { join } from "node:path";
import {
  defaultPeriodStart,
  getSapProvider,
  parsePeriodType,
  type WorkloadQuery,
} from "../lib/sap";
import { writeBundleCsv } from "./csv";

function argValue(argv: string[], name: string): string | undefined {
  const idx = argv.indexOf(name);
  if (idx === -1) return undefined;
  return argv[idx + 1];
}

function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(name);
}

function printHelp(): void {
  console.log(`ST03N workload extract (Node.js)

Usage:
  npm run extract -- [options]

Options:
  --systemId <SID>       SAP system id (default: env SAP_SYSTEM_ID or S4D)
  --instance <name>      Instance or TOTAL (default: TOTAL)
  --periodType <D|W|M>   Day / Week / Month (default: D)
  --periodStart <YYYY-MM-DD>
  --out <dir>            Output directory (default: ./output/zevo-st03-<stamp>)
  --json                 Also write bundle.json
  --help                 Show this help

Notes:
  ST03N itself only supports interactive ALV "Export → Spreadsheet" from the
  GUI. For scheduled / automated extracts, use this CLI or the ABAP report
  abap/zevo_st03_extract.prog.abap (SWNC_COLLECTOR_GET_AGGREGATES).
`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (hasFlag(argv, "--help") || hasFlag(argv, "-h")) {
    printHelp();
    return;
  }

  const periodType = parsePeriodType(argValue(argv, "--periodType") ?? "D");
  const query: WorkloadQuery = {
    systemId:
      argValue(argv, "--systemId") ?? process.env.SAP_SYSTEM_ID ?? "S4D",
    instance:
      argValue(argv, "--instance") ?? process.env.SAP_INSTANCE ?? "TOTAL",
    periodType,
    periodStart:
      argValue(argv, "--periodStart") ?? defaultPeriodStart(periodType),
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir =
    argValue(argv, "--out") ??
    join(process.cwd(), "output", `zevo-st03-${query.systemId}-${stamp}`);

  const provider = getSapProvider();
  const connection = provider.getConnectionInfo();
  console.log(
    `Extracting ST03N aggregates via ${connection.mode} provider ` +
      `(${query.systemId}/${query.instance}, ${query.periodType} ${query.periodStart})…`,
  );

  const bundle = await provider.getBundle(query);
  const result = writeBundleCsv(bundle, outDir);

  if (hasFlag(argv, "--json")) {
    const { writeFileSync } = await import("node:fs");
    const jsonPath = join(outDir, "bundle.json");
    writeFileSync(jsonPath, JSON.stringify(bundle, null, 2), "utf8");
    result.files.push(jsonPath);
  }

  console.log(`Wrote ${result.files.length} files to ${result.dir}`);
  for (const f of result.files) {
    console.log(`  - ${f}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
