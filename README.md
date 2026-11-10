# Report engine - batch 1

Excel template + data -> filled .xlsx -> PDF, approved copy frozen on disk.

## Install (Windows server)
1. Install Python 3 and LibreOffice.  Then:  `pip install openpyxl pillow`
2. Copy `reportEngine.js` next to `server.js`, and the `report-engine/` folder too.
3. Apply `SERVER_PATCH.md` to server.js.
4. Optional env vars (service account must have write access to REPORT_DATA_DIR):
   - `REPORT_DATA_DIR`  e.g. `D:\nikkoshi-system-data`   (attachments + approved files; NOT a folder people use)
   - `SOFFICE_PATH`     e.g. `C:\Program Files\LibreOffice\program\soffice.exe`
   - `PYTHON_PATH`      e.g. `C:\Python312\python.exe`   (if `python` is not on PATH for the service)
5. Copy `client/*` into the React app (see apiClient.additions.js).
6. Self-test: `node test-harness.mjs` (needs /tmp paths on Linux; on Windows change them).

## Adding a template
Put the clean .xlsx (no macros, no LOGIN/USERS sheet) in `report-engine/templates/`,
then add a mapping in `report-engine/mappings/` (copy one of the 4 and edit cell addresses).

## Notifications
Run the existing app with `npm run dev`. The Node API creates the notification tables and indexes in the configured SQLite database on startup; this is an additive migration and does not reset or replace existing data. The default database is `calibratrack.sqlite`; `CALIBRATRACK_DB` can point to the existing database file used by the deployment.

Report workflow notifications are stored per recipient and delivered over authenticated Server-Sent Events. Submission alerts go to active Sr. Staff and admins; review alerts go to QA Managers and admins; return, rejection, and approval alerts go to the report author and relevant reviewer. Report decisions are recorded in the existing audit log.

Each user can enable browser desktop notifications from the Notifications page. Permission is requested only after the user selects **Enable desktop alerts**. The browser must remain open with this app running, and the site must use HTTPS in production (localhost is allowed for development). Windows Focus Assist, browser notification settings, and OS-level notification settings may suppress toasts. Desktop notifications use short generic messages; selecting one opens the related report.

The Notifications API does not deliver messages after the browser is completely closed. Background delivery would require a service worker, Web Push subscriptions, VAPID credentials, subscription lifecycle management, and a production push service; those are not part of this implementation. For a horizontally scaled API deployment, route each user’s SSE connection and events through a shared pub/sub service; the current in-memory stream registry is intended for the existing single-process Node API.

## AI assistant
The authenticated floating AI Assistant can search equipment by control number or name, find accessible verification reports, answer calibration due-date questions from the app's records, and search active Procedure and Process Instruction documents uploaded to their libraries. When explicitly asked to compare or revise a Process Instruction against a Procedure, it can use excerpts from both libraries to identify matches, differences, omissions, and suggested wording. Archived documents are excluded, and the assistant does not edit or save the original files. The libraries accept DOC, XLS, and XLSX documents; scanned image-only content is not readable. Document search can return excerpts without an AI key, but comparison and revision drafts require a configured provider. Basic record search and due-date lookup also work locally without an AI key.

1. Use Node.js 22.9 or later.
2. Copy `.env.example` to `.env` and set `GROQ_API_KEY` to a Groq API key, or use `AI_GATEWAY_API_KEY` for AI Gateway. Keep `.env` private; never put a key in frontend code or commit it.
3. The default Groq model is `openai/gpt-oss-20b`, a cost-efficient model that supports tool use. Optionally change `GROQ_MODEL` or `AI_GATEWAY_MODEL` to another model available from the selected provider.
4. Run `npm run dev`. In production, set these as server environment variables instead.

When both provider keys are set, Groq is used. AI requests may incur provider charges. Only the authenticated user's own reports and approved reports are searchable by staff accounts.

## Initial administrator
The API does not create an administrator from a public sign-in request. Bootstrap or recover the administrator offline with `node server/reset-admin.mjs <id_number> [full_name]`; enter the password in the hidden terminal prompt. The utility initializes the required tables if needed and invalidates prior sessions for that account.
