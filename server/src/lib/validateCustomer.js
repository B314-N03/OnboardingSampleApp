/**
 * Customer input validation (pure, testable).
 *
 * Rules:
 * - name: required (non-empty after trim)
 * - contactEmail: required, must look like a valid email
 * - industry / region: optional, trimmed
 */

// Allowed onboarding step statuses (shared with the step-advance endpoint).
const STEP_STATUSES = ['pending', 'in_progress', 'completed', 'failed'];

// Deliberately simple, good-enough email check: something@something.something
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value) {
  return typeof value === 'string' && EMAIL_PATTERN.test(value.trim());
}

function asTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Validate + normalize raw customer input from the API.
 * @param {object} input
 * @returns {{ valid: boolean, details: {field: string, message: string}[], value: object }}
 */
function validateCustomerInput(input) {
  const raw = input || {};
  const name = asTrimmedString(raw.name);
  const contactEmail = asTrimmedString(raw.contactEmail);
  const industry = asTrimmedString(raw.industry);
  const region = asTrimmedString(raw.region);

  const details = [];

  if (!name) {
    details.push({ field: 'name', message: 'Name is required' });
  }

  if (!contactEmail) {
    details.push({ field: 'contactEmail', message: 'Contact email is required' });
  } else if (!isValidEmail(contactEmail)) {
    details.push({ field: 'contactEmail', message: 'Contact email must be a valid email address' });
  }

  return {
    valid: details.length === 0,
    details,
    value: {
      name,
      contactEmail: contactEmail.toLowerCase(),
      industry,
      region
    }
  };
}

/**
 * Validate an onboarding step status value.
 * @param {string} status
 * @returns {boolean}
 */
function isValidStepStatus(status) {
  return STEP_STATUSES.includes(status);
}

module.exports = {
  validateCustomerInput,
  isValidEmail,
  isValidStepStatus,
  STEP_STATUSES
};
