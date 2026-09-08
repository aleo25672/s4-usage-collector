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

## API

| Endpoint | Description |
|---|---|
| `GET /api/workload/meta` | Connection mode + supported aggregates |
| `GET /api/workload` | Workload overview (`TASKTYPE` + totals) |
| `GET /api/workload/bundle` | Full ST03N-shaped JSON bundle |

Query params: `systemId`, `instance`, `periodType` (`D`\|`W`\|`M`), `periodStart` (`YYYY-MM-DD`).

## Connect a live S/4 system (Node RFC)

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

Prefer the **ABAP report** if you want extracts without exposing RFC to an external host.

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Recharts, plus a `tsx` CLI and an on-stack ABAP report.
