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
  var people = role === 'REQUESTER' ? CONFIG.REQUESTERS : [CONFIG.PEOPLE[role]];
  var actual = actingEmail_();
  var match = people.filter(function (p) {
    return actual !== '' && p.email.toLowerCase() === actual;
  })[0];
  if (match) {
    return actual;
  }
  var names = people.map(function (p) { return p.name; }).join(' or ');
  withLock_(function () {
    appendAudit_(requestId, 'UNAUTHORIZED_ATTEMPT', action, '',
      'Refused: account "' + (actual || 'not revealed by Google') + '" is not ' + names + '.', '');
  });
  throw new Error('Only ' + names + ' can ' + action.toLowerCase().replace(/_/g, ' ') +
    '. This attempt was logged.');
}

/** "Name <email>" for the requester on a register row. Used for notifications. */
function requesterLabel_(email) {
  var match = CONFIG.REQUESTERS.filter(function (p) {
    return p.email.toLowerCase() === email;
  })[0];
  return (match ? match.name : email) + ' <' + email + '>';
}

/** Email address stored in a register row's Requester column, or the default requester. */
function requesterEmailFor_(v) {
  var m = /<([^>]+)>/.exec(str_(v[REG.REQUESTER - 1]));
  return m ? m[1] : CONFIG.PEOPLE.REQUESTER.email;
}

/** Set only by runTestScenarios(), never by menu actions. Blank in normal use. */
var TEST_IDENTITY_OVERRIDE = '';
