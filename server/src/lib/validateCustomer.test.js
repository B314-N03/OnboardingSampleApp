const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  validateCustomerInput,
  isValidEmail,
  isValidStepStatus
} = require('./validateCustomer');

describe('validateCustomerInput', () => {
  it('accepts a valid customer and normalizes fields', () => {
    const result = validateCustomerInput({
      name: '  Globex  ',
      contactEmail: '  Onboarding@Globex.COM ',
      industry: '  Retail ',
      region: ' EMEA '
    });

    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.details, []);
    assert.strictEqual(result.value.name, 'Globex');
    assert.strictEqual(result.value.contactEmail, 'onboarding@globex.com');
    assert.strictEqual(result.value.industry, 'Retail');
    assert.strictEqual(result.value.region, 'EMEA');
  });

  it('requires a name', () => {
    const result = validateCustomerInput({ name: '   ', contactEmail: 'a@b.com' });
    assert.strictEqual(result.valid, false);
    assert.ok(result.details.some(d => d.field === 'name'));
  });

  it('requires a contact email', () => {
    const result = validateCustomerInput({ name: 'Acme' });
    assert.strictEqual(result.valid, false);
    assert.ok(result.details.some(d => d.field === 'contactEmail'));
  });

  it('rejects an invalid email', () => {
    const result = validateCustomerInput({ name: 'Acme', contactEmail: 'not-an-email' });
    assert.strictEqual(result.valid, false);
    assert.ok(result.details.some(d => d.field === 'contactEmail'));
  });

  it('treats industry and region as optional', () => {
    const result = validateCustomerInput({ name: 'Acme', contactEmail: 'a@b.com' });
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.value.industry, '');
    assert.strictEqual(result.value.region, '');
  });

  it('handles missing / non-object input without throwing', () => {
    const result = validateCustomerInput(undefined);
    assert.strictEqual(result.valid, false);
    assert.ok(result.details.length >= 2);
  });
});

describe('isValidEmail', () => {
  it('accepts a normal email', () => {
    assert.strictEqual(isValidEmail('user@example.com'), true);
  });

  it('rejects missing @ or domain', () => {
    assert.strictEqual(isValidEmail('userexample.com'), false);
    assert.strictEqual(isValidEmail('user@example'), false);
    assert.strictEqual(isValidEmail('user @ex.com'), false);
  });
});

describe('isValidStepStatus', () => {
  it('accepts the four allowed statuses', () => {
    ['pending', 'in_progress', 'completed', 'failed'].forEach(s => {
      assert.strictEqual(isValidStepStatus(s), true);
    });
  });

  it('rejects anything else', () => {
    assert.strictEqual(isValidStepStatus('done'), false);
    assert.strictEqual(isValidStepStatus(''), false);
    assert.strictEqual(isValidStepStatus(undefined), false);
  });
});
