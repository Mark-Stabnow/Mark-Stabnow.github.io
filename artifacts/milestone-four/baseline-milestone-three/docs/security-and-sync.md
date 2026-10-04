# Security and offline behavior

## Authentication and permissions

The original DBHelper uses a single unsalted SHA-256 password hash. The web implementation uses salted scrypt through Node's crypto module, with N=131072, r=8, p=1 and a 64-byte derived key. These settings follow the scrypt option in OWASP's Password Storage Cheat Sheet. Raw SHA-256 is used only to index a random session token, not to store a password.

A login creates a new random session token. The browser receives it in an HttpOnly, SameSite=Strict cookie. The database stores its digest, a CSRF token, an eight-hour expiry, and the user relationship. Logout deletes that session. The server checks the expected Origin and the session's CSRF token on writes. API responses use Cache-Control: no-store. The service worker does not cache API responses.

Each account locks for one minute after five failed password checks. A separate per-IP limiter restricts login requests. Rate-limit counters are in the single API process; they are not shared across multiple app instances. There is no distributed rate-limit claim here.

Managers can create, edit, archive, and adjust stock. Clerks can adjust stock. Viewers can read it. The API enforces these rules even when someone bypasses a hidden button. Accounts are seeded for the local demo; public registration and account administration are outside this milestone.

The application database role can append stock and audit records, but cannot update or delete them. The migration role has greater privileges and is kept out of the running app container. Database administrators can still change database contents. This is an application audit history, not a tamper-proof or cryptographically signed ledger.

## Offline queue rules

1. Save a stock command locally with one UUID before attempting to send it. Keep the user association, item, delta, and reason.
2. A command remains pending until the server explicitly accepts it. Network errors, session expiry, rate limits, and server errors pause retries without deleting it.
3. The server gets the acting user from the authenticated session. It rejects a mismatched replay payload and applies a repeated request only once.
4. A rejected command remains visible with an explanation. The user can remove it from the local queue. Removing it does not reverse stock that was already accepted on the server.
5. Concurrent changes lock the item row. A change that would make stock negative is rejected. Metadata edits also check the item version before saving.

The browser uses a named Web Lock to avoid sending the same local queue from two tabs at once when that API is available. Database idempotency remains the protection against duplicate writes, including when Web Locks are unavailable.

IndexedDB holds sample inventory and pending commands. It does not hold passwords, session cookies, or CSRF tokens. Its contents are not encrypted by this application and are not protected from someone who controls the browser profile. Use a trusted device. An offline cached view is a convenience, not proof of current authorization. It expires locally after eight hours from the current browser session's initialization or sign-in; the server's separate session expiry is checked before any writes are accepted.

Adding or editing items is online-only. Offline full-list search, background sync while the app is closed, and automatic conflict resolution are not included. A browser may evict local storage, so the offline queue is not a backup system. Do not use it for real stock until retention, device access, recovery, and production controls have been reviewed.

## Deployment limits

The default setup binds to localhost and permits an insecure cookie only for that local HTTP demo. A non-local APP_ORIGIN requires HTTPS and COOKIE_SECURE=true. Behind a known reverse proxy, configure TRUST_PROXY and TLS deliberately rather than copying the localhost settings. Live HTTPS deployment and physical-device installation still need a manual check.

The dependency audit and test logs describe one verification run. Passing them does not establish that the app is free of vulnerabilities. Production work would need account recovery, secret rotation, backup and restore checks, monitoring, shared rate limits if scaled, and a deployment-specific security review.

## References used for implementation

- OWASP, Password Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- Express, Production best practices: security: https://expressjs.com/en/advanced/best-practice-security.html
- MDN, Using service workers: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers

These references support the implementation choices. The original code and the project plan are the sources for the before-and-after comparison.
