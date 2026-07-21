const fs = require('fs');
const path = require('path');

// The sample CSVs live at the repo root (`<repo>/sample-data`) during local dev.
// The backend deploy only ships the `server/` directory, so CI bundles a copy at
// `server/sample-data`. Resolve to whichever exists so both work.
const CANDIDATES = [
  path.join(__dirname, '..', '..', '..', 'sample-data'), // repo root (local dev)
  path.join(__dirname, '..', '..', 'sample-data')        // bundled with server/ (deploy)
];

function sampleRoot() {
  return CANDIDATES.find(p => fs.existsSync(p)) || CANDIDATES[0];
}

module.exports = { sampleRoot };
