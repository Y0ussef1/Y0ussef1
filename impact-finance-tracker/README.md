# Impact Finance Tracker (Google Sheets + Apps Script)

A request, approval and payment tracker for internal disbursements.

- **Ramez George** (requester) submits requests.
- **Peter George** (approver) approves, rejects or requests changes.
- **David Nashaat** (finance) records payments, including partial ones.

The reference sheet ("مؤسسة iMpact - إصدارات فوري") is an instant-disbursement ledger in **EGP**. Its useful ideas are carried over: an EGP default, the payment methods (FAWRY, bank transfer, cash), an optional 3% fee, and a manager-approval step. Its client records contain national IDs and phone numbers. **Do not import those into this tracker**, and do not commit them to the repository.

This project is built to be installed in a **new** spreadsheet. It does not modify the reference sheet.

---

## 1. What is in this folder

| File | Purpose |
|---|---|
| `Config.gs` | Identities (who may approve/pay), sheet names, column maps, status constants |
| `Util.gs` | Shared helpers, locking, prompts, mail |
| `Identity.gs` | Role checks (fail-closed), logs unauthorized attempts |
| `Audit.gs` | Append-only audit log writer |
| `Requests.gs` | Submit, approve, reject, request changes, amend, cancel |
| `Payments.gs` | Record payments with all money-safety validations |
| `Notifications.gs` | Event emails and the daily reminder run (deduplicated) |
| `Setup.gs` | Creates the six tabs, named ranges, formulas, dropdowns, formats, protections, triggers |
| `Views.gs` | Approval Queue, Executive Dashboard, charts |
| `Validation.gs` | Validation report (written to Lists & Settings, columns R:V) |
| `Menu.gs` | `Impact Finance Tracker` menu and the `onEdit` guard |
| `Tests.gs` | Scenarios A to H, for a TEST copy only |
| `appsscript.json` | Manifest and OAuth scopes |
| `SECURITY.md` | Limitations and recommended improvements (read this) |
| `TESTING.md` | Test checklist with expected results |

## 2. The six tabs

1. **Executive Dashboard**: KPI cards (per selected currency), totals by currency (never mixed), monthly trend, category breakdown, status distributions, 4 charts, date filter, navigation links.
2. **Request Register**: master table, 24 columns as specified. Requester fields are teal headers. Calculated columns are slate headers, with formula protection.
3. **Approval Queue**: formula-driven view of Pending Approval requests, days waiting, required-date highlighting, plus recent decisions (30 days).
4. **Finance & Payments**: append-only payment ledger (left) and the approved-awaiting-payment queue (right). Duplicate references are flagged.
5. **Approval & Audit Log**: append-only event trail (Event ID, timestamp, request, type, previous/new value, actor, comments, payment ID).
6. **Lists & Settings**: dropdown lists (named ranges `LIST_*`), reminder thresholds, environment flag, and the validation report.

## 3. Setup (one time, about 20 minutes)

### 3.1 Create the spreadsheet
1. In Google Drive, create a **new** blank Google Sheet, for example "Impact Finance Tracker". Do not use the reference sheet.
2. Open **Extensions > Apps Script**. Delete the default `Code.gs` contents.
3. Create one script file for each `.gs` file in this folder, using the same name (File > New > Script file). Paste each file's contents. Then paste the contents of `appsscript.json` into **Project Settings > Show "appsscript.json" manifest file**.
   - Alternative: install `clasp` and run `clasp push` from this folder after `clasp create --type sheets --title "Impact Finance Tracker"`. Note that `clasp create` makes a new bound script. Do not reuse the reference sheet.
4. **Save** (Ctrl+S).

### 3.2 Check the identities in `Config.gs`
`CONFIG.PEOPLE` holds the approver, requester and finance emails. Identity is kept in code, not in the sheet, so editors cannot grant themselves approval rights by changing a cell. Confirm the three addresses are exactly right before running setup.

### 3.3 Run setup
1. Close and reopen the spreadsheet (or reload). The **Impact Finance Tracker** menu appears. Accept the authorization prompt that Google shows.
2. Run **Impact Finance Tracker > Admin > Set up / repair workbook**. It is safe to run again. It creates missing tabs, headers, named ranges, dropdowns, formulas (prefilled to row 2000), formats and protections. It never deletes data rows.
3. Run **Admin > Install daily reminder trigger**. This creates the time-driven trigger for reminders (around 08:00 Cairo time). Authorize it when asked.
4. Optional: set **Lists & Settings > Environment** to `LIVE`. The default is `LIVE`.

### 3.4 Triggers at a glance
| Trigger | Type | Runs |
|---|---|---|
| `onOpen` | Simple | Builds the menu |
| `onEdit` | Simple | Reverts manual edits to tracker-managed cells, locked business fields, ledger and audit log |
| `sendPendingReminders` | Installable time-driven, daily | Approval reminders to Peter, payment reminders to David (at most one per request per day) |

Event emails (submit, decision, payment) are sent directly by the menu action that the user performs. They are not triggered by editing unrelated cells.

## 4. Sharing (do this yourself; the tracker does not share automatically)

Share the spreadsheet (**Share**) with these three accounts as **Editor**:

- `ramez.george@impact-org.com`
- `p.george@impactcommunitydevelopment.com`
- `david.nashaat@impactcommunitydevelopment.com`

Google Sheets permissions apply to the whole file, not to rows or tabs. All three can open every tab. The identity checks in the script control who may **approve** and **pay**, but they do not hide data. Read SECURITY.md before you decide who gets edit access.

## 5. Workflow

### Ramez (requester)
1. Go to **Request Register**, type a new request in the next empty row. Fill in: title, description, category, vendor/beneficiary, amount, currency, required payment date, document link (recommended), notes.
2. Select the row. Run **Impact Finance Tracker > Submit Selected Request**. The Request ID and submission time are generated. Status becomes **Pending Approval** and Peter is emailed.
3. If Peter returns it as **Changes Requested**, read the comments, edit the business fields (they unlock only in Draft or Changes Requested), and submit again. Previous decisions stay in the audit log.

### Peter (approver)
1. Open **Approval Queue**. Oldest waiting requests are first. Open the document link.
2. Select the row on **Request Register**. Run one of:
   - **Approve Selected Request**: enter the approved amount (comment required if it differs from the request).
   - **Reject Selected Request**: reason required.
   - **Request Changes**: what Ramez must change.
3. Exception only: **Amend Approved Amount** changes an approved amount with a reason. It cannot go below what has been paid.

### David (finance)
1. Open **Finance & Payments**. The right-hand queue lists approved requests with a remaining balance.
2. Select the request (or run **Record Payment** and type the Request ID). Enter: amount paid, payment date, method, transaction reference (must be unique), recipient, proof link, notes.
3. The tracker blocks: non-approved requests, amounts above the remaining balance, duplicate references, currency mismatches and future dates. Each blocked attempt is logged. Totals and status update automatically (Awaiting Payment, Partially Paid, Paid).
4. Never edit ledger rows. A wrong payment is corrected by the administrator with a new, linked entry.

### Anyone
- **Refresh Dashboard** rebuilds the charts. Figures are live formulas.
- **Run Validation Checks** lists issues on Lists & Settings (columns R:V), with a fix for each one.
- **Send Pending Reminders** sends the reminder emails on demand.

## 6. Status rules

- Approval status: `Draft`, `Pending Approval`, `Changes Requested`, `Approved`, `Rejected`, `Cancelled`.
- Payment status is calculated from the ledger, not typed: `Not Approved` (any non-approved status), `Awaiting Payment` (approved, nothing paid), `Partially Paid`, `Paid` (total paid equals approved), `Payment Issue` (paid more than approved, which should be blocked and is flagged if it happens).
- Only the approve action sets `Approved`. Typing the word "Approved" into a cell is reverted by `onEdit`, and payments are refused without an APPROVED event in the audit log.

## 7. Currencies, totals and dates

- Currency is part of every amount. Totals are shown **per currency** (EGP, USD, EUR, GBP). There is no FX conversion, so currencies are never added together. FX conversion is not implemented.
- Dashboard cards and charts follow the currency selected at the top of the dashboard.
- "Requested", "Approved" and "Rejected" use the **submission date** for the date filter. "Paid" uses the **payment date**. "Outstanding" and "overdue" are current, not filtered.

## 8. Capacity

Formulas are prefilled to row 2000 for the register, queue and ledger. To extend, raise `CONFIG.MAX_ROWS` in `Config.gs`, then run setup again. Named ranges and formulas use the same limit.

## 9. Troubleshooting

- **"Only Peter George can approve..."**: you are not signed in with the approver account in this browser. Switch Google accounts and try again. The attempt is logged.
- **Menu not showing**: reload the sheet. If it still does not appear, open Extensions > Apps Script and run `onOpen` once to authorize.
- **Email not received**: check spam. Check the audit log for `REMINDER_SENT`. Mail quota depends on the Google account type.
- **Formula errors (#REF!, #N/A)**: run Setup again. Run Validation Checks to list affected cells.
