import { NextResponse } from "next/server";
import { getSapProvider } from "@/lib/sap";

export async function GET() {
  const mode = (process.env["SAP_PROVIDER"] ?? "mock").trim().toLowerCase();
  const connection = getSapProvider().getConnectionInfo();
  return NextResponse.json({
    connection,
    env: {
      SAP_PROVIDER: mode,
      SAP_HTTP_BASE_URL: process.env["SAP_HTTP_BASE_URL"] ? "(set)" : "(missing)",
      SAP_CLIENT: process.env["SAP_CLIENT"] ?? null,
      SAP_SYSTEM_ID: process.env["SAP_SYSTEM_ID"] ?? null,
      SAP_USER: process.env["SAP_USER"] ? "(set)" : "(missing)",
    },
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
