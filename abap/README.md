# ABAP extract — ZST03N_EXTRACT

Traditional on-stack extract of the same ST03N aggregates the Node.js app models.

## Does ST03N already download logs?

**Partially, but not as an extract API.**

| Capability | In ST03N GUI? | Good for automation? |
|---|---|---|
| View workload / users / TCODEs / RFC / hitlists | Yes | — |
| Export current ALV to spreadsheet | Yes (List → Export / Local file) | No — interactive, one screen at a time |
| Schedule recurring full extract | No | Use this report or the Node CLI |
| RFC-readable aggregates | Via `SWNC_*` FMs | Yes |

So: use ST03N for interactive analysis; use **this report** or **`npm run extract`** for pipelines.

## Install

1. `SE38` → Create program `ZST03N_EXTRACT` (Executable, type 1).
2. Paste [`zst03n_extract.prog.abap`](./zst03n_extract.prog.abap).
3. Activate. If activation fails on structure components, open `SE11` for `SWNCAGGTASKTYPE`, `SWNCAGGTCDET`, etc., and align field names (they vary slightly by `SAP_BASIS` release).
4. Optional: create a variant + `SM36` job for daily/weekly extracts to the app server.

## Selection screen

- **Component** — instance name or `TOTAL` (system-wide, same as ST03N).
- **Period type** — `D` / `W` / `M`.
- **Period start** — first day of the period.
- **Output** — presentation server (`GUI_DOWNLOAD`) or application server (`OPEN DATASET`).
- Checkboxes for which aggregates to write.

## Output files

Prefix from `p_path`, suffix per aggregate:

- `*_tasktype.csv`
- `*_tcdet.csv`
- `*_userworkload.csv`
- `*_usertcode.csv`
- `*_times.csv`
- `*_rfc.csv`
- `*_hitlist_resptime.csv`
- `*_hitlist_database.csv`

## Authorization / ops notes

- Caller needs authorization to read workload stats (typically Basis / admin roles that can run ST03N).
- App-server paths require write permission on the directory.
- Prefer app-server + job scheduling for unattended extracts; use presentation download for ad-hoc GUI runs.
