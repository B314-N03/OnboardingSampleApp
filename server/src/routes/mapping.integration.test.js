/**
 * Slice 3 - Data Mapping routes (HTTP integration).
 *   POST /api/customers/:id/mapping/suggest
 *   PUT  /api/customers/:id/mapping
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const { startTestServer } = require('../testServer');

let api;
before(async () => { api = await startTestServer(); });
after(async () => { await api.close(); });

describe('POST /api/customers/:id/mapping/suggest', () => {
  it('suggests a column + value map from a sample key', async () => {
    const { status, body } = await api.post('/api/customers/cust_001/mapping/suggest', {
      sample: 'CustomerA_ABCAccounting'
    });
    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(body.columnMap) && body.columnMap.length > 0);
    // "Client Name" should map to the canonical `name` field.
    const nameCol = body.columnMap.find((c) => c.source === 'Client Name');
    assert.strictEqual(nameCol.target, 'name');
    assert.ok(body.valueMaps.status, 'includes a status value map');
  });

  it('suggests from an explicit columns array', async () => {
    const { status, body } = await api.post('/api/customers/cust_001/mapping/suggest', {
      columns: ['companyName', 'clientStatus', 'startDate']
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(body.columnMap.find((c) => c.source === 'companyName').target, 'name');
    assert.strictEqual(body.columnMap.find((c) => c.source === 'clientStatus').target, 'status');
  });

  it('returns 404 for an unknown customer', async () => {
    const { status } = await api.post('/api/customers/cust_missing/mapping/suggest', { sample: 'CustomerA_ABCAccounting' });
    assert.strictEqual(status, 404);
  });

  it('returns 400 when neither columns nor sample is provided', async () => {
    const { status } = await api.post('/api/customers/cust_001/mapping/suggest', {});
    assert.strictEqual(status, 400);
  });

  it('returns 400 for an unknown sample', async () => {
    const { status } = await api.post('/api/customers/cust_001/mapping/suggest', { sample: 'NopeCustomer' });
    assert.strictEqual(status, 400);
  });
});

describe('PUT /api/customers/:id/mapping', () => {
  it('persists a confirmed mapping onto the onboarding state', async () => {
    const created = await api.post('/api/customers', { name: 'MapCo', contactEmail: 'x@map.co' });
    const id = created.body.id;

    const columnMap = [
      { source: 'companyName', target: 'name', confidence: 'high' },
      { source: 'clientStatus', target: 'status', confidence: 'high' }
    ];
    const { status, body } = await api.put(`/api/customers/${id}/mapping`, {
      columnMap,
      valueMaps: { status: [{ source: 'A', target: 'active' }] }
    });
    assert.strictEqual(status, 200);
    assert.ok(body.mapping, 'mapping is persisted on the state');
    assert.deepStrictEqual(body.mapping.columnMap, columnMap);
    assert.ok(body.mapping.confirmedAt);
  });

  it('returns 400 for an invalid target field', async () => {
    const { status, body } = await api.put('/api/customers/cust_001/mapping', {
      columnMap: [{ source: 'x', target: 'not_a_real_field' }]
    });
    assert.strictEqual(status, 400);
    assert.ok(body.details.includes('not_a_real_field'));
  });

  it('returns 400 when columnMap is not an array', async () => {
    const { status } = await api.put('/api/customers/cust_001/mapping', { columnMap: 'nope' });
    assert.strictEqual(status, 400);
  });

  it('returns 404 for an unknown customer', async () => {
    const { status } = await api.put('/api/customers/cust_missing/mapping', { columnMap: [] });
    assert.strictEqual(status, 404);
  });
});
