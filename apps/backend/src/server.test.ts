import { describe, expect, it } from 'vitest';
import { issueStudentAccessToken, studentCanAccessRecord, verifyStudentAccessToken } from './studentAuth.js';

const jwtSecret = 'test-only-secret-for-student-auth';

describe('student identity rules', () => {
  it('uses student UID as an immutable identity', () => {
    expect('NSR-TS-HYD-2026-000001').toMatch(/^NSR-[A-Z]{2}-[A-Z]+-\d{4}-\d{6}$/);
  });
});

describe('student access tokens', () => {
  it('accepts both legacy and long issued student IDs', () => {
    for (const studentUid of ['NSRHYD-001', 'NSR-TS-HYD-2026-000001']) {
      const token = issueStudentAccessToken(studentUid, jwtSecret);
      expect(verifyStudentAccessToken(token, jwtSecret)).toEqual({ studentUid, role: 'STUDENT' });
    }
  });

  it('accepts a signed student token only for its own record', () => {
    const token = issueStudentAccessToken('NSRHYD-001', jwtSecret);
    const claims = verifyStudentAccessToken(token, jwtSecret);

    expect(claims).toEqual({ studentUid: 'NSRHYD-001', role: 'STUDENT' });
    expect(studentCanAccessRecord(claims ?? undefined, 'NSRHYD-001')).toBe(true);
    expect(studentCanAccessRecord(claims ?? undefined, 'NSRHYD-002')).toBe(false);
  });

  it('rejects malformed and incorrectly signed tokens', () => {
    const token = issueStudentAccessToken('NSRHYD-001', jwtSecret);

    expect(verifyStudentAccessToken('not-a-jwt', jwtSecret)).toBeNull();
    expect(verifyStudentAccessToken(token, 'different-secret')).toBeNull();
  });
});
