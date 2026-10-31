export type ListOptions = {
  limit?: number;
  page?: number;
  offset?: number;
  sort?: string | string[];
  query?: string;
};

export type Balance = {
  cash?: number;
  bank?: number;
};

export type InventoryOptions = {
  inventoryUserId?: string;
  ignoreMaxQuantity?: boolean;
};

export type ItemOptions = {
  cascadeUpdate?: boolean;
};

export type StoreItemInput = {
  name?: string;
  price?: number;
  description?: string;
  is_inventory?: boolean;
  is_usable?: boolean;
  is_sellable?: boolean;
  is_listed?: boolean;
  stock_remaining?: number;
  unlimited_stock?: boolean;
  max_quantity?: number | null;
  is_reusable?: boolean;
  use_cooldown_seconds?: number | null;
  requirements?: object[];
  actions?: object[];
  expires_at?: string | Date | null;
  emoji_unicode?: string | null;
  emoji_id?: string | null;
  category_id?: string | null;
};

export type ItemCategoryInput = {
  name?: string;
  description?: string;
  position?: number;
  emoji_unicode?: string | null;
  emoji_id?: string | null;
};

export type ClientOptions = {
  baseURL?: string;
  maxRetries?: number;
};

export class APIError extends Error {
  status: number;
  body: unknown;
  headers: Headers;
}

export class Client {
  constructor(token: string, options?: ClientOptions);
  token: string;
  baseURL: string;
  maxRetries: number;

  getGuild(guildId: string): Promise<object>;
  getApplicationPermission(guildId: string): Promise<{ permissions: number }>;
  getGuildLeaderboard(guildId: string, options?: ListOptions): Promise<object[] | { users: object[]; total_pages: number }>;
  getUserBalance(guildId: string, userId: string): Promise<object>;
  editUserBalance(guildId: string, userId: string, balance: Balance): Promise<object>;
  setUserBalance(guildId: string, userId: string, balance: Balance): Promise<object>;
  getItems(guildId: string, options?: ListOptions): Promise<{ page: number; total_pages: number; items: object[] }>;
  createItem(guildId: string, item: StoreItemInput): Promise<object>;
  getItem(guildId: string, itemId: string): Promise<object>;
  editItem(guildId: string, itemId: string, data: StoreItemInput, options?: ItemOptions): Promise<object>;
  deleteItem(guildId: string, itemId: string, options?: ItemOptions): Promise<object>;
  getInventoryItems(guildId: string, userId: string, options?: ListOptions): Promise<{ page: number; total_pages: number; items: object[] }>;
  addInventoryItem(guildId: string, userId: string, itemId: string, quantity?: number, options?: InventoryOptions): Promise<object>;
  getInventoryItem(guildId: string, userId: string, itemId: string): Promise<object>;
  removeInventoryItem(guildId: string, userId: string, itemId: string, quantity?: number): Promise<void>;
  getItemCategories(guildId: string): Promise<object[]>;
  createItemCategory(guildId: string, category: ItemCategoryInput): Promise<object>;
  editItemCategory(guildId: string, categoryId: string, data: ItemCategoryInput): Promise<object>;
  deleteItemCategory(guildId: string, categoryId: string): Promise<void>;
}
