import { AppError } from './errors.mjs';

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const bad = message => { throw new AppError(400, message); };
function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) bad('Send a JSON object.');
  return value;
}
function text(value, name, max, required = true) {
  if (typeof value !== 'string') bad(`${name} must be text.`);
  const clean = value.trim();
  if ((required && !clean) || clean.length > max) bad(`${name} must be ${required ? '1' : '0'} to ${max} characters.`);
  return clean;
}
function integer(value, name, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) bad(`${name} must be a whole number from ${min} to ${max}.`);
  return value;
}
export function uuid(value) {
  if (typeof value !== 'string' || !UUID.test(value)) bad('The record ID is not valid.');
  return value.toLowerCase();
}
export function credentials(input) {
  const b = object(input);
  const username = text(b.username, 'Username', 64).toLowerCase();
  if (!/^[a-z0-9._-]+$/.test(username)) bad('Use letters, numbers, dots, underscores, or hyphens for the username.');
  // Do not trim a password; spaces may be part of it.
  if (typeof b.password !== 'string' || b.password.length < 12 || b.password.length > 128) bad('Password must be 12 to 128 characters.');
  return { username, password: b.password };
}
export function itemInput(input, editing = false) {
  const b = object(input);
  const sku = text(b.sku, 'SKU', 64).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(sku)) bad('SKU can contain letters, numbers, dots, underscores, and hyphens.');
  const result = {
    name: text(b.name, 'Item name', 120), sku,
    location: text(b.location, 'Location', 80), category: text(b.category, 'Category', 80),
    notes: text(b.notes ?? '', 'Notes', 1000, false),
    reorderLevel: integer(b.reorderLevel, 'Reorder level', 0, 1000000000)
  };
  if (editing) {
    if ('quantity' in b) bad('Use a stock adjustment to change quantity.');
    result.version = integer(b.version, 'Version', 1, 2147483647);
  } else result.quantity = integer(b.quantity, 'Quantity', 0, 1000000000);
  return result;
}
export function adjustment(input) {
  const b = object(input);
  const delta = integer(b.delta, 'Quantity change', -1000000, 1000000);
  if (!delta) bad('Enter a quantity change other than zero.');
  return { operationId: uuid(b.operationId), delta, reason: text(b.reason, 'Reason', 200) };
}
export function listInput(query) {
  const q = text(query.q ?? '', 'Search', 100, false);
  const filter = query.filter ?? 'all';
  if (!['all', 'low', 'out', 'in'].includes(filter)) bad('Choose a valid stock filter.');
  const raw = query.limit ?? '25';
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) bad('Page size must be a whole number.');
  const limit = integer(Number(raw), 'Page size', 1, 100);
  return { q, filter, limit, after: query.after ? uuid(query.after) : null };
}
