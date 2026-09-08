# ST03 Lens

Pull SAP S/4 usage and workload statistics in the shape of **ST03N** (Workload Monitor), using the same aggregates the ABAP statistics collector exposes.

## What this covers

ST03N views mapped in this app:

| UI section | ST03N / SWNC aggregate |
|---|---|
| Workload overview | `TASKTYPE` |
| Transaction profile | `TCDET` |
| User workload | `USERWORKLOAD` |
| User × transaction | `USERTCODE` |
| Time profile | `TIMES` |
| RFC profile | `RFCCLNT` / `RFCSRVR` |
| Hitlists | `HITLIST_RESPTIME` / `HITLIST_DATABASE` |

SAP function modules this is designed against (SAP Note **1053634**, function group `SCSM_NW_WORKLOAD`):

- `SWNC_COLLECTOR_GET_AGGREGATES` / `SWNC_GET_AGGREGATES_FRAME`
- `SWNC_GET_DIRECTORY_FRAME`
- `SWNC_GET_STATRECS_FRAME` (STAD-level detail; not yet wired)

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:43145](http://127.0.0.1:43145).

By default the app uses a **mock provider** with realistic S/4 transaction mix (VA01, ME21N, FB50, HTTP, background jobs, etc.) so you can explore without an SAP connection.

## API

| Endpoint | Description |
|---|---|
| `GET /api/workload/meta` | Connection mode + supported aggregates |
| `GET /api/workload` | Workload overview (`TASKTYPE` + totals) |
| `GET /api/workload/bundle` | Full ST03N-shaped bundle |

Query params (all optional):

- `systemId` — default `S4D` or `SAP_SYSTEM_ID`
- `instance` — default `TOTAL`
- `periodType` — `D` \| `W` \| `M`
- `periodStart` — `YYYY-MM-DD`

Example:

```bash
curl "http://127.0.0.1:43145/api/workload/bundle?periodType=D&systemId=S4D"
```

## Connect a live S/4 system

1. Set environment variables:

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

2. Install the SAP NetWeaver RFC SDK and [`node-rfc`](https://github.com/SAP/node-rfc).

3. Implement `invokeAggregates()` in `src/lib/sap/rfc-provider.ts` to call `SWNC_COLLECTOR_GET_AGGREGATES` (or `SWNC_GET_AGGREGATES_FRAME`) and map the tables listed above into the domain types in `src/lib/sap/types.ts`.

Until that wiring is done, selecting `SAP_PROVIDER=rfc` returns a clear configuration error instead of silent empty data.

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Recharts.
