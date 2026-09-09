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

export type CsvTableId =
  | "tasktype"
  | "tcdet"
  | "userworkload"
  | "usertcode"
  | "times"
  | "rfc"
  | "hitlist_resptime"
  | "hitlist_database"
  | "manifest";

export interface CsvFileSpec {
  id: CsvTableId;
  filename: string;
  label: string;
  headers: string[];
  rows: Array<Record<string, unknown>>;
}

/** Build the same CSV set the ABAP extract / CLI writes. */
export function buildCsvFiles(bundle: WorkloadBundle): CsvFileSpec[] {
  const { overview } = bundle;
  return [
    {
      id: "tasktype",
      filename: "tasktype.csv",
      label: "Task types",
      headers: [
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
      rows: overview.taskTypes as unknown as Array<Record<string, unknown>>,
    },
    {
      id: "tcdet",
      filename: "tcdet.csv",
      label: "Transactions",
      headers: [
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
      rows: bundle.transactions as unknown as Array<Record<string, unknown>>,
    },
    {
      id: "userworkload",
      filename: "userworkload.csv",
      label: "Users",
      headers: [
        "user",
        "accountType",
        "steps",
        "avgResponseTimeMs",
        "avgCpuTimeMs",
        "avgDbTimeMs",
        "totalResponseTimeMs",
        "distinctTransactions",
      ],
      rows: bundle.users as unknown as Array<Record<string, unknown>>,
    },
    {
      id: "usertcode",
      filename: "usertcode.csv",
      label: "User × transaction",
      headers: [
        "user",
        "tcode",
        "steps",
        "avgResponseTimeMs",
        "totalResponseTimeMs",
      ],
      rows: bundle.userTransactions as unknown as Array<Record<string, unknown>>,
    },
    {
      id: "times",
      filename: "times.csv",
      label: "Time profile",
      headers: [
        "slot",
        "hour",
        "steps",
        "dialogSteps",
        "backgroundSteps",
        "avgResponseTimeMs",
        "avgDbTimeMs",
      ],
      rows: bundle.timeProfile as unknown as Array<Record<string, unknown>>,
    },
    {
      id: "rfc",
      filename: "rfc.csv",
      label: "RFC",
      headers: [
        "direction",
        "destination",
        "functionModule",
        "calls",
        "avgExecutionTimeMs",
        "avgRemoteTimeMs",
        "errors",
      ],
      rows: bundle.rfc as unknown as Array<Record<string, unknown>>,
    },
    {
      id: "hitlist_resptime",
      filename: "hitlist_resptime.csv",
      label: "Hitlist · response",
      headers: [
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
      rows: bundle.hitlistResponse as unknown as Array<Record<string, unknown>>,
    },
    {
      id: "hitlist_database",
      filename: "hitlist_database.csv",
      label: "Hitlist · database",
      headers: [
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
      rows: bundle.hitlistDatabase as unknown as Array<Record<string, unknown>>,
    },
    {
      id: "manifest",
      filename: "manifest.csv",
      label: "Manifest",
      headers: [
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
      rows: [
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
    },
  ];
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
  for (const spec of buildCsvFiles(bundle)) {
    const path = join(outDir, spec.filename);
    writeFileSync(path, toCsv(spec.headers, spec.rows), "utf8");
    files.push(path);
  }
  return { dir: outDir, files };
}
