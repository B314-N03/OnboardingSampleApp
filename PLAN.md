# Onboarding Tool - Vertical Slice Plan

Goal: help the CS team clear the onboarding queue faster. We ship in thin vertical
slices, tab by tab. The tool must work after every slice, and every slice must make
CS demonstrably more useful than the last.

Each slice below is written to be handed to **one agent** working independently. A
slice states its value, scope, the files it owns, the API it adds, and the acceptance
criteria to demo it.

## Ground rules for every agent

- **The app must stay working.** Never leave the tool broken between slices.
- **Backend:** Express, in-memory store (`server/src/data/store.js`), no database.
- **Frontend:** React 18 + Vite, one file today (`client/src/App.jsx`), minimal CSS
  in `client/src/index.css`.
- **Verify before done:** `npm run test:unit`, start the app (`npm start`), exercise
  your tab in the browser at http://localhost:5173.
- **The 4 onboarding steps** (`step_1` Customer Info, `step_2` Data Mapping,
  `step_3` Tenant Setup, `step_4` Import) drive the dashboard progress bar. When your
  slice finishes its step, mark that step `completed` so progress visibly moves.

## Shared-file coordination (read this to avoid collisions)

Two files are touched by most slices. To keep parallel agents from conflicting:

- **`server/src/index.js`** - add your routes in your own clearly-commented block.
  Prefer factoring routes into `server/src/routes/<slice>.js` and mounting them, so
  two agents rarely edit the same lines.
- **`client/src/App.jsx`** - extract your tab into its own component file
  (`client/src/tabs/<TabName>.jsx`) and import it. `App.jsx` only wires the tab in.
  The `loadDashboard()` reload function and `onboardingData` are passed down as props.

Advance-a-step endpoint (below, from Slice 1) is the shared primitive every tab uses
to mark its step complete. Do not reinvent it.

---

## Slice 1 - Customer Info tab

**Value:** the queue reflects real waiting customers instead of one seed row, and the
progress bar finally moves off 0%.

**Scope**
- Add + validate a customer (name required, valid email; industry/region optional).
- Creating a customer also seeds their onboarding state (4 default steps) and a
  `pending` tenant.
- Customer Info tab: add-customer form with inline validation errors, and a
  "Mark Customer Info complete" control per queued customer that advances `step_1`.

**API added**
- `POST /api/customers` - validate + create customer, state, tenant. `400` with
  `{ error, details[] }` on invalid input; `201` with the customer on success.
- `PUT /api/customers/:id/steps/:stepId` - body `{ status }`; validates status,
  updates the step, recalculates `progressPercent`. (Shared primitive for all tabs.)

**Files**
- `server/src/index.js` (add routes + a `validateCustomerInput` helper)
- `client/src/App.jsx` (make the dashboard fetch a reusable `loadDashboard()` so tabs
  can trigger a refresh; build the Customer Info tab)

**Acceptance**
- Adding a valid customer shows them in the Dashboard queue at 0%.
- Invalid email / empty name shows a clear error and creates nothing.
- Completing Customer Info moves that customer's progress to 25%.

**Note:** this slice owns the shared `PUT .../steps/:stepId` step-advance endpoint that
Slices 3-5 reuse. Land it first, or have the Slice 1 agent go first in Wave A.

---

## Slice 2 - Import tab: upload + auto-detect + preview

**Value:** the customer's messy CSV is understood by the tool. This is the repo's core
hard problem (three customers, three schema styles, three date formats).

**Scope**
- Upload one customer CSV (start with `clients.csv`) or pick a sample from
  `sample-data/`.
- Auto-detect schema style (Title Case / camelCase / snake_case) and date format
  (MM/DD/YYYY, YYYY-MM-DD, DD-MM-YYYY).
- Show a preview table of parsed rows plus the detected style + date format.

**API added**
- `POST /api/customers/:id/import/preview` - accepts CSV text (or a sample-data key),
  returns `{ schemaStyle, dateFormat, columns[], rows[] }`. No persistence yet.
- Detection lives in a testable module: `server/src/lib/detect.js`.

**Files**
- `server/src/lib/detect.js` (+ `detect.test.js`)
- `server/src/routes/import.js` (mounted in `index.js`)
- `client/src/tabs/Import.jsx`

**Acceptance**
- Uploading each of the three sample customers' `clients.csv` reports the correct
  schema style and date format.
- Preview renders the first ~10 rows with original column headers.

**Depends on:** nothing hard (uses sample data). Can start in parallel with Slice 1.

---

## Slice 3 - Data Mapping tab

**Value:** the transformation from the customer's schema to our target model is
transparent and correctable by CS, not a black box.

**Scope**
- Given detected columns, propose a column → target-field map (e.g. `companyName` →
  `name`) and value maps for picklists (status, entity type, transaction type) per the
  tables in `sample-data/README.md`.
- Let CS confirm or override each mapping.
- On confirm, mark `step_2` (Data Mapping) complete.

**API added**
- `POST /api/customers/:id/mapping/suggest` - returns suggested column + value maps.
- `PUT /api/customers/:id/mapping` - persist the confirmed mapping on the customer's
  onboarding state, then advance `step_2`.
- Mapping rules in `server/src/lib/mapping.js` (+ tests).

**Files**
- `server/src/lib/mapping.js` (+ `mapping.test.js`)
- `server/src/routes/mapping.js`
- `client/src/tabs/DataMapping.jsx`

**Acceptance**
- Each sample customer's columns get a sensible suggested target field.
- Status values (`A`/`ACTIVE`/`Active`) normalize to one canonical value.
- Confirming the mapping moves progress and persists it for Slice 5 to use.

**Depends on:** Slice 2's detected columns (uses its output shape). Coordinate the
`columns[]` contract with the Slice 2 agent.

---

## Slice 4 - Tenant Setup tab

**Value:** provisioning becomes an actionable step instead of a static placeholder.

**Scope**
- Show the customer's tenant (plan, status). Let CS pick a plan
  (starter/professional/enterprise) and provision: `pending` → `provisioning` →
  `active`.
- On `active`, mark `step_3` (Tenant Setup) complete.

**API added**
- `PUT /api/tenants/:customerId` - update plan and/or status (validate against the
  allowed enums in `server/src/models/index.js`).
- Advancing `step_3` reuses the Slice 1 step endpoint.

**Files**
- `server/src/routes/tenants.js` (or a small block in `index.js`)
- `client/src/tabs/TenantSetup.jsx`

**Acceptance**
- Changing plan + provisioning flips tenant status to `active` and moves progress.
- Invalid plan/status returns `400`.

**Depends on:** Slice 1 (step endpoint, customer exists). Otherwise independent.

---

## Slice 5 - Import commit + Dashboard triage

**Value:** the loop closes - normalized records actually load, the customer reaches
100%, and CS can triage the whole queue at a glance.

**Scope**
- Apply the confirmed mapping (Slice 3) to the uploaded data (Slice 2), store the
  normalized records against the customer, mark `step_4` (Import) complete → 100%.
- Dashboard: per-customer "next action" hint (the first non-completed step) and a
  simple filter/sort (e.g. by progress, or hide completed).

**API added**
- `POST /api/customers/:id/import/commit` - transform rows via the saved mapping,
  store `importedRecords`, advance `step_4`.

**Files**
- `server/src/routes/import.js` (extend), `server/src/lib/transform.js` (+ tests)
- `client/src/tabs/Import.jsx` (extend), `client/src/tabs/Dashboard.jsx` (triage)

**Acceptance**
- After commit, a sample customer shows 100% and a stored normalized record count.
- Dashboard shows each customer's next action and can filter the queue.

**Depends on:** Slices 2 and 3 (needs uploaded data + confirmed mapping).

---

## Suggested parallelization

- **Wave A (parallel):** Slice 1 (Customer Info), Slice 2 (Import preview) - both are
  mostly independent; Slice 2 uses sample data, not created customers.
- **Wave B (parallel):** Slice 3 (Data Mapping, after Slice 2's column contract),
  Slice 4 (Tenant Setup, after Slice 1).
- **Wave C:** Slice 5 (needs 2 + 3).

Note: the tabs list Data Mapping before Import, but you cannot map data you have not
uploaded, so Import preview (Slice 2) is built before Data Mapping (Slice 3). Same
tabs, dependency-correct order.
