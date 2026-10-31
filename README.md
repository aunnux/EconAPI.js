# EAPY Python wrapper

A synchronous, dependency-free Python client for every `/api/v1` economy endpoint in this project. Requires Python 3.8 or newer.

Install from the project root with `python -m pip install ./EAPY/py`, or add `EAPY/py` to `PYTHONPATH`.
`python -m pip install git+https://github.com/aunnux/EconAPI.js.git@py`

## Use

Add `EAPY/py` to `PYTHONPATH`, then import the client:

```python
import os
from econapipy import Client

client = Client(
    os.environ["API_TOKEN"],
    base_url="https://api.aunn.us/api/v1",
)

balance = client.get_user_balance("guild-id", "user-id")
print(balance)
```

Create a token in the dashboard and pass it to `Client`. The client sends the API token unchanged in the `Authorization` header; do not prepend `Bearer`. The server validates the key and project scope on every request.

`base_url` defaults to `http://localhost:3000/api/v1`. Requests made through one client instance are serialized. The client observes `X-RateLimit-Remaining` and `X-RateLimit-Reset`, waits before sending after the remaining request count reaches zero, and retries HTTP 429 responses up to `max_retries` times (default `3`) using the response's `retry_after` value. Other non-success responses raise `APIError`, with `status`, `body`, and response `headers` attributes.

## Methods

| Method | Endpoint operation |
| --- | --- |
| `get_guild(guild_id)` | Get guild metadata |
| `get_application_permission(guild_id)` | Get application permissions |
| `get_guild_leaderboard(guild_id, options=None)` | List leaderboard balances |
| `get_user_balance(guild_id, user_id)` | Get a balance |
| `edit_user_balance(guild_id, user_id, balance)` | Increment balance fields |
| `set_user_balance(guild_id, user_id, balance)` | Set balance fields |
| `get_items(guild_id, options=None)` | List store items |
| `create_item(guild_id, item)` | Create a store item |
| `get_item(guild_id, item_id)` | Get a store item |
| `edit_item(guild_id, item_id, data, cascade_update=None)` | Edit a store item |
| `delete_item(guild_id, item_id, cascade_update=None)` | Delete a store item |
| `get_inventory_items(guild_id, user_id, options=None)` | List inventory items |
| `add_inventory_item(guild_id, user_id, item_id, quantity=1, options=None)` | Add inventory quantity |
| `get_inventory_item(guild_id, user_id, item_id)` | Get an inventory item |
| `remove_inventory_item(guild_id, user_id, item_id, quantity=None)` | Remove quantity or the whole entry |
| `get_item_categories(guild_id)` | List categories |
| `create_item_category(guild_id, category)` | Create a category |
| `edit_item_category(guild_id, category_id, data)` | Edit a category |
| `delete_item_category(guild_id, category_id)` | Delete a category |

List `options` may contain `limit`, `page`, `sort`, and `query`; leaderboard options may also contain `offset`. Use snake_case API fields in item/category data and inventory `options` (`inventory_user_id` and `ignore_max_quantity`). `cascade_update=True` maps to the endpoints' `?boolean=true` option.

Run the wrapper tests from this directory with `python -m unittest discover -s tests`.
