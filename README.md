# ST03 Lens

Pull SAP S/4 **ST03N**-style usage and workload statistics (SWNC aggregates) via:

| Path | What it is |
|---|---|
| **Node.js web app** | Dashboard + CSV/ZIP download from the browser |
| **Node.js CLI** | `npm run extract` → CSV files (pipelines / scripts) |
| **ABAP report** `ZST03N_EXTRACT` | On-stack CSV extract (SE38 / SM36 jobs) |
| **ABAP HTTP** `ZCL_ST03N_HTTP_HANDLER` | SICF JSON service the web app calls live |

Both extractors call (or mirror) `SWNC_COLLECTOR_GET_AGGREGATES` (SAP Note **1053634**). ST03N GUI export is interactive only (one ALV at a time) — use this repo for bulk / scheduled / API access.

---

## What you get

| UI / CSV | ST03N / SWNC aggregate |
|---|---|
| Workload overview | `TASKTYPE` |
| Transaction profile | `TCDET` |
| User workload | `USERWORKLOAD` |
| User × transaction | `USERTCODE` |
| Time profile | `TIMES` |
| RFC profile | `RFCCLNT` / `RFCSRVR` |
| Hitlists | `HITLIST_RESPTIME` / `HITLIST_DATABASE` |

---

## Quick start (demo, no SAP)

```bash
git clone <your-repo-url> s4-usage-collector
cd s4-usage-collector
npm install
npm run dev
```

Open [http://127.0.0.1:43145](http://127.0.0.1:43145). Default provider is **mock** — explore charts without SAP credentials.

At the bottom of the dashboard, **Save as CSV** downloads the same files as the ABAP tool (single CSV or **All CSVs (ZIP)**).

---

## End-to-end: live S/4 + web app

Do these in order.

### A. Get the code

1. Clone this repository (GitHub or your Origin remote).
2. Keep the whole tree — abapGit needs `.abapgit.xml` + `abap/`.

```bash
git clone <your-repo-url> s4-usage-collector
cd s4-usage-collector
```

### B. Install ABAP objects (abapGit)

Repo layout: starting folder `/abap/` (see `.abapgit.xml`).

| Object | File | Role |
|---|---|---|
| Report `ZST03N_EXTRACT` | `abap/zst03n_extract.prog.abap` | CSV extract on S/4 |
| Class `ZCL_ST03N_HTTP_HANDLER` | `abap/zcl_st03n_http_handler.clas.abap` | JSON over HTTP (SICF) |

**Steps**

1. Install [abapGit](https://docs.abapgit.org) on the SAP system if needed.
2. `SE80` → create package **`ZST03N`** (or reuse an existing Z-package). Assign a transport if not `$TMP`.
3. abapGit → **New Online** (repo URL) or **New Offline** (zip of this repo).
4. Link to package `ZST03N`. Confirm starting folder **`/abap/`**.
5. **Pull** → activate:
   - `ZST03N_EXTRACT`
   - `ZCL_ST03N_HTTP_HANDLER`
6. If activation fails on structure fields (`FCODE`, `QUEUETI`, `DBP_TIME`, RFC `TARGET` / `FUNC_NAME`, …), open `SE11` for `SWNCAGGTASKTYPE`, `SWNCAGGTCDET`, etc., and align names to your `SAP_BASIS` release (same DDIC as ST03N).

**Without abapGit:** paste report source in `SE38` as `ZST03N_EXTRACT`; create class `ZCL_ST03N_HTTP_HANDLER` in `SE24` with interface `IF_HTTP_EXTENSION` and paste the class source. Details: [abap/README.md](abap/README.md).

**Authorizations (SAP)**

- Create/activate Z-objects in package `ZST03N`
- Read workload stats (roles that can run **ST03N**; often `S_TOOLS_EX` / Basis admin)
- Maintain **SICF** (next section)
- Technical user for HTTP: least privilege, read-only workload

### C. Create and activate the HTTP service (SICF)

Full walkthrough: [abap/HTTP.md](abap/HTTP.md). Summary:

1. Transaction **`SICF`** → Execute (F8).
2. Path: `default_host` → `sap` → `bc`.
3. Right-click `bc` → **New Sub-Element** → name **`zst03n`**.
4. Under `zst03n`, create child **`workload`**.
5. Open `workload` → **Handler List** → handler **`ZCL_ST03N_HTTP_HANDLER`** (order 1).
6. **Logon Data**: Basic / Alternative Logon (or your standard for internal tools).
7. **Save** → right-click **`workload`** → **Activate Service**.  
   Also activate parent **`zst03n`** if it is inactive.

Final path:

```text
/sap/bc/zst03n/workload
```

**Host / port (SMICM)**

- Transaction **`SMICM`** → **Goto → Services** — note HTTP vs HTTPS ports.
- Many S/4 demo systems use **HTTP** on port **50000** (`http://…:50000/…`), not HTTPS. Use the protocol that matches the service.

**Browser smoke test**

```text
http://<s4-host>:<port>/sap/bc/zst03n/workload?sap-client=100&periodType=D&periodStart=20260907&instance=TOTAL
```

Expect JSON with `query`, `taskTypes`, `transactions`, users, etc.  
Use **yesterday’s** date for day aggregates — “today” is often empty until the collector has run.

| Param | Example | Meaning |
|---|---|---|
| `periodType` | `D` / `W` / `M` | Day / week / month |
| `periodStart` | `20260907` or `2026-09-07` | Period start |
| `systemId` | `S4H` | Defaults to `SY-SYSID` |
| `instance` | `TOTAL` or e.g. `vhcals4hci_S4H_00` | ST03N instance |

### D. Run the Node.js web app against SAP

**Requirements:** Node.js **20+** (LTS recommended).

```bash
cd s4-usage-collector
npm install
cp .env.example .env.local
```

Edit **`.env.local`** (uncomment and set real values):

```bash
SAP_PROVIDER=http
SAP_HTTP_BASE_URL=http://10.0.0.189:50000/sap/bc/zst03n/workload
SAP_CLIENT=100
SAP_SYSTEM_ID=S4H
SAP_INSTANCE=TOTAL
SAP_USER=YOUR_USER
SAP_PASSWD=YOUR_PASSWORD
```

```bash
npm run dev
```

Open [http://127.0.0.1:43145](http://127.0.0.1:43145).

1. Set **System** / **Instance** / **Period** (prefer **yesterday** for day data).
2. Click **Load** — badge should show **HTTP**.
3. Scroll to **Save as CSV** → download one table or **All CSVs (ZIP)** (same columns as ABAP / CLI).

Production-style:

```bash
npm run build
npm start
```

### E. Optional: ABAP CSV on the stack

1. `SE38` → `ZST03N_EXTRACT` → Execute.
2. Component `TOTAL` (or instance), period type/start, output path.
3. Download CSVs to presentation server or write to app server + schedule via **SM36**.

See [abap/README.md](abap/README.md).

### F. Optional: Node CLI CSV

```bash
npm run extract -- --periodType D --periodStart 2026-09-07 --out ./output/live --json
```

Uses the same `SAP_PROVIDER` / env as the web app. Writes `tasktype.csv`, `tcdet.csv`, `userworkload.csv`, `usertcode.csv`, `times.csv`, `rfc.csv`, hitlists, `manifest.csv`.

```bash
npm run extract -- --help
```

---

## CSV from the web app

After data is available (mock always; HTTP after **Load**):

| Control | Result |
|---|---|
| **All CSVs (ZIP)** | One zip with every aggregate file |
| Per-table buttons | Single `.csv` download |

API (same query params as the dashboard):

```http
GET /api/workload/export?table=all&systemId=S4H&instance=TOTAL&periodType=D&periodStart=2026-09-07
GET /api/workload/export?table=tasktype&...
```

Tables: `all`, `tasktype`, `tcdet`, `userworkload`, `usertcode`, `times`, `rfc`, `hitlist_resptime`, `hitlist_database`, `manifest`.

---

## API reference

| Endpoint | Description |
|---|---|
| `GET /api/workload/meta` | Connection mode + supported aggregates |
| `GET /api/workload` | Overview (`TASKTYPE` + totals) |
| `GET /api/workload/bundle` | Full ST03N-shaped JSON |
| `GET /api/workload/export` | CSV or ZIP export |

Query params: `systemId`, `instance`, `periodType` (`D`\|`W`\|`M`), `periodStart` (`YYYY-MM-DD`).

---

## Providers (`.env.local`)

| `SAP_PROVIDER` | Behaviour |
|---|---|
| `mock` (default) | Demo data — no SAP |
| `http` | Live fetch to SICF URL (`SAP_HTTP_BASE_URL`) |
| `rfc` | Stub for `node-rfc` + NWRFC SDK — implement `invokeAggregates()` in `src/lib/sap/rfc-provider.ts` |

Prefer **HTTP (SICF)** or the **ABAP report** if you do not want to expose RFC to an external host.

---

## Troubleshooting

| Symptom | What to check |
|---|---|
| Empty charts / “No ST03N aggregate data” | Period = **yesterday**; ST03N collector has data for that day; instance `TOTAL` or a real instance name |
| SICF **404** | Activate `zst03n` **and** `workload` in SICF |
| **403** / HTML logon page | ICF logon procedure; user/password; `sap-client` |
| Wrong protocol / port | `SMICM` — HTTP `50000` vs HTTPS; URL must match |
| Task types show as `TYPE_01` / hex | Re-**Pull** / re-activate enriched `ZCL_ST03N_HTTP_HANDLER` from git (emits readable task type names) |
| Users tab shows **UNKNOWN** | Re-**Pull** handler: USERWORKLOAD must emit `USERNAME` (ACCOUNT is often empty on S/4). Then restart Node and **Load** again |
| Only meta counts in JSON | Same — activate latest handler with full payload |
| Node cannot reach SAP | Network / VPN / Cloud Connector; do not expose SICF publicly without hardening |
| Hydration / locale quirks | App formats dates in UTC intentionally |

**Security:** restrict SICF users/roles; prefer HTTPS in production; least-privilege technical user; Cloud Connector + principal propagation or OAuth over basic auth when going beyond a lab.

---

## Stack

Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Recharts, `tsx` CLI, abapGit-ready ABAP under `abap/`.

## Docs in repo

- [abap/README.md](abap/README.md) — `ZST03N_EXTRACT` install & selection screen  
- [abap/HTTP.md](abap/HTTP.md) — SICF / ICF handler detail & optional SEGW OData  
- [`.env.example`](.env.example) — env template  
