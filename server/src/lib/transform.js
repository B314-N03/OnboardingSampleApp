/**
 * transform.js - Slice 5
 *
 * Applies a confirmed mapping (from Slice 3) to uploaded/sample rows and turns
 * them into normalized target records. Two normalizations matter most and are
 * proven by transform.test.js:
 *   - dates  -> canonical ISO `YYYY-MM-DD`
 *   - picklist values (status, entity type, transaction type) -> canonical forms
 *
 * The mapping shape follows the documented Slice 3 contract:
 *   {
 *     columnMap: { "<source column>": "<target field>", ... },
 *     valueMaps: { "<target field>": { "<source value>": "<canonical value>" }, ... },
 *     dateFields: ["<target field>", ...],   // optional; which fields are dates
 *     dateFormat: "MM/DD/YYYY"                // optional; source date format
 *   }
 * If the mapping is absent or partial we fall back to a sensible default so the
 * endpoint and tests still run standalone (identity columns + built-in picklist
 * canonicalization + date auto-detection).
 */

// --- Canonical picklist tables (derived from sample-data/README.md) ----------
// Keys are canonical values; arrays list the known source variants per customer.
const PICKLISTS = {
  status: {
    active: ['Active', 'A', 'ACTIVE'],
    inactive: ['Inactive', 'I', 'DORMANT'],
    pending: ['Pending', 'P', 'SUSPENDED']
  },
  entityType: {
    corporation: ['Corporation', 'CORP'],
    s_corporation: ['S-Corporation', 'SCORP'],
    llc: ['LLC'],
    partnership: ['Partnership', 'PART'],
    sole_proprietor: ['Sole Proprietorship', 'SOLE', 'Sole Trader'],
    non_profit: ['Non-Profit', 'NPROF'],
    limited_company: ['Limited Company'],
    llp: ['LLP']
  },
  transactionType: {
    debit: ['Debit', 'DR', 'D'],
    credit: ['Credit', 'CR', 'C']
  },
  transactionStatus: {
    completed: ['Cleared', 'POSTED', 'Reconciled'],
    pending: ['Pending', 'PENDING', 'Unreconciled'],
    cancelled: ['Voided', 'VOID', 'Cancelled']
  }
};

/**
 * Build a case-insensitive variant -> canonical lookup for a named picklist.
 * @param {string} name
 * @returns {Record<string,string>}
 */
function buildPicklistLookup(name) {
  const table = PICKLISTS[name];
  if (!table) return {};
  const lookup = {};
  for (const canonical of Object.keys(table)) {
    for (const variant of table[canonical]) {
      lookup[variant.trim().toLowerCase()] = canonical;
    }
  }
  return lookup;
}

// Which target fields are picklists, and which named table they use.
const FIELD_PICKLIST = {
  status: 'status',
  entityType: 'entityType',
  transactionType: 'transactionType',
  transactionStatus: 'transactionStatus'
};

// --- Dates -------------------------------------------------------------------

/**
 * Detect a date format string from a single value. Returns one of
 * 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'DD-MM-YYYY' or null when unknown.
 * @param {string} value
 */
function detectDateFormat(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(v)) return 'YYYY-MM-DD';
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)) return 'MM/DD/YYYY';
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(v)) return 'DD-MM-YYYY';
  return null;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Normalize a date value to canonical ISO `YYYY-MM-DD`.
 * @param {string} value - raw date string
 * @param {string} [format] - source format; auto-detected when omitted
 * @returns {string} ISO date, or the original trimmed value when unparseable
 */
function normalizeDate(value, format) {
  if (value == null) return value;
  const raw = String(value).trim();
  if (raw === '') return raw;

  const fmt = format || detectDateFormat(raw);
  if (!fmt) return raw;

  const parts = raw.split(/[/-]/).map(p => p.trim());
  if (parts.length !== 3) return raw;

  let year, month, day;
  if (fmt === 'YYYY-MM-DD') {
    [year, month, day] = parts;
  } else if (fmt === 'MM/DD/YYYY') {
    [month, day, year] = parts;
  } else if (fmt === 'DD-MM-YYYY') {
    [day, month, year] = parts;
  } else {
    return raw;
  }

  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return raw;
  if (m < 1 || m > 12 || d < 1 || d > 31) return raw;

  return `${y}-${pad2(m)}-${pad2(d)}`;
}

// --- Values ------------------------------------------------------------------

/**
 * Normalize a single picklist value. Prefers an explicit per-field valueMap
 * (from the confirmed mapping), then falls back to the built-in picklist table
 * for the field, then returns the original value untouched.
 * @param {string} value
 * @param {string} field - target field name
 * @param {object} [valueMap] - explicit source->canonical map for this field
 */
function normalizeValue(value, field, valueMap) {
  if (value == null) return value;
  const raw = String(value).trim();
  if (raw === '') return raw;

  // 1) explicit mapping from Slice 3 (case-insensitive)
  if (valueMap && typeof valueMap === 'object') {
    if (Object.prototype.hasOwnProperty.call(valueMap, raw)) return valueMap[raw];
    const ciKey = Object.keys(valueMap).find(k => k.toLowerCase() === raw.toLowerCase());
    if (ciKey) return valueMap[ciKey];
  }

  // 2) built-in picklist for a known field
  const picklistName = FIELD_PICKLIST[field];
  if (picklistName) {
    const lookup = buildPicklistLookup(picklistName);
    const hit = lookup[raw.toLowerCase()];
    if (hit) return hit;
  }

  // 3) leave as-is
  return raw;
}

// --- Row transform -----------------------------------------------------------

/**
 * Camel-case a source header for the identity fallback (e.g. "Client Name" ->
 * "clientName", "business_name" -> "businessName").
 * @param {string} header
 */
function toIdentityField(header) {
  const words = String(header).trim().split(/[\s_-]+/).filter(Boolean);
  if (words.length === 0) return String(header);
  return words
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join('');
}

/**
 * Resolve an effective mapping, filling gaps from the row's own columns so the
 * transform runs standalone even without a confirmed Slice 3 mapping.
 * @param {object} mapping
 * @param {object} sampleRow - a representative row (for identity fallback)
 */
function resolveMapping(mapping, sampleRow) {
  const columnMap = (mapping && mapping.columnMap) || {};
  const valueMaps = (mapping && mapping.valueMaps) || {};
  const dateFields = (mapping && mapping.dateFields) || [];
  const dateFormat = mapping && mapping.dateFormat;

  const effectiveColumnMap = { ...columnMap };
  if (Object.keys(effectiveColumnMap).length === 0 && sampleRow) {
    for (const col of Object.keys(sampleRow)) {
      effectiveColumnMap[col] = toIdentityField(col);
    }
  }
  return { columnMap: effectiveColumnMap, valueMaps, dateFields, dateFormat };
}

/**
 * Transform a single source row into a normalized target record.
 * @param {object} row - source row keyed by source column names
 * @param {object} mapping - confirmed mapping (may be partial/absent)
 * @returns {object} normalized record keyed by target field names
 */
function transformRow(row, mapping) {
  const { columnMap, valueMaps, dateFields, dateFormat } = resolveMapping(mapping, row);
  const dateFieldSet = new Set(dateFields);
  const out = {};

  for (const sourceCol of Object.keys(columnMap)) {
    const targetField = columnMap[sourceCol];
    if (!targetField) continue;
    let value = row[sourceCol];

    const isDateField = dateFieldSet.has(targetField) ||
      /date$/i.test(targetField) ||
      (dateFields.length === 0 && detectDateFormat(String(value ?? '')) !== null);

    if (isDateField) {
      value = normalizeDate(value, dateFormat);
    } else {
      value = normalizeValue(value, targetField, valueMaps[targetField]);
    }
    out[targetField] = value;
  }
  return out;
}

/**
 * Transform many rows.
 * @param {object[]} rows
 * @param {object} mapping
 * @returns {object[]}
 */
function transformRows(rows, mapping) {
  if (!Array.isArray(rows)) return [];
  return rows.map(row => transformRow(row, mapping));
}

module.exports = {
  PICKLISTS,
  buildPicklistLookup,
  detectDateFormat,
  normalizeDate,
  normalizeValue,
  toIdentityField,
  resolveMapping,
  transformRow,
  transformRows
};
