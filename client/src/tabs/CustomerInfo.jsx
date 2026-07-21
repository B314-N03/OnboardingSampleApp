import React, { useState } from 'react';
import { apiUrl } from '../api';

const EMPTY_FORM = { name: '', contactEmail: '', industry: '', region: '' };

function CustomerInfo({ data, loadDashboard }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState(null);
  const [busyCustomerId, setBusyCustomerId] = useState(null);

  const updateField = (field) => (e) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
  };

  const errorFor = (field) => errors.find(err => err.field === field)?.message;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setBanner(null);
    setErrors([]);

    try {
      const res = await fetch(apiUrl('/api/customers'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const body = await res.json();

      if (!res.ok) {
        setErrors(Array.isArray(body.details) ? body.details : []);
        setBanner({ type: 'error', text: body.error || 'Could not create customer' });
        return;
      }

      setForm(EMPTY_FORM);
      setBanner({ type: 'success', text: `Added ${body.name} to the queue` });
      await loadDashboard();
    } catch (err) {
      setBanner({ type: 'error', text: `Request failed: ${err.message}` });
    } finally {
      setSubmitting(false);
    }
  };

  const markComplete = async (customerId) => {
    setBusyCustomerId(customerId);
    setBanner(null);
    try {
      const res = await fetch(apiUrl(`/api/customers/${customerId}/steps/step_1`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setBanner({ type: 'error', text: body.error || 'Could not update step' });
        return;
      }
      await loadDashboard();
    } catch (err) {
      setBanner({ type: 'error', text: `Request failed: ${err.message}` });
    } finally {
      setBusyCustomerId(null);
    }
  };

  return (
    <div>
      <h2>Customer Info</h2>
      <p style={{ color: '#6b7280', marginBottom: '20px' }}>
        Add a customer to the onboarding queue and mark their Customer Info step complete.
      </p>

      {banner && (
        <div
          className={`banner ${banner.type}`}
          style={{
            padding: '10px 14px',
            borderRadius: '6px',
            marginBottom: '16px',
            background: banner.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: banner.type === 'success' ? '#166534' : '#991b1b'
          }}
        >
          {banner.text}
        </div>
      )}

      <form className="customer-form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="name">Name *</label>
          <input
            id="name"
            type="text"
            value={form.name}
            onChange={updateField('name')}
            aria-invalid={Boolean(errorFor('name'))}
          />
          {errorFor('name') && <span className="field-error" style={{ color: '#dc2626', fontSize: '0.85rem' }}>{errorFor('name')}</span>}
        </div>

        <div className="form-field">
          <label htmlFor="contactEmail">Contact email *</label>
          <input
            id="contactEmail"
            type="email"
            value={form.contactEmail}
            onChange={updateField('contactEmail')}
            aria-invalid={Boolean(errorFor('contactEmail'))}
          />
          {errorFor('contactEmail') && <span className="field-error" style={{ color: '#dc2626', fontSize: '0.85rem' }}>{errorFor('contactEmail')}</span>}
        </div>

        <div className="form-field">
          <label htmlFor="industry">Industry</label>
          <input id="industry" type="text" value={form.industry} onChange={updateField('industry')} />
        </div>

        <div className="form-field">
          <label htmlFor="region">Region</label>
          <input id="region" type="text" value={form.region} onChange={updateField('region')} />
        </div>

        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Adding…' : 'Add customer'}
        </button>
      </form>

      <h3 style={{ marginTop: '32px' }}>Queue</h3>
      {data.length === 0 ? (
        <p style={{ color: '#6b7280' }}>No customers yet.</p>
      ) : (
        data.map(item => {
          const step1 = item.steps.find(s => s.id === 'step_1');
          const done = step1?.status === 'completed';
          return (
            <div key={item.customerId} className="customer-card">
              <h3>{item.customerName}</h3>
              <div className="customer-meta">
                <span>Region: {item.customerRegion || '-'}</span>
                <span>Industry: {item.customerIndustry || '-'}</span>
                <span>Progress: {item.progressPercent}%</span>
              </div>
              <button
                type="button"
                className="btn-secondary"
                disabled={done || busyCustomerId === item.customerId}
                onClick={() => markComplete(item.customerId)}
                style={{ marginTop: '10px' }}
              >
                {done
                  ? 'Customer Info complete'
                  : busyCustomerId === item.customerId
                    ? 'Saving…'
                    : 'Mark Customer Info complete'}
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}

export default CustomerInfo;
