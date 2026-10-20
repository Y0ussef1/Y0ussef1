/**
 * Impact Finance Tracker: configuration.
 *
 * Approval and payment identities live HERE (in code), not in the spreadsheet,
 * so editing a cell can never grant anyone approval or payment rights.
 * Dropdown lists and reminder thresholds live in the "Lists & Settings" tab.
 */
var CONFIG = {
  TIMEZONE: 'Africa/Cairo',
  PEOPLE: {
    REQUESTER: { name: 'Ramez George', email: 'ramez.george@impact-org.com' },
    APPROVER: { name: 'Peter George', email: 'p.george@impactcommunitydevelopment.com' },
    FINANCE: { name: 'David Nashaat', email: 'david.nashaat@impactcommunitydevelopment.com' }
  },
  REMINDER_HOUR: 8, // hour of day (in TIMEZONE) for the daily reminder trigger
  MAX_ROWS: 2000    // formula capacity of the register, queue and payment ledger
};

var SHEET_NAMES = {
  DASHBOARD: 'Executive Dashboard',
  REGISTER: 'Request Register',
  QUEUE: 'Approval Queue',
  FINANCE: 'Finance & Payments',
  AUDIT: 'Approval & Audit Log',
  SETTINGS: 'Lists & Settings'
};

var HEADER_ROW = 4;
var FIRST_ROW = 5;

var STATUS = {
  DRAFT: 'Draft',
  PENDING: 'Pending Approval',
  CHANGES: 'Changes Requested',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled'
};

var PAY_STATUS = {
  NOT_APPROVED: 'Not Approved',
  AWAITING: 'Awaiting Payment',
  PARTIAL: 'Partially Paid',
  PAID: 'Paid',
  ISSUE: 'Payment Issue'
};

var DEFAULT_LISTS = {
  CATEGORIES: ['Operations', 'Marketing', 'Travel & Accommodation', 'Software & Subscriptions',
    'Equipment', 'Professional Services', 'Office Expenses', 'Project Expenses', 'Staff Expenses', 'Other'],
  CURRENCIES: ['EGP', 'USD', 'EUR', 'GBP'],
  PAYMENT_METHODS: ['Bank Transfer', 'Fawry', 'InstaPay', 'Cash', 'Cheque', 'Card', 'Other'],
  APPROVAL_STATUSES: [STATUS.DRAFT, STATUS.PENDING, STATUS.CHANGES, STATUS.APPROVED, STATUS.REJECTED, STATUS.CANCELLED],
  PAYMENT_STATUSES: [PAY_STATUS.NOT_APPROVED, PAY_STATUS.AWAITING, PAY_STATUS.PARTIAL, PAY_STATUS.PAID, PAY_STATUS.ISSUE]
};

/** Request Register column positions (1-based). */
var REG = {
  ID: 1, SUBMITTED: 2, REQUESTER: 3, TITLE: 4, DESCRIPTION: 5, CATEGORY: 6, VENDOR: 7,
  AMOUNT: 8, CURRENCY: 9, REQUIRED_DATE: 10, DOCS: 11, STATUS: 12, APPROVED_AMOUNT: 13,
  APPROVER: 14, APPROVAL_DATE: 15, COMMENTS: 16, TOTAL_PAID: 17, REMAINING: 18,
  PAYMENT_STATUS: 19, LAST_PAYMENT_DATE: 20, NEXT_ACTION: 21, RESPONSIBLE: 22,
  LAST_UPDATED: 23, NOTES: 24
};
var REG_HEADERS = ['Request ID', 'Submission Date', 'Requester', 'Request Title',
  'Description / Business Purpose', 'Category', 'Vendor / Beneficiary', 'Requested Amount',
  'Currency', 'Required Payment Date', 'Supporting Documents', 'Approval Status',
  'Approved Amount', 'Approver', 'Approval Date', 'Approval Comments', 'Total Paid',
  'Remaining Approved Balance', 'Payment Status', 'Last Payment Date', 'Next Action Required',
  'Responsible Person', 'Last Updated', 'Notes'];

/** Columns the requester may type into (only while Draft or Changes Requested). */
var REG_BUSINESS_COLS = [REG.TITLE, REG.DESCRIPTION, REG.CATEGORY, REG.VENDOR, REG.AMOUNT,
  REG.CURRENCY, REG.REQUIRED_DATE, REG.DOCS];

/** Columns written only by the script. Manual edits are reverted in onEdit. */
var REG_SCRIPT_COLS = [REG.ID, REG.SUBMITTED, REG.REQUESTER, REG.STATUS, REG.APPROVED_AMOUNT,
  REG.APPROVER, REG.APPROVAL_DATE, REG.COMMENTS, REG.TOTAL_PAID, REG.REMAINING,
  REG.PAYMENT_STATUS, REG.LAST_PAYMENT_DATE, REG.NEXT_ACTION, REG.RESPONSIBLE, REG.LAST_UPDATED];

/** Payment ledger column positions (1-based). Rows are append-only. */
var PAY = {
  ID: 1, REQUEST: 2, TITLE: 3, APPROVED: 4, CURRENCY: 5, DATE: 6, AMOUNT: 7, METHOD: 8,
  REFERENCE: 9, RECIPIENT: 10, PROOF: 11, RECORDED_BY: 12, NOTES: 13, RECORDED_AT: 14, FLAG: 15
};
var PAY_HEADERS = ['Payment ID', 'Request ID', 'Request Title', 'Approved Amount', 'Currency',
  'Payment Date', 'Amount Paid', 'Payment Method', 'Transaction Reference', 'Vendor / Beneficiary',
  'Proof of Payment', 'Recorded By', 'Finance Notes', 'Recorded At', 'Validation Flag'];

/** Audit log column positions (1-based). Append-only. */
var AUD = {
  ID: 1, TIMESTAMP: 2, REQUEST: 3, TYPE: 4, PREVIOUS: 5, NEW: 6, BY: 7, COMMENTS: 8, PAYMENT: 9
};
var AUD_HEADERS = ['Event ID', 'Timestamp', 'Request ID', 'Event Type', 'Previous Value',
  'New Value', 'Action Performed By', 'Comments', 'Related Payment ID'];

/** Named-range names for the dropdown lists on "Lists & Settings". */
var LIST_NAMES = {
  CATEGORIES: 'LIST_CATEGORIES',
  CURRENCIES: 'LIST_CURRENCIES',
  PAYMENT_METHODS: 'LIST_PAYMENT_METHODS',
  APPROVAL_STATUSES: 'LIST_APPROVAL_STATUSES',
  PAYMENT_STATUSES: 'LIST_PAYMENT_STATUSES'
};

var COLORS = {
  NAVY: '#1F2A44',
  SLATE: '#475569',
  TEAL: '#0F766E',
  WHITE: '#FFFFFF',
  INK: '#0F172A',
  MUTED: '#64748B',
  CARD: '#F8FAFC',
  BORDER: '#CBD5E1'
};

/** Status colours (always shown with the status text too). */
var STATUS_STYLE = {
  'Draft': ['#E2E8F0', '#334155'],
  'Pending Approval': ['#FDE68A', '#92400E'],
  'Changes Requested': ['#FED7AA', '#9A3412'],
  'Approved': ['#BBF7D0', '#166534'],
  'Rejected': ['#FECACA', '#991B1B'],
  'Cancelled': ['#E2E8F0', '#475569'],
  'Not Approved': ['#E2E8F0', '#475569'],
  'Awaiting Payment': ['#BFDBFE', '#1E40AF'],
  'Partially Paid': ['#DDD6FE', '#5B21B6'],
  'Paid': ['#BBF7D0', '#166534'],
  'Payment Issue': ['#FECACA', '#991B1B']
};
