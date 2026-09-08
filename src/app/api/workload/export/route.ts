import { NextResponse } from "next/server";
import { getSapProvider, queryFromSearchParams } from "@/lib/sap";
import { toCsv } from "@/cli/csv";

/**
 * Download a single ST03N aggregate as CSV.
 * GET /api/workload/export?table=tasktype&periodType=D&...
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const table = (searchParams.get("table") ?? "tasktype").toLowerCase();
    const query = queryFromSearchParams(searchParams);
    const bundle = await getSapProvider().getBundle(query);

    const map: Record<
      string,
      { headers: string[]; rows: Array<Record<string, unknown>>; filename: string }
    > = {
      tasktype: {
        filename: "tasktype.csv",
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
        rows: bundle.overview.taskTypes as unknown as Array<
          Record<string, unknown>
        >,
      },
      tcdet: {
        filename: "tcdet.csv",
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
      userworkload: {
        filename: "userworkload.csv",
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
      usertcode: {
        filename: "usertcode.csv",
        headers: [
          "user",
          "tcode",
          "steps",
          "avgResponseTimeMs",
          "totalResponseTimeMs",
        ],
        rows: bundle.userTransactions as unknown as Array<
          Record<string, unknown>
        >,
      },
      times: {
        filename: "times.csv",
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
      rfc: {
        filename: "rfc.csv",
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
      hitlist_resptime: {
        filename: "hitlist_resptime.csv",
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
        rows: bundle.hitlistResponse as unknown as Array<
          Record<string, unknown>
        >,
      },
      hitlist_database: {
        filename: "hitlist_database.csv",
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
        rows: bundle.hitlistDatabase as unknown as Array<
          Record<string, unknown>
        >,
      },
    };

    const selected = map[table];
    if (!selected) {
      return NextResponse.json(
        {
          error: `Unknown table '${table}'`,
          tables: Object.keys(map),
        },
        { status: 400 },
      );
    }

    const body = toCsv(selected.headers, selected.rows);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${selected.filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
