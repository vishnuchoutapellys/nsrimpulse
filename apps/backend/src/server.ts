import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { PaymentMode, PaymentStatus, Prisma, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createAdminRouter } from './adminRoutes.js';

dotenv.config({ path: new URL('../../../.env', import.meta.url) });

const app = express();
const prisma = new PrismaClient();
app.use(helmet());
const configuredWebOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
app.use(cors({ origin: (origin, callback) => {
  const isLocalDevelopmentOrigin = /^http:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+):\d+$/.test(origin ?? '');
  if (!origin || origin === configuredWebOrigin || isLocalDevelopmentOrigin) return callback(null, true);
  return callback(new Error('Origin is not allowed'));
} }));
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
const studentIdPattern = /^NSRTS[A-Z]+-\d{3,6}$/;
const passwordSchema = z.string().min(8).max(128).regex(/[A-Z]/, 'Password must include an uppercase letter').regex(/\d/, 'Password must include a number').regex(/[^A-Za-z0-9]/, 'Password must include a special character');
const loginSchema = z.object({ studentId: z.string().trim().regex(studentIdPattern), password: z.string().min(8).max(128) });
const registerSchema = z.object({
  name: z.string().trim().min(2),
  studentUid: z.string().trim().regex(studentIdPattern),
  mobile: z.string().regex(/^[6-9]\d{9}$/),
  email: z.string().trim().email(),
  password: passwordSchema,
  confirmPassword: z.string().min(8).max(128)
}).refine((value) => value.password === value.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });
const studentPaymentSchema = z.object({
  studentUid: z.string().regex(/^NSRTS[A-Z]+-\d{3}$/),
  amount: z.number().finite().positive().multipleOf(0.01),
  mode: z.enum(['ONLINE', 'UPI', 'CASH', 'BANK_TRANSFER', 'CHEQUE', 'OTHER']),
  idempotencyKey: z.string().uuid()
});

app.get('/health', (_req, res) => res.json({ success: true, data: { service: 'backend', status: 'ok' } }));
app.get('/api/v1/public/overview', (_req, res) => res.json({ success: true, data: {
  organization: 'NSR Impulse Knowledge Park',
  navigation: ['Home', 'About Us', 'Courses', 'Branches', 'Results', 'Gallery', 'Contact'],
  message: 'Education pathways designed around confident careers.'
} }));
app.post('/api/v1/auth/login', async (req, res, next) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Enter a valid Student ID and password', details: parsed.error.issues } });
  try {
    const student = await prisma.student.findUnique({ where: { studentUid: parsed.data.studentId }, include: { account: true } });
    const passwordMatches = student?.account ? await bcrypt.compare(parsed.data.password, student.account.passwordHash) : false;
    if (!student || !passwordMatches || student.status === 'DISCONTINUED') return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Student ID or password is incorrect' } });
    return res.json({ success: true, data: { authenticated: true, studentId: student.studentUid }, message: 'Login successful' });
  } catch (error) { return next(error); }
});
app.post('/api/v1/auth/register', async (req, res, next) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Check the registration details', details: parsed.error.issues } });
  try {
    const studentUid = parsed.data.studentUid.toUpperCase();
    const student = await prisma.student.findUnique({ where: { studentUid }, include: { account: true } });
    if (!student) return res.status(404).json({ success: false, error: { code: 'STUDENT_NOT_FOUND', message: 'No student record exists for this Student ID. Use the exact ID issued by your college.' } });
    if (student.status === 'DISCONTINUED') return res.status(403).json({ success: false, error: { code: 'ACCOUNT_DISABLED', message: 'Registration is disabled for this student record' } });
    if (student.account) return res.status(409).json({ success: false, error: { code: 'ACCOUNT_ALREADY_EXISTS', message: 'An account already exists for this Student ID. Please sign in.' } });
    const normalizeName = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase();
    const identityMatches = normalizeName(student.name) === normalizeName(parsed.data.name) && student.mobile === parsed.data.mobile && student.email?.trim().toLowerCase() === parsed.data.email.toLowerCase();
    if (!identityMatches) return res.status(403).json({ success: false, error: { code: 'IDENTITY_MISMATCH', message: 'Name, mobile, or email does not match the college student record' } });
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const account = await prisma.$transaction(async (transaction) => {
      const created = await transaction.studentAccount.create({ data: { studentId: student.id, email: parsed.data.email.toLowerCase(), passwordHash } });
      await transaction.auditLog.create({ data: { action: 'STUDENT_ACCOUNT_REGISTERED', entity: 'StudentAccount', entityId: created.id, ipAddress: req.ip, newData: { studentUid, email: parsed.data.email.toLowerCase() } } });
      return created;
    });
    return res.status(201).json({ success: true, data: { linked: true, studentId: student.studentUid, accountId: account.id }, message: 'Student account created successfully. You can now sign in.' });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return res.status(409).json({ success: false, error: { code: 'ACCOUNT_ALREADY_EXISTS', message: 'An account already exists for this Student ID or email' } });
    return next(error);
  }
});
app.post('/api/v1/students/validate', (req, res) => {
  const parsed = studentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid student details', details: parsed.error.issues } });
  return res.status(202).json({ success: true, data: { validated: true }, message: 'Student details are valid' });
});
app.get('/api/v1/students/:studentUid/portal', async (req, res, next) => {
  try {
    const student = await prisma.student.findUnique({
      where: { studentUid: req.params.studentUid },
      include: {
        college: { include: { location: true } },
        branch: true,
        course: true,
        payments: { include: { receipt: true }, orderBy: { createdAt: 'desc' } },
        feeAssignments: { include: { feeStructure: true, installments: { include: { allocations: { include: { payment: true } } }, orderBy: { dueDate: 'asc' } } }, orderBy: { id: 'asc' } }
      }
    });
    if (!student) return res.status(404).json({ success: false, error: { code: 'STUDENT_NOT_FOUND', message: 'Student ID was not found' } });
    const assignment = student.feeAssignments[0];
    if (!assignment) return res.status(409).json({ success: false, error: { code: 'FEE_ASSIGNMENT_NOT_FOUND', message: 'No fee assignment exists for this student' } });
    const paid = student.payments.filter((payment) => payment.status === PaymentStatus.SUCCESS).reduce((total, payment) => total + Number(payment.amount), 0);
    const total = Number(assignment.originalAmount);
    const pending = Math.max(total - paid, 0);
    const installmentData = assignment.installments.map((installment, index) => {
      const installmentPaid = installment.allocations.filter((allocation) => allocation.payment.status === PaymentStatus.SUCCESS).reduce((sum, allocation) => sum + Number(allocation.amount), 0);
      const installmentAmount = Number(installment.amount);
      return { id: installment.id, label: `Year ${index + 1}`, amount: installmentAmount, paid: installmentPaid, dueDate: installment.dueDate.toISOString().slice(0, 10), status: installmentPaid >= installmentAmount ? 'PAID' : installmentPaid > 0 ? 'PARTIAL' : 'PENDING' };
    });
    const reminders = installmentData.filter((installment) => installment.status !== 'PAID').map((installment, index) => ({
      id: installment.id,
      title: `${installment.label} fee payment due`,
      message: `₹${(installment.amount - installment.paid).toLocaleString('en-IN')} remains due for ${installment.label}.`,
      dueDate: installment.dueDate,
      severity: index === 0 ? 'HIGH' : 'INFO',
      read: false
    }));
    const latestPayment = student.payments.find((payment) => payment.status === PaymentStatus.SUCCESS);
    return res.json({ success: true, data: {
      studentId: student.studentUid,
      name: student.name,
      fatherName: student.fatherName ?? '',
      age: student.age ?? 0,
      courseType: student.course.name,
      courseDurationYears: 2,
      location: student.college.location.name,
      mobile: student.mobile,
      email: student.email ?? '',
      village: student.village ?? student.address ?? '',
      pin: student.pin ?? '',
      fee: { total, paid, pending, currency: 'INR', installments: installmentData.map(({ label, amount, dueDate, status }) => ({ label, amount, dueDate, status })) },
      receipt: { invoiceNumber: latestPayment?.receipt?.receiptNumber ?? `NSR-INV-${student.admissionYear}-${student.studentUid}`, transactionNumber: latestPayment?.reference ?? `PENDING-${student.studentUid}`, dateTime: latestPayment?.createdAt.toISOString() ?? new Date().toISOString(), paymentType: latestPayment?.mode ?? 'ONLINE', amount: latestPayment ? Number(latestPayment.amount) : 0, status: latestPayment ? 'PAID' : 'PENDING', note: latestPayment ? 'Payment recorded in the central database.' : 'Invoice generated. Receipt will be finalized after payment confirmation.' },
      reminders
    }, message: 'Student portal data loaded from PostgreSQL' });
  } catch (error) { return next(error); }
});
app.get('/api/v1/students/:studentUid/payments', async (req, res, next) => {
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
    return res.json({ success: true, data: {
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
    }, message: 'Payment history loaded from PostgreSQL' });
  } catch (error) { return next(error); }
});
app.post('/api/v1/payments/student', async (req, res, next) => {
  const parsed = studentPaymentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Enter a valid positive payment amount and payment mode', details: parsed.error.issues } });
  try {
    const idempotencyReference = `PORTAL-${parsed.data.idempotencyKey}`;
    const result = await prisma.$transaction(async (transaction) => {
      const existingPayment = await transaction.payment.findUnique({ where: { gatewayOrderId: idempotencyReference }, include: { receipt: true, student: { include: { payments: { where: { status: PaymentStatus.SUCCESS } }, feeAssignments: true } } } });
      if (existingPayment) {
        const total = Number(existingPayment.student.feeAssignments[0]?.originalAmount ?? 0);
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
      const assignment = student.feeAssignments[0];
      if (!assignment) throw new PaymentRequestError('FEE_ASSIGNMENT_NOT_FOUND', 'No fee assignment exists for this student', 409);
      const total = Number(assignment.originalAmount);
      const paid = student.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
      const outstanding = Math.max(total - paid, 0);
      if (parsed.data.amount > outstanding) throw new PaymentRequestError('AMOUNT_EXCEEDS_OUTSTANDING', `Payment cannot exceed the outstanding amount of ₹${outstanding.toLocaleString('en-IN')}`, 409);

      const token = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
      const transactionNumber = `NSR-TXN-${token}`;
      const receiptNumber = `NSR-RCP-${token}`;
      const payment = await transaction.payment.create({ data: {
        studentId: student.id,
        amount: parsed.data.amount,
        mode: parsed.data.mode as PaymentMode,
        status: PaymentStatus.SUCCESS,
        reference: transactionNumber,
        gatewayOrderId: idempotencyReference,
        gatewayTransactionId: parsed.data.mode === 'ONLINE' || parsed.data.mode === 'UPI' ? transactionNumber : null,
        rawResponse: { source: 'student-portal', recordedAt: new Date().toISOString() }
      } });

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
app.use('/api/v1/admin', createAdminRouter(prisma));

app.use((_req, res) => res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } }));
app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: error.message } }));

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => console.log(`NSR Impulse API listening on ${port}`));

class PaymentRequestError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) { super(message); }
}
