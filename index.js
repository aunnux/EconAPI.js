const DEFAULT_BASE_URL = "http://localhost:3000/api/v1";
const DEFAULT_MAX_RETRIES = 3;

export class APIError extends Error {
  constructor(message, { status, body, headers }) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.body = body;
    this.headers = headers;
  }
}

function encodePath(value, name) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return encodeURIComponent(value);
}

function queryString(options = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(options)) {
    if (value === undefined || value === null) continue;
    params.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

function resetTime(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed < 1_000_000_000_000 ? parsed * 1000 : parsed;
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, milliseconds)));
}

export class Client {
  constructor(token, options = {}) {
    if (typeof token !== "string" || token.length === 0) {
      throw new TypeError("An API token is required");
    }

    const baseURL = options.baseURL ?? DEFAULT_BASE_URL;
    if (typeof baseURL !== "string" || baseURL.length === 0) {
      throw new TypeError("baseURL must be a non-empty URL");
    }
    const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    if (!Number.isSafeInteger(maxRetries) || maxRetries < 0) {
      throw new TypeError("maxRetries must be a non-negative integer");
    }

    this.token = token;
    this.baseURL = baseURL.replace(/\/+$/, "");
    this.maxRetries = maxRetries;
    this._queue = Promise.resolve();
    this._remaining = undefined;
    this._resetAt = undefined;
  }

  _request(method, endpoint, data) {
    const request = this._queue.then(() => this._send(method, endpoint, data));
    this._queue = request.then(() => undefined, () => undefined);
    return request;
  }

  async _send(method, endpoint, data) {
    for (let attempt = 0; ; attempt += 1) {
      if (this._remaining === 0 && this._resetAt !== undefined) {
        await delay(this._resetAt - Date.now());
        if (Date.now() >= this._resetAt) this._remaining = undefined;
      }

      const headers = { Accept: "application/json", Authorization: this.token };
      const init = { method, headers };
      if (data !== undefined) {
        headers["Content-Type"] = "application/json";
        init.body = JSON.stringify(data);
      }

      const response = await fetch(`${this.baseURL}${endpoint}`, init);
      const remainingHeader = response.headers.get("x-ratelimit-remaining");
      const resetHeader = response.headers.get("x-ratelimit-reset");
      if (remainingHeader !== null) {
        const remaining = Number(remainingHeader);
        if (Number.isFinite(remaining)) this._remaining = remaining;
      }
      if (resetHeader !== null) this._resetAt = resetTime(resetHeader);

      let body;
      if (response.status !== 204) {
        const text = await response.text();
        if (text) {
          try {
            body = JSON.parse(text);
          } catch {
            body = text;
          }
        }
      }

      if (response.status === 429 && attempt < this.maxRetries) {
        const retryAfter = Number(body?.retry_after);
        const wait = Number.isFinite(retryAfter) && retryAfter >= 0
          ? retryAfter
          : this._resetAt !== undefined
            ? this._resetAt - Date.now()
            : 1000 * (attempt + 1);
        this._remaining = 0;
        this._resetAt = Date.now() + Math.max(0, wait);
        await delay(wait);
        continue;
      }

      if (!response.ok) {
        const message = typeof body === "object" && body !== null && typeof body.message === "string"
          ? body.message
          : `API request failed with status ${response.status}`;
        throw new APIError(message, {
          status: response.status,
          body,
          headers: response.headers
        });
      }

      return body;
    }
  }

  getGuild(guildId) {
    return this._request("GET", `/guilds/${encodePath(guildId, "guildId")}`);
  }

  getApplicationPermission(guildId) {
    return this._request("GET", `/applications/@me/guilds/${encodePath(guildId, "guildId")}`);
  }

  getGuildLeaderboard(guildId, options) {
    return this._request("GET", `/guilds/${encodePath(guildId, "guildId")}/users${queryString(options)}`);
  }

  getUserBalance(guildId, userId) {
    return this._request(
      "GET",
      `/guilds/${encodePath(guildId, "guildId")}/users/${encodePath(userId, "userId")}`
    );
  }

  editUserBalance(guildId, userId, balance) {
    return this._request(
      "PATCH",
      `/guilds/${encodePath(guildId, "guildId")}/users/${encodePath(userId, "userId")}`,
      balance
    );
  }

  setUserBalance(guildId, userId, balance) {
    return this._request(
      "PUT",
      `/guilds/${encodePath(guildId, "guildId")}/users/${encodePath(userId, "userId")}`,
      balance
    );
  }

  getItems(guildId, options) {
    return this._request(
      "GET",
      `/guilds/${encodePath(guildId, "guildId")}/items${queryString(options)}`
    );
  }

  createItem(guildId, item) {
    return this._request("POST", `/guilds/${encodePath(guildId, "guildId")}/items`, item);
  }

  getItem(guildId, itemId) {
    return this._request(
      "GET",
      `/guilds/${encodePath(guildId, "guildId")}/items/${encodePath(itemId, "itemId")}`
    );
  }

  editItem(guildId, itemId, data, options = {}) {
    const cascade = options.cascadeUpdate === undefined
      ? ""
      : queryString({ boolean: options.cascadeUpdate });
    return this._request(
      "PATCH",
      `/guilds/${encodePath(guildId, "guildId")}/items/${encodePath(itemId, "itemId")}${cascade}`,
      data
    );
  }

  deleteItem(guildId, itemId, options = {}) {
    const cascade = options.cascadeUpdate === undefined
      ? ""
      : queryString({ boolean: options.cascadeUpdate });
    return this._request(
      "DELETE",
      `/guilds/${encodePath(guildId, "guildId")}/items/${encodePath(itemId, "itemId")}${cascade}`
    );
  }

  getInventoryItems(guildId, userId, options) {
    return this._request(
      "GET",
      `/guilds/${encodePath(guildId, "guildId")}/users/${encodePath(userId, "userId")}/inventory${queryString(options)}`
    );
  }

  addInventoryItem(guildId, userId, itemId, quantity = 1, options = {}) {
    const requestOptions = {};
    if (options.inventoryUserId !== undefined) {
      requestOptions.inventory_user_id = options.inventoryUserId;
    }
    if (options.ignoreMaxQuantity !== undefined) {
      requestOptions.ignore_max_quantity = options.ignoreMaxQuantity;
    }
    return this._request(
      "POST",
      `/guilds/${encodePath(guildId, "guildId")}/users/${encodePath(userId, "userId")}/inventory`,
      { item_id: itemId, quantity, options: requestOptions }
    );
  }

  getInventoryItem(guildId, userId, itemId) {
    return this._request(
      "GET",
      `/guilds/${encodePath(guildId, "guildId")}/users/${encodePath(userId, "userId")}/inventory/${encodePath(itemId, "itemId")}`
    );
  }

  removeInventoryItem(guildId, userId, itemId, quantity) {
    const query = quantity === undefined ? "" : queryString({ integer: quantity });
    return this._request(
      "DELETE",
      `/guilds/${encodePath(guildId, "guildId")}/users/${encodePath(userId, "userId")}/inventory/${encodePath(itemId, "itemId")}${query}`
    );
  }

  getItemCategories(guildId) {
    return this._request("GET", `/guilds/${encodePath(guildId, "guildId")}/item-categories`);
  }

  createItemCategory(guildId, category) {
    return this._request(
      "POST",
      `/guilds/${encodePath(guildId, "guildId")}/item-categories`,
      category
    );
  }

  editItemCategory(guildId, categoryId, data) {
    return this._request(
      "PATCH",
      `/guilds/${encodePath(guildId, "guildId")}/item-categories/${encodePath(categoryId, "categoryId")}`,
      data
    );
  }

  deleteItemCategory(guildId, categoryId) {
    return this._request(
      "DELETE",
      `/guilds/${encodePath(guildId, "guildId")}/item-categories/${encodePath(categoryId, "categoryId")}`
    );
  }
}
