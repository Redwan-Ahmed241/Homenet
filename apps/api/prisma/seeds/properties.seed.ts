import { PrismaClient, PropertyType, ListingType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding properties...');

  // Get a user to own the properties (first user found, or create a demo user)
  let user = await prisma.user.findFirst();

  if (!user) {
    console.log('  No user found, creating a demo owner...');
    user = await prisma.user.create({
      data: {
        full_name: 'Demo Property Owner',
        auth_identities: {
          create: {
            provider: 'LOCAL',
            email: 'demo@homenet.com',
            password_hash: '$2b$10$dummy', // not meant for login
          },
        },
      },
    });
    console.log(`  ✓ Created demo user: ${user.id}`);
  }

  // Also get the first active user for a second owner
  const secondUser = await prisma.user.findFirst({
    where: { id: { not: user.id } },
  }) ?? user;

  // Properties data
  const properties = [
    {
      areaId: 'gulshan-1-dhaka',
      title: 'Luxury 4BR Apartment in Gulshan-1',
      description: 'Beautiful 4-bedroom apartment with panoramic city view. Modern amenities include swimming pool, gym, and 24/7 security. Walking distance to Gulshan shopping centers and restaurants.',
      type: PropertyType.residential,
      listingType: ListingType.sale,
      price: 25000000,
      areaSize: 2200,
      bedrooms: 4,
      bathrooms: 4,
      address: 'Road 68, Gulshan-1, Dhaka',
      lat: 23.7873,
      lng: 90.4100,
      userId: user.id,
    },
    {
      areaId: 'banani-dhaka',
      title: 'Modern 3BR Apartment in Banani',
      description: 'Stylish 3-bedroom apartment in the heart of Banani. Close to all major offices, restaurants, and shopping malls. Fully furnished with modern interior design.',
      type: PropertyType.residential,
      listingType: ListingType.rent,
      price: 85000,
      areaSize: 1650,
      bedrooms: 3,
      bathrooms: 3,
      address: 'Road 11, Banani, Dhaka',
      lat: 23.7930,
      lng: 90.4050,
      userId: user.id,
    },
    {
      areaId: 'bashundhara-dhaka',
      title: 'Spacious 5BR Villa in Bashundhara R/A',
      description: 'Large 5-bedroom villa with private garden and roof terrace. Located in a quiet residential area of Bashundhara Residential Area. Perfect for a large family.',
      type: PropertyType.residential,
      listingType: ListingType.sale,
      price: 42000000,
      areaSize: 3500,
      bedrooms: 5,
      bathrooms: 6,
      address: 'Road 5, Block A, Bashundhara R/A, Dhaka',
      lat: 23.8120,
      lng: 90.4270,
      userId: secondUser.id,
    },
    {
      areaId: 'dhanmondi-dhaka',
      title: 'Commercial Office Space in Dhanmondi 27',
      description: 'Prime commercial space available in Dhanmondi 27. Ideal for corporate office, showroom, or restaurant. High foot traffic area with ample parking.',
      type: PropertyType.commercial,
      listingType: ListingType.rent,
      price: 150000,
      areaSize: 1800,
      address: 'Road 8/A, Dhanmondi 27, Dhaka',
      lat: 23.7470,
      lng: 90.3760,
      userId: user.id,
    },
    {
      areaId: 'uttara-sector-7-dhaka',
      title: 'Affordable 2BR Apartment in Uttara Sector-7',
      description: 'Well-maintained 2-bedroom apartment in a quiet area of Uttara Sector-7. Close to schools, hospitals, and Uttara city center. Ideal for small families or bachelors.',
      type: PropertyType.residential,
      listingType: ListingType.rent,
      price: 35000,
      areaSize: 950,
      bedrooms: 2,
      bathrooms: 2,
      address: 'Road 3, Sector-7, Uttara, Dhaka',
      lat: 23.8750,
      lng: 90.3900,
      userId: secondUser.id,
    },
    {
      areaId: 'mirpur-10-dhaka',
      title: 'Commercial Showroom in Mirpur-10',
      description: 'Prime showroom space in the busiest commercial area of Mirpur-10. Perfect for retail business, electronics showroom, or fashion outlet.',
      type: PropertyType.commercial,
      listingType: ListingType.rent,
      price: 200000,
      areaSize: 2500,
      address: 'Mirpur-10 Roundabout, Dhaka',
      lat: 23.8000,
      lng: 90.3750,
      userId: user.id,
    },
    {
      areaId: 'gulshan-2-dhaka',
      title: 'Luxury Penthouse in Gulshan-2',
      description: 'Exclusive penthouse apartment with breathtaking city skyline views. Features include private terrace, smart home automation, premium Italian fittings, and dedicated parking for 4 cars.',
      type: PropertyType.residential,
      listingType: ListingType.sale,
      price: 58000000,
      areaSize: 4500,
      bedrooms: 5,
      bathrooms: 6,
      address: 'Road 92, Gulshan-2, Dhaka',
      lat: 23.7900,
      lng: 90.4120,
      userId: user.id,
    },
    {
      areaId: 'baridhara-dhaka',
      title: 'Commercial Plot in Baridhara DOHS',
      description: 'Rare commercial plot available in the prestigious Baridhara DOHS area. Ideal for building a corporate headquarters or luxury commercial complex.',
      type: PropertyType.land,
      listingType: ListingType.sale,
      price: 35000000,
      areaSize: 3000,
      areaUnit: 'katha',
      address: 'Baridhara DOHS, Dhaka',
      lat: 23.8050,
      lng: 90.4180,
      userId: secondUser.id,
    },
    {
      areaId: 'mohammadpur-dhaka',
      title: 'Parking Space Rent in Mohammadpur',
      description: 'Secure covered parking space available for monthly rent. Located near Mohammadpur Housing Estate. 24/7 security camera coverage.',
      type: PropertyType.parking,
      listingType: ListingType.rent,
      price: 5000,
      areaSize: 200,
      address: 'Mohammadpur Housing Estate, Block C, Dhaka',
      lat: 23.7660,
      lng: 90.3580,
      userId: user.id,
    },
    {
      areaId: 'motijheel-dhaka',
      title: 'Corporate Office in Motijheel C/A',
      description: 'Premium office space in Motijheel Commercial Area, the prime business district of Dhaka. Fully furnished with conference rooms, pantry, and IT infrastructure.',
      type: PropertyType.commercial,
      listingType: ListingType.rent,
      price: 250000,
      areaSize: 3200,
      address: 'Motijheel C/A, Dhaka',
      lat: 23.7320,
      lng: 90.4170,
      userId: secondUser.id,
    },
  ];

  for (const prop of properties) {
    const areaId = prop.areaId;
    const userId = prop.userId;

    // Build amenities based on type
    const amenities: Record<string, any> = {};

    if (prop.type === PropertyType.residential) {
      amenities.bedrooms = prop.bedrooms;
      amenities.bathrooms = prop.bathrooms;
      amenities.flooring = 'tiles';
      amenities.water_supply = 'yes';
      amenities.gas_connection = 'yes';
      amenities.electricity = 'yes';
      if (prop.price > 1000000) {
        amenities.gym = true;
        amenities.swimming_pool = true;
        amenities.generator = true;
        amenities.security = '24/7';
        amenities.parking = 'covered';
      }
    } else if (prop.type === PropertyType.commercial) {
      amenities.parking = 'yes';
      amenities.washroom = 'yes';
      amenities.electricity = 'three-phase';
      amenities.security = 'yes';
    } else if (prop.type === PropertyType.land) {
      amenities.utility_connection = 'available';
      amenities.road_access = 'yes';
    } else if (prop.type === PropertyType.parking) {
      amenities.security = 'cctv';
      amenities.covered = true;
    }

    // Use upsert to make re-running the seed safe
    const property = await prisma.property.upsert({
      where: { id: `${areaId}-${userId.slice(0, 8)}` },
      update: {
        title: prop.title,
        description: prop.description,
        price: prop.price,
        area_size: prop.areaSize,
        amenities: amenities,
        address: prop.address,
        location_lat: prop.lat,
        location_lng: prop.lng,
        status: 'active',
        is_verified: true,
        published_at: new Date(),
      },
      create: {
        id: `${areaId}-${userId.slice(0, 8)}`,
        user_id: userId,
        area_id: areaId,
        title: prop.title,
        description: prop.description,
        type: prop.type,
        listing_type: prop.listingType,
        price: prop.price,
        price_currency: 'BDT',
        area_size: prop.areaSize,
        area_unit: prop.areaUnit ?? 'sqft',
        location_lat: prop.lat,
        location_lng: prop.lng,
        address: prop.address,
        amenities: amenities,
        status: 'active',
        is_verified: true,
        published_at: new Date(),
        view_count: Math.floor(Math.random() * 500),
      },
    });

    console.log(`  ✓ ${prop.title} (${property.id})`);

    // Ensure property media is attached if defined
    const defaultMedia = DEFAULT_PROPERTY_MEDIA[areaId];
    if (defaultMedia) {
      const existingMedia = await prisma.propertyMedia.findFirst({
        where: { property_id: property.id },
      });

      if (!existingMedia) {
        await prisma.propertyMedia.create({
          data: {
            property_id: property.id,
            media_type: 'image',
            url: defaultMedia.url,
            thumbnail_url: defaultMedia.thumbnail_url,
            public_id: defaultMedia.public_id,
            display_order: 0,
          },
        });
        console.log(`    ↳ Attached media: ${defaultMedia.url}`);
      }
    }
  }

  console.log('Properties seeding complete!');
}

const DEFAULT_PROPERTY_MEDIA: Record<string, { url: string; thumbnail_url: string; public_id: string }> = {
  'gulshan-1-dhaka': {
    url: 'https://res.cloudinary.com/ms3nwbfn/image/upload/v1788676691/homenet/properties/gulshan-1-dhaka-user-swa/images/8628ea16-ffab-4578-9698-d94cbc3f5ace.jpg',
    thumbnail_url: 'https://res.cloudinary.com/ms3nwbfn/image/upload/w_400,h_300,c_fill/v1788676691/homenet/properties/gulshan-1-dhaka-user-swa/images/8628ea16-ffab-4578-9698-d94cbc3f5ace.jpg',
    public_id: 'homenet/properties/gulshan-1-dhaka-user-swa/images/8628ea16-ffab-4578-9698-d94cbc3f5ace',
  },
  'banani-dhaka': {
    url: 'https://res.cloudinary.com/ms3nwbfn/image/upload/v1788676694/homenet/properties/banani-dhaka-user-swa/images/240a36d1-0b10-4e7f-a03e-82a033301561.jpg',
    thumbnail_url: 'https://res.cloudinary.com/ms3nwbfn/image/upload/w_400,h_300,c_fill/v1788676694/homenet/properties/banani-dhaka-user-swa/images/240a36d1-0b10-4e7f-a03e-82a033301561.jpg',
    public_id: 'homenet/properties/banani-dhaka-user-swa/images/240a36d1-0b10-4e7f-a03e-82a033301561',
  },
  'gulshan-2-dhaka': {
    url: 'https://res.cloudinary.com/ms3nwbfn/image/upload/v1788676698/homenet/properties/gulshan-2-dhaka-user-swa/images/d6772e0b-caa7-4635-aaa2-33506b2c4313.jpg',
    thumbnail_url: 'https://res.cloudinary.com/ms3nwbfn/image/upload/w_400,h_300,c_fill/v1788676698/homenet/properties/gulshan-2-dhaka-user-swa/images/d6772e0b-caa7-4635-aaa2-33506b2c4313.jpg',
    public_id: 'homenet/properties/gulshan-2-dhaka-user-swa/images/d6772e0b-caa7-4635-aaa2-33506b2c4313',
  },
  'uttara-sector-7-dhaka': {
    url: 'https://res.cloudinary.com/ms3nwbfn/image/upload/v1788676702/homenet/properties/uttara-sector-7-dhaka-user-arm/images/bc283609-7ea9-4ddb-b2d4-fb1f77b00f28.jpg',
    thumbnail_url: 'https://res.cloudinary.com/ms3nwbfn/image/upload/w_400,h_300,c_fill/v1788676702/homenet/properties/uttara-sector-7-dhaka-user-arm/images/bc283609-7ea9-4ddb-b2d4-fb1f77b00f28.jpg',
    public_id: 'homenet/properties/uttara-sector-7-dhaka-user-arm/images/bc283609-7ea9-4ddb-b2d4-fb1f77b00f28',
  },
  'mirpur-10-dhaka': {
    url: 'https://res.cloudinary.com/ms3nwbfn/image/upload/v1788676706/homenet/properties/mirpur-10-dhaka-user-swa/images/98292797-12d8-47f2-8ff9-5460c4e11c48.jpg',
    thumbnail_url: 'https://res.cloudinary.com/ms3nwbfn/image/upload/w_400,h_300,c_fill/v1788676706/homenet/properties/mirpur-10-dhaka-user-swa/images/98292797-12d8-47f2-8ff9-5460c4e11c48.jpg',
    public_id: 'homenet/properties/mirpur-10-dhaka-user-swa/images/98292797-12d8-47f2-8ff9-5460c4e11c48',
  },
  'baridhara-dhaka': {
    url: 'https://res.cloudinary.com/ms3nwbfn/image/upload/v1788676711/homenet/properties/baridhara-dhaka-user-arm/images/f11e5ee6-8737-4588-a0ee-37144aaba892.jpg',
    thumbnail_url: 'https://res.cloudinary.com/ms3nwbfn/image/upload/w_400,h_300,c_fill/v1788676711/homenet/properties/baridhara-dhaka-user-arm/images/f11e5ee6-8737-4588-a0ee-37144aaba892.jpg',
    public_id: 'homenet/properties/baridhara-dhaka-user-arm/images/f11e5ee6-8737-4588-a0ee-37144aaba892',
  },
  'mohammadpur-dhaka': {
    url: 'https://res.cloudinary.com/ms3nwbfn/image/upload/v1788676713/homenet/properties/mohammadpur-dhaka-user-swa/images/9c7e9d92-41c4-4f10-a9af-62fadf6c1738.jpg',
    thumbnail_url: 'https://res.cloudinary.com/ms3nwbfn/image/upload/w_400,h_300,c_fill/v1788676713/homenet/properties/mohammadpur-dhaka-user-swa/images/9c7e9d92-41c4-4f10-a9af-62fadf6c1738.jpg',
    public_id: 'homenet/properties/mohammadpur-dhaka-user-swa/images/9c7e9d92-41c4-4f10-a9af-62fadf6c1738',
  },
  'motijheel-dhaka': {
    url: 'https://res.cloudinary.com/ms3nwbfn/image/upload/v1788676718/homenet/properties/motijheel-dhaka-user-arm/images/64094b14-f9bb-49c6-a247-8a0c9577a4b1.jpg',
    thumbnail_url: 'https://res.cloudinary.com/ms3nwbfn/image/upload/w_400,h_300,c_fill/v1788676718/homenet/properties/motijheel-dhaka-user-arm/images/64094b14-f9bb-49c6-a247-8a0c9577a4b1.jpg',
    public_id: 'homenet/properties/motijheel-dhaka-user-arm/images/64094b14-f9bb-49c6-a247-8a0c9577a4b1',
  },
  'dhanmondi-dhaka': {
    url: 'https://res.cloudinary.com/ms3nwbfn/image/upload/v1788676723/homenet/properties/dhanmondi-dhaka-user-swa/images/38246b1e-3ce9-4dce-a595-0f2889cd364c.jpg',
    thumbnail_url: 'https://res.cloudinary.com/ms3nwbfn/image/upload/w_400,h_300,c_fill/v1788676723/homenet/properties/dhanmondi-dhaka-user-swa/images/38246b1e-3ce9-4dce-a595-0f2889cd364c.jpg',
    public_id: 'homenet/properties/dhanmondi-dhaka-user-swa/images/38246b1e-3ce9-4dce-a595-0f2889cd364c',
  },
  'bashundhara-dhaka': {
    url: 'https://res.cloudinary.com/ms3nwbfn/image/upload/v1788677412/homenet/properties/bashundhara-dhaka-user-arm/images/8d32408e-b103-4431-abe9-e1e6a9b0baf5.jpg',
    thumbnail_url: 'https://res.cloudinary.com/ms3nwbfn/image/upload/w_400,h_300,c_fill/v1788677412/homenet/properties/bashundhara-dhaka-user-arm/images/8d32408e-b103-4431-abe9-e1e6a9b0baf5.jpg',
    public_id: 'homenet/properties/bashundhara-dhaka-user-arm/images/8d32408e-b103-4431-abe9-e1e6a9b0baf5',
  },
};

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
