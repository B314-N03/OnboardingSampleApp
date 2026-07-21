/**
 * CSV parsing + schema/date auto-detection.
 *
 * This is the core hard problem of the onboarding tool: each customer hands us
 * a CSV with a different header style and a different date format, and we have
 * to understand it without being told which is which.
 *
 * Everything here is pure (no I/O), so it is unit-tested directly in
 * detect.test.js against the three bundled sample customers.
 */

/**
 * Parse CSV text into headers + rows.
 *
 * Handles double-quoted fields (with embedded commas and escaped "" quotes).
 * If a data row has MORE fields than there are headers, the trailing extras are
 * merged back into the last column joined with ", ". This is deliberate: sample
 * Customer B has unquoted contact names like `Williams, Robert`, and we would
 * rather keep the name intact than throw the row off by one column. Rows with
 * fewer fields than headers are padded with empty strings.
 *
 * @param {string} text - raw CSV text
 * @returns {{ columns: string[], rows: Object[] }}
 *   columns: original header strings, in file order.
 *   rows:    one plain object per data row, keyed by the original header string.
 */
function parseCsv(text) {
  if (typeof text !== 'string') {
    return { columns: [], rows: [] };
  }

  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { columns: [], rows: [] };
  }

  const columns = splitCsvLine(lines[0]).map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = splitCsvLine(lines[i]);
    const normalized = normalizeFieldCount(fields, columns.length);
    const row = {};
    columns.forEach((col, idx) => {
      row[col] = normalized[idx];
    });
    rows.push(row);
  }

  return { columns, rows };
}

/**
 * Split a single CSV line into fields, honoring double quotes.
 * @param {string} line
 * @returns {string[]}
 */
function splitCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields.map((f) => f.trim());
}

/**
 * Force a field list to match the header count.
 * @param {string[]} fields
 * @param {number} count
 * @returns {string[]}
 */
function normalizeFieldCount(fields, count) {
  if (fields.length === count) return fields;
  if (fields.length > count) {
    const head = fields.slice(0, count - 1);
    const tail = fields.slice(count - 1).join(', ');
    return [...head, tail];
  }
  const padded = [...fields];
  while (padded.length < count) padded.push('');
  return padded;
}

/**
 * Classify a single header string.
 * @param {string} header
 * @returns {('Title Case'|'camelCase'|'snake_case'|null)}
 */
function classifyHeader(header) {
  const h = (header || '').trim();
  if (!h) return null;
  if (h.includes('_')) return 'snake_case';
  if (/\s/.test(h)) return 'Title Case';
  if (/[a-z][A-Z]/.test(h)) return 'camelCase';
  // Single word, no separators: a leading capital reads as Title Case
  // ("Status", "Industry"). An all-lowercase single word is ambiguous, so we
  // abstain and let the other headers decide the majority.
  if (/^[A-Z]/.test(h)) return 'Title Case';
  return null;
}

/**
 * Detect the dominant header style across all columns (majority vote).
 * @param {string[]} columns
 * @returns {('Title Case'|'camelCase'|'snake_case'|'unknown')}
 */
function detectSchemaStyle(columns) {
  const tally = { 'Title Case': 0, camelCase: 0, snake_case: 0 };
  for (const col of columns || []) {
    const style = classifyHeader(col);
    if (style) tally[style]++;
  }
  let best = 'unknown';
  let bestCount = 0;
  for (const [style, count] of Object.entries(tally)) {
    if (count > bestCount) {
      best = style;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Classify a single value as a recognized date shape, or null.
 * @param {string} value
 * @returns {({ sep: string, yearFirst: boolean, parts: number[] }|null)}
 */
function classifyDateValue(value) {
  const v = (value || '').trim();
  // ISO-ish, year first: 2024-01-15
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(v)) {
    return { sep: '-', yearFirst: true, parts: v.split('-').map(Number) };
  }
  // dash, year last: 15-01-2024
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(v)) {
    return { sep: '-', yearFirst: false, parts: v.split('-').map(Number) };
  }
  // slash, year last: 01/15/2024
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)) {
    return { sep: '/', yearFirst: false, parts: v.split('/').map(Number) };
  }
  return null;
}

/**
 * Detect the dominant date format by scanning every cell value.
 *
 * Groups date-like cells by (separator, year-position), picks the most common
 * group, then disambiguates day-first vs month-first from the values: a first
 * component > 12 proves day-first; a second component > 12 proves month-first.
 * With no proof, "/" defaults to month-first (US) and "-" to day-first.
 *
 * @param {Object[]} rows
 * @param {string[]} columns
 * @returns {('MM/DD/YYYY'|'DD/MM/YYYY'|'YYYY-MM-DD'|'DD-MM-YYYY'|'MM-DD-YYYY'|'unknown')}
 */
function detectDateFormat(rows, columns) {
  const groups = new Map(); // key -> { count, sep, yearFirst, firstOver12, secondOver12 }

  for (const row of rows || []) {
    for (const col of columns || []) {
      const parsed = classifyDateValue(row[col]);
      if (!parsed) continue;
      const key = `${parsed.sep}|${parsed.yearFirst}`;
      const g = groups.get(key) || {
        count: 0,
        sep: parsed.sep,
        yearFirst: parsed.yearFirst,
        firstOver12: false,
        secondOver12: false
      };
      g.count++;
      if (!parsed.yearFirst) {
        if (parsed.parts[0] > 12) g.firstOver12 = true;
        if (parsed.parts[1] > 12) g.secondOver12 = true;
      }
      groups.set(key, g);
    }
  }

  let best = null;
  for (const g of groups.values()) {
    if (!best || g.count > best.count) best = g;
  }
  if (!best) return 'unknown';

  if (best.yearFirst) return 'YYYY-MM-DD';

  let dayFirst;
  if (best.firstOver12) dayFirst = true;
  else if (best.secondOver12) dayFirst = false;
  else dayFirst = best.sep === '-'; // default: dashes -> day-first, slashes -> month-first

  const sep = best.sep;
  return dayFirst ? `DD${sep}MM${sep}YYYY` : `MM${sep}DD${sep}YYYY`;
}

/**
 * Full detection over raw CSV text.
 * @param {string} text
 * @returns {{ schemaStyle: string, dateFormat: string, columns: string[], rows: Object[] }}
 */
function detect(text) {
  const { columns, rows } = parseCsv(text);
  return {
    schemaStyle: detectSchemaStyle(columns),
    dateFormat: detectDateFormat(rows, columns),
    columns,
    rows
  };
}

module.exports = {
  parseCsv,
  detectSchemaStyle,
  detectDateFormat,
  classifyHeader,
  classifyDateValue,
  detect
};
