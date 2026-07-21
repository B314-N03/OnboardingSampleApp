const { describe, it } = require('node:test');
const assert = require('node:assert');
const { validateTenantUpdate } = require('./tenants');

describe('validateTenantUpdate', () => {
  it('accepts a valid plan', () => {
    const result = validateTenantUpdate({ plan: 'enterprise' });
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.updates, { plan: 'enterprise' });
    assert.deepStrictEqual(result.errors, []);
  });

  it('accepts a valid status', () => {
    const result = validateTenantUpdate({ status: 'active' });
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.updates, { status: 'active' });
  });

  it('accepts both plan and status together', () => {
    const result = validateTenantUpdate({ plan: 'professional', status: 'provisioning' });
    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.updates, { plan: 'professional', status: 'provisioning' });
  });

  it('rejects an invalid plan', () => {
    const result = validateTenantUpdate({ plan: 'gold' });
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('Invalid plan')));
    assert.deepStrictEqual(result.updates, {});
  });

  it('rejects an invalid status', () => {
    const result = validateTenantUpdate({ status: 'done' });
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('Invalid status')));
  });

  it('rejects an empty body (nothing to update)', () => {
    const result = validateTenantUpdate({});
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.length > 0);
  });

  it('rejects a non-object body', () => {
    const result = validateTenantUpdate(null);
    assert.strictEqual(result.valid, false);
  });
});
