/**
 * One-off cleanup for the Naija Mart -> Jomu Mart rename in Stream Chat.
 *
 * The rename changed the Stream identity prefix from `naijamart_` to
 * `jomumart_`, but channels created beforehand still list the old identities.
 * Those are the SAME two people, so each support room ended up with 4 members
 * instead of 2, which caused three visible problems:
 *
 *   1. The header avatar stack drew 4 overlapping circles instead of 2.
 *   2. AdminSupportInbox labels a conversation with the first member that is
 *      not the admin, which resolved to the legacy `naijamart_<adminId>` user
 *      and so rendered every thread as "Support . Naija Mart Support".
 *   3. Messages authored by a legacy identity are not recognised as "mine" by
 *      either side, so history rendered left-aligned for both.
 *
 * This script:
 *   - removes the legacy `naijamart_*` members from each user's support
 *     channel (message history is preserved; only membership changes), and
 *   - renames the legacy Stream user objects so any message still authored by
 *     them displays the new brand instead of the old one.
 *
 * It walks the DATABASE and derives `support-<userId>` for every user, rather
 * than listing channels with queryChannels(). That listing is not a reliable
 * inventory here: called without a user context it returned only the 10
 * orphaned pre-rename rooms and missed every current user's room entirely, so a
 * scan built on it silently leaves the live conversations untouched. The
 * database is the authoritative list of which channels the app actually opens.
 *
 * Run it once after deploying the server change. It is safe to re-run.
 *
 * Usage:  node scripts/migrate-legacy-stream-identities.js
 */
require('dotenv').config();
const { StreamChat } = require('stream-chat');
const prisma = require('../dist/lib/prisma').default;

const LEGACY_PREFIX = 'naijamart_';

// Neon suspends its compute when idle, so the first query on a cold project can
// exceed Prisma's 10s pool-acquire timeout. Retry before giving up.
async function fetchUsers() {
  let lastErr;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await prisma.user.findMany({
        select: { id: true, name: true, role: true },
      });
    } catch (err) {
      lastErr = err;
      console.log(`  (database not ready, retry ${attempt}/4)`);
      await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
  }
  throw lastErr;
}

(async () => {
  const server = new StreamChat(
    process.env.STREAM_API_KEY,
    process.env.STREAM_API_SECRET,
    // One channel.query() round-trip per conversation adds up; the SDK default
    // of 3s aborts part-way through.
    { timeout: 60000 },
  );

  const users = await fetchUsers();
  const admin = users.find((u) => u.role === 'admin');
  if (!admin) throw new Error('No admin user found');

  // ---- Walk the database: every user has exactly one support channel. ----
  const legacyIds = new Set();
  let cleaned = 0;
  let missing = 0;

  console.log(`Checking ${users.length} user support channel(s)...\n`);

  for (const user of users) {
    if (user.role === 'admin') continue;

    const channelId = `support-${user.id}`;
    let state;
    try {
      state = await server.channel('messaging', channelId).query();
    } catch {
      console.log(`  MISSING  ${channelId} (will be created on next sign-in)`);
      missing += 1;
      continue;
    }

    const memberIds = (state.members || []).map((m) => m.user_id);
    const legacy = memberIds.filter((id) => id.startsWith(LEGACY_PREFIX));
    for (const id of legacy) legacyIds.add(id);

    // Record every legacy author of the message history too, so those users
    // can be renamed even after they are no longer channel members.
    for (const message of state.messages || []) {
      const authorId = message.user_id || (message.user && message.user.id);
      if (typeof authorId === 'string' && authorId.startsWith(LEGACY_PREFIX)) {
        legacyIds.add(authorId);
      }
    }

    const expected = [`jomumart_${user.id}`, `jomumart_${admin.id}`];
    const absent = expected.filter((id) => !memberIds.includes(id));

    if (legacy.length === 0 && absent.length === 0) {
      console.log(`  OK       ${channelId} -> ${JSON.stringify(memberIds)}`);
      continue;
    }

    const channel = server.channel('messaging', channelId);
    if (absent.length > 0) await channel.addMembers(absent);
    if (legacy.length > 0) await channel.removeMembers(legacy);

    const after = await channel.query();
    console.log(`  FIXED    ${channelId}`);
    if (legacy.length) console.log(`           removed legacy : ${JSON.stringify(legacy)}`);
    if (absent.length) console.log(`           added current : ${JSON.stringify(absent)}`);
    console.log(
      `           members now   : ${JSON.stringify((after.members || []).map((m) => m.user_id))}`,
    );
    cleaned += 1;
  }

  // ---- Rename the legacy user objects to the current brand. ----
  // Historical messages keep their original author id, and Stream resolves the
  // author's display name from the user object, so renaming it is what removes
  // the last visible "Naija Mart" from past messages.
  console.log('\nRenaming legacy user objects...');
  let renamed = 0;
  for (const legacyId of legacyIds) {
    const dbUserId = legacyId.slice(LEGACY_PREFIX.length);
    const owner = users.find((u) => u.id === dbUserId);
    if (!owner) {
      console.log(`  SKIP     ${legacyId} (no matching database user)`);
      continue;
    }
    const newName =
      owner.role === 'admin' ? `Support · ${owner.name}` : owner.name;
    await server.upsertUsers([{ id: legacyId, name: newName }]);
    console.log(`  RENAMED  ${legacyId} -> "${newName}"`);
    renamed += 1;
  }

  console.log(
    `\nDone. ${cleaned} channel(s) fixed, ${renamed} legacy user object(s) renamed, ${missing} channel(s) not created yet.`,
  );

  await prisma.$disconnect();
  process.exit(0);
})().catch((err) => {
  console.error('FAILED', err?.message || err);
  process.exit(1);
});