/**
 * Set the admin account password.
 *
 * Run this yourself so the password is never typed into a chat transcript:
 *     cd server
 *     $env:ADMIN_EMAIL  = "NaijaMartAdmin@gmail.com"
 *     $env:ADMIN_PASSWORD = "<your password>"   # set it, then clear it below
 *     node scripts/set-admin-password.js
 *     Remove-Item Env:ADMIN_PASSWORD
 *
 * The script only prints success or the reason it refused, never the password.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

(async () => {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email) fail('ADMIN_EMAIL is not set (e.g. ADMIN_EMAIL="NaijaMartAdmin@gmail.com")');
  if (!password) fail('ADMIN_PASSWORD is not set. Set it in this terminal, do not paste it into chat.');

  if (password.length < 12) fail('Use at least 12 characters.');
  if (password === email) fail('Password must not be the email address.');
  if (/^(password|admin|admin123|naijamart|letmein|qwerty)/i.test(password)) {
    fail('That password is too guessable. Pick something unique.');
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    fail('Mix letters and numbers.');
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) fail(`No account found for ${email}`);
  if (user.role !== 'admin') fail(`${email} is not an admin (role=${user.role}). Refusing to change it.`);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: await bcrypt.hash(password, 10) },
  });

  console.log(`OK: password updated for ${email} (${password.length} characters, hashed with bcrypt).`);
  console.log('Next: log in at /admin to confirm, then clear the env var.');
})()
  .catch((error) => fail(error?.message ?? String(error)))
  .finally(() => prisma.$disconnect());