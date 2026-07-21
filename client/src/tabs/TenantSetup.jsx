import React, { useState, useEffect, useCallback } from 'react';

const PLANS = ['starter', 'professional', 'enterprise'];

// Small delay so CS visibly sees pending -> provisioning -> active.
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function TenantSetup() {
  const [customers, setCustomers] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [tenant, setTenant] = useState(null);
  const [plan, setPlan] = useState('starter');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const loadCustomers = useCallback(async () => {
    const res = await fetch('/api/onboarding');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setCustomers(Array.isArray(data) ? data : []);
    return data;
  }, []);

  const loadTenant = useCallback(async (customerId) => {
    if (!customerId) {
      setTenant(null);
      return;
    }
    const res = await fetch(`/api/tenants/${customerId}`);
    if (res.status === 404) {
      setTenant(null);
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setTenant(data);
    setPlan(data.plan || 'starter');
  }, []);

  useEffect(() => {
    loadCustomers()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setSelectedId(data[0].customerId);
        }
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [loadCustomers]);

  useEffect(() => {
    if (!selectedId) return;
    setMessage(null);
    loadTenant(selectedId).catch((err) => setError(err.message));
  }, [selectedId, loadTenant]);

  const updateTenant = async (updates) => {
    const res = await fetch(`/api/tenants/${selectedId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return res.json();
  };

  const provision = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      // pending -> provisioning (also persist the chosen plan)
      setTenant(await updateTenant({ plan, status: 'provisioning' }));
      await wait(800);
      // provisioning -> active
      setTenant(await updateTenant({ status: 'active' }));

      // Mark step_3 (Tenant Setup) complete via Slice 1's shared step endpoint.
      const stepRes = await fetch(`/api/customers/${selectedId}/steps/step_3`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' })
      });
      if (stepRes.ok) {
        setMessage('Tenant provisioned and Tenant Setup marked complete.');
      } else {
        // Slice 1's endpoint may not be merged yet; tenant still provisioned.
        setMessage('Tenant provisioned. Step could not be advanced (step endpoint unavailable).');
      }
      await loadCustomers();
    } catch (err) {
      setError(err.message);
      // Refresh to show whatever the real tenant state is.
      loadTenant(selectedId).catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="placeholder"><p>Loading...</p></div>;
  }

  const selectedCustomer = customers.find((c) => c.customerId === selectedId);
  const step3 = selectedCustomer?.steps?.find((s) => s.id === 'step_3');
  const isActive = tenant?.status === 'active';

  return (
    <div>
      <h2>Tenant Setup</h2>
      <p style={{ color: '#6b7280', marginBottom: '20px' }}>
        Pick a plan and provision the customer's tenant.
      </p>

      {customers.length === 0 ? (
        <div className="placeholder"><p>No customers in the onboarding queue</p></div>
      ) : (
        <>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>
              Customer
            </label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              style={{ padding: '8px', minWidth: '260px', fontSize: '1rem' }}
            >
              {customers.map((c) => (
                <option key={c.customerId} value={c.customerId}>
                  {c.customerName} ({c.progressPercent}%)
                </option>
              ))}
            </select>
          </div>

          {tenant ? (
            <div className="customer-card">
              <h3>{selectedCustomer?.customerName}</h3>
              <div className="customer-meta" style={{ marginBottom: '16px' }}>
                <span>Tenant: {tenant.id}</span>
                <span>
                  Status:{' '}
                  <span className={`step-status ${tenant.status === 'active' ? 'completed' : 'in_progress'}`}
                        style={{ display: 'inline-flex', width: 'auto', padding: '2px 10px', borderRadius: '9999px' }}>
                    {tenant.status}
                  </span>
                </span>
                {step3 && <span>Step 3: {step3.status.replace('_', ' ')}</span>}
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontWeight: 500 }}>
                  Plan
                </label>
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  disabled={busy}
                  style={{ padding: '8px', minWidth: '200px', fontSize: '1rem' }}
                >
                  {PLANS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <button
                className="tab"
                onClick={provision}
                disabled={busy}
                style={{
                  background: isActive ? '#10b981' : '#2563eb',
                  color: 'white',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: busy ? 'default' : 'pointer',
                  opacity: busy ? 0.7 : 1
                }}
              >
                {busy ? 'Provisioning...' : isActive ? 'Re-provision' : 'Provision tenant'}
              </button>

              {message && (
                <p style={{ marginTop: '16px', color: '#10b981' }}>{message}</p>
              )}
            </div>
          ) : (
            <div className="placeholder"><p>No tenant found for this customer</p></div>
          )}
        </>
      )}

      {error && (
        <p style={{ marginTop: '16px', color: '#dc2626' }}>Error: {error}</p>
      )}
    </div>
  );
}

export default TenantSetup;
