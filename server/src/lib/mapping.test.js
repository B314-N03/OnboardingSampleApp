const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  normalizeValue,
  suggestTargetField,
  suggestColumnMap,
  suggestValueMap,
  suggestMapping
} = require('./mapping');

// Column headers for each sample customer's clients.csv (from sample-data/).
const CUSTOMER_A = ['Client ID', 'Client Name', 'Business Type', 'Status', 'Date Onboarded', 'Tax ID', 'Annual Revenue', 'Industry', 'Payment Terms', 'Primary Contact'];
const CUSTOMER_B = ['clientCode', 'companyName', 'entityType', 'clientStatus', 'startDate', 'federalTaxId', 'yearlyRevenue', 'sectorCode', 'billingTerms', 'mainContact'];
const CUSTOMER_C = ['customer_id', 'business_name', 'legal_structure', 'account_status', 'registration_date', 'tax_reference', 'gross_revenue', 'industry_sector', 'credit_terms', 'key_contact_name'];

// Expected target field per positional column (all three share the same order).
const EXPECTED_TARGETS = ['id', 'name', 'entityType', 'status', 'startDate', 'taxId', 'revenue', 'industry', 'terms', 'primaryContact'];

describe('Data Mapping - column suggestions', () => {
  for (const [label, columns] of [['Customer A', CUSTOMER_A], ['Customer B', CUSTOMER_B], ['Customer C', CUSTOMER_C]]) {
    it(`maps every ${label} column to the expected target field`, () => {
      const map = suggestColumnMap(columns);
      assert.strictEqual(map.length, columns.length);
      map.forEach((entry, i) => {
        assert.strictEqual(entry.target, EXPECTED_TARGETS[i], `${label}: "${entry.source}" -> ${entry.target}, expected ${EXPECTED_TARGETS[i]}`);
      });
    });
  }

  it('marks unknown columns as unmapped', () => {
    const { target, confidence } = suggestTargetField('SomeMysteryColumn');
    assert.strictEqual(target, null);
    assert.strictEqual(confidence, 'none');
  });

  it('gives high confidence to exact alias matches', () => {
    assert.strictEqual(suggestTargetField('companyName').confidence, 'high');
    assert.strictEqual(suggestTargetField('business_name').confidence, 'high');
  });
});

describe('Data Mapping - status value normalization', () => {
  it('normalizes A / ACTIVE / Active to a single canonical value', () => {
    assert.strictEqual(normalizeValue('status', 'A'), 'active');
    assert.strictEqual(normalizeValue('status', 'ACTIVE'), 'active');
    assert.strictEqual(normalizeValue('status', 'Active'), 'active');
  });

  it('normalizes inactive variants (Inactive / I / DORMANT)', () => {
    assert.strictEqual(normalizeValue('status', 'Inactive'), 'inactive');
    assert.strictEqual(normalizeValue('status', 'I'), 'inactive');
    assert.strictEqual(normalizeValue('status', 'DORMANT'), 'inactive');
  });

  it('normalizes pending variants (Pending / P / SUSPENDED)', () => {
    assert.strictEqual(normalizeValue('status', 'Pending'), 'pending');
    assert.strictEqual(normalizeValue('status', 'P'), 'pending');
    assert.strictEqual(normalizeValue('status', 'SUSPENDED'), 'pending');
  });

  it('returns null for an unknown status', () => {
    assert.strictEqual(normalizeValue('status', 'ZZZ'), null);
  });
});

describe('Data Mapping - entity type value normalization', () => {
  const cases = [
    ['Corporation', 'corporation'], ['CORP', 'corporation'], ['Limited Company', 'corporation'],
    ['S-Corporation', 's_corporation'], ['SCORP', 's_corporation'],
    ['LLC', 'llc'], ['LLP', 'llc'],
    ['Partnership', 'partnership'], ['PART', 'partnership'],
    ['Sole Proprietorship', 'sole_proprietor'], ['SOLE', 'sole_proprietor'], ['Sole Trader', 'sole_proprietor'],
    ['Non-Profit', 'non_profit'], ['NPROF', 'non_profit']
  ];
  for (const [raw, expected] of cases) {
    it(`normalizes "${raw}" -> ${expected}`, () => {
      assert.strictEqual(normalizeValue('entityType', raw), expected);
    });
  }
});

describe('Data Mapping - transaction type value normalization', () => {
  const cases = [
    ['Debit', 'debit'], ['DR', 'debit'], ['D', 'debit'],
    ['Credit', 'credit'], ['CR', 'credit'], ['C', 'credit']
  ];
  for (const [raw, expected] of cases) {
    it(`normalizes "${raw}" -> ${expected}`, () => {
      assert.strictEqual(normalizeValue('transactionType', raw), expected);
    });
  }
});

describe('Data Mapping - suggestValueMap', () => {
  it('collapses duplicate/equivalent raw values and maps to canonical', () => {
    const map = suggestValueMap('status', ['A', 'A', 'ACTIVE', 'I']);
    // 'A' and 'ACTIVE' both normalize to active but are distinct source strings.
    const active = map.filter(m => m.target === 'active');
    assert.ok(active.length >= 1);
    assert.ok(map.some(m => m.source === 'I' && m.target === 'inactive'));
    // Duplicate identical 'A' entries collapse to one.
    assert.strictEqual(map.filter(m => m.source === 'A').length, 1);
  });
});

describe('Data Mapping - suggestMapping (full, per sample)', () => {
  it('derives status/entityType value maps from sample rows', () => {
    const rows = [
      { 'Status': 'Active', 'Business Type': 'Corporation' },
      { 'Status': 'Inactive', 'Business Type': 'LLC' },
      { 'Status': 'Active', 'Business Type': 'Partnership' }
    ];
    const { columnMap, valueMaps } = suggestMapping({ columns: CUSTOMER_A, rows });
    assert.ok(columnMap.every(c => c.source));
    // Status distinct values from rows -> canonical.
    const statusTargets = valueMaps.status.map(v => v.target).sort();
    assert.deepStrictEqual([...new Set(statusTargets)].sort(), ['active', 'inactive']);
    assert.ok(valueMaps.entityType.some(v => v.target === 'corporation'));
    // transactionType has no client column -> falls back to canonical reference.
    assert.ok(valueMaps.transactionType.some(v => v.target === 'debit'));
    assert.ok(valueMaps.transactionType.some(v => v.target === 'credit'));
  });

  it('falls back to canonical reference when no rows are supplied', () => {
    const { valueMaps } = suggestMapping({ columns: CUSTOMER_B });
    assert.ok(valueMaps.status.some(v => v.target === 'active'));
    assert.ok(valueMaps.status.some(v => v.target === 'inactive'));
    assert.ok(valueMaps.status.some(v => v.target === 'pending'));
  });
});
