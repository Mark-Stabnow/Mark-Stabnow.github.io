import { randomBytes } from 'node:crypto';
import { existsSync,writeFileSync } from 'node:fs';
if (existsSync('.env')) { console.log('.env already exists. Kept your settings.'); process.exit(0); }
const password=()=>randomBytes(18).toString('base64url');
const owner=password(),app=password();
const values={OWNER_DB_PASSWORD:owner,APP_DB_PASSWORD:app,
  OWNER_DATABASE_URL:`postgresql://warehouse_owner:${owner}@localhost:5432/warehouse`,
  DATABASE_URL:`postgresql://warehouse_app:${app}@localhost:5432/warehouse`,
  APP_ORIGIN:'http://localhost:4173',PORT:'4173',HOST:'127.0.0.1',COOKIE_SECURE:'false',TRUST_PROXY:'false',
  DEMO_MANAGER_PASSWORD:password(),DEMO_CLERK_PASSWORD:password(),DEMO_VIEWER_PASSWORD:password()};
writeFileSync('.env',Object.entries(values).map(([k,v])=>`${k}=${v}`).join('\n')+'\n',{mode:0o600});
console.log('Created .env with local database passwords and three demo passwords. Keep that file private.');
console.log('The demo usernames are manager, clerk, and viewer. Their passwords are in .env.');
