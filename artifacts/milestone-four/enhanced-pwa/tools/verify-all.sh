#!/usr/bin/env bash
set -euo pipefail
cd /app
mkdir -p /evidence
# Start pessimistic: a failed command must not leave an old PASS result behind.
node -e "require('fs').writeFileSync('/evidence/RUN_STATUS.json',JSON.stringify({status:'IN_PROGRESS',startedAt:new Date().toISOString()},null,2)+'\n')"
server_pid=''
finish() {
  code=$?
  if [[ -n "$server_pid" ]]; then kill "$server_pid" 2>/dev/null || true; fi
  if [[ "$code" -ne 0 ]]; then
    STATUS_CODE="$code" node -e "require('fs').writeFileSync('/evidence/RUN_STATUS.json',JSON.stringify({status:'FAILED',exitCode:Number(process.env.STATUS_CODE),finishedAt:new Date().toISOString()},null,2)+'\n')"
  fi
}
trap finish EXIT
runcheck() { local name="$1"; shift; "$@" 2>&1 | tee "/evidence/${name}.log"; }
runcheck environment bash -c 'node --version; npm --version; python3 --version; pg_dump --version'
runcheck migrate npm run migrate
runcheck seed npm run seed
runcheck test-db-setup node tools/create-test-databases.mjs
runcheck build npm run build
runcheck unit-api npm test
runcheck algorithms npm run test:algorithms
runcheck import-unit npm run test:import
runcheck sqlite-export python3 -m unittest discover -s tests -p 'test_export_android.py' -v
runcheck postgres-regression npm run test:db
runcheck postgres-m4 npm run test:db:m4
runcheck upgrade npm run test:upgrade
# Query fixture and recovery remain separate from the small demo/browser database.
OWNER_DATABASE_URL="$QUERY_OWNER_DATABASE_URL" runcheck query-migrate npm run migrate
runcheck query-evaluation npm run evaluate:db
runcheck backup-restore npm run test:recovery
runcheck reconciliation npm run db:report
runcheck algorithms-benchmark npm run benchmark
mkdir -p /evidence/algorithm-benchmark
cp benchmark-results/* /evidence/algorithm-benchmark/
node server/index.mjs > /evidence/server.log 2>&1 &
server_pid=$!
node --input-type=module -e 'let ok=false;for(let i=0;i<60;i++){try{if((await fetch("http://localhost:4173/api/health")).ok){ok=true;break;}}catch{}await new Promise(r=>setTimeout(r,1000));}if(!ok)process.exit(1);'
runcheck browser npm run test:e2e
cp -r test-results /evidence/browser-results
node -e "require('fs').writeFileSync('/evidence/RUN_STATUS.json',JSON.stringify({status:'PASSED',finishedAt:new Date().toISOString(),scope:'Build, unit/API, algorithms, import, real SQLite, PostgreSQL, upgrade, query evaluation, recovery, and Chromium; no physical-device or production claim.'},null,2)+'\n')"
echo 'All verification stages passed. See verification-results/RUN_STATUS.json and the individual logs.'
