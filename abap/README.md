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

## Files (abapGit layout)

| File | Role |
|---|---|
| `zst03n_extract.prog.abap` | Report source |
| `zst03n_extract.prog.xml` | abapGit metadata (PROGDIR + texts) |

Repo root has `.abapgit.xml` with **starting folder** `/abap/` so the Next.js app can live alongside ABAP in the same git repo.

## Install with abapGit

1. Install [abapGit](https://docs.abapgit.org) in the SAP system (if needed).
2. Create a local package, e.g. `ZST03N` (`SE80`).
3. abapGit → **New Online** (GitHub URL) or **New Offline** (zip of this repo).
4. Link to package `ZST03N`. Confirm starting folder is `/abap/` (from `.abapgit.xml`).
5. **Pull** → activate `ZST03N_EXTRACT`.
6. If activation fails on structure components, open `SE11` for `SWNCAGGTASKTYPE`, `SWNCAGGTCDET`, etc., and align field names for your `SAP_BASIS` release.

### Offline zip tip

Zip the whole git repo (or at least `.abapgit.xml` + `abap/`), then import in abapGit offline mode.

## Install without abapGit (SE38)

1. `SE38` → Create program `ZST03N_EXTRACT` (Executable, type 1).
2. Paste `zst03n_extract.prog.abap`.
3. Activate.

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
