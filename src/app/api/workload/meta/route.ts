import { NextResponse } from "next/server";
import { getSapProvider } from "@/lib/sap";

export async function GET() {
  const connection = getSapProvider().getConnectionInfo();
  return NextResponse.json({
    connection,
    capabilities: {
      aggregates: [
        "TASKTYPE",
        "TCDET",
        "USERWORKLOAD",
        "USERTCODE",
        "TIMES",
        "RFCCLNT",
        "RFCSRVR",
        "HITLIST_RESPTIME",
        "HITLIST_DATABASE",
      ],
      sapFunctions: [
        "SWNC_COLLECTOR_GET_AGGREGATES",
        "SWNC_GET_AGGREGATES_FRAME",
        "SWNC_GET_DIRECTORY_FRAME",
        "SWNC_GET_STATRECS_FRAME",
      ],
      note: "SAP Note 1053634 — SCSM_NW_WORKLOAD interface for reading ABAP statistics (ST03N)",
    },
  });
}
