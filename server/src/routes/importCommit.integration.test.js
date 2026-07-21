/**
 * Slice 5 - Import commit route (HTTP integration).
 *   POST /api/customers/:id/import/commit
 * (The pure transform functions are unit-tested in ../lib/transform.test.js.)
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { startTestServer } = require('../testServer');

let api;
before(async () => { api = await startTestServer(); });
after(async () => { await api.close(); });

async function freshCustomer() {
  const res = await api.post('/api/customers', { name: 'ImportCo', contactEmail: 'x@import.co' });
  return res.body.id;
}

describe('POST /api/customers/:id/import/commit', () => {
  it('commits a bundled sample, stores records, and completes step_4', async () => {
    const id = await freshCustomer();
    const { status, body } = await api.post(`/api/customers/${id}/import/commit`, {
      sampleKey: 'CustomerA_ABCAccounting'
    });
    assert.strictEqual(status, 200);
    assert.ok(body.importedRecordCount > 0);
    assert.strictEqual(body.importedRecords.length, body.importedRecordCount);
    assert.strictEqual(body.steps.find((s) => s.id === 'step_4').status, 'completed');

    // The dashboard now reflects the imported record count for this customer.
    const dash = await api.get('/api/onboarding');
    const entry = dash.body.find((d) => d.customerId === id);
    assert.strictEqual(entry.importedRecordCount, body.importedRecordCount);
  });

  it('commits explicit rows using a provided mapping and normalizes values', async () => {
    const id = await freshCustomer();
    const { status, body } = await api.post(`/api/customers/${id}/import/commit`, {
      rows: [{ Status: 'A', 'Date Onboarded': '01/15/2023' }],
      mapping: {
        columnMap: { Status: 'status', 'Date Onboarded': 'startDate' },
        dateFields: ['startDate'],
        dateFormat: 'MM/DD/YYYY'
      }
    });
    assert.strictEqual(status, 200);
    assert.deepStrictEqual(body.importedRecords[0], { status: 'active', startDate: '2023-01-15' });
  });

  it('returns 404 for an unknown customer', async () => {
    const { status } = await api.post('/api/customers/cust_missing/import/commit', {
      sampleKey: 'CustomerA_ABCAccounting'
    });
    assert.strictEqual(status, 404);
  });

  it('returns 400 when there are no rows to import', async () => {
    const id = await freshCustomer();
    const { status } = await api.post(`/api/customers/${id}/import/commit`, {});
    assert.strictEqual(status, 400);
  });

  it('returns 400 for an unknown sampleKey', async () => {
    const id = await freshCustomer();
    const { status } = await api.post(`/api/customers/${id}/import/commit`, { sampleKey: 'NopeCustomer' });
    assert.strictEqual(status, 400);
  });
});
