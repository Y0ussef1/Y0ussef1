/**
 * Payment ledger: David records payments against APPROVED requests only.
 * Ledger rows are never edited or deleted. Corrections are new, linked entries.
 */

// ---------- Menu wrapper ----------

function menuRecordPayment() {
  guard_(function () {
    var requestId = requestIdFromSelectionOrPrompt_();
    if (!requestId) return;
    requireRole_('FINANCE', requestId, 'RECORD_PAYMENT');
    var row = findRegisterRowById_(requestId);
    if (!row) throw new Error('No request with ID ' + requestId + ' exists.');
    var v = registerRowValues_(row);
    var cur = str_(v[REG.CURRENCY - 1]);
    var remaining = num_(v[REG.REMAINING - 1]) || 0;
    var methods = listValues_(LIST_NAMES.PAYMENT_METHODS);

    var amount = ask_('Record payment: ' + requestId,
      'Amount paid in ' + cur + '. Remaining approved balance: ' + fmtMoney_(remaining, cur), String(remaining));
    if (amount === null) return;
    var date = ask_('Payment date', 'Date paid (yyyy-mm-dd).', fmtDay_(new Date()));
    if (date === null) return;
    var method = ask_('Payment method', 'One of: ' + methods.join(', '), 'Bank Transfer');
    if (method === null) return;
    var reference = ask_('Transaction reference', 'Bank or payment reference. Must be unique.', '');
    if (reference === null) return;
    var recipient = ask_('Recipient', 'Who received the money?', str_(v[REG.VENDOR - 1]));
    if (recipient === null) return;
    var proof = ask_('Proof of payment', 'Link to the receipt or transfer confirmation (optional).', '');
    if (proof === null) return;
    var notes = ask_('Finance notes', 'Optional.', '');
    if (notes === null) return;

    var result = recordPaymentCore_(requestId, {
      amount: num_(amount),
      date: toDate_(date),
      dateText: date,
      method: method,
      reference: reference,
      recipient: recipient,
      proof: proof,
      notes: notes,
      currency: cur
    });
    SpreadsheetApp.getUi().alert('Impact Finance Tracker',
      'Recorded ' + result.paymentId + ' for ' + fmtMoney_(num_(amount), cur) + '.\n' +
      'Remaining balance: ' + fmtMoney_(result.remainingAfter, cur) + '\nStatus: ' + result.paymentStatus,
      SpreadsheetApp.getUi().ButtonSet.OK);
  });
}

function requestIdFromSelectionOrPrompt_() {
  var sh = SpreadsheetApp.getActiveSheet();
  if (sh.getName() === SHEET_NAMES.REGISTER && SpreadsheetApp.getActiveRange().getRow() >= FIRST_ROW) {
    var id = str_(registerRowValues_(SpreadsheetApp.getActiveRange().getRow())[REG.ID - 1]);
    if (id) return id;
  }
  return ask_('Record payment', 'Enter the Request ID, e.g. REQ-2026-0001 (or select the request row first).', '');
}

// ---------- Ledger access ----------

/** All ledger rows that hold a payment (A:N), in order. */
function ledgerRows_() {
  var sh = sheet_(SHEET_NAMES.FINANCE);
  var data = sh.getRange(FIRST_ROW, 1, CONFIG.MAX_ROWS - FIRST_ROW + 1, PAY.RECORDED_AT).getValues();
  return data.filter(function (r) {
    return str_(r[PAY.ID - 1]) !== '';
  }).map(function (r) {
    return {
      id: str_(r[PAY.ID - 1]),
      request: str_(r[PAY.REQUEST - 1]),
      amount: r[PAY.AMOUNT - 1],
      reference: str_(r[PAY.REFERENCE - 1]).toLowerCase(),
      currency: str_(r[PAY.CURRENCY - 1])
    };
  });
}

function ledgerNextRow_() {
  var sh = sheet_(SHEET_NAMES.FINANCE);
  var ids = sh.getRange(FIRST_ROW, PAY.ID, CONFIG.MAX_ROWS - FIRST_ROW + 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (str_(ids[i][0]) === '') return FIRST_ROW + i;
  }
  throw new Error('The payment ledger is full (' + CONFIG.MAX_ROWS + ' rows). Ask the administrator to extend the formulas.');
}

// ---------- Core action ----------

/**
 * Validates and appends one payment. Every rule that protects the money lives here.
 * input: {amount, date (Date), dateText, method, reference, recipient, proof, notes, currency}
 */
function recordPaymentCore_(requestId, input) {
  requireRole_('FINANCE', requestId, 'RECORD_PAYMENT');
  var row = findRegisterRowById_(requestId);
  if (!row) throw new Error('No request with ID ' + requestId + ' exists.');

  var result;
  withLock_(function () {
    assertSameRequest_(row, requestId);
    var v = registerRowValues_(row);
    var status = str_(v[REG.STATUS - 1]);
    var cur = str_(v[REG.CURRENCY - 1]);
    var approved = num_(v[REG.APPROVED_AMOUNT - 1]);

    // 1. Only approved requests can be paid. Rejected, cancelled, pending and draft are refused.
    if (status !== STATUS.APPROVED) {
      blockPayment_(requestId, 'Request status is "' + status + '". Only Approved requests can be paid.');
    }
    // 2. The approval must be recorded by Peter's action, not typed into a cell.
    if (!str_(v[REG.APPROVER - 1]) || !toDate_(v[REG.APPROVAL_DATE - 1]) || !(approved > 0)) {
      blockPayment_(requestId, 'The approval record is incomplete (approver, approval date or amount missing).');
    }
    if (!auditHas_(requestId, 'APPROVED')) {
      blockPayment_(requestId, 'No APPROVED event exists in the audit log for this request. Ask Peter to approve it through the menu.');
    }
    // 3. Basic input rules.
    if (!(input.amount > 0)) blockPayment_(requestId, 'Amount paid must be greater than zero.');
    if (!input.date) blockPayment_(requestId, 'Payment date is not a valid date (yyyy-mm-dd).');
    if (input.date > todayStart_()) blockPayment_(requestId, 'Payment date cannot be in the future.');
    if (listValues_(LIST_NAMES.PAYMENT_METHODS).indexOf(str_(input.method)) < 0) {
      blockPayment_(requestId, 'Payment method must be chosen from the list.');
    }
    if (!str_(input.reference)) blockPayment_(requestId, 'Transaction reference is required.');
    if (input.currency && input.currency !== cur) {
      blockPayment_(requestId, 'Payment currency (' + input.currency + ') does not match the request currency (' + cur + ').');
    }
    // 4. Duplicate transaction reference.
    var ref = str_(input.reference).toLowerCase();
    var ledger = ledgerRows_();
    if (ledger.some(function (r) { return r.reference === ref; })) {
      blockPayment_(requestId, 'Transaction reference "' + input.reference + '" was already used. Check for a duplicate payment.');
    }
    // 5. Never exceed the approved amount.
    var paid = ledger.reduce(function (sum, r) {
      return r.request === requestId ? sum + num_(r.amount) : sum;
    }, 0);
    var remaining = approved - paid;
    if (input.amount > remaining + 0.005) {
      blockPayment_(requestId, 'Amount ' + input.amount + ' exceeds the remaining approved balance of ' + remaining +
        '. To pay more, Peter must amend the approved amount first (Amend Approved Amount).');
    }

    // All checks passed: append one ledger row.
    var year = Utilities.formatDate(input.date, CONFIG.TIMEZONE, 'yyyy');
    var paymentId = 'PAY-' + year + '-' + padN_(nextSequence_('seq.PAY.' + year), 4);
    var target = ledgerNextRow_();
    var now = new Date();
    sheet_(SHEET_NAMES.FINANCE).getRange(target, 1, 1, PAY.RECORDED_AT).setValues([[
      paymentId,
      requestId,
      str_(v[REG.TITLE - 1]),
      approved,
      cur,
      input.date,
      input.amount,
      input.method,
      input.reference,
      str_(input.recipient) || str_(v[REG.VENDOR - 1]),
      str_(input.proof),
      actingEmail_() || 'not revealed by Google',
      str_(input.notes),
      now
    ]]);
    appendAudit_(requestId, 'PAYMENT_RECORDED', fmtMoney_(paid, cur), fmtMoney_(paid + input.amount, cur),
      'Reference ' + input.reference + (input.proof ? '' : ' (no proof link yet)'), paymentId);

    var remainingAfter = remaining - input.amount;
    result = {
      paymentId: paymentId,
      remainingAfter: remainingAfter,
      paymentStatus: remainingAfter <= 0.005 ? PAY_STATUS.PAID : PAY_STATUS.PARTIAL,
      currency: cur,
      amount: input.amount
    };
  });

  notifyPaymentRecorded_(requestId, result);
  return result;
}

/** Logs a refused payment, then throws so nothing is written. */
function blockPayment_(requestId, reason) {
  appendAudit_(requestId, 'PAYMENT_BLOCKED', '', '', reason, '');
  throw new Error(reason);
}
