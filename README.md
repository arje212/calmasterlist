# Report engine - batch 1

Excel template + data -> filled .xlsx -> PDF, approved copy frozen on disk.

## Install (Windows server)
1. Install Python 3 and LibreOffice.  Then:  `pip install openpyxl pillow`
2. Copy `reportEngine.js` next to `server.js`, and the `report-engine/` folder too.
3. Apply `SERVER_PATCH.md` to server.js.
4. Optional env vars (service account must have write access to REPORT_DATA_DIR):
   - `REPORT_DATA_DIR`  e.g. `D:\calibratrack-data`   (attachments + approved files; NOT a folder people use)
   - `SOFFICE_PATH`     e.g. `C:\Program Files\LibreOffice\program\soffice.exe`
   - `PYTHON_PATH`      e.g. `C:\Python312\python.exe`   (if `python` is not on PATH for the service)
5. Copy `client/*` into the React app (see apiClient.additions.js).
6. Self-test: `node test-harness.mjs` (needs /tmp paths on Linux; on Windows change them).

## Adding a template
Put the clean .xlsx (no macros, no LOGIN/USERS sheet) in `report-engine/templates/`,
then add a mapping in `report-engine/mappings/` (copy one of the 4 and edit cell addresses).
