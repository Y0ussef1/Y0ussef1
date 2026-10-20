/**
 * Request workflow: submit, approve, reject, request changes, amend, cancel.
 *
 * Each action has a pure "core" function (no dialogs, testable) and a menu wrapper
 * (menuXxx) that collects input with prompts and then calls the core.
 */

// ---------- Menu wrappers ----------

function menuSubmit() {
  guard_(function () {
    var row = selectedRegisterRow_();
    var result = submitRequestCore_(row);
    var msg = 'Submitted ' + result.id + '. Peter has been notified.';
    if (result.warnings.length) {
      msg += '\n\nWarnings:\n- ' + result.warnings.join('\n- ');
    }
    SpreadsheetApp.getUi().alert('Impact Finance Tracker', msg, SpreadsheetApp.getUi().ButtonSet.OK);
  });
}

function menuApprove() {
  guard_(function () {
    var row = selectedRegisterRow_();
    var v = registerRowValues_(row);
    var id = str_(v[REG.ID - 1]);
    requireRole_('APPROVER', id, 'APPROVE');
    var cur = str_(v[REG.CURRENCY - 1]);
    var requested = num_(v[REG.AMOUNT - 1]);
    var amountText = ask_('Approve ' + id, 'Approved amount in ' + cur + '. Requested: ' + fmtMoney_(requested, cur), String(requested));
    if (amountText === null) return;
    var comments = ask_('Approval comments', 'Optional. Required if the approved amount differs from the request.', '');
    if (comments === null) return;
    approveCore_(row, id, num_(amountText), comments);
    SpreadsheetApp.getUi().alert('Impact Finance Tracker', id + ' approved for ' + fmtMoney_(num_(amountText), cur) +
      '. David and Ramez have been notified.', SpreadsheetApp.getUi().ButtonSet.OK);
  });
}

function menuReject() {
  guard_(function () {
    var row = selectedRegisterRow_();
    var id = str_(registerRowValues_(row)[REG.ID - 1]);
    requireRole_('APPROVER', id, 'REJECT');
    var comments = ask_('Reject ' + id, 'Reason for rejection (required).', '');
    if (comments === null) return;
    rejectCore_(row, id, comments);
    SpreadsheetApp.getUi().alert('Impact Finance Tracker', id + ' rejected. Ramez has been notified.',
      SpreadsheetApp.getUi().ButtonSet.OK);
  });
}

function menuRequestChanges() {
  guard_(function () {
    var row = selectedRegisterRow_();
    var id = str_(registerRowValues_(row)[REG.ID - 1]);
    requireRole_('APPROVER', id, 'REQUEST_CHANGES');
    var comments = ask_('Request changes for ' + id, 'What must Ramez change? (required)', '');
    if (comments === null) return;
    requestChangesCore_(row, id, comments);
    SpreadsheetApp.getUi().alert('Impact Finance Tracker', id + ' returned to Ramez for changes.',
      SpreadsheetApp.getUi().ButtonSet.OK);
  });
}

function menuAmendApproved() {
  guard_(function () {
    var row = selectedRegisterRow_();
    var v = registerRowValues_(row);
    var id = str_(v[REG.ID - 1]);
    requireRole_('APPROVER', id, 'AMEND_APPROVAL');
    var cur = str_(v[REG.CURRENCY - 1]);
    var amountText = ask_('Amend approved amount: ' + id,
      'New approved amount in ' + cur + '. It cannot be lower than the total already paid.',
      String(num_(v[REG.APPROVED_AMOUNT - 1])));
    if (amountText === null) return;
    var reason = ask_('Reason for the amendment', 'Required. This is the documented exception route for changing an approved amount.', '');
    if (reason === null) return;
    amendApprovedCore_(row, id, num_(amountText), reason);
    SpreadsheetApp.getUi().alert('Impact Finance Tracker', 'Approved amount for ' + id + ' updated and logged.',
      SpreadsheetApp.getUi().ButtonSet.OK);
  });
}

function menuCancel() {
  guard_(function () {
    var row = selectedRegisterRow_();
    var id = str_(registerRowValues_(row)[REG.ID - 1]);
    var reason = ask_('Cancel ' + id, 'Reason for cancellation (required). Cancelled requests are kept for the record.', '');
    if (reason === null) return;
    cancelCore_(row, id, reason);
    SpreadsheetApp.getUi().alert('Impact Finance Tracker', id + ' cancelled and kept in the register.',
      SpreadsheetApp.getUi().ButtonSet.OK);
  });
}

// ---------- Selection helpers ----------

function selectedRegisterRow_() {
  var sh = SpreadsheetApp.getActiveSheet();
  if (sh.getName() !== SHEET_NAMES.REGISTER) {
    throw new Error('Select a request row on the "' + SHEET_NAMES.REGISTER + '" tab first.');
  }
  var row = SpreadsheetApp.getActiveRange().getRow();
  if (row < FIRST_ROW) {
    throw new Error('Select a request row (row ' + FIRST_ROW + ' or below).');
  }
  return row;
}

function registerRowValues_(row) {
  return sheet_(SHEET_NAMES.REGISTER).getRange(row, 1, 1, REG_HEADERS.length).getValues()[0];
}

function setRegisterCells_(row, updates) {
  var sh = sheet_(SHEET_NAMES.REGISTER);
  Object.keys(updates).forEach(function (key) {
    sh.getRange(row, REG[key]).setValue(updates[key]);
  });
}

/** Row number of a Request ID in the register, or 0 if not found. */
function findRegisterRowById_(requestId) {
  var sh = sheet_(SHEET_NAMES.REGISTER);
  var ids = sh.getRange(FIRST_ROW, REG.ID, CONFIG.MAX_ROWS - FIRST_ROW + 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (str_(ids[i][0]) === requestId) {
      return FIRST_ROW + i;
    }
  }
  return 0;
}

/** Ensures the row still holds the request we validated (guards against row shifts). */
function assertSameRequest_(row, expectedId) {
  var current = str_(registerRowValues_(row)[REG.ID - 1]);
  if (current !== expectedId) {
    throw new Error('The register changed while you were working. Reopen the request and try again.');
  }
}

function newRequestId_(date) {
  var year = Utilities.formatDate(date, CONFIG.TIMEZONE, 'yyyy');
  return 'REQ-' + year + '-' + padN_(nextSequence_('seq.REQ.' + year), 4);
}

// ---------- Validation ----------

/** Returns {errors, warnings} for a register row's input fields. */
function validateRequestValues_(v) {
  var errors = [];
  var warnings = [];
  if (!str_(v[REG.TITLE - 1])) errors.push('Request Title is required.');
  if (!str_(v[REG.DESCRIPTION - 1])) errors.push('Description / Business Purpose is required.');
  if (!str_(v[REG.VENDOR - 1])) errors.push('Vendor / Beneficiary is required.');
  if (listValues_(LIST_NAMES.CATEGORIES).indexOf(str_(v[REG.CATEGORY - 1])) < 0) {
    errors.push('Category must be chosen from the list.');
  }
  var amount = num_(v[REG.AMOUNT - 1]);
  if (!(amount > 0)) errors.push('Requested Amount must be a number greater than zero.');
  if (listValues_(LIST_NAMES.CURRENCIES).indexOf(str_(v[REG.CURRENCY - 1])) < 0) {
    errors.push('Currency must be chosen from the list.');
  }
  var required = toDate_(v[REG.REQUIRED_DATE - 1]);
  if (!required) {
    errors.push('Required Payment Date is missing or is not a valid date (yyyy-mm-dd).');
  } else if (required < todayStart_()) {
    warnings.push('Required Payment Date is in the past.');
  }
  var docs = str_(v[REG.DOCS - 1]);
  if (!docs) {
    warnings.push('No supporting document link. Peter may ask for one.');
  } else if (!/^https?:\/\//i.test(docs)) {
    warnings.push('Supporting document should be a full link starting with https://');
  }
  return { errors: errors, warnings: warnings };
}

// ---------- Core actions ----------

/** Ramez submits a new request, or resubmits one returned for changes. */
function submitRequestCore_(row) {
  var before = registerRowValues_(row);
  requireRole_('REQUESTER', str_(before[REG.ID - 1]), 'SUBMIT');
  var status = str_(before[REG.STATUS - 1]) || STATUS.DRAFT;
  if (status !== STATUS.DRAFT && status !== STATUS.CHANGES) {
    throw new Error('Only Draft or Changes Requested requests can be submitted. Current status: ' + status + '.');
  }
  var check = validateRequestValues_(before);
  if (check.errors.length) {
    throw new Error('Fix these before submitting:\n- ' + check.errors.join('\n- '));
  }
  var resubmit = status === STATUS.CHANGES;
  var id = '';
  withLock_(function () {
    var current = registerRowValues_(row);
    if ((str_(current[REG.STATUS - 1]) || STATUS.DRAFT) !== status) {
      throw new Error('This request changed while you were working. Check it and try again.');
    }
    var now = new Date();
    id = str_(current[REG.ID - 1]) || newRequestId_(now);
    setRegisterCells_(row, {
      ID: id,
      SUBMITTED: resubmit ? current[REG.SUBMITTED - 1] : now,
      REQUESTER: CONFIG.PEOPLE.REQUESTER.name,
      STATUS: STATUS.PENDING,
      APPROVED_AMOUNT: '',
      APPROVER: '',
      APPROVAL_DATE: '',
      COMMENTS: '',
      LAST_UPDATED: now
    });
    appendAudit_(id, resubmit ? 'RESUBMITTED' : 'SUBMITTED', status, STATUS.PENDING,
      resubmit ? 'Previous decision comments: ' + (str_(current[REG.COMMENTS - 1]) || 'none') : '', '');
  });
  notifyApprovalNeeded_(id, registerRowValues_(row));
  return { id: id, warnings: check.warnings };
}

/** Peter approves. The approved amount may differ from the request only with a comment. */
function approveCore_(row, expectedId, approvedAmount, comments) {
  var email = requireRole_('APPROVER', expectedId, 'APPROVE');
  var v = registerRowValues_(row);
  if (!(approvedAmount > 0)) {
    throw new Error('Approved amount must be greater than zero.');
  }
  if (approvedAmount !== num_(v[REG.AMOUNT - 1]) && !str_(comments)) {
    throw new Error('A comment is required when the approved amount differs from the requested amount.');
  }
  withLock_(function () {
    assertSameRequest_(row, expectedId);
    var current = registerRowValues_(row);
    var status = str_(current[REG.STATUS - 1]);
    if (status !== STATUS.PENDING) {
      throw new Error('Only Pending Approval requests can be approved. Current status: ' + status + '.');
    }
    var now = new Date();
    var cur = str_(current[REG.CURRENCY - 1]);
    setRegisterCells_(row, {
      STATUS: STATUS.APPROVED,
      APPROVED_AMOUNT: approvedAmount,
      APPROVER: CONFIG.PEOPLE.APPROVER.name + ' <' + email + '>',
      APPROVAL_DATE: now,
      COMMENTS: str_(comments),
      LAST_UPDATED: now
    });
    appendAudit_(expectedId, 'APPROVED', STATUS.PENDING, fmtMoney_(approvedAmount, cur), comments, '');
  });
  notifyDecision_(expectedId, registerRowValues_(row), 'Approved');
  notifyFinanceReady_(expectedId, registerRowValues_(row));
}

function rejectCore_(row, expectedId, comments) {
  requireRole_('APPROVER', expectedId, 'REJECT');
  if (!str_(comments)) throw new Error('A reason is required to reject a request.');
  decideFromPending_(row, expectedId, STATUS.REJECTED, comments, 'REJECTED');
  notifyDecision_(expectedId, registerRowValues_(row), STATUS.REJECTED);
}

function requestChangesCore_(row, expectedId, comments) {
  requireRole_('APPROVER', expectedId, 'REQUEST_CHANGES');
  if (!str_(comments)) throw new Error('Explain what must change.');
  decideFromPending_(row, expectedId, STATUS.CHANGES, comments, 'CHANGES_REQUESTED');
  notifyDecision_(expectedId, registerRowValues_(row), STATUS.CHANGES);
}

/** Shared path for Rejected and Changes Requested: both only come from Pending Approval. */
function decideFromPending_(row, expectedId, newStatus, comments, auditType) {
  withLock_(function () {
    assertSameRequest_(row, expectedId);
    var current = registerRowValues_(row);
    var status = str_(current[REG.STATUS - 1]);
    if (status !== STATUS.PENDING) {
      throw new Error('Only Pending Approval requests can receive this decision. Current status: ' + status + '.');
    }
    var now = new Date();
    setRegisterCells_(row, {
      STATUS: newStatus,
      APPROVER: CONFIG.PEOPLE.APPROVER.name,
      APPROVAL_DATE: now,
      COMMENTS: str_(comments),
      LAST_UPDATED: now
    });
    appendAudit_(expectedId, auditType, STATUS.PENDING, newStatus, comments, '');
  });
}

/** Documented exception route: Peter changes an approved amount, never below what is already paid. */
function amendApprovedCore_(row, expectedId, newAmount, reason) {
  requireRole_('APPROVER', expectedId, 'AMEND_APPROVAL');
  if (!(newAmount > 0)) throw new Error('Approved amount must be greater than zero.');
  if (!str_(reason)) throw new Error('A reason is required for an amendment.');
  withLock_(function () {
    assertSameRequest_(row, expectedId);
    var current = registerRowValues_(row);
    if (str_(current[REG.STATUS - 1]) !== STATUS.APPROVED) {
      throw new Error('Only Approved requests can be amended.');
    }
    var paid = paidTotalFor_(expectedId);
    if (newAmount < paid) {
      throw new Error('The new approved amount (' + newAmount + ') is below the total already paid (' + paid + ').');
    }
    var cur = str_(current[REG.CURRENCY - 1]);
    var oldAmount = num_(current[REG.APPROVED_AMOUNT - 1]);
    var now = new Date();
    setRegisterCells_(row, { APPROVED_AMOUNT: newAmount, COMMENTS: 'Amended: ' + reason, LAST_UPDATED: now });
    appendAudit_(expectedId, 'AMENDED', fmtMoney_(oldAmount, cur), fmtMoney_(newAmount, cur), reason, '');
  });
}

function cancelCore_(row, expectedId, reason) {
  if (!str_(reason)) throw new Error('A reason is required to cancel.');
  var status = str_(registerRowValues_(row)[REG.STATUS - 1]);
  if (status === STATUS.APPROVED) {
    requireRole_('APPROVER', expectedId, 'CANCEL_APPROVED');
  } else {
    requireRole_('REQUESTER', expectedId, 'CANCEL');
  }
  withLock_(function () {
    assertSameRequest_(row, expectedId);
    var current = registerRowValues_(row);
    var now = new Date();
    var currentStatus = str_(current[REG.STATUS - 1]);
    if (currentStatus === STATUS.REJECTED || currentStatus === STATUS.CANCELLED) {
      throw new Error('This request is already ' + currentStatus + '.');
    }
    if (currentStatus === STATUS.APPROVED && paidTotalFor_(expectedId) > 0) {
      throw new Error('This request has payments recorded and cannot be cancelled. Amend it or record a correction instead.');
    }
    setRegisterCells_(row, { STATUS: STATUS.CANCELLED, LAST_UPDATED: now });
    appendAudit_(expectedId, 'CANCELLED', currentStatus, STATUS.CANCELLED, reason, '');
  });
}

/** Sum of payments in the ledger for one request, read from the ledger itself. */
function paidTotalFor_(requestId) {
  return ledgerRows_().reduce(function (sum, r) {
    return r.request === requestId ? sum + num_(r.amount) : sum;
  }, 0);
}
