/**
 * Slice 3 - Data Mapping routes.
 *
 *  POST /api/customers/:id/mapping/suggest
 *      Body: { columns: string[] }  OR  { sample: '<key>' }
 *      Returns a suggested { columnMap, valueMaps } for review.
 *
 *  PUT  /api/customers/:id/mapping
 *      Body: { columnMap, valueMaps }
 *      Persists the confirmed mapping onto the customer's onboarding state.
 *
 * Completing step_2 reuses Slice 1's shared endpoint
 * (PUT /api/customers/:id/steps/:stepId) - the client calls it after a
 * successful confirm. This module does NOT define a step-advance route.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const store = require('../data/store');
const { suggestMapping, targetFieldNames } = require('../lib/mapping');

const router = express.Router();

const SAMPLE_ROOT = path.join(__dirname, '..', '..', '..', 'sample-data');

/** Resolve a friendly sample key (e.g. 'CustomerA', 'A', 'abc') to a folder. */
function resolveSampleFolder(key) {
  if (!key) return null;
  let folders = [];
  try {
    folders = fs.readdirSync(SAMPLE_ROOT).filter(f => {
      try {
        return fs.statSync(path.join(SAMPLE_ROOT, f)).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    return null;
  }
  const norm = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
  // Exact folder name first, then a normalized "contains" match.
  return (
    folders.find(f => f.toLowerCase() === String(key).toLowerCase()) ||
    folders.find(f => f.toLowerCase().replace(/[^a-z0-9]/g, '').includes(norm)) ||
    null
  );
}

/** Minimal CSV parse. Extra trailing fields fold into the last column so an
 *  unquoted comma in the final "contact" column does not shift earlier ones. */
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length === 0) return { columns: [], rows: [] };
  const columns = lines[0].split(',').map(c => c.trim());
  const rows = lines.slice(1).map(line => {
    const parts = line.split(',');
    const row = {};
    columns.forEach((col, i) => {
      if (i === columns.length - 1 && parts.length > columns.length) {
        row[col] = parts.slice(i).join(',').trim();
      } else {
        row[col] = (parts[i] || '').trim();
      }
    });
    return row;
  });
  return { columns, rows };
}

/** Read a bundled sample's clients.csv into { columns, rows }. */
function readSampleClients(key) {
  const folder = resolveSampleFolder(key);
  if (!folder) return null;
  const file = path.join(SAMPLE_ROOT, folder, 'clients.csv');
  if (!fs.existsSync(file)) return null;
  return parseCsv(fs.readFileSync(file, 'utf8'));
}

// POST /api/customers/:id/mapping/suggest
router.post('/api/customers/:id/mapping/suggest', (req, res) => {
  const customer = store.getCustomerById(req.params.id);
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  let columns = req.body && req.body.columns;
  let rows = (req.body && req.body.rows) || [];

  if ((!Array.isArray(columns) || columns.length === 0) && req.body && req.body.sample) {
    const parsed = readSampleClients(req.body.sample);
    if (!parsed) {
      return res.status(400).json({ error: `Unknown sample: ${req.body.sample}` });
    }
    columns = parsed.columns;
    rows = parsed.rows;
  }

  if (!Array.isArray(columns) || columns.length === 0) {
    return res.status(400).json({ error: 'Provide a non-empty "columns" array or a "sample" key.' });
  }

  const suggestion = suggestMapping({ columns, rows });
  res.json(suggestion);
});

// PUT /api/customers/:id/mapping
router.put('/api/customers/:id/mapping', (req, res) => {
  const customer = store.getCustomerById(req.params.id);
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }
  const state = store.getOnboardingState(req.params.id);
  if (!state) {
    return res.status(404).json({ error: 'Onboarding state not found' });
  }

  const { columnMap, valueMaps } = req.body || {};
  if (!Array.isArray(columnMap)) {
    return res.status(400).json({ error: '"columnMap" must be an array of { source, target }.' });
  }

  const validTargets = new Set(targetFieldNames());
  const invalid = columnMap.filter(
    m => m && m.target != null && m.target !== '' && !validTargets.has(m.target)
  );
  if (invalid.length > 0) {
    return res.status(400).json({
      error: 'Invalid target field(s) in columnMap.',
      details: invalid.map(m => m.target)
    });
  }

  const mapping = {
    columnMap,
    valueMaps: valueMaps || {},
    confirmedAt: new Date().toISOString()
  };

  const updated = store.updateOnboardingState(req.params.id, { mapping });
  res.json(updated);
});

module.exports = router;
