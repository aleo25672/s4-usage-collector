# ST03 Lens

Pull SAP S/4 usage and workload statistics in the shape of **ST03N** (Workload Monitor), using the same aggregates the ABAP statistics collector exposes.

## Does ST03N already provide download?

**Interactive only.** From ST03N you can export the *currently displayed* ALV (List → Export / spreadsheet). That is fine for ad-hoc analysis, but it is not a scheduled, multi-table bulk extract.

For automation use one of:

| Path | When to use |
|---|---|
| **Node.js CLI** (`npm run extract`) | Pipelines, laptops, this dashboard’s mock/RFC provider |
| **ABAP report** [`abap/zst03n_extract.prog.abap`](abap/zst03n_extract.prog.abap) | On-stack extract, `SM36` jobs, no external RFC SDK |
| ST03N GUI export | One-off spreadsheet from a single view |

Both extractors call (or mirror) `SWNC_COLLECTOR_GET_AGGREGATES` / `SWNC_GET_AGGREGATES_FRAME` (SAP Note **1053634**).

## What this covers

| UI / CSV | ST03N / SWNC aggregate |
|---|---|
| Workload overview | `TASKTYPE` |
| Transaction profile | `TCDET` |
| User workload | `USERWORKLOAD` |
| User × transaction | `USERTCODE` |
| Time profile | `TIMES` |
| RFC profile | `RFCCLNT` / `RFCSRVR` |
| Hitlists | `HITLIST_RESPTIME` / `HITLIST_DATABASE` |

## Run the web app

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43145](http://127.0.0.1:43145).

Default provider is **mock** (realistic S/4 mix) so you can explore without SAP credentials.

## Node.js extract (CSV)

```bash
npm run extract -- --periodType D --periodStart 2026-09-08 --out ./output/demo --json
```

Writes `tasktype.csv`, `tcdet.csv`, `userworkload.csv`, `usertcode.csv`, `times.csv`, `rfc.csv`, hitlists, and `manifest.csv` under the output directory.

```bash
npm run extract -- --help
```

## ABAP extract

See [abap/README.md](abap/README.md). The `abap/` folder is abapGit-ready (`.prog.abap` + `.prog.xml`, starting folder `/abap/` via `.abapgit.xml`). Pull into package `ZST03N` with abapGit, or paste into `SE38` as `ZST03N_EXTRACT`.

### HTTP / OData (optional)

To expose the same aggregates over HTTPS for the Node app, follow **[abap/HTTP.md](abap/HTTP.md)** (ICF handler `ZCL_ST03N_HTTP_HANDLER` → `/sap/bc/zst03n/workload`). That guide also covers a later SEGW OData path.

## API

| Endpoint | Description |
|---|---|
| `GET /api/workload/meta` | Connection mode + supported aggregates |
| `GET /api/workload` | Workload overview (`TASKTYPE` + totals) |
| `GET /api/workload/bundle` | Full ST03N-shaped JSON bundle |

Query params: `systemId`, `instance`, `periodType` (`D`\|`W`\|`M`), `periodStart` (`YYYY-MM-DD`).

## Connect a live S/4 system

### HTTP (recommended — uses your SICF service)

1. Copy `.env.example` → `.env.local`
2. Set:

```bash
SAP_PROVIDER=http
SAP_HTTP_BASE_URL=http://10.0.0.189:50000/sap/bc/zst03n/workload
SAP_CLIENT=100
SAP_SYSTEM_ID=S4H
SAP_INSTANCE=TOTAL
SAP_USER=...
SAP_PASSWD=...
```

3. Restart `npm run dev`
4. In the UI pick **period start = yesterday** (day aggregates for “today” are often empty), System `S4H`, Instance `TOTAL`, click **Load**

The Next.js API calls your ABAP handler; the dashboard maps the JSON into the same charts/tables as mock mode.

Re-activate the enriched `ZCL_ST03N_HTTP_HANDLER` from git so users / USERTCODE / RFC / hitlists are included in the JSON (not only `meta` counts).

### RFC (optional)

```bash
SAP_PROVIDER=rfc
SAP_ASHOST=your-app-server
SAP_SYSNR=00
SAP_CLIENT=100
SAP_USER=...
SAP_PASSWD=...
SAP_SYSTEM_ID=PRD
SAP_INSTANCE=TOTAL
```

Install the SAP NetWeaver RFC SDK and [`node-rfc`](https://github.com/SAP/node-rfc), then implement `invokeAggregates()` in `src/lib/sap/rfc-provider.ts`. Until that is wired, `SAP_PROVIDER=rfc` fails loudly instead of returning empty data.

Prefer the **ABAP report** or **HTTP ICF** path if you want extracts without exposing RFC to an external host.

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Recharts, plus a `tsx` CLI and an on-stack ABAP report.
