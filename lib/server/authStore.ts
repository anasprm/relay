/**
 * Tiny server-side auth store for the Relay demo.
 *
 * The rest of the app is still an offline-first demo, so there is no database
 * driver in this repository yet. This module keeps the user records (including
 * password and password-reset state) in one place so registration, login and
 * password recovery all agree with each other.
 *
 * Records are persisted as JSON: `.data/auth-store.json` locally and
 * `/tmp/relay-auth-store.json` on Vercel. That makes the flow easy to test
 * without any external services. When a real database is added, only this file
 * needs to be replaced.
 */

import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface StoredUser {
  id: string;
  username: string;
  email: string | null;
  /** Extra identifiers that should resolve to this account (e.g. old demo emails). */
  aliases: string[];
  displayName: string;
  avatar: string | null;
  /** Format: `<salt>:<scrypt-hex>`. Demo accounts have no hash and accept any password. */
  passwordHash: string | null;
  resetTokenHash: string | null;
  resetTokenExpiresAt: number | null;
  createdAt: string;
  updatedAt: string;
}

interface StoreFile {
  users: StoredUser[];
}

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

const STORE_FILE = process.env.VERCEL
  ? join("/tmp", "relay-auth-store.json")
  : join(process.cwd(), ".data", "auth-store.json");

const DEFAULT_AVATAR =
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150";

const SEEDED_AT = "2026-01-01T00:00:00.000Z";

/**
 * Demo accounts. Alex intentionally points at the real address used during
 * development so a Resend test email can actually be delivered, while the old
 * `alex@relay.pro` identifier still works as an alias.
 */
const DEMO_USERS: StoredUser[] = [
  {
    id: "usr_alex",
    username: "alex",
    email: "anasprmatwork@gmail.com",
    aliases: ["alex@relay.pro", "mercer", "anasprmatwork"],
    displayName: "Alex Mercer",
    avatar: DEFAULT_AVATAR,
    passwordHash: null,
    resetTokenHash: null,
    resetTokenExpiresAt: null,
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
  },
  {
    id: "usr_demo",
    username: "demo",
    email: "demo@relay.pro",
    aliases: [],
    displayName: "Demo User",
    avatar: DEFAULT_AVATAR,
    passwordHash: null,
    resetTokenHash: null,
    resetTokenExpiresAt: null,
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
  },
  {
    id: "usr_sarah",
    username: "sarah",
    email: "sarah@relay.pro",
    aliases: [],
    displayName: "Sarah Chen",
    avatar: DEFAULT_AVATAR,
    passwordHash: null,
    resetTokenHash: null,
    resetTokenExpiresAt: null,
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
  },
  {
    id: "usr_marcus",
    username: "marcus",
    email: "marcus@relay.pro",
    aliases: [],
    displayName: "Marcus Reid",
    avatar: DEFAULT_AVATAR,
    passwordHash: null,
    resetTokenHash: null,
    resetTokenExpiresAt: null,
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
  },
  {
    id: "usr_alice",
    username: "alice",
    email: "alice@relay.pro",
    aliases: [],
    displayName: "Alice Morgan",
    avatar: DEFAULT_AVATAR,
    passwordHash: null,
    resetTokenHash: null,
    resetTokenExpiresAt: null,
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
  },
  {
    id: "usr_bob",
    username: "bob",
    email: "bob@relay.pro",
    aliases: [],
    displayName: "Bob Chen",
    avatar: DEFAULT_AVATAR,
    passwordHash: null,
    resetTokenHash: null,
    resetTokenExpiresAt: null,
    createdAt: SEEDED_AT,
    updatedAt: SEEDED_AT,
  },
];

const globalForAuth = globalThis as unknown as {
  __relayAuthStore?: StoreFile;
};

function normalizeUser(raw: Partial<StoredUser>): StoredUser {
  const now = new Date().toISOString();
  return {
    id: raw.id || `usr_${randomBytes(4).toString("hex")}`,
    username: raw.username || "user",
    email: raw.email ?? null,
    aliases: Array.isArray(raw.aliases) ? raw.aliases : [],
    displayName: raw.displayName || raw.username || "Relay User",
    avatar: raw.avatar ?? DEFAULT_AVATAR,
    passwordHash: raw.passwordHash ?? null,
    resetTokenHash: raw.resetTokenHash ?? null,
    resetTokenExpiresAt:
      typeof raw.resetTokenExpiresAt === "number"
        ? raw.resetTokenExpiresAt
        : null,
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now,
  };
}

function readStore(): StoreFile {
  try {
    if (!existsSync(STORE_FILE)) return { users: [] };

    const parsed = JSON.parse(readFileSync(STORE_FILE, "utf8")) as
      | Partial<StoreFile>
      | null;

    if (!parsed || !Array.isArray(parsed.users)) return { users: [] };
    return { users: parsed.users.map(normalizeUser) };
  } catch (error) {
    console.error("[auth-store] Could not read the user store", error);
    return { users: [] };
  }
}

function persist(store: StoreFile): void {
  try {
    mkdirSync(dirname(STORE_FILE), { recursive: true });
    writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
  } catch (error) {
    // A read-only filesystem must not break authentication in the demo.
    console.error("[auth-store] Could not persist the user store", error);
  }
}

function seedDemoUsers(store: StoreFile): void {
  for (const demo of DEMO_USERS) {
    const canonicalEmail = demo.email?.toLowerCase() ?? null;
    const demoIdentifiers = new Set(
      [canonicalEmail, ...(demo.aliases || []).map((alias) => alias.toLowerCase())].filter(
        (value): value is string => Boolean(value),
      ),
    );

    const existing = store.users.find(
      (user) =>
        user.id === demo.id ||
        user.username.toLowerCase() === demo.username.toLowerCase() ||
        user.email?.toLowerCase() === canonicalEmail,
    );

    if (!existing) {
      store.users.push({ ...demo, aliases: [...demo.aliases] });
      continue;
    }

    const aliases = new Set(
      (existing.aliases || []).map((alias) => alias.toLowerCase()),
    );
    for (const alias of demo.aliases) aliases.add(alias.toLowerCase());
    if (canonicalEmail) aliases.add(canonicalEmail);

    const existingEmail = existing.email?.toLowerCase() ?? null;
    const looksLikeSeededDemo =
      existing.id === demo.id ||
      (existingEmail ? demoIdentifiers.has(existingEmail) : false);

    // Older stores may have the demo account under a retired email. Keep that
    // address usable as an alias, but move the primary email to the current one
    // so password-reset emails reach the right inbox.
    if (
      looksLikeSeededDemo &&
      canonicalEmail &&
      existingEmail &&
      existingEmail !== canonicalEmail
    ) {
      aliases.add(existingEmail);
      existing.email = demo.email;
    } else if (!existing.email && demo.email) {
      existing.email = demo.email;
    }

    existing.aliases = [...aliases];
  }
}

function getStore(): StoreFile {
  if (!globalForAuth.__relayAuthStore) {
    const store = readStore();
    seedDemoUsers(store);
    globalForAuth.__relayAuthStore = store;
    persist(store);
  }
  return globalForAuth.__relayAuthStore;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${digest}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, digest] = stored.split(":");
  if (!salt || !digest) return false;

  try {
    const expected = Buffer.from(digest, "hex");
    const candidate = scryptSync(password, salt, expected.length);
    return (
      candidate.length === expected.length &&
      timingSafeEqual(candidate, expected)
    );
  } catch {
    return false;
  }
}

export function findUserByIdentifier(identifier: string): StoredUser | null {
  const value = identifier.trim().toLowerCase();
  if (!value) return null;

  return (
    getStore().users.find((user) => {
      if (user.username.toLowerCase() === value) return true;
      if (user.email?.toLowerCase() === value) return true;
      return user.aliases.some((alias) => alias.toLowerCase() === value);
    }) ?? null
  );
}

/**
 * Explicit lookup used by the login route. The name documents that the value
 * may be either a username or an email; the async signature leaves room for a
 * real database driver later without changing the route.
 */
export async function findUserByIdentifierOrEmail(
  identifier: string,
): Promise<StoredUser | null> {
  return findUserByIdentifier(identifier);
}

export function findUserById(id: string): StoredUser | null {
  return getStore().users.find((user) => user.id === id) ?? null;
}

export function findUserByEmail(email: string): StoredUser | null {
  const value = email.trim().toLowerCase();
  if (!value) return null;

  return (
    getStore().users.find(
      (user) =>
        user.email?.toLowerCase() === value ||
        user.aliases.some((alias) => alias.toLowerCase() === value),
    ) ?? null
  );
}

export interface CreateUserInput {
  username: string;
  email: string | null;
  displayName?: string;
  password: string;
}

export function createUser(input: CreateUserInput): StoredUser {
  const store = getStore();
  const now = new Date().toISOString();

  const user: StoredUser = {
    id: `usr_${randomBytes(5).toString("hex")}`,
    username: input.username,
    email: input.email?.toLowerCase() || null,
    aliases: [],
    displayName: input.displayName || input.username,
    avatar: DEFAULT_AVATAR,
    passwordHash: hashPassword(input.password),
    resetTokenHash: null,
    resetTokenExpiresAt: null,
    createdAt: now,
    updatedAt: now,
  };

  store.users.push(user);
  persist(store);
  return user;
}

export function issuePasswordResetToken(
  userId: string,
): { token: string; expiresAt: number } | null {
  const user = findUserById(userId);
  if (!user) return null;

  const token = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + RESET_TOKEN_TTL_MS;

  user.resetTokenHash = sha256(token);
  user.resetTokenExpiresAt = expiresAt;
  user.updatedAt = new Date().toISOString();

  persist(getStore());
  return { token, expiresAt };
}

/**
 * Validates a one-time reset token and writes the new password. Returns the
 * updated user, or null when the token is unknown, already used, or expired.
 */
export function consumePasswordResetToken(
  token: string,
  newPassword: string,
): StoredUser | null {
  const hash = sha256(token);
  const store = getStore();

  const user = store.users.find(
    (candidate) =>
      candidate.resetTokenHash === hash &&
      (candidate.resetTokenExpiresAt ?? 0) > Date.now(),
  );

  if (!user) return null;

  user.passwordHash = hashPassword(newPassword);
  user.resetTokenHash = null;
  user.resetTokenExpiresAt = null;
  user.updatedAt = new Date().toISOString();

  persist(store);
  return user;
}

export function createSessionToken(user: StoredUser): string {
  const payload = `${user.id}:${user.email || user.username}:${user.displayName}`;
  return Buffer.from(payload, "utf8").toString("base64");
}

export function parseSessionToken(token: string): {
  userId: string;
  email: string | null;
  displayName: string | null;
} | null {
  try {
    const [userId, email, displayName] = Buffer.from(token, "base64")
      .toString("utf8")
      .split(":");

    if (!userId) return null;
    return {
      userId,
      email: email || null,
      displayName: displayName || null,
    };
  } catch {
    return null;
  }
}

export function toApiUser(user: StoredUser) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    fullName: user.displayName,
    email: user.email,
    avatar: user.avatar,
    avatarUrl: user.avatar,
    accent: "cyan" as const,
    status: "online",
    online: true,
    lastSeen: null as string | null,
    discoverable: true,
  };
}
