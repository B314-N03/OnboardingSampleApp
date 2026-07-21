/**
 * Tenant routes (Slice 4 - Tenant Setup)
 * Lets CS pick a plan and provision a customer's tenant.
 */

const express = require('express');
const store = require('../data/store');

const VALID_PLANS = ['starter', 'professional', 'enterprise'];
const VALID_STATUSES = ['pending', 'provisioning', 'active', 'failed'];

/**
 * Validates a tenant update body and builds the set of allowed updates.
 * Pure helper so it can be unit tested without Express.
 * @param {Object} body - request body, may contain `plan` and/or `status`
 * @returns {{ valid: boolean, errors: string[], updates: Object }}
 */
function validateTenantUpdate(body) {
  const errors = [];
  const updates = {};

  if (body == null || typeof body !== 'object') {
    return { valid: false, errors: ['Request body must be an object'], updates };
  }

  const { plan, status } = body;

  if (plan === undefined && status === undefined) {
    errors.push('Provide at least one of: plan, status');
  }

  if (plan !== undefined) {
    if (!VALID_PLANS.includes(plan)) {
      errors.push(`Invalid plan '${plan}'. Allowed: ${VALID_PLANS.join(', ')}`);
    } else {
      updates.plan = plan;
    }
  }

  if (status !== undefined) {
    if (!VALID_STATUSES.includes(status)) {
      errors.push(`Invalid status '${status}'. Allowed: ${VALID_STATUSES.join(', ')}`);
    } else {
      updates.status = status;
    }
  }

  return { valid: errors.length === 0, errors, updates };
}

const router = express.Router();

// Update a customer's tenant (plan and/or status)
router.put('/:customerId', (req, res) => {
  const existing = store.getTenantByCustomerId(req.params.customerId);
  if (!existing) {
    return res.status(404).json({ error: 'Tenant not found' });
  }

  const { valid, errors, updates } = validateTenantUpdate(req.body);
  if (!valid) {
    return res.status(400).json({ error: 'Invalid tenant update', details: errors });
  }

  const updated = store.updateTenantByCustomerId(req.params.customerId, updates);
  res.json(updated);
});

module.exports = router;
module.exports.validateTenantUpdate = validateTenantUpdate;
module.exports.VALID_PLANS = VALID_PLANS;
module.exports.VALID_STATUSES = VALID_STATUSES;
