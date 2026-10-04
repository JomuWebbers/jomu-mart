/**
 * Removes the throwaway accounts created by verify-support-chat.js.
 *
 * verify-support-chat.js deletes its Stream channel but cannot delete the
 * database row, so every verification run leaves one "Chat Verify" user
 * behind. This clears them out.
 *
 * Usage:  node scripts/cleanup-chat-verify-users.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { StreamChat } = require('stream-chat');

const prisma = new PrismaClient();

(async () => {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: 'chat-verify-' } },
    select: { id: true, email: true },
  });
  console.log(`Found ${users.length} throwaway verification user(s).`);

  const server = new StreamChat(
    process.env.STREAM_API_KEY,
    process.env.STREAM_API_SECRET,
  );

  for (const u of users) {
    // Drop the Stream channel and user before the database row, otherwise the
    // orphaned channel lingers with a member that no longer exists.
    try {
      await server.channel('messaging', `support-${u.id}`).delete();
    } catch {
      /* channel may already be gone */
    }
    try {
      await server.deleteUser(`jomumart_${u.id}`);
    } catch {
      /* Stream user may already be gone */
    }
    console.log(`  removed ${u.email}`);
  }

  const { count } = await prisma.user.deleteMany({
    where: { email: { startsWith: 'chat-verify-' } },
  });
  console.log(`Deleted ${count} database row(s).`);
  console.log(`Users remaining: ${await prisma.user.count()}`);

  await prisma.$disconnect();
  process.exit(0);
})().catch((err) => {
  console.error('FAILED', err?.message || err);
  process.exit(1);
});