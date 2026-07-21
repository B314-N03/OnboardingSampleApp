const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const {
  parseCsv,
  detectSchemaStyle,
  detectDateFormat,
  classifyHeader,
  classifyDateValue,
  detect
} = require('./detect');

const SAMPLE_ROOT = path.join(__dirname, '..', '..', '..', 'sample-data');

function readSample(folder) {
  return fs.readFileSync(path.join(SAMPLE_ROOT, folder, 'clients.csv'), 'utf8');
}

const SAMPLES = {
  A: 'CustomerA_ABCAccounting',
  B: 'CustomerB_XYZFinancialServices',
  C: 'CustomerC_PremierBookkeeping'
};

// --- Acceptance: the three sample customers detect correctly ---

test('Customer A clients.csv -> Title Case + MM/DD/YYYY', () => {
  const result = detect(readSample(SAMPLES.A));
  assert.strictEqual(result.schemaStyle, 'Title Case');
  assert.strictEqual(result.dateFormat, 'MM/DD/YYYY');
  assert.ok(result.columns.includes('Client Name'));
  assert.ok(result.rows.length >= 10);
});

test('Customer B clients.csv -> camelCase + YYYY-MM-DD', () => {
  const result = detect(readSample(SAMPLES.B));
  assert.strictEqual(result.schemaStyle, 'camelCase');
  assert.strictEqual(result.dateFormat, 'YYYY-MM-DD');
  assert.ok(result.columns.includes('companyName'));
});

test('Customer C clients.csv -> snake_case + DD-MM-YYYY', () => {
  const result = detect(readSample(SAMPLES.C));
  assert.strictEqual(result.schemaStyle, 'snake_case');
  assert.strictEqual(result.dateFormat, 'DD-MM-YYYY');
  assert.ok(result.columns.includes('business_name'));
});

// --- parseCsv ---

test('parseCsv keeps original headers in order and keys rows by header', () => {
  const { columns, rows } = parseCsv('A,B,C\n1,2,3\n4,5,6');
  assert.deepStrictEqual(columns, ['A', 'B', 'C']);
  assert.deepStrictEqual(rows[0], { A: '1', B: '2', C: '3' });
  assert.strictEqual(rows.length, 2);
});

test('parseCsv honors quoted fields with embedded commas', () => {
  const { rows } = parseCsv('name,note\n"Doe, Jane","a, b, c"');
  assert.strictEqual(rows[0].name, 'Doe, Jane');
  assert.strictEqual(rows[0].note, 'a, b, c');
});

test('parseCsv merges unquoted trailing commas into the last column', () => {
  // mirrors Customer B: `... ,Williams, Robert` with no quotes
  const { rows } = parseCsv('code,contact\nX-1,Williams, Robert');
  assert.strictEqual(rows[0].code, 'X-1');
  assert.strictEqual(rows[0].contact, 'Williams, Robert');
});

test('parseCsv pads short rows with empty strings', () => {
  const { rows } = parseCsv('A,B,C\n1');
  assert.deepStrictEqual(rows[0], { A: '1', B: '', C: '' });
});

test('parseCsv on empty input returns empty columns and rows', () => {
  assert.deepStrictEqual(parseCsv(''), { columns: [], rows: [] });
  assert.deepStrictEqual(parseCsv(null), { columns: [], rows: [] });
});

// --- classifyHeader / detectSchemaStyle ---

test('classifyHeader distinguishes the three styles', () => {
  assert.strictEqual(classifyHeader('Client Name'), 'Title Case');
  assert.strictEqual(classifyHeader('Status'), 'Title Case');
  assert.strictEqual(classifyHeader('companyName'), 'camelCase');
  assert.strictEqual(classifyHeader('business_name'), 'snake_case');
});

test('detectSchemaStyle uses majority vote and ignores ambiguous headers', () => {
  assert.strictEqual(
    detectSchemaStyle(['clientCode', 'companyName', 'status']),
    'camelCase'
  );
  assert.strictEqual(detectSchemaStyle([]), 'unknown');
});

// --- classifyDateValue / detectDateFormat ---

test('classifyDateValue recognizes the supported shapes', () => {
  assert.deepStrictEqual(classifyDateValue('2024-01-15').yearFirst, true);
  assert.deepStrictEqual(classifyDateValue('15-01-2024').yearFirst, false);
  assert.deepStrictEqual(classifyDateValue('01/15/2024').sep, '/');
  assert.strictEqual(classifyDateValue('not a date'), null);
});

test('detectDateFormat uses >12 evidence to pick day-first vs month-first', () => {
  const cols = ['d'];
  assert.strictEqual(
    detectDateFormat([{ d: '01/15/2024' }, { d: '03/22/2024' }], cols),
    'MM/DD/YYYY'
  );
  assert.strictEqual(
    detectDateFormat([{ d: '15-03-2024' }, { d: '22-05-2024' }], cols),
    'DD-MM-YYYY'
  );
  assert.strictEqual(
    detectDateFormat([{ d: '2024-03-15' }], cols),
    'YYYY-MM-DD'
  );
});

test('detectDateFormat returns unknown when no dates are present', () => {
  assert.strictEqual(detectDateFormat([{ a: 'foo' }], ['a']), 'unknown');
});
