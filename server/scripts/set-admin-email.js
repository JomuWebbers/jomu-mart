/**
 * Change the admin account's email address.
 *
 * Run this yourself so the new address is never typed into a chat transcript:
 *     cd server
 *     $env:ADMIN_NEW_EMAIL = "JomuMartAdmin@gmail.com"
 *     node scripts/set-admin-email.js
 *     Remove-Item Env:ADMIN_NEW_EMAIL
 *
 * Only the email changes. The password hash, display name, role, balances,
 * listings and orders are all left exactly as they are — there is no
 * re-hashing step here by design, so an existing session JWT and the current
 * password both keep working.
 *
 * Note: `set-admin-password.js` looks an account up BY email, so change the
 * email first, then set the password using the new address.
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

(async () => {
  const newEmail = process.env.ADMIN_NEW_EMAIL;

  if (!newEmail) fail('ADMIN_NEW_EMAIL is not set (e.g. ADMIN_NEW_EMAIL="JomuMartAdmin@gmail.com")');

  // Shape check only. Gmail lowercases local parts in practice, and an email
  // is case-insensitive, but normalising here keeps the stored value tidy and
  // avoids a confusing mismatch against what the login form sends.
  const email = newEmail.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail(`"${newEmail}" does not look like a valid email address.`);
  }

  // Identify by role rather than by a hardcoded address, so this keeps working
  // after the email has already been changed once.
  const admins = await prisma.user.findMany({
    where: { role: 'admin' },
    select: { id: true, email: true, name: true },
  });
  if (admins.length !== 1) {
    fail(`expected exactly 1 admin account, found ${admins.length}. Refusing to guess.`);
  }

  const admin = admins[0];

  if (admin.email === email) {
    console.log(`OK: email already "${email}". Nothing to do.`);
    return;
  }

  // email is @unique, so a collision is a real risk rather than a theoretical
  // one — and silently failing on it would look like a broken database.
  const clash = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (clash) {
    fail(`"${email}" already belongs to another account (role=${clash.role}). Pick a different address.`);
  }

  await prisma.user.update({
    where: { id: admin.id },
    // Deliberately not touching `password`: no hash, no re-encryption. This
    // is the whole point of the script.
    data: { email },
  });

  console.log(`OK: admin email ${admin.email} -> ${email}`);
  console.log('Password, display name, role and all order/listing data unchanged.');
  console.log(`Next: log in with ${email} and the SAME password as before.`);
})()
  .catch((error) => fail(error?.message ?? String(error)))
  .finally(() => prisma.$disconnect());