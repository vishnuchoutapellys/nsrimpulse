import jwt from 'jsonwebtoken';
import { z } from 'zod';

export type StudentClaims = { studentUid: string; role: 'STUDENT' };

const studentClaimsSchema = z.object({
    studentUid: z.string().regex(/^NSRTS[A-Z]+-\d{3,6}$/),
    role: z.literal('STUDENT')
});

export function issueStudentAccessToken(studentUid: string, secret: string) {
    return jwt.sign({ studentUid, role: 'STUDENT' } satisfies StudentClaims, secret, { expiresIn: '15m' });
}

export function verifyStudentAccessToken(token: string, secret: string): StudentClaims | null {
    try {
        const claims = studentClaimsSchema.safeParse(jwt.verify(token, secret));
        return claims.success ? claims.data : null;
    } catch {
        return null;
    }
}

export function studentCanAccessRecord(claims: StudentClaims | undefined, studentUid: string) {
    return claims?.studentUid === studentUid;
}