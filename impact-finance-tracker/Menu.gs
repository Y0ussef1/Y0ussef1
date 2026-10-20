/**
 * Custom menu and edit guard.
 */

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  var admin = ui.createMenu('Admin')
    .addItem('Set up / repair workbook', 'menuSetupWorkbook')
    .addItem('Install daily reminder trigger', 'menuInstallTriggers')
    .addItem('Run test scenarios (TEST copy only)', 'menuRunTests');
  ui.createMenu('Impact Finance Tracker')
    .addItem('Submit Selected Request', 'menuSubmit')
    .addItem('Approve Selected Request', 'menuApprove')
    .addItem('Reject Selected Request', 'menuReject')
    .addItem('Request Changes', 'menuRequestChanges')
    .addItem('Amend Approved Amount (exception)', 'menuAmendApproved')
    .addItem('Cancel Selected Request', 'menuCancel')
    .addSeparator()
    .addItem('Record Payment', 'menuRecordPayment')
    .addSeparator()
    .addItem('Refresh Dashboard', 'menuRefreshDashboard')
    .addItem('Run Validation Checks', 'menuRunValidation')
    .addItem('Send Pending Reminders', 'menuSendReminders')
    .addSeparator()
    .addSubMenu(admin)
    .addToUi();
}

/** Columns on the register that the requester may edit, and that are locked after submission. */
var EDIT_LOCKED_STATUSES = [STATUS.PENDING, STATUS.APPROVED, STATUS.REJECTED, STATUS.CANCELLED];

/**
 * Simple trigger. Reverts manual edits to script-managed cells, to business fields after
 * submission, and to the payment ledger and audit log. Script writes do not fire onEdit.
 * Single-cell edits are reverted exactly. Multi-cell edits are flagged in a toast, and
 * the validation report catches any inconsistency.
 */
function onEdit(e) {
  if (!e || !e.range) return;
  var sh = e.range.getSheet();
  var name = sh.getName();
  var row = e.range.getRow();
  var col = e.range.getColumn();
  var single = e.range.getNumRows() === 1 && e.range.getNumColumns() === 1;

  if (name === SHEET_NAMES.AUDIT && row >= FIRST_ROW) {
    return revertOrWarn_(e, single, 'The audit log is append-only. Use the menu actions instead.', 'Audit edit reverted.');
  }
  if (name === SHEET_NAMES.FINANCE && row >= FIRST_ROW && col <= PAY.FLAG - 1) {
    return revertOrWarn_(e, single, 'Payments are recorded only with Impact Finance Tracker > Record Payment.', 'Ledger edit reverted.');
  }
  if (name !== SHEET_NAMES.REGISTER || row < FIRST_ROW) return;

  if (!single) {
    var touchesScript = REG_SCRIPT_COLS.some(function (c) {
      return c >= col && c < col + e.range.getNumColumns();
    });
    if (touchesScript) {
      SpreadsheetApp.getActive().toast('Bulk edit touched tracker-managed columns. Run Validation Checks.', 'Impact Finance Tracker', 8);
    }
    return;
  }

  if (REG_SCRIPT_COLS.indexOf(col) >= 0) {
    return revertOrWarn_(e, true, 'This column is managed by the tracker. Use the Impact Finance Tracker menu.', 'Edit reverted.');
  }
  if (REG_BUSINESS_COLS.indexOf(col) >= 0) {
    var status = str_(sh.getRange(row, REG.STATUS).getValue());
    if (EDIT_LOCKED_STATUSES.indexOf(status) >= 0) {
      return revertOrWarn_(e, true, 'Locked while the request is ' + status + '. Ask Peter to request changes first.', 'Edit reverted.');
    }
  }
}

/** Restores the old value and tells the user. Logs the attempt to the audit log. */
function revertOrWarn_(e, single, message, label) {
  if (!single) {
    SpreadsheetApp.getActive().toast(message, 'Impact Finance Tracker', 8);
    return;
  }
  var old = e.oldValue === undefined ? '' : e.oldValue;
  e.range.setValue(old);
  SpreadsheetApp.getActive().toast(message, 'Impact Finance Tracker', 8);
  var sheetName = e.range.getSheet().getName();
  var rowNo = e.range.getRow();
  var reqId = sheetName === SHEET_NAMES.REGISTER ? str_(e.range.getSheet().getRange(rowNo, REG.ID).getValue()) : '';
  withLock_(function () {
    appendAudit_(reqId, 'MANUAL_EDIT_REVERTED', e.value === undefined ? '' : e.value, old,
      label + ' ' + sheetName + '!' + e.range.getA1Notation(), '');
  });
}
