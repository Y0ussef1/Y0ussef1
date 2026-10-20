/**
 * Shared helpers. No business rules live here.
 */

function ss_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function sheet_(name) {
  var sh = ss_().getSheetByName(name);
  if (!sh) {
    throw new Error('Tab "' + name + '" is missing. Run Impact Finance Tracker > Admin > Set up / repair workbook.');
  }
  return sh;
}

/**
 * Runs fn while holding the script lock, so IDs, status changes and ledger
 * appends cannot interleave. Do NOT nest calls to withLock_.
 */
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error('The tracker is busy. Wait a moment and try again.');
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/** Increments a persistent counter (Script Properties) and returns the new value. */
function nextSequence_(key) {
  var props = PropertiesService.getScriptProperties();
  var next = Number(props.getProperty(key) || 0) + 1;
  props.setProperty(key, String(next));
  return next;
}

function padN_(n, width) {
  var s = String(n);
  while (s.length < width) {
    s = '0' + s;
  }
  return s;
}

function str_(v) {
  return v === null || v === undefined ? '' : String(v).trim();
}

/** Parses numbers that may contain thousands separators. Returns NaN when invalid. */
function num_(v) {
  if (typeof v === 'number') {
    return v;
  }
  var s = str_(v).replace(/,/g, '');
  return s === '' ? NaN : Number(s);
}

/** Accepts a Date or a yyyy-mm-dd string. Returns a local-midnight Date, or null. */
function toDate_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  }
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str_(v));
  if (!m) {
    return null;
  }
  var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 ? d : null;
}

function todayStart_() {
  var n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function fmtDay_(d) {
  return Utilities.formatDate(d, CONFIG.TIMEZONE, 'yyyy-MM-dd');
}

function fmtMoney_(n, cur) {
  var parts = Number(n || 0).toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return cur + ' ' + parts.join('.');
}

/** Text form of a cell value, for audit entries. */
function cellText_(v) {
  return v instanceof Date ? Utilities.formatDate(v, CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm') : str_(v);
}

/** Values of a single-column named list, blanks removed. */
function listValues_(rangeName) {
  var r = ss_().getRangeByName(rangeName);
  if (!r) {
    throw new Error('Named range ' + rangeName + ' is missing. Run Admin > Set up / repair workbook.');
  }
  return r.getValues().map(function (row) {
    return str_(row[0]);
  }).filter(function (x) {
    return x !== '';
  });
}

/** Reads one value from the Settings key/value block by named range. */
function setting_(name) {
  var r = ss_().getRangeByName(name);
  return r ? r.getValue() : '';
}

function sendMail_(to, subject, body) {
  // Test copies never email real people.
  if (str_(setting_('SET_ENVIRONMENT')) === 'TEST') {
    Logger.log('TEST mode, email not sent: ' + to + ' | ' + subject);
    return;
  }
  MailApp.sendEmail({
    to: to,
    subject: '[Impact Finance] ' + subject,
    body: body + '\n\nOpen the tracker: ' + ss_().getUrl() + '\n',
    name: 'Impact Finance Tracker'
  });
}

/** Prompts the user. Returns trimmed text, the default when blank, or null if cancelled. */
function ask_(title, message, defaultValue) {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt(title, message, ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) {
    return null;
  }
  var text = str_(res.getResponseText());
  return text === '' ? str_(defaultValue) : text;
}

/** Runs a user-facing action and shows any error as a dialog instead of a stack trace. */
function guard_(fn) {
  var ui = SpreadsheetApp.getUi();
  try {
    fn();
  } catch (err) {
    ui.alert('Impact Finance Tracker', err.message, ui.ButtonSet.OK);
  }
}
