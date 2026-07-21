const express = require('express');
const store = require('../data/store');
const {
  createCustomer,
  createTenant,
  createDefaultOnboardingSteps,
  calculateProgress
} = require('../models');
const { validateCustomerInput, isValidStepStatus, STEP_STATUSES } = require('../lib/validateCustomer');

const router = express.Router();

/**
 * POST /api/customers
 * Validate + create a customer, and seed their onboarding state (4 default
 * steps) plus a pending tenant.
 */
router.post('/customers', (req, res) => {
  const { valid, details, value } = validateCustomerInput(req.body);

  if (!valid) {
    return res.status(400).json({ error: 'Invalid customer input', details });
  }

  const id = `cust_${Date.now()}`;
  const createdAt = new Date().toISOString();

  const customer = createCustomer({
    id,
    name: value.name,
    industry: value.industry,
    region: value.region,
    contactEmail: value.contactEmail,
    createdAt
  });

  const tenant = createTenant({
    id: `tenant_${Date.now()}`,
    customerId: id,
    status: 'pending',
    plan: 'starter',
    createdAt
  });

  const steps = createDefaultOnboardingSteps();
  const onboardingState = {
    customerId: id,
    steps,
    progressPercent: calculateProgress(steps)
  };

  store.addCustomer(customer);
  store.addTenant(tenant);
  store.addOnboardingState(onboardingState);

  res.status(201).json(customer);
});

/**
 * PUT /api/customers/:id/steps/:stepId
 * Shared primitive: set a single onboarding step's status, recalculate
 * progressPercent, and return the updated onboarding state.
 * Other slices reuse this to advance their own step.
 */
router.put('/customers/:id/steps/:stepId', (req, res) => {
  const { id, stepId } = req.params;
  const { status } = req.body || {};

  if (!isValidStepStatus(status)) {
    return res.status(400).json({
      error: 'Invalid step status',
      details: [{ field: 'status', message: `status must be one of: ${STEP_STATUSES.join(', ')}` }]
    });
  }

  const state = store.getOnboardingState(id);
  if (!state) {
    return res.status(404).json({ error: 'Onboarding state not found' });
  }

  const step = state.steps.find(s => s.id === stepId);
  if (!step) {
    return res.status(404).json({ error: 'Step not found' });
  }

  const updatedSteps = state.steps.map(s =>
    s.id === stepId ? { ...s, status } : s
  );

  const updated = store.updateOnboardingState(id, {
    steps: updatedSteps,
    progressPercent: calculateProgress(updatedSteps)
  });

  res.json(updated);
});

module.exports = router;
