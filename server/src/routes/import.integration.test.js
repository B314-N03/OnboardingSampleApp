/**
 * Slice 2 - Import preview route (HTTP integration).
 *   POST /api/customers/:id/import/preview
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { startTestServer } = require('../testServer');

let api;
before(async () => { api = await startTestServer(); });
after(async () => { await api.close(); });

describe('POST /api/customers/:id/import/preview', () => {
  it('detects Customer A sample: Title Case + MM/DD/YYYY', async () => {
    const { status, body } = await api.post('/api/customers/cust_001/import/preview', { sample: 'A' });
    assert.strictEqual(status, 200);
    assert.strictEqual(body.schemaStyle, 'Title Case');
    assert.strictEqual(body.dateFormat, 'MM/DD/YYYY');
    assert.ok(body.columns.includes('Client Name'));
    assert.ok(body.rows.length <= 10, 'preview is capped at 10 rows');
    assert.ok(body.rowCount >= body.rows.length);
  });

  it('detects Customer B sample: camelCase + YYYY-MM-DD', async () => {
    const { status, body } = await api.post('/api/customers/cust_001/import/preview', { sample: 'B' });
    assert.strictEqual(status, 200);
    assert.strictEqual(body.schemaStyle, 'camelCase');
    assert.strictEqual(body.dateFormat, 'YYYY-MM-DD');
    assert.ok(body.columns.includes('companyName'));
  });

  it('detects Customer C sample: snake_case + DD-MM-YYYY', async () => {
    const { status, body } = await api.post('/api/customers/cust_001/import/preview', { sample: 'C' });
    assert.strictEqual(status, 200);
    assert.strictEqual(body.schemaStyle, 'snake_case');
    assert.strictEqual(body.dateFormat, 'DD-MM-YYYY');
    assert.ok(body.columns.includes('business_name'));
  });

  it('accepts a lowercase sample key', async () => {
    const { status, body } = await api.post('/api/customers/cust_001/import/preview', { sample: 'a' });
    assert.strictEqual(status, 200);
    assert.strictEqual(body.schemaStyle, 'Title Case');
  });

  it('detects raw CSV text passed in the body', async () => {
    const csv = 'companyName,startDate\nApex,2023-02-10\nBeta,2024-05-01';
    const { status, body } = await api.post('/api/customers/cust_001/import/preview', { csv });
    assert.strictEqual(status, 200);
    assert.strictEqual(body.schemaStyle, 'camelCase');
    assert.strictEqual(body.dateFormat, 'YYYY-MM-DD');
    assert.strictEqual(body.rowCount, 2);
  });

  it('returns 400 when neither csv nor sample is provided', async () => {
    const { status } = await api.post('/api/customers/cust_001/import/preview', {});
    assert.strictEqual(status, 400);
  });

  it('returns 400 for an unknown sample key', async () => {
    const { status, body } = await api.post('/api/customers/cust_001/import/preview', { sample: 'Z' });
    assert.strictEqual(status, 400);
    assert.ok(/sample/i.test(body.error));
  });
});
