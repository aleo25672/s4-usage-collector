import { HttpSapWorkloadProvider } from "./http-provider";
import { MockSapWorkloadProvider } from "./mock-provider";
import { RfcSapWorkloadProvider } from "./rfc-provider";
import type { PeriodType, SapWorkloadProvider, WorkloadQuery } from "./types";

export type {
  ConnectionInfo,
  HitlistEntry,
  PeriodType,
  RfcAggregate,
  SapWorkloadProvider,
  TaskTypeAggregate,
  TimeSlotAggregate,
  TransactionAggregate,
  UserTransactionAggregate,
  UserWorkloadAggregate,
  WorkloadBundle,
  WorkloadOverview,
  WorkloadQuery,
} from "./types";

let cached: SapWorkloadProvider | null = null;
let cachedMode: string | null = null;

function resolveProviderMode(): string {
  // Bracket access avoids occasional Next.js static env inlining quirks.
  return (process.env["SAP_PROVIDER"] ?? "mock").trim().toLowerCase();
}

export function getSapProvider(): SapWorkloadProvider {
  const mode = resolveProviderMode();
  if (cached && cachedMode === mode) return cached;

  if (mode === "rfc") {
    cached = new RfcSapWorkloadProvider();
  } else if (mode === "http") {
    cached = new HttpSapWorkloadProvider();
  } else {
    cached = new MockSapWorkloadProvider();
  }
  cachedMode = mode;
  console.info(`[st03-lens] SAP_PROVIDER=${mode}`);
  return cached;
}

/** Test helper / hot-reload: drop cached provider after env changes. */
export function resetSapProvider(): void {
  cached = null;
  cachedMode = null;
}

export function parsePeriodType(value: string | null): PeriodType {
  if (value === "D" || value === "W" || value === "M") return value;
  return "D";
}

export function defaultPeriodStart(periodType: PeriodType = "D"): string {
  const d = new Date();
  // Day aggregates are often only complete for prior days on live systems
  if (resolveProviderMode() === "http" && periodType === "D") {
    d.setUTCDate(d.getUTCDate() - 1);
  } else if (periodType === "W") {
    const day = d.getUTCDay();
    const diff = (day + 6) % 7;
    d.setUTCDate(d.getUTCDate() - diff);
  } else if (periodType === "M") {
    d.setUTCDate(1);
  }
  return d.toISOString().slice(0, 10);
}

export function queryFromSearchParams(
  params: URLSearchParams,
): WorkloadQuery {
  const periodType = parsePeriodType(params.get("periodType"));
  return {
    systemId: params.get("systemId") ?? process.env.SAP_SYSTEM_ID ?? "S4D",
    instance: params.get("instance") ?? process.env.SAP_INSTANCE ?? "TOTAL",
    periodType,
    periodStart: params.get("periodStart") ?? defaultPeriodStart(periodType),
  };
}
