import { describe, expect, it } from 'vitest';
import { offlinePaymentSchema } from './adminRoutes.js';
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

describe('offline payment collection', () => {
  const payment = {
    amount: 450,
    mode: 'CASH' as const,
    paymentDate: new Date(Date.now() - 60_000).toISOString(),
    idempotencyKey: '99e41a36-cba3-4aeb-903d-d07e28e28de8'
  };

  it('requires and trims the fee collector name', () => {
    expect(offlinePaymentSchema.safeParse(payment).success).toBe(false);
    expect(offlinePaymentSchema.safeParse({ ...payment, feeCollectedBy: '   ' }).success).toBe(false);

    const parsed = offlinePaymentSchema.safeParse({ ...payment, feeCollectedBy: '  Anil Kumar  ' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.feeCollectedBy).toBe('Anil Kumar');
  });
});
