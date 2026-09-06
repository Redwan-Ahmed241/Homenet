import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
dotenv.config();

import { v2 as cloudinary } from 'cloudinary';
import { PrismaClient, MediaType } from '@prisma/client';

const prisma = new PrismaClient();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Mapping of asset filenames to property IDs and titles in database
interface AssetMapping {
  fileName: string;
  propertyId: string;
  propertyTitle: string;
  areaId: string;
}

const ASSET_MAPPINGS: AssetMapping[] = [
  {
    fileName: '4br_apartment_gulshan.jpg',
    propertyId: 'gulshan-1-dhaka-user-swa',
    propertyTitle: 'Luxury 4BR Apartment in Gulshan-1',
    areaId: 'gulshan-1-dhaka',
  },
  {
    fileName: 'modern_3br_apartment_banani.jpg',
    propertyId: 'banani-dhaka-user-swa',
    propertyTitle: 'Modern 3BR Apartment in Banani',
    areaId: 'banani-dhaka',
  },
  {
    fileName: 'luxury_penthouse_gulshan_2.jpg',
    propertyId: 'gulshan-2-dhaka-user-swa',
    propertyTitle: 'Luxury Penthouse in Gulshan-2',
    areaId: 'gulshan-2-dhaka',
  },
  {
    fileName: 'affordable_2br_apartment_uttara_sector_7.jpg',
    propertyId: 'uttara-sector-7-dhaka-user-arm',
    propertyTitle: 'Affordable 2BR Apartment in Uttara Sector-7',
    areaId: 'uttara-sector-7-dhaka',
  },
  {
    fileName: 'commercial_showroom_mirpur_10.jpg',
    propertyId: 'mirpur-10-dhaka-user-swa',
    propertyTitle: 'Commercial Showroom in Mirpur-10',
    areaId: 'mirpur-10-dhaka',
  },
  {
    fileName: 'commercial_plot_baridhara_dohs.jpg',
    propertyId: 'baridhara-dhaka-user-arm',
    propertyTitle: 'Commercial Plot in Baridhara DOHS',
    areaId: 'baridhara-dhaka',
  },
  {
    fileName: 'garage_image_mohammadpur.jpg',
    propertyId: 'mohammadpur-dhaka-user-swa',
    propertyTitle: 'Parking Space Rent in Mohammadpur',
    areaId: 'mohammadpur-dhaka',
  },
  {
    fileName: 'corporate_office_motijheel.jpg',
    propertyId: 'motijheel-dhaka-user-arm',
    propertyTitle: 'Corporate Office in Motijheel C/A',
    areaId: 'motijheel-dhaka',
  },
  {
    fileName: 'office_space_dhanmondi.jpg',
    propertyId: 'dhanmondi-dhaka-user-swa',
    propertyTitle: 'Commercial Office Space in Dhanmondi 27',
    areaId: 'dhanmondi-dhaka',
  },
  {
    fileName: 'spacious_5br_villa_bashundhara.jpg',
    propertyId: 'bashundhara-dhaka-user-arm',
    propertyTitle: 'Spacious 5BR Villa in Bashundhara R/A',
    areaId: 'bashundhara-dhaka',
  },
];

// Baseline byte sizes from the initial upload
const INITIAL_ASSET_SIZES: Record<string, number> = {
  '4br_apartment_gulshan.jpg': 2603328,
  'modern_3br_apartment_banani.jpg': 2671887,
  'luxury_penthouse_gulshan_2.jpg': 2841531,
  'affordable_2br_apartment_uttara_sector_7.jpg': 3291599,
  'commercial_showroom_mirpur_10.jpg': 2322749,
  'commercial_plot_baridhara_dohs.jpg': 3758864,
  'garage_image_mohammadpur.jpg': 754459,
  'corporate_office_motijheel.jpg': 2928054,
  'office_space_dhanmondi.jpg': 2933707,
  'spacious_5br_villa_bashundhara.jpg': 2740066,
};

function getThumbnailUrl(secureUrl: string): string {
  return secureUrl.replace('/upload/', '/upload/w_400,h_300,c_fill/');
}

async function uploadToCloudinary(filePath: string, folder: string, publicId: string) {
  return new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: 'image',
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result) return reject(new Error('No result returned from Cloudinary'));
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
        });
      },
    );

    fs.createReadStream(filePath).pipe(uploadStream);
  });
}

async function deleteFromCloudinary(publicId: string) {
  try {
    const res = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
    console.log(`  🗑️ Deleted previous Cloudinary asset: ${publicId} (result: ${res.result})`);
  } catch (err: any) {
    console.warn(`  ⚠️ Failed to delete previous Cloudinary asset ${publicId}:`, err.message);
  }
}

async function main() {
  const forceAll = process.argv.includes('--force') || process.argv.includes('--all');
  console.log('🚀 Starting asset check, Cloudinary replacement, and database synchronization...\n');

  const assetDir = path.resolve('asset');
  if (!fs.existsSync(assetDir)) {
    throw new Error(`Asset directory not found at ${assetDir}`);
  }

  let replacedCount = 0;
  let newCount = 0;
  let skipCount = 0;

  const updatedMediaMap: Record<string, { url: string; thumbnail_url: string; public_id: string }> = {};

  for (const item of ASSET_MAPPINGS) {
    const filePath = path.join(assetDir, item.fileName);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ File not found: ${filePath}, skipping...`);
      continue;
    }

    const fileStat = fs.statSync(filePath);
    const initialSize = INITIAL_ASSET_SIZES[item.fileName];
    const isFileChanged = forceAll || (initialSize !== undefined && fileStat.size !== initialSize);

    // Verify property exists in DB
    const property = await prisma.property.findUnique({
      where: { id: item.propertyId },
      include: { media: true },
    });

    if (!property) {
      console.warn(`⚠️ Property ${item.propertyId} not found in database, skipping...`);
      continue;
    }

    const existingMedia = property.media.find((m) => m.media_type === 'image');

    if (existingMedia && !isFileChanged) {
      console.log(`ℹ️ "${item.propertyTitle}" media exists and file is unchanged (${fileStat.size} bytes). Skipping.`);
      updatedMediaMap[item.areaId] = {
        url: existingMedia.url,
        thumbnail_url: existingMedia.thumbnail_url ?? getThumbnailUrl(existingMedia.url),
        public_id: existingMedia.public_id,
      };
      skipCount++;
      continue;
    }

    const action = existingMedia ? 'Replacing' : 'Uploading new';
    console.log(`⏳ ${action} image for "${item.propertyTitle}" (new file size: ${fileStat.size} bytes)...`);

    // 1. Delete existing image on Cloudinary if it exists
    if (existingMedia?.public_id) {
      await deleteFromCloudinary(existingMedia.public_id);
    }

    // 2. Upload new image to Cloudinary
    const publicId = crypto.randomUUID();
    const folder = `homenet/properties/${item.propertyId}/images`;

    try {
      const uploadResult = await uploadToCloudinary(filePath, folder, publicId);
      const thumbnailUrl = getThumbnailUrl(uploadResult.secure_url);

      if (existingMedia) {
        // 3a. Update existing PropertyMedia record
        await prisma.propertyMedia.update({
          where: { id: existingMedia.id },
          data: {
            url: uploadResult.secure_url,
            public_id: uploadResult.public_id,
            thumbnail_url: thumbnailUrl,
          },
        });
        console.log(`  ✓ Cloudinary updated: ${uploadResult.secure_url}`);
        console.log(`  ✓ Updated PropertyMedia record ID: ${existingMedia.id}\n`);
        replacedCount++;
      } else {
        // 3b. Create new PropertyMedia record
        const mediaRecord = await prisma.propertyMedia.create({
          data: {
            property_id: item.propertyId,
            media_type: MediaType.image,
            url: uploadResult.secure_url,
            public_id: uploadResult.public_id,
            thumbnail_url: thumbnailUrl,
            display_order: 0,
          },
        });
        console.log(`  ✓ Uploaded to Cloudinary: ${uploadResult.secure_url}`);
        console.log(`  ✓ Created PropertyMedia record ID: ${mediaRecord.id}\n`);
        newCount++;
      }

      updatedMediaMap[item.areaId] = {
        url: uploadResult.secure_url,
        thumbnail_url: thumbnailUrl,
        public_id: uploadResult.public_id,
      };
    } catch (err: any) {
      console.error(`  ❌ Failed to upload/save for "${item.propertyTitle}":`, err.message);
    }
  }

  console.log(`\n🎉 Summary: ${replacedCount} replaced, ${newCount} newly created, ${skipCount} unchanged.`);
  console.log('\nUpdated Media Map for seeds:');
  console.log(JSON.stringify(updatedMediaMap, null, 2));
}

main()
  .catch((e) => {
    console.error('Execution error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
