/**
 * Approval & Audit Log: append-only event trail.
 *
 * Limitation: anyone with edit access can still type into this tab. onEdit reverts
 * manual edits, but a determined editor with the sheet open can change data without
 * triggering it. See SECURITY.md for what this does and does not protect against.
 */

/** Appends one event. Callers that change data must hold the lock (withLock_). */
function appendAudit_(requestId, type, previous, next, comments, paymentId) {
  var seq = nextSequence_('seq.EVT');
  sheet_(SHEET_NAMES.AUDIT).appendRow([
    'EVT-' + padN_(seq, 6),
    new Date(),
    str_(requestId),
    type,
    cellText_(previous),
    cellText_(next),
    actingEmail_() || 'not revealed by Google',
    cellText_(comments),
    str_(paymentId)
  ]);
}

/** True when the log already holds an event of this type for this request. */
function auditHas_(requestId, type) {
  var sh = sheet_(SHEET_NAMES.AUDIT);
  var last = sh.getLastRow();
  if (last < FIRST_ROW) {
    return false;
  }
  var rows = sh.getRange(FIRST_ROW, 1, last - FIRST_ROW + 1, AUD_HEADERS.length).getValues();
  return rows.some(function (r) {
    return str_(r[AUD.REQUEST - 1]) === requestId && str_(r[AUD.TYPE - 1]) === type;
  });
}
