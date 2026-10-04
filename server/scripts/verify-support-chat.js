/**
 * End-to-end verification of the support chat, replaying exactly what the
 * browser does: register a throwaway customer, then connect to Stream as that
 * user with a USER token (not the server secret) and watch the support channel.
 *
 * This is the step that used to fail with Stream error 17. Running it here
 * proves the fix without needing a browser.
 *
 * Leaves one throwaway database row behind - clear it with:
 *     node scripts/cleanup-chat-verify-users.js
 *
 * Usage:  node scripts/verify-support-chat.js
 */
require('dotenv').config();
const { StreamChat } = require('stream-chat');
const { streamUserId } = require('../dist/lib/stream');

const API = process.env.API_URL || 'http://localhost:5000/api';
const apiKey = process.env.STREAM_API_KEY;
const secret = process.env.STREAM_API_SECRET;

function randomEmail() {
  return `chat-verify-${Date.now().toString(36)}@example.com`;
}

async function api(path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

(async () => {
  // Server-side instance (holds the secret) for reading/deleting channels.
  const server = new StreamChat(apiKey, secret);

  // ---- 1. Register a throwaway customer through the real API. ----
  const email = randomEmail();
  const password = 'VerifyOnly12345!';
  const reg = await api('/auth/register', {
    name: 'Chat Verify',
    email,
    password,
  });
  if (reg.status !== 201) {
    throw new Error(`register failed (${reg.status}): ${JSON.stringify(reg.data)}`);
  }
  const { token, user } = reg.data;
  console.log(`registered ${email}`);
  console.log(`  user id: ${user.id}`);

  // ---- 2. Token endpoint, same call ChatContext.tsx makes. ----
  const tok = await api('/chat/token', null, token);
  if (tok.status !== 200) {
    throw new Error(`/chat/token failed (${tok.status}): ${JSON.stringify(tok.data)}`);
  }
  console.log(`  stream identity: ${tok.data.userId}`);

  // ---- 3. Support-agent endpoint: this is what creates/repairs membership. ----
  const agent = await api('/chat/support-agent', null, token);
  if (agent.status !== 200) {
    throw new Error(
      `/chat/support-agent failed (${agent.status}): ${JSON.stringify(agent.data)}`,
    );
  }
  console.log(`  agent: ${agent.data.agentName} (${agent.data.agentId})`);

  // ---- 4. Connect as the CUSTOMER with their user token, exactly like the browser. ----
  // Dedicated instance: StreamChat.getInstance() is a singleton keyed by API
  // key, so using it here would clobber the server-side instance's auth.
  const chatClient = new StreamChat(apiKey, undefined, {
    allowServerSideConnect: true,
  });
  await chatClient.connectUser(
    { id: tok.data.userId, name: tok.data.name },
    tok.data.token,
  );
  console.log('  connected as customer');

  const ch = chatClient.channel('messaging', `support-${user.id}`, {
    members: [streamUserId(user.id), agent.data.agentId],
  });

  try {
    await ch.watch();
    console.log('  PASS: watch() succeeded as a non-admin user');
  } catch (err) {
    console.error('  FAIL: watch() threw');
    console.error(`    code: ${err?.code}`);
    console.error(`    message: ${err?.message}`);
    await chatClient.disconnectUser();
    process.exit(1);
  }

  // ---- 5. Prove the agent is in the room and the customer can send. ----
  const state = await server.channel('messaging', `support-${user.id}`).query();
  const members = (state.members || []).map((m) => m.user_id);
  console.log(`  members: ${JSON.stringify(members)}`);
  console.log(
    `  PASS: customer is a member = ${members.includes(tok.data.userId)}`,
  );
  console.log(
    `  PASS: agent is a member = ${members.includes(agent.data.agentId)}`,
  );

  // ---- 6. Round-trip a message to prove the room is actually usable. ----
  await ch.sendMessage({ text: 'Verification ping' });
  const after = await server.channel('messaging', `support-${user.id}`).query();
  const last = (after.messages || []).slice(-1)[0];
  console.log(`  PASS: message round-trip = ${JSON.stringify(last?.text)}`);

  // Clean up the throwaway channel so repeated runs stay tidy.
  await chatClient.disconnectUser();
  await server.channel('messaging', `support-${user.id}`).delete();
  console.log('\nALL CHECKS PASSED (throwaway channel removed)');
  console.log(
    'Run `node scripts/cleanup-chat-verify-users.js` to remove the test account.',
  );
  process.exit(0);
})().catch((err) => {
  console.error('FAILED', err?.message || err);
  process.exit(1);
});
