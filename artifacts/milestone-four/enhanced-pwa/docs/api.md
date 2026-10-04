# API reference

All routes return JSON except successful logout and archive requests, which return 204. Errors use `{ "error": "A message the user can act on." }`. The base URL for the local demo is `http://localhost:4173`.

GET /api/health is public. POST /api/login accepts a JSON username and password and returns a public user object plus a CSRF token. It sets the session cookie. Every mutation requires an Origin header equal to APP_ORIGIN. After login, mutations also require X-CSRF-Token from that session. Browser requests include the HttpOnly cookie automatically.

| Method and route | Permission | Request or response |
| --- | --- | --- |
| GET /api/me | Signed in | user and csrf |
| POST /api/logout | Signed in + CSRF | Ends session; 204 |
| GET /api/items | Any role | q, filter=all/low/out/in, limit=1..100, optional after UUID; returns items and nextCursor |
| POST /api/items | Manager | name, sku, quantity, reorderLevel, category, location, notes |
| PATCH /api/items/:id | Manager | name, sku, reorderLevel, category, location, notes, version; no quantity field |
| POST /api/items/:id/archive | Manager | version; keeps history and returns 204 |
| POST /api/items/:id/adjustments | Manager or clerk | operationId UUID, delta nonzero integer, reason |
| GET /api/items/:id/history | Any role | Latest 50 stock events |

A stock response contains accepted, replayed, balanceAtCommit, and item. balanceAtCommit belongs to the accepted command; item is the current item state when the response is read. If a command is replayed later, those quantities may differ because other commands were accepted in between.

Use the same operationId when retrying an uncertain stock request. Use a new ID for a genuinely new stock action. An ID reused with different content returns 409. A stale item version also returns 409. A command that would make stock negative or exceed the upper bound is rejected without recording it.

There is no cross-origin public API, user-provided role field, arbitrary sort expression, or SQL text input. Search currently matches text within name, SKU, or location. Pages are ordered by item ID, not by a custom trie or priority queue.
