# Test checklist

**Run these only on a TEST copy of the workbook.** Tests create ledger and audit rows that cannot be removed.

## How to run the automated scenarios
1. Make a copy of the spreadsheet (File > Make a copy). Use the copy only.
2. On **Lists & Settings**, set **Environment** (cell P7) to `TEST`.
3. Run **Impact Finance Tracker > Admin > Run test scenarios (TEST copy only)**.
4. Expected: every line starts with `PASS`. Email is not sent in TEST mode; it is written to the log.
5. Set Environment back to `LIVE`. Then delete the test copy.

## Scenario results

| ID | Scenario | Steps | Expected result |
|---|---|---|---|
| A | Fully paid | Ramez requests 1,000 USD. Peter approves 1,000. David pays 1,000. | Approved 1,000; Total Paid 1,000; Remaining 0; Payment Status **Paid** |
| B | Partial then final | Request 5,000. Approve 5,000. Pay 2,000. Then pay 3,000. | After 2,000: Paid 2,000, Remaining 3,000, **Partially Paid**. After 3,000: Paid 5,000, Remaining 0, **Paid** |
| C | Rejected | Request 800. Peter rejects. David tries to pay 800. | Status **Rejected**. Payment refused. Payment attempt logged as `PAYMENT_BLOCKED` |
| D | Pending | Ramez submits 300. | Row appears in **Approval Queue**. Counted in Pending Requests and Pending Approval Amount on the dashboard |
| E | Unauthorized approval | Non-approver calls approve. | Refused with message "Only Peter George can approve". Log has `UNAUTHORIZED_ATTEMPT`. Status unchanged |
| F | Duplicate reference | Pay 400 with reference X, then 400 with reference X again. | Second payment refused. Log has `PAYMENT_BLOCKED`. Only one ledger row with reference X |
| G | Multiple currencies | Request 700 EUR alongside USD requests. | Dashboard totals table shows **EUR and USD on separate rows**. No combined total |
| H | Overpayment | Approve 500. Pay 600. | Payment refused ("exceeds the remaining approved balance"). Total Paid stays 0 |

## Manual checks (cannot be automated)

| # | Check | Steps | Expected result |
|---|---|---|---|
| M1 | Typed status is reverted | On a Pending request, type `Approved` into Approval Status. | Cell reverts to `Pending Approval`. Toast appears. Log has `MANUAL_EDIT_REVERTED` |
| M2 | Business fields lock after submit | On a Pending request, edit the amount. | Reverts. Toast says "Locked while the request is Pending Approval" |
| M3 | Business fields unlock for resubmission | Peter requests changes. Ramez edits the amount. | Edit accepted. Resubmit sets status back to Pending |
| M4 | Payment ledger is append-only | Type into a ledger cell (A to N). | Reverts. Toast appears |
| M5 | Daily reminder | Set `Approval wait` to 0 days. Run **Send Pending Reminders** twice. | First run sends one email per pending request. Second run sends none (once-per-day rule). Log has `REMINDER_SENT` |
| M6 | Overdue payment | Approve a request with a required date in the past and no payment. | Required date cell is red. KPI "Overdue payments" counts it |
| M7 | Dashboard filter | Set From/To dates. | Requested, Approved, Paid, Rejected and the period subtitle change. Outstanding does not |
| M8 | Queue highlight | Pending request older than the threshold. | Days Waiting cell is red |
| M9 | Validation report | Run **Run Validation Checks** on the test copy. | Report lists the test duplicate-reference and the TEST rows. Nothing in the data is changed |
| M10 | Setup is safe to rerun | Run **Set up / repair workbook** again on a populated copy. | No data rows change. Headers, dropdowns and formulas are rebuilt |
| M11 | Triggers installed | Admin > Install daily reminder trigger, then open Apps Script > Triggers. | One time-driven trigger for `sendPendingReminders` |
| M12 | Mobile layout | Open the register on a phone. | Frozen ID and title columns stay visible; headers remain readable |

## Known untested items (be explicit)
- The scripts have been **syntax-checked** only. They have not yet been run against a live Google Sheet. Run the checklist above on a copy before use.
- Email delivery depends on the account's MailApp quota and spam filters.
- Charts render only after **Refresh Dashboard** or setup.
