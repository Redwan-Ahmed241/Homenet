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
}

const ASSET_MAPPINGS: AssetMapping[] = [
  {
    fileName: '4br_apartment_gulshan.jpg',
    propertyId: 'gulshan-1-dhaka-user-swa',
    propertyTitle: 'Luxury 4BR Apartment in Gulshan-1',
  },
  {
    fileName: 'modern_3br_apartment_banani.jpg',
    propertyId: 'banani-dhaka-user-swa',
    propertyTitle: 'Modern 3BR Apartment in Banani',
  },
  {
    fileName: 'luxury_penthouse_gulshan_2.jpg',
    propertyId: 'gulshan-2-dhaka-user-swa',
    propertyTitle: 'Luxury Penthouse in Gulshan-2',
  },
  {
    fileName: 'affordable_2br_apartment_uttara_sector_7.jpg',
    propertyId: 'uttara-sector-7-dhaka-user-arm',
    propertyTitle: 'Affordable 2BR Apartment in Uttara Sector-7',
  },
  {
    fileName: 'commercial_showroom_mirpur_10.jpg',
    propertyId: 'mirpur-10-dhaka-user-swa',
    propertyTitle: 'Commercial Showroom in Mirpur-10',
  },
  {
    fileName: 'commercial_plot_baridhara_dohs.jpg',
    propertyId: 'baridhara-dhaka-user-arm',
    propertyTitle: 'Commercial Plot in Baridhara DOHS',
  },
  {
    fileName: 'garage_image_mohammadpur.jpg',
    propertyId: 'mohammadpur-dhaka-user-swa',
    propertyTitle: 'Parking Space Rent in Mohammadpur',
  },
  {
    fileName: 'corporate_office_motijheel.jpg',
    propertyId: 'motijheel-dhaka-user-arm',
    propertyTitle: 'Corporate Office in Motijheel C/A',
  },
  {
    fileName: 'office_space_dhanmondi.jpg',
    propertyId: 'dhanmondi-dhaka-user-swa',
    propertyTitle: 'Commercial Office Space in Dhanmondi 27',
  },
  {
    fileName: 'spacious_5br_villa_bashundhara.jpg',
    propertyId: 'bashundhara-dhaka-user-arm',
    propertyTitle: 'Spacious 5BR Villa in Bashundhara R/A',
  },
];

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

async function main() {
  console.log('🚀 Starting asset upload to Cloudinary and database synchronization...\n');

  const assetDir = path.resolve('asset');
  if (!fs.existsSync(assetDir)) {
    throw new Error(`Asset directory not found at ${assetDir}`);
  }

  let successCount = 0;
  let skipCount = 0;

  for (const item of ASSET_MAPPINGS) {
    const filePath = path.join(assetDir, item.fileName);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ File not found: ${filePath}, skipping...`);
      continue;
    }

    // Verify property exists in DB
    const property = await prisma.property.findUnique({
      where: { id: item.propertyId },
      include: { media: true },
    });

    if (!property) {
      console.warn(`⚠️ Property ${item.propertyId} not found in database, skipping...`);
      continue;
    }

    // Check if property already has media
    if (property.media.length > 0) {
      console.log(`ℹ️ Property "${item.propertyTitle}" (${item.propertyId}) already has ${property.media.length} media item(s). Skipping upload.`);
      skipCount++;
      continue;
    }

    console.log(`⏳ Uploading "${item.fileName}" for "${item.propertyTitle}"...`);
    const publicId = crypto.randomUUID();
    const folder = `homenet/properties/${item.propertyId}/images`;

    try {
      const uploadResult = await uploadToCloudinary(filePath, folder, publicId);
      const thumbnailUrl = getThumbnailUrl(uploadResult.secure_url);

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
      successCount++;
    } catch (err: any) {
      console.error(`  ❌ Failed to upload/save for "${item.propertyTitle}":`, err.message);
    }
  }

  console.log(`\n🎉 Completed: ${successCount} uploaded & linked, ${skipCount} skipped.`);
}

main()
  .catch((e) => {
    console.error('Execution error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
