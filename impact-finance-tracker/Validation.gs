/**
 * Validation report. Read-only checks that write findings to the report block on
 * "Lists & Settings" (columns R:V). Nothing is changed by this run.
 */

function menuRunValidation() {
  guard_(function () {
    var count = runValidationChecks();
    SpreadsheetApp.getUi().alert('Impact Finance Tracker',
      count === 0 ? 'No issues found.' : count + ' issue(s) found. See the report on "Lists & Settings" (columns R:V).',
      SpreadsheetApp.getUi().ButtonSet.OK);
  });
}

function runValidationChecks() {
  SpreadsheetApp.flush();
  var issues = [];
  var add = function (severity, area, ref, issue, fix) {
    issues.push([severity, area, ref, issue, fix]);
  };
  var today = todayStart_();
  var approvalDays = Number(setting_('SET_APPROVAL_WAIT_DAYS')) || 3;
  var regCurrencies = listValues_(LIST_NAMES.CURRENCIES);
  var regCategories = listValues_(LIST_NAMES.CATEGORIES);
  var statuses = listValues_(LIST_NAMES.APPROVAL_STATUSES);
  var methods = listValues_(LIST_NAMES.PAYMENT_METHODS);

  // ----- Request Register -----
  var reg = sheet_(SHEET_NAMES.REGISTER);
  var regRows = reg.getRange(FIRST_ROW, 1, CONFIG.MAX_ROWS - FIRST_ROW + 1, REG_HEADERS.length).getValues();
  var seenIds = {};
  var paidByRequest = {};
  ledgerRows_().forEach(function (p) {
    paidByRequest[p.request] = (paidByRequest[p.request] || 0) + num_(p.amount);
  });
  regRows.forEach(function (v, i) {
    var rowNo = FIRST_ROW + i;
    var id = str_(v[REG.ID - 1]);
    var title = str_(v[REG.TITLE - 1]);
    var status = str_(v[REG.STATUS - 1]);
    var ref = id || ('row ' + rowNo);
    if (!id && !title) return;

    if (!id) add('Error', 'Register', ref, 'Row has a title but no Request ID.', 'Select the row and run Submit Selected Request.');
    if (id && seenIds[id]) add('Error', 'Register', ref, 'Duplicate Request ID.', 'Each request must have a unique ID. Contact the administrator to renumber.');
    if (id) seenIds[id] = true;
    if (status && statuses.indexOf(status) < 0) add('Error', 'Register', ref, 'Approval status "' + status + '" is not in the list.', 'Correct the status using the menu actions.');
    if (id && !status) add('Error', 'Register', ref, 'Request has an ID but no approval status.', 'Submit it or correct the status through the menu.');

    var amount = num_(v[REG.AMOUNT - 1]);
    if (!(amount > 0)) add('Error', 'Register', ref, 'Requested amount is missing or not greater than zero.', 'Enter a positive number.');
    if (regCurrencies.indexOf(str_(v[REG.CURRENCY - 1])) < 0) add('Error', 'Register', ref, 'Currency is missing or not in the list.', 'Choose a currency from the dropdown.');
    if (regCategories.indexOf(str_(v[REG.CATEGORY - 1])) < 0) add('Warning', 'Register', ref, 'Category is missing or not in the list.', 'Choose a category from the dropdown.');
    var required = toDate_(v[REG.REQUIRED_DATE - 1]);
    var submitted = toDate_(v[REG.SUBMITTED - 1]);
    if (!required) add('Error', 'Register', ref, 'Required payment date is missing or invalid.', 'Enter a date as yyyy-mm-dd.');
    if (required && submitted && required < submitted) add('Error', 'Register', ref, 'Required payment date is before the submission date.', 'Correct the required date.');
    if (!str_(v[REG.DOCS - 1]) && (status === STATUS.PENDING || status === STATUS.APPROVED)) {
      add('Warning', 'Register', ref, 'No supporting document link.', 'Add the invoice or document link in Supporting Documents.');
    }

    var paid = paidByRequest[id] || 0;
    if (status === STATUS.APPROVED) {
      var approved = num_(v[REG.APPROVED_AMOUNT - 1]);
      if (!(approved > 0)) add('Error', 'Approval', ref, 'Approved request has no approved amount.', 'Use Amend Approved Amount (approver only).');
      if (!str_(v[REG.APPROVER - 1]) || !toDate_(v[REG.APPROVAL_DATE - 1])) {
        add('Error', 'Approval', ref, 'Approved request has no approver or approval date.', 'Approval must be recorded through Approve Selected Request. Do not type it in.');
      }
      if (!auditHas_(id, 'APPROVED')) {
        add('Error', 'Approval', ref, 'Approved status has no APPROVED event in the audit log (possible manual edit).', 'Ask the administrator to review this request and restore the approval through the audit trail.');
      }
      if (approved > 0 && paid > approved + 0.005) {
        add('Error', 'Payment', ref, 'Total paid (' + paid + ') exceeds the approved amount (' + approved + ').', 'Review the ledger. Only an approved amendment can change the approved amount.');
      }
      if (required && required < today && paid < approved - 0.005) {
        add('Warning', 'Payment', ref, 'Approved payment is overdue. Remaining: ' + (approved - paid) + ' ' + str_(v[REG.CURRENCY - 1]) + '.', 'Record the payment or agree a new date with Peter.');
      }
    } else if (paid > 0) {
      add('Error', 'Payment', ref, 'Payments exist for a request that is not Approved (status: ' + (status || 'blank') + ').', 'Payments must be reversed by the administrator. Investigate immediately.');
    }
    if (status === STATUS.PENDING) {
      var sub = toDate_(v[REG.SUBMITTED - 1]);
      if (sub && Math.floor((today - sub) / 86400000) >= approvalDays) {
        add('Warning', 'Approval', ref, 'Waiting for approval for at least ' + approvalDays + ' days.', 'Peter should decide, or use Send Pending Reminders.');
      }
    }
  });

  // Formula errors on the register and dashboard.
  scanForErrors_(reg, 'Register', add);
  scanForErrors_(sheet_(SHEET_NAMES.DASHBOARD), 'Dashboard', add);
  scanForErrors_(sheet_(SHEET_NAMES.QUEUE), 'Queue', add);

  // ----- Payment ledger -----
  var fin = sheet_(SHEET_NAMES.FINANCE);
  var pays = fin.getRange(FIRST_ROW, 1, CONFIG.MAX_ROWS - FIRST_ROW + 1, PAY_HEADERS.length - 1).getValues();
  var payIds = {};
  var refs = {};
  pays.forEach(function (p, i) {
    var pid = str_(p[PAY.ID - 1]);
    if (!pid) return;
    var rowNo = FIRST_ROW + i;
    var reqId = str_(p[PAY.REQUEST - 1]);
    var ref = pid + ' (row ' + rowNo + ')';
    if (payIds[pid]) add('Error', 'Payment', ref, 'Duplicate Payment ID.', 'Contact the administrator.');
    payIds[pid] = true;
    var rr = findRegisterRowById_(reqId);
    if (!rr) {
      add('Error', 'Payment', ref, 'Request ID "' + reqId + '" does not exist in the register.', 'Link the payment to a valid Request ID.');
    } else {
      var rv = registerRowValues_(rr);
      if (str_(rv[REG.STATUS - 1]) !== STATUS.APPROVED) {
        add('Error', 'Payment', ref, 'Payment is linked to a request that is not Approved.', 'Investigate. Rejected or cancelled requests must not be paid.');
      }
      if (str_(rv[REG.CURRENCY - 1]) !== str_(p[PAY.CURRENCY - 1])) {
        add('Error', 'Payment', ref, 'Payment currency does not match the request currency.', 'Investigate the payment record.');
      }
    }
    if (!(num_(p[PAY.AMOUNT - 1]) > 0)) add('Error', 'Payment', ref, 'Amount paid is not greater than zero.', 'Investigate the payment record.');
    if (methods.indexOf(str_(p[PAY.METHOD - 1])) < 0) add('Warning', 'Payment', ref, 'Payment method is not in the list.', 'Check the payment method.');
    var r = str_(p[PAY.REFERENCE - 1]).toLowerCase();
    if (r) {
      if (refs[r]) add('Error', 'Payment', ref, 'Duplicate transaction reference (also on row ' + refs[r] + ').', 'Confirm with the bank whether this is a second payment.');
      else refs[r] = rowNo;
    }
    if (!str_(p[PAY.PROOF - 1])) add('Warning', 'Payment', ref, 'No proof-of-payment link.', 'Add the receipt or transfer confirmation link.');
  });

  // ----- Audit log -----
  var aud = sheet_(SHEET_NAMES.AUDIT);
  var audRows = aud.getLastRow() >= FIRST_ROW
    ? aud.getRange(FIRST_ROW, 1, aud.getLastRow() - FIRST_ROW + 1, AUD_HEADERS.length).getValues() : [];
  var evtIds = {};
  audRows.forEach(function (a, i) {
    var eid = str_(a[AUD.ID - 1]);
    if (!eid) return;
    if (evtIds[eid]) add('Error', 'Audit', eid, 'Duplicate Event ID.', 'Contact the administrator. Event IDs must be unique.');
    evtIds[eid] = true;
    if (str_(a[AUD.TYPE - 1]) === 'UNAUTHORIZED_ATTEMPT') {
      add('Info', 'Audit', eid, 'Unauthorized approval or payment attempt logged for request ' + str_(a[AUD.REQUEST - 1]) + '.', 'Review who attempted it. No change was made.');
    }
  });

  writeReport_(issues);
  return issues.filter(function (x) { return x[0] !== 'Info'; }).length;
}

function scanForErrors_(sh, area, add) {
  var range = sh.getDataRange();
  var values = range.getDisplayValues();
  var errorPattern = /^#(REF!|N\/A|VALUE!|DIV\/0!|NAME\?|NUM!|NULL!|ERROR!)/;
  var found = 0;
  values.forEach(function (row, i) {
    row.forEach(function (cell, j) {
      if (errorPattern.test(String(cell)) && found < 20) {
        found++;
        add('Error', 'Formula', area + '!' + columnLetter_(j + 1) + (i + 1), 'Formula error ' + cell + '.', 'Check the formula or the referenced column. Re-run Setup if formulas were damaged.');
      }
    });
  });
}

function columnLetter_(n) {
  var s = '';
  while (n > 0) {
    var m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Writes the report to Lists & Settings columns R:V, replacing the previous run. */
function writeReport_(issues) {
  var sh = sheet_(SHEET_NAMES.SETTINGS);
  sh.getRange(FIRST_ROW, 18, 300, 5).clearContent().clearFormat();
  var order = { Error: 0, Warning: 1, Info: 2 };
  issues.sort(function (a, b) { return order[a[0]] - order[b[0]]; });
  if (issues.length === 0) {
    sh.getRange(FIRST_ROW, 18, 1, 5).setValues([['OK', 'All', '-', 'No issues found.', '-']]);
    sh.getRange(FIRST_ROW, 18).setFontColor('#166534').setFontWeight('bold');
    return;
  }
  sh.getRange(FIRST_ROW, 18, issues.length, 5).setValues(issues);
  var sevRange = sh.getRange(FIRST_ROW, 18, issues.length, 1);
  sevRange.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Error').setBackground('#FECACA').setFontColor('#991B1B').setBold(true).setRanges([sevRange]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Warning').setBackground('#FDE68A').setFontColor('#92400E').setRanges([sevRange]).build(),
    SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo('Info').setBackground('#E0F2FE').setFontColor('#075985').setRanges([sevRange]).build()
  ]);
  sh.getRange(FIRST_ROW, 21, issues.length, 2).setWrap(true);
}
