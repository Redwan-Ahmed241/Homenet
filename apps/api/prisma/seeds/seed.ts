/**
 * Main Prisma seed entry point.
 *
 * Prisma automatically runs the command configured under
 * `prisma.seed` in package.json whenever you execute:
 *   - `prisma migrate reset`
 *   - `prisma db seed`
 *
 * This file simply runs each domain-specific seed script
 * in the correct dependency order (areas first, then properties).
 */

import { execSync } from 'child_process';
import { resolve } from 'path';

const seeds = [
  resolve(__dirname, 'roles-permissions.seed.ts'),
  resolve(__dirname, 'areas.seed.ts'),
  resolve(__dirname, 'properties.seed.ts'),
];

for (const seedFile of seeds) {
  console.log(`\n🌱 Running: ${seedFile}\n`);
  execSync(`npx ts-node "${seedFile}"`, { stdio: 'inherit' });
}

console.log('\n🎉 All seeds completed successfully!\n');
