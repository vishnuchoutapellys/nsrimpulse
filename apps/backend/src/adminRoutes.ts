import { PaymentMode, PaymentStatus, Prisma, PrismaClient, StudentStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response, Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

type AdminClaims = { userId: string; adminId: string; role: 'COLLEGE_ADMIN' };
type AdminRequest = Request & { admin?: AdminClaims };

const loginSchema = z.object({ adminId: z.string().trim().min(8).max(40), password: z.string().min(8).max(128) });
const createStudentSchema = z.object({
  studentUid: z.string().trim().regex(/^NSRTS[A-Z]+-\d{3,6}$/),
  name: z.string().trim().min(2).max(120),
  fatherName: z.string().trim().min(2).max(120),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  age: z.number().int().min(14).max(80),
  mobile: z.string().regex(/^[6-9]\d{9}$/),
  email: z.string().email(),
  address: z.string().trim().min(5).max(300),
  village: z.string().trim().min(2).max(150),
  pin: z.string().regex(/^\d{6}$/),
  admissionYear: z.number().int().min(2000).max(2100),
  academicYear: z.string().regex(/^\d{4}-\d{4}$/),
  collegeId: z.string().min(1),
  branchId: z.string().min(1),
  courseId: z.string().min(1),
  totalFee: z.number().finite().positive().multipleOf(0.01),
  installments: z.array(z.object({ amount: z.number().finite().positive().multipleOf(0.01), dueDate: z.string().datetime() })).min(1).max(12)
}).superRefine((data, context) => {
  const installmentTotal = data.installments.reduce((sum, installment) => sum + installment.amount, 0);
  if (Math.abs(installmentTotal - data.totalFee) > 0.001) context.addIssue({ code: z.ZodIssueCode.custom, path: ['installments'], message: 'Installment total must equal total fee' });
  const [startYear, endYear] = data.academicYear.split('-').map(Number);
  if (startYear !== data.admissionYear || endYear! <= startYear!) context.addIssue({ code: z.ZodIssueCode.custom, path: ['academicYear'], message: 'Academic year must start with admission year' });
});
const offlinePaymentSchema = z.object({
  amount: z.number().finite().positive().multipleOf(0.01),
  mode: z.enum(['CASH', 'UPI']),
  referenceNumber: z.string().trim().max(100).optional(),
  paymentDate: z.string().datetime(),
  notes: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().uuid()
}).superRefine((data, context) => {
  if (data.mode === 'UPI' && !data.referenceNumber) context.addIssue({ code: z.ZodIssueCode.custom, path: ['referenceNumber'], message: 'UPI reference number is required' });
  if (new Date(data.paymentDate).getTime() > Date.now() + 60_000) context.addIssue({ code: z.ZodIssueCode.custom, path: ['paymentDate'], message: 'Payment date cannot be in the future' });
});

export function createAdminRouter(prisma: PrismaClient) {
  const router = Router();
  const jwtSecret = process.env.JWT_ACCESS_SECRET;
  if (!jwtSecret) throw new Error('JWT_ACCESS_SECRET is required');

  router.post('/auth/login', async (req, res, next) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error.issues);
    try {
      const user = await prisma.user.findUnique({ where: { adminId: parsed.data.adminId }, include: { roles: true, adminScopes: true } });
      const isCollegeAdmin = user?.roles.some((role) => role.role === 'COLLEGE_ADMIN') ?? false;
      const passwordMatches = user ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false;
      if (!user || !user.adminId || !user.isActive || !isCollegeAdmin || !passwordMatches) return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Admin ID or password is incorrect' } });
      const token = jwt.sign({ userId: user.id, adminId: user.adminId, role: 'COLLEGE_ADMIN' } satisfies AdminClaims, jwtSecret, { expiresIn: '8h' });
      await prisma.auditLog.create({ data: { userId: user.id, action: 'COLLEGE_ADMIN_LOGIN', entity: 'User', entityId: user.id, ipAddress: req.ip } });
      return res.json({ success: true, data: { accessToken: token, adminId: user.adminId, expiresIn: 28800 }, message: 'College Admin login successful' });
    } catch (error) { return next(error); }
  });

  router.use(authenticateAdmin(jwtSecret));

  router.get('/context', async (req: AdminRequest, res, next) => {
    try {
      const admin = await loadAdmin(prisma, req.admin!.userId);
      if (!admin) return forbidden(res);
      const courses = await prisma.course.findMany({ orderBy: { name: 'asc' } });
      return res.json({ success: true, data: {
        admin: { adminId: admin.adminId, email: admin.email },
        scopes: admin.adminScopes.map((scope) => ({ college: { id: scope.college.id, name: scope.college.name }, branch: scope.branch ? { id: scope.branch.id, name: scope.branch.name } : null })),
        courses: courses.map((course) => ({ id: course.id, name: course.name }))
      }, message: 'Admin context loaded' });
    } catch (error) { return next(error); }
  });

  router.get('/students/:studentUid', async (req: AdminRequest, res, next) => {
    const params = z.object({ studentUid: z.string().trim().min(1) }).safeParse(req.params);
    if (!params.success) return validationError(res, params.error.issues);
    try {
      const admin = await loadAdmin(prisma, req.admin!.userId);
      if (!admin) return forbidden(res);
      const student = await prisma.student.findUnique({ where: { studentUid: params.data.studentUid.toUpperCase() }, include: { college: { include: { location: { include: { state: true } } } }, branch: true, course: true, feeAssignments: { include: { installments: { include: { allocations: { include: { payment: true } } }, orderBy: { dueDate: 'asc' } }, discounts: { include: { discount: true } } } }, payments: { where: { status: PaymentStatus.SUCCESS }, include: { receipt: true }, orderBy: { createdAt: 'desc' } }, statusHistory: { orderBy: { createdAt: 'desc' } } } });
      if (!student) return res.status(404).json({ success: false, error: { code: 'STUDENT_NOT_FOUND', message: 'Student ID was not found' } });
      if (!isStudentInScope(admin.adminScopes, student.collegeId, student.branchId)) return forbidden(res);
      const assignment = student.feeAssignments[0];
      const totalFee = Number(assignment?.originalAmount ?? 0);
      const paid = student.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
      return res.json({ success: true, data: {
        student: { studentUid: student.studentUid, name: student.name, fatherName: student.fatherName, gender: student.gender, age: student.age, mobile: student.mobile, email: student.email, address: student.address, village: student.village, pin: student.pin, admissionYear: student.admissionYear, academicYear: student.academicYear, status: student.status, createdAt: student.createdAt.toISOString() },
        organization: { state: student.college.location.state.name, location: student.college.location.name, college: student.college.name, branch: student.branch.name, course: student.course.name },
        fees: { totalFee, paid, pending: Math.max(totalFee - paid, 0), installments: assignment?.installments.map((installment) => ({ id: installment.id, amount: Number(installment.amount), paid: installment.allocations.filter((allocation) => allocation.payment.status === PaymentStatus.SUCCESS).reduce((sum, allocation) => sum + Number(allocation.amount), 0), dueDate: installment.dueDate.toISOString() })) ?? [], discounts: assignment?.discounts.map((studentDiscount) => ({ name: studentDiscount.discount.name, amount: Number(studentDiscount.amount), approvedAt: studentDiscount.approvedAt.toISOString() })) ?? [] },
        payments: student.payments.map((payment) => ({ amount: Number(payment.amount), mode: payment.mode, reference: payment.reference, receiptNumber: payment.receipt?.receiptNumber, paidAt: payment.createdAt.toISOString() })),
        statusHistory: student.statusHistory
      }, message: 'Student details loaded' });
    } catch (error) { return next(error); }
  });

  router.post('/students', async (req: AdminRequest, res, next) => {
    const parsed = createStudentSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error.issues);
    try {
      const admin = await loadAdmin(prisma, req.admin!.userId);
      if (!admin) return forbidden(res);
      if (!isStudentInScope(admin.adminScopes, parsed.data.collegeId, parsed.data.branchId)) return forbidden(res);
      const branch = await prisma.branch.findUnique({ where: { id: parsed.data.branchId } });
      if (!branch || branch.collegeId !== parsed.data.collegeId) return res.status(400).json({ success: false, error: { code: 'INVALID_BRANCH', message: 'Branch does not belong to the selected college' } });
      const duplicateContact = await prisma.student.findFirst({ where: { OR: [{ mobile: parsed.data.mobile }, { email: parsed.data.email }] } });
      if (duplicateContact) return res.status(409).json({ success: false, error: { code: 'DUPLICATE_STUDENT_CONTACT', message: 'A student already uses this mobile number or email' } });
      const result = await prisma.$transaction(async (transaction) => {
        const feeStructure = await transaction.feeStructure.upsert({ where: { courseId_academicYear: { courseId: parsed.data.courseId, academicYear: parsed.data.academicYear } }, update: {}, create: { courseId: parsed.data.courseId, academicYear: parsed.data.academicYear, totalAmount: parsed.data.totalFee } });
        const student = await transaction.student.create({ data: { studentUid: parsed.data.studentUid, name: parsed.data.name, fatherName: parsed.data.fatherName, gender: parsed.data.gender, age: parsed.data.age, mobile: parsed.data.mobile, email: parsed.data.email, address: parsed.data.address, village: parsed.data.village, pin: parsed.data.pin, admissionYear: parsed.data.admissionYear, academicYear: parsed.data.academicYear, status: StudentStatus.ACTIVE, collegeId: parsed.data.collegeId, branchId: parsed.data.branchId, courseId: parsed.data.courseId } });
        const assignment = await transaction.feeAssignment.create({ data: { studentId: student.id, feeStructureId: feeStructure.id, originalAmount: parsed.data.totalFee } });
        await transaction.feeInstallment.createMany({ data: parsed.data.installments.map((installment) => ({ feeAssignmentId: assignment.id, amount: installment.amount, dueDate: new Date(installment.dueDate) })) });
        await transaction.studentStatusHistory.create({ data: { studentId: student.id, toStatus: StudentStatus.ACTIVE, reason: 'New admission', changedBy: admin.adminId ?? admin.id } });
        await transaction.auditLog.create({ data: { userId: admin.id, action: 'STUDENT_CREATED', entity: 'Student', entityId: student.id, ipAddress: req.ip, newData: { studentUid: student.studentUid, collegeId: student.collegeId, branchId: student.branchId, courseId: student.courseId, totalFee: parsed.data.totalFee } } });
        return { studentUid: student.studentUid, name: student.name, status: student.status, totalFee: parsed.data.totalFee, installmentCount: parsed.data.installments.length };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return res.status(201).json({ success: true, data: result, message: 'Student and fee plan created successfully' });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return res.status(409).json({ success: false, error: { code: 'DUPLICATE_STUDENT_ID', message: 'Student ID already exists' } });
      return next(error);
    }
  });

  router.post('/students/:studentUid/offline-payments', async (req: AdminRequest, res, next) => {
    const params = z.object({ studentUid: z.string().trim().min(1) }).safeParse(req.params);
    const parsed = offlinePaymentSchema.safeParse(req.body);
    if (!params.success) return validationError(res, params.error.issues);
    if (!parsed.success) return validationError(res, parsed.error.issues);
    try {
      const admin = await loadAdmin(prisma, req.admin!.userId);
      if (!admin) return forbidden(res);
      const idempotencyReference = `ADMIN-OFFLINE-${parsed.data.idempotencyKey}`;
      const result = await prisma.$transaction(async (transaction) => {
        const existing = await transaction.payment.findUnique({ where: { gatewayOrderId: idempotencyReference }, include: { receipt: true, student: true } });
        if (existing) return { studentUid: existing.student.studentUid, paymentId: existing.id, amount: Number(existing.amount), mode: existing.mode, transactionNumber: existing.reference ?? '', receiptNumber: existing.receipt?.receiptNumber ?? '', paidAt: existing.createdAt.toISOString() };
        const student = await transaction.student.findUnique({ where: { studentUid: params.data.studentUid.toUpperCase() }, include: { payments: { where: { status: PaymentStatus.SUCCESS } }, feeAssignments: { include: { installments: { include: { allocations: { include: { payment: true } } }, orderBy: { dueDate: 'asc' } } } } } });
        if (!student) throw new AdminPaymentError('STUDENT_NOT_FOUND', 'Student ID was not found', 404);
        if (!isStudentInScope(admin.adminScopes, student.collegeId, student.branchId)) throw new AdminPaymentError('FORBIDDEN', 'You do not have access to this student', 403);
        const assignment = student.feeAssignments[0];
        if (!assignment) throw new AdminPaymentError('FEE_ASSIGNMENT_NOT_FOUND', 'No fee assignment exists for this student', 409);
        const totalFee = Number(assignment.originalAmount);
        const paid = student.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
        const outstanding = Math.max(totalFee - paid, 0);
        if (parsed.data.amount > outstanding) throw new AdminPaymentError('AMOUNT_EXCEEDS_OUTSTANDING', `Payment cannot exceed ₹${outstanding.toLocaleString('en-IN')}`, 409);
        const token = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
        const transactionNumber = parsed.data.mode === 'UPI' ? parsed.data.referenceNumber! : `NSR-CASH-${token}`;
        const receiptNumber = `NSR-RCP-${token}`;
        const payment = await transaction.payment.create({ data: { studentId: student.id, amount: parsed.data.amount, mode: parsed.data.mode as PaymentMode, status: PaymentStatus.SUCCESS, reference: transactionNumber, gatewayOrderId: idempotencyReference, gatewayTransactionId: parsed.data.mode === 'UPI' ? transactionNumber : null, createdAt: new Date(parsed.data.paymentDate), rawResponse: { source: 'college-admin-offline', collectedBy: admin.adminId, notes: parsed.data.notes ?? null, recordedAt: new Date().toISOString() } } });
        let unallocated = parsed.data.amount;
        for (const installment of assignment.installments) {
          if (unallocated <= 0) break;
          const allocated = installment.allocations.filter((allocation) => allocation.payment.status === PaymentStatus.SUCCESS).reduce((sum, allocation) => sum + Number(allocation.amount), 0);
          const allocationAmount = Math.min(unallocated, Math.max(Number(installment.amount) - allocated, 0));
          if (allocationAmount > 0) { await transaction.paymentAllocation.create({ data: { paymentId: payment.id, installmentId: installment.id, amount: allocationAmount } }); unallocated -= allocationAmount; }
        }
        const receipt = await transaction.receipt.create({ data: { paymentId: payment.id, receiptNumber, issuedAt: new Date(parsed.data.paymentDate) } });
        await transaction.auditLog.create({ data: { userId: admin.id, action: 'OFFLINE_PAYMENT_RECORDED', entity: 'Payment', entityId: payment.id, ipAddress: req.ip, newData: { studentUid: student.studentUid, amount: parsed.data.amount, mode: parsed.data.mode, transactionNumber, receiptNumber, notes: parsed.data.notes ?? null } } });
        return { studentUid: student.studentUid, paymentId: payment.id, amount: Number(payment.amount), mode: payment.mode, transactionNumber, receiptNumber: receipt.receiptNumber, paidAt: payment.createdAt.toISOString(), outstandingAmount: outstanding - parsed.data.amount };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return res.status(201).json({ success: true, data: result, message: 'Offline payment recorded and receipt generated' });
    } catch (error) {
      if (error instanceof AdminPaymentError) return res.status(error.status).json({ success: false, error: { code: error.code, message: error.message } });
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return res.status(409).json({ success: false, error: { code: 'DUPLICATE_REFERENCE', message: 'This payment reference already exists' } });
      return next(error);
    }
  });

  return router;
}

function authenticateAdmin(secret: string) {
  return (req: AdminRequest, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) return res.status(401).json({ success: false, error: { code: 'AUTHENTICATION_REQUIRED', message: 'College Admin login is required' } });
    try {
      const claims = jwt.verify(token, secret) as AdminClaims;
      if (claims.role !== 'COLLEGE_ADMIN') return forbidden(res);
      req.admin = claims;
      return next();
    } catch { return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Admin session is invalid or expired' } }); }
  };
}

function loadAdmin(prisma: PrismaClient, userId: string) {
  return prisma.user.findFirst({ where: { id: userId, isActive: true, roles: { some: { role: 'COLLEGE_ADMIN' } } }, include: { adminScopes: { include: { college: true, branch: true } } } });
}

function isStudentInScope(scopes: Array<{ collegeId: string; branchId: string | null }>, collegeId: string, branchId: string) {
  return scopes.some((scope) => scope.collegeId === collegeId && (!scope.branchId || scope.branchId === branchId));
}

function validationError(res: Response, details: z.ZodIssue[]) {
  return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request details', details } });
}

function forbidden(res: Response) {
  return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this college or branch' } });
}

class AdminPaymentError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) { super(message); }
}
