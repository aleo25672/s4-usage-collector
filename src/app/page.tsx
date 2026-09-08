import { WorkloadDashboard } from "@/components/workload-dashboard";
import {
  defaultPeriodStart,
  getSapProvider,
  parsePeriodType,
} from "@/lib/sap";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(
  value: string | string[] | undefined,
  fallback: string,
): string {
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const periodType = parsePeriodType(first(params.periodType, "D"));
  const query = {
    systemId: first(params.systemId, process.env.SAP_SYSTEM_ID ?? "S4D"),
    instance: first(params.instance, process.env.SAP_INSTANCE ?? "TOTAL"),
    periodType,
    periodStart: first(params.periodStart, defaultPeriodStart(periodType)),
  };

  let initialBundle = null;
  let initialError: string | null = null;
  try {
    initialBundle = await getSapProvider().getBundle(query);
  } catch (e) {
    initialError = e instanceof Error ? e.message : "Failed to load workload";
  }

  return (
    <main className="flex-1">
      <WorkloadDashboard
        initialQuery={query}
        initialBundle={initialBundle}
        initialError={initialError}
      />
    </main>
  );
}
