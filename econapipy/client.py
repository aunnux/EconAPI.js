import json
import threading
import time
from urllib.error import HTTPError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen


DEFAULT_BASE_URL = "http://localhost:3000/api/v1"
DEFAULT_MAX_RETRIES = 3


class APIError(Exception):
    def __init__(self, message, status, body, headers):
        super().__init__(message)
        self.status = status
        self.body = body
        self.headers = headers


def _path(value, name):
    if not isinstance(value, str) or not value:
        raise ValueError("{} must be a non-empty string".format(name))
    return quote(value, safe="")


def _query(options):
    if not options:
        return ""
    values = []
    for key, value in options.items():
        if value is None:
            continue
        if isinstance(value, (list, tuple)):
            value = ",".join(str(item) for item in value)
        elif isinstance(value, bool):
            value = str(value).lower()
        else:
            value = str(value)
        values.append((key, value))
    encoded = urlencode(values)
    return "?{}".format(encoded) if encoded else ""


def _reset_time(value):
    try:
        timestamp = float(value)
    except (TypeError, ValueError):
        return None
    return timestamp / 1000 if timestamp > 100000000000 else timestamp


def _decode_body(raw, headers):
    if not raw:
        return None
    charset = headers.get_content_charset() if headers else None
    text = raw.decode(charset or "utf-8", errors="replace")
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return text


class Client:
    """Synchronous client for every economy endpoint exposed by this project."""

    def __init__(self, token, base_url=DEFAULT_BASE_URL, max_retries=DEFAULT_MAX_RETRIES, timeout=30):
        if not isinstance(token, str) or not token:
            raise ValueError("An API token is required")
        if not isinstance(base_url, str) or not base_url:
            raise ValueError("base_url must be a non-empty URL")
        if not isinstance(max_retries, int) or isinstance(max_retries, bool) or max_retries < 0:
            raise ValueError("max_retries must be a non-negative integer")
        if not isinstance(timeout, (int, float)) or isinstance(timeout, bool) or timeout <= 0:
            raise ValueError("timeout must be a positive number")

        self.token = token
        self.base_url = base_url.rstrip("/")
        self.max_retries = max_retries
        self.timeout = timeout
        self._request_lock = threading.Lock()
        self._remaining = None
        self._reset_at = None

    def _request(self, method, endpoint, data=None):
        with self._request_lock:
            for attempt in range(self.max_retries + 1):
                if self._remaining == 0 and self._reset_at is not None:
                    wait = self._reset_at - time.time()
                    if wait > 0:
                        time.sleep(wait)
                    if time.time() >= self._reset_at:
                        self._remaining = None

                headers = {
                    "Accept": "application/json",
                    "Authorization": self.token,
                }
                body = None
                if data is not None:
                    headers["Content-Type"] = "application/json"
                    body = json.dumps(data).encode("utf-8")

                request = Request(
                    self.base_url + endpoint,
                    data=body,
                    headers=headers,
                    method=method,
                )
                try:
                    response = urlopen(request, timeout=self.timeout)
                except HTTPError as error:
                    response = error

                with response:
                    status = response.code
                    response_headers = response.headers
                    raw = response.read()
                parsed_body = _decode_body(raw, response_headers)

                remaining = response_headers.get("X-RateLimit-Remaining")
                if remaining is not None:
                    try:
                        self._remaining = int(remaining)
                    except ValueError:
                        self._remaining = None
                reset = _reset_time(response_headers.get("X-RateLimit-Reset"))
                if reset is not None:
                    self._reset_at = reset

                if status == 429 and attempt < self.max_retries:
                    retry_after = parsed_body.get("retry_after") if isinstance(parsed_body, dict) else None
                    try:
                        wait = max(0, float(retry_after) / 1000)
                    except (TypeError, ValueError):
                        wait = max(0, self._reset_at - time.time()) if self._reset_at is not None else attempt + 1
                    self._remaining = 0
                    self._reset_at = time.time() + wait
                    time.sleep(wait)
                    continue

                if status < 200 or status >= 300:
                    message = (
                        parsed_body.get("message")
                        if isinstance(parsed_body, dict) and isinstance(parsed_body.get("message"), str)
                        else "API request failed with status {}".format(status)
                    )
                    raise APIError(message, status, parsed_body, dict(response_headers.items()))
                return parsed_body

        raise RuntimeError("API request retry loop exited unexpectedly")

    def get_guild(self, guild_id):
        return self._request("GET", "/guilds/{}".format(_path(guild_id, "guild_id")))

    def get_application_permission(self, guild_id):
        return self._request(
            "GET",
            "/applications/@me/guilds/{}".format(_path(guild_id, "guild_id")),
        )

    def get_guild_leaderboard(self, guild_id, options=None):
        return self._request(
            "GET",
            "/guilds/{}/users{}".format(_path(guild_id, "guild_id"), _query(options)),
        )

    def get_user_balance(self, guild_id, user_id):
        return self._request(
            "GET",
            "/guilds/{}/users/{}".format(
                _path(guild_id, "guild_id"),
                _path(user_id, "user_id"),
            ),
        )

    def edit_user_balance(self, guild_id, user_id, balance):
        return self._request(
            "PATCH",
            "/guilds/{}/users/{}".format(
                _path(guild_id, "guild_id"),
                _path(user_id, "user_id"),
            ),
            balance,
        )

    def set_user_balance(self, guild_id, user_id, balance):
        return self._request(
            "PUT",
            "/guilds/{}/users/{}".format(
                _path(guild_id, "guild_id"),
                _path(user_id, "user_id"),
            ),
            balance,
        )

    def get_items(self, guild_id, options=None):
        return self._request(
            "GET",
            "/guilds/{}/items{}".format(_path(guild_id, "guild_id"), _query(options)),
        )

    def create_item(self, guild_id, item):
        return self._request("POST", "/guilds/{}/items".format(_path(guild_id, "guild_id")), item)

    def get_item(self, guild_id, item_id):
        return self._request(
            "GET",
            "/guilds/{}/items/{}".format(
                _path(guild_id, "guild_id"),
                _path(item_id, "item_id"),
            ),
        )

    def edit_item(self, guild_id, item_id, data, cascade_update=None):
        query = _query({"boolean": cascade_update}) if cascade_update is not None else ""
        return self._request(
            "PATCH",
            "/guilds/{}/items/{}{}".format(
                _path(guild_id, "guild_id"),
                _path(item_id, "item_id"),
                query,
            ),
            data,
        )

    def delete_item(self, guild_id, item_id, cascade_update=None):
        query = _query({"boolean": cascade_update}) if cascade_update is not None else ""
        return self._request(
            "DELETE",
            "/guilds/{}/items/{}{}".format(
                _path(guild_id, "guild_id"),
                _path(item_id, "item_id"),
                query,
            ),
        )

    def get_inventory_items(self, guild_id, user_id, options=None):
        return self._request(
            "GET",
            "/guilds/{}/users/{}/inventory{}".format(
                _path(guild_id, "guild_id"),
                _path(user_id, "user_id"),
                _query(options),
            ),
        )

    def add_inventory_item(self, guild_id, user_id, item_id, quantity=1, options=None):
        options = options or {}
        body_options = {}
        if "inventory_user_id" in options:
            body_options["inventory_user_id"] = options["inventory_user_id"]
        if "ignore_max_quantity" in options:
            body_options["ignore_max_quantity"] = options["ignore_max_quantity"]
        return self._request(
            "POST",
            "/guilds/{}/users/{}/inventory".format(
                _path(guild_id, "guild_id"),
                _path(user_id, "user_id"),
            ),
            {
                "item_id": item_id,
                "quantity": quantity,
                "options": body_options,
            },
        )

    def get_inventory_item(self, guild_id, user_id, item_id):
        return self._request(
            "GET",
            "/guilds/{}/users/{}/inventory/{}".format(
                _path(guild_id, "guild_id"),
                _path(user_id, "user_id"),
                _path(item_id, "item_id"),
            ),
        )

    def remove_inventory_item(self, guild_id, user_id, item_id, quantity=None):
        query = _query({"integer": quantity}) if quantity is not None else ""
        return self._request(
            "DELETE",
            "/guilds/{}/users/{}/inventory/{}{}".format(
                _path(guild_id, "guild_id"),
                _path(user_id, "user_id"),
                _path(item_id, "item_id"),
                query,
            ),
        )

    def get_item_categories(self, guild_id):
        return self._request("GET", "/guilds/{}/item-categories".format(_path(guild_id, "guild_id")))

    def create_item_category(self, guild_id, category):
        return self._request(
            "POST",
            "/guilds/{}/item-categories".format(_path(guild_id, "guild_id")),
            category,
        )

    def edit_item_category(self, guild_id, category_id, data):
        return self._request(
            "PATCH",
            "/guilds/{}/item-categories/{}".format(
                _path(guild_id, "guild_id"),
                _path(category_id, "category_id"),
            ),
            data,
        )

    def delete_item_category(self, guild_id, category_id):
        return self._request(
            "DELETE",
            "/guilds/{}/item-categories/{}".format(
                _path(guild_id, "guild_id"),
                _path(category_id, "category_id"),
            ),
        )
