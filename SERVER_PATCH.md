# Changes to server.js  (5 small edits)

## 1. imports + engine (top of file, after `await ensureSharedEntityStore();` is fine too)
```js
import { createReportEngine } from './reportEngine.js';
const engine = createReportEngine({ listEntity, updateEntity, send, isAdmin });
```
(function declarations are hoisted, so this can sit right below the imports.)

## 2. route hook -- in `handler()`, right after the `if (pathname.startsWith('/api/') && !publicAuthRoute && !actor) return unauthorized(response);` line
```js
if (actor && await engine.handle(request, response, pathname, actor)) return;
```

## 3. Report PUT  -- inside `if (name === 'Report') {` in the PUT branch
Add right after `if (!current) return send(response, 404, ...)`:
```js
// approved = frozen for EVERYONE (admin included).  Changes need a new revision.
if (current.status === 'approved') return send(response, 409, { error: 'Approved reports are locked. Create a revision instead.' });
// server-owned fields can never come from the browser
for (const k of ['attachments', 'final_xlsx_path', 'final_pdf_path', 'final_xlsx_sha256', 'final_pdf_sha256', 'finalized_at', 'template_key', 'created_by_id']) delete item[k];
```
And replace the last three lines of the PUT branch
```js
const updated = await updateEntity(name, rowId, item);
if (!updated) return send(response, 404, { error: 'Record not found' });
return send(response, 200, name === 'User' ? publicUser(updated) : updated);
```
with
```js
let updated = await updateEntity(name, rowId, item);
if (!updated) return send(response, 404, { error: 'Record not found' });
if (name === 'Report' && updated.status === 'approved' && !updated.final_pdf_path) {
  try { updated = await engine.finalizeApproved(updated); }
  catch (error) {                                         // never leave a report "approved" without its saved file
    await updateEntity('Report', rowId, { status: 'reviewed', approved_by: '', approved_by_id: '', approved_at: '' });
    return send(response, 500, { error: `Approval not saved - could not create the final file: ${error.message}` });
  }
}
return send(response, 200, name === 'User' ? publicUser(updated) : updated);
```

## 4. Report POST -- inside `if (name === 'Report') {` in the POST branch (server-side uniqueness; the browser only sees its own reports)
```js
const every = await listEntity('Report');
if (item.report_number && every.some((r) => r.report_number === item.report_number)) return send(response, 409, { error: 'Report number already exists' });
if (item.verification_id && every.some((r) => r.verification_id === item.verification_id)) return send(response, 409, { error: 'A report already exists for this verification' });
delete item.attachments; delete item.final_pdf_path; delete item.final_xlsx_path;
```

## 5. User position (printed under Verified / Reviewed / Approved)
In the User PUT whitelist: `['role', 'disabled', 'full_name', 'email', 'position']`.
Set each user's `position` once in Users admin (e.g. "QA Sr. Staff", "QA Superintendent").
