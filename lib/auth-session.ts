import { createHmac, timingSafeEqual } from 'crypto';

import { AUTH_COOKIE_NAME } from '@/lib/auth-constants';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FALLBACK_SECRET = 'dev-only-secret-change-me';

type SessionRecord = {
  email: string;
  authenticated: true;
  expiresAt: number;
};

const sessionTable = new Map<string, SessionRecord>();
type SessionPayload = {
  email: string;
  authenticated: true;
  expiresAt: number;
};

function getSessionSecret() {
  return process.env.AUTH_SESSION_SECRET || process.env.NEXTAUTH_SECRET || FALLBACK_SECRET;
}

function sign(payloadBase64: string) {
  return createHmac('sha256', getSessionSecret()).update(payloadBase64).digest('base64url');
}

function encode(payload: SessionPayload) {
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign(payloadBase64);
  return `${payloadBase64}.${signature}`;
}

function decode(token: string) {
  const [payloadBase64, signature] = token.split('.');

  if (!payloadBase64 || !signature) return null;

  const expectedSignature = sign(payloadBase64);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) return null;

  const safeMatch = timingSafeEqual(signatureBuffer, expectedBuffer);
  if (!safeMatch) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload.email || payload.authenticated !== true || typeof payload.expiresAt !== 'number') return null;
    return payload;
  } catch {
    return null;
  }
}

export function createAuthSession(email: string) {
  const payload: SessionPayload = {
    email: email.trim().toLowerCase(),
    authenticated: true,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };

  return {
    id: encode(payload),
    maxAgeSeconds: Math.floor(SESSION_TTL_MS / 1000),
  };
}

export function getSessionById(sessionId?: string): SessionRecord | null {
  if (!sessionId) return null;

  const payload = decode(sessionId);
  if (!payload) return null;

  if (payload.expiresAt <= Date.now()) {
    return null;
  }

  return payload;
}

export function clearSession(_sessionId?: string) {
  return;
}