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

export function getSapProvider(): SapWorkloadProvider {
  if (cached) return cached;
  const mode = (process.env.SAP_PROVIDER ?? "mock").toLowerCase();
  cached =
    mode === "rfc" ? new RfcSapWorkloadProvider() : new MockSapWorkloadProvider();
  return cached;
}

export function parsePeriodType(value: string | null): PeriodType {
  if (value === "D" || value === "W" || value === "M") return value;
  return "D";
}

export function defaultPeriodStart(periodType: PeriodType = "D"): string {
  const d = new Date();
  if (periodType === "W") {
    const day = d.getUTCDay();
    const diff = (day + 6) % 7; // Monday-based week start
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
