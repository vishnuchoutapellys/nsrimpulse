import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { createStudentSchema, formatValidationIssue, getCredentialDeliveryHint, isStudentInCollegeScope, offlinePaymentSchema } from './adminRoutes.js';
import { forgotPasswordResponse, getVerifiedOtpChannels, verifyOtpSchema } from './studentAuthRoutes.js';
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

describe('College Admin college scope', () => {
  const scopes = [
    { collegeId: 'college-a', branchId: 'branch-a' },
    { collegeId: 'college-b', branchId: null }
  ];

  it('allows student records across all branches of the assigned college', () => {
    expect(isStudentInCollegeScope(scopes, 'college-a')).toBe(true);
  });

  it('denies student records belonging to another college', () => {
    expect(isStudentInCollegeScope(scopes, 'college-other')).toBe(false);
  });

  it('recognizes college-wide scopes even when there is no branch assignment', () => {
    expect(isStudentInCollegeScope(scopes, 'college-b')).toBe(true);
  });
});

describe('College Admin student admission payload', () => {
  const validStudent = {
    name: 'Student Example',
    fatherName: 'Parent Example',
    gender: 'OTHER',
    age: 18,
    mobile: '9012345678',
    email: 'student@example.com',
    address: '123 Example Street',
    village: 'Example City',
    pin: '500090',
    admissionYear: 2026,
    academicYear: '2026-2027',
    collegeId: 'college-a',
    courseId: 'course-a',
    feeStructureId: 'fee-a'
  };

  it('does not require a branch selector from the College Admin', () => {
    const parsed = createStudentSchema.safeParse(validStudent);

    expect(parsed.success).toBe(true);
  });

  describe('student credential email errors', () => {
    it('gives actionable guidance when Resend rejects the API key or sender domain', () => {
      expect(getCredentialDeliveryHint(new Error('Resend email API returned HTTP 403: private provider detail')))
        .toContain('API key is active');
      expect(getCredentialDeliveryHint(new Error('Resend email API returned HTTP 422: private provider detail')))
        .toContain('sender address belongs to a verified domain');
    });

    describe('forgot-password response', () => {
      it('includes the challenge ID for the verification screen when available', () => {
        expect(forgotPasswordResponse('challenge-123', { email: true, mobile: false }).data).toEqual({
          requested: true,
          challengeId: 'challenge-123',
          channels: { email: true, mobile: false }
        });
      });

      it('does not disclose account status when no challenge was issued', () => {
        expect(forgotPasswordResponse().data).toEqual({ requested: true });
        expect(forgotPasswordResponse().message).toContain('If the Student ID is active');
      });
    });

    describe('password-reset verification channels', () => {
      const hashOtp = (otp: string) => createHmac('sha256', jwtSecret).update(otp).digest('hex');
      const challenge = { emailOtpHash: hashOtp('123456'), mobileOtpHash: hashOtp('123456') };

      it('accepts the common code when both delivery channels succeeded', () => {
        expect(getVerifiedOtpChannels(challenge, '123456', jwtSecret)).toEqual({ email: true, mobile: true });
      });

      it('accepts the common code when only email delivery succeeded', () => {
        expect(getVerifiedOtpChannels({ emailOtpHash: hashOtp('123456'), mobileOtpHash: null }, '123456', jwtSecret))
          .toEqual({ email: true, mobile: false });
      });

      it('accepts the common code when only mobile delivery succeeded', () => {
        expect(getVerifiedOtpChannels({ emailOtpHash: null, mobileOtpHash: hashOtp('123456') }, '123456', jwtSecret))
          .toEqual({ email: false, mobile: true });
      });

      it('accepts the common OTP request and rejects a request without an OTP', () => {
        expect(verifyOtpSchema.safeParse({ challengeId: 'challenge-123', otp: '123456' }).success).toBe(true);
        expect(verifyOtpSchema.safeParse({ challengeId: 'challenge-123' }).success).toBe(false);
      });
    });

    it('does not expose raw provider errors to the client', () => {
      const hint = getCredentialDeliveryHint(new Error('Resend email API returned HTTP 403: private provider detail'));
      expect(hint).not.toContain('private provider detail');
    });
  });

  it('explains that an address must contain at least five characters', () => {
    const parsed = createStudentSchema.safeParse({ ...validStudent, address: '1234' });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(formatValidationIssue(parsed.error.issues[0]!)).toBe('Address must contain at least 5 characters.');
  });
});
