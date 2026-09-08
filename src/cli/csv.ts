import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { WorkloadBundle } from "../lib/sap/types";

function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(
  headers: string[],
  rows: Array<Record<string, unknown>>,
): string {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export interface ExtractArtifacts {
  dir: string;
  files: string[];
}

/** Write one CSV per ST03N aggregate table into outDir. */
export function writeBundleCsv(
  bundle: WorkloadBundle,
  outDir: string,
): ExtractArtifacts {
  mkdirSync(outDir, { recursive: true });
  const files: string[] = [];
  const write = (name: string, headers: string[], rows: Array<Record<string, unknown>>) => {
    const path = join(outDir, name);
    writeFileSync(path, toCsv(headers, rows), "utf8");
    files.push(path);
  };

  const { overview } = bundle;
  write(
    "tasktype.csv",
    [
      "taskType",
      "steps",
      "avgResponseTimeMs",
      "avgCpuTimeMs",
      "avgDbTimeMs",
      "avgWaitTimeMs",
      "avgGuiTimeMs",
      "avgRollWaitMs",
      "totalResponseTimeMs",
    ],
    overview.taskTypes as unknown as Array<Record<string, unknown>>,
  );

  write(
    "tcdet.csv",
    [
      "tcode",
      "report",
      "taskType",
      "steps",
      "avgResponseTimeMs",
      "avgCpuTimeMs",
      "avgDbTimeMs",
      "totalResponseTimeMs",
      "dbReads",
      "dbChanges",
    ],
    bundle.transactions as unknown as Array<Record<string, unknown>>,
  );

  write(
    "userworkload.csv",
    [
      "user",
      "accountType",
      "steps",
      "avgResponseTimeMs",
      "avgCpuTimeMs",
      "avgDbTimeMs",
      "totalResponseTimeMs",
      "distinctTransactions",
    ],
    bundle.users as unknown as Array<Record<string, unknown>>,
  );

  write(
    "usertcode.csv",
    ["user", "tcode", "steps", "avgResponseTimeMs", "totalResponseTimeMs"],
    bundle.userTransactions as unknown as Array<Record<string, unknown>>,
  );

  write(
    "times.csv",
    [
      "slot",
      "hour",
      "steps",
      "dialogSteps",
      "backgroundSteps",
      "avgResponseTimeMs",
      "avgDbTimeMs",
    ],
    bundle.timeProfile as unknown as Array<Record<string, unknown>>,
  );

  write(
    "rfc.csv",
    [
      "direction",
      "destination",
      "functionModule",
      "calls",
      "avgExecutionTimeMs",
      "avgRemoteTimeMs",
      "errors",
    ],
    bundle.rfc as unknown as Array<Record<string, unknown>>,
  );

  write(
    "hitlist_resptime.csv",
    [
      "kind",
      "user",
      "tcode",
      "report",
      "responseTimeMs",
      "dbTimeMs",
      "cpuTimeMs",
      "timestamp",
      "instance",
    ],
    bundle.hitlistResponse as unknown as Array<Record<string, unknown>>,
  );

  write(
    "hitlist_database.csv",
    [
      "kind",
      "user",
      "tcode",
      "report",
      "responseTimeMs",
      "dbTimeMs",
      "cpuTimeMs",
      "timestamp",
      "instance",
    ],
    bundle.hitlistDatabase as unknown as Array<Record<string, unknown>>,
  );

  write(
    "manifest.csv",
    [
      "systemId",
      "instance",
      "periodType",
      "periodStart",
      "providerMode",
      "collectedAt",
      "totalSteps",
      "avgResponseTimeMs",
      "avgDbTimeMs",
      "dialogUsers",
      "distinctTransactions",
    ],
    [
      {
        systemId: overview.query.systemId,
        instance: overview.query.instance,
        periodType: overview.query.periodType,
        periodStart: overview.query.periodStart,
        providerMode: overview.connection.mode,
        collectedAt: overview.collectedAt,
        totalSteps: overview.totals.steps,
        avgResponseTimeMs: overview.totals.avgResponseTimeMs,
        avgDbTimeMs: overview.totals.avgDbTimeMs,
        dialogUsers: overview.totals.dialogUsers,
        distinctTransactions: overview.totals.distinctTransactions,
      },
    ],
  );

  return { dir: outDir, files };
}
