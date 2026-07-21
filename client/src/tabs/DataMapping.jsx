import React, { useState, useEffect } from 'react';

// Target fields we can map source columns onto (mirrors server/src/lib/mapping.js).
const TARGET_FIELDS = [
  { field: 'id', label: 'Client ID' },
  { field: 'name', label: 'Name' },
  { field: 'entityType', label: 'Entity Type' },
  { field: 'status', label: 'Status' },
  { field: 'startDate', label: 'Start Date' },
  { field: 'taxId', label: 'Tax ID' },
  { field: 'revenue', label: 'Revenue' },
  { field: 'industry', label: 'Industry' },
  { field: 'terms', label: 'Payment Terms' },
  { field: 'primaryContact', label: 'Primary Contact' }
];

// Canonical picklist values CS can normalize source values to.
const CANONICAL = {
  status: [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'pending', label: 'Pending' }
  ],
  entityType: [
    { value: 'corporation', label: 'Corporation' },
    { value: 's_corporation', label: 'S-Corporation' },
    { value: 'llc', label: 'LLC' },
    { value: 'partnership', label: 'Partnership' },
    { value: 'sole_proprietor', label: 'Sole Proprietor' },
    { value: 'non_profit', label: 'Non-Profit' }
  ],
  transactionType: [
    { value: 'debit', label: 'Debit' },
    { value: 'credit', label: 'Credit' }
  ]
};

const PICKLIST_LABELS = {
  status: 'Status',
  entityType: 'Entity Type',
  transactionType: 'Transaction Type'
};

const SAMPLES = [
  { key: 'CustomerA_ABCAccounting', label: 'Customer A - ABC Accounting (Title Case)' },
  { key: 'CustomerB_XYZFinancialServices', label: 'Customer B - XYZ Financial Services (camelCase)' },
  { key: 'CustomerC_PremierBookkeeping', label: 'Customer C - Premier Bookkeeping (snake_case)' }
];

function DataMapping({ onboardingData }) {
  const [customers, setCustomers] = useState(onboardingData || []);
  const [customerId, setCustomerId] = useState('');
  const [sample, setSample] = useState(SAMPLES[0].key);
  const [columnMap, setColumnMap] = useState(null);
  const [valueMaps, setValueMaps] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // Keep our own customer list so the tab works without Slice 1's App refactor.
  const loadCustomers = () => {
    fetch('/api/onboarding')
      .then(res => (res.ok ? res.json() : []))
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setCustomers(list);
        setCustomerId(prev => prev || (list[0] && list[0].customerId) || '');
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (onboardingData && onboardingData.length > 0) {
      setCustomers(onboardingData);
      setCustomerId(prev => prev || onboardingData[0].customerId);
    } else {
      loadCustomers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const suggest = async () => {
    if (!customerId) {
      setError('Pick a customer first.');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/customers/${customerId}/mapping/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sample })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setColumnMap(data.columnMap);
      setValueMaps(data.valueMaps);
    } catch (err) {
      setError(err.message);
      setColumnMap(null);
      setValueMaps(null);
    } finally {
      setBusy(false);
    }
  };

  const setColumnTarget = (index, target) => {
    setColumnMap(prev => prev.map((c, i) => (i === index ? { ...c, target: target || null, confidence: 'manual' } : c)));
  };

  const setValueTarget = (picklist, index, target) => {
    setValueMaps(prev => ({
      ...prev,
      [picklist]: prev[picklist].map((v, i) => (i === index ? { ...v, target: target || null } : v))
    }));
  };

  const confirm = async () => {
    if (!columnMap) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      // 1. Persist the confirmed mapping.
      const res = await fetch(`/api/customers/${customerId}/mapping`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columnMap, valueMaps })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      // 2. Advance step_2 via Slice 1's shared step endpoint.
      const stepRes = await fetch(`/api/customers/${customerId}/steps/step_2`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' })
      });
      if (stepRes.ok) {
        setMessage('Mapping confirmed and Data Mapping step marked complete.');
      } else {
        setMessage('Mapping saved. Step could not be advanced (needs Slice 1 step endpoint).');
      }
      loadCustomers();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const confidenceBadge = (c) => {
    const colors = { high: '#059669', medium: '#d97706', manual: '#2722F8', none: '#dc2626' };
    return (
      <span style={{ fontSize: '0.7rem', color: colors[c] || '#9ca3af', textTransform: 'uppercase' }}>
        {c === 'none' ? 'unmapped' : c}
      </span>
    );
  };

  return (
    <div>
      <h2>Data Mapping</h2>
      <p style={{ color: '#6b7280', marginBottom: '16px' }}>
        Propose a mapping from the customer's columns to our target model, then confirm or override it.
      </p>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '16px' }}>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.85rem' }}>
          Customer
          <select value={customerId} onChange={e => setCustomerId(e.target.value)} style={{ padding: '6px', minWidth: '220px' }}>
            <option value="">Select a customer</option>
            {customers.map(c => (
              <option key={c.customerId} value={c.customerId}>{c.customerName || c.customerId}</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.85rem' }}>
          Sample columns
          <select value={sample} onChange={e => setSample(e.target.value)} style={{ padding: '6px', minWidth: '320px' }}>
            {SAMPLES.map(s => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </label>
        <button onClick={suggest} disabled={busy || !customerId} style={{ padding: '8px 16px' }}>
          {busy ? 'Working...' : 'Suggest mapping'}
        </button>
      </div>

      {error && <p style={{ color: '#dc2626' }}>⚠️ {error}</p>}
      {message && <p style={{ color: '#059669' }}>✓ {message}</p>}

      {columnMap && (
        <div style={{ marginTop: '12px' }}>
          <h3>Column mapping</h3>
          <table className="mapping-table">
            <thead>
              <tr><th>Source column</th><th>Target field</th><th>Confidence</th></tr>
            </thead>
            <tbody>
              {columnMap.map((c, i) => (
                <tr key={c.source + i}>
                  <td>{c.source}</td>
                  <td>
                    <select value={c.target || ''} onChange={e => setColumnTarget(i, e.target.value)}>
                      <option value="">(ignore)</option>
                      {TARGET_FIELDS.map(tf => (
                        <option key={tf.field} value={tf.field}>{tf.label}</option>
                      ))}
                    </select>
                  </td>
                  <td>{confidenceBadge(c.confidence)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {valueMaps && (
        <div style={{ marginTop: '20px' }}>
          <h3>Value mapping (picklists)</h3>
          {Object.keys(CANONICAL).map(pk => (
            <div key={pk} style={{ marginBottom: '16px' }}>
              <h4 style={{ margin: '8px 0' }}>{PICKLIST_LABELS[pk]}</h4>
              <table className="mapping-table">
                <thead>
                  <tr><th>Source value</th><th>Canonical value</th></tr>
                </thead>
                <tbody>
                  {(valueMaps[pk] || []).map((v, i) => (
                    <tr key={v.source + i}>
                      <td>{v.source}</td>
                      <td>
                        <select value={v.target || ''} onChange={e => setValueTarget(pk, i, e.target.value)}>
                          <option value="">(unmapped)</option>
                          {CANONICAL[pk].map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {columnMap && (
        <button onClick={confirm} disabled={busy} style={{ padding: '10px 20px', marginTop: '8px', background: '#FB581F', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Confirm mapping & complete step
        </button>
      )}
    </div>
  );
}

export default DataMapping;
