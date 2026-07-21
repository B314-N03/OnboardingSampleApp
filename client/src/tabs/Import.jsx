import React, { useState } from 'react';
import { apiUrl } from '../api';

/**
 * Import tab (Slice 2 preview + Slice 5 commit).
 *
 * Lets CS upload a customer's clients.csv (or pick one of the three bundled
 * sample customers), previews the detected schema style + date format, then
 * commits: POST /api/customers/:id/import/commit normalizes the rows, stores
 * them on the customer, and marks step_4 (Import) complete.
 */

const SAMPLES = [
  { key: 'A', dir: 'CustomerA_ABCAccounting', label: 'Customer A - ABC Accounting (Title Case, MM/DD/YYYY)' },
  { key: 'B', dir: 'CustomerB_XYZFinancialServices', label: 'Customer B - XYZ Financial (camelCase, YYYY-MM-DD)' },
  { key: 'C', dir: 'CustomerC_PremierBookkeeping', label: 'Customer C - Premier Bookkeeping (snake_case, DD-MM-YYYY)' }
];

function Import({ data = [], loadDashboard }) {
  const [customerId, setCustomerId] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState(null);
  // The source to commit: { sampleKey } for a bundled sample, { csv } for an upload.
  const [commitSource, setCommitSource] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [committing, setCommitting] = useState(false);
  const [committed, setCommitted] = useState(null);
  const [commitError, setCommitError] = useState(null);

  const targetId = customerId || (data[0] && data[0].customerId) || 'preview';

  async function requestPreview(body, source) {
    setLoading(true);
    setError(null);
    setCommitted(null);
    setCommitError(null);
    try {
      const res = await fetch(apiUrl(`/api/customers/${targetId}/import/preview`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || `HTTP ${res.status}`);
      setPreview(payload);
      setCommitSource(source);
    } catch (err) {
      setError(err.message);
      setPreview(null);
      setCommitSource(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!commitSource) return;
    setCommitting(true);
    setCommitError(null);
    try {
      const res = await fetch(apiUrl(`/api/customers/${targetId}/import/commit`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commitSource)
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || `HTTP ${res.status}`);
      setCommitted(payload);
      if (loadDashboard) loadDashboard();
    } catch (err) {
      setCommitError(err.message);
    } finally {
      setCommitting(false);
    }
  }

  function handleSample(sample) {
    setFileName('');
    requestPreview({ sample: sample.key }, { sampleKey: sample.dir });
  }

  function handleFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const csv = String(reader.result);
      requestPreview({ csv }, { csv });
    };
    reader.onerror = () => setError('Could not read the selected file.');
    reader.readAsText(file);
  }

  return (
    <div>
      <h2>Import</h2>
      <p style={{ color: '#6b7280', marginBottom: 20 }}>
        Upload a customer's <code>clients.csv</code> or pick a bundled sample. The tool
        auto-detects the schema style and date format and previews the parsed rows, then
        imports the normalized records into the platform.
      </p>

      {data.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <label style={{ marginRight: 8 }}>Customer:</label>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">(first in queue)</option>
            {data.map((c) => (
              <option key={c.customerId} value={c.customerId}>
                {c.customerName}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {SAMPLES.map((s) => (
          <button key={s.key} className="tab" onClick={() => handleSample(s)}>
            {s.label}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={{ marginRight: 8 }}>Or upload a CSV:</label>
        <input type="file" accept=".csv,text/csv" onChange={handleFile} />
        {fileName && (
          <span style={{ marginLeft: 8, color: '#6b7280' }}>{fileName}</span>
        )}
      </div>

      {loading && <p>Detecting…</p>}
      {error && (
        <p style={{ color: '#dc2626' }}>⚠️ {error}</p>
      )}

      {preview && !loading && (
        <div>
          <div className="customer-meta" style={{ marginBottom: 12 }}>
            <span><strong>Schema style:</strong> {preview.schemaStyle}</span>
            <span><strong>Date format:</strong> {preview.dateFormat}</span>
            <span><strong>Columns:</strong> {preview.columns.length}</span>
            <span><strong>Rows:</strong> {preview.rowCount}</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="preview-table">
              <thead>
                <tr>
                  {preview.columns.map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr key={i}>
                    {preview.columns.map((col) => (
                      <td key={col}>{row[col]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginTop: 8 }}>
            Showing first {preview.rows.length} of {preview.rowCount} rows.
          </p>

          <div style={{ marginTop: 16 }}>
            <button
              className="btn-primary"
              onClick={handleImport}
              disabled={committing || !commitSource}
            >
              {committing ? 'Importing…' : `Import ${preview.rowCount} rows`}
            </button>
          </div>
        </div>
      )}

      {commitError && (
        <p style={{ color: '#dc2626', marginTop: 12 }}>⚠️ {commitError}</p>
      )}
      {committed && (
        <p style={{ color: '#059669', marginTop: 12 }}>
          ✓ Imported {committed.importedRecordCount} records. Onboarding progress is now{' '}
          {committed.progressPercent}%.
        </p>
      )}
    </div>
  );
}

export default Import;
