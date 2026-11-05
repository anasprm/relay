/**
 * Creates accounts directly in the configured database.
 *
 *   node server/scripts/create-accounts.mjs --scope private \
 *     --accounts "anas:anas,asim:asim"
 *
 * Existing usernames in the same workspace are skipped, never overwritten,
 * unless --update is passed, which refreshes the password hash only.
 */
import crypto from 'node:crypto';

import { hashPassword } from '../src/auth.js';
import { getFirestoreDb } from '../src/firebase.js';
import { seedDatabase } from '../src/seed.js';

const args = process.argv.slice(2);
const scopeIndex = args.indexOf('--scope');
const accountsIndex = args.indexOf('--accounts');
const scope = scopeIndex >= 0 ? args[scopeIndex + 1] : 'private';
const raw = accountsIndex >= 0 ? args[accountsIndex + 1] : '';
const updateExisting = args.includes('--update');

if (!['private', 'public'].includes(scope)) {
  console.error('--scope must be private or public');
  process.exit(1);
}

const entries = raw
  .split(',')
  .map((pair) => pair.trim())
  .filter(Boolean)
  .map((pair) => {
    const [username, password] = pair.split(':');
    return { username: String(username || '').trim().toLowerCase(), password: String(password || '') };
  });

if (entries.length === 0) {
  console.error('Pass --accounts "username:password,..."');
  process.exit(1);
}

const accents = ['indigo', 'violet', 'emerald', 'amber', 'rose', 'cyan'];
const titleCase = (value) => value.charAt(0).toUpperCase() + value.slice(1);

const firestore = getFirestoreDb();
const existingUsers = firestore
  ? (await firestore.collection('users').get()).docs.map((doc) => ({ id: doc.id, ...doc.data() }))
  : seedDatabase().users;

const taken = new Set(
  existingUsers
    .filter((user) => (user.scope || 'public') === scope)
    .map((user) => String(user.username).toLowerCase()),
);

const created = [];
for (const [index, entry] of entries.entries()) {
  if (!/^[a-z0-9_]{3,20}$/.test(entry.username)) {
    console.error(`skip ${entry.username}: invalid username`);
    continue;
  }
  if (taken.has(entry.username)) {
    if (!updateExisting) {
      console.log(`skip ${entry.username}: already exists in ${scope}`);
      continue;
    }
    const existing = existingUsers.find(
      (user) =>
        String(user.username).toLowerCase() === entry.username &&
        (user.scope || 'public') === scope,
    );
    if (!existing) {
      console.log(`skip ${entry.username}: could not find the existing record`);
      continue;
    }
    if (firestore) {
      await firestore
        .collection('users')
        .doc(existing.id)
        .set({ passwordHash: hashPassword(entry.password) }, { merge: true });
    }
    created.push({ ...existing, passwordHash: 'updated' });
    console.log(`updated password for ${entry.username} (${scope})`);
    continue;
  }

  const now = new Date().toISOString();
  const user = {
    id: crypto.randomUUID(),
    username: entry.username,
    displayName: titleCase(entry.username),
    accent: accents[(existingUsers.length + index) % accents.length],
    passwordHash: hashPassword(entry.password),
    scope,
    discoverable: true,
    createdAt: now,
    lastSeen: now,
  };

  if (firestore) {
    await firestore.collection('users').doc(user.id).set(user, { merge: true });
  }
  created.push(user);
  taken.add(entry.username);
  console.log(`created ${user.username} (${scope})`);
}

console.log(
  `done: ${created.length} account(s) created or updated, ${entries.length - created.length} skipped`,
);
process.exit(0);
