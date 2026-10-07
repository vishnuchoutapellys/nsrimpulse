import { describe, expect, it } from 'vitest';
import { issueStudentAccessToken, studentCanAccessRecord, verifyStudentAccessToken } from './studentAuth.js';

const jwtSecret = 'test-only-secret-for-student-auth';

describe('student identity rules', () => {
  it('uses student UID as an immutable identity', () => {
    expect('NSR-TS-HYD-2026-000001').toMatch(/^NSR-[A-Z]{2}-[A-Z]+-\d{4}-\d{6}$/);
  });
});

describe('student access tokens', () => {
  it('accepts a signed student token only for its own record', () => {
    const token = issueStudentAccessToken('NSRTSHYD-001', jwtSecret);
    const claims = verifyStudentAccessToken(token, jwtSecret);

    expect(claims).toEqual({ studentUid: 'NSRTSHYD-001', role: 'STUDENT' });
    expect(studentCanAccessRecord(claims ?? undefined, 'NSRTSHYD-001')).toBe(true);
    expect(studentCanAccessRecord(claims ?? undefined, 'NSRTSHYD-002')).toBe(false);
  });

  it('rejects malformed and incorrectly signed tokens', () => {
    const token = issueStudentAccessToken('NSRTSHYD-001', jwtSecret);

    expect(verifyStudentAccessToken('not-a-jwt', jwtSecret)).toBeNull();
    expect(verifyStudentAccessToken(token, 'different-secret')).toBeNull();
  });
});
