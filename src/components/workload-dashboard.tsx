"use client";

import { useMemo, useRef, useState } from "react";
import {
  Activity,
  Clock3,
  Database,
  Radio,
  RefreshCw,
  Server,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCompact, formatDateTime, formatMs, formatNumber, periodLabel } from "@/lib/format";
import type {
  PeriodType,
  WorkloadBundle,
  WorkloadQuery,
} from "@/lib/sap/types";

function queryString(q: WorkloadQuery): string {
  const p = new URLSearchParams({
    systemId: q.systemId,
    instance: q.instance,
    periodType: q.periodType,
    periodStart: q.periodStart,
  });
  return p.toString();
}

function Metric({
  label,
  value,
  hint,
  delay,
}: {
  label: string;
  value: string;
  hint?: string;
  delay: number;
}) {
  return (
    <div
      className="animate-rise border-b border-border/80 pb-3 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-5 last:border-0 last:pr-0"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-mono text-2xl font-medium tracking-tight text-ink sm:text-[1.7rem]">
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}

export function WorkloadDashboard({
  initialQuery,
  initialBundle,
  initialError,
}: {
  initialQuery: WorkloadQuery;
  initialBundle: WorkloadBundle | null;
  initialError: string | null;
}) {
  const [periodType, setPeriodType] = useState<PeriodType>(
    initialQuery.periodType,
  );
  const [periodStart, setPeriodStart] = useState(initialQuery.periodStart);
  const [systemId, setSystemId] = useState(initialQuery.systemId);
  const [instance, setInstance] = useState(initialQuery.instance);
  const [bundle, setBundle] = useState<WorkloadBundle | null>(initialBundle);
  const [error, setError] = useState<string | null>(initialError);
  const [isPending, setIsPending] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(Boolean(initialBundle));
  const [statusLine, setStatusLine] = useState<string | null>(null);
  const requestId = useRef(0);

  const draftQuery: WorkloadQuery = useMemo(
    () => ({ systemId, instance, periodType, periodStart }),
    [systemId, instance, periodType, periodStart],
  );

  async function loadData(q: WorkloadQuery = draftQuery) {
    const id = ++requestId.current;
    setIsPending(true);
    setError(null);
    setStatusLine(`Loading ${q.systemId}/${q.instance} · ${q.periodType} ${q.periodStart}…`);
    try {
      const res = await fetch(`/api/workload/bundle?${queryString(q)}`);
      const json = await res.json();
      if (id !== requestId.current) return;
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to load workload data");
      }
      setBundle(json as WorkloadBundle);
      setLoadedOnce(true);
      setError(null);
      const mode = (json as WorkloadBundle).overview?.connection?.mode ?? "?";
      setStatusLine(
        `Loaded via ${mode} · ${formatNumber((json as WorkloadBundle).overview.totals.steps)} steps`,
      );
    } catch (e) {
      if (id !== requestId.current) return;
      const message = e instanceof Error ? e.message : "Failed to load";
      setError(message);
      setStatusLine(null);
    } finally {
      if (id === requestId.current) {
        setIsPending(false);
      }
    }
  }

  const maxTaskSteps = bundle
    ? Math.max(...bundle.overview.taskTypes.map((t) => t.steps), 1)
    : 1;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="animate-rise flex flex-col gap-6 border-b border-border/70 pb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-heading text-4xl tracking-tight text-ink sm:text-5xl">
              ST03 Lens
            </p>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Usage and workload statistics from SAP S/4 — the same aggregates
              ST03N shows via the SWNC collector.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {bundle ? (
              <Badge
                variant="secondary"
                className="gap-1.5 rounded-md px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide"
              >
                <span
                  className={`size-1.5 rounded-full ${
                    bundle.overview.connection.mode === "mock"
                      ? "animate-pulse-soft bg-signal"
                      : "bg-chart-3"
                  }`}
                />
                {bundle.overview.connection.mode === "mock"
                  ? "Mock provider"
                  : bundle.overview.connection.mode === "http"
                    ? "HTTP · live S/4"
                    : "RFC provider"}
              </Badge>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadData()}
              disabled={isPending}
              className="gap-2"
            >
              <RefreshCw
                className={`size-3.5 ${isPending ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
            System ID
            <Input
              value={systemId}
              onChange={(e) => setSystemId(e.target.value.toUpperCase())}
              className="font-mono bg-card/70"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
            Instance
            <Input
              value={instance}
              onChange={(e) => setInstance(e.target.value)}
              className="font-mono bg-card/70"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
            Period type
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value as PeriodType)}
              className="h-8 w-full rounded-lg border border-input bg-card/70 px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="D">Day (D)</option>
              <option value="W">Week (W)</option>
              <option value="M">Month (M)</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">
            Period start
            <Input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="bg-card/70"
            />
          </label>
          <div className="flex items-end gap-2">
            <div className="w-full rounded-md border border-border/80 bg-card/60 px-3 py-2 text-xs text-muted-foreground">
              <div className="font-medium text-foreground">
                {periodLabel(periodType, periodStart)}
              </div>
              <div className="mt-0.5 font-mono">
                {systemId} · {instance}
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              className="shrink-0"
              onClick={() => void loadData()}
              disabled={isPending}
            >
              {isPending ? "Loading…" : "Load"}
            </Button>
          </div>
        </div>
        {statusLine ? (
          <p className="font-mono text-xs text-muted-foreground">{statusLine}</p>
        ) : null}
      </header>

      {error ? (
        <div
          role="alert"
          className="animate-rise rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      {bundle && bundle.overview.totals.steps === 0 ? (
        <div
          role="status"
          className="animate-rise rounded-md border border-border/80 bg-card/80 px-4 py-3 text-sm text-muted-foreground"
        >
          No aggregate steps for this period. Day rollups are often only
          available for <span className="font-medium text-foreground">yesterday</span>{" "}
          (and older) after the ST03N collector runs — try the previous day or
          confirm data exists in ST03N Workload for the same selection.
        </div>
      ) : null}

      {!bundle && !error ? (
        <div className="animate-rise space-y-3 py-16 text-center text-muted-foreground">
          <Radio className="mx-auto size-6 animate-pulse-soft text-steel" />
          <p>Loading ST03N aggregates…</p>
        </div>
      ) : null}

      {bundle ? (
        <>
          <section
            aria-label="Workload overview"
            className="animate-rise grid gap-6"
            style={{ animationDelay: "60ms" }}
          >
            <div className="flex items-center gap-2 text-steel">
              <Activity className="size-4" />
              <h2 className="font-heading text-2xl text-ink">Workload overview</h2>
            </div>
            <div className="grid gap-6 rounded-xl border border-border/70 bg-card/75 p-5 shadow-[0_1px_0_rgba(20,32,41,0.04)] backdrop-blur-sm sm:grid-cols-2 lg:grid-cols-5 lg:gap-0 lg:divide-x lg:divide-border/70 lg:p-6">
              <Metric
                label="Dialog steps"
                value={formatCompact(bundle.overview.totals.steps)}
                hint="All task types"
                delay={80}
              />
              <Metric
                label="Avg response"
                value={formatMs(bundle.overview.totals.avgResponseTimeMs)}
                hint="Across collected steps"
                delay={140}
              />
              <Metric
                label="Avg DB time"
                value={formatMs(bundle.overview.totals.avgDbTimeMs)}
                hint="Database portion"
                delay={200}
              />
              <Metric
                label="Dialog users"
                value={formatNumber(bundle.overview.totals.dialogUsers)}
                hint="Active accounts"
                delay={260}
              />
              <Metric
                label="Transactions"
                value={formatNumber(bundle.overview.totals.distinctTransactions)}
                hint="Distinct TCODEs / reports"
                delay={320}
              />
            </div>

            <div className="overflow-hidden rounded-xl border border-border/70 bg-card/75">
              <div className="border-b border-border/70 px-4 py-3 text-sm font-medium text-ink">
                Task types
                <span className="ml-2 font-normal text-muted-foreground">
                  ST03N · TASKTYPE aggregate
                </span>
              </div>
              <div className="divide-y divide-border/60">
                {bundle.overview.taskTypes.map((t, i) => (
                  <div
                    key={t.taskType}
                    className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3 px-4 py-2.5 sm:grid-cols-[9rem_1fr_repeat(4,minmax(0,5.5rem))]"
                  >
                    <div className="font-mono text-xs font-medium tracking-wide text-steel">
                      {t.taskType}
                    </div>
                    <div className="h-2 overflow-hidden rounded-sm bg-haze">
                      <div
                        className="animate-bar h-full rounded-sm bg-steel"
                        style={{
                          width: `${(t.steps / maxTaskSteps) * 100}%`,
                          animationDelay: `${120 + i * 40}ms`,
                        }}
                      />
                    </div>
                    <div className="text-right font-mono text-xs tabular-nums">
                      {formatNumber(t.steps)}
                    </div>
                    <div className="hidden text-right font-mono text-xs text-muted-foreground sm:block">
                      {formatMs(t.avgResponseTimeMs)}
                    </div>
                    <div className="hidden text-right font-mono text-xs text-muted-foreground sm:block">
                      CPU {formatMs(t.avgCpuTimeMs)}
                    </div>
                    <div className="hidden text-right font-mono text-xs text-muted-foreground sm:block">
                      DB {formatMs(t.avgDbTimeMs)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <Tabs defaultValue="transactions" className="animate-rise gap-4" style={{ animationDelay: "120ms" }}>
            <TabsList variant="line" className="w-full flex-wrap justify-start gap-1">
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="time">Time profile</TabsTrigger>
              <TabsTrigger value="rfc">RFC</TabsTrigger>
              <TabsTrigger value="hitlist">Hitlists</TabsTrigger>
            </TabsList>

            <TabsContent value="transactions" className="rounded-xl border border-border/70 bg-card/75">
              <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3 text-sm">
                <Server className="size-4 text-steel" />
                <span className="font-medium">Transaction profile</span>
                <span className="text-muted-foreground">TCDET</span>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>TCODE</TableHead>
                      <TableHead>Report</TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead className="text-right">Steps</TableHead>
                      <TableHead className="text-right">Avg resp.</TableHead>
                      <TableHead className="text-right">Avg DB</TableHead>
                      <TableHead className="text-right">Total resp.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bundle.transactions.map((t) => (
                      <TableRow key={`${t.tcode}-${t.report}`}>
                        <TableCell className="font-mono text-xs font-medium">
                          {t.tcode}
                        </TableCell>
                        <TableCell className="max-w-[14rem] truncate font-mono text-xs text-muted-foreground">
                          {t.report}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {t.taskType}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums">
                          {formatNumber(t.steps)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums">
                          {formatMs(t.avgResponseTimeMs)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums">
                          {formatMs(t.avgDbTimeMs)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums">
                          {formatCompact(t.totalResponseTimeMs)} ms
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="users" className="space-y-4">
              <div className="rounded-xl border border-border/70 bg-card/75">
                <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3 text-sm">
                  <Users className="size-4 text-steel" />
                  <span className="font-medium">User workload</span>
                  <span className="text-muted-foreground">USERWORKLOAD</span>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Steps</TableHead>
                        <TableHead className="text-right">Avg resp.</TableHead>
                        <TableHead className="text-right">Avg DB</TableHead>
                        <TableHead className="text-right">TCODEs</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bundle.users.map((u) => (
                        <TableRow key={u.user}>
                          <TableCell className="font-mono text-xs font-medium">
                            {u.user}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {u.accountType}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums">
                            {formatNumber(u.steps)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums">
                            {formatMs(u.avgResponseTimeMs)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums">
                            {formatMs(u.avgDbTimeMs)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums">
                            {u.distinctTransactions}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <div className="rounded-xl border border-border/70 bg-card/75">
                <div className="border-b border-border/70 px-4 py-3 text-sm">
                  <span className="font-medium">User × transaction</span>
                  <span className="ml-2 text-muted-foreground">USERTCODE</span>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>TCODE</TableHead>
                        <TableHead className="text-right">Steps</TableHead>
                        <TableHead className="text-right">Avg resp.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bundle.userTransactions.slice(0, 40).map((row) => (
                        <TableRow key={`${row.user}-${row.tcode}`}>
                          <TableCell className="font-mono text-xs">
                            {row.user}
                          </TableCell>
                          <TableCell className="font-mono text-xs font-medium">
                            {row.tcode}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums">
                            {formatNumber(row.steps)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs tabular-nums">
                            {formatMs(row.avgResponseTimeMs)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="time" className="rounded-xl border border-border/70 bg-card/75 p-4">
              <div className="mb-4 flex items-center gap-2 text-sm">
                <Clock3 className="size-4 text-steel" />
                <span className="font-medium">Time profile</span>
                <span className="text-muted-foreground">TIMES · steps by hour</span>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bundle.timeProfile} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#c5d4d9" vertical={false} />
                    <XAxis
                      dataKey="slot"
                      tick={{ fontSize: 11, fill: "#4d606a" }}
                      interval={2}
                    />
                    <YAxis tick={{ fontSize: 11, fill: "#4d606a" }} />
                    <Tooltip
                      contentStyle={{
                        background: "#f7fafb",
                        border: "1px solid #c5d4d9",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="dialogSteps"
                      name="Dialog"
                      stackId="a"
                      fill="#1f4d5c"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      dataKey="backgroundSteps"
                      name="Background / other"
                      stackId="a"
                      fill="#8aa0a8"
                      radius={[2, 2, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>

            <TabsContent value="rfc" className="rounded-xl border border-border/70 bg-card/75">
              <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3 text-sm">
                <Radio className="size-4 text-steel" />
                <span className="font-medium">RFC profile</span>
                <span className="text-muted-foreground">RFCCLNT / RFCSRVR</span>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Direction</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>Function module</TableHead>
                      <TableHead className="text-right">Calls</TableHead>
                      <TableHead className="text-right">Avg exec.</TableHead>
                      <TableHead className="text-right">Avg remote</TableHead>
                      <TableHead className="text-right">Errors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bundle.rfc.map((r) => (
                      <TableRow
                        key={`${r.direction}-${r.destination}-${r.functionModule}`}
                      >
                        <TableCell className="font-mono text-xs">
                          {r.direction}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {r.destination}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-medium">
                          {r.functionModule}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums">
                          {formatNumber(r.calls)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums">
                          {formatMs(r.avgExecutionTimeMs)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums">
                          {formatMs(r.avgRemoteTimeMs)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums">
                          {r.errors}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="hitlist" className="space-y-4">
              {(
                [
                  ["Response time hitlist", "HITLIST_RESPTIME", bundle.hitlistResponse],
                  ["Database hitlist", "HITLIST_DATABASE", bundle.hitlistDatabase],
                ] as const
              ).map(([title, sapName, rows]) => (
                <div
                  key={sapName}
                  className="rounded-xl border border-border/70 bg-card/75"
                >
                  <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3 text-sm">
                    <Database className="size-4 text-steel" />
                    <span className="font-medium">{title}</span>
                    <span className="text-muted-foreground">{sapName}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>TCODE</TableHead>
                          <TableHead>Report</TableHead>
                          <TableHead className="text-right">Resp.</TableHead>
                          <TableHead className="text-right">DB</TableHead>
                          <TableHead>Instance</TableHead>
                          <TableHead>When</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((h, i) => (
                          <TableRow key={`${sapName}-${i}`}>
                            <TableCell className="font-mono text-xs">
                              {h.user}
                            </TableCell>
                            <TableCell className="font-mono text-xs font-medium">
                              {h.tcode}
                            </TableCell>
                            <TableCell className="max-w-[12rem] truncate font-mono text-xs text-muted-foreground">
                              {h.report}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs tabular-nums">
                              {formatMs(h.responseTimeMs)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs tabular-nums">
                              {formatMs(h.dbTimeMs)}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {h.instance}
                            </TableCell>
                            <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                              {formatDateTime(h.timestamp)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>

          <footer className="animate-rise border-t border-border/70 pt-6 text-xs leading-relaxed text-muted-foreground">
            <p>
              Data source:{" "}
              <span className="font-medium text-foreground">
                {bundle.overview.connection.description}
              </span>
            </p>
            <p className="mt-1 font-mono">
              Collected {formatDateTime(bundle.overview.collectedAt)}
              {loadedOnce && isPending ? " · refreshing…" : ""}
            </p>
            <p className="mt-3 max-w-3xl">
              ST03N GUI export is interactive only (current ALV → spreadsheet).
              For bulk/scheduled extracts use{" "}
              <span className="font-mono text-foreground">npm run extract</span>{" "}
              or ABAP report{" "}
              <span className="font-mono text-foreground">ZST03N_EXTRACT</span>
              . Example CSV:{" "}
              <a
                className="text-steel underline-offset-2 hover:underline"
                href={`/api/workload/export?table=tcdet&${queryString(draftQuery)}`}
              >
                download transaction profile
              </a>
              .
            </p>
          </footer>
        </>
      ) : null}
    </div>
  );
}
