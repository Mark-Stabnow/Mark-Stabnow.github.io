// Every destructive or fixture-writing helper must use an explicitly disposable DB.
export function testDatabase(value,label='Database URL') {
  if(process.env.ALLOW_TEST_DB!=='yes')throw new Error('Set ALLOW_TEST_DB=yes for disposable test databases only.');
  if(!value)throw new Error(`${label} is required.`);
  const url=new URL(value);
  if(!['postgres:','postgresql:'].includes(url.protocol) || !/^[a-z_][a-z0-9_]*_test$/.test(url.pathname.slice(1)))
    throw new Error(`${label} must name a lowercase database ending in _test.`);
  return url;
}
export function pgEnvironment(url) {
  return {...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',
    PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),
    PGDATABASE:decodeURIComponent(url.pathname.slice(1)),PGCONNECT_TIMEOUT:'10'};
}
export function databaseIdentity(url) {return `${url.hostname}:${url.port||'5432'}${url.pathname}`;}
