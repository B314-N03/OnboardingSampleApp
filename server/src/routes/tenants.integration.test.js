/**
 * Slice 4 - Tenant Setup route (HTTP integration).
 *   PUT /api/tenants/:customerId
 * (The pure validateTenantUpdate helper is unit-tested in tenants.test.js.)
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { startTestServer } = require('../testServer');

let api;
before(async () => { api = await startTestServer(); });
after(async () => { await api.close(); });

async function freshCustomer() {
  const res = await api.post('/api/customers', { name: 'TenantCo', contactEmail: 'x@tenant.co' });
  return res.body.id;
}

describe('PUT /api/tenants/:customerId', () => {
  it('updates the plan', async () => {
    const id = await freshCustomer();
    const { status, body } = await api.put(`/api/tenants/${id}`, { plan: 'enterprise' });
    assert.strictEqual(status, 200);
    assert.strictEqual(body.plan, 'enterprise');
  });

  it('provisions through to active (plan + status together, then status)', async () => {
    const id = await freshCustomer();
    let res = await api.put(`/api/tenants/${id}`, { plan: 'professional', status: 'provisioning' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'provisioning');
    assert.strictEqual(res.body.plan, 'professional');

    res = await api.put(`/api/tenants/${id}`, { status: 'active' });
    assert.strictEqual(res.body.status, 'active');
    assert.strictEqual(res.body.plan, 'professional', 'plan is preserved across updates');
  });

  it('returns 400 for an invalid plan', async () => {
    const id = await freshCustomer();
    const { status, body } = await api.put(`/api/tenants/${id}`, { plan: 'gold' });
    assert.strictEqual(status, 400);
    assert.ok(body.details.some((d) => /Invalid plan/.test(d)));
  });

  it('returns 400 for an invalid status', async () => {
    const id = await freshCustomer();
    const { status } = await api.put(`/api/tenants/${id}`, { status: 'done' });
    assert.strictEqual(status, 400);
  });

  it('returns 400 for an empty body (nothing to update)', async () => {
    const id = await freshCustomer();
    const { status } = await api.put(`/api/tenants/${id}`, {});
    assert.strictEqual(status, 400);
  });

  it('returns 404 for a customer with no tenant', async () => {
    const { status } = await api.put('/api/tenants/cust_missing', { status: 'active' });
    assert.strictEqual(status, 404);
  });
});
