const express = require('express');
const fs = require('fs');
const path = require('path');
const { detect } = require('../lib/detect');

const router = express.Router();

// The three bundled sample customers. The `sample` key in the request body maps
// to one of these; we read that customer's clients.csv from sample-data/.
const SAMPLE_DIRS = {
  A: 'CustomerA_ABCAccounting',
  B: 'CustomerB_XYZFinancialServices',
  C: 'CustomerC_PremierBookkeeping'
};

const SAMPLE_ROOT = path.join(__dirname, '..', '..', '..', 'sample-data');

// Cap how many rows we send back for the preview table. Detection still runs
// over the full parsed data; only the response payload is trimmed.
const PREVIEW_ROW_LIMIT = 10;

function loadSampleCsv(sampleKey) {
  const dir = SAMPLE_DIRS[sampleKey];
  if (!dir) return null;
  const file = path.join(SAMPLE_ROOT, dir, 'clients.csv');
  return fs.readFileSync(file, 'utf8');
}

/**
 * POST /api/customers/:id/import/preview
 *
 * Body (one of):
 *   { csv: "<raw csv text>" }          - upload the customer's own CSV
 *   { sample: "A" | "B" | "C" }        - use a bundled sample customer's clients.csv
 *
 * Response 200:
 *   {
 *     schemaStyle: "Title Case" | "camelCase" | "snake_case" | "unknown",
 *     dateFormat:  "MM/DD/YYYY" | "YYYY-MM-DD" | "DD-MM-YYYY" | ... | "unknown",
 *     columns: string[],   // original header strings, in file order.
 *                          //   >>> This is the contract Slice 3 (Data Mapping) consumes:
 *                          //   an array of the customer's raw header names, e.g.
 *                          //   ["clientCode","companyName", ...], for column->target mapping.
 *     rows:    Object[],   // up to 10 rows, each keyed by the original header string.
 *     rowCount: number     // total parsed rows (may exceed rows.length)
 *   }
 *
 * No persistence: this endpoint only parses + detects and returns the preview.
 */
router.post('/api/customers/:id/import/preview', (req, res) => {
  const { csv, sample } = req.body || {};

  let csvText;
  if (typeof csv === 'string' && csv.trim().length > 0) {
    csvText = csv;
  } else if (sample) {
    csvText = loadSampleCsv(String(sample).toUpperCase());
    if (csvText == null) {
      return res.status(400).json({
        error: `Unknown sample "${sample}". Valid samples: ${Object.keys(SAMPLE_DIRS).join(', ')}`
      });
    }
  } else {
    return res.status(400).json({
      error: 'Provide either a "csv" string or a "sample" key ("A", "B", or "C").'
    });
  }

  const { schemaStyle, dateFormat, columns, rows } = detect(csvText);

  if (columns.length === 0) {
    return res.status(400).json({ error: 'Could not parse any columns from the CSV.' });
  }

  return res.json({
    schemaStyle,
    dateFormat,
    columns,
    rows: rows.slice(0, PREVIEW_ROW_LIMIT),
    rowCount: rows.length
  });
});

module.exports = router;
