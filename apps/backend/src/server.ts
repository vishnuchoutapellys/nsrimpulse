import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { PaymentMode, PaymentStatus, Prisma, PrismaClient, RoleName } from '@prisma/client';
import bcrypt from 'bcryptjs';
import type { NextFunction, Request, Response } from 'express';
import { createAdminRouter } from './adminRoutes.js';
import { createNotificationService } from './notifications.js';
import { issueStudentAccessToken, studentCanAccessRecord, studentIdPattern, verifyStudentAccessToken, type StudentClaims } from './studentAuth.js';
import { createStudentAuthRouter } from './studentAuthRoutes.js';

dotenv.config({ path: new URL('../../../.env', import.meta.url) });

const app = express();
app.use(cors({
  origin: [
    'https://www.nsrimpulse.com',
    'https://nsrimpulse.com',
    'http://localhost:5173'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json()); // Essential for reading req.body in POST requests
app.use(express.urlencoded({ extended: true }));
const prisma = new PrismaClient();
const notifications = createNotificationService();
const jwtAccessSecret = process.env.JWT_ACCESS_SECRET;
if (!jwtAccessSecret) throw new Error('JWT_ACCESS_SECRET is required');
type StudentRequest = Request<{ studentUid: string }> & { student?: StudentClaims };
app.use(
  (helmet as unknown as (options?: object) => express.RequestHandler)()
);
const configuredWebOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
app.use(cors({
  origin: (origin, callback) => {
    const isLocalDevelopmentOrigin = /^http:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+):\d+$/.test(origin ?? '');
    if (!origin || origin === configuredWebOrigin || isLocalDevelopmentOrigin) return callback(null, true);
    return callback(new Error('Origin is not allowed'));
  }
}));
app.use(express.json({ limit: '1mb' }));

const studentSchema = z.object({
  name: z.string().trim().min(2),
  mobile: z.string().regex(/^[6-9]\d{9}$/),
  email: z.string().email().optional(),
  collegeId: z.string().min(1),
  branchId: z.string().min(1),
  courseId: z.string().min(1),
  admissionYear: z.number().int().min(2000).max(2100),
  academicYear: z.string().min(4)
});
const studentPaymentSchema = z.object({
  studentUid: z.string().regex(studentIdPattern),
  amount: z.number().finite().positive().multipleOf(0.01),
  mode: z.enum(['ONLINE', 'UPI', 'CASH', 'BANK_TRANSFER', 'CHEQUE', 'OTHER']),
  idempotencyKey: z.string().uuid()
});

app.get('/health', (_req, res) => res.json({ success: true, data: { service: 'backend', status: 'ok' } }));
app.get('/api/v1/public/overview', (_req, res) => res.json({
  success: true, data: {
    organization: 'NSR Impulse Educational Institutions',
    navigation: ['Home', 'About Us', 'Courses', 'Branches', 'Results', 'Gallery', 'Contact'],
    message: 'Education pathways designed around confident careers.'
  }
}));
app.use('/api/v1/auth', createStudentAuthRouter(prisma, notifications, jwtAccessSecret));
app.post('/api/v1/students/validate', (req, res) => {
  const parsed = studentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid student details', details: parsed.error.issues } });
  return res.status(202).json({ success: true, data: { validated: true }, message: 'Student details are valid' });
});
app.get('/api/v1/students/:studentUid/portal', async (req: Request<{ studentUid: string }>, res: Response) => {
  const { studentUid } = req.params;
  const studentClaim = (req as any).student;

  try {
    if (!studentCanAccessRecord(studentClaim, studentUid)) return forbiddenStudent(res);
    const normalizedUid = studentUid.toLowerCase().startsWith('demo-') ? studentUid.toLowerCase() : studentUid;

    const student = await prisma.student.findUnique({
      where: { studentUid: normalizedUid },
      include: {
        feeAssignments: {
          include: {
            installments: {
              include: {
                allocations: {
                  include: { payment: true }
                }
              }
            }
          }
        },
        payments: true
      }
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    // Ensure student account is active before returning portal data
    if (student.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        error: { message: 'Your account is currently pending admin approval and activation.' }
      });
    }

    return res.json({ success: true, data: student });
  } catch (error) {
    console.error('Error fetching student portal:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.get('/api/v1/students/:studentUid/payments', authenticateStudent(jwtAccessSecret), async (req: StudentRequest, res, next) => {
  if (!studentCanAccessRecord(req.student, req.params.studentUid)) return forbiddenStudent(res);
  const query = z.object({ page: z.coerce.number().int().positive().default(1), pageSize: z.coerce.number().int().min(1).max(50).default(20) }).safeParse(req.query);
  if (!query.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid payment history pagination', details: query.error.issues } });
  try {
    const student = await prisma.student.findUnique({ where: { studentUid: req.params.studentUid }, include: { course: true, college: true } });
    if (!student) return res.status(404).json({ success: false, error: { code: 'STUDENT_NOT_FOUND', message: 'Student ID was not found' } });
    const where = { studentId: student.id, status: PaymentStatus.SUCCESS };
    const [payments, totalItems] = await prisma.$transaction([
      prisma.payment.findMany({ where, include: { receipt: true, allocations: { include: { installment: true } } }, orderBy: { createdAt: 'desc' }, skip: (query.data.page - 1) * query.data.pageSize, take: query.data.pageSize }),
      prisma.payment.count({ where })
    ]);
    return res.json({
      success: true, data: {
        student: { studentId: student.studentUid, name: student.name, course: student.course.name, college: student.college.name },
        payments: payments.map((payment) => ({
          id: payment.id,
          transactionNumber: payment.reference ?? payment.gatewayTransactionId ?? '',
          receiptNumber: payment.receipt?.receiptNumber ?? '',
          amount: Number(payment.amount),
          mode: payment.mode,
          status: payment.status,
          paidAt: payment.createdAt.toISOString(),
          allocations: payment.allocations.map((allocation) => ({ installmentId: allocation.installmentId, amount: Number(allocation.amount), dueDate: allocation.installment.dueDate.toISOString() }))
        })),
        pagination: { page: query.data.page, pageSize: query.data.pageSize, totalItems, totalPages: Math.ceil(totalItems / query.data.pageSize) }
      }, message: 'Payment history loaded from PostgreSQL'
    });
  } catch (error) { return next(error); }
});
app.post('/api/v1/payments/student', authenticateStudent(jwtAccessSecret), async (req: StudentRequest, res, next) => {
  const parsed = studentPaymentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Enter a valid positive payment amount and payment mode', details: parsed.error.issues } });
  if (!studentCanAccessRecord(req.student, parsed.data.studentUid)) return forbiddenStudent(res);
  try {
    const idempotencyReference = `PORTAL-${parsed.data.idempotencyKey}`;
    const result = await prisma.$transaction(async (transaction) => {
      const existingPayment = await transaction.payment.findUnique({ where: { gatewayOrderId: idempotencyReference }, include: { receipt: true, student: { include: { payments: { where: { status: PaymentStatus.SUCCESS } }, feeAssignments: true } } } });
      if (existingPayment) {
        const total = Number(existingPayment.student.feeAssignments.find((feeAssignment) => feeAssignment.isCurrent)?.originalAmount ?? 0);
        const paid = existingPayment.student.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
        return { paymentId: existingPayment.id, transactionNumber: existingPayment.reference ?? '', receiptNumber: existingPayment.receipt?.receiptNumber ?? '', amount: Number(existingPayment.amount), mode: existingPayment.mode, paidAt: existingPayment.createdAt.toISOString(), outstandingAmount: Math.max(total - paid, 0) };
      }
      const student = await transaction.student.findUnique({
        where: { studentUid: parsed.data.studentUid },
        include: {
          payments: { where: { status: PaymentStatus.SUCCESS } },
          feeAssignments: { include: { installments: { include: { allocations: { include: { payment: true } } }, orderBy: { dueDate: 'asc' } } } }
        }
      });
      if (!student) throw new PaymentRequestError('STUDENT_NOT_FOUND', 'Student ID was not found', 404);
      const assignment = student.feeAssignments.find((feeAssignment) => feeAssignment.isCurrent);
      if (!assignment) throw new PaymentRequestError('FEE_ASSIGNMENT_NOT_FOUND', 'No fee assignment exists for this student', 409);
      const total = Number(assignment.originalAmount);
      const paid = student.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
      const outstanding = Math.max(total - paid, 0);
      if (parsed.data.amount > outstanding) throw new PaymentRequestError('AMOUNT_EXCEEDS_OUTSTANDING', `Payment cannot exceed the outstanding amount of ₹${outstanding.toLocaleString('en-IN')}`, 409);

      const token = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
      const transactionNumber = `NSR-TXN-${token}`;
      const receiptNumber = `NSR-RCP-${token}`;
      const payment = await transaction.payment.create({
        data: {
          studentId: student.id,
          amount: parsed.data.amount,
          mode: parsed.data.mode as PaymentMode,
          status: PaymentStatus.SUCCESS,
          reference: transactionNumber,
          gatewayOrderId: idempotencyReference,
          gatewayTransactionId: parsed.data.mode === 'ONLINE' || parsed.data.mode === 'UPI' ? transactionNumber : null,
          rawResponse: { source: 'student-portal', recordedAt: new Date().toISOString() }
        }
      });

      let unallocated = parsed.data.amount;
      for (const installment of assignment.installments) {
        if (unallocated <= 0) break;
        const allocated = installment.allocations.filter((allocation) => allocation.payment.status === PaymentStatus.SUCCESS).reduce((sum, allocation) => sum + Number(allocation.amount), 0);
        const installmentOutstanding = Math.max(Number(installment.amount) - allocated, 0);
        const allocationAmount = Math.min(unallocated, installmentOutstanding);
        if (allocationAmount > 0) {
          await transaction.paymentAllocation.create({ data: { paymentId: payment.id, installmentId: installment.id, amount: allocationAmount } });
          unallocated -= allocationAmount;
        }
      }
      const receipt = await transaction.receipt.create({ data: { receiptNumber, paymentId: payment.id } });
      await transaction.auditLog.create({ data: { action: 'STUDENT_PAYMENT_RECORDED', entity: 'Payment', entityId: payment.id, newData: { studentUid: student.studentUid, amount: parsed.data.amount, mode: parsed.data.mode, transactionNumber, receiptNumber } } });
      return { paymentId: payment.id, transactionNumber, receiptNumber: receipt.receiptNumber, amount: Number(payment.amount), mode: payment.mode, paidAt: payment.createdAt.toISOString(), outstandingAmount: outstanding - parsed.data.amount };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return res.status(201).json({ success: true, data: result, message: 'Payment recorded and receipt generated successfully' });
  } catch (error) {
    if (error instanceof PaymentRequestError) return res.status(error.status).json({ success: false, error: { code: error.code, message: error.message } });
    return next(error);
  }
});
app.use('/api/v1/admin', createAdminRouter(prisma, notifications));
// ==========================================
// 1. REGISTER ENDPOINT
// ==========================================
app.post('/api/v1/auth/register', async (req, res) => {
  try {
    const { role, studentUid, email, name, mobile, password, adminSecretKey, collegeId, branchId, courseId } = req.body;
    if (role !== 'STUDENT') {
      return res.status(403).json({ success: false, error: { code: 'PRIVILEGED_REGISTRATION_DISABLED', message: 'Administrator accounts must be provisioned by a Super Admin.' } });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
      const {
        role, studentUid, name, mobile, email, password,
        fatherName, motherName, dateOfBirth, village, pin,
        collegeId, branchId, courseId, adminSecretKey
      } = req.body;

      const hashedPassword = await bcrypt.hash(password, 10);

      if (role === 'STUDENT') {
        const normalizedUid = studentUid.toLowerCase().startsWith('demo-')
          ? studentUid.toLowerCase()
          : studentUid.toUpperCase();

        const result = await prisma.$transaction(async (tx) => {
          const college = collegeId ? await tx.college.findUnique({ where: { id: collegeId } }) : await tx.college.findFirst();
          const branch = branchId ? await tx.branch.findUnique({ where: { id: branchId } }) : await tx.branch.findFirst();
          const course = courseId ? await tx.course.findUnique({ where: { id: courseId } }) : await tx.course.findFirst();

          if (!college || !branch || !course) {
            throw new Error('Database is missing required College, Branch, or Course records.');
          }

          const student = await tx.student.create({
            data: {
              studentUid: normalizedUid,
              name,
              mobile: mobile || '',
              email: email || null,
              fatherName: fatherName || null,
              motherName: motherName || null,
              dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
              village: village || null,
              pin: pin || null,
              admissionYear: new Date().getFullYear(),
              academicYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
              status: 'ON_HOLD', // Pending admin review & fee assignment
              collegeId: college.id,
              branchId: branch.id,
              courseId: course.id,
            },
          });

          const account = await tx.studentAccount.create({
            data: {
              studentId: student.id,
              email: email || null,
              passwordHash: hashedPassword,
              mustChangePassword: false,
            },
          });

          return { student, account };
        });

        return res.status(201).json({
          success: true,
          message: 'Registration successful! Your account is pending admin approval and fee assignment.',
          studentUid: result.student.studentUid,
        });
      }
    } catch (error: any) {
      console.error('Registration Error:', error);
      return res.status(500).json({ message: error.message || 'Registration failed' });
    }

    return res.status(400).json({ message: 'Invalid role specified' });
  } catch (error: any) {
    console.error('Registration Error:', error);
    return res.status(500).json({ message: error.message || 'Registration failed' });
  }
});
// ==========================================
// 2. LOGIN ENDPOINT
// ==========================================
app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { role, studentUid, email, password } = req.body;

    // --- STUDENT LOGIN ---
    if (role === 'STUDENT' || !role) {
      const normalizedUid = studentUid.toLowerCase().startsWith('demo-')
        ? studentUid.toLowerCase()
        : studentUid.toUpperCase();

      // Find Student by studentUid
      const student = await prisma.student.findUnique({
        where: { studentUid: normalizedUid },
        include: { account: true, college: true, branch: true, course: true },
      });

      if (!student || !student.account) {
        return res.status(401).json({ message: 'Invalid Student ID or password' });
      }

      // Verify bcrypt passwordHash
      const isPasswordValid = await bcrypt.compare(password, student.account.passwordHash);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid Student ID or password' });
      }

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        user: {
          id: student.id,
          studentUid: student.studentUid,
          name: student.name,
          college: student.college.name,
          branch: student.branch.name,
        },
      });
    }

    // --- ADMIN LOGIN ---
    if (role === 'ADMIN' || role === 'COLLEGE_ADMIN') {
      const user = await prisma.user.findUnique({
        where: { email },
        include: { roles: true },
      });

      if (!user) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      return res.status(200).json({
        success: true,
        message: 'Admin login successful',
        user: {
          id: user.id,
          email: user.email,
          roles: user.roles.map((r) => r.role),
        },
      });
    }
  } catch (error: any) {
    console.error('Login Error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});
app.use((_req, res) => res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } }));
app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled API error', error);
  return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected server error occurred' } });
});

export default app;

// Keep the local development server working.
// Vercel handles incoming requests in production.
if (process.env.VERCEL !== '1') {
  const port = Number(process.env.PORT ?? 4000);
  app.listen(port, () => {
    console.log(`NSR Impulse API listening on ${port}`);
  });
}

function authenticateStudent(secret: string) {
  return (req: StudentRequest, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return res.status(401).json({ success: false, error: { code: 'AUTHENTICATION_REQUIRED', message: 'Student sign in is required' } });
    try {
      const claims = verifyStudentAccessToken(token, secret);
      if (!claims) return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Student session is invalid or expired' } });
      req.student = claims;
      return next();
    } catch {
      return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Student session is invalid or expired' } });
    }
  };
}

function forbiddenStudent(res: Response) {
  return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this student record' } });
}

class PaymentRequestError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) { super(message); }
}
