import type {
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

/** Deterministic pseudo-random from string seed */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function scaleForPeriod(periodType: PeriodType): number {
  switch (periodType) {
    case "D":
      return 1;
    case "W":
      return 6.2;
    case "M":
      return 24;
  }
}

const TRANSACTIONS: Array<{
  tcode: string;
  report: string;
  taskType: TaskTypeAggregate["taskType"];
  weight: number;
  baseResp: number;
  baseDb: number;
}> = [
  { tcode: "VA01", report: "SAPMV45A", taskType: "DIALOG", weight: 1.2, baseResp: 420, baseDb: 180 },
  { tcode: "VA02", report: "SAPMV45A", taskType: "DIALOG", weight: 0.9, baseResp: 380, baseDb: 160 },
  { tcode: "VA03", report: "SAPMV45A", taskType: "DIALOG", weight: 1.8, baseResp: 210, baseDb: 90 },
  { tcode: "ME21N", report: "RM_MEPO_GUI", taskType: "DIALOG", weight: 1.0, baseResp: 510, baseDb: 220 },
  { tcode: "ME23N", report: "RM_MEPO_GUI", taskType: "DIALOG", weight: 1.4, baseResp: 240, baseDb: 100 },
  { tcode: "MIGO", report: "SAPLMIGO", taskType: "DIALOG", weight: 1.1, baseResp: 460, baseDb: 200 },
  { tcode: "MIRO", report: "SAPLMR1M", taskType: "DIALOG", weight: 0.7, baseResp: 580, baseDb: 260 },
  { tcode: "FB50", report: "SAPMF05A", taskType: "DIALOG", weight: 0.8, baseResp: 390, baseDb: 170 },
  { tcode: "FBL1N", report: "RFITEMAP", taskType: "DIALOG", weight: 1.3, baseResp: 720, baseDb: 480 },
  { tcode: "FBL5N", report: "RFITEMAR", taskType: "DIALOG", weight: 1.5, baseResp: 690, baseDb: 450 },
  { tcode: "MMBE", report: "RMMMBESTN", taskType: "DIALOG", weight: 2.0, baseResp: 180, baseDb: 95 },
  { tcode: "MD04", report: "SAPMM61R", taskType: "DIALOG", weight: 1.6, baseResp: 350, baseDb: 210 },
  { tcode: "VL01N", report: "SAPMV50A", taskType: "DIALOG", weight: 0.6, baseResp: 440, baseDb: 190 },
  { tcode: "VL02N", report: "SAPMV50A", taskType: "DIALOG", weight: 0.5, baseResp: 400, baseDb: 175 },
  { tcode: "SU01", report: "SAPLSUU5", taskType: "DIALOG", weight: 0.3, baseResp: 150, baseDb: 40 },
  { tcode: "SE16N", report: "RK_SE16N", taskType: "DIALOG", weight: 0.9, baseResp: 890, baseDb: 720 },
  { tcode: "STMS", report: "SAPMSSY0", taskType: "DIALOG", weight: 0.2, baseResp: 320, baseDb: 80 },
  { tcode: "SM37", report: "SAPLBTCH", taskType: "DIALOG", weight: 0.8, baseResp: 280, baseDb: 110 },
  { tcode: "SBWP", report: "SAPLSWRR", taskType: "DIALOG", weight: 1.1, baseResp: 160, baseDb: 55 },
  { tcode: "/IWFND/MAINT_SERVICE", report: " /IWFND/R_COS_SERVICE", taskType: "DIALOG", weight: 0.15, baseResp: 240, baseDb: 70 },
  { tcode: "SAPMHTTP", report: "SAPMHTTP", taskType: "HTTP", weight: 3.5, baseResp: 120, baseDb: 45 },
  { tcode: "BTC_RBDAPP01", report: "RBDAPP01", taskType: "BACKGROUND", weight: 0.4, baseResp: 4200, baseDb: 3100 },
  { tcode: "BTC_RSBDCSUB", report: "RSBDCSUB", taskType: "BACKGROUND", weight: 0.25, baseResp: 1800, baseDb: 900 },
  { tcode: "BTC_RMDATIND", report: "RMDATIND", taskType: "BACKGROUND", weight: 0.2, baseResp: 9600, baseDb: 8200 },
  { tcode: "BTC_SAP_COLLECTOR", report: "RSCOLL00", taskType: "BACKGROUND", weight: 0.3, baseResp: 2400, baseDb: 1100 },
];

const USERS = [
  { user: "JSMITH", type: "DIALOG" as const, weight: 1.4 },
  { user: "AKHAN", type: "DIALOG" as const, weight: 1.2 },
  { user: "MLEE", type: "DIALOG" as const, weight: 1.1 },
  { user: "CPATEL", type: "DIALOG" as const, weight: 0.9 },
  { user: "RNOVAK", type: "DIALOG" as const, weight: 0.85 },
  { user: "SBECK", type: "DIALOG" as const, weight: 0.7 },
  { user: "TWONG", type: "DIALOG" as const, weight: 0.65 },
  { user: "HBERG", type: "DIALOG" as const, weight: 0.55 },
  { user: "BATCH_FI", type: "BATCH" as const, weight: 0.4 },
  { user: "BATCH_MM", type: "BATCH" as const, weight: 0.35 },
  { user: "WF-BATCH", type: "BATCH" as const, weight: 0.5 },
  { user: "RFC_PI", type: "RFC" as const, weight: 0.8 },
  { user: "RFC_BW", type: "RFC" as const, weight: 0.6 },
  { user: "SAP_WFRT", type: "SERVICE" as const, weight: 0.3 },
  { user: "DDIC", type: "DIALOG" as const, weight: 0.15 },
];

const RFC_DESTS = [
  { dest: "SAP_BW", fm: "RSWR_RFC_SERVICE", direction: "CLIENT" as const },
  { dest: "PI_INTEGRATION", fm: "SXMB_CALL", direction: "CLIENT" as const },
  { dest: "ECC_LEGACY", fm: "BAPI_PO_GETDETAIL", direction: "CLIENT" as const },
  { dest: "NONE", fm: "RFC_PING", direction: "SERVER" as const },
  { dest: "NONE", fm: "BAPI_USER_GET_DETAIL", direction: "SERVER" as const },
  { dest: "NONE", fm: "STFC_CONNECTION", direction: "SERVER" as const },
  { dest: "SOLMAN_SM59", fm: "SMSY_GET_SYSTEM", direction: "CLIENT" as const },
  { dest: "NONE", fm: "/IWBEP/FM_MGW_HANDLE_REQUEST", direction: "SERVER" as const },
];

function buildSeed(query: WorkloadQuery): number {
  return hash(`${query.systemId}|${query.instance}|${query.periodType}|${query.periodStart}`);
}

export class MockSapWorkloadProvider implements SapWorkloadProvider {
  getConnectionInfo(): ConnectionInfo {
    return {
      mode: "mock",
      systemId: process.env.SAP_SYSTEM_ID ?? "S4D",
      instance: "TOTAL",
      host: "mock.local",
      client: process.env.SAP_CLIENT ?? "100",
      description:
        "Demo data shaped like ST03N aggregates (SWNC_COLLECTOR_GET_AGGREGATES). Set SAP_PROVIDER=rfc with connection env vars for a live system.",
    };
  }

  async getOverview(query: WorkloadQuery): Promise<WorkloadOverview> {
    const bundle = await this.getBundle(query);
    return bundle.overview;
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

  async getBundle(query: WorkloadQuery): Promise<WorkloadBundle> {
    const rand = mulberry32(buildSeed(query));
    const scale = scaleForPeriod(query.periodType);
    const connection = {
      ...this.getConnectionInfo(),
      systemId: query.systemId,
      instance: query.instance,
    };

    const transactions: TransactionAggregate[] = TRANSACTIONS.map((t) => {
      const jitter = 0.75 + rand() * 0.5;
      const steps = Math.round(420 * t.weight * scale * jitter);
      const avgResponseTimeMs = Math.round(t.baseResp * (0.85 + rand() * 0.4));
      const avgDbTimeMs = Math.round(t.baseDb * (0.85 + rand() * 0.4));
      const avgCpuTimeMs = Math.round(avgResponseTimeMs * (0.25 + rand() * 0.2));
      return {
        tcode: t.tcode,
        report: t.report.trim(),
        taskType: t.taskType,
        steps,
        avgResponseTimeMs,
        avgCpuTimeMs,
        avgDbTimeMs,
        totalResponseTimeMs: steps * avgResponseTimeMs,
        dbReads: Math.round(steps * (8 + rand() * 40)),
        dbChanges: Math.round(steps * (rand() < 0.4 ? rand() * 3 : 0)),
      };
    }).sort((a, b) => b.totalResponseTimeMs - a.totalResponseTimeMs);

    const taskTypeMap = new Map<string, TaskTypeAggregate>();
    for (const t of transactions) {
      const existing = taskTypeMap.get(t.taskType);
      if (!existing) {
        taskTypeMap.set(t.taskType, {
          taskType: t.taskType,
          steps: t.steps,
          avgResponseTimeMs: t.avgResponseTimeMs,
          avgCpuTimeMs: t.avgCpuTimeMs,
          avgDbTimeMs: t.avgDbTimeMs,
          avgWaitTimeMs: Math.round(12 + rand() * 40),
          avgGuiTimeMs: t.taskType === "DIALOG" ? Math.round(40 + rand() * 80) : 0,
          totalResponseTimeMs: t.totalResponseTimeMs,
          avgRollWaitMs: Math.round(rand() * 25),
        });
      } else {
        const steps = existing.steps + t.steps;
        const totalResponseTimeMs =
          existing.totalResponseTimeMs + t.totalResponseTimeMs;
        existing.steps = steps;
        existing.totalResponseTimeMs = totalResponseTimeMs;
        existing.avgResponseTimeMs = Math.round(totalResponseTimeMs / steps);
        existing.avgCpuTimeMs = Math.round(
          (existing.avgCpuTimeMs * (steps - t.steps) + t.avgCpuTimeMs * t.steps) /
            steps,
        );
        existing.avgDbTimeMs = Math.round(
          (existing.avgDbTimeMs * (steps - t.steps) + t.avgDbTimeMs * t.steps) /
            steps,
        );
      }
    }

    // Ensure classic ST03N task types appear even with low volume
    for (const extra of ["UPDATE", "UPDATE2", "SPOOL", "RFC", "BUFFER_SYNC"] as const) {
      if (!taskTypeMap.has(extra)) {
        const steps = Math.round((80 + rand() * 200) * scale * 0.15);
        const avgResponseTimeMs = Math.round(100 + rand() * 400);
        taskTypeMap.set(extra, {
          taskType: extra,
          steps,
          avgResponseTimeMs,
          avgCpuTimeMs: Math.round(avgResponseTimeMs * 0.3),
          avgDbTimeMs: Math.round(avgResponseTimeMs * 0.25),
          avgWaitTimeMs: Math.round(rand() * 30),
          avgGuiTimeMs: 0,
          totalResponseTimeMs: steps * avgResponseTimeMs,
          avgRollWaitMs: Math.round(rand() * 10),
        });
      }
    }

    const taskTypes = [...taskTypeMap.values()].sort(
      (a, b) => b.totalResponseTimeMs - a.totalResponseTimeMs,
    );

    const users: UserWorkloadAggregate[] = USERS.map((u) => {
      const jitter = 0.7 + rand() * 0.6;
      const steps = Math.round(380 * u.weight * scale * jitter);
      const avgResponseTimeMs = Math.round(220 + rand() * 480);
      return {
        user: u.user,
        accountType: u.type,
        steps,
        avgResponseTimeMs,
        avgCpuTimeMs: Math.round(avgResponseTimeMs * (0.2 + rand() * 0.25)),
        avgDbTimeMs: Math.round(avgResponseTimeMs * (0.3 + rand() * 0.35)),
        totalResponseTimeMs: steps * avgResponseTimeMs,
        distinctTransactions: Math.round(3 + rand() * 12),
      };
    }).sort((a, b) => b.steps - a.steps);

    const dialogTcodes = transactions
      .filter((t) => t.taskType === "DIALOG")
      .slice(0, 12);
    const userTransactions: UserTransactionAggregate[] = [];
    for (const u of users.filter((x) => x.accountType === "DIALOG").slice(0, 8)) {
      const picks = dialogTcodes
        .slice()
        .sort(() => rand() - 0.5)
        .slice(0, 3 + Math.floor(rand() * 4));
      for (const t of picks) {
        const steps = Math.round((t.steps / users.length) * (0.5 + rand()));
        const avgResponseTimeMs = Math.round(
          t.avgResponseTimeMs * (0.8 + rand() * 0.5),
        );
        userTransactions.push({
          user: u.user,
          tcode: t.tcode,
          steps,
          avgResponseTimeMs,
          totalResponseTimeMs: steps * avgResponseTimeMs,
        });
      }
    }
    userTransactions.sort((a, b) => b.steps - a.steps);

    const timeProfile: TimeSlotAggregate[] = Array.from({ length: 24 }, (_, hour) => {
      // Business-hours shaped curve
      const business =
        hour >= 7 && hour <= 18
          ? Math.exp(-Math.pow((hour - 11.5) / 4.2, 2))
          : 0.08 + (hour >= 19 && hour <= 22 ? 0.12 : 0);
      const steps = Math.round(180 * scale * business * (0.85 + rand() * 0.3));
      const dialogSteps = Math.round(steps * (0.55 + rand() * 0.2));
      const backgroundSteps = steps - dialogSteps;
      return {
        slot: `${String(hour).padStart(2, "0")}:00`,
        hour,
        steps,
        dialogSteps,
        backgroundSteps,
        avgResponseTimeMs: Math.round(280 + (1 - business) * 200 + rand() * 80),
        avgDbTimeMs: Math.round(120 + (1 - business) * 90 + rand() * 40),
      };
    });

    const rfc: RfcAggregate[] = RFC_DESTS.map((r) => {
      const calls = Math.round((200 + rand() * 1800) * scale * 0.4);
      return {
        direction: r.direction,
        destination: r.dest,
        functionModule: r.fm,
        calls,
        avgExecutionTimeMs: Math.round(40 + rand() * 600),
        avgRemoteTimeMs: Math.round(20 + rand() * 400),
        errors: Math.round(rand() * calls * 0.01),
      };
    }).sort((a, b) => b.calls - a.calls);

    const makeHitlist = (kind: "RESPTIME" | "DATABASE"): HitlistEntry[] => {
      const top = [...transactions]
        .sort((a, b) =>
          kind === "RESPTIME"
            ? b.avgResponseTimeMs - a.avgResponseTimeMs
            : b.avgDbTimeMs - a.avgDbTimeMs,
        )
        .slice(0, 15);
      return top.map((t, i) => {
        const user = USERS[Math.floor(rand() * USERS.length)]!.user;
        const responseTimeMs =
          kind === "RESPTIME"
            ? Math.round(t.avgResponseTimeMs * (3 + rand() * 8))
            : Math.round(t.avgResponseTimeMs * (1.5 + rand() * 3));
        const dbTimeMs =
          kind === "DATABASE"
            ? Math.round(t.avgDbTimeMs * (4 + rand() * 10))
            : Math.round(t.avgDbTimeMs * (1.2 + rand() * 2));
        const dayOffset = Math.floor(rand() * (query.periodType === "D" ? 1 : 5));
        const base = new Date(`${query.periodStart}T08:00:00Z`);
        base.setUTCDate(base.getUTCDate() + dayOffset);
        base.setUTCHours(7 + Math.floor(rand() * 10), Math.floor(rand() * 60));
        return {
          kind,
          user,
          tcode: t.tcode,
          report: t.report,
          responseTimeMs,
          dbTimeMs,
          cpuTimeMs: Math.round(responseTimeMs * (0.15 + rand() * 0.25)),
          timestamp: base.toISOString(),
          instance: `appsrv${(i % 3) + 1}_${query.systemId.toLowerCase()}_00`,
        };
      });
    };

    const hitlistResponse = makeHitlist("RESPTIME");
    const hitlistDatabase = makeHitlist("DATABASE");

    const totalSteps = taskTypes.reduce((s, t) => s + t.steps, 0);
    const totalResp = taskTypes.reduce((s, t) => s + t.totalResponseTimeMs, 0);
    const totalCpu = taskTypes.reduce(
      (s, t) => s + t.avgCpuTimeMs * t.steps,
      0,
    );
    const totalDb = taskTypes.reduce((s, t) => s + t.avgDbTimeMs * t.steps, 0);

    const overview: WorkloadOverview = {
      query,
      connection,
      collectedAt: new Date().toISOString(),
      taskTypes,
      totals: {
        steps: totalSteps,
        avgResponseTimeMs: totalSteps ? Math.round(totalResp / totalSteps) : 0,
        avgCpuTimeMs: totalSteps ? Math.round(totalCpu / totalSteps) : 0,
        avgDbTimeMs: totalSteps ? Math.round(totalDb / totalSteps) : 0,
        dialogUsers: users.filter((u) => u.accountType === "DIALOG").length,
        distinctTransactions: transactions.length,
      },
    };

    return {
      overview,
      transactions,
      users,
      userTransactions,
      timeProfile,
      rfc,
      hitlistResponse,
      hitlistDatabase,
    };
  }
}
