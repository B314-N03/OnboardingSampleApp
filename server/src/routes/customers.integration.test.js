/**
 * Slice 1 - Customer Info routes (HTTP integration).
 *   POST /api/customers
 *   PUT  /api/customers/:id/steps/:stepId   (shared step-advance primitive)
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { startTestServer } = require('../testServer');

let api;
before(async () => { api = await startTestServer(); });
after(async () => { await api.close(); });

describe('POST /api/customers', () => {
  it('creates a customer and seeds tenant + onboarding state at 0%', async () => {
    const { status, body } = await api.post('/api/customers', {
      name: 'Globex',
      contactEmail: 'Onboarding@Globex.com',
      industry: 'Retail',
      region: 'EMEA'
    });

    assert.strictEqual(status, 201);
    assert.ok(body.id.startsWith('cust_'));
    assert.strictEqual(body.name, 'Globex');
    assert.strictEqual(body.contactEmail, 'onboarding@globex.com'); // normalized

    // Onboarding state seeded at 0% with four pending steps.
    const dash = await api.get('/api/onboarding');
    const entry = dash.body.find((d) => d.customerId === body.id);
    assert.ok(entry, 'new customer appears in the dashboard queue');
    assert.strictEqual(entry.progressPercent, 0);
    assert.strictEqual(entry.steps.length, 4);
    assert.ok(entry.steps.every((s) => s.status === 'pending'));

    // A pending tenant was seeded for the customer.
    const tenant = await api.get(`/api/tenants/${body.id}`);
    assert.strictEqual(tenant.status, 200);
    assert.strictEqual(tenant.body.status, 'pending');
  });

  it('rejects an invalid email with 400 + field details', async () => {
    const { status, body } = await api.post('/api/customers', {
      name: 'Acme',
      contactEmail: 'not-an-email'
    });
    assert.strictEqual(status, 400);
    assert.ok(Array.isArray(body.details));
    assert.ok(body.details.some((d) => d.field === 'contactEmail'));
  });

  it('rejects a missing name with 400 and creates nothing', async () => {
    const before = (await api.get('/api/onboarding')).body.length;
    const { status, body } = await api.post('/api/customers', {
      name: '   ',
      contactEmail: 'a@b.com'
    });
    assert.strictEqual(status, 400);
    assert.ok(body.details.some((d) => d.field === 'name'));

    const after = (await api.get('/api/onboarding')).body.length;
    assert.strictEqual(after, before, 'invalid input must not create a customer');
  });
});

describe('PUT /api/customers/:id/steps/:stepId', () => {
  it('advances step_1 to completed and recalculates progress to 25%', async () => {
    const created = await api.post('/api/customers', { name: 'StepCo', contactEmail: 'x@step.co' });
    const id = created.body.id;

    const { status, body } = await api.put(`/api/customers/${id}/steps/step_1`, { status: 'completed' });
    assert.strictEqual(status, 200);
    assert.strictEqual(body.progressPercent, 25);
    assert.strictEqual(body.steps.find((s) => s.id === 'step_1').status, 'completed');
  });

  it('rejects an invalid status with 400', async () => {
    const { status, body } = await api.put('/api/customers/cust_001/steps/step_1', { status: 'done' });
    assert.strictEqual(status, 400);
    assert.ok(body.details.some((d) => d.field === 'status'));
  });

  it('returns 404 for an unknown customer', async () => {
    const { status } = await api.put('/api/customers/cust_missing/steps/step_1', { status: 'completed' });
    assert.strictEqual(status, 404);
  });

  it('returns 404 for an unknown step', async () => {
    const { status } = await api.put('/api/customers/cust_001/steps/step_99', { status: 'completed' });
    assert.strictEqual(status, 404);
  });
});
