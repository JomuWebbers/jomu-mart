/**
 * Rename the admin account's display name.
 *
 * The admin name is what sellers and buyers see in the support chat and on
 * admin-generated order messages, so "Test User" is not a suitable label for
 * a live account. Only the display name changes; the email and password are
 * untouched.
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const NEW_NAME = process.env.ADMIN_NAME || 'Jomu Mart Support';

(async () => {
  const admins = await prisma.user.findMany({
    where: { role: 'admin' },
    select: { id: true, email: true, name: true },
  });
  if (admins.length !== 1) {
    console.error(`ERROR: expected exactly 1 admin account, found ${admins.length}. Refusing to guess.`);
    process.exit(1);
  }

  const admin = admins[0];
  if (admin.name === NEW_NAME) {
    console.log(`OK: name already "${NEW_NAME}". Nothing to do.`);
    return;
  }

  await prisma.user.update({ where: { id: admin.id }, data: { name: NEW_NAME } });
  console.log(`OK: ${admin.email} renamed "${admin.name}" -> "${NEW_NAME}"`);
  console.log('Email and password unchanged.');
})()
  .catch((error) => {
    console.error('ERROR:', error?.message ?? String(error));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());