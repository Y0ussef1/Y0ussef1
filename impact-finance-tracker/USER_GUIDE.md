# Impact Finance Tracker: User Guide

This guide is for everyone who uses the spreadsheet: requesters, approver and finance. Read the section for your role, then the "How the sheet works" section.

**Who does what**

| Person | Role | Email |
|---|---|---|
| Ramez George | Requester | ramez.george@impact-org.com |
| Marina Bahgat | Requester (same access as Ramez) | marina.bahgat@impact-org.com |
| Peter George | Approver | p.george@impactcommunitydevelopment.com |
| David Nashaat | Finance / payer | david.nashaat@impactcommunitydevelopment.com |

Sign in to Google with your work account above before you use the menu. Approval and payment actions only work from the matching account.

---

## 1. Where to write (quick reference)

| If you are... | You write in | You never type in |
|---|---|---|
| Requester (Ramez, Marina) | **Request Register**, the teal-header columns, in the next empty row | Slate-header columns, Approval Queue, Finance & Payments, Approval & Audit Log |
| Approver (Peter) | Nothing typed. Select the request row on **Request Register**, then use the menu | Any cell by hand |
| Finance (David) | Nothing typed in the ledger. Use the menu **Record Payment** | Ledger rows (A to N) |

Everything else is calculated or written by the menu.

---

## 2. Requesters: Ramez and Marina

### Step 1: Create a request
1. Open the spreadsheet and go to the **Request Register** tab.
2. Go to the first empty row (the row under the last request).
3. Fill the **teal-header** columns:

| Column | What to enter | Example |
|---|---|---|
| Request Title | Short name | "Office printer toner" |
| Description / Business Purpose | Why it is needed | "Toner for the Minya office printer, March" |
| Category | Pick from the dropdown | Office Expenses |
| Vendor / Beneficiary | Who gets paid | "Example Supplies Co." |
| Requested Amount | Number only | 4500 |
| Currency | Pick from the dropdown (default EGP) | EGP |
| Required Payment Date | yyyy-mm-dd | 2026-11-30 |
| Supporting Documents | Link to the invoice (https://...) | Google Drive link |
| Notes | Anything else (editable at any time) | "Quote attached" |

4. Click the row number on the left so the whole row is selected.
5. Go to **Impact Finance Tracker > Submit Selected Request**.
6. The tracker creates a Request ID (for example `REQ-2026-0001`), sets the status to **Pending Approval**, and emails Peter.

Leave the Request ID and status cells alone. The tracker fills them.

### Step 2: If Peter asks for changes
1. The status becomes **Changes Requested** and the reason appears in **Approval Comments**.
2. Edit the teal-header columns to address the comments. These columns unlock only while the status is Draft or Changes Requested.
3. Select the row and run **Submit Selected Request** again. The status returns to Pending Approval.

### Step 3: Track your request
- **Request Register**: the **Approval Status**, **Payment Status**, **Total Paid** and **Remaining Approved Balance** columns show where it is.
- **Next Action Required** tells you who must act next.
- You get an email when the request is approved, rejected, returned for changes, or paid.

### What you cannot do
- Edit a request while it is Pending Approval or Approved. Ask Peter to return it for changes first.
- Change Approval Status, the approved amount or payment columns by hand. Any such change is reverted automatically.

---

## 3. Approver: Peter

### Where to look
- **Approval Queue** tab: requests waiting for your decision, oldest first. Days Waiting turns red when a request has waited too long. The right side lists decisions from the last 30 days.
- **Document link** in the **Supporting Documents** column of the queue: open it before deciding.

### How to decide
1. Go to **Request Register**, click the row of the request.
2. Choose one action from **Impact Finance Tracker**:

| Action | When | What it asks |
|---|---|---|
| Approve Selected Request | You agree | Approved amount (defaults to requested). A comment is required if it differs |
| Reject Selected Request | You refuse | Reason (required) |
| Request Changes | Ramez or Marina must fix something | What must change (required) |

3. The decision is recorded with your name, date and comments. The requester and David are emailed automatically.

### Exception: changing an approved amount
Use **Impact Finance Tracker > Amend Approved Amount (exception)** only when the approved amount must change. You must give a reason. The new amount cannot be lower than what has already been paid.

### Cancel
**Cancel Selected Request** is for requests that should not go ahead. Cancelled requests stay in the register for the record. Requests with payments cannot be cancelled.

---

## 4. Finance: David

### Where to look
- **Finance & Payments** tab, right side ("approved requests awaiting payment"): every approved request that is not fully paid, with the remaining balance and the next action.
- **Finance & Payments** tab, left side: the payment ledger (history of all payments).

### How to record a payment
1. Select the request row on **Request Register**, or leave the selection and type the Request ID when asked.
2. Go to **Impact Finance Tracker > Record Payment**.
3. Answer the questions in order:

| Question | What to enter |
|---|---|
| Amount paid | Amount in the request's currency. Default is the remaining balance |
| Payment date | yyyy-mm-dd, today by default |
| Payment method | One of the dropdown values: Bank Transfer, Fawry, InstaPay, Cash, Cheque, Card, Other |
| Transaction reference | Bank or payment reference. **Must be unique** |
| Recipient | Who received the money. Default is the vendor |
| Proof of payment | Link to the receipt (optional but recommended) |
| Finance notes | Anything else (optional) |

4. The tracker adds a new row to the ledger and shows the new remaining balance.

### What the tracker refuses (and why)
- The request is not Approved (rejected, cancelled, pending or draft).
- The amount is more than the remaining balance. Ask Peter to amend the approved amount first.
- The transaction reference was already used. Check for a duplicate.
- The currency does not match the request.
- The payment date is in the future.

Every refused attempt is written to the audit log.

### Partial payments
Record each installment as a new payment. Do not change earlier rows. The payment status changes automatically: **Awaiting Payment**, then **Partially Paid**, then **Paid** when the total equals the approved amount.

### Never edit the ledger
Ledger rows are locked. If a payment was recorded wrongly, ask the administrator to record a correcting entry. Do not delete or retype rows.

---

## 5. How the sheet works

### Tabs
1. **Executive Dashboard**: management view. Key figures, totals per currency, monthly trend, spending by category, status counts and charts.
   - **Date filter**: type a start date in C4 and an end date in E4. Leave them blank for all time.
   - **Currency**: choose the currency in G4. Cards and charts follow it. Totals for each currency are also shown separately in the table.
   - Totals are never added across currencies.
2. **Request Register**: one row per request. The main working tab. Frozen columns and headers stay visible while you scroll.
3. **Approval Queue**: formulas only. Shows what Peter needs to do. Do not type here.
4. **Finance & Payments**: payment ledger (left) and approved requests awaiting payment (right). Do not type in the ledger.
5. **Approval & Audit Log**: the history of every event (submit, decision, payment, refused attempt). Read only. Do not type here.
6. **Lists & Settings**: dropdown values (categories, currencies, payment methods), reminder thresholds and the validation report. Ask the administrator before changing these.

### Colours
- **Teal headers** on the Register: columns you type in.
- **Slate headers**: calculated or managed by the tracker.
- **Status colours** always come with the status text:
  - Pending Approval: amber
  - Approved, Paid: green
  - Rejected: red
  - Changes Requested: orange
  - Awaiting Payment: blue
  - Partially Paid: purple
  - Payment Issue: red
  - Draft, Cancelled, Not Approved: grey
- **Red dates** in the Register: an approved request is past its required payment date and not fully paid.

### Status meanings
| Approval Status | Meaning |
|---|---|
| Draft | Created, not yet submitted |
| Pending Approval | Waiting for Peter |
| Changes Requested | Peter wants changes. Requester edits and resubmits |
| Approved | Peter approved. Payable |
| Rejected | Peter refused. Not payable |
| Cancelled | Withdrawn. Kept for the record |

| Payment Status | Meaning |
|---|---|
| Not Approved | Request is not approved (no payment possible) |
| Awaiting Payment | Approved, nothing paid yet |
| Partially Paid | Some paid, balance remaining |
| Paid | Total paid equals approved amount |
| Payment Issue | Paid more than approved. Needs review |

### Calculated columns (do not type)
- **Total Paid**: sum of all ledger payments for the request.
- **Remaining Approved Balance**: approved amount minus total paid.
- **Payment Status**: calculated from the two columns above.
- **Next Action Required** and **Responsible Person**: who must act next.

### The menu: Impact Finance Tracker
| Item | Who | What it does |
|---|---|---|
| Submit Selected Request | Requesters | Sends a new or returned request for approval |
| Approve / Reject / Request Changes | Peter | Records a decision |
| Amend Approved Amount (exception) | Peter | Changes an approved amount, with a reason |
| Cancel Selected Request | Requesters (drafts, pending, changes) / Peter (approved, unpaid) | Cancels a request |
| Record Payment | David | Adds a payment to the ledger |
| Refresh Dashboard | Anyone | Rebuilds the charts |
| Run Validation Checks | Anyone (use often) | Lists problems on Lists & Settings, columns R to V |
| Send Pending Reminders | Anyone | Sends reminder emails now (also sent automatically each morning) |
| Admin > ... | Administrator only | Setup, reminder trigger, test copy |

### Automatic emails
- Peter: when a request is submitted or resubmitted, and as reminders when it waits too long.
- The requester: when the request is approved, rejected, returned for changes, or a payment is recorded.
- David: when a request is approved, and as reminders for payments due soon or overdue.

Each reminder is sent at most once a day per request.

### Things that are locked on purpose
- Approval Status, approved amount, approver, approval date and payment columns are written only by the menu.
- If someone types into a locked cell, the tracker puts the old value back and shows a message. The attempt is logged.
- The audit log and the payment ledger are append-only.

These locks protect the record. They are not a security barrier. Only share the file with the three people above.

### Common problems
| Message or symptom | What to do |
|---|---|
| "Only Peter George can approve" | You are signed in with another account. Switch to your work account and try again |
| "Locked while the request is Pending Approval" | Ask Peter to return it for changes first |
| "Transaction reference was already used" | Check the bank statement. If it is a real second payment, use a different reference |
| "Amount exceeds the remaining approved balance" | Check the amount. If more is really needed, Peter must amend the approved amount first |
| Menu item missing | Reload the page. If it is still missing, ask the administrator |
| Formula error (#REF!, #N/A) | Run Validation Checks and tell the administrator |

### Sharing
The spreadsheet must be shared as **Editor** with all four people above. Share it only with them.

---

*Last updated with the current setup. Ask the administrator if a menu item or column in your copy looks different.*
