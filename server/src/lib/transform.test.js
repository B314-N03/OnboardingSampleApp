const { test } = require('node:test');
const assert = require('node:assert');

const {
  normalizeDate,
  detectDateFormat,
  normalizeValue,
  transformRow,
  transformRows
} = require('./transform');

// --- Date normalization across the three sample date formats -----------------

test('normalizeDate: Customer A MM/DD/YYYY -> ISO', () => {
  assert.strictEqual(normalizeDate('01/15/2023', 'MM/DD/YYYY'), '2023-01-15');
  assert.strictEqual(normalizeDate('12/31/2024', 'MM/DD/YYYY'), '2024-12-31');
});

test('normalizeDate: Customer B YYYY-MM-DD -> ISO', () => {
  assert.strictEqual(normalizeDate('2023-02-10', 'YYYY-MM-DD'), '2023-02-10');
  assert.strictEqual(normalizeDate('2024-1-5', 'YYYY-MM-DD'), '2024-01-05');
});

test('normalizeDate: Customer C DD-MM-YYYY -> ISO', () => {
  assert.strictEqual(normalizeDate('15-03-2023', 'DD-MM-YYYY'), '2023-03-15');
  assert.strictEqual(normalizeDate('01-12-2024', 'DD-MM-YYYY'), '2024-12-01');
});

test('normalizeDate: auto-detects format when none supplied', () => {
  assert.strictEqual(detectDateFormat('01/15/2023'), 'MM/DD/YYYY');
  assert.strictEqual(detectDateFormat('2023-02-10'), 'YYYY-MM-DD');
  assert.strictEqual(detectDateFormat('15-03-2023'), 'DD-MM-YYYY');
  assert.strictEqual(normalizeDate('01/15/2023'), '2023-01-15');
  assert.strictEqual(normalizeDate('15-03-2023'), '2023-03-15');
});

test('normalizeDate: leaves unparseable values untouched', () => {
  assert.strictEqual(normalizeDate('not a date'), 'not a date');
  assert.strictEqual(normalizeDate(''), '');
});

// --- Picklist normalization: status across A/B/C -----------------------------

test('normalizeValue: status variants collapse to canonical', () => {
  // Customer A / B / C -> active
  assert.strictEqual(normalizeValue('Active', 'status'), 'active');
  assert.strictEqual(normalizeValue('A', 'status'), 'active');
  assert.strictEqual(normalizeValue('ACTIVE', 'status'), 'active');
  // inactive
  assert.strictEqual(normalizeValue('Inactive', 'status'), 'inactive');
  assert.strictEqual(normalizeValue('I', 'status'), 'inactive');
  assert.strictEqual(normalizeValue('DORMANT', 'status'), 'inactive');
  // pending
  assert.strictEqual(normalizeValue('Pending', 'status'), 'pending');
  assert.strictEqual(normalizeValue('P', 'status'), 'pending');
  assert.strictEqual(normalizeValue('SUSPENDED', 'status'), 'pending');
});

test('normalizeValue: entity type variants collapse to canonical', () => {
  assert.strictEqual(normalizeValue('Corporation', 'entityType'), 'corporation');
  assert.strictEqual(normalizeValue('CORP', 'entityType'), 'corporation');
  assert.strictEqual(normalizeValue('Sole Proprietorship', 'entityType'), 'sole_proprietor');
  assert.strictEqual(normalizeValue('SOLE', 'entityType'), 'sole_proprietor');
  assert.strictEqual(normalizeValue('Sole Trader', 'entityType'), 'sole_proprietor');
  assert.strictEqual(normalizeValue('LLP', 'entityType'), 'llp');
});

test('normalizeValue: transaction type variants collapse to canonical', () => {
  assert.strictEqual(normalizeValue('Debit', 'transactionType'), 'debit');
  assert.strictEqual(normalizeValue('DR', 'transactionType'), 'debit');
  assert.strictEqual(normalizeValue('D', 'transactionType'), 'debit');
  assert.strictEqual(normalizeValue('Credit', 'transactionType'), 'credit');
  assert.strictEqual(normalizeValue('CR', 'transactionType'), 'credit');
  assert.strictEqual(normalizeValue('C', 'transactionType'), 'credit');
});

test('normalizeValue: explicit valueMap overrides built-in table', () => {
  const vm = { Active: 'ACTIVE_CUSTOM' };
  assert.strictEqual(normalizeValue('Active', 'status', vm), 'ACTIVE_CUSTOM');
  // case-insensitive lookup
  assert.strictEqual(normalizeValue('active', 'status', vm), 'ACTIVE_CUSTOM');
});

test('normalizeValue: unknown value passes through trimmed', () => {
  assert.strictEqual(normalizeValue('  Whatever ', 'status'), 'Whatever');
});

// --- Full row transform via a confirmed mapping ------------------------------

test('transformRow: Customer A row via mapping', () => {
  const mapping = {
    columnMap: {
      'Client ID': 'id',
      'Client Name': 'name',
      'Business Type': 'entityType',
      Status: 'status',
      'Date Onboarded': 'startDate'
    },
    dateFields: ['startDate'],
    dateFormat: 'MM/DD/YYYY'
  };
  const row = {
    'Client ID': 'C001',
    'Client Name': 'Riverside Manufacturing LLC',
    'Business Type': 'Corporation',
    Status: 'Active',
    'Date Onboarded': '01/15/2023'
  };
  assert.deepStrictEqual(transformRow(row, mapping), {
    id: 'C001',
    name: 'Riverside Manufacturing LLC',
    entityType: 'corporation',
    status: 'active',
    startDate: '2023-01-15'
  });
});

test('transformRows: Customer B rows normalize consistently with Customer A', () => {
  const mapping = {
    columnMap: {
      clientCode: 'id',
      companyName: 'name',
      entityType: 'entityType',
      clientStatus: 'status',
      startDate: 'startDate'
    },
    dateFields: ['startDate'],
    dateFormat: 'YYYY-MM-DD'
  };
  const rows = [
    { clientCode: 'XYZ-001', companyName: 'Apex Digital', entityType: 'CORP', clientStatus: 'A', startDate: '2023-02-10' }
  ];
  assert.deepStrictEqual(transformRows(rows, mapping), [
    { id: 'XYZ-001', name: 'Apex Digital', entityType: 'corporation', status: 'active', startDate: '2023-02-10' }
  ]);
});

test('transformRow: Customer C row via mapping (DD-MM-YYYY + UK values)', () => {
  const mapping = {
    columnMap: {
      customer_id: 'id',
      business_name: 'name',
      legal_structure: 'entityType',
      account_status: 'status',
      registration_date: 'startDate'
    },
    dateFields: ['startDate'],
    dateFormat: 'DD-MM-YYYY'
  };
  const row = {
    customer_id: 'PB-0001',
    business_name: 'Artisan Bakery & Cafe',
    legal_structure: 'Sole Trader',
    account_status: 'ACTIVE',
    registration_date: '15-03-2023'
  };
  assert.deepStrictEqual(transformRow(row, mapping), {
    id: 'PB-0001',
    name: 'Artisan Bakery & Cafe',
    entityType: 'sole_proprietor',
    status: 'active',
    startDate: '2023-03-15'
  });
});

test('transformRow: falls back to identity + built-in normalization without a mapping', () => {
  const row = { 'Client Name': 'Acme', Status: 'A', 'Date Onboarded': '01/15/2023' };
  const out = transformRow(row, undefined);
  assert.strictEqual(out.clientName, 'Acme');
  assert.strictEqual(out.status, 'active');
  assert.strictEqual(out.dateOnboarded, '2023-01-15');
});
