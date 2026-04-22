import { createHash, randomInt, timingSafeEqual } from 'crypto';

const OTP_TTL_MS = 15 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

type OtpRecord = {
  email: string;
  otpHash: string;
  expiresAt: number;
  createdAt: number;
  failedAttempts: number;
  lastSentAt: number;
};

const memoryOtpTable = new Map<string, OtpRecord>();

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashOtp(email: string, otp: string) {
  return createHash('sha256')
    .update(`${process.env.AUTH_OTP_SALT ?? 'otp-salt'}:${normalizeEmail(email)}:${otp}`)
    .digest('hex');
}

function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;
  return { url, token };
}

function otpRedisKey(email: string) {
  return `otp:${normalizeEmail(email)}`;
}

function resendRedisKey(email: string) {
  return `otp:last-send:${normalizeEmail(email)}`;
}

async function redisCommand<T = unknown>(...command: Array<string | number>) {
  const config = getRedisConfig();
  if (!config) return null;

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

export function generateOtpCode() {
  return String(randomInt(100000, 1000000));
}

export async function canSendOtp(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const now = Date.now();

  try {
    const lastSentValue = await redisCommand<string | null>('GET', resendRedisKey(normalizedEmail));

    if (lastSentValue) {
      const lastSentAt = Number(lastSentValue);
      const retryAfterMs = Math.max(0, OTP_RESEND_COOLDOWN_MS - (now - lastSentAt));
      if (retryAfterMs > 0) {
        return { allowed: false, retryAfterMs };
      }
    }
  } catch (error) {
    console.error('[OTP_RATE_LIMIT_REDIS_ERROR]', error);
  }

  const localRecord = memoryOtpTable.get(normalizedEmail);
  if (localRecord) {
    const retryAfterMs = Math.max(0, OTP_RESEND_COOLDOWN_MS - (now - localRecord.lastSentAt));
    if (retryAfterMs > 0) {
      return { allowed: false, retryAfterMs };
    }
  }

  return { allowed: true, retryAfterMs: 0 };
}

export async function saveOtp(email: string, otp: string) {
  const normalizedEmail = normalizeEmail(email);
  const createdAt = Date.now();
  const expiresAt = createdAt + OTP_TTL_MS;

  const record: OtpRecord = {
    email: normalizedEmail,
    otpHash: hashOtp(normalizedEmail, otp),
    createdAt,
    expiresAt,
    failedAttempts: 0,
    lastSentAt: createdAt,
  };

  memoryOtpTable.set(normalizedEmail, record);

  const config = getRedisConfig();
  if (config) {
    try {
      await redisCommand('SET', otpRedisKey(normalizedEmail), JSON.stringify(record), 'PX', OTP_TTL_MS);
      await redisCommand('SET', resendRedisKey(normalizedEmail), String(createdAt), 'PX', OTP_RESEND_COOLDOWN_MS);
    } catch (error) {
      console.error('[OTP_SAVE_REDIS_ERROR]', error);
    }
  }

  console.log('OTP saved:', normalizedEmail);
  return {
    email: normalizedEmail,
    expiresAt,
    createdAt,
  };
}

async function getOtpRecord(email: string) {
  const normalizedEmail = normalizeEmail(email);

  const config = getRedisConfig();
  if (config) {
    try {
      const raw = await redisCommand<string | null>('GET', otpRedisKey(normalizedEmail));
      if (!raw) return null;
      return JSON.parse(raw) as OtpRecord;
    } catch (error) {
      console.error('[OTP_GET_REDIS_ERROR]', error);
    }
  }

  return memoryOtpTable.get(normalizedEmail) ?? null;
}

async function persistOtpRecord(record: OtpRecord) {
  memoryOtpTable.set(record.email, record);

  const config = getRedisConfig();
  if (!config) return;

  const ttlMs = Math.max(1, record.expiresAt - Date.now());
  try {
    await redisCommand('SET', otpRedisKey(record.email), JSON.stringify(record), 'PX', ttlMs);
  } catch (error) {
    console.error('[OTP_PERSIST_REDIS_ERROR]', error);
  }
}

export async function removeOtp(email: string) {
  const normalizedEmail = normalizeEmail(email);
  memoryOtpTable.delete(normalizedEmail);

  const config = getRedisConfig();
  if (!config) return;

  try {
    await redisCommand('DEL', otpRedisKey(normalizedEmail));
  } catch (error) {
    console.error('[OTP_REMOVE_REDIS_ERROR]', error);
  }
}

export async function verifyOtp(email: string, inputOtp: string) {
  const normalizedEmail = normalizeEmail(email);
  const otpRecord = await getOtpRecord(normalizedEmail);

  if (!otpRecord) {
    return { success: false as const, status: 404, message: 'OTP tidak ditemukan' };
  }

  if (Date.now() > otpRecord.expiresAt) {
    await removeOtp(normalizedEmail);
    return { success: false as const, status: 400, message: 'OTP expired' };
  }

  const inputHash = hashOtp(normalizedEmail, inputOtp);
  const storedBuffer = Buffer.from(otpRecord.otpHash, 'hex');
  const inputBuffer = Buffer.from(inputHash, 'hex');

  if (!timingSafeEqual(storedBuffer, inputBuffer)) {
    otpRecord.failedAttempts += 1;

    if (otpRecord.failedAttempts >= MAX_VERIFY_ATTEMPTS) {
      await removeOtp(normalizedEmail);
      return {
        success: false as const,
        status: 429,
        message: 'Terlalu banyak percobaan. Silakan minta OTP baru.',
      };
    }

    await persistOtpRecord(otpRecord);
    return { success: false as const, status: 400, message: 'OTP salah' };
  }

  await removeOtp(normalizedEmail);
  console.log('OTP verify success:', normalizedEmail);

  return { success: true as const };
}