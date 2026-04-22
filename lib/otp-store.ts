const OTP_TTL_MS = 15 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const MAX_SEND_PER_WINDOW = 3;

export type OtpRecord = {
  email: string;
  code: string;
  expiresAt: number;
};

type SendLog = {
  timestamps: number[];
};

const otpStore = new Map<string, OtpRecord>();
const sendLogs = new Map<string, SendLog>();

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function upsertOtp(email: string, code: string): OtpRecord {
  const normalizedEmail = normalizeEmail(email);
  const expiresAt = Date.now() + OTP_TTL_MS;
  const payload: OtpRecord = {
    email: normalizedEmail,
    code,
    expiresAt,
  };

  otpStore.set(normalizedEmail, payload);
  return payload;
}

export function getOtpByEmail(email: string): OtpRecord | null {
  const normalizedEmail = normalizeEmail(email);
  const record = otpStore.get(normalizedEmail) ?? null;

  if (!record) return null;

  if (record.expiresAt < Date.now()) {
    otpStore.delete(normalizedEmail);
    return null;
  }

  return record;
}

export function removeOtp(email: string): void {
  otpStore.delete(normalizeEmail(email));
}

export function canSendOtp(email: string): {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
} {
  const normalizedEmail = normalizeEmail(email);
  const now = Date.now();
  const log = sendLogs.get(normalizedEmail) ?? { timestamps: [] };

  log.timestamps = log.timestamps.filter(
    (timestamp) => now - timestamp <= RATE_LIMIT_WINDOW_MS,
  );

  if (log.timestamps.length >= MAX_SEND_PER_WINDOW) {
    const oldest = log.timestamps[0];
    const retryAfterMs = Math.max(0, RATE_LIMIT_WINDOW_MS - (now - oldest));
    sendLogs.set(normalizedEmail, log);

    return {
      allowed: false,
      remaining: 0,
      retryAfterMs,
    };
  }

  return {
    allowed: true,
    remaining: MAX_SEND_PER_WINDOW - log.timestamps.length,
    retryAfterMs: 0,
  };
}

export function markOtpSent(email: string): void {
  const normalizedEmail = normalizeEmail(email);
  const now = Date.now();
  const log = sendLogs.get(normalizedEmail) ?? { timestamps: [] };

  log.timestamps = log.timestamps.filter(
    (timestamp) => now - timestamp <= RATE_LIMIT_WINDOW_MS,
  );
  log.timestamps.push(now);

  sendLogs.set(normalizedEmail, log);
}