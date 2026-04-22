import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

export type UserAccount = {
  email: string;
  name: string;
  avatarUrl: string;
  updatedAt: number;
};

type StoredUserAccount = UserAccount & {
  passwordHash: string;
  createdAt: number;
};

type PendingRegistration = {
  email: string;
  name: string;
  passwordHash: string;
  createdAt: number;
};

const DEFAULT_AVATAR = '/default-avatar.png';

function normalizeEmail(email: string) {
  return email.toLowerCase().trim();
}

function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error('UPSTASH_REDIS_REST_URL dan UPSTASH_REDIS_REST_TOKEN wajib diisi untuk auth store.');
  }

  return { url, token };
}

async function redisCommand<T = unknown>(...command: Array<string | number>) {
  const config = getRedisConfig();

  const response = await fetch(`${config.url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([command]),
    cache: 'no-store',
  });

  if (!response.ok) {
    const reason = await response.text();
    throw new Error(`Redis command failed: ${response.status} ${reason}`);
  }

  const payload = (await response.json()) as Array<{ result: T }>;
  return payload[0]?.result ?? null;
}

function userKey(email: string) {
  return `user:${normalizeEmail(email)}`;
}

function pendingRegistrationKey(email: string) {
  return `pending-registration:${normalizeEmail(email)}`;
}

function hashPassword(rawPassword: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(rawPassword, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(rawPassword: string, storedPasswordHash: string) {
  const [scheme, salt, hash] = storedPasswordHash.split(':');
  if (scheme !== 'scrypt' || !salt || !hash) return false;

  const computed = scryptSync(rawPassword, salt, 64).toString('hex');
  return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computed, 'hex'));
}

async function getUserWithPassword(email: string): Promise<StoredUserAccount | null> {
  const raw = await redisCommand<string | null>('GET', userKey(email));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredUserAccount;
  } catch {
    return null;
  }
}

async function saveUser(user: StoredUserAccount) {
  await redisCommand('SET', userKey(user.email), JSON.stringify(user));
}

export async function stageRegistration(email: string, name: string, password: string) {
  const normalizedEmail = normalizeEmail(email);
  const now = Date.now();

  const pending: PendingRegistration = {
    email: normalizedEmail,
    name: name.trim(),
    passwordHash: hashPassword(password),
    createdAt: now,
  };

  await redisCommand('SET', pendingRegistrationKey(normalizedEmail), JSON.stringify(pending), 'EX', 60 * 60);
}

export async function finalizeRegistration(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const rawPending = await redisCommand<string | null>('GET', pendingRegistrationKey(normalizedEmail));

  if (!rawPending) return;

  const pending = JSON.parse(rawPending) as PendingRegistration;
  const existing = await getUserWithPassword(normalizedEmail);

  const user: StoredUserAccount = {
    email: normalizedEmail,
    name: pending.name,
    passwordHash: pending.passwordHash,
    avatarUrl: existing?.avatarUrl ?? DEFAULT_AVATAR,
    createdAt: existing?.createdAt ?? pending.createdAt,
    updatedAt: Date.now(),
  };

  await saveUser(user);
  await redisCommand('DEL', pendingRegistrationKey(normalizedEmail));
}

export async function verifyLoginPassword(email: string, password: string) {
  const normalizedEmail = normalizeEmail(email);
  console.log('LOGIN EMAIL:', normalizedEmail);

  const user = await getUserWithPassword(normalizedEmail);
  console.log('USER FOUND:', user ? { email: user.email, name: user.name } : null);

  if (!user) {
    return { success: false as const, message: 'Email tidak terdaftar' };
  }

  const isValid = verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return { success: false as const, message: 'Password salah' };
  }

  return { success: true as const, user };
}


export async function validateLoginPassword(email: string, password: string) {
  const result = await verifyLoginPassword(email, password);
  return result.success;
}

export async function getUserAccount(email: string): Promise<UserAccount> {
  const normalizedEmail = normalizeEmail(email);
  const account = await getUserWithPassword(normalizedEmail);

  if (account) {
    return {
      email: account.email,
      name: account.name,
      avatarUrl: account.avatarUrl || DEFAULT_AVATAR,
      updatedAt: account.updatedAt,
    };
  }

  return {
    email: normalizedEmail,
    name: normalizedEmail.split('@')[0] || 'Vynra User',
    avatarUrl: DEFAULT_AVATAR,
    updatedAt: Date.now(),
  };
}

export async function updateUserProfile(email: string, payload: { name: string; avatarUrl?: string }) {
  const normalizedEmail = normalizeEmail(email);
  const existing = await getUserWithPassword(normalizedEmail);

  const user: StoredUserAccount = {
    email: normalizedEmail,
    name: payload.name.trim() || existing?.name || normalizedEmail.split('@')[0] || 'Vynra User',
    avatarUrl: payload.avatarUrl?.trim() || existing?.avatarUrl || DEFAULT_AVATAR,
    passwordHash: existing?.passwordHash || hashPassword(randomBytes(24).toString('hex')),
    createdAt: existing?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  };

  await saveUser(user);

  return {
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    updatedAt: user.updatedAt,
  };
}

export async function changePassword(email: string, oldPassword: string, newPassword: string) {
  const normalizedEmail = normalizeEmail(email);
  const user = await getUserWithPassword(normalizedEmail);
  if (!user) return { success: false, message: 'Akun tidak ditemukan.' };

  if (!verifyPassword(oldPassword, user.passwordHash)) {
    return { success: false, message: 'Password lama tidak sesuai.' };
  }

  const updated: StoredUserAccount = {
    ...user,
    passwordHash: hashPassword(newPassword),
    updatedAt: Date.now(),
  };

  await saveUser(updated);

  return { success: true, message: 'Password berhasil diperbarui.' };
}

export async function setUserPassword(email: string, newPassword: string) {
  const normalizedEmail = normalizeEmail(email);
  const existing = await getUserWithPassword(normalizedEmail);

  const updated: StoredUserAccount = {
    email: normalizedEmail,
    name: existing?.name || normalizedEmail.split('@')[0] || 'Vynra User',
    avatarUrl: existing?.avatarUrl || DEFAULT_AVATAR,
    passwordHash: hashPassword(newPassword),
    createdAt: existing?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
  };

  await saveUser(updated);
}

export { DEFAULT_AVATAR, normalizeEmail };