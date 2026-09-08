import type {
  ConnectionInfo,
  HitlistEntry,
  RfcAggregate,
  SapWorkloadProvider,
  TimeSlotAggregate,
  TransactionAggregate,
  UserTransactionAggregate,
  UserWorkloadAggregate,
  WorkloadBundle,
  WorkloadOverview,
  WorkloadQuery,
} from "./types";

/**
 * Live SAP RFC provider stub.
 *
 * In production this would call the SCSM_NW_WORKLOAD interface
 * (SAP Note 1053634), typically:
 *   - SWNC_GET_DIRECTORY_FRAME
 *   - SWNC_GET_AGGREGATES_FRAME  (or SWNC_COLLECTOR_GET_AGGREGATES)
 *   - SWNC_GET_SNAPSHOT_FRAME / SWNC_GET_STATRECS_FRAME for STAD detail
 *
 * Node.js connectors commonly used:
 *   - node-rfc (SAP NWRFC SDK)
 *   - A middleware layer (SAP Cloud Connector + on-prem RFC)
 *
 * This stub fails loudly when selected so misconfiguration is obvious.
 * Wire `invokeAggregates()` to your RFC client when credentials + SDK are available.
 */
export class RfcSapWorkloadProvider implements SapWorkloadProvider {
  getConnectionInfo(): ConnectionInfo {
    return {
      mode: "rfc",
      systemId: process.env.SAP_SYSTEM_ID ?? "???",
      instance: process.env.SAP_INSTANCE ?? "TOTAL",
      host: process.env.SAP_ASHOST,
      client: process.env.SAP_CLIENT,
      description:
        "RFC mode selected. Install SAP NWRFC SDK + node-rfc and implement invokeAggregates().",
    };
  }

  private ensureConfigured(): never {
    const required = [
      "SAP_ASHOST",
      "SAP_SYSNR",
      "SAP_CLIENT",
      "SAP_USER",
      "SAP_PASSWD",
    ] as const;
    const missing = required.filter((k) => !process.env[k]);
    throw new Error(
      [
        "SAP RFC provider is not fully configured.",
        missing.length
          ? `Missing env: ${missing.join(", ")}.`
          : "Credentials present, but NWRFC invoke is not implemented in this slice.",
        "Use SAP_PROVIDER=mock (default) for demo data, or implement RfcSapWorkloadProvider.invokeAggregates() with node-rfc calling SWNC_COLLECTOR_GET_AGGREGATES / SWNC_GET_AGGREGATES_FRAME.",
        "Tables to map: TASKTYPE, TCDET, USERWORKLOAD, USERTCODE, TIMES, RFCCLNT, RFCSRVR, HITLIST_RESPTIME, HITLIST_DATABASE.",
      ].join(" "),
    );
  }

  /**
   * Intended call shape for SWNC_COLLECTOR_GET_AGGREGATES:
   *   COMPONENT = instance or 'TOTAL'
   *   ASSIGNDSYS = system id
   *   PERIODTYPE = D|W|M
   *   PERIODSTRT = YYYYMMDD
   *   FACTOR = 1000 (ms)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected async invokeAggregates(_query: WorkloadQuery): Promise<never> {
    return this.ensureConfigured();
  }

  async getOverview(query: WorkloadQuery): Promise<WorkloadOverview> {
    return await this.invokeAggregates(query);
  }

  async getTransactions(query: WorkloadQuery): Promise<TransactionAggregate[]> {
    return await this.invokeAggregates(query);
  }

  async getUsers(query: WorkloadQuery): Promise<UserWorkloadAggregate[]> {
    return await this.invokeAggregates(query);
  }

  async getUserTransactions(
    query: WorkloadQuery,
  ): Promise<UserTransactionAggregate[]> {
    return await this.invokeAggregates(query);
  }

  async getTimeProfile(query: WorkloadQuery): Promise<TimeSlotAggregate[]> {
    return await this.invokeAggregates(query);
  }

  async getRfc(query: WorkloadQuery): Promise<RfcAggregate[]> {
    return await this.invokeAggregates(query);
  }

  async getHitlist(
    query: WorkloadQuery,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _kind: "RESPTIME" | "DATABASE",
  ): Promise<HitlistEntry[]> {
    return await this.invokeAggregates(query);
  }

  async getBundle(query: WorkloadQuery): Promise<WorkloadBundle> {
    return await this.invokeAggregates(query);
  }
}
