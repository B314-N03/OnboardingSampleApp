/**
 * Data Mapping rules (Slice 3)
 *
 * Turns a customer's arbitrary CSV schema into our target Client model:
 *  - column suggestions: original header -> target field
 *  - value normalization for picklists (status, entityType, transactionType)
 *
 * Pure, dependency-free, and testable. The route layer handles reading sample
 * CSVs and persistence; this module only knows the rules.
 */

/**
 * Target fields for the Client entity and the source-header aliases we accept.
 * Aliases are compared in normalized form (lowercase, alphanumerics only).
 */
const TARGET_FIELDS = [
  { field: 'id', label: 'Client ID', aliases: ['id', 'clientid', 'clientcode', 'customerid', 'accountid'] },
  { field: 'name', label: 'Name', aliases: ['name', 'clientname', 'companyname', 'businessname', 'accountname'] },
  { field: 'entityType', label: 'Entity Type', aliases: ['entitytype', 'businesstype', 'legalstructure', 'companytype'] },
  { field: 'status', label: 'Status', aliases: ['status', 'clientstatus', 'accountstatus'] },
  { field: 'startDate', label: 'Start Date', aliases: ['startdate', 'dateonboarded', 'registrationdate', 'onboarddate', 'joindate'] },
  { field: 'taxId', label: 'Tax ID', aliases: ['taxid', 'federaltaxid', 'taxreference', 'taxref', 'ein', 'vat'] },
  { field: 'revenue', label: 'Revenue', aliases: ['revenue', 'annualrevenue', 'yearlyrevenue', 'grossrevenue', 'turnover'] },
  { field: 'industry', label: 'Industry', aliases: ['industry', 'sectorcode', 'industrysector', 'sector'] },
  { field: 'terms', label: 'Payment Terms', aliases: ['terms', 'paymentterms', 'billingterms', 'creditterms'] },
  { field: 'primaryContact', label: 'Primary Contact', aliases: ['primarycontact', 'maincontact', 'keycontactname', 'contact', 'contactname'] }
];

/**
 * Canonical picklist definitions. Each canonical value lists the source values
 * seen across customers (per sample-data/README.md). Comparison is done on the
 * normalized source value (uppercased, trimmed, punctuation collapsed).
 */
const PICKLISTS = {
  status: {
    label: 'Status',
    canonical: [
      { value: 'active', label: 'Active', sources: ['Active', 'A', 'ACTIVE'] },
      { value: 'inactive', label: 'Inactive', sources: ['Inactive', 'I', 'DORMANT'] },
      { value: 'pending', label: 'Pending', sources: ['Pending', 'P', 'SUSPENDED'] }
    ]
  },
  entityType: {
    label: 'Entity Type',
    canonical: [
      { value: 'corporation', label: 'Corporation', sources: ['Corporation', 'CORP', 'Limited Company'] },
      { value: 's_corporation', label: 'S-Corporation', sources: ['S-Corporation', 'SCORP'] },
      { value: 'llc', label: 'LLC', sources: ['LLC', 'LLP'] },
      { value: 'partnership', label: 'Partnership', sources: ['Partnership', 'PART'] },
      { value: 'sole_proprietor', label: 'Sole Proprietor', sources: ['Sole Proprietorship', 'SOLE', 'Sole Trader'] },
      { value: 'non_profit', label: 'Non-Profit', sources: ['Non-Profit', 'NPROF'] }
    ]
  },
  transactionType: {
    label: 'Transaction Type',
    canonical: [
      { value: 'debit', label: 'Debit', sources: ['Debit', 'DR', 'D'] },
      { value: 'credit', label: 'Credit', sources: ['Credit', 'CR', 'C'] }
    ]
  }
};

/** Normalize a header for alias comparison: lowercase, keep alphanumerics only. */
function normalizeHeader(header) {
  return String(header == null ? '' : header).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Normalize a picklist source value: uppercase, trim, collapse punctuation/space. */
function normalizeValueKey(raw) {
  return String(raw == null ? '' : raw)
    .toUpperCase()
    .trim()
    .replace(/[\s_-]+/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Build a fast lookup from normalized source value -> canonical value for a picklist.
 */
function buildValueIndex(picklist) {
  const index = new Map();
  for (const entry of picklist.canonical) {
    for (const src of entry.sources) {
      index.set(normalizeValueKey(src), entry.value);
    }
  }
  return index;
}

/**
 * Normalize a single picklist value to its canonical form.
 * @param {string} picklistName - 'status' | 'entityType' | 'transactionType'
 * @param {string} raw - raw source value
 * @returns {string|null} canonical value, or null if unrecognized
 */
function normalizeValue(picklistName, raw) {
  const picklist = PICKLISTS[picklistName];
  if (!picklist) return null;
  const index = buildValueIndex(picklist);
  return index.get(normalizeValueKey(raw)) || null;
}

/**
 * Suggest a target field for a single source column header.
 * @returns {{ target: string|null, confidence: 'high'|'medium'|'none' }}
 */
function suggestTargetField(header) {
  const norm = normalizeHeader(header);
  if (!norm) return { target: null, confidence: 'none' };

  // 1. Exact alias match -> high confidence.
  for (const tf of TARGET_FIELDS) {
    if (tf.aliases.includes(norm)) {
      return { target: tf.field, confidence: 'high' };
    }
  }

  // 2. Substring / contains match against aliases -> medium confidence.
  for (const tf of TARGET_FIELDS) {
    for (const alias of tf.aliases) {
      if (norm.includes(alias) || alias.includes(norm)) {
        return { target: tf.field, confidence: 'medium' };
      }
    }
  }

  return { target: null, confidence: 'none' };
}

/**
 * Suggest a column map for a list of source headers.
 * @param {string[]} columns
 * @returns {Array<{ source: string, target: string|null, confidence: string }>}
 */
function suggestColumnMap(columns) {
  if (!Array.isArray(columns)) return [];
  return columns.map(source => {
    const { target, confidence } = suggestTargetField(source);
    return { source, target, confidence };
  });
}

/**
 * Suggest a value map for a picklist given the distinct raw values observed.
 * Every distinct raw value is mapped to its canonical form (or null if unknown).
 * @param {string} picklistName
 * @param {string[]} rawValues
 * @returns {Array<{ source: string, target: string|null }>}
 */
function suggestValueMap(picklistName, rawValues) {
  const seen = new Set();
  const distinct = [];
  for (const v of rawValues || []) {
    const key = normalizeValueKey(v);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    distinct.push(v);
  }
  return distinct.map(source => ({ source, target: normalizeValue(picklistName, source) }));
}

/** The set of canonical target-field names, for validation elsewhere. */
function targetFieldNames() {
  return TARGET_FIELDS.map(tf => tf.field);
}

/**
 * Build a full mapping suggestion from columns and optional sample rows.
 * @param {{ columns: string[], rows?: object[] }} input
 * @returns {{ columnMap: Array, valueMaps: object }}
 */
function suggestMapping({ columns = [], rows = [] } = {}) {
  const columnMap = suggestColumnMap(columns);

  // Find which source columns map to each picklist-bearing target field.
  const sourceFor = target => columnMap.filter(c => c.target === target).map(c => c.source);
  const distinctFor = sources => {
    const vals = [];
    for (const row of rows) {
      for (const src of sources) {
        if (row && row[src] != null && row[src] !== '') vals.push(row[src]);
      }
    }
    return vals;
  };

  const valueMaps = {};
  for (const picklistName of Object.keys(PICKLISTS)) {
    // status/entityType come from client columns; transactionType has no client
    // column, so fall back to the full canonical reference list.
    const targetField = picklistName === 'transactionType' ? null : picklistName;
    const sources = targetField ? sourceFor(targetField) : [];
    const rawValues = distinctFor(sources);

    if (rawValues.length > 0) {
      valueMaps[picklistName] = suggestValueMap(picklistName, rawValues);
    } else {
      // No data observed: offer every known source value so CS can review.
      const all = PICKLISTS[picklistName].canonical.flatMap(c => c.sources);
      valueMaps[picklistName] = suggestValueMap(picklistName, all);
    }
  }

  return { columnMap, valueMaps };
}

module.exports = {
  TARGET_FIELDS,
  PICKLISTS,
  normalizeHeader,
  normalizeValueKey,
  normalizeValue,
  suggestTargetField,
  suggestColumnMap,
  suggestValueMap,
  suggestMapping,
  targetFieldNames
};
