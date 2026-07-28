import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding areas...');

  // ── Top-level areas (no parent) ─────────────────────────

  const gulshan = await prisma.area.upsert({
    where: { id: 'gulshan-dhaka' },
    update: { name: 'Gulshan', city: 'Dhaka' },
    create: { id: 'gulshan-dhaka', name: 'Gulshan', city: 'Dhaka' },
  });
  console.log(`  ✓ ${gulshan.name}`);

  const banani = await prisma.area.upsert({
    where: { id: 'banani-dhaka' },
    update: { name: 'Banani', city: 'Dhaka' },
    create: { id: 'banani-dhaka', name: 'Banani', city: 'Dhaka' },
  });
  console.log(`  ✓ ${banani.name}`);

  const baridhara = await prisma.area.upsert({
    where: { id: 'baridhara-dhaka' },
    update: { name: 'Baridhara', city: 'Dhaka' },
    create: { id: 'baridhara-dhaka', name: 'Baridhara', city: 'Dhaka' },
  });
  console.log(`  ✓ ${baridhara.name}`);

  const bashundhara = await prisma.area.upsert({
    where: { id: 'bashundhara-dhaka' },
    update: { name: 'Bashundhara', city: 'Dhaka' },
    create: { id: 'bashundhara-dhaka', name: 'Bashundhara', city: 'Dhaka' },
  });
  console.log(`  ✓ ${bashundhara.name}`);

  const dhanmondi = await prisma.area.upsert({
    where: { id: 'dhanmondi-dhaka' },
    update: { name: 'Dhanmondi', city: 'Dhaka' },
    create: { id: 'dhanmondi-dhaka', name: 'Dhanmondi', city: 'Dhaka' },
  });
  console.log(`  ✓ ${dhanmondi.name}`);

  const mirpur = await prisma.area.upsert({
    where: { id: 'mirpur-dhaka' },
    update: { name: 'Mirpur', city: 'Dhaka' },
    create: { id: 'mirpur-dhaka', name: 'Mirpur', city: 'Dhaka' },
  });
  console.log(`  ✓ ${mirpur.name}`);

  const uttara = await prisma.area.upsert({
    where: { id: 'uttara-dhaka' },
    update: { name: 'Uttara', city: 'Dhaka' },
    create: { id: 'uttara-dhaka', name: 'Uttara', city: 'Dhaka' },
  });
  console.log(`  ✓ ${uttara.name}`);

  const mohammadpur = await prisma.area.upsert({
    where: { id: 'mohammadpur-dhaka' },
    update: { name: 'Mohammadpur', city: 'Dhaka' },
    create: { id: 'mohammadpur-dhaka', name: 'Mohammadpur', city: 'Dhaka' },
  });
  console.log(`  ✓ ${mohammadpur.name}`);

  const motijheel = await prisma.area.upsert({
    where: { id: 'motijheel-dhaka' },
    update: { name: 'Motijheel', city: 'Dhaka' },
    create: { id: 'motijheel-dhaka', name: 'Motijheel', city: 'Dhaka' },
  });
  console.log(`  ✓ ${motijheel.name}`);

  const rampura = await prisma.area.upsert({
    where: { id: 'rampura-dhaka' },
    update: { name: 'Rampura', city: 'Dhaka' },
    create: { id: 'rampura-dhaka', name: 'Rampura', city: 'Dhaka' },
  });
  console.log(`  ✓ ${rampura.name}`);

  // ── Children of Gulshan ─────────────────────────────────

  for (const suffix of ['1', '2']) {
    await prisma.area.upsert({
      where: { id: `gulshan-${suffix}-dhaka` },
      update: {
        name: `Gulshan-${suffix}`,
        parent_area_id: gulshan.id,
        city: 'Dhaka',
      },
      create: {
        id: `gulshan-${suffix}-dhaka`,
        name: `Gulshan-${suffix}`,
        parent_area_id: gulshan.id,
        city: 'Dhaka',
      },
    });
    console.log(`  ✓ Gulshan-${suffix}`);
  }

  // ── Children of Mirpur ──────────────────────────────────

  for (const suffix of ['1', '2', '10', '12', '14']) {
    await prisma.area.upsert({
      where: { id: `mirpur-${suffix}-dhaka` },
      update: {
        name: `Mirpur-${suffix}`,
        parent_area_id: mirpur.id,
        city: 'Dhaka',
      },
      create: {
        id: `mirpur-${suffix}-dhaka`,
        name: `Mirpur-${suffix}`,
        parent_area_id: mirpur.id,
        city: 'Dhaka',
      },
    });
    console.log(`  ✓ Mirpur-${suffix}`);
  }

  // ── Children of Uttara (Sector-1 through Sector-14) ─────

  for (let i = 1; i <= 14; i++) {
    await prisma.area.upsert({
      where: { id: `uttara-sector-${i}-dhaka` },
      update: {
        name: `Sector-${i}`,
        parent_area_id: uttara.id,
        city: 'Dhaka',
      },
      create: {
        id: `uttara-sector-${i}-dhaka`,
        name: `Sector-${i}`,
        parent_area_id: uttara.id,
        city: 'Dhaka',
      },
    });
    console.log(`  ✓ Sector-${i}`);
  }

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
