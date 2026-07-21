/**
 * End-to-end flow across all five slices (HTTP integration).
 *
 * Proves the slices compose: a brand-new customer is driven through all four
 * onboarding steps until progress reaches 100%.
 *   Slice 1  create customer + advance step_1 (Customer Info)
 *   Slice 2  preview the customer's CSV
 *   Slice 3  suggest + confirm mapping, advance step_2 (Data Mapping)
 *   Slice 4  provision tenant to active, advance step_3 (Tenant Setup)
 *   Slice 5  commit the import, which advances step_4 (Import) -> 100%
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startTestServer } = require('./testServer');

let api;
before(async () => { api = await startTestServer(); });
after(async () => { await api.close(); });

const SAMPLE = 'CustomerA_ABCAccounting';

test('drives a customer from 0% to 100% through every slice', async () => {
  // Slice 1 - create the customer (seeds tenant + onboarding state).
  const created = await api.post('/api/customers', {
    name: 'Riverside Manufacturing',
    contactEmail: 'ops@riverside.example.com',
    industry: 'Manufacturing',
    region: 'North America'
  });
  assert.strictEqual(created.status, 201);
  const id = created.body.id;

  // Slice 1 - complete Customer Info (step_1) -> 25%.
  let step = await api.put(`/api/customers/${id}/steps/step_1`, { status: 'completed' });
  assert.strictEqual(step.body.progressPercent, 25);

  // Slice 2 - preview the sample CSV (proves detection wired through the API).
  const preview = await api.post(`/api/customers/${id}/import/preview`, { sample: 'A' });
  assert.strictEqual(preview.status, 200);
  assert.strictEqual(preview.body.schemaStyle, 'Title Case');

  // Slice 3 - suggest a mapping, confirm it, then complete Data Mapping (step_2).
  const suggest = await api.post(`/api/customers/${id}/mapping/suggest`, { sample: SAMPLE });
  assert.strictEqual(suggest.status, 200);
  const confirm = await api.put(`/api/customers/${id}/mapping`, {
    columnMap: suggest.body.columnMap,
    valueMaps: suggest.body.valueMaps
  });
  assert.strictEqual(confirm.status, 200);
  step = await api.put(`/api/customers/${id}/steps/step_2`, { status: 'completed' });
  assert.strictEqual(step.body.progressPercent, 50);

  // Slice 4 - provision the tenant to active, then complete Tenant Setup (step_3).
  await api.put(`/api/tenants/${id}`, { plan: 'professional', status: 'provisioning' });
  const tenant = await api.put(`/api/tenants/${id}`, { status: 'active' });
  assert.strictEqual(tenant.body.status, 'active');
  step = await api.put(`/api/customers/${id}/steps/step_3`, { status: 'completed' });
  assert.strictEqual(step.body.progressPercent, 75);

  // Slice 5 - commit the import; this advances Import (step_4) -> 100%.
  const commit = await api.post(`/api/customers/${id}/import/commit`, { sampleKey: SAMPLE });
  assert.strictEqual(commit.status, 200);
  assert.strictEqual(commit.body.progressPercent, 100);
  assert.ok(commit.body.importedRecordCount > 0);

  // Dashboard shows the customer complete with no remaining next action.
  const dash = await api.get('/api/onboarding');
  const entry = dash.body.find((d) => d.customerId === id);
  assert.strictEqual(entry.progressPercent, 100);
  assert.ok(entry.steps.every((s) => s.status === 'completed'));
  assert.ok(entry.importedRecordCount > 0);
});
