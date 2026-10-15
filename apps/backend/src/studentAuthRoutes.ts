import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import type { NotificationService } from './notifications.js';
import { issueStudentAccessToken, studentIdPattern } from './studentAuth.js';

const passwordSchema = z.string().min(8).max(128).regex(/[A-Z]/, 'Password must include an uppercase letter').regex(/[a-z]/, 'Password must include a lowercase letter').regex(/\d/, 'Password must include a number').regex(/[^A-Za-z0-9]/, 'Password must include a special character');
const loginSchema = z.object({ studentId: z.string().trim().regex(studentIdPattern), password: z.string().min(6).max(128) });
const changePasswordSchema = z.object({ changeToken: z.string().min(1), currentPassword: z.string().min(6).max(128), newPassword: passwordSchema });
const forgotPasswordSchema = z.object({ studentId: z.string().trim().regex(studentIdPattern) });
const verifyOtpSchema = z.object({ challengeId: z.string().min(1), emailOtp: z.string().regex(/^\d{6}$/), mobileOtp: z.string().regex(/^\d{6}$/) });
const resetPasswordSchema = z.object({ resetToken: z.string().min(32).max(256), newPassword: passwordSchema });
const LOGIN_ATTEMPT_LIMIT = 5;
const LOGIN_LOCK_MINUTES = 15;
const OTP_EXPIRY_MINUTES = 10;
const OTP_ATTEMPT_LIMIT = 5;
const RESET_TOKEN_EXPIRY_MINUTES = 10;

type ChangeClaims = { purpose: 'STUDENT_PASSWORD_CHANGE'; accountId: string; studentUid: string };

export function createStudentAuthRouter(prisma: PrismaClient, notifications: NotificationService, jwtSecret: string) {
  const router = Router();

  router.post('/login', async (req, res, next) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, 'Enter a valid Student ID and password', parsed.error.issues);
    try {
      const studentUid = parsed.data.studentId.toUpperCase();
      const student = await prisma.student.findUnique({ where: { studentUid }, include: { account: true } });
      const account = student?.account;
      if (account?.lockedUntil && account.lockedUntil > new Date()) return res.status(429).json({ success: false, error: { code: 'ACCOUNT_TEMPORARILY_LOCKED', message: 'Too many failed attempts. Try again later or reset your password.' } });
      const passwordMatches = account ? await bcrypt.compare(parsed.data.password, account.passwordHash) : false;
      if (!student || !account || !passwordMatches || student.status === 'DISCONTINUED') {
        if (account) {
          const failedLoginAttempts = account.failedLoginAttempts + 1;
          await prisma.studentAccount.update({
            where: { id: account.id },
            data: failedLoginAttempts >= LOGIN_ATTEMPT_LIMIT
              ? { failedLoginAttempts: 0, lockedUntil: minutesFromNow(LOGIN_LOCK_MINUTES) }
              : { failedLoginAttempts }
          });
        }
        return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Student ID or password is incorrect' } });
      }
      await prisma.studentAccount.update({ where: { id: account.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
      if (account.mustChangePassword) {
        const changeToken = jwt.sign({ purpose: 'STUDENT_PASSWORD_CHANGE', accountId: account.id, studentUid } satisfies ChangeClaims, jwtSecret, { expiresIn: '10m' });
        return res.json({ success: true, data: { requiresPasswordChange: true, studentId: studentUid, changeToken }, message: 'Temporary password verified. Set a new password to continue.' });
      }
      const accessToken = issueStudentAccessToken(studentUid, jwtSecret);
      await prisma.auditLog.create({ data: { action: 'STUDENT_LOGIN', entity: 'StudentAccount', entityId: account.id, ipAddress: req.ip } });
      return res.json({ success: true, data: { authenticated: true, requiresPasswordChange: false, studentId: studentUid, accessToken, expiresIn: 900 }, message: 'Login successful' });
    } catch (error) { return next(error); }
  });

  router.post('/change-temporary-password', async (req, res, next) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, 'Enter a secure new password', parsed.error.issues);
    try {
      const claims = verifyChangeToken(parsed.data.changeToken, jwtSecret);
      if (!claims) return res.status(401).json({ success: false, error: { code: 'INVALID_CHANGE_TOKEN', message: 'The password-change session is invalid or expired. Sign in again.' } });
      const account = await prisma.studentAccount.findUnique({ where: { id: claims.accountId }, include: { student: true } });
      const currentPasswordMatches = account ? await bcrypt.compare(parsed.data.currentPassword, account.passwordHash) : false;
      if (!account || !account.mustChangePassword || !currentPasswordMatches || account.student.studentUid !== claims.studentUid) return res.status(401).json({ success: false, error: { code: 'INVALID_CHANGE_REQUEST', message: 'The temporary password is incorrect or has already been changed.' } });
      if (await bcrypt.compare(parsed.data.newPassword, account.passwordHash)) return res.status(400).json({ success: false, error: { code: 'PASSWORD_REUSE', message: 'Choose a password different from the temporary password.' } });
      const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
      await prisma.$transaction([
        prisma.studentAccount.update({ where: { id: account.id }, data: { passwordHash, mustChangePassword: false, passwordChangedAt: new Date(), failedLoginAttempts: 0, lockedUntil: null } }),
        prisma.auditLog.create({ data: { action: 'STUDENT_TEMPORARY_PASSWORD_CHANGED', entity: 'StudentAccount', entityId: account.id, ipAddress: req.ip } })
      ]);
      return res.json({ success: true, data: { studentId: claims.studentUid, accessToken: issueStudentAccessToken(claims.studentUid, jwtSecret), expiresIn: 900 }, message: 'Password changed successfully' });
    } catch (error) { return next(error); }
  });

  router.post('/forgot-password', async (req, res, next) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, 'Enter a valid Student ID', parsed.error.issues);
    const genericResponse = { success: true, data: { requested: true }, message: 'If the Student ID is active, verification codes have been sent to the registered email and mobile.' };
    try {
      const student = await prisma.student.findUnique({ where: { studentUid: parsed.data.studentId.toUpperCase() }, include: { account: true } });
      if (!student?.account || !student.email || student.status === 'DISCONTINUED') return res.status(202).json(genericResponse);
      const recentChallenge = await prisma.passwordResetChallenge.findFirst({ where: { accountId: student.account.id, consumedAt: null, createdAt: { gt: new Date(Date.now() - 60_000) } } });
      if (recentChallenge) return res.status(202).json(genericResponse);
      const emailOtp = generateOtp();
      const mobileOtp = generateOtp();
      const challenge = await prisma.passwordResetChallenge.create({ data: { accountId: student.account.id, emailOtpHash: hashSecret(emailOtp, jwtSecret), mobileOtpHash: hashSecret(mobileOtp, jwtSecret), expiresAt: minutesFromNow(OTP_EXPIRY_MINUTES), attemptsRemaining: OTP_ATTEMPT_LIMIT } });
      try {
        await Promise.all([
          notifications.sendEmail(student.email, 'NSR Impulse password reset code', `Your email verification code is ${emailOtp}. It expires in ${OTP_EXPIRY_MINUTES} minutes. Do not share this code.`),
          notifications.sendSms(student.mobile, `NSR Impulse mobile verification code: ${mobileOtp}. Expires in ${OTP_EXPIRY_MINUTES} minutes. Do not share it.`)
        ]);
      } catch (deliveryError) {
        await prisma.passwordResetChallenge.delete({ where: { id: challenge.id } });
        console.error('Password reset notification delivery failed', deliveryError);
        return res.status(202).json(genericResponse);
      }
      await prisma.auditLog.create({ data: { action: 'STUDENT_PASSWORD_RESET_REQUESTED', entity: 'StudentAccount', entityId: student.account.id, ipAddress: req.ip } });
      return res.status(202).json({ ...genericResponse, data: { requested: true, challengeId: challenge.id } });
    } catch (error) { return next(error); }
  });

  router.post('/forgot-password/verify', async (req, res, next) => {
    const parsed = verifyOtpSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, 'Enter both 6-digit verification codes', parsed.error.issues);
    try {
      const challenge = await prisma.passwordResetChallenge.findUnique({ where: { id: parsed.data.challengeId } });
      if (!challenge || challenge.consumedAt || challenge.expiresAt <= new Date() || challenge.attemptsRemaining <= 0) return res.status(400).json({ success: false, error: { code: 'INVALID_OR_EXPIRED_OTP', message: 'The verification request is invalid or expired. Request new codes.' } });
      const emailVerified = secureHashMatches(parsed.data.emailOtp, challenge.emailOtpHash, jwtSecret);
      const mobileVerified = secureHashMatches(parsed.data.mobileOtp, challenge.mobileOtpHash, jwtSecret);
      if (!emailVerified || !mobileVerified) {
        await prisma.passwordResetChallenge.update({ where: { id: challenge.id }, data: { attemptsRemaining: { decrement: 1 } } });
        return res.status(400).json({ success: false, error: { code: 'INVALID_OTP', message: 'One or both verification codes are incorrect.' } });
      }
      const resetToken = randomBytes(32).toString('base64url');
      const now = new Date();
      await prisma.passwordResetChallenge.update({ where: { id: challenge.id }, data: { emailVerifiedAt: now, mobileVerifiedAt: now, resetTokenHash: hashSecret(resetToken, jwtSecret), resetTokenExpiresAt: minutesFromNow(RESET_TOKEN_EXPIRY_MINUTES) } });
      return res.json({ success: true, data: { resetToken }, message: 'Email and mobile verified. Set your new password.' });
    } catch (error) { return next(error); }
  });

  router.post('/forgot-password/reset', async (req, res, next) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, 'Enter a secure new password', parsed.error.issues);
    try {
      const resetTokenHash = hashSecret(parsed.data.resetToken, jwtSecret);
      const challenge = await prisma.passwordResetChallenge.findFirst({ where: { resetTokenHash, consumedAt: null, resetTokenExpiresAt: { gt: new Date() }, emailVerifiedAt: { not: null }, mobileVerifiedAt: { not: null } }, include: { account: { include: { student: true } } } });
      if (!challenge) return res.status(401).json({ success: false, error: { code: 'INVALID_RESET_TOKEN', message: 'The password reset session is invalid or expired.' } });
      if (await bcrypt.compare(parsed.data.newPassword, challenge.account.passwordHash)) return res.status(400).json({ success: false, error: { code: 'PASSWORD_REUSE', message: 'Choose a password different from your current password.' } });
      const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
      await prisma.$transaction([
        prisma.studentAccount.update({ where: { id: challenge.accountId }, data: { passwordHash, mustChangePassword: false, passwordChangedAt: new Date(), failedLoginAttempts: 0, lockedUntil: null } }),
        prisma.passwordResetChallenge.updateMany({ where: { accountId: challenge.accountId, consumedAt: null }, data: { consumedAt: new Date() } }),
        prisma.auditLog.create({ data: { action: 'STUDENT_PASSWORD_RESET_COMPLETED', entity: 'StudentAccount', entityId: challenge.accountId, ipAddress: req.ip } })
      ]);
      return res.json({ success: true, data: { reset: true, studentId: challenge.account.student.studentUid }, message: 'Password reset successfully. Sign in with your new password.' });
    } catch (error) { return next(error); }
  });

  return router;
}

function verifyChangeToken(token: string, secret: string): ChangeClaims | null {
  try {
    const parsed = z.object({ purpose: z.literal('STUDENT_PASSWORD_CHANGE'), accountId: z.string(), studentUid: z.string().regex(studentIdPattern) }).safeParse(jwt.verify(token, secret));
    if (!parsed.success) return null;
    const { purpose, accountId, studentUid } = parsed.data;
    if (purpose !== 'STUDENT_PASSWORD_CHANGE' || !accountId || !studentUid) return null;
    return { purpose, accountId, studentUid };
  } catch { return null; }
}

function generateOtp() { return randomInt(100000, 1000000).toString(); }
function minutesFromNow(minutes: number) { return new Date(Date.now() + minutes * 60_000); }
function hashSecret(value: string, secret: string) { return createHmac('sha256', secret).update(value).digest('hex'); }
function secureHashMatches(value: string, expectedHash: string, secret: string) {
  const actual = Buffer.from(hashSecret(value, secret), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
function validationError(res: import('express').Response, message: string, details: z.ZodIssue[]) {
  return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message, details } });
}