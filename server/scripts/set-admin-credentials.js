/**
 * Set the admin account's email AND password in one go.
 *
 * Run this yourself so neither value is ever typed into a chat transcript:
 *     cd server
 *     $env:ADMIN_EMAIL    = "JomuMartAdmin@gmail.com"
 *     $env:ADMIN_PASSWORD = "<your password>"   # set it, then clear it below
 *     node scripts/set-admin-credentials.js
 *     Remove-Item Env:ADMIN_PASSWORD
 *
 * The script never prints the password — only its length.
 *
 * WHY THIS EXISTS INSTEAD OF JUST USING set-admin-email.js + set-admin-password.js:
 * the login endpoint looks accounts up with an exact, case-sensitive
 * `findUnique({ where: { email } })`, and it does NOT lowercase the input. So if
 * the stored address is "jomumartadmin@gmail.com" and you type
 * "JomuMartAdmin@gmail.com", the lookup misses and you get a 401
 * "Invalid email or password" that looks like a wrong password.
 * Setting both fields here stores the email EXACTLY as you type it, so what you
 * type at the login form is what matches.
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

  if (!email) fail('ADMIN_EMAIL is not set (e.g. ADMIN_EMAIL="JomuMartAdmin@gmail.com")');
  if (!password) fail('ADMIN_PASSWORD is not set. Set it in this terminal, do not paste it into chat.');

  // Trim only. Deliberately NOT lowercasing - see the note above: the login
  // lookup is case-sensitive, so the stored value must be what gets typed.
  const trimmedEmail = email.trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    fail(`"${email}" does not look like a valid email address.`);
  }
  if (password.length < 12) fail('Use at least 12 characters.');
  if (password === trimmedEmail) fail('Password must not be the email address.');
  if (/^(password|admin|admin123|jomumart|naijamart|letmein|qwerty)/i.test(password)) {
    fail('That password is too guessable. Pick something unique.');
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    fail('Mix letters and numbers.');
  }

  // Identify the account by ROLE, not by email. Looking it up by the email we
  // are about to change would fail whenever the stored address differs in case
  // from what was typed - which is the exact situation that caused the 401.
  const admins = await prisma.user.findMany({
    where: { role: 'admin' },
    select: { id: true, email: true },
  });
  if (admins.length !== 1) {
    fail(`expected exactly 1 admin account, found ${admins.length}. Refusing to guess.`);
  }
  const admin = admins[0];

  // email is @unique: a collision is a real risk, and a silent failure would be
  // indistinguishable from the database being broken.
  const clash = await prisma.user.findUnique({
    where: { email: trimmedEmail },
    select: { id: true },
  });
  if (clash && clash.id !== admin.id) {
    fail(`"${trimmedEmail}" already belongs to another account. Pick a different address.`);
  }

  // Single update so email and password can never end up half-applied.
  await prisma.user.update({
    where: { id: admin.id },
    data: {
      email: trimmedEmail,
      password: await bcrypt.hash(password, 10),
    },
  });

  console.log(`OK: admin email ${admin.email} -> ${trimmedEmail}`);
  console.log(`OK: password updated (${password.length} characters, hashed with bcrypt).`);
  console.log(`Log in with EXACTLY: ${trimmedEmail}`);
  console.log('Then: Remove-Item Env:ADMIN_PASSWORD');
})()
  .catch((error) => fail(error?.message ?? String(error)))
  .finally(() => prisma.$disconnect());