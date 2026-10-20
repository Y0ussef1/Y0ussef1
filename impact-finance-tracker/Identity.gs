/**
 * Identity checks.
 *
 * Google Apps Script reports the active user's email via Session.getActiveUser().
 * That value can be blank (for example, some consumer accounts or domain policies).
 * We FAIL CLOSED: a blank identity is refused. See SECURITY.md for the limits.
 */

/** Lower-cased email of the account running this action; '' when Google does not reveal it. */
function actingEmail_() {
  if (TEST_IDENTITY_OVERRIDE) {
    return TEST_IDENTITY_OVERRIDE;
  }
  return str_(Session.getActiveUser().getEmail()).toLowerCase();
}

/**
 * Confirms the acting account is the configured person for `role`.
 * Refused attempts are written to the audit log, then an error is thrown.
 * Must be called OUTSIDE withLock_.
 */
function requireRole_(role, requestId, action) {
  var person = CONFIG.PEOPLE[role];
  var actual = actingEmail_();
  if (actual === person.email.toLowerCase()) {
    return actual;
  }
  withLock_(function () {
    appendAudit_(requestId, 'UNAUTHORIZED_ATTEMPT', action, '',
      'Refused: account "' + (actual || 'not revealed by Google') + '" is not ' + person.name + '.', '');
  });
  throw new Error('Only ' + person.name + ' can ' + action.toLowerCase().replace(/_/g, ' ') +
    '. This attempt was logged.');
}

/** Set only by runTestScenarios(), never by menu actions. Blank in normal use. */
var TEST_IDENTITY_OVERRIDE = '';
