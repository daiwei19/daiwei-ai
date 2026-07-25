const test = require('node:test');
const assert = require('node:assert/strict');

let server;
let port;

function loadServer() {
  delete require.cache[require.resolve('../server')];
  return require('../server');
}

test('GET /api/health returns service info', async () => {
  process.env.PORT = '0';
  const { startServer } = loadServer();
  server = await startServer();
  const address = server.address();
  port = address.port;

  const response = await fetch(`http://127.0.0.1:${port}/api/health`);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.message, '服务已启动');

  server.close();
});

test('POST /api/auth/register and login persist a user', async () => {
  process.env.PORT = '0';
  const { startServer } = loadServer();
  server = await startServer();
  const address = server.address();
  port = address.port;

  const uniqueName = `tester_${Date.now()}`;
  const registerResponse = await fetch(`http://127.0.0.1:${port}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: uniqueName, password: 'secret123' })
  });
  const registerPayload = await registerResponse.json();

  assert.equal(registerResponse.status, 200);
  assert.equal(registerPayload.success, true);

  const loginResponse = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: uniqueName, password: 'secret123' })
  });
  const loginPayload = await loginResponse.json();

  assert.equal(loginResponse.status, 200);
  assert.equal(loginPayload.success, true);
  assert.equal(loginPayload.user.username, uniqueName);

  server.close();
});
