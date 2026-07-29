import { uuid } from './id';

/**
 * Built-in fake-data generators, exposed as `{{$name}}` dynamic variables —
 * resolved by `resolveString` (variables.ts) at the same point real
 * `{{env_var}}` values are, so they work in every field that already
 * supports variables (URL, params, headers, body, auth) with no separate
 * insertion mechanism to build or maintain.
 *
 * Named after Postman's own dynamic variables (`$guid`, `$randomEmail`, …)
 * on purpose: the `$` prefix is what makes these safe to add without ever
 * shadowing a real environment variable (resolveString only falls back to
 * a generator when no matching real variable exists), and reusing
 * Postman's exact names means anyone coming from Postman already knows
 * them — ApiTab's script sandbox already mirrors Postman's `pm.*` API for
 * the same reason.
 */

const FIRST_NAMES = [
  'James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda',
  'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Charles', 'Karen', 'Priya', 'Wei', 'Fatima', 'Hiroshi',
];
const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Patel', 'Kim', 'Chen',
];
const COMPANY_SUFFIXES = ['Inc', 'LLC', 'Group', 'Labs', 'Partners', 'Solutions', 'Studio', 'Co'];
const COMPANY_WORDS = [
  'Acme', 'Globex', 'Initech', 'Umbrella', 'Stark', 'Wayne', 'Hooli', 'Vertex',
  'Nimbus', 'Quantum', 'Pioneer', 'Silverline', 'Bluepeak', 'Ironforge', 'Northwind',
];
const STREET_NAMES = ['Main', 'Oak', 'Maple', 'Cedar', 'Pine', 'Elm', 'Washington', 'Lake', 'Hill', 'Park'];
const STREET_TYPES = ['St', 'Ave', 'Blvd', 'Rd', 'Ln', 'Dr', 'Way'];
const CITIES = ['Springfield', 'Riverside', 'Franklin', 'Clinton', 'Georgetown', 'Salem', 'Fairview', 'Madison'];
const DOMAINS = ['example.com', 'mail.com', 'test.dev', 'inbox.io'];
const TLDS = ['.com', '.io', '.dev', '.co', '.net'];
const LOREM_WORDS = [
  'lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit',
  'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'dolore',
  'magna', 'aliqua', 'enim', 'minim', 'veniam', 'quis', 'nostrud', 'exercitation',
];

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}
function digits(n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

function randomFullName(): string {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}
function randomEmail(): string {
  const name = `${pick(FIRST_NAMES)}.${pick(LAST_NAMES)}`.toLowerCase();
  return `${name}${Math.floor(Math.random() * 100)}@${pick(DOMAINS)}`;
}
function randomPhoneNumber(): string {
  return `+1-${digits(3)}-${digits(3)}-${digits(4)}`;
}
function randomPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let out = '';
  for (let i = 0; i < 14; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
function randomCompanyName(): string {
  return `${pick(COMPANY_WORDS)} ${pick(COMPANY_SUFFIXES)}`;
}
function randomStreetAddress(): string {
  return `${100 + Math.floor(Math.random() * 9899)} ${pick(STREET_NAMES)} ${pick(STREET_TYPES)}, ${pick(CITIES)}`;
}
function randomUrl(): string {
  const word = pick(COMPANY_WORDS).toLowerCase();
  return `https://${word}${pick(TLDS)}`;
}
function isoTimestamp(): string {
  return new Date().toISOString();
}
function randomDateTime(): string {
  // A plausible date within the last 2 years, for fields that want "some
  // date" rather than specifically "right now" (that's $isoTimestamp).
  const now = Date.now();
  const past = now - Math.floor(Math.random() * 2 * 365 * 24 * 60 * 60 * 1000);
  return new Date(past).toISOString();
}
function randomInt(): string {
  return String(Math.floor(Math.random() * 1000));
}
function randomFloat(): string {
  return (Math.random() * 1000).toFixed(2);
}
function randomBoolean(): string {
  return Math.random() < 0.5 ? 'true' : 'false';
}
function randomLoremSentence(): string {
  const len = 6 + Math.floor(Math.random() * 6);
  const words = Array.from({ length: len }, () => pick(LOREM_WORDS));
  const sentence = words.join(' ');
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.';
}
/**
 * A Luhn-valid number in Visa's well-known 4111-prefixed test range — the
 * same "fake but shape-correct" test card numbers payment processors
 * themselves publish for sandbox testing, never a real card.
 */
function randomCreditCardNumber(): string {
  const prefix = '411111';
  const middle = digits(9);
  const partial = prefix + middle;
  let sum = 0;
  for (let i = 0; i < partial.length; i++) {
    let d = Number(partial[partial.length - 1 - i]);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  const check = (10 - (sum % 10)) % 10;
  const full = partial + check;
  return full.match(/.{1,4}/g)!.join(' ');
}

/** `{{$name}}` → generator. Each call produces a fresh value. */
export const DYNAMIC_VARIABLES: Record<string, () => string> = {
  guid: uuid,
  randomUUID: uuid,
  randomFullName,
  randomEmail,
  randomPhoneNumber,
  randomPassword,
  randomCompanyName,
  randomStreetAddress,
  randomUrl,
  isoTimestamp,
  randomDateTime,
  randomInt,
  randomFloat,
  randomBoolean,
  randomLoremSentence,
  randomCreditCardNumber,
};

/** Autocomplete-ready `$name` list (without the surrounding `{{ }}`). */
export const DYNAMIC_VARIABLE_NAMES: string[] = Object.keys(DYNAMIC_VARIABLES).map((k) => `$${k}`);

export function isDynamicVariable(name: string): boolean {
  return name.startsWith('$') && Object.prototype.hasOwnProperty.call(DYNAMIC_VARIABLES, name.slice(1));
}

/** Generates a fresh value for a `$name` dynamic variable, or `undefined` if unknown. */
export function generateDynamicValue(name: string): string | undefined {
  if (!name.startsWith('$')) return undefined;
  return DYNAMIC_VARIABLES[name.slice(1)]?.();
}
