import type {
  ConnectionInfo,
  HitlistEntry,
  RfcAggregate,
  SapWorkloadProvider,
  TaskTypeAggregate,
  TaskTypeCode,
  TimeSlotAggregate,
  TransactionAggregate,
  UserTransactionAggregate,
  UserWorkloadAggregate,
  WorkloadBundle,
  WorkloadOverview,
  WorkloadQuery,
} from "./types";

/** Loose shape returned by ZCL_ST03N_HTTP_HANDLER (current + enriched). */
interface SapHttpPayload {
  error?: string;
  query?: {
    systemId?: string;
    instance?: string;
    periodType?: string;
    periodStart?: string;
  };
  taskTypes?: Array<{
    taskType?: string;
    steps?: number;
    totalResponseTimeMs?: number;
    cpuTimeMs?: number;
    queueTimeMs?: number;
    dbTimeMs?: number;
  }>;
  transactions?: Array<{
    entryId?: string;
    fcode?: string;
    account?: string;
    tcode?: string;
    report?: string;
    steps?: number;
    totalResponseTimeMs?: number;
    cpuTimeMs?: number;
    dbTimeMs?: number;
  }>;
  users?: Array<{
    user?: string;
    account?: string;
    steps?: number;
    totalResponseTimeMs?: number;
    cpuTimeMs?: number;
    dbTimeMs?: number;
  }>;
  userTransactions?: Array<{
    user?: string;
    entryId?: string;
    tcode?: string;
    steps?: number;
    totalResponseTimeMs?: number;
  }>;
  timeProfile?: Array<{
    slot?: string;
    steps?: number;
    totalResponseTimeMs?: number;
    dbTimeMs?: number;
  }>;
  rfc?: Array<{
    direction?: string;
    target?: string;
    destination?: string;
    functionModule?: string;
    calls?: number;
    exeTimeMs?: number;
    callTimeMs?: number;
  }>;
  hitlistResponse?: Array<{
    user?: string;
    tcode?: string;
    report?: string;
    responseTimeMs?: number;
    dbTimeMs?: number;
    cpuTimeMs?: number;
  }>;
  hitlistDatabase?: Array<{
    user?: string;
    tcode?: string;
    report?: string;
    responseTimeMs?: number;
    dbTimeMs?: number;
    cpuTimeMs?: number;
  }>;
  meta?: Record<string, number | string>;
}

function avg(total: number, steps: number): number {
  if (!steps) return 0;
  return Math.round(total / steps);
}

function asTaskType(value: string | undefined, index: number): TaskTypeCode {
  const known = [
    "DIALOG",
    "BACKGROUND",
    "UPDATE",
    "UPDATE2",
    "SPOOL",
    "RFC",
    "HTTP",
    "HTTPS",
    "BUFFER_SYNC",
    "AUTOABAP",
    "RFC_HTTP",
    "OTHER",
  ] as const;
  const upper = (value ?? "").trim().toUpperCase();
  if ((known as readonly string[]).includes(upper)) return upper as TaskTypeCode;
  // SAP HTTP payload often omits task type text — keep rows distinct for UI keys
  return `TYPE_${String(index + 1).padStart(2, "0")}`;
}

function periodStartIso(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  }
  return fallback;
}

function toSapPeriodStart(isoDate: string): string {
  return isoDate.replace(/-/g, "");
}

export function mapSapHttpPayload(
  payload: SapHttpPayload,
  query: WorkloadQuery,
  connection: ConnectionInfo,
): WorkloadBundle {
  const taskTypes: TaskTypeAggregate[] = (payload.taskTypes ?? []).map(
    (row, index) => {
      const steps = Number(row.steps ?? 0);
      const totalResponseTimeMs = Number(row.totalResponseTimeMs ?? 0);
      const cpuTimeMs = Number(row.cpuTimeMs ?? 0);
      const dbTimeMs = Number(row.dbTimeMs ?? 0);
      const queueTimeMs = Number(row.queueTimeMs ?? 0);
      return {
        taskType: asTaskType(row.taskType, index),
        steps,
        avgResponseTimeMs: avg(totalResponseTimeMs, steps),
        avgCpuTimeMs: avg(cpuTimeMs, steps),
        avgDbTimeMs: avg(dbTimeMs, steps),
        avgWaitTimeMs: avg(queueTimeMs, steps),
        avgGuiTimeMs: 0,
        totalResponseTimeMs,
        avgRollWaitMs: 0,
      };
    },
  );

  const transactions: TransactionAggregate[] = (payload.transactions ?? []).map(
    (row) => {
      const steps = Number(row.steps ?? 0);
      const totalResponseTimeMs = Number(row.totalResponseTimeMs ?? 0);
      const entry = row.entryId ?? row.tcode ?? row.report ?? "";
      return {
        tcode: row.tcode || row.fcode || entry.slice(0, 20) || "UNKNOWN",
        report: row.report || entry,
        taskType: "DIALOG",
        steps,
        avgResponseTimeMs: avg(totalResponseTimeMs, steps),
        avgCpuTimeMs: avg(Number(row.cpuTimeMs ?? 0), steps),
        avgDbTimeMs: avg(Number(row.dbTimeMs ?? 0), steps),
        totalResponseTimeMs,
        dbReads: 0,
        dbChanges: 0,
      };
    },
  );

  // Prefer TCDET; if empty, derive a transaction list from userTransactions
  const userTransactions: UserTransactionAggregate[] = (
    payload.userTransactions ?? []
  ).map((row) => {
    const steps = Number(row.steps ?? 0);
    const totalResponseTimeMs = Number(row.totalResponseTimeMs ?? 0);
    return {
      user: row.user ?? "",
      tcode: row.tcode || row.entryId || "UNKNOWN",
      steps,
      avgResponseTimeMs: avg(totalResponseTimeMs, steps),
      totalResponseTimeMs,
    };
  });

  let finalTransactions = transactions;
  if (finalTransactions.length === 0 && userTransactions.length > 0) {
    const byTcode = new Map<string, TransactionAggregate>();
    for (const row of userTransactions) {
      const existing = byTcode.get(row.tcode);
      if (!existing) {
        byTcode.set(row.tcode, {
          tcode: row.tcode,
          report: row.tcode,
          taskType: "DIALOG",
          steps: row.steps,
          avgResponseTimeMs: row.avgResponseTimeMs,
          avgCpuTimeMs: 0,
          avgDbTimeMs: 0,
          totalResponseTimeMs: row.totalResponseTimeMs,
          dbReads: 0,
          dbChanges: 0,
        });
      } else {
        existing.steps += row.steps;
        existing.totalResponseTimeMs += row.totalResponseTimeMs;
        existing.avgResponseTimeMs = avg(
          existing.totalResponseTimeMs,
          existing.steps,
        );
      }
    }
    finalTransactions = [...byTcode.values()].sort(
      (a, b) => b.totalResponseTimeMs - a.totalResponseTimeMs,
    );
  }

  const users: UserWorkloadAggregate[] = (payload.users ?? []).map((row) => {
    const steps = Number(row.steps ?? 0);
    const totalResponseTimeMs = Number(row.totalResponseTimeMs ?? 0);
    return {
      user: row.user || row.account || "UNKNOWN",
      accountType: "DIALOG",
      steps,
      avgResponseTimeMs: avg(totalResponseTimeMs, steps),
      avgCpuTimeMs: avg(Number(row.cpuTimeMs ?? 0), steps),
      avgDbTimeMs: avg(Number(row.dbTimeMs ?? 0), steps),
      totalResponseTimeMs,
      distinctTransactions: 0,
    };
  });

  const timeProfile: TimeSlotAggregate[] = (payload.timeProfile ?? []).map(
    (row) => {
      const steps = Number(row.steps ?? 0);
      const totalResponseTimeMs = Number(row.totalResponseTimeMs ?? 0);
      const slot = row.slot ?? "00:00";
      const hour = Number.parseInt(slot.slice(0, 2), 10);
      return {
        slot,
        hour: Number.isFinite(hour) ? hour : 0,
        steps,
        avgResponseTimeMs: avg(totalResponseTimeMs, steps),
        avgDbTimeMs: avg(Number(row.dbTimeMs ?? 0), steps),
        dialogSteps: steps,
        backgroundSteps: 0,
      };
    },
  );

  const rfc: RfcAggregate[] = (payload.rfc ?? []).map((row) => {
    const calls = Number(row.calls ?? 0);
    const exe = Number(row.exeTimeMs ?? 0);
    const call = Number(row.callTimeMs ?? 0);
    return {
      direction: row.direction === "SERVER" ? "SERVER" : "CLIENT",
      destination: row.destination || row.target || "NONE",
      functionModule: row.functionModule ?? "",
      calls,
      avgExecutionTimeMs: avg(exe, calls),
      avgRemoteTimeMs: avg(call, calls),
      errors: 0,
    };
  });

  const mapHitlist = (
    rows: SapHttpPayload["hitlistResponse"],
    kind: "RESPTIME" | "DATABASE",
  ): HitlistEntry[] =>
    (rows ?? []).map((row) => ({
      kind,
      user: row.user ?? "",
      tcode: row.tcode ?? "",
      report: row.report ?? "",
      responseTimeMs: Number(row.responseTimeMs ?? 0),
      dbTimeMs: Number(row.dbTimeMs ?? 0),
      cpuTimeMs: Number(row.cpuTimeMs ?? 0),
      timestamp: new Date().toISOString(),
      instance: query.instance,
    }));

  const totalSteps = taskTypes.reduce((s, t) => s + t.steps, 0);
  const totalResp = taskTypes.reduce((s, t) => s + t.totalResponseTimeMs, 0);
  const totalCpu = taskTypes.reduce((s, t) => s + t.avgCpuTimeMs * t.steps, 0);
  const totalDb = taskTypes.reduce((s, t) => s + t.avgDbTimeMs * t.steps, 0);

  const overview: WorkloadOverview = {
    query: {
      ...query,
      systemId: payload.query?.systemId ?? query.systemId,
      instance: payload.query?.instance ?? query.instance,
      periodStart: periodStartIso(payload.query?.periodStart, query.periodStart),
    },
    connection,
    collectedAt: new Date().toISOString(),
    taskTypes,
    totals: {
      steps: totalSteps,
      avgResponseTimeMs: avg(totalResp, totalSteps),
      avgCpuTimeMs: avg(totalCpu, totalSteps),
      avgDbTimeMs: avg(totalDb, totalSteps),
      dialogUsers: users.length || Number(payload.meta?.userCount ?? 0),
      distinctTransactions:
        finalTransactions.length ||
        Number(payload.meta?.userTcodeCount ?? 0),
    },
  };

  return {
    overview,
    transactions: finalTransactions,
    users,
    userTransactions,
    timeProfile,
    rfc,
    hitlistResponse: mapHitlist(payload.hitlistResponse, "RESPTIME"),
    hitlistDatabase: mapHitlist(payload.hitlistDatabase, "DATABASE"),
  };
}

export class HttpSapWorkloadProvider implements SapWorkloadProvider {
  private baseUrl: string;

  constructor() {
    this.baseUrl = (process.env.SAP_HTTP_BASE_URL ?? "").replace(/\/$/, "");
    if (!this.baseUrl) {
      throw new Error(
        "SAP_PROVIDER=http requires SAP_HTTP_BASE_URL (e.g. http://10.0.0.189:50000/sap/bc/zst03n/workload)",
      );
    }
  }

  getConnectionInfo(): ConnectionInfo {
    return {
      mode: "http",
      systemId: process.env.SAP_SYSTEM_ID ?? "S4H",
      instance: process.env.SAP_INSTANCE ?? "TOTAL",
      host: this.baseUrl,
      client: process.env.SAP_CLIENT ?? "100",
      description: `Live ST03N aggregates via HTTP ${this.baseUrl}`,
    };
  }

  private async fetchPayload(query: WorkloadQuery): Promise<SapHttpPayload> {
    const url = new URL(this.baseUrl);
    url.searchParams.set("sap-client", process.env.SAP_CLIENT ?? "100");
    url.searchParams.set("periodType", query.periodType);
    url.searchParams.set("periodStart", toSapPeriodStart(query.periodStart));
    url.searchParams.set("systemId", query.systemId);
    url.searchParams.set("instance", query.instance);

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    const user = process.env.SAP_USER;
    const pass = process.env.SAP_PASSWD;
    if (user && pass) {
      headers.Authorization = `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
    }

    const res = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    const text = await res.text();
    let json: SapHttpPayload;
    try {
      json = JSON.parse(text) as SapHttpPayload;
    } catch {
      throw new Error(
        `SAP HTTP returned non-JSON (HTTP ${res.status}). Check logon/SICF URL. Body starts: ${text.slice(0, 120)}`,
      );
    }

    if (!res.ok) {
      throw new Error(json.error ?? `SAP HTTP error ${res.status}`);
    }
    if (json.error) {
      throw new Error(json.error);
    }
    return json;
  }

  async getBundle(query: WorkloadQuery): Promise<WorkloadBundle> {
    const payload = await this.fetchPayload(query);
    return mapSapHttpPayload(payload, query, this.getConnectionInfo());
  }

  async getOverview(query: WorkloadQuery): Promise<WorkloadOverview> {
    return (await this.getBundle(query)).overview;
  }

  async getTransactions(query: WorkloadQuery): Promise<TransactionAggregate[]> {
    return (await this.getBundle(query)).transactions;
  }

  async getUsers(query: WorkloadQuery): Promise<UserWorkloadAggregate[]> {
    return (await this.getBundle(query)).users;
  }

  async getUserTransactions(
    query: WorkloadQuery,
  ): Promise<UserTransactionAggregate[]> {
    return (await this.getBundle(query)).userTransactions;
  }

  async getTimeProfile(query: WorkloadQuery): Promise<TimeSlotAggregate[]> {
    return (await this.getBundle(query)).timeProfile;
  }

  async getRfc(query: WorkloadQuery): Promise<RfcAggregate[]> {
    return (await this.getBundle(query)).rfc;
  }

  async getHitlist(
    query: WorkloadQuery,
    kind: "RESPTIME" | "DATABASE",
  ): Promise<HitlistEntry[]> {
    const bundle = await this.getBundle(query);
    return kind === "RESPTIME" ? bundle.hitlistResponse : bundle.hitlistDatabase;
  }
}
