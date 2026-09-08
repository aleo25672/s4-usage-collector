/**
 * Domain types aligned with SAP ST03N / SWNC workload aggregates.
 * Source FM: SWNC_COLLECTOR_GET_AGGREGATES / SWNC_GET_AGGREGATES_FRAME
 * (function group SCSM_NW_WORKLOAD — SAP Note 1053634)
 */

/** ST03N period type: Day / Week / Month */
export type PeriodType = "D" | "W" | "M";

/** Common ABAP task types shown in ST03N Workload Overview */
export type TaskTypeCode =
  | "DIALOG"
  | "BACKGROUND"
  | "UPDATE"
  | "UPDATE2"
  | "SPOOL"
  | "RFC"
  | "HTTP"
  | "HTTPS"
  | "BUFFER_SYNC"
  | "AUTOABAP"
  | "RFC_HTTP"
  | "OTHER";

export interface WorkloadQuery {
  /** SAP system ID, e.g. PRD */
  systemId: string;
  /** Instance name or TOTAL for system-wide */
  instance: string;
  periodType: PeriodType;
  /** Period start date (YYYY-MM-DD) */
  periodStart: string;
}

export interface ConnectionInfo {
  mode: "mock" | "rfc";
  systemId: string;
  instance: string;
  host?: string;
  client?: string;
  description: string;
}

/** TASKTYPE aggregate — ST03N Workload Overview by task type */
export interface TaskTypeAggregate {
  taskType: TaskTypeCode;
  steps: number;
  /** Average response time in ms */
  avgResponseTimeMs: number;
  /** Average CPU time in ms */
  avgCpuTimeMs: number;
  /** Average DB time in ms */
  avgDbTimeMs: number;
  /** Average wait time in ms */
  avgWaitTimeMs: number;
  /** Average GUI / frontend time in ms */
  avgGuiTimeMs: number;
  /** Total response time in ms (all steps) */
  totalResponseTimeMs: number;
  /** Roll wait time average in ms */
  avgRollWaitMs: number;
}

/** TCDET — transaction / report profile */
export interface TransactionAggregate {
  tcode: string;
  report: string;
  taskType: TaskTypeCode;
  steps: number;
  avgResponseTimeMs: number;
  avgCpuTimeMs: number;
  avgDbTimeMs: number;
  totalResponseTimeMs: number;
  dbReads: number;
  dbChanges: number;
}

/** USERWORKLOAD — user statistics */
export interface UserWorkloadAggregate {
  user: string;
  accountType: "DIALOG" | "BATCH" | "RFC" | "SERVICE";
  steps: number;
  avgResponseTimeMs: number;
  avgCpuTimeMs: number;
  avgDbTimeMs: number;
  totalResponseTimeMs: number;
  distinctTransactions: number;
}

/** USERTCODE — user × transaction cross-tab */
export interface UserTransactionAggregate {
  user: string;
  tcode: string;
  steps: number;
  avgResponseTimeMs: number;
  totalResponseTimeMs: number;
}

/** TIMES — hourly (or slot) time profile */
export interface TimeSlotAggregate {
  /** Hour 0–23 for daily, or slot label */
  slot: string;
  hour: number;
  steps: number;
  avgResponseTimeMs: number;
  avgDbTimeMs: number;
  dialogSteps: number;
  backgroundSteps: number;
}

/** RFCCLNT / RFCSRVR destination stats */
export interface RfcAggregate {
  direction: "CLIENT" | "SERVER";
  destination: string;
  functionModule: string;
  calls: number;
  avgExecutionTimeMs: number;
  avgRemoteTimeMs: number;
  errors: number;
}

/** HITLIST_RESPTIME / HITLIST_DATABASE */
export interface HitlistEntry {
  kind: "RESPTIME" | "DATABASE";
  user: string;
  tcode: string;
  report: string;
  responseTimeMs: number;
  dbTimeMs: number;
  cpuTimeMs: number;
  timestamp: string;
  instance: string;
}

export interface WorkloadOverview {
  query: WorkloadQuery;
  connection: ConnectionInfo;
  collectedAt: string;
  taskTypes: TaskTypeAggregate[];
  totals: {
    steps: number;
    avgResponseTimeMs: number;
    avgCpuTimeMs: number;
    avgDbTimeMs: number;
    dialogUsers: number;
    distinctTransactions: number;
  };
}

export interface WorkloadBundle {
  overview: WorkloadOverview;
  transactions: TransactionAggregate[];
  users: UserWorkloadAggregate[];
  userTransactions: UserTransactionAggregate[];
  timeProfile: TimeSlotAggregate[];
  rfc: RfcAggregate[];
  hitlistResponse: HitlistEntry[];
  hitlistDatabase: HitlistEntry[];
}

export interface SapWorkloadProvider {
  getConnectionInfo(): ConnectionInfo;
  getOverview(query: WorkloadQuery): Promise<WorkloadOverview>;
  getTransactions(query: WorkloadQuery): Promise<TransactionAggregate[]>;
  getUsers(query: WorkloadQuery): Promise<UserWorkloadAggregate[]>;
  getUserTransactions(query: WorkloadQuery): Promise<UserTransactionAggregate[]>;
  getTimeProfile(query: WorkloadQuery): Promise<TimeSlotAggregate[]>;
  getRfc(query: WorkloadQuery): Promise<RfcAggregate[]>;
  getHitlist(
    query: WorkloadQuery,
    kind: "RESPTIME" | "DATABASE",
  ): Promise<HitlistEntry[]>;
  getBundle(query: WorkloadQuery): Promise<WorkloadBundle>;
}
