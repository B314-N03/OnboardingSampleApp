import React, { useState } from 'react';

/**
 * Slice 2 - Import tab.
 *
 * Lets CS upload a customer's clients.csv (or pick one of the three bundled
 * sample customers), then calls POST /api/customers/:id/import/preview and shows
 * the detected schema style + date format plus a preview table of the first rows.
 * No persistence yet - this tab is about proving the tool understands the file.
 */

const SAMPLES = [
  { key: 'A', label: 'Customer A - ABC Accounting (Title Case, MM/DD/YYYY)' },
  { key: 'B', label: 'Customer B - XYZ Financial (camelCase, YYYY-MM-DD)' },
  { key: 'C', label: 'Customer C - Premier Bookkeeping (snake_case, DD-MM-YYYY)' }
];

function Import({ data = [] }) {
  const [customerId, setCustomerId] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const targetId = customerId || (data[0] && data[0].customerId) || 'preview';

  async function requestPreview(body) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${targetId}/import/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || `HTTP ${res.status}`);
      setPreview(payload);
    } catch (err) {
      setError(err.message);
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }

  function handleSample(key) {
    setFileName('');
    requestPreview({ sample: key });
  }

  function handleFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => requestPreview({ csv: String(reader.result) });
    reader.onerror = () => setError('Could not read the selected file.');
    reader.readAsText(file);
  }

  return (
    <div>
      <h2>Import</h2>
      <p style={{ color: '#6b7280', marginBottom: 20 }}>
        Upload a customer's <code>clients.csv</code> or pick a bundled sample. The tool
        auto-detects the schema style and date format, then previews the parsed rows.
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
          <button key={s.key} className="tab" onClick={() => handleSample(s.key)}>
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
        </div>
      )}
    </div>
  );
}

export default Import;
