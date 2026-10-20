/**
 * Scenario tests A to H. RUN ONLY ON A COPY of the workbook.
 *
 * Safety: refuses to run unless Lists & Settings > Environment = TEST.
 * Identity: the test sets TEST_IDENTITY_OVERRIDE only for the duration of the run,
 * so each step acts as the right person. Menu users can never set it.
 *
 * Results are written to the Logger and shown in a dialog. Test rows are created
 * in the append-only ledger and audit log of the TEST copy, which is why the copy
 * must be disposable.
 */

function menuRunTests() {
  guard_(function () {
    var lines = runTestScenarios();
    SpreadsheetApp.getUi().alert('Test scenarios', lines.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
  });
}

function runTestScenarios() {
  if (str_(setting_('SET_ENVIRONMENT')) !== 'TEST') {
    throw new Error('Set "Environment" to TEST on Lists & Settings before running tests. Never run tests on the live workbook.');
  }
  var results = [];
  var check = function (name, fn) {
    try {
      fn();
      results.push('PASS  ' + name);
    } catch (err) {
      results.push('FAIL  ' + name + ' :: ' + err.message);
    }
  };
  var eq = function (actual, expected, what) {
    if (actual !== expected) throw new Error(what + ' expected [' + expected + '] got [' + actual + ']');
  };
  var as = function (role) {
    TEST_IDENTITY_OVERRIDE = role ? CONFIG.PEOPLE[role].email.toLowerCase() : 'intruder@example.com';
  };
  var expectThrow = function (fn, what) {
    try { fn(); } catch (err) { return; }
    throw new Error(what + ' should have been refused');
  };
  var reg = function (id) {
    var row = findRegisterRowById_(id);
    return registerRowValues_(row);
  };

  try {
    // Scenario A: fully paid.
    var a = newTestRow_('TEST A: fully paid', 1000, 'USD');
    as('REQUESTER'); var aId = submitRequestCore_(a).id;
    as('APPROVER'); approveCore_(findRegisterRowById_(aId), aId, 1000, '');
    as('FINANCE'); recordPaymentCore_(aId, testPayment_(1000, 'TEST-A-1', 'USD'));
    check('A: fully paid request shows Paid, zero balance', function () {
      SpreadsheetApp.flush();
      var v = reg(aId);
      eq(num_(v[REG.APPROVED_AMOUNT - 1]), 1000, 'approved');
      eq(num_(v[REG.TOTAL_PAID - 1]), 1000, 'total paid');
      eq(num_(v[REG.REMAINING - 1]), 0, 'remaining');
      eq(str_(v[REG.PAYMENT_STATUS - 1]), 'Paid', 'payment status');
    });

    // Scenario B: partial then final payment.
    var b = newTestRow_('TEST B: partial', 5000, 'USD');
    as('REQUESTER'); var bId = submitRequestCore_(b).id;
    as('APPROVER'); approveCore_(findRegisterRowById_(bId), bId, 5000, '');
    as('FINANCE'); recordPaymentCore_(bId, testPayment_(2000, 'TEST-B-1', 'USD'));
    check('B: partial payment shows Partially Paid and 3000 remaining', function () {
      SpreadsheetApp.flush();
      var v = reg(bId);
      eq(num_(v[REG.TOTAL_PAID - 1]), 2000, 'total paid');
      eq(num_(v[REG.REMAINING - 1]), 3000, 'remaining');
      eq(str_(v[REG.PAYMENT_STATUS - 1]), 'Partially Paid', 'payment status');
    });
    recordPaymentCore_(bId, testPayment_(3000, 'TEST-B-2', 'USD'));
    check('B: second installment completes to Paid', function () {
      SpreadsheetApp.flush();
      var v = reg(bId);
      eq(num_(v[REG.TOTAL_PAID - 1]), 5000, 'total paid');
      eq(str_(v[REG.PAYMENT_STATUS - 1]), 'Paid', 'payment status');
    });

    // Scenario C: rejected request cannot be paid.
    var c = newTestRow_('TEST C: rejected', 800, 'USD');
    as('REQUESTER'); var cId = submitRequestCore_(c).id;
    as('APPROVER'); rejectCore_(findRegisterRowById_(cId), cId, 'Test rejection');
    check('C: rejected request is Rejected and cannot be paid', function () {
      eq(str_(reg(cId)[REG.STATUS - 1]), 'Rejected', 'status');
      as('FINANCE');
      expectThrow(function () { recordPaymentCore_(cId, testPayment_(800, 'TEST-C-1', 'USD')); }, 'payment on rejected request');
    });

    // Scenario D: pending request appears in the queue.
    var d = newTestRow_('TEST D: pending', 300, 'USD');
    as('REQUESTER'); var dId = submitRequestCore_(d).id;
    check('D: pending request appears in Approval Queue', function () {
      SpreadsheetApp.flush();
      var ids = sheet_(SHEET_NAMES.QUEUE).getRange(FIRST_ROW, 1, 200, 1).getValues().map(function (r) { return str_(r[0]); });
      if (ids.indexOf(dId) < 0) throw new Error(dId + ' not in queue');
    });

    // Scenario E: unauthorized approval is refused and logged.
    check('E: unauthorized approval refused and logged', function () {
      as(null);
      expectThrow(function () { approveCore_(findRegisterRowById_(dId), dId, 300, ''); }, 'approval by unknown account');
      if (!auditHas_(dId, 'UNAUTHORIZED_ATTEMPT')) throw new Error('no UNAUTHORIZED_ATTEMPT in audit log');
      eq(str_(reg(dId)[REG.STATUS - 1]), 'Pending Approval', 'status after refused approval');
    });

    // Scenario F: duplicate transaction reference is blocked.
    var f = newTestRow_('TEST F: duplicate ref', 1000, 'USD');
    as('REQUESTER'); var fId = submitRequestCore_(f).id;
    as('APPROVER'); approveCore_(findRegisterRowById_(fId), fId, 1000, '');
    as('FINANCE');
    recordPaymentCore_(fId, testPayment_(400, 'TEST-F-DUP', 'USD'));
    check('F: same transaction reference twice is blocked', function () {
      expectThrow(function () { recordPaymentCore_(fId, testPayment_(400, 'TEST-F-DUP', 'USD')); }, 'duplicate reference');
    });

    // Scenario G: EUR and USD stay separate.
    var g = newTestRow_('TEST G: EUR', 700, 'EUR');
    as('REQUESTER'); submitRequestCore_(g);
    check('G: dashboard lists currencies on separate rows', function () {
      SpreadsheetApp.flush();
      var labels = sheet_(SHEET_NAMES.DASHBOARD).getRange(19, 2, 6, 1).getDisplayValues().map(function (r) { return r[0]; });
      if (labels.indexOf('EUR') < 0 || labels.indexOf('USD') < 0) throw new Error('currency rows missing: ' + labels.join(','));
      if (labels.indexOf('EUR') === labels.indexOf('USD')) throw new Error('currencies share a row');
    });

    // Scenario H: payment above the approved amount is blocked.
    var h = newTestRow_('TEST H: overpay', 500, 'USD');
    as('REQUESTER'); var hId = submitRequestCore_(h).id;
    as('APPROVER'); approveCore_(findRegisterRowById_(hId), hId, 500, '');
    check('H: payment above approved amount is blocked', function () {
      as('FINANCE');
      expectThrow(function () { recordPaymentCore_(hId, testPayment_(600, 'TEST-H-1', 'USD')); }, 'overpayment');
      eq(num_(reg(hId)[REG.TOTAL_PAID - 1]), 0, 'total paid after blocked overpayment');
    });
  } catch (err) {
    results.push('ERROR ' + err.message);
  } finally {
    TEST_IDENTITY_OVERRIDE = '';
  }
  Logger.log(results.join('\n'));
  return results;
}

/** Writes an input row for a test request at the next empty register row. */
function newTestRow_(title, amount, currency) {
  var sh = sheet_(SHEET_NAMES.REGISTER);
  var ids = sh.getRange(FIRST_ROW, REG.ID, CONFIG.MAX_ROWS - FIRST_ROW + 1, 1).getValues();
  var row = 0;
  for (var i = 0; i < ids.length; i++) {
    if (str_(ids[i][0]) === '' && str_(sh.getRange(FIRST_ROW + i, REG.TITLE).getValue()) === '') {
      row = FIRST_ROW + i;
      break;
    }
  }
  if (!row) throw new Error('No empty register row for tests');
  sh.getRange(row, REG.TITLE).setValue('TEST · ' + title);
  sh.getRange(row, REG.DESCRIPTION).setValue('Fictitious test request');
  sh.getRange(row, REG.CATEGORY).setValue('Other');
  sh.getRange(row, REG.VENDOR).setValue('Test vendor');
  sh.getRange(row, REG.AMOUNT).setValue(amount);
  sh.getRange(row, REG.CURRENCY).setValue(currency);
  sh.getRange(row, REG.REQUIRED_DATE).setValue(new Date(new Date().getFullYear(), 11, 31));
  sh.getRange(row, REG.DOCS).setValue('https://example.com/test-invoice');
  SpreadsheetApp.flush();
  return row;
}

function testPayment_(amount, reference, currency) {
  return {
    amount: amount,
    date: todayStart_(),
    dateText: fmtDay_(new Date()),
    method: 'Bank Transfer',
    reference: reference,
    recipient: 'Test vendor',
    proof: 'https://example.com/test-proof',
    notes: 'Fictitious test payment',
    currency: currency
  };
}
