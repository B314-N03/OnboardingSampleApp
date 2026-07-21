/**
 * Integration-test helper: start the Express app on an ephemeral port and hand
 * back a base URL plus small fetch helpers. Named `testServer.js` (it does not
 * end in `.test.js`) so the test-file glob does not run it as a test.
 *
 * `node --test` executes each test file in its own process, so every
 * integration file gets a fresh in-memory store (seeded with Acme / cust_001).
 */

const app = require('./index');

function startTestServer() {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      const baseUrl = `http://127.0.0.1:${port}`;

      const request = async (method, path, body) => {
        const res = await fetch(`${baseUrl}${path}`, {
          method,
          headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body)
        });
        let json = null;
        try {
          json = await res.json();
        } catch {
          json = null;
        }
        return { status: res.status, body: json };
      };

      resolve({
        baseUrl,
        request,
        get: (path) => request('GET', path),
        post: (path, body) => request('POST', path, body),
        put: (path, body) => request('PUT', path, body),
        close: () => new Promise((r) => server.close(r))
      });
    });
  });
}

module.exports = { startTestServer };
