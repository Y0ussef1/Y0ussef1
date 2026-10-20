# Security, permissions and limitations

Read this before you rely on the tracker for real money.

## 1. What is enforced

- **Approval identity check.** `Approve`, `Reject`, `Request Changes` and `Amend` run `requireRole_('APPROVER')`. The check compares `Session.getActiveUser().getEmail()` with the approver address in `Config.gs`.
- **Fail closed.** If Google does not reveal an email (for some account types or domain policies), the action is refused.
- **Refused attempts are logged** as `UNAUTHORIZED_ATTEMPT` with the account that tried.
- **Payments need an approval record.** A payment is refused unless the request is `Approved`, has an approver, an approval date, an approved amount, and an `APPROVED` event in the audit log.
- **Money rules are checked inside a script lock.** Status must be Approved. Amount must be positive and no more than the remaining balance. The transaction reference must be unique (case-insensitive). The currency must match the request. The payment date cannot be in the future.
- **Manual edits are reverted** (`onEdit`) for tracker-managed register columns, business fields after submission, the payment ledger, and the audit log. Reverted attempts are logged as `MANUAL_EDIT_REVERTED`.

## 2. What is NOT enforced (be honest with the team)

1. **Google Sheets is not a secure database.** Anyone with Editor access can see every tab and every amount. The tracker does not hide data from Ramez or Peter. Protected ranges and hidden tabs are not confidentiality controls.
2. **Editors can still type into the sheet.** `onEdit` reverts single-cell edits, but multi-cell paste is only flagged with a toast, not reverted. The Validation Checks report catches inconsistencies afterwards. Run it regularly.
3. **The audit log is not tamper-proof.** It is append-only by convention and by the sheet protection, which is warning-only. Protection is warning-only on purpose: the scripts run as the user who triggers them, and a hard protection would block the tracker's own writes. An editor can delete rows, and Google's version history is the real backstop. Export the audit log periodically to a location only the administrator can edit.
4. **Identity depends on Google.** `getActiveUser()` returns the signed-in account in the browser running the menu action. It can be blank or unavailable depending on account type, domain policy and deployment. It is not a cryptographic proof. Someone who controls the approver's signed-in browser session can act as Peter.
5. **Approval can be forged by editing code.** Anyone who can edit the Apps Script project can change `CONFIG.PEOPLE`, remove `onEdit`, or edit the audit log directly. Restrict who can edit the script (Apps Script project permissions are separate from sheet permissions).
6. **Test helper.** `TEST_IDENTITY_OVERRIDE` is set only inside `runTestScenarios`, which refuses to run unless the environment is `TEST`. It is still code, so keep the live copy's environment at `LIVE`.
7. **Emails are not encrypted and may be forwarded.** Proof-of-payment and document links are sent in email bodies. Use internal links with restricted sharing.
8. **Sharing and invitations are manual.** The tracker never shares or invites anyone.
9. **Quotas.** `MailApp` quotas depend on account type. Reminder emails count toward them.
10. **Scale.** Formulas are prefilled to 2000 rows. Some lookups (for example, finding a request by ID) read the register each time. This is fine for thousands of rows but not for tens of thousands.
11. **Multi-currency.** Totals are per currency. There is no FX conversion.
12. **Personal data.** The reference sheet contains national IDs and phone numbers. Do not import them, and do not store them in a shared sheet that does not need them.

## 3. Recommended improvements (in order of value)

1. **Move approval to a bound Google Apps Script web app or a Google Form** with a controlled approval page. Use "Execute as: User accessing the web app" with domain restriction, so identity is checked on every request. This is far stronger than menu actions in a shared spreadsheet.
2. **Split the data.** Keep payments and audit in a separate spreadsheet that only David and the administrator can edit. Peter and Ramez then see status through a view, not the raw ledger.
3. **Export the audit log daily** to a read-only folder (for example, a CSV in a restricted Drive folder) by a time trigger.
4. **Use Workspace groups** for the three roles, so sharing changes are made to a group, not to individuals.
5. **Enable Google Workspace audit logs** (Admin console) to track sharing and edits at the file level.
6. **Add bank reconciliation**: import the bank statement and match transaction references automatically.
7. **Add an FX table** with effective dates, then convert into a reporting currency for total views.

## 4. Permissions model (recommended)

| Person | Sheet access | Menu actions they should use |
|---|---|---|
| Ramez | Editor | Submit, Cancel own drafts/pending |
| Peter | Editor | Approve, Reject, Request Changes, Amend, Cancel approved |
| David | Editor | Record Payment |
| Administrator (owner) | Owner | Setup, Triggers, Validation, Test copy |

Remember that Editor access lets each person see and type into everything. Keep this model as the operating agreement, and use the recommended improvements to enforce it.
