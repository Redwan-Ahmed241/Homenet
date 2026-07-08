export interface AreaListItem {
  id: string;
  name: string;
  parent_area_id: string | null;
  city: string;
  created_at: Date;
  updated_at: Date;
  _count: { children: number };
}

export interface AreaDetail {
  id: string;
  name: string;
  parent_area_id: string | null;
  city: string;
  created_at: Date;
  updated_at: Date;
  parent: { id: string; name: string } | null;
  children: { id: string; name: string }[];
}

export interface AreaExists {
  id: string;
}

export interface AreaChildrenResult {
  id: string;
  name: string;
  parent_area_id: string | null;
  city: string;
  created_at: Date;
  updated_at: Date;
  _count: { children: number };
}

export interface IAreaRepository {
  findManyWithCount(params: {
    where: Record<string, any>;
    skip: number;
    take: number;
    orderBy: Record<string, string>;
  }): Promise<{ items: AreaListItem[]; total: number }>;

  findById(id: string): Promise<AreaExists | null>;

  findDetail(id: string): Promise<AreaDetail | null>;

  findChildren(id: string): Promise<AreaChildrenResult[]>;

  findByNameAndCity(name: string, city: string): Promise<AreaExists | null>;

  create(data: { name: string; parent_area_id: string | null; city: string }): Promise<{ id: string; name: string }>;

  update(id: string, data: Record<string, any>): Promise<{ id: string }>;

  updateGeometry(id: string, boundary: string | undefined | null, centroid: string | undefined | null): Promise<void>;

  countActiveProperties(areaId: string): Promise<number>;

  delete(id: string): Promise<void>;
}
