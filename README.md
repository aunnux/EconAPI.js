# EAPI Node.js wrapper

A dependency-free Node.js client for every `/api/v1` economy endpoint in this project. Requires Node.js 18 or newer.

## Install and use

The wrapper can be imported directly from this project:

```js
import { Client } from "./EAPI/index.js";

const client = new Client(process.env.API_TOKEN, {
  baseURL: "http://api.aunn.us/api/v1"
});

const balance = await client.getUserBalance("guild-id", "user-id");
console.log(balance);
```

Create an API token in the dashboard and pass it to the client. The client sends the token unchanged in the `Authorization` header; do not prepend `Bearer`. The server validates the key and project scope on every request.

`baseURL` defaults to `http://api.aunn.us/api/v1`. Requests through one client instance are serialized, and the client observes the server's `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers before sending the next request. HTTP 429 responses are retried up to `maxRetries` times (default `3`), waiting for the server-provided `retry_after` duration. Other non-success responses throw `APIError`, which includes `status`, `body`, and response `headers`.

## Methods

| Method | Endpoint operation |
| --- | --- |
| `getGuild(guildId)` | Get guild metadata |
| `getApplicationPermission(guildId)` | Get application permissions |
| `getGuildLeaderboard(guildId, options?)` | List leaderboard balances |
| `getUserBalance(guildId, userId)` | Get a balance |
| `editUserBalance(guildId, userId, balance)` | Increment balance fields |
| `setUserBalance(guildId, userId, balance)` | Set balance fields |
| `getItems(guildId, options?)` | List store items |
| `createItem(guildId, item)` | Create a store item |
| `getItem(guildId, itemId)` | Get a store item |
| `editItem(guildId, itemId, data, options?)` | Edit a store item |
| `deleteItem(guildId, itemId, options?)` | Delete a store item |
| `getInventoryItems(guildId, userId, options?)` | List inventory items |
| `addInventoryItem(guildId, userId, itemId, quantity?, options?)` | Add inventory quantity |
| `getInventoryItem(guildId, userId, itemId)` | Get an inventory item |
| `removeInventoryItem(guildId, userId, itemId, quantity?)` | Remove quantity or the whole entry |
| `getItemCategories(guildId)` | List categories |
| `createItemCategory(guildId, category)` | Create a category |
| `editItemCategory(guildId, categoryId, data)` | Edit a category |
| `deleteItemCategory(guildId, categoryId)` | Delete a category |

List methods accept `limit`, `page`, `sort`, and `query` as applicable. The leaderboard also accepts `offset`; `sort` may be a string or an array of sort fields.

Item and category payloads use the API's snake_case fields. `editItem` and `deleteItem` accept `{ cascadeUpdate: true }` to pass the API's `?boolean=true` option. `addInventoryItem` accepts `{ inventoryUserId, ignoreMaxQuantity }`, mapped to the API's `inventory_user_id` and `ignore_max_quantity` fields.
