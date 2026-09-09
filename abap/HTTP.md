# Custom ABAP HTTP service for ST03N (step by step)

This is the **most practical** way to expose ST03N aggregates over HTTP for the Node app (`SAP_PROVIDER=http`).

You do **not** need full SEGW OData for a first slice. An **ICF HTTP handler** that returns JSON is enough. OData (SEGW / RAP) is optional later if you want formal entity sets and `$filter`.

---

## What you will build

```text
Browser / Node.js
    │  HTTPS GET
    ▼
/sap/bc/zst03n/workload
    │  ICF node
    ▼
ZCL_ST03N_HTTP_HANDLER
    │  CALL FUNCTION
    ▼
SWNC_COLLECTOR_GET_AGGREGATES  →  JSON
```

Example call:

```http
GET /sap/bc/zst03n/workload?periodType=D&periodStart=20260908&instance=TOTAL
Authorization: Basic …   (or form logon / principal propagation)
```

Source in this repo: `zcl_st03n_http_handler.clas.abap`

---

## Prerequisites

- Authorization to create objects in a Z-package (e.g. `ZST03N`)
- Authorization for ST03N / workload stats (`S_TOOLS_EX` typically)
- Rights to maintain **SICF**
- HTTPS access to the app server (or Cloud Connector if Node is outside)

---

## Step 1 — Create the package (once)

1. `SE80` → Repository Browser → **Package**
2. Create `ZST03N` (or reuse the one from abapGit)
3. Assign a transport if this is not `$TMP`

---

## Step 2 — Create the HTTP handler class

### Option A — abapGit (preferred)

1. Pull latest git (includes `zcl_st03n_http_handler.clas.abap` + `.clas.xml`)
2. abapGit → **Pull** into package `ZST03N`
3. Activate `ZCL_ST03N_HTTP_HANDLER`

### Option B — manual

1. `SE24` (or Eclipse ADT) → Create class `ZCL_ST03N_HTTP_HANDLER`
2. On the **Interfaces** tab, add `IF_HTTP_EXTENSION`
3. Paste the implementation from `zcl_st03n_http_handler.clas.abap`
4. Activate

If activation fails on a field (e.g. `DBP_TIME`), open `SE11` → that structure and align the component name (same as for `ZST03N_EXTRACT`).

---

## Step 3 — Create the ICF node (SICF)

1. Transaction **`SICF`**
2. Execute (F8) to display services
3. Navigate to: `default_host` → `sap` → `bc`
4. Right-click `bc` → **New Sub-Element**
5. Name: `zst03n` (service name)
6. Create another child under `zst03n`: name `workload`
7. Open the `workload` service → tab **Handler List**
8. Enter handler: `ZCL_ST03N_HTTP_HANDLER` (order 1)
9. Tab **Logon Data** (typical for internal tools):
   - Procedure: **Alternative Logon** / Basic Authentication  
   - Or leave standard SAP logon if users call it from a browser session
10. **Save**
11. Right-click `workload` → **Activate Service**

Final path:

```text
/sap/bc/zst03n/workload
```

---

## Step 4 — Smoke-test in the browser

Build the URL (replace host/port/client):

```text
https://<s4-host>:<https-port>/sap/bc/zst03n/workload?sap-client=100&periodType=D&periodStart=20260908&instance=TOTAL
```

You should get JSON with `query`, `taskTypes`, `transactions`, and `meta`.

Query parameters:

| Param | Example | Meaning |
|---|---|---|
| `periodType` | `D` / `W` / `M` | Same as ST03N |
| `periodStart` | `20260908` or `2026-09-08` | Period start |
| `systemId` | `PRD` | Defaults to `SY-SYSID` |
| `instance` | `TOTAL` | Instance or TOTAL |

---

## Step 5 — Point the Node app at it

In `.env.local`:

```bash
SAP_PROVIDER=http
SAP_HTTP_BASE_URL=https://<s4-host>:<port>/sap/bc/zst03n/workload
SAP_CLIENT=100
SAP_USER=...
SAP_PASSWD=...
```

Restart `npm run dev` after changing `.env.local`. In the UI use **yesterday’s** date for day aggregates, then **Load**. Use **Save as CSV** on the dashboard (or `GET /api/workload/export`) for the same files as `ZST03N_EXTRACT`.

For on-prem S/4 from outside the network, put **SAP Cloud Connector** (or a reverse proxy) in front; do not expose SICF to the public internet without hardening.

---

## Security checklist (do not skip)

- Restrict ICF service to specific users / roles
- Prefer HTTPS only
- Prefer technical user with **least privilege** (read workload stats only)
- In production, prefer **Cloud Connector + principal propagation** or OAuth over basic auth
- Limit data volume (period = Day first); monthly aggregates can be large

---

## Optional later: OData (SEGW) instead of plain HTTP

Use this if you need formal entity sets, `$filter`, `$select`, SAP Gateway catalogs.

### High-level SEGW path

1. **`SEGW`** → Create project `ZST03N_GW` → package `ZST03N`
2. Data Model → Import → DDIC Structure (or create entities manually):
   - Entity `TaskType` (from a thin Z-structure you define)
   - Entity `Transaction` (TCDET-like)
3. Service Implementation → map `GetEntitySet` to a class that calls `SWNC_COLLECTOR_GET_AGGREGATES` and fills the entity table
4. Generate Runtime Objects
5. **`/IWFND/MAINT_SERVICE`** → Add service → Activate ICF node
6. Test with:

```text
/sap/opu/odata/sap/ZST03N_GW_SRV/TaskTypeSet?$format=json
```

OData is better for governance; **ICF JSON is faster to ship** for this ST03N collector.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| 403 / logon screen HTML | ICF logon not set / user not authorized |
| 404 service missing | Node not activated in SICF |
| JSON `No ST03N aggregate data` | Wrong period / collector has no data for that day |
| Activation error on `DBP_TIME` etc. | Align field names via `SE11` (same as extract report) |
| Users all show as UNKNOWN in Node UI | Re-pull this class — emit `USERNAME` (ACCOUNT is often empty). Node prefers `username` then `user`/`account` |
| Huge response / timeout | Use `periodType=D`; add paging later |

---

## Suggested order of work

1. Activate `ZST03N_EXTRACT` (CSV) and prove data locally  
2. Activate `ZCL_ST03N_HTTP_HANDLER` + SICF  
3. Browser smoke test  
4. Wire Node `SAP_PROVIDER=http`  
5. Only then consider SEGW OData if required by integration standards  
