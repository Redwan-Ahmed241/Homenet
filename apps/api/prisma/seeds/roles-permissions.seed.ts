import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

async function main() {
  console.log('Seeding roles and permissions...');

  // ── Roles ────────────────────────────────────────────────

  const roles = [
    { id: 'role-buyer-001', name: 'buyer_seller' },
    { id: 'role-mod-001', name: 'moderator' },
    { id: 'role-admin-001', name: 'admin' },
    { id: 'role-superadmin-001', name: 'superadmin' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {},
      create: { id: role.id, name: role.name },
    });
    console.log(`  ✓ Role: ${role.name}`);
  }

  // ── Permissions ──────────────────────────────────────────

  const permissions = [
    { id: 'perm-001', name: 'view_roles' },
    { id: 'perm-002', name: 'manage_roles' },
    { id: 'perm-003', name: 'create_listing' },
    { id: 'perm-004', name: 'moderate_listing' },
    { id: 'perm-005', name: 'manage_users' },
    { id: 'perm-006', name: 'review_verification' },
    { id: 'perm-007', name: 'manage_content' },
    { id: 'perm-008', name: 'manage_areas' },
    { id: 'perm-009', name: 'manage_properties' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: {},
      create: { id: perm.id, name: perm.name },
    });
    console.log(`  ✓ Permission: ${perm.name}`);
  }

  // ── Role-Permission mappings ─────────────────────────────

  // Admin gets ALL permissions (001–009)
  const adminPermissions = [
    'perm-001', 'perm-002', 'perm-003', 'perm-004', 'perm-005',
    'perm-006', 'perm-007', 'perm-008', 'perm-009',
  ];

  for (const permId of adminPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        role_id_permission_id: { role_id: 'role-admin-001', permission_id: permId },
      },
      update: {},
      create: {
        id: `rp-admin-${permId}`,
        role_id: 'role-admin-001',
        permission_id: permId,
      },
    });
  }
  console.log('  ✓ Admin permissions assigned (all 9)');

  // Buyer gets: create_listing, manage_areas, manage_properties
  const buyerPermissions = ['perm-003', 'perm-008', 'perm-009'];

  for (const permId of buyerPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        role_id_permission_id: { role_id: 'role-buyer-001', permission_id: permId },
      },
      update: {},
      create: {
        id: `rp-buyer-${permId}`,
        role_id: 'role-buyer-001',
        permission_id: permId,
      },
    });
  }
  console.log('  ✓ Buyer permissions assigned (create_listing, manage_areas, manage_properties)');

  // ── Users ────────────────────────────────────────────────

  const passwordHash = await bcrypt.hash('asdfghjk', BCRYPT_ROUNDS);

  // Swaron — buyer_seller role
  const swaron = await prisma.user.upsert({
    where: { id: 'user-swaron-001' },
    update: { full_name: 'Swaron' },
    create: {
      id: 'user-swaron-001',
      full_name: 'Swaron',
      auth_identities: {
        create: {
          provider: 'LOCAL',
          email: 's@g.com',
          password_hash: passwordHash,
        },
      },
    },
  });
  console.log(`  ✓ User: Swaron (${swaron.id})`);

  // Assign Swaron to buyer_seller role
  await prisma.userRole.upsert({
    where: {
      user_id_role_id: { user_id: swaron.id, role_id: 'role-buyer-001' },
    },
    update: {},
    create: {
      user_id: swaron.id,
      role_id: 'role-buyer-001',
    },
  });
  console.log('  ✓ Swaron → buyer_seller role');

  // Arman — admin role
  const arman = await prisma.user.upsert({
    where: { id: 'user-arman-001' },
    update: { full_name: 'Arman' },
    create: {
      id: 'user-arman-001',
      full_name: 'Arman',
      auth_identities: {
        create: {
          provider: 'LOCAL',
          email: 'a@g.com',
          password_hash: passwordHash,
        },
      },
    },
  });
  console.log(`  ✓ User: Arman (${arman.id})`);

  // Assign Arman to admin role
  await prisma.userRole.upsert({
    where: {
      user_id_role_id: { user_id: arman.id, role_id: 'role-admin-001' },
    },
    update: {},
    create: {
      user_id: arman.id,
      role_id: 'role-admin-001',
    },
  });
  console.log('  ✓ Arman → admin role');

  console.log('Roles & permissions seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
