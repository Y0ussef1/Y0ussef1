/**
 * Email notifications. Each one is sent by a specific, user-initiated event
 * (submit, decision, payment) or by the daily reminder trigger. Editing an
 * unrelated cell never sends mail.
 */

function requestSummary_(v) {
  var cur = str_(v[REG.CURRENCY - 1]);
  return [
    'Request ID: ' + str_(v[REG.ID - 1]),
    'Title: ' + str_(v[REG.TITLE - 1]),
    'Requester: ' + str_(v[REG.REQUESTER - 1]),
    'Category: ' + str_(v[REG.CATEGORY - 1]),
    'Vendor / beneficiary: ' + str_(v[REG.VENDOR - 1]),
    'Requested: ' + fmtMoney_(num_(v[REG.AMOUNT - 1]), cur),
    'Required payment date: ' + cellText_(v[REG.REQUIRED_DATE - 1]),
    'Supporting document: ' + (str_(v[REG.DOCS - 1]) || 'none')
  ].join('\n');
}

function notifyApprovalNeeded_(id, v) {
  sendMail_(CONFIG.PEOPLE.APPROVER.email, 'Approval needed: ' + id,
    'Hello ' + CONFIG.PEOPLE.APPROVER.name + ',\n\nA request is waiting for your decision.\n\n' +
    requestSummary_(v) + '\n\nOpen the Approval Queue, select the row and use Impact Finance Tracker > Approve / Reject / Request Changes.');
}

function notifyDecision_(id, v, decision) {
  var cur = str_(v[REG.CURRENCY - 1]);
  var extra = decision === 'Approved'
    ? '\nApproved amount: ' + fmtMoney_(num_(v[REG.APPROVED_AMOUNT - 1]), cur)
    : '';
  var action = decision === STATUS.CHANGES
    ? 'Please update the request and resubmit it (Impact Finance Tracker > Submit Selected Request).'
    : '';
  sendMail_(CONFIG.PEOPLE.REQUESTER.email, id + ' is ' + decision.toLowerCase(),
    'Hello ' + CONFIG.PEOPLE.REQUESTER.name + ',\n\nDecision: ' + decision + extra +
    '\nComments: ' + (str_(v[REG.COMMENTS - 1]) || 'none') + '\n\n' + action + '\n\n' + requestSummary_(v));
}

function notifyFinanceReady_(id, v) {
  var cur = str_(v[REG.CURRENCY - 1]);
  sendMail_(CONFIG.PEOPLE.FINANCE.email, 'Ready for payment: ' + id,
    'Hello ' + CONFIG.PEOPLE.FINANCE.name + ',\n\nThis request is approved and ready for payment.\n' +
    'Approved amount: ' + fmtMoney_(num_(v[REG.APPROVED_AMOUNT - 1]), cur) + '\n\n' + requestSummary_(v) +
    '\n\nRecord payments with Impact Finance Tracker > Record Payment.');
}

function notifyPaymentRecorded_(id, result) {
  sendMail_(CONFIG.PEOPLE.REQUESTER.email, 'Payment recorded for ' + id,
    'Hello ' + CONFIG.PEOPLE.REQUESTER.name + ',\n\nPayment ' + result.paymentId + ' of ' +
    fmtMoney_(result.amount, result.currency) + ' has been recorded.\n' +
    'Remaining approved balance: ' + fmtMoney_(result.remainingAfter, result.currency) +
    '\nPayment status: ' + result.paymentStatus);
}

// ---------- Reminders (daily trigger or menu) ----------

/** True once per day per key. Stores the last send date in Script Properties. */
function reminderDue_(key, today) {
  var props = PropertiesService.getScriptProperties();
  var k = 'rem.' + key;
  if (props.getProperty(k) === today) return false;
  props.setProperty(k, today);
  return true;
}

function menuSendReminders() {
  guard_(function () {
    var n = sendPendingReminders();
    SpreadsheetApp.getUi().alert('Impact Finance Tracker', n + ' reminder email(s) sent.',
      SpreadsheetApp.getUi().ButtonSet.OK);
  });
}

/** Sends approval reminders to Peter and payment reminders to David, at most once per day per request. */
function sendPendingReminders() {
  var today = fmtDay_(new Date());
  var now = todayStart_();
  var approvalDays = Number(setting_('SET_APPROVAL_WAIT_DAYS')) || 3;
  var warnDays = Number(setting_('SET_PAYMENT_WARN_DAYS')) || 3;
  var sh = sheet_(SHEET_NAMES.REGISTER);
  var data = sh.getRange(FIRST_ROW, 1, CONFIG.MAX_ROWS - FIRST_ROW + 1, REG_HEADERS.length).getValues();
  var log = [];

  data.forEach(function (v) {
    var id = str_(v[REG.ID - 1]);
    if (!id) return;
    var status = str_(v[REG.STATUS - 1]);
    var cur = str_(v[REG.CURRENCY - 1]);

    if (status === STATUS.PENDING) {
      var submitted = toDate_(v[REG.SUBMITTED - 1]);
      if (!submitted) return;
      var waited = Math.floor((now - submitted) / 86400000);
      if (waited >= approvalDays && reminderDue_('APPROVAL.' + id, today)) {
        sendMail_(CONFIG.PEOPLE.APPROVER.email, 'Reminder: ' + id + ' waiting ' + waited + ' days',
          'Hello ' + CONFIG.PEOPLE.APPROVER.name + ',\n\n' + id + ' has been waiting ' + waited +
          ' days for a decision.\n\n' + requestSummary_(v));
        log.push([id, 'REMINDER_SENT', 'Approval reminder to ' + CONFIG.PEOPLE.APPROVER.name + ' (' + waited + ' days waiting)']);
      }
    }

    if (status === STATUS.APPROVED && str_(v[REG.PAYMENT_STATUS - 1]) !== PAY_STATUS.PAID) {
      var required = toDate_(v[REG.REQUIRED_DATE - 1]);
      if (!required) return;
      var daysLeft = Math.floor((required - now) / 86400000);
      if (daysLeft <= warnDays && reminderDue_('PAYMENT.' + id, today)) {
        var label = daysLeft < 0 ? 'OVERDUE by ' + (-daysLeft) + ' day(s)' : 'due in ' + daysLeft + ' day(s)';
        sendMail_(CONFIG.PEOPLE.FINANCE.email, 'Payment ' + label + ': ' + id,
          'Hello ' + CONFIG.PEOPLE.FINANCE.name + ',\n\n' + id + ' is ' + label + '.\n' +
          'Remaining balance: ' + fmtMoney_(num_(v[REG.REMAINING - 1]), cur) + '\n\n' + requestSummary_(v));
        log.push([id, 'REMINDER_SENT', 'Payment reminder to ' + CONFIG.PEOPLE.FINANCE.name + ' (' + label + ')']);
      }
    }
  });

  if (log.length) {
    withLock_(function () {
      log.forEach(function (item) {
        appendAudit_(item[0], item[1], '', '', item[2], '');
      });
    });
  }
  return log.length;
}
