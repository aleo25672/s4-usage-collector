import { NextResponse } from "next/server";
import JSZip from "jszip";
import { buildCsvFiles, toCsv, type CsvTableId } from "@/cli/csv";
import { getSapProvider, queryFromSearchParams } from "@/lib/sap";

export const dynamic = "force-dynamic";

/**
 * Download ST03N aggregates as CSV (same files as ABAP extract / CLI).
 *
 * GET /api/workload/export?table=tasktype&periodType=D&...
 * GET /api/workload/export?table=all&...  → ZIP of all CSVs
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const table = (searchParams.get("table") ?? "all").toLowerCase();
    const query = queryFromSearchParams(searchParams);
    const bundle = await getSapProvider().getBundle(query);
    const files = buildCsvFiles(bundle);

    if (table === "all") {
      const zip = new JSZip();
      for (const spec of files) {
        zip.file(spec.filename, toCsv(spec.headers, spec.rows));
      }
      const stamp = query.periodStart.replace(/-/g, "");
      const filename = `st03n_${query.systemId}_${query.periodType}_${stamp}.zip`;
      const buffer = await zip.generateAsync({ type: "uint8array" });
      return new NextResponse(Buffer.from(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }

    const selected = files.find((f) => f.id === (table as CsvTableId));
    if (!selected) {
      return NextResponse.json(
        {
          error: `Unknown table '${table}'`,
          tables: ["all", ...files.map((f) => f.id)],
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
