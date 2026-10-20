/**
 * Calculated views: Approval Queue, Executive Dashboard and charts.
 * Everything here is formulas (live) except the charts, which are rebuilt by
 * "Refresh Dashboard" so they always point at the current layout.
 */

function menuRefreshDashboard() {
  guard_(function () {
    buildDashboard_();
    buildCharts_();
    SpreadsheetApp.getUi().alert('Impact Finance Tracker', 'Dashboard refreshed.', SpreadsheetApp.getUi().ButtonSet.OK);
  });
}

// ---------- Approval Queue ----------

function buildQueueView_() {
  var sh = sheet_(SHEET_NAMES.QUEUE);
  var n = CONFIG.MAX_ROWS - FIRST_ROW + 1;
  banner_(sh, 'APPROVAL QUEUE',
    'Left: requests waiting for Peter, oldest first. Right: decisions made in the last 30 days. Red = waiting too long or past its required date.', 15);

  var pending = ['Request ID', 'Request Title', 'Requester', 'Requested Amount', 'Currency', 'Category',
    'Submission Date', 'Required Payment Date', 'Days Waiting', 'Approval Status', 'Supporting Documents',
    'Approval Comments', 'Decision', 'Approver', 'Decision Date'];
  headerRow_(sh, pending, 1);
  var c = '(REG_STATUS="Pending Approval")';
  var pendingFormulas = [
    '=IFERROR(FILTER(REG_ID,' + c + '),"")',
    '=IFERROR(FILTER(REG_TITLE,' + c + '),"")',
    '=IFERROR(FILTER(REG_REQUESTER,' + c + '),"")',
    '=IFERROR(FILTER(REG_AMOUNT,' + c + '),"")',
    '=IFERROR(FILTER(REG_CURRENCY,' + c + '),"")',
    '=IFERROR(FILTER(REG_CATEGORY,' + c + '),"")',
    '=IFERROR(FILTER(REG_SUBMITTED,' + c + '),"")',
    '=IFERROR(FILTER(REG_REQUIRED,' + c + '),"")',
    '=IFERROR(FILTER(TODAY()-REG_SUBMITTED,' + c + '),"")',
    '=IFERROR(FILTER(REG_STATUS,' + c + '),"")',
    '=IFERROR(ARRAYFORMULA(IF(FILTER(REG_DOCS,' + c + ')="","No link",HYPERLINK(FILTER(REG_DOCS,' + c + '),"Open document"))),"")',
    '=IFERROR(FILTER(REG_COMMENTS,' + c + '),"")',
    '=IFERROR(ARRAYFORMULA(IF(FILTER(REG_ID,' + c + ')<>"","Awaiting decision","")),"")',
    '=IFERROR(FILTER(REG_APPROVER,' + c + '),"")',
    '=IFERROR(FILTER(REG_APPROVAL_DATE,' + c + '),"")'
  ];
  pendingFormulas.forEach(function (f, i) { sh.getRange(FIRST_ROW, i + 1).setFormula(f); });

  var recent = ['Request ID', 'Request Title', 'Decision', 'Approver', 'Decision Date', 'Comments'];
  headerRow_(sh, recent, 17);
  var d = '(ISNUMBER(REG_APPROVAL_DATE)*(REG_APPROVAL_DATE>=TODAY()-30)=1)';
  var recentFormulas = [
    '=IFERROR(FILTER(REG_ID,' + d + '),"")',
    '=IFERROR(FILTER(REG_TITLE,' + d + '),"")',
    '=IFERROR(FILTER(REG_STATUS,' + d + '),"")',
    '=IFERROR(FILTER(REG_APPROVER,' + d + '),"")',
    '=IFERROR(FILTER(REG_APPROVAL_DATE,' + d + '),"")',
    '=IFERROR(FILTER(REG_COMMENTS,' + d + '),"")'
  ];
  recentFormulas.forEach(function (f, i) { sh.getRange(FIRST_ROW, 17 + i).setFormula(f); });

  [110, 240, 130, 130, 80, 170, 120, 130, 100, 150, 130, 280, 160, 230, 120, 20, 110, 240, 150, 230, 120, 280]
    .forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.getRange(FIRST_ROW, 4, n, 1).setNumberFormat('#,##0.00');
  sh.getRange(FIRST_ROW, 7, n, 2).setNumberFormat('yyyy-mm-dd');
  sh.getRange(FIRST_ROW, 15, n, 1).setNumberFormat('yyyy-mm-dd');
  sh.getRange(FIRST_ROW, 21, n, 1).setNumberFormat('yyyy-mm-dd');
  sh.getRange(FIRST_ROW, 1, n, 15).setVerticalAlignment('middle');

  sh.clearConditionalFormatRules();
  var rules = statusRules_(sh.getRange(FIRST_ROW, 10, n, 1))
    .concat(statusRules_(sh.getRange(FIRST_ROW, 19, n, 1)));
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND(ISNUMBER($I5),$I5>=SET_APPROVAL_WAIT_DAYS)')
    .setBackground('#FEE2E2').setFontColor('#B91C1C').setBold(true)
    .setRanges([sh.getRange(FIRST_ROW, 9, n, 1)]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND(ISNUMBER($H5),$H5<TODAY())')
    .setBackground('#FEE2E2').setFontColor('#B91C1C').setBold(true)
    .setRanges([sh.getRange(FIRST_ROW, 8, n, 1)]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND(ISNUMBER($H5),$H5>=TODAY(),$H5-TODAY()<=SET_PAYMENT_WARN_DAYS)')
    .setBackground('#FEF3C7').setFontColor('#92400E').setBold(true)
    .setRanges([sh.getRange(FIRST_ROW, 8, n, 1)]).build());
  sh.setConditionalFormatRules(rules);

  sh.setFrozenRows(HEADER_ROW);
  sh.setFrozenColumns(1);
}

// ---------- Executive Dashboard ----------

/** Lays out the dashboard. Input cells (C4, E4, G4) are preserved if already set. */
function buildDashboard_() {
  var sh = sheet_(SHEET_NAMES.DASHBOARD);
  var book = ss_();
  sh.setHiddenGridlines(true);
  sh.setColumnWidth(1, 18);
  for (var c = 2; c <= 13; c++) sh.setColumnWidth(c, 128);
  sh.setColumnWidth(14, 24);
  sh.setColumnWidth(15, 130);
  sh.setColumnWidth(16, 120);

  // Title, subtitle and reporting-period controls.
  sh.getRange(1, 2, 1, 12).merge().setValue('EXECUTIVE DASHBOARD')
    .setBackground(COLORS.NAVY).setFontColor(COLORS.WHITE).setFontSize(18).setFontWeight('bold').setVerticalAlignment('middle');
  sh.setRowHeight(1, 52);
  sh.getRange(2, 2, 1, 12).merge()
    .setFormula('="Period: "&IF(DASH_FROM="","all time",TEXT(DASH_FROM,"d mmm yyyy"))&"  to  "&IF(DASH_TO="","today",TEXT(DASH_TO,"d mmm yyyy"))&"        Currency in cards and charts: "&DASH_CUR')
    .setBackground('#334155').setFontColor('#E2E8F0').setFontStyle('italic');
  sh.setRowHeight(2, 28);

  sh.getRange('B4').setValue('From').setFontWeight('bold').setHorizontalAlignment('right');
  sh.getRange('D4').setValue('To').setFontWeight('bold').setHorizontalAlignment('right');
  sh.getRange('F4').setValue('Currency').setFontWeight('bold').setHorizontalAlignment('right');
  [['C4', 'yyyy-mm-dd'], ['E4', 'yyyy-mm-dd']].forEach(function (p) {
    sh.getRange(p[0]).setNumberFormat(p[1]).setBackground('#EFF6FF').setBorder(true, true, true, true, false, false, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  });
  var curCell = sh.getRange('G4');
  if (str_(curCell.getValue()) === '') curCell.setValue(setting_('SET_DEFAULT_CURRENCY') || 'USD');
  curCell.setBackground('#EFF6FF').setFontWeight('bold')
    .setDataValidation(listRule_(LIST_NAMES.CURRENCIES));
  sh.getRange('H4').setValue('Leave dates blank for all time. Totals are never mixed across currencies.')
    .setFontColor(COLORS.MUTED).setFontStyle('italic');
  sh.getRange('O4').setValue('helper: from').setFontColor(COLORS.MUTED);
  sh.getRange('O5').setValue('helper: to').setFontColor(COLORS.MUTED);
  sh.getRange('P4').setFormula('=IF(DASH_FROM="",DATE(2000,1,1),DASH_FROM)').setNumberFormat('yyyy-mm-dd').setFontColor(COLORS.MUTED);
  sh.getRange('P5').setFormula('=IF(DASH_TO="",TODAY(),DASH_TO)').setNumberFormat('yyyy-mm-dd').setFontColor(COLORS.MUTED);

  // Navigation links to every tab.
  var nav = [
    [SHEET_NAMES.REGISTER, 'Request Register'], [SHEET_NAMES.QUEUE, 'Approval Queue'],
    [SHEET_NAMES.FINANCE, 'Finance & Payments'], [SHEET_NAMES.AUDIT, 'Audit Log'],
    [SHEET_NAMES.SETTINGS, 'Lists & Settings']
  ];
  nav.forEach(function (item, i) {
    var gid = book.getSheetByName(item[0]).getSheetId();
    sh.getRange(6, 2 + i * 2, 1, 2).merge().setFormula('=HYPERLINK("#gid=' + gid + '","→ ' + item[1] + '")')
      .setFontColor(COLORS.TEAL).setFontWeight('bold').setHorizontalAlignment('center');
  });

  // KPI cards (two rows of four). Amounts follow the selected currency.
  sh.getRange('B8').setFormula('="KEY FIGURES  ·  "&DASH_CUR').setFontColor(COLORS.TEAL).setFontWeight('bold').setFontSize(11);
  var inPeriod = 'REG_SUBMITTED,">="&RPT_FROM,REG_SUBMITTED,"<="&RPT_TO';
  var notDraft = 'REG_STATUS,"?*",REG_STATUS,"<>Draft",REG_STATUS,"<>Cancelled"';
  var cards = [
    ['TOTAL REQUESTED', '=SUMIFS(REG_AMOUNT,REG_CURRENCY,DASH_CUR,' + inPeriod + ',' + notDraft + ')', '#,##0.00', 'Submitted in period, excl. drafts and cancelled'],
    ['TOTAL APPROVED', '=SUMIFS(REG_APPROVED,REG_CURRENCY,DASH_CUR,REG_STATUS,"Approved",' + inPeriod + ')', '#,##0.00', 'Approved amounts, submitted in period'],
    ['TOTAL PAID', '=SUMIFS(PAY_AMOUNT,PAY_CURRENCY,DASH_CUR,PAY_DATE,">="&RPT_FROM,PAY_DATE,"<="&RPT_TO)', '#,##0.00', 'Payments dated in period'],
    ['OUTSTANDING APPROVED', '=SUMIFS(REG_REMAINING,REG_CURRENCY,DASH_CUR,REG_STATUS,"Approved")', '#,##0.00', 'Approved but not yet paid (all time)'],
    ['PENDING APPROVAL AMOUNT', '=SUMIFS(REG_AMOUNT,REG_CURRENCY,DASH_CUR,REG_STATUS,"Pending Approval")', '#,##0.00', 'Waiting for Peter'],
    ['PENDING REQUESTS', '=COUNTIF(REG_STATUS,"Pending Approval")', '0', 'Requests waiting for a decision'],
    ['OVERDUE PAYMENTS', '=COUNTIFS(REG_STATUS,"Approved",REG_PAY_STATUS,"<>Paid",REG_REQUIRED,"<"&TODAY())', '0', 'Approved, not fully paid, past required date'],
    ['REJECTED REQUESTS', '=COUNTIFS(REG_STATUS,"Rejected",' + inPeriod + ')', '0', 'Rejected in period']
  ];
  cards.forEach(function (card, i) {
    var row = i < 4 ? 9 : 13;
    var col = 2 + (i % 4) * 3;
    var card3 = sh.getRange(row, col, 3, 3);
    sh.getRange(row, col, 1, 3).merge().setValue(card[0])
      .setFontColor(COLORS.MUTED).setFontSize(9).setFontWeight('bold').setHorizontalAlignment('center');
    sh.getRange(row + 1, col, 1, 3).merge().setFormula(card[1])
      .setNumberFormat(card[2]).setFontSize(22).setFontWeight('bold').setFontColor(COLORS.NAVY).setHorizontalAlignment('center');
    sh.getRange(row + 2, col, 1, 3).merge().setValue(card[3])
      .setFontColor(COLORS.MUTED).setFontSize(8).setHorizontalAlignment('center').setWrap(true);
    card3.setBackground(COLORS.CARD).setBorder(true, true, true, true, false, false, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(row, col, 1, 3).setBorder(true, null, null, null, null, null, COLORS.TEAL, SpreadsheetApp.BorderStyle.SOLID_THICK);
  });
  sh.setRowHeight(10, 40);
  sh.setRowHeight(14, 40);

  // Totals by currency: one row per currency, never added together.
  sectionTitle_(sh, 'B17', '="TOTALS BY CURRENCY  ·  each currency kept separate"');
  headerRow_(sh, ['Currency', 'Requested', 'Approved', 'Paid', 'Outstanding', 'Pending approval'], 2, 18);
  var cur = [];
  for (var k = 1; k <= 6; k++) {
    var r = 18 + k;
    var b = '$B' + r;
    var blank = 'IF(' + b + '="","",';
    cur.push([
      '=IFERROR(INDEX(LIST_CURRENCIES,' + k + ')&"","")',
      '=' + blank + 'SUMIFS(REG_AMOUNT,REG_CURRENCY,' + b + ',' + inPeriod + ',' + notDraft + '))',
      '=' + blank + 'SUMIFS(REG_APPROVED,REG_CURRENCY,' + b + ',REG_STATUS,"Approved",' + inPeriod + '))',
      '=' + blank + 'SUMIFS(PAY_AMOUNT,PAY_CURRENCY,' + b + ',PAY_DATE,">="&RPT_FROM,PAY_DATE,"<="&RPT_TO))',
      '=' + blank + 'SUMIFS(REG_REMAINING,REG_CURRENCY,' + b + ',REG_STATUS,"Approved"))',
      '=' + blank + 'SUMIFS(REG_AMOUNT,REG_CURRENCY,' + b + ',REG_STATUS,"Pending Approval"))'
    ]);
  }
  sh.getRange(19, 2, 6, 6).setFormulas(cur);
  sh.getRange(19, 3, 6, 5).setNumberFormat('#,##0.00');

  // Monthly trend for the year of the reporting end date.
  sectionTitle_(sh, 'B26', '="MONTHLY TREND  ·  "&DASH_CUR&"  ·  "&YEAR(RPT_TO)');
  headerRow_(sh, ['Month', 'Requested', 'Approved', 'Paid'], 2, 27);
  var monthly = [];
  for (var m = 1; m <= 12; m++) {
    var mr = 27 + m;
    var start = '$B' + mr;
    monthly.push([
      '=DATE(YEAR(RPT_TO),' + m + ',1)',
      '=SUMIFS(REG_AMOUNT,REG_CURRENCY,DASH_CUR,REG_SUBMITTED,">="&' + start + ',REG_SUBMITTED,"<"&EDATE(' + start + ',1),' + notDraft + ')',
      '=SUMIFS(REG_APPROVED,REG_CURRENCY,DASH_CUR,REG_STATUS,"Approved",REG_SUBMITTED,">="&' + start + ',REG_SUBMITTED,"<"&EDATE(' + start + ',1))',
      '=SUMIFS(PAY_AMOUNT,PAY_CURRENCY,DASH_CUR,PAY_DATE,">="&' + start + ',PAY_DATE,"<"&EDATE(' + start + ',1))'
    ]);
  }
  sh.getRange(28, 2, 12, 4).setFormulas(monthly);
  sh.getRange(28, 2, 12, 1).setNumberFormat('mmm yyyy');
  sh.getRange(28, 3, 12, 3).setNumberFormat('#,##0.00');

  // Expenses by category, with outstanding balance.
  sectionTitle_(sh, 'B41', '="EXPENSES BY CATEGORY  ·  "&DASH_CUR');
  headerRow_(sh, ['Category', 'Requested', 'Approved', 'Paid', 'Outstanding'], 2, 42);
  var cats = [];
  for (var j = 1; j <= 12; j++) {
    var cr = 42 + j;
    var cb = '$B' + cr;
    var cblank = 'IF(' + cb + '="","",';
    cats.push([
      '=IFERROR(INDEX(LIST_CATEGORIES,' + j + ')&"","")',
      '=' + cblank + 'SUMIFS(REG_AMOUNT,REG_CATEGORY,' + cb + ',REG_CURRENCY,DASH_CUR,' + inPeriod + ',' + notDraft + '))',
      '=' + cblank + 'SUMIFS(REG_APPROVED,REG_CATEGORY,' + cb + ',REG_CURRENCY,DASH_CUR,REG_STATUS,"Approved",' + inPeriod + '))',
      '=' + cblank + 'SUMIFS(REG_PAID,REG_CATEGORY,' + cb + ',REG_CURRENCY,DASH_CUR,' + inPeriod + '))',
      '=' + cblank + 'SUMIFS(REG_REMAINING,REG_CATEGORY,' + cb + ',REG_CURRENCY,DASH_CUR,REG_STATUS,"Approved"))'
    ]);
  }
  sh.getRange(43, 2, 12, 5).setFormulas(cats);
  sh.getRange(43, 3, 12, 4).setNumberFormat('#,##0.00');

  // Status distributions.
  sectionTitle_(sh, 'B56', '="APPROVAL STATUS  ·  count of requests"');
  headerRow_(sh, ['Approval Status', 'Count'], 2, 57);
  var appr = [];
  for (var s = 1; s <= 6; s++) {
    var ar = 57 + s;
    appr.push(['=IFERROR(INDEX(LIST_APPROVAL_STATUSES,' + s + ')&"","")',
      '=IF($B' + ar + '="","",COUNTIF(REG_STATUS,$B' + ar + '))']);
  }
  sh.getRange(58, 2, 6, 2).setFormulas(appr);

  sectionTitle_(sh, 'B65', '="PAYMENT STATUS  ·  count of requests"');
  headerRow_(sh, ['Payment Status', 'Count'], 2, 66);
  var pay = [];
  for (var p = 1; p <= 5; p++) {
    var pr = 66 + p;
    pay.push(['=IFERROR(INDEX(LIST_PAYMENT_STATUSES,' + p + ')&"","")',
      '=IF($B' + pr + '="","",COUNTIF(REG_PAY_STATUS,$B' + pr + '))']);
  }
  sh.getRange(67, 2, 5, 2).setFormulas(pay);

  sh.setFrozenRows(2);
}

function sectionTitle_(sh, a1, formulaOrText) {
  var r = sh.getRange(a1);
  if (formulaOrText.charAt(0) === '=') {
    r.setFormula(formulaOrText);
  } else {
    r.setValue(formulaOrText);
  }
  r.setFontColor(COLORS.TEAL).setFontWeight('bold').setFontSize(11);
}

// ---------- Charts ----------

/** Rebuilds the four dashboard charts from the tables on the dashboard. */
function buildCharts_() {
  var sh = sheet_(SHEET_NAMES.DASHBOARD);
  sh.getCharts().forEach(function (c) { sh.removeChart(c); });

  var monthly = sh.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(sh.getRange('B27:E39'))
    .setPosition(26, 9, 0, 0)
    .setOption('title', 'Monthly trend: requested vs approved vs paid')
    .setOption('legend', { position: 'bottom' })
    .setOption('width', 620).setOption('height', 300)
    .setOption('colors', ['#94A3B8', '#0F766E', '#1F2A44'])
    .build();
  sh.insertChart(monthly);

  var categories = sh.newChart()
    .setChartType(Charts.ChartType.BAR)
    .addRange(sh.getRange('B42:E54'))
    .setPosition(43, 9, 0, 0)
    .setOption('title', 'Expenses by category')
    .setOption('legend', { position: 'bottom' })
    .setOption('width', 620).setOption('height', 320)
    .setOption('colors', ['#94A3B8', '#0F766E', '#1F2A44'])
    .build();
  sh.insertChart(categories);

  var approval = sh.newChart()
    .setChartType(Charts.ChartType.PIE)
    .addRange(sh.getRange('B57:C63'))
    .setPosition(61, 9, 0, 0)
    .setOption('title', 'Approval status distribution')
    .setOption('legend', { position: 'right' })
    .setOption('width', 420).setOption('height', 280)
    .build();
  sh.insertChart(approval);

  var payment = sh.newChart()
    .setChartType(Charts.ChartType.PIE)
    .addRange(sh.getRange('B66:C71'))
    .setPosition(77, 9, 0, 0)
    .setOption('title', 'Payment status distribution')
    .setOption('legend', { position: 'right' })
    .setOption('width', 420).setOption('height', 280)
    .build();
  sh.insertChart(payment);
}
