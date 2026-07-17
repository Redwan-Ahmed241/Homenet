export interface PropertyQueryParams {
  status?: string;
  city?: string;
  area_id?: string;
  type?: string;
  listing_type?: string;
  min_price?: number;
  max_price?: number;
  min_area?: number;
  max_area?: number;
  bedrooms?: number;
  bathrooms?: number;
  search?: string;
  is_verified?: boolean;
  sort_by?: string;
  page: number;
  limit: number;
  lat?: number;
  lng?: number;
  radius?: number;
  userId?: string;
  isAdmin?: boolean;
}

export interface PropertyListItem {
  id: string;
  user_id: string;
  area_id: string;
  title: string;
  description: string | null;
  type: string;
  subtype: string | null;
  listing_type: string;
  price: number;
  price_currency: string;
  area_size: number | null;
  area_unit: string | null;
  location_lat: number | null;
  location_lng: number | null;
  address: string | null;
  amenities: any;
  status: string;
  is_verified: boolean;
  virtual_tour_url: string | null;
  view_count: number;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
  area?: { id: string; name: string; city: string } | null;
  user?: { id: string; full_name: string; avatar_url: string | null } | null;
  media?: { id: string; url: string; thumbnail_url: string | null }[];
  _count?: { media: number };
  distance?: number;
}

export interface PropertyDetail extends PropertyListItem {
  area?: {
    id: string;
    name: string;
    city: string;
    parent: { id: string; name: string } | null;
  } | null;
  user?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    auth_identities?: { email: string | null; phone: string | null }[];
  } | null;
  media?: {
    id: string;
    media_type: string;
    url: string;
    thumbnail_url: string | null;
    display_order: number;
  }[];
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface PropertyMedia {
  id: string;
  property_id: string;
  media_type: string;
  url: string;
  public_id: string;
  thumbnail_url: string | null;
  display_order: number;
}

import type { Verification, VerificationStatus } from '@prisma/client';

export interface IPropertyRepository {
  findPublished(query: PropertyQueryParams): Promise<PaginatedResult<PropertyListItem>>;
  findWithProximitySearch(query: PropertyQueryParams): Promise<PaginatedResult<PropertyListItem>>;
  findPublishedById(id: string): Promise<PropertyDetail | null>;
  incrementViewCount(id: string): Promise<void>;
  findById(id: string): Promise<{ id: string; user_id: string; type: string; status: string; title: string; listing_type: string; price: number } | null>;
  create(data: {
    user_id: string;
    area_id: string;
    title: string;
    description?: string;
    type: string;
    subtype?: string;
    listing_type: string;
    price: number;
    price_currency?: string;
    area_size?: number;
    area_unit?: string;
    location_lat?: number | null;
    location_lng?: number | null;
    address?: string;
    amenities?: any;
    virtual_tour_url?: string;
    status?: string;
  }): Promise<{ id: string; title: string }>;
  update(id: string, data: Record<string, any>): Promise<{ id: string }>;
  softDelete(id: string): Promise<{ id: string }>;
  hardDelete(id: string): Promise<void>;
  findAreaById(areaId: string): Promise<{ id: string } | null>;
  addMedia(data: {
    property_id: string;
    media_type: string;
    url: string;
    public_id: string;
    thumbnail_url?: string | null;
    display_order: number;
  }): Promise<PropertyMedia>;
  findLastMediaOrder(propertyId: string): Promise<number | null>;
  findMediaById(mediaId: string): Promise<{
    id: string;
    property_id: string;
    public_id: string;
    media_type: string;
    property: { user_id: string };
  } | null>;
  deleteMedia(mediaId: string): Promise<void>;
  countMedia(propertyId: string, mediaType: string): Promise<number>;
  findAllAdmin(query: PropertyQueryParams): Promise<PaginatedResult<PropertyListItem>>;
  findUserProperties(query: PropertyQueryParams): Promise<PaginatedResult<PropertyListItem>>;

  createVerification(propertyId: string): Promise<Verification>;
  updateVerificationStatus(
    propertyId: string,
    status: VerificationStatus,
    notes?: string,
  ): Promise<Verification>;
}
