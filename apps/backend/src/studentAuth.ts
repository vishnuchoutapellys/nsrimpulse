import jwt from 'jsonwebtoken';
import { z } from 'zod';

export type StudentClaims = {
  studentUid: string;
  role: 'STUDENT';
};

const studentClaimsSchema = z.object({
  studentUid: z.string().regex(/^NSR[A-Z]+-\d{3,6}$/),
  role: z.literal('STUDENT')
});

export function issueStudentAccessToken(
  studentUid: string,
  secret: string
) {
  const claims: StudentClaims = {
    studentUid,
    role: 'STUDENT'
  };

  return jwt.sign(claims, secret, { expiresIn: '15m' });
}

export function verifyStudentAccessToken(
  token: string,
  secret: string
): StudentClaims | null {
  try {
    const verifiedPayload: unknown = jwt.verify(token, secret);
    const claims = studentClaimsSchema.safeParse(verifiedPayload);

    return claims.success ? claims.data : null;
  } catch {
    return null;
  }
}

export function studentCanAccessRecord(
  claims: StudentClaims | undefined,
  studentUid: string
) {
  return claims?.studentUid === studentUid;
}
