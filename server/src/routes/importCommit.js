/**
 * importCommit.js - Slice 5
 *
 * POST /api/customers/:id/import/commit
 *   Transforms uploaded/sample rows using the confirmed mapping (Slice 3),
 *   stores the normalized records on the customer, then marks step_4 (Import)
 *   completed so the customer reaches 100%.
 *
 * Row source resolution (first that yields rows wins), so the endpoint works
 * standalone even before Slices 2/3 land:
 *   1. `body.rows`            - rows sent by the Import tab (Slice 2 preview state)
 *   2. persisted upload state - `state.uploadedRows` / `state.importPreview.rows`
 *   3. `body.sampleKey`       - a sample-data folder, e.g. "CustomerA_ABCAccounting"
 *
 * Mapping resolution: `body.mapping`, else the mapping persisted by Slice 3 on
 * the onboarding state (`state.mapping` / `state.confirmedMapping`), else a
 * default identity + built-in-picklist mapping (handled inside transform.js).
 *
 * Mounted with one line in server/src/index.js:
 *   app.use(require('./routes/importCommit'));
 */

const fs = require('fs');
const path = require('path');
const express = require('express');

const store = require('../data/store');
const { calculateProgress } = require('../models');
const { transformRows } = require('../lib/transform');

const router = express.Router();

const SAMPLE_DATA_DIR = path.join(__dirname, '..', '..', '..', 'sample-data');

/** Minimal CSV parser (handles double-quoted fields). Used only for sampleKey. */
function parseCsv(text) {
  const rows = [];
  let field = '';
  let record = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      record.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      record.push(field); field = '';
      if (record.length > 1 || record[0] !== '') rows.push(record);
      record = [];
    } else {
      field += ch;
    }
  }
  if (field !== '' || record.length > 0) { record.push(field); rows.push(record); }
  if (rows.length === 0) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(cols => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (cols[idx] ?? '').trim(); });
    return obj;
  });
}

function loadSampleRows(sampleKey, file = 'clients.csv') {
  const safeKey = path.basename(sampleKey);
  const filePath = path.join(SAMPLE_DATA_DIR, safeKey, file);
  if (!filePath.startsWith(SAMPLE_DATA_DIR) || !fs.existsSync(filePath)) return null;
  return parseCsv(fs.readFileSync(filePath, 'utf8'));
}

router.post('/api/customers/:id/import/commit', (req, res) => {
  const { id } = req.params;
  const customer = store.getCustomerById(id);
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  const state = store.getOnboardingState(id);
  if (!state) {
    return res.status(404).json({ error: 'Onboarding state not found' });
  }

  const body = req.body || {};

  // 1. resolve rows
  let rows = null;
  if (Array.isArray(body.rows) && body.rows.length > 0) {
    rows = body.rows;
  } else if (Array.isArray(state.uploadedRows) && state.uploadedRows.length > 0) {
    rows = state.uploadedRows;
  } else if (state.importPreview && Array.isArray(state.importPreview.rows)) {
    rows = state.importPreview.rows;
  } else if (typeof body.csv === 'string' && body.csv.trim().length > 0) {
    rows = parseCsv(body.csv);
  } else if (body.sampleKey) {
    rows = loadSampleRows(body.sampleKey, body.sampleFile);
    if (rows === null) {
      return res.status(400).json({ error: `Unknown sampleKey: ${body.sampleKey}` });
    }
  }

  if (!rows || rows.length === 0) {
    return res.status(400).json({
      error: 'No rows to import. Provide `rows`, a persisted upload, or a `sampleKey`.'
    });
  }

  // 2. resolve mapping (falls back to identity + built-in picklists in transform.js)
  const mapping = body.mapping || state.mapping || state.confirmedMapping || null;

  // 3. transform
  const importedRecords = transformRows(rows, mapping);

  // 4. store normalized records on the customer (live reference in the store)
  customer.importedRecords = importedRecords;
  customer.importedRecordCount = importedRecords.length;
  customer.importedAt = new Date().toISOString();

  // 5. mark step_4 (Import) complete + recalc progress
  const steps = (state.steps || []).map(step =>
    step.id === 'step_4' ? { ...step, status: 'completed' } : step
  );
  const updated = store.updateOnboardingState(id, {
    steps,
    progressPercent: calculateProgress(steps)
  });

  return res.status(200).json({
    customerId: id,
    importedRecordCount: importedRecords.length,
    importedRecords,
    progressPercent: updated ? updated.progressPercent : calculateProgress(steps),
    steps: updated ? updated.steps : steps
  });
});

module.exports = router;
