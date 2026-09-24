/**
 * Script: Create properties from flyer data + upload images to Cloudinary
 *
 * Flyer: 26/1 Jafrabad, Rayerbazar Area, Mohammadpur, Dhaka
 * Two flats: Flat C/1 (4th floor) and Flat F/3 (7th floor)
 * Owner: Md. Mohe Uddin Ahmad (new user, no auth identity)
 * Images: image1.png → image5.png uploaded to Cloudinary
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
dotenv.config();

import { v2 as cloudinary } from 'cloudinary';
import { PrismaClient, MediaType } from '@prisma/client';

const prisma = new PrismaClient();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ── Constants ────────────────────────────────────────────────
const AREA_ID = 'mohammadpur-dhaka';
const ADDRESS = '26/1 Jafrabad, Rayerbazar Area, Mouza: Sarai Jafrabad, Thana: Mohammadpur, Dhaka';
const OWNER_NAME = 'Md. Mohe Uddin Ahmad';

const IMAGE_FILES = ['image1.png', 'image2.png', 'image3.png', 'image4.png', 'image5.png'];
const ASSET_DIR = path.resolve('asset');

interface FlatSpec {
  title: string;
  description: string;
  subtype: string;
  area_size: number;
  area_unit: string;
  floor: number;
  amenities: Record<string, unknown>;
}

const FLAT_C1: FlatSpec = {
  title: '3 Bed Apartment (Flat C/1) - 4th Floor, Jafrabad, Mohammadpur',
  description: [
    'South-facing (road side) 3-bedroom apartment on the 4th floor.',
    'Flat No: C/1, 1280 Sq.ft.',
    '3 Bedrooms, 2 Balconies, 2 Bathrooms, 1 Kitchen, Drawing-Dining combined.',
    'Lift facility, Titas gas line, Desco electricity (prepaid), water supply.',
    'Car parking, fully tiled floor, CC camera, and security guard (darwan).',
    'Address: 26/1 Jafrabad, Rayerbazar Area, Mouza: Sarai Jafrabad, Thana: Mohammadpur, Dhaka.',
  ].join('\n'),
  subtype: 'apartment',
  area_size: 1280,
  area_unit: 'sqft',
  floor: 4,
  amenities: {
    bedrooms: 3,
    bathrooms: 2,
    balconies: 2,
    kitchens: 1,
    facing: 'south',
    lift: true,
    gas: 'Titas',
    electricity: 'Desco (prepaid)',
    water: true,
    parking: true,
    tiled_floor: true,
    cc_camera: true,
    security_guard: true,
    drawing_dining: 'combined',
  },
};

const FLAT_F3: FlatSpec = {
  title: '3 Bed Apartment (Flat F/3) - 7th Floor, Jafrabad, Mohammadpur',
  description: [
    'North-West facing 3-bedroom apartment on the 7th floor.',
    'Flat No: F/3, 1280 Sq.ft.',
    '3 Bedrooms, 1 Balcony, 2 Bathrooms, 1 Kitchen, Drawing-Dining combined.',
    'Lift facility, Titas gas line, Desco electricity (prepaid), water supply.',
    'Car parking, fully tiled floor, CC camera, and security guard (darwan).',
    'Address: 26/1 Jafrabad, Rayerbazar Area, Mouza: Sarai Jafrabad, Thana: Mohammadpur, Dhaka.',
  ].join('\n'),
  subtype: 'apartment',
  area_size: 1280,
  area_unit: 'sqft',
  floor: 7,
  amenities: {
    bedrooms: 3,
    bathrooms: 2,
    balconies: 1,
    kitchens: 1,
    facing: 'north-west',
    lift: true,
    gas: 'Titas',
    electricity: 'Desco (prepaid)',
    water: true,
    parking: true,
    tiled_floor: true,
    cc_camera: true,
    security_guard: true,
    drawing_dining: 'combined',
  },
};

// ── Helpers ──────────────────────────────────────────────────

function getThumbnailUrl(secureUrl: string): string {
  return secureUrl.replace('/upload/', '/upload/w_400,h_300,c_fill/');
}

async function uploadToCloudinary(
  filePath: string,
  folder: string,
  publicId: string,
): Promise<{ secure_url: string; public_id: string }> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, public_id: publicId, resource_type: 'image' },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error('No result from Cloudinary'));
        resolve({ secure_url: result.secure_url, public_id: result.public_id });
      },
    );
    fs.createReadStream(filePath).pipe(uploadStream);
  });
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Starting property creation from flyer data…\n');

  // 1. Verify area exists
  const area = await prisma.area.findUnique({ where: { id: AREA_ID } });
  if (!area) throw new Error(`Area "${AREA_ID}" not found. Run seed:areas first.`);
  console.log(`✅ Area found: ${area.name} (${area.city})`);

  // 2. Create user (no auth identity — just a User row)
  const user = await prisma.user.create({
    data: { full_name: OWNER_NAME },
  });
  console.log(`✅ User created: ${user.full_name} (ID: ${user.id})`);

  // 3. Create both properties
  const flats: FlatSpec[] = [FLAT_C1, FLAT_F3];
  const createdPropertyIds: string[] = [];

  for (const flat of flats) {
    const property = await prisma.property.create({
      data: {
        user_id: user.id,
        area_id: AREA_ID,
        title: flat.title,
        description: flat.description,
        type: 'residential',
        subtype: flat.subtype,
        listing_type: 'sale',
        price: 0,            // price unknown — set to 0 (DB requires Float, not nullable)
        price_currency: 'BDT',
        area_size: flat.area_size,
        area_unit: flat.area_unit,
        address: ADDRESS,
        amenities: flat.amenities as any,
        status: 'draft',     // no price → draft
      },
    });
    createdPropertyIds.push(property.id);
    console.log(`✅ Property created: "${flat.title}" → ID: ${property.id}`);
  }

  // 4. Upload images and attach to BOTH properties
  console.log(`\n📸 Uploading ${IMAGE_FILES.length} images to Cloudinary…`);

  for (const propertyId of createdPropertyIds) {
    console.log(`\n  ── Property: ${propertyId} ──`);
    const folder = `homenet/properties/${propertyId}/images`;

    for (let i = 0; i < IMAGE_FILES.length; i++) {
      const fileName = IMAGE_FILES[i];
      const filePath = path.join(ASSET_DIR, fileName);

      if (!fs.existsSync(filePath)) {
        console.warn(`  ⚠️ File not found: ${filePath}, skipping…`);
        continue;
      }

      const publicId = crypto.randomUUID();

      try {
        const result = await uploadToCloudinary(filePath, folder, publicId);
        const thumbnailUrl = getThumbnailUrl(result.secure_url);

        const media = await prisma.propertyMedia.create({
          data: {
            property_id: propertyId,
            media_type: MediaType.image,
            url: result.secure_url,
            public_id: result.public_id,
            thumbnail_url: thumbnailUrl,
            display_order: i,
          },
        });

        console.log(`  ✅ ${fileName} → ${result.secure_url}`);
        console.log(`     Media ID: ${media.id}, public_id: ${result.public_id}`);
      } catch (err: any) {
        console.error(`  ❌ Failed ${fileName}:`, err.message);
      }
    }
  }

  // 5. Summary
  console.log('\n' + '='.repeat(60));
  console.log('🎉 DONE — Summary');
  console.log('='.repeat(60));
  console.log(`User:   ${user.full_name} (${user.id})`);
  for (let i = 0; i < createdPropertyIds.length; i++) {
    const flat = flats[i];
    console.log(`\nProperty ${i + 1}: ${flat.title}`);
    console.log(`  ID: ${createdPropertyIds[i]}`);

    const media = await prisma.propertyMedia.findMany({
      where: { property_id: createdPropertyIds[i] },
      orderBy: { display_order: 'asc' },
    });
    for (const m of media) {
      console.log(`  📷 ${m.url}`);
    }
  }
}

main()
  .catch((e) => {
    console.error('❌ Script failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
