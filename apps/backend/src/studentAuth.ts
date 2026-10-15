import jwt from 'jsonwebtoken';
import { z } from 'zod';

export type StudentClaims = {
  studentUid: string;
  role: 'STUDENT';
};

export const studentIdPattern = /^(?:NSR[A-Z]+-\d{3,6}|NSR-[A-Z]{2}-[A-Z]+-\d{4}-\d{6})$/;

const studentClaimsSchema = z.object({
  studentUid: z.string().regex(studentIdPattern),
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

    if (!claims.success) return null;
    const { studentUid, role } = claims.data;
    if (!studentUid || role !== 'STUDENT') return null;
    return { studentUid, role };
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
