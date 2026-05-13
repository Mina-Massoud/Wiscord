import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { env } from './env.js';

const SECRET = new TextEncoder().encode(env.JWT_SECRET);
const ISSUER = 'wiscord';
const AUDIENCE = 'wiscord-web';

export interface SessionClaims extends JWTPayload {
  sub: string; // user id
}

export async function signSessionToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${env.SESSION_TTL_SECONDS}s`)
    .sign(SECRET);
}

export async function verifySessionToken(token: string): Promise<SessionClaims> {
  const { payload } = await jwtVerify<SessionClaims>(token, SECRET, {
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  if (!payload.sub) throw new Error('jwt: missing sub claim');
  return payload;
}
