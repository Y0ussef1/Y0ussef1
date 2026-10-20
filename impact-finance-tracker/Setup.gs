/**
 * Setup and repair.
 *
 * Safe to re-run. It creates missing tabs, headers, named ranges, dropdowns,
 * formulas, formats and protections. It never deletes or overwrites data rows,
 * and it only writes list values into cells that are still blank.
 */

function menuSetupWorkbook() {
  guard_(setupWorkbook);
}

function setupWorkbook() {
  var ui = SpreadsheetApp.getUi();
  var answer = ui.alert('Set up / repair workbook',
    'This creates missing tabs, headers, dropdowns, formulas, named ranges and formatting.\n\n' +
    'It does NOT delete or overwrite existing request, payment or audit rows.\n\nContinue?',
    ui.ButtonSet.OK_CANCEL);
  if (answer !== ui.Button.OK) return;

  ensureTabs_();
  writeSettings_();
  defineNamedRanges_();
  buildRegister_();
  buildFinance_();
  buildQueue_();
  buildAudit_();
  buildDashboard_();
  buildCharts_();
  ui.alert('Setup complete. Next: Admin > Install daily reminder trigger, then share the file (see README.md).',
    ui.ButtonSet.OK);
}

function menuInstallTriggers() {
  guard_(function () {
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (t.getHandlerFunction() === 'sendPendingReminders') {
        ScriptApp.deleteTrigger(t);
      }
    });
    ScriptApp.newTrigger('sendPendingReminders').timeBased().everyDays(1).atHour(CONFIG.REMINDER_HOUR).create();
    SpreadsheetApp.getUi().alert('Impact Finance Tracker',
      'Daily reminder trigger installed. It runs around ' + CONFIG.REMINDER_HOUR + ':00 (script time zone).',
      SpreadsheetApp.getUi().ButtonSet.OK);
  });
}

// ---------- Tabs ----------

function ensureTabs_() {
  var book = ss_();
  var order = [SHEET_NAMES.DASHBOARD, SHEET_NAMES.REGISTER, SHEET_NAMES.QUEUE,
    SHEET_NAMES.FINANCE, SHEET_NAMES.AUDIT, SHEET_NAMES.SETTINGS];
  var blank = book.getSheetByName('Sheet1');
  order.forEach(function (name, i) {
    var sh = book.getSheetByName(name) || book.insertSheet(name);
    book.setActiveSheet(sh);
    book.moveActiveSheet(i + 1);
  });
  // Remove the default empty tab that Google creates in a new spreadsheet.
  if (blank && blank.getLastRow() === 0 && blank.getLastColumn() === 0 && book.getSheets().length > 1) {
    book.deleteSheet(blank);
  }
  var tabColors = {};
  tabColors[SHEET_NAMES.DASHBOARD] = COLORS.NAVY;
  tabColors[SHEET_NAMES.REGISTER] = COLORS.TEAL;
  tabColors[SHEET_NAMES.QUEUE] = '#B45309';
  tabColors[SHEET_NAMES.FINANCE] = '#15803D';
  tabColors[SHEET_NAMES.AUDIT] = COLORS.SLATE;
  tabColors[SHEET_NAMES.SETTINGS] = '#94A3B8';
  order.forEach(function (name) {
    book.getSheetByName(name).setTabColor(tabColors[name]);
  });
}

// ---------- Settings and lists ----------

function writeSettings_() {
  var sh = sheet_(SHEET_NAMES.SETTINGS);
  banner_(sh, 'LISTS & SETTINGS',
    'Edit dropdown values in the blue columns. Approver and finance identities are set in Config.gs, not here.', 18);

  headerRow_(sh, ['Team', 'Role', 'Email (set in Config.gs)'], 1);
  sh.getRange(FIRST_ROW, 1, 3, 3).setValues([
    [CONFIG.PEOPLE.REQUESTER.name, 'Requester', CONFIG.PEOPLE.REQUESTER.email],
    [CONFIG.PEOPLE.APPROVER.name, 'Approver', CONFIG.PEOPLE.APPROVER.email],
    [CONFIG.PEOPLE.FINANCE.name, 'Finance / payer', CONFIG.PEOPLE.FINANCE.email]
  ]);
  protectOnce_(sh.getRange(FIRST_ROW, 1, 3, 3), 'Impact Finance Tracker: team identities are set in code');

  var lists = [
    { col: 5, header: 'Expense Categories', name: LIST_NAMES.CATEGORIES, values: DEFAULT_LISTS.CATEGORIES },
    { col: 7, header: 'Currencies', name: LIST_NAMES.CURRENCIES, values: DEFAULT_LISTS.CURRENCIES },
    { col: 9, header: 'Payment Methods', name: LIST_NAMES.PAYMENT_METHODS, values: DEFAULT_LISTS.PAYMENT_METHODS },
    { col: 11, header: 'Approval Statuses', name: LIST_NAMES.APPROVAL_STATUSES, values: DEFAULT_LISTS.APPROVAL_STATUSES },
    { col: 13, header: 'Payment Statuses', name: LIST_NAMES.PAYMENT_STATUSES, values: DEFAULT_LISTS.PAYMENT_STATUSES }
  ];
  lists.forEach(function (l) {
    headerRow_(sh, [l.header], l.col);
    var body = sh.getRange(FIRST_ROW, l.col, 60, 1);
    if (str_(body.getCell(1, 1).getValue()) === '') {
      sh.getRange(FIRST_ROW, l.col, l.values.length, 1).setValues(l.values.map(function (x) { return [x]; }));
    }
    body.setBackground('#EFF6FF').setFontColor(COLORS.INK);
  });

  headerRow_(sh, ['Setting', 'Value'], 15);
  sh.getRange(FIRST_ROW, 15, 5, 1).setValues([
    ['Approval wait before reminder (days)'],
    ['Payment due warning (days)'],
    ['Environment (LIVE or TEST)'],
    ['Default reporting currency'],
    ['FX conversion']
  ]);
  var current = sh.getRange(FIRST_ROW, 16, 5, 1).getValues();
  var defaults = [[3], [3], ['LIVE'], [DEFAULT_LISTS.CURRENCIES[0]], ['Not implemented: totals are shown per currency']];
  sh.getRange(FIRST_ROW, 16, 5, 1).setValues(current.map(function (row, i) {
    return str_(row[0]) === '' ? defaults[i] : row;
  }));
  sh.getRange(FIRST_ROW, 16, 4, 1).setBackground('#EFF6FF');

  headerRow_(sh, ['Severity', 'Area', 'Reference', 'Issue', 'How to fix'], 18);
  sh.getRange(FIRST_ROW, 18, 1, 1).setValue('Run Validation Checks to fill this report.');
  sh.getRange(FIRST_ROW, 18, 1, 1).setFontColor(COLORS.MUTED).setFontStyle('italic');

  sh.setColumnWidth(1, 150); sh.setColumnWidth(2, 110); sh.setColumnWidth(3, 230);
  sh.setColumnWidth(4, 20);
  [5, 7, 9, 11, 13].forEach(function (c) { sh.setColumnWidth(c, 180); });
  [6, 8, 10, 12, 14].forEach(function (c) { sh.setColumnWidth(c, 16); });
  sh.setColumnWidth(15, 240); sh.setColumnWidth(16, 240); sh.setColumnWidth(17, 20);
  sh.setColumnWidth(18, 90); sh.setColumnWidth(19, 110); sh.setColumnWidth(20, 180);
  sh.setColumnWidth(21, 380); sh.setColumnWidth(22, 380);
  sh.setFrozenRows(HEADER_ROW);
}

// ---------- Named ranges ----------

function defineNamedRanges_() {
  var book = ss_();
  var sh = sheet_(SHEET_NAMES.REGISTER);
  var fin = sheet_(SHEET_NAMES.FINANCE);
  var n = CONFIG.MAX_ROWS - FIRST_ROW + 1;
  var defs = {
    REG_ID: sh.getRange(FIRST_ROW, REG.ID, n, 1),
    REG_SUBMITTED: sh.getRange(FIRST_ROW, REG.SUBMITTED, n, 1),
    REG_REQUESTER: sh.getRange(FIRST_ROW, REG.REQUESTER, n, 1),
    REG_TITLE: sh.getRange(FIRST_ROW, REG.TITLE, n, 1),
    REG_CATEGORY: sh.getRange(FIRST_ROW, REG.CATEGORY, n, 1),
    REG_AMOUNT: sh.getRange(FIRST_ROW, REG.AMOUNT, n, 1),
    REG_CURRENCY: sh.getRange(FIRST_ROW, REG.CURRENCY, n, 1),
    REG_REQUIRED: sh.getRange(FIRST_ROW, REG.REQUIRED_DATE, n, 1),
    REG_DOCS: sh.getRange(FIRST_ROW, REG.DOCS, n, 1),
    REG_STATUS: sh.getRange(FIRST_ROW, REG.STATUS, n, 1),
    REG_APPROVED: sh.getRange(FIRST_ROW, REG.APPROVED_AMOUNT, n, 1),
    REG_APPROVER: sh.getRange(FIRST_ROW, REG.APPROVER, n, 1),
    REG_APPROVAL_DATE: sh.getRange(FIRST_ROW, REG.APPROVAL_DATE, n, 1),
    REG_COMMENTS: sh.getRange(FIRST_ROW, REG.COMMENTS, n, 1),
    REG_PAID: sh.getRange(FIRST_ROW, REG.TOTAL_PAID, n, 1),
    REG_REMAINING: sh.getRange(FIRST_ROW, REG.REMAINING, n, 1),
    REG_PAY_STATUS: sh.getRange(FIRST_ROW, REG.PAYMENT_STATUS, n, 1),
    REG_NEXT: sh.getRange(FIRST_ROW, REG.NEXT_ACTION, n, 1),
    REG_RESPONSIBLE: sh.getRange(FIRST_ROW, REG.RESPONSIBLE, n, 1),
    PAY_ID: fin.getRange(FIRST_ROW, PAY.ID, n, 1),
    PAY_REQUEST: fin.getRange(FIRST_ROW, PAY.REQUEST, n, 1),
    PAY_CURRENCY: fin.getRange(FIRST_ROW, PAY.CURRENCY, n, 1),
    PAY_DATE: fin.getRange(FIRST_ROW, PAY.DATE, n, 1),
    PAY_AMOUNT: fin.getRange(FIRST_ROW, PAY.AMOUNT, n, 1),
    PAY_REFERENCE: fin.getRange(FIRST_ROW, PAY.REFERENCE, n, 1),
    DASH_FROM: sheet_(SHEET_NAMES.DASHBOARD).getRange('C4'),
    DASH_TO: sheet_(SHEET_NAMES.DASHBOARD).getRange('E4'),
    DASH_CUR: sheet_(SHEET_NAMES.DASHBOARD).getRange('G4'),
    RPT_FROM: sheet_(SHEET_NAMES.DASHBOARD).getRange('P4'),
    RPT_TO: sheet_(SHEET_NAMES.DASHBOARD).getRange('P5'),
    SET_APPROVAL_WAIT_DAYS: sheet_(SHEET_NAMES.SETTINGS).getRange('P5'),
    SET_PAYMENT_WARN_DAYS: sheet_(SHEET_NAMES.SETTINGS).getRange('P6'),
    SET_ENVIRONMENT: sheet_(SHEET_NAMES.SETTINGS).getRange('P7'),
    SET_DEFAULT_CURRENCY: sheet_(SHEET_NAMES.SETTINGS).getRange('P8')
  };
  var settings = sheet_(SHEET_NAMES.SETTINGS);
  defs[LIST_NAMES.CATEGORIES] = settings.getRange(FIRST_ROW, 5, 60, 1);
  defs[LIST_NAMES.CURRENCIES] = settings.getRange(FIRST_ROW, 7, 60, 1);
  defs[LIST_NAMES.PAYMENT_METHODS] = settings.getRange(FIRST_ROW, 9, 60, 1);
  defs[LIST_NAMES.APPROVAL_STATUSES] = settings.getRange(FIRST_ROW, 11, 60, 1);
  defs[LIST_NAMES.PAYMENT_STATUSES] = settings.getRange(FIRST_ROW, 13, 60, 1);

  var names = Object.keys(defs);
  book.getNamedRanges().forEach(function (nr) {
    if (names.indexOf(nr.getName()) >= 0) nr.remove();
  });
  names.forEach(function (name) {
    book.setNamedRange(name, defs[name]);
  });
}

// ---------- Shared styling ----------

function banner_(sh, title, subtitle, cols) {
  sh.getRange(1, 1, 1, cols).merge().setValue(title)
    .setBackground(COLORS.NAVY).setFontColor(COLORS.WHITE)
    .setFontSize(16).setFontWeight('bold').setVerticalAlignment('middle')
    .setHorizontalAlignment('left');
  sh.getRange(2, 1, 1, cols).merge().setValue(subtitle)
    .setBackground('#334155').setFontColor('#E2E8F0')
    .setFontSize(10).setFontStyle('italic').setVerticalAlignment('middle');
  sh.setRowHeight(1, 44);
  sh.setRowHeight(2, 26);
  sh.setRowHeight(3, 8);
}

/** Writes a styled header row. Values are written only into blank cells, so existing headers are kept. */
function headerRow_(sh, headers, startCol, row) {
  var col = startCol || 1;
  var r = row || HEADER_ROW;
  var range = sh.getRange(r, col, 1, headers.length);
  if (str_(sh.getRange(r, col).getValue()) === '') {
    range.setValues([headers]);
  }
  range.setBackground(COLORS.NAVY).setFontColor(COLORS.WHITE).setFontWeight('bold')
    .setWrap(true).setVerticalAlignment('middle').setHorizontalAlignment('left');
  if (r === HEADER_ROW) {
    sh.setRowHeight(r, 40);
  }
}

/** Warning-only protection. Scripts still write (they run as the editor), so this is advisory. */
function protectOnce_(range, description) {
  range.protect().setDescription(description).setWarningOnly(true);
}

/** Removes only the protections this tracker created, so re-running setup is idempotent. */
function clearTrackerProtections_(sh) {
  sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(function (p) {
    if (str_(p.getDescription()).indexOf('Impact Finance Tracker') === 0) p.remove();
  });
  sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(function (p) {
    if (str_(p.getDescription()).indexOf('Impact Finance Tracker') === 0) p.remove();
  });
}

function listRule_(rangeName) {
  return SpreadsheetApp.newDataValidation()
    .requireValueInRange(ss_().getRangeByName(rangeName), true)
    .setAllowInvalid(false).build();
}

function statusRules_(range) {
  return Object.keys(STATUS_STYLE).map(function (text) {
    return SpreadsheetApp.newConditionalFormatRule().whenTextEqualTo(text)
      .setBackground(STATUS_STYLE[text][0]).setFontColor(STATUS_STYLE[text][1])
      .setRanges([range]).build();
  });
}

function fill_(sh, col, n, values) {
  sh.getRange(FIRST_ROW, col, n, 1).setFormulas(values.map(function (f) { return [f]; }));
}

// ---------- Request Register ----------

function registerFormulas_(r) {
  return [
    '=IF($A' + r + '="","",SUMIFS(PAY_AMOUNT,PAY_REQUEST,$A' + r + '))',
    '=IF($A' + r + '="","",IF($L' + r + '="Approved",MAX(0,N($M' + r + ')-$Q' + r + '),0))',
    '=IF($A' + r + '="","",IF($L' + r + '<>"Approved","Not Approved",IF($Q' + r + '=0,"Awaiting Payment",' +
      'IF($Q' + r + '<N($M' + r + '),"Partially Paid",IF($Q' + r + '=N($M' + r + '),"Paid","Payment Issue")))))',
    '=IF($A' + r + '="","",IF($Q' + r + '=0,"",MAXIFS(PAY_DATE,PAY_REQUEST,$A' + r + ')))',
    '=IF($A' + r + '="","",IF(OR($L' + r + '="",$L' + r + '="Draft"),"Requester: complete and submit",' +
      'IF($L' + r + '="Changes Requested","Requester: update and resubmit",' +
      'IF($L' + r + '="Pending Approval","Approver: review request",' +
      'IF($L' + r + '="Approved",IF($S' + r + '="Paid","None: fully paid",' +
      'IF($S' + r + '="Payment Issue","Finance: resolve payment issue","Finance: record payment")),"None: closed")))))',
    '=IF($A' + r + '="","",IF(OR($L' + r + '="",$L' + r + '="Draft",$L' + r + '="Changes Requested"),"Ramez George",' +
      'IF($L' + r + '="Pending Approval","Peter George",' +
      'IF(AND($L' + r + '="Approved",$S' + r + '<>"Paid"),"David Nashaat","-"))))'
  ];
}

function buildRegister_() {
  var sh = sheet_(SHEET_NAMES.REGISTER);
  var cols = REG_HEADERS.length;
  var n = CONFIG.MAX_ROWS - FIRST_ROW + 1;
  banner_(sh, 'REQUEST REGISTER',
    'Ramez fills the teal-header columns. Peter and David act through the Impact Finance Tracker menu. Slate-header columns are calculated or script-managed.', cols);
  headerRow_(sh, REG_HEADERS, 1);

  var formulas = [];
  for (var r = FIRST_ROW; r <= CONFIG.MAX_ROWS; r++) {
    formulas.push(registerFormulas_(r));
  }
  sh.getRange(FIRST_ROW, REG.TOTAL_PAID, n, 6).setFormulas(formulas);

  // Header colours: teal = typed by requester, navy = ID, slate = calculated/script.
  REG_HEADERS.forEach(function (_, i) {
    var col = i + 1;
    var color = REG_BUSINESS_COLS.indexOf(col) >= 0 || col === REG.NOTES ? COLORS.TEAL
      : col === REG.ID ? COLORS.NAVY : COLORS.SLATE;
    sh.getRange(HEADER_ROW, col).setBackground(color);
  });

  var widths = [110, 120, 130, 260, 320, 170, 200, 120, 80, 130, 200, 150, 120, 200, 120, 280,
    110, 150, 140, 120, 240, 160, 150, 260];
  widths.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });

  var moneyCols = [REG.AMOUNT, REG.APPROVED_AMOUNT, REG.TOTAL_PAID, REG.REMAINING];
  var dateCols = [REG.REQUIRED_DATE, REG.APPROVAL_DATE, REG.LAST_PAYMENT_DATE];
  moneyCols.forEach(function (c) { sh.getRange(FIRST_ROW, c, n, 1).setNumberFormat('#,##0.00'); });
  dateCols.forEach(function (c) { sh.getRange(FIRST_ROW, c, n, 1).setNumberFormat('yyyy-mm-dd'); });
  sh.getRange(FIRST_ROW, REG.SUBMITTED, n, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  sh.getRange(FIRST_ROW, REG.LAST_UPDATED, n, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  [REG.DESCRIPTION, REG.COMMENTS, REG.NEXT_ACTION, REG.NOTES, REG.TITLE].forEach(function (c) {
    sh.getRange(FIRST_ROW, c, n, 1).setWrap(true);
  });
  sh.getRange(FIRST_ROW, REG.TOTAL_PAID, n, 6).setFontColor(COLORS.SLATE);
  sh.getRange(FIRST_ROW, REG.ID, n, 1).setFontWeight('bold');

  // Dropdowns and validation for the requester's fields.
  sh.getRange(FIRST_ROW, REG.CATEGORY, n, 1).setDataValidation(listRule_(LIST_NAMES.CATEGORIES));
  sh.getRange(FIRST_ROW, REG.CURRENCY, n, 1).setDataValidation(listRule_(LIST_NAMES.CURRENCIES));
  sh.getRange(FIRST_ROW, REG.STATUS, n, 1).setDataValidation(listRule_(LIST_NAMES.APPROVAL_STATUSES));
  sh.getRange(FIRST_ROW, REG.PAYMENT_STATUS, n, 1).setDataValidation(listRule_(LIST_NAMES.PAYMENT_STATUSES));
  sh.getRange(FIRST_ROW, REG.AMOUNT, n, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireNumberGreaterThan(0).setAllowInvalid(false).build());
  sh.getRange(FIRST_ROW, REG.REQUIRED_DATE, n, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false).build());

  // Conditional formatting: status colours, overdue highlight.
  sh.clearConditionalFormatRules();
  var rules = statusRules_(sh.getRange(FIRST_ROW, REG.STATUS, n, 1))
    .concat(statusRules_(sh.getRange(FIRST_ROW, REG.PAYMENT_STATUS, n, 1)));
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND($L5="Approved",$S5<>"Paid",ISNUMBER($J5),$J5<TODAY())')
    .setBackground('#FEE2E2').setFontColor('#B91C1C').setBold(true)
    .setRanges([sh.getRange(FIRST_ROW, REG.REQUIRED_DATE, n, 1)]).build());
  sh.setConditionalFormatRules(rules);

  // Alternating row colours and a filter over the whole table.
  sh.getBandings().forEach(function (b) { b.remove(); });
  sh.getRange(HEADER_ROW, 1, n + 1, cols).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false);
  if (!sh.getFilter()) {
    sh.getRange(HEADER_ROW, 1, n + 1, cols).createFilter();
  }
  sh.setFrozenRows(HEADER_ROW);
  sh.setFrozenColumns(4);

  // Script-managed columns get warning-only protection (advisory; onEdit also reverts edits).
  clearTrackerProtections_(sh);
  REG_SCRIPT_COLS.forEach(function (c) {
    protectOnce_(sh.getRange(FIRST_ROW, c, n, 1), 'Impact Finance Tracker: script-managed column');
  });
}

// ---------- Finance & Payments (ledger + approved-awaiting-payment queue) ----------

function buildFinance_() {
  var sh = sheet_(SHEET_NAMES.FINANCE);
  var n = CONFIG.MAX_ROWS - FIRST_ROW + 1;
  banner_(sh, 'FINANCE & PAYMENTS',
    'Record payments with Impact Finance Tracker > Record Payment. Ledger rows are never edited or deleted. Approved requests still awaiting payment are on the right.', 25);
  headerRow_(sh, PAY_HEADERS, 1);

  var flags = [];
  for (var r = FIRST_ROW; r <= CONFIG.MAX_ROWS; r++) {
    flags.push('=IF($I' + r + '="","",IF(COUNTIF($I$' + FIRST_ROW + ':$I$' + CONFIG.MAX_ROWS + ',$I' + r +
      ')>1,"DUPLICATE REFERENCE","OK"))');
  }
  fill_(sh, PAY.FLAG, n, flags);

  var pw = [100, 120, 240, 130, 80, 120, 130, 130, 180, 200, 220, 220, 260, 150, 160];
  pw.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  [PAY.APPROVED, PAY.AMOUNT].forEach(function (c) { sh.getRange(FIRST_ROW, c, n, 1).setNumberFormat('#,##0.00'); });
  sh.getRange(FIRST_ROW, PAY.DATE, n, 1).setNumberFormat('yyyy-mm-dd');
  sh.getRange(FIRST_ROW, PAY.RECORDED_AT, n, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  sh.getRange(FIRST_ROW, PAY.CURRENCY, n, 1).setDataValidation(listRule_(LIST_NAMES.CURRENCIES));
  sh.getRange(FIRST_ROW, PAY.METHOD, n, 1).setDataValidation(listRule_(LIST_NAMES.PAYMENT_METHODS));

  // Approved-awaiting-payment queue, columns Q:Y.
  var q = 17;
  headerRow_(sh, ['Request ID', 'Request Title', 'Currency', 'Approved Amount', 'Total Paid', 'Remaining',
    'Required Date', 'Payment Status', 'Next Action'], q);
  sh.getRange(HEADER_ROW, q, 1, 9).setBackground(COLORS.TEAL);
  var cond = '((REG_STATUS="Approved")*(REG_PAY_STATUS<>"Paid")=1)';
  var cols = ['REG_ID', 'REG_TITLE', 'REG_CURRENCY', 'REG_APPROVED', 'REG_PAID', 'REG_REMAINING',
    'REG_REQUIRED', 'REG_PAY_STATUS', 'REG_NEXT'];
  cols.forEach(function (name, i) {
    sh.getRange(FIRST_ROW, q + i).setFormula('=IFERROR(FILTER(' + name + ',' + cond + '),"")');
  });
  sh.getRange(FIRST_ROW, q + 3, CONFIG.MAX_ROWS, 3).setNumberFormat('#,##0.00');
  sh.getRange(FIRST_ROW, q + 6, CONFIG.MAX_ROWS, 1).setNumberFormat('yyyy-mm-dd');
  sh.setColumnWidth(16, 20);
  [q, q + 1, q + 2, q + 3, q + 4, q + 5, q + 6, q + 7, q + 8].forEach(function (c, i) {
    sh.setColumnWidth(c, [110, 240, 80, 130, 120, 130, 120, 150, 260][i]);
  });

  sh.clearConditionalFormatRules();
  var rules = [SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('DUPLICATE REFERENCE').setBackground('#FECACA').setFontColor('#991B1B').setBold(true)
    .setRanges([sh.getRange(FIRST_ROW, PAY.FLAG, n, 1)]).build()]
    .concat(statusRules_(sh.getRange(FIRST_ROW, q + 7, CONFIG.MAX_ROWS, 1)));
  sh.setConditionalFormatRules(rules);

  sh.getBandings().forEach(function (b) { b.remove(); });
  sh.getRange(HEADER_ROW, 1, n + 1, PAY_HEADERS.length).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false);
  if (!sh.getFilter()) {
    sh.getRange(HEADER_ROW, 1, n + 1, PAY_HEADERS.length).createFilter();
  }
  sh.setFrozenRows(HEADER_ROW);
  sh.setFrozenColumns(1);

  clearTrackerProtections_(sh);
  protectOnce_(sh.getRange(FIRST_ROW, 1, n, PAY.FLAG), 'Impact Finance Tracker: payment ledger is append-only');
  protectOnce_(sh.getRange(FIRST_ROW, q, CONFIG.MAX_ROWS, 9), 'Impact Finance Tracker: calculated queue');
}

// ---------- Approval & Audit Log ----------

function buildAudit_() {
  var sh = sheet_(SHEET_NAMES.AUDIT);
  banner_(sh, 'APPROVAL & AUDIT LOG',
    'Append-only record written by the tracker. Manual edits are reverted automatically. A strong audit trail, not a tamper-proof one (see SECURITY.md).', AUD_HEADERS.length);
  headerRow_(sh, AUD_HEADERS, 1);
  var widths = [110, 160, 130, 180, 200, 220, 260, 420, 150];
  widths.forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.getRange(FIRST_ROW, AUD.TIMESTAMP, CONFIG.MAX_ROWS, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
  sh.getRange(FIRST_ROW, AUD.COMMENTS, CONFIG.MAX_ROWS, 1).setWrap(true);
  sh.getBandings().forEach(function (b) { b.remove(); });
  sh.getRange(HEADER_ROW, 1, CONFIG.MAX_ROWS - HEADER_ROW + 1, AUD_HEADERS.length)
    .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false);
  if (!sh.getFilter()) {
    sh.getRange(HEADER_ROW, 1, CONFIG.MAX_ROWS - HEADER_ROW + 1, AUD_HEADERS.length).createFilter();
  }
  sh.setFrozenRows(HEADER_ROW);
  clearTrackerProtections_(sh);
  sh.protect().setDescription('Impact Finance Tracker: audit log is append-only').setWarningOnly(true);
}

// ---------- Queues, dashboard and charts are built in Views.gs ----------

function buildQueue_() {
  buildQueueView_();
}
