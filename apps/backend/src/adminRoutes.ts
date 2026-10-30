import { PaymentMode, PaymentStatus, Prisma, PrismaClient, StudentStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomInt, randomUUID } from 'node:crypto';
import { NextFunction, Request, Response, Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import type { NotificationService } from './notifications.js';
import { studentIdPattern } from './studentAuth.js';

type AdminClaims = { userId: string; adminId: string; role: 'COLLEGE_ADMIN' };
type SuperAdminClaims = { userId: string; adminId: string; role: 'SUPER_ADMIN' };
type AdminRequest = Request & { admin?: AdminClaims };
type SuperAdminRequest = Request & { superAdmin?: SuperAdminClaims };

const loginSchema = z.object({ adminId: z.string().trim().min(8).max(40), password: z.string().min(8).max(128) });
const superAdminLoginSchema = loginSchema;
const provisionAdminSchema = z.object({
  adminId: z.string().trim().min(8).max(40).regex(/^[A-Za-z0-9-]+$/),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128).regex(/[A-Z]/).regex(/[a-z]/).regex(/\d/).regex(/[^A-Za-z0-9]/),
  collegeId: z.string().min(1),
  scopeType: z.enum(['COLLEGE', 'BRANCH']),
  branchId: z.string().min(1).optional()
}).superRefine((data, context) => {
  if (data.scopeType === 'BRANCH' && !data.branchId) context.addIssue({ code: z.ZodIssueCode.custom, path: ['branchId'], message: 'Select a branch for branch-specific access' });
});
const feePlanSchema = z.object({ feeStructureId: z.string().min(1) });
const programTypeSchema = z.enum(['INTERMEDIATE', 'IIT_JEE', 'NEET', 'OTHER']);
const courseSchema = z.object({
  name: z.string().trim().min(2).max(120),
  programType: programTypeSchema
});
const masterFeeSchema = z.object({
  courseId: z.string().min(1),
  academicYear: z.string().regex(/^\d{4}-\d{4}$/),
  totalAmount: z.number().finite().min(0.02).multipleOf(0.01)
}).superRefine((data, context) => {
  const [startYear, endYear] = data.academicYear.split('-').map(Number);
  if (endYear! <= startYear!) context.addIssue({ code: z.ZodIssueCode.custom, path: ['academicYear'], message: 'Academic year range is invalid' });
});
const optionalText = z.preprocess((value) => value === '' ? undefined : value, z.string().trim().max(120).optional());
const optionalDate = z.preprocess((value) => value === '' ? undefined : value, z.string().date().optional());
const createStudentSchema = z.object({
  name: z.string().trim().min(2).max(120),
  fatherName: z.string().trim().min(2).max(120),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  age: z.number().int().min(14).max(80),
  mobile: z.string().regex(/^[6-9]\d{9}$/),
  email: z.string().email(),
  motherName: optionalText,
  dateOfBirth: optionalDate,
  nationality: optionalText,
  religion: optionalText,
  casteCommunity: optionalText,
  mediumOfInstruction: optionalText,
  firstLanguage: optionalText,
  secondLanguage: optionalText,
  thirdLanguage: optionalText,
  address: z.string().trim().min(5).max(300),
  village: z.string().trim().min(2).max(150),
  pin: z.string().regex(/^\d{6}$/),
  admissionYear: z.number().int().min(2000).max(2100),
  academicYear: z.string().regex(/^\d{4}-\d{4}$/),
  collegeId: z.string().min(1),
  branchId: z.string().min(1),
  courseId: z.string().min(1),
  feeStructureId: z.string().min(1)
}).superRefine((data, context) => {
  const [startYear, endYear] = data.academicYear.split('-').map(Number);
  if (startYear !== data.admissionYear || endYear! <= startYear!) context.addIssue({ code: z.ZodIssueCode.custom, path: ['academicYear'], message: 'Academic year must start with admission year' });
});
export const offlinePaymentSchema = z.object({
  amount: z.number().finite().positive().multipleOf(0.01),
  mode: z.enum(['CASH', 'UPI']),
  feeCollectedBy: z.string().trim().min(2).max(120),
  referenceNumber: z.string().trim().max(100).optional(),
  paymentDate: z.string().datetime(),
  notes: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().uuid()
}).superRefine((data, context) => {
  if (data.mode === 'UPI' && !data.referenceNumber) context.addIssue({ code: z.ZodIssueCode.custom, path: ['referenceNumber'], message: 'UPI reference number is required' });
  if (new Date(data.paymentDate).getTime() > Date.now() + 60_000) context.addIssue({ code: z.ZodIssueCode.custom, path: ['paymentDate'], message: 'Payment date cannot be in the future' });
});
const certificateIssueSchema = z.object({
  certificateType: z.enum(['TRANSFER', 'BONAFIDE_CONDUCT']),
  fields: z.record(z.string().trim().max(500))
}).superRefine((data, context) => {
  if (Object.keys(data.fields).length > 30) context.addIssue({ code: z.ZodIssueCode.custom, path: ['fields'], message: 'Too many certificate fields' });
  if (!data.fields.pupilName?.trim()) context.addIssue({ code: z.ZodIssueCode.custom, path: ['fields', 'pupilName'], message: 'Student name is required' });
  if (!data.fields.conduct?.trim()) context.addIssue({ code: z.ZodIssueCode.custom, path: ['fields', 'conduct'], message: 'Conduct is required' });
});

export function createAdminRouter(prisma: PrismaClient, notifications: NotificationService) {
  const router = Router();
  const jwtSecret = process.env.JWT_ACCESS_SECRET;
  if (!jwtSecret) throw new Error('JWT_ACCESS_SECRET is required');

  router.post('/super-admin/auth/login', async (req, res, next) => {
    const parsed = superAdminLoginSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error.issues);
    try {
      const user = await prisma.user.findUnique({ where: { adminId: parsed.data.adminId }, include: { roles: true } });
      const isSuperAdmin = user?.roles.some((role) => role.role === 'SUPER_ADMIN') ?? false;
      const passwordMatches = user ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false;
      if (!user || !user.adminId || !user.isActive || !isSuperAdmin || !passwordMatches) return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Admin ID or password is incorrect' } });
      const token = jwt.sign({ userId: user.id, adminId: user.adminId, role: 'SUPER_ADMIN' } satisfies SuperAdminClaims, jwtSecret, { expiresIn: '8h' });
      await prisma.auditLog.create({ data: { userId: user.id, action: 'SUPER_ADMIN_LOGIN', entity: 'User', entityId: user.id, ipAddress: req.ip } });
      return res.json({ success: true, data: { accessToken: token, adminId: user.adminId, expiresIn: 28800 }, message: 'Super Admin login successful' });
    } catch (error) { return next(error); }
  });

  router.get('/super-admin/context', authenticateSuperAdmin(prisma, jwtSecret), async (_req, res, next) => {
    try {
      const colleges = await prisma.college.findMany({ include: { branches: { orderBy: { name: 'asc' } } }, orderBy: { name: 'asc' } });
      return res.json({ success: true, data: { colleges: colleges.map((college) => ({ id: college.id, name: college.name, branches: college.branches.map((branch) => ({ id: branch.id, name: branch.name })) })) }, message: 'Super Admin context loaded' });
    } catch (error) { return next(error); }
  });

  router.post('/super-admin/admins', authenticateSuperAdmin(prisma, jwtSecret), async (req: SuperAdminRequest, res, next) => {
    const parsed = provisionAdminSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error.issues);
    try {
      const college = await prisma.college.findUnique({ where: { id: parsed.data.collegeId } });
      if (!college) return res.status(400).json({ success: false, error: { code: 'INVALID_COLLEGE', message: 'Select a valid college' } });
      let branchId: string | null = null;
      if (parsed.data.scopeType === 'BRANCH') {
        const branch = await prisma.branch.findUnique({ where: { id: parsed.data.branchId } });
        if (!branch || branch.collegeId !== college.id) return res.status(400).json({ success: false, error: { code: 'INVALID_BRANCH', message: 'Select a branch belonging to the selected college' } });
        branchId = branch.id;
      }

      const email = parsed.data.email.toLowerCase();
      const passwordHash = await bcrypt.hash(parsed.data.password, 12);
      const created = await prisma.$transaction(async (transaction) => {
        const user = await transaction.user.create({
          data: {
            adminId: parsed.data.adminId.toUpperCase(),
            email,
            passwordHash,
            isActive: true,
            roles: { create: { role: 'COLLEGE_ADMIN' } },
            adminScopes: { create: { collegeId: college.id, branchId } }
          }
        });
        await transaction.auditLog.create({
          data: {
            userId: req.superAdmin!.userId,
            action: 'COLLEGE_ADMIN_PROVISIONED',
            entity: 'User',
            entityId: user.id,
            ipAddress: req.ip,
            newData: { adminId: user.adminId, email: user.email, collegeId: college.id, branchId }
          }
        });
        return user;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      return res.status(201).json({ success: true, data: { adminId: created.adminId, email: created.email, college: college.name, scope: parsed.data.scopeType === 'COLLEGE' ? 'All branches' : 'Selected branch' }, message: 'College Admin account created' });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return res.status(409).json({ success: false, error: { code: 'ADMIN_ALREADY_EXISTS', message: 'That Admin ID or email is already in use' } });
      return next(error);
    }
  });

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
      const courses = await prisma.course.findMany({ orderBy: [{ programType: 'asc' }, { name: 'asc' }] });
      return res.json({
        success: true, data: {
          admin: { adminId: admin.adminId, email: admin.email },
          scopes: admin.adminScopes.map((scope) => ({ college: { id: scope.college.id, name: scope.college.name }, branch: scope.branch ? { id: scope.branch.id, name: scope.branch.name } : null })),
          courses: courses.map((course) => ({ id: course.id, name: course.name, programType: course.programType }))
        }, message: 'Admin context loaded'
      });
    } catch (error) { return next(error); }
  });
  router.get('/fee-options', async (req: AdminRequest, res, next) => {
    const parsed = z.object({
      courseId: z.string().min(1),
      academicYear: z.string().regex(/^\d{4}-\d{4}$/)
    }).safeParse(req.query);
    if (!parsed.success) return validationError(res, parsed.error.issues);
    try {
      const options = await prisma.feeStructure.findMany({
        where: { courseId: parsed.data.courseId, academicYear: parsed.data.academicYear },
        include: { course: true }
      });
      return res.json({
        success: true,
        data: options.map((option) => ({
          id: option.id,
          courseId: option.courseId,
          courseName: option.course.name,
          academicYear: option.academicYear,
          totalAmount: Number(option.totalAmount)
        })),
        message: 'Master fee options loaded'
      });
    } catch (error) { return next(error); }
  });
  router.get('/students/pending', async (req: AdminRequest, res, next) => {
    try {
      const admin = await loadAdmin(prisma, req.admin!.userId);
      if (!admin) return forbidden(res);
      const scopeFilters = admin.adminScopes.map((scope) => ({
        collegeId: scope.collegeId,
        ...(scope.branchId ? { branchId: scope.branchId } : {})
      }));
      if (scopeFilters.length === 0) return res.json({ success: true, data: [], message: 'Pending students loaded' });
      const students = await prisma.student.findMany({
        where: { status: StudentStatus.ON_HOLD, OR: scopeFilters },
        include: {
          college: true,
          branch: true,
          course: { include: { feeStructures: true } }
        },
        orderBy: { createdAt: 'asc' }
      });
      return res.json({
        success: true,
        data: students.map((student) => ({
          id: student.id,
          studentUid: student.studentUid,
          name: student.name,
          status: student.status,
          academicYear: student.academicYear,
          college: student.college,
          branch: student.branch,
          course: student.course,
          feeOptions: student.course.feeStructures
            .filter((fee) => fee.academicYear === student.academicYear)
            .map((fee) => ({ id: fee.id, totalAmount: Number(fee.totalAmount), academicYear: fee.academicYear }))
        })),
        message: 'Pending students loaded'
      });
    } catch (error) { return next(error); }
  });
  router.post('/students/:studentUid/approve', async (req: AdminRequest, res, next) => {
    const params = z.object({ studentUid: z.string().trim().regex(studentIdPattern) }).safeParse(req.params);
    const parsed = feePlanSchema.safeParse(req.body);
    if (!params.success) return validationError(res, params.error.issues);
    if (!parsed.success) return validationError(res, parsed.error.issues);
    try {
      const admin = await loadAdmin(prisma, req.admin!.userId);
      if (!admin) return forbidden(res);
      const student = await prisma.student.findUnique({
        where: { studentUid: params.data.studentUid.toUpperCase() },
        include: { feeAssignments: { where: { isCurrent: true } } }
      });
      if (!student) return res.status(404).json({ success: false, error: { code: 'STUDENT_NOT_FOUND', message: 'Student ID was not found' } });
      if (!isStudentInScope(admin.adminScopes, student.collegeId, student.branchId)) return forbidden(res);
      if (student.status !== StudentStatus.ON_HOLD) return res.status(409).json({ success: false, error: { code: 'STUDENT_NOT_PENDING', message: 'Only pending students can be approved' } });
      if (student.feeAssignments.length > 0) return res.status(409).json({ success: false, error: { code: 'CURRENT_FEE_PLAN_CONFLICT', message: 'This student already has a current fee assignment' } });

      const result = await prisma.$transaction(async (transaction) => {
        const feeStructure = await transaction.feeStructure.findUnique({ where: { id: parsed.data.feeStructureId } });
        if (!feeStructure || feeStructure.courseId !== student.courseId || feeStructure.academicYear !== student.academicYear) {
          throw new InvalidFeeStructureError('The selected master fee does not match this student’s course and academic year.');
        }
        const amount = Number(feeStructure.totalAmount);
        const firstInstallment = Math.round((amount / 2) * 100) / 100;
        const assignment = await transaction.feeAssignment.create({
          data: { studentId: student.id, feeStructureId: feeStructure.id, originalAmount: feeStructure.totalAmount, isCurrent: true }
        });
        await transaction.feeInstallment.createMany({
          data: [
            { feeAssignmentId: assignment.id, amount: firstInstallment, dueDate: new Date(Date.UTC(student.admissionYear, 6, 1)) },
            { feeAssignmentId: assignment.id, amount: amount - firstInstallment, dueDate: new Date(Date.UTC(student.admissionYear + 1, 6, 1)) }
          ]
        });
        await transaction.student.update({ where: { id: student.id }, data: { status: StudentStatus.ACTIVE } });
        await transaction.studentStatusHistory.create({
          data: { studentId: student.id, fromStatus: StudentStatus.ON_HOLD, toStatus: StudentStatus.ACTIVE, reason: 'Approved and assigned master fee', changedBy: admin.adminId ?? admin.id }
        });
        await transaction.auditLog.create({
          data: {
            userId: admin.id, action: 'STUDENT_APPROVED', entity: 'Student', entityId: student.id, ipAddress: req.ip,
            newData: { studentUid: student.studentUid, feeStructureId: feeStructure.id, totalFee: amount }
          }
        });
        return { studentUid: student.studentUid, feeAssignmentId: assignment.id, totalFee: amount };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return res.json({ success: true, data: result, message: 'Student approved and master fee assigned' });
    } catch (error) {
      if (error instanceof InvalidFeeStructureError) return res.status(400).json({ success: false, error: { code: 'INVALID_FEE_STRUCTURE', message: error.message } });
      return next(error);
    }
  });
  router.get('/students/:studentUid', async (req: AdminRequest, res, next) => {
    const params = z.object({ studentUid: z.string().trim().min(1) }).safeParse(req.params);
    if (!params.success) return validationError(res, params.error.issues);
    try {
      const admin = await loadAdmin(prisma, req.admin!.userId);
      if (!admin) return forbidden(res);

      const rawInput = params.data.studentUid;
      const normalizedStudentUid = rawInput.toLowerCase().startsWith('demo-')
        ? rawInput.toLowerCase()
        : rawInput.toUpperCase();

      const student = await prisma.student.findUnique({
        where: { studentUid: normalizedStudentUid },
        include: {
          college: { include: { location: { include: { state: true } } } },
          branch: true,
          course: true,
          feeAssignments: {
            include: {
              installments: {
                include: {
                  allocations: { include: { payment: true } }
                },
                orderBy: { dueDate: 'asc' }
              },
              discounts: { include: { discount: true } }
            }
          },
          payments: {
            where: { status: PaymentStatus.SUCCESS },
            include: { receipt: true },
            orderBy: { createdAt: 'desc' }
          },
          statusHistory: { orderBy: { createdAt: 'desc' } }
        }
      });

      if (!student) return res.status(404).json({ success: false, error: { code: 'STUDENT_NOT_FOUND', message: 'Student ID was not found' } });
      if (!isStudentInScope(admin.adminScopes, student.collegeId, student.branchId)) return forbidden(res);

      // ✅ RESTORED: Find the active fee assignment using isCurrent
      const assignment = student.feeAssignments.find((feeAssignment) => feeAssignment.isCurrent);

      const originalFee = Number(assignment?.originalAmount ?? 0);
      const discountTotal = assignment?.discounts.reduce((sum, discount) => sum + Number(discount.amount), 0) ?? 0;
      const totalFee = originalFee;
      const paid = student.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);

      return res.json({
        success: true, data: {
          student: {
            studentUid: student.studentUid, name: student.name, fatherName: student.fatherName, motherName: student.motherName,
            dateOfBirth: student.dateOfBirth?.toISOString().slice(0, 10) ?? null, nationality: student.nationality, religion: student.religion,
            casteCommunity: student.casteCommunity, mediumOfInstruction: student.mediumOfInstruction, firstLanguage: student.firstLanguage,
            secondLanguage: student.secondLanguage, thirdLanguage: student.thirdLanguage, gender: student.gender, age: student.age,
            mobile: student.mobile, email: student.email, address: student.address, village: student.village, pin: student.pin,
            admissionYear: student.admissionYear, academicYear: student.academicYear, status: student.status, createdAt: student.createdAt.toISOString()
          },
          organization: { state: student.college.location.state.name, location: student.college.location.name, college: student.college.name, branch: student.branch.name, course: student.course.name },
          fees: {
            totalFee, paid, pending: Math.max(totalFee - discountTotal - paid, 0),
            installments: assignment?.installments.map((installment) => ({
              id: installment.id, amount: Number(installment.amount),
              paid: installment.allocations.filter((allocation) => allocation.payment.status === PaymentStatus.SUCCESS).reduce((sum, allocation) => sum + Number(allocation.amount), 0),
              dueDate: installment.dueDate.toISOString()
            })) ?? [],
            discounts: assignment?.discounts.map((studentDiscount) => ({ name: studentDiscount.discount.name, amount: Number(studentDiscount.amount), approvedAt: studentDiscount.approvedAt.toISOString() })) ?? []
          },
          payments: student.payments.map((payment) => ({ amount: Number(payment.amount), mode: payment.mode, reference: payment.reference, receiptNumber: payment.receipt?.receiptNumber, paidAt: payment.createdAt.toISOString() })),
          statusHistory: student.statusHistory
        }, message: 'Student details loaded'
      });
    } catch (error) { return next(error); }
  });

  router.post('/students/:studentUid/fee-plan', async (req: AdminRequest, res, next) => {
    const params = z.object({ studentUid: z.string().trim().regex(studentIdPattern) }).safeParse(req.params);
    const parsed = feePlanSchema.safeParse(req.body);
    if (!params.success) return validationError(res, params.error.issues);
    if (!parsed.success) return validationError(res, parsed.error.issues);
    try {
      const admin = await loadAdmin(prisma, req.admin!.userId);
      if (!admin) return forbidden(res);
      const student = await prisma.student.findUnique({
        where: { studentUid: params.data.studentUid.toUpperCase() },
        include: { feeAssignments: { where: { isCurrent: true } }, course: true }
      });
      if (!student) return res.status(404).json({ success: false, error: { code: 'STUDENT_NOT_FOUND', message: 'Student ID was not found' } });
      if (!isStudentInScope(admin.adminScopes, student.collegeId, student.branchId)) return forbidden(res);
      if (student.status !== StudentStatus.ACTIVE) return res.status(409).json({ success: false, error: { code: 'STUDENT_NOT_ACTIVE', message: 'A fee plan can only be assigned to an active student' } });
      if (student.feeAssignments.length > 0) return res.status(409).json({ success: false, error: { code: 'CURRENT_FEE_PLAN_CONFLICT', message: 'A fee plan is already assigned and cannot be replaced by a College Admin' } });

      const feeStructure = await prisma.feeStructure.findUnique({ where: { id: parsed.data.feeStructureId } });
      if (!feeStructure || feeStructure.courseId !== student.courseId || feeStructure.academicYear !== student.academicYear) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_FEE_STRUCTURE', message: 'The selected master fee does not match this student’s course and academic year.' } });
      }
      const totalFee = Number(feeStructure.totalAmount);
      const firstInstallment = Math.round((totalFee / 2) * 100) / 100;
      const assignment = await prisma.$transaction(async (transaction) => {
        const createdAssignment = await transaction.feeAssignment.create({
          data: { studentId: student.id, feeStructureId: feeStructure.id, originalAmount: feeStructure.totalAmount, isCurrent: true }
        });
        await transaction.feeInstallment.createMany({
          data: [
            { feeAssignmentId: createdAssignment.id, amount: firstInstallment, dueDate: new Date(Date.UTC(student.admissionYear, 6, 1)) },
            { feeAssignmentId: createdAssignment.id, amount: totalFee - firstInstallment, dueDate: new Date(Date.UTC(student.admissionYear + 1, 6, 1)) }
          ]
        });
        await transaction.auditLog.create({
          data: {
            userId: admin.id, action: 'STUDENT_FEE_PLAN_ASSIGNED', entity: 'Student', entityId: student.id, ipAddress: req.ip,
            newData: { studentUid: student.studentUid, feeAssignmentId: createdAssignment.id, feeStructureId: feeStructure.id, totalFee }
          }
        });
        return createdAssignment;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return res.status(201).json({ success: true, data: { studentUid: student.studentUid, feeAssignmentId: assignment.id, totalFee, installmentCount: 2 }, message: 'Master fee assigned to student' });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return res.status(409).json({ success: false, error: { code: 'CURRENT_FEE_PLAN_CONFLICT', message: 'A current fee plan already exists. Reload the student record and try again.' } });
      return next(error);
    }
  });

  router.post('/students/:studentUid/certificates/issue', async (req: AdminRequest, res, next) => {
    const params = z.object({ studentUid: z.string().trim().regex(studentIdPattern) }).safeParse(req.params);
    const parsed = certificateIssueSchema.safeParse(req.body);
    if (!params.success) return validationError(res, params.error.issues);
    if (!parsed.success) return validationError(res, parsed.error.issues);
    try {
      const admin = await loadAdmin(prisma, req.admin!.userId);
      if (!admin) return forbidden(res);
      const student = await prisma.student.findUnique({
        where: { studentUid: params.data.studentUid.toUpperCase() },
        include: { payments: { where: { status: PaymentStatus.SUCCESS } }, feeAssignments: true }
      });
      if (!student) return res.status(404).json({ success: false, error: { code: 'STUDENT_NOT_FOUND', message: 'Student ID was not found' } });
      if (!isStudentInScope(admin.adminScopes, student.collegeId, student.branchId)) return forbidden(res);
      const totalFee = Number(student.feeAssignments.find((feeAssignment) => feeAssignment.isCurrent)?.originalAmount ?? 0);
      const paidAmount = student.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
      const outstandingAmount = Math.max(totalFee - paidAmount, 0);
      const audit = await prisma.auditLog.create({
        data: {
          userId: admin.id,
          action: 'STUDENT_CERTIFICATE_GENERATED',
          entity: 'Student',
          entityId: student.id,
          ipAddress: req.ip,
          newData: { certificateType: parsed.data.certificateType, fields: parsed.data.fields, outstandingAmount }
        }
      });
      return res.status(201).json({ success: true, data: { auditId: audit.id, studentUid: student.studentUid, outstandingAmount }, message: 'Certificate generation recorded' });
    } catch (error) { return next(error); }
  });

  router.post('/students', async (req: AdminRequest, res, next) => {
    const parsed = createStudentSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error.issues);
    try {
      const admin = await loadAdmin(prisma, req.admin!.userId);
      if (!admin) return forbidden(res);
      if (!isStudentInScope(admin.adminScopes, parsed.data.collegeId, parsed.data.branchId)) return forbidden(res);
      const branch = await prisma.branch.findUnique({ where: { id: parsed.data.branchId }, include: { college: { include: { location: true } } } });
      if (!branch || branch.collegeId !== parsed.data.collegeId) return res.status(400).json({ success: false, error: { code: 'INVALID_BRANCH', message: 'Branch does not belong to the selected college' } });
      const normalizedEmail = parsed.data.email.toLowerCase();
      const duplicateContact = await prisma.student.findFirst({ where: { OR: [{ mobile: parsed.data.mobile }, { email: normalizedEmail }] } });
      if (duplicateContact) return res.status(409).json({ success: false, error: { code: 'DUPLICATE_STUDENT_CONTACT', message: 'A student already uses this mobile number or email' } });
      const temporaryPassword = generateTemporaryPassword();
      const passwordHash = await bcrypt.hash(temporaryPassword, 12);
      const result = await prisma.$transaction(async (transaction) => {
        const studentUid = await generateStudentUid(transaction, branch.college.location.name);
        const feeStructure = await transaction.feeStructure.findUnique({ where: { id: parsed.data.feeStructureId } });
        if (!feeStructure || feeStructure.courseId !== parsed.data.courseId || feeStructure.academicYear !== parsed.data.academicYear) {
          throw new InvalidFeeStructureError('Select the configured master fee for the student course and academic year.');
        }
        const student = await transaction.student.create({ data: { studentUid, name: parsed.data.name, fatherName: parsed.data.fatherName, motherName: parsed.data.motherName, dateOfBirth: parsed.data.dateOfBirth ? new Date(`${parsed.data.dateOfBirth}T00:00:00.000Z`) : undefined, nationality: parsed.data.nationality, religion: parsed.data.religion, casteCommunity: parsed.data.casteCommunity, mediumOfInstruction: parsed.data.mediumOfInstruction, firstLanguage: parsed.data.firstLanguage, secondLanguage: parsed.data.secondLanguage, thirdLanguage: parsed.data.thirdLanguage, gender: parsed.data.gender, age: parsed.data.age, mobile: parsed.data.mobile, email: normalizedEmail, address: parsed.data.address, village: parsed.data.village, pin: parsed.data.pin, admissionYear: parsed.data.admissionYear, academicYear: parsed.data.academicYear, status: StudentStatus.ACTIVE, collegeId: parsed.data.collegeId, branchId: parsed.data.branchId, courseId: parsed.data.courseId } });
        const account = await transaction.studentAccount.create({ data: { studentId: student.id, email: normalizedEmail, passwordHash, mustChangePassword: true } });
        const totalFee = Number(feeStructure.totalAmount);
        const firstInstallment = Math.round((totalFee / 2) * 100) / 100;
        const assignment = await transaction.feeAssignment.create({ data: { studentId: student.id, feeStructureId: feeStructure.id, originalAmount: feeStructure.totalAmount, isCurrent: true } });
        await transaction.feeInstallment.createMany({
          data: [
            { feeAssignmentId: assignment.id, amount: firstInstallment, dueDate: new Date(Date.UTC(student.admissionYear, 6, 1)) },
            { feeAssignmentId: assignment.id, amount: totalFee - firstInstallment, dueDate: new Date(Date.UTC(student.admissionYear + 1, 6, 1)) }
          ]
        });
        await transaction.studentStatusHistory.create({ data: { studentId: student.id, toStatus: StudentStatus.ACTIVE, reason: 'New admission', changedBy: admin.adminId ?? admin.id } });
        try {
          await notifications.sendEmail(normalizedEmail, 'Your NSR Impulse student account', `Hello ${student.name},\n\nYour student account has been created.\nStudent ID: ${student.studentUid}\nTemporary password: ${temporaryPassword}\n\nSign in and change this temporary password immediately. Do not share these credentials.\n`);
        } catch (deliveryError) {
          console.error('Student credential email delivery failed', deliveryError);
          throw new AdminCredentialDeliveryError();
        }
        await transaction.auditLog.create({ data: { userId: admin.id, action: 'STUDENT_CREATED', entity: 'Student', entityId: student.id, ipAddress: req.ip, newData: { studentUid: student.studentUid, accountId: account.id, credentialsDeliveredTo: normalizedEmail, collegeId: student.collegeId, branchId: student.branchId, courseId: student.courseId, feeStructureId: feeStructure.id, totalFee } } });
        return { studentUid: student.studentUid, name: student.name, status: student.status, totalFee, installmentCount: 2 };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
      return res.status(201).json({ success: true, data: result, message: 'Student account created and credentials sent by email' });
    } catch (error) {
      if (error instanceof InvalidFeeStructureError) return res.status(400).json({ success: false, error: { code: 'INVALID_FEE_STRUCTURE', message: error.message } });
      if (error instanceof AdminCredentialDeliveryError) return res.status(503).json({ success: false, error: { code: 'CREDENTIAL_DELIVERY_UNAVAILABLE', message: 'Student credentials could not be delivered. Check email provider configuration and try again.' } });
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
        if (existing) {
          const rawResponse = existing.rawResponse && typeof existing.rawResponse === 'object' && !Array.isArray(existing.rawResponse)
            ? existing.rawResponse as Prisma.JsonObject
            : null;
          const feeCollectedBy = typeof rawResponse?.feeCollectedBy === 'string'
            ? rawResponse.feeCollectedBy
            : typeof rawResponse?.collectedBy === 'string' ? rawResponse.collectedBy : admin.adminId;
          return { studentUid: existing.student.studentUid, paymentId: existing.id, amount: Number(existing.amount), mode: existing.mode, transactionNumber: existing.reference ?? '', receiptNumber: existing.receipt?.receiptNumber ?? '', paidAt: existing.createdAt.toISOString(), feeCollectedBy };
        }
        const student = await transaction.student.findUnique({ where: { studentUid: params.data.studentUid.toUpperCase() }, include: { payments: { where: { status: PaymentStatus.SUCCESS } }, feeAssignments: { include: { discounts: true, installments: { include: { allocations: { include: { payment: true } } }, orderBy: { dueDate: 'asc' } } } } } });
        if (!student) throw new AdminPaymentError('STUDENT_NOT_FOUND', 'Student ID was not found', 404);
        if (!isStudentInScope(admin.adminScopes, student.collegeId, student.branchId)) throw new AdminPaymentError('FORBIDDEN', 'You do not have access to this student', 403);
        const assignment = student.feeAssignments.find((feeAssignment) => feeAssignment.isCurrent);
        if (!assignment) throw new AdminPaymentError('FEE_ASSIGNMENT_NOT_FOUND', 'No fee assignment exists for this student', 409);
        const originalFee = Number(assignment.originalAmount);
        const discountTotal = assignment.discounts.reduce((sum, discount) => sum + Number(discount.amount), 0);
        const totalFee = Math.max(0, originalFee - discountTotal);
        const paid = student.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
        const outstanding = Math.max(totalFee - paid, 0);
        if (parsed.data.amount > outstanding) throw new AdminPaymentError('AMOUNT_EXCEEDS_OUTSTANDING', `Payment cannot exceed ₹${outstanding.toLocaleString('en-IN')}`, 409);
        const token = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
        const transactionNumber = parsed.data.mode === 'UPI' ? parsed.data.referenceNumber! : `NSR-CASH-${token}`;
        const receiptNumber = `NSR-RCP-${token}`;
        const payment = await transaction.payment.create({ data: { studentId: student.id, amount: parsed.data.amount, mode: parsed.data.mode as PaymentMode, status: PaymentStatus.SUCCESS, reference: transactionNumber, gatewayOrderId: idempotencyReference, gatewayTransactionId: parsed.data.mode === 'UPI' ? transactionNumber : null, createdAt: new Date(parsed.data.paymentDate), rawResponse: { source: 'college-admin-offline', collectedBy: admin.adminId, feeCollectedBy: parsed.data.feeCollectedBy, notes: parsed.data.notes ?? null, recordedAt: new Date().toISOString() } } });
        let unallocated = parsed.data.amount;
        for (const installment of assignment.installments) {
          if (unallocated <= 0) break;
          const allocated = installment.allocations.filter((allocation) => allocation.payment.status === PaymentStatus.SUCCESS).reduce((sum, allocation) => sum + Number(allocation.amount), 0);
          const allocationAmount = Math.min(unallocated, Math.max(Number(installment.amount) - allocated, 0));
          if (allocationAmount > 0) { await transaction.paymentAllocation.create({ data: { paymentId: payment.id, installmentId: installment.id, amount: allocationAmount } }); unallocated -= allocationAmount; }
        }
        const receipt = await transaction.receipt.create({ data: { paymentId: payment.id, receiptNumber, issuedAt: new Date(parsed.data.paymentDate) } });
        await transaction.auditLog.create({ data: { userId: admin.id, action: 'OFFLINE_PAYMENT_RECORDED', entity: 'Payment', entityId: payment.id, ipAddress: req.ip, newData: { studentUid: student.studentUid, amount: parsed.data.amount, mode: parsed.data.mode, transactionNumber, receiptNumber, feeCollectedBy: parsed.data.feeCollectedBy, notes: parsed.data.notes ?? null } } });
        return { studentUid: student.studentUid, paymentId: payment.id, amount: Number(payment.amount), mode: payment.mode, transactionNumber, receiptNumber: receipt.receiptNumber, paidAt: payment.createdAt.toISOString(), outstandingAmount: outstanding - parsed.data.amount, feeCollectedBy: parsed.data.feeCollectedBy };
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

export function createSuperAdminRouter(prisma: PrismaClient) {
  const router = Router();
  const jwtSecret = process.env.JWT_ACCESS_SECRET;
  if (!jwtSecret) throw new Error('JWT_ACCESS_SECRET is required');

  router.post('/auth/login', async (req, res, next) => {
    const parsed = superAdminLoginSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error.issues);
    try {
      const user = await prisma.user.findUnique({ where: { adminId: parsed.data.adminId }, include: { roles: true } });
      const isSuperAdmin = user?.roles.some((role) => role.role === 'SUPER_ADMIN') ?? false;
      const passwordMatches = user ? await bcrypt.compare(parsed.data.password, user.passwordHash) : false;
      if (!user || !user.adminId || !user.isActive || !isSuperAdmin || !passwordMatches) return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Admin ID or password is incorrect' } });
      const token = jwt.sign({ userId: user.id, adminId: user.adminId, role: 'SUPER_ADMIN' } satisfies SuperAdminClaims, jwtSecret, { expiresIn: '8h' });
      await prisma.auditLog.create({ data: { userId: user.id, action: 'SUPER_ADMIN_LOGIN', entity: 'User', entityId: user.id, ipAddress: req.ip } });
      return res.json({ success: true, data: { token, accessToken: token, adminId: user.adminId, expiresIn: 28800 }, message: 'Super Admin login successful' });
    } catch (error) { return next(error); }
  });

  router.use(authenticateSuperAdmin(prisma, jwtSecret));

  router.get('/context', async (req: SuperAdminRequest, res, next) => {
    try {
      const [user, colleges, courses, admins] = await Promise.all([
        prisma.user.findUnique({ where: { id: req.superAdmin!.userId }, select: { id: true, email: true, adminId: true } }),
        prisma.college.findMany({ include: { branches: { orderBy: { name: 'asc' } } }, orderBy: { name: 'asc' } }),
        prisma.course.findMany({ orderBy: [{ programType: 'asc' }, { name: 'asc' }] }),
        prisma.user.findMany({
          where: { OR: [{ roles: { some: { role: 'COLLEGE_ADMIN' } } }, { adminScopes: { some: {} } }] },
          include: { adminScopes: { include: { college: true, branch: true } } },
          orderBy: { adminId: 'asc' }
        })
      ]);
      return res.json({
        success: true,
        data: {
          superAdmin: user ? { id: user.id, email: user.email, adminId: user.adminId ?? req.superAdmin!.adminId } : null,
          colleges: colleges.map((college) => ({ id: college.id, name: college.name, branches: college.branches.map((branch) => ({ id: branch.id, name: branch.name })) })),
          courses: courses.map((course) => ({ id: course.id, name: course.name, programType: course.programType })),
          admins: admins.map((admin) => ({
            id: admin.id,
            adminId: admin.adminId ?? 'N/A',
            email: admin.email,
            isActive: admin.isActive,
            scopes: admin.adminScopes.map((scope) => ({
              college: { id: scope.college.id, name: scope.college.name },
              branch: scope.branch ? { id: scope.branch.id, name: scope.branch.name } : null
            }))
          }))
        },
        message: 'Super Admin context loaded'
      });
    } catch (error) { return next(error); }
  });

  router.get('/overview', async (_req: SuperAdminRequest, res, next) => {
    const parsed = z.object({
      collegeId: z.string().min(1).optional(),
      branchId: z.string().min(1).optional(),
      courseId: z.string().min(1).optional()
    }).safeParse(_req.query);
    if (!parsed.success) return validationError(res, parsed.error.issues);
    try {
      const { collegeId, branchId, courseId } = parsed.data;
      if (collegeId && !await prisma.college.findUnique({ where: { id: collegeId }, select: { id: true } })) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_COLLEGE', message: 'Select a valid college' } });
      }
      if (branchId) {
        const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true, collegeId: true } });
        if (!branch || (collegeId && branch.collegeId !== collegeId)) {
          return res.status(400).json({ success: false, error: { code: 'INVALID_BRANCH', message: 'Select a branch belonging to the selected college' } });
        }
      }
      if (courseId && !await prisma.course.findUnique({ where: { id: courseId }, select: { id: true } })) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_COURSE', message: 'Select a valid course' } });
      }

      const studentWhere: Prisma.StudentWhereInput = {
        ...(collegeId ? { collegeId } : {}),
        ...(branchId ? { branchId } : {}),
        ...(courseId ? { courseId } : {})
      };
      const [totalStudents, statusCounts, branchCounts, courseCounts, admissionCounts, branches, courses] = await Promise.all([
        prisma.student.count({ where: studentWhere }),
        prisma.student.groupBy({ by: ['status'], where: studentWhere, _count: { _all: true } }),
        prisma.student.groupBy({ by: ['branchId'], where: studentWhere, _count: { _all: true } }),
        prisma.student.groupBy({ by: ['courseId'], where: studentWhere, _count: { _all: true } }),
        prisma.student.groupBy({ by: ['admissionYear'], where: studentWhere, _count: { _all: true }, orderBy: { admissionYear: 'asc' } }),
        prisma.branch.findMany({
          where: {
            ...(collegeId ? { collegeId } : {}),
            ...(branchId ? { id: branchId } : {})
          },
          include: { college: { select: { name: true } } },
          orderBy: [{ college: { name: 'asc' } }, { name: 'asc' }]
        }),
        prisma.course.findMany({
          where: courseId ? { id: courseId } : {},
          orderBy: [{ programType: 'asc' }, { name: 'asc' }]
        })
      ]);
      const branchCountMap = new Map(branchCounts.map((entry) => [entry.branchId, entry._count._all]));
      const courseCountMap = new Map(courseCounts.map((entry) => [entry.courseId, entry._count._all]));
      const activeStudents = statusCounts.find((entry) => entry.status === StudentStatus.ACTIVE)?._count._all ?? 0;
      const addedSince = new Date();
      addedSince.setDate(addedSince.getDate() - 30);
      const recentStudents = await prisma.student.count({
        where: { ...studentWhere, createdAt: { gte: addedSince } }
      });

      return res.json({
        success: true,
        data: {
          totalStudents,
          activeStudents,
          recentStudents,
          branches: branches.map((branch) => ({
            branchId: branch.id,
            branchName: branch.name,
            collegeName: branch.college.name,
            studentCount: branchCountMap.get(branch.id) ?? 0
          })),
          courses: courses.map((course) => ({
            courseId: course.id,
            courseName: course.name,
            programType: course.programType,
            studentCount: courseCountMap.get(course.id) ?? 0
          })),
          admissionsByYear: admissionCounts.map((entry) => ({
            year: entry.admissionYear,
            studentCount: entry._count._all
          })),
          studentsByStatus: statusCounts.map((entry) => ({
            status: entry.status,
            studentCount: entry._count._all
          }))
        },
        message: 'Super Admin overview analytics loaded'
      });
    } catch (error) { return next(error); }
  });

  router.get('/courses', async (_req, res, next) => {
    try {
      const courses = await prisma.course.findMany({ orderBy: [{ programType: 'asc' }, { name: 'asc' }] });
      return res.json({ success: true, data: courses, message: 'Courses loaded' });
    } catch (error) { return next(error); }
  });

  router.post('/courses', async (req: SuperAdminRequest, res, next) => {
    const parsed = courseSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error.issues);
    try {
      const course = await prisma.course.create({ data: parsed.data });
      await prisma.auditLog.create({
        data: { userId: req.superAdmin!.userId, action: 'MASTER_COURSE_CREATED', entity: 'Course', entityId: course.id, ipAddress: req.ip, newData: parsed.data }
      });
      return res.status(201).json({ success: true, data: course, message: 'Master course created' });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return res.status(409).json({ success: false, error: { code: 'COURSE_ALREADY_EXISTS', message: 'A course with this program type and name already exists' } });
      return next(error);
    }
  });

  router.get('/fee-structures', async (_req, res, next) => {
    try {
      const structures = await prisma.feeStructure.findMany({
        include: { course: true },
        orderBy: [{ academicYear: 'desc' }]
      });
      return res.json({
        success: true,
        data: structures.map((fee) => ({ ...fee, totalAmount: Number(fee.totalAmount) })),
        message: 'Master fee structures loaded'
      });
    } catch (error) { return next(error); }
  });

  router.post('/fee-structures', async (req: SuperAdminRequest, res, next) => {
    const parsed = masterFeeSchema.safeParse(req.body);
    if (!parsed.success) return validationError(res, parsed.error.issues);
    try {
      const course = await prisma.course.findUnique({ where: { id: parsed.data.courseId } });
      if (!course) return res.status(404).json({ success: false, error: { code: 'COURSE_NOT_FOUND', message: 'Select a valid master course' } });
      const feeStructure = await prisma.feeStructure.upsert({
        where: { courseId_academicYear: { courseId: parsed.data.courseId, academicYear: parsed.data.academicYear } },
        update: { totalAmount: parsed.data.totalAmount },
        create: parsed.data
      });
      await prisma.auditLog.create({
        data: {
          userId: req.superAdmin!.userId, action: 'MASTER_FEE_UPDATED', entity: 'FeeStructure', entityId: feeStructure.id, ipAddress: req.ip,
          newData: { ...parsed.data, totalAmount: parsed.data.totalAmount }
        }
      });
      return res.json({ success: true, data: { ...feeStructure, totalAmount: Number(feeStructure.totalAmount), course }, message: 'Master fee structure saved' });
    } catch (error) { return next(error); }
  });

  router.get('/students/search', async (req, res, next) => {
    const parsed = z.object({
      query: z.string().trim().max(120).optional(),
      collegeId: z.string().min(1).optional(),
      branchId: z.string().min(1).optional(),
      session: z.string().regex(/^\d{4}-\d{4}$/).optional()
    }).safeParse(req.query);
    if (!parsed.success) return validationError(res, parsed.error.issues);
    try {
      const searchTerm = parsed.data.query?.trim();
      const students = await prisma.student.findMany({
        where: {
          ...(parsed.data.collegeId ? { collegeId: parsed.data.collegeId } : {}),
          ...(parsed.data.branchId ? { branchId: parsed.data.branchId } : {}),
          ...(parsed.data.session ? { academicYear: parsed.data.session } : {}),
          ...(searchTerm ? {
            OR: [
              { studentUid: { equals: searchTerm, mode: 'insensitive' } },
              { studentUid: { contains: searchTerm, mode: 'insensitive' } },
              { name: { contains: searchTerm, mode: 'insensitive' } },
              { email: { contains: searchTerm, mode: 'insensitive' } },
              { mobile: { contains: searchTerm } }
            ]
          } : {})
        },
        include: {
          college: true,
          branch: true,
          course: true,
          feeAssignments: {
            where: { isCurrent: true },
            include: { discounts: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 100
      });
      return res.json({ success: true, data: students, message: 'Student directory results loaded' });
    } catch (error) { return next(error); }
  });

  router.put('/students/:id', async (req: SuperAdminRequest, res, next) => {
    const params = z.object({ id: z.string().min(1) }).safeParse(req.params);
    const parsed = z.object({
      name: z.string().trim().min(2).max(120),
      email: z.string().trim().email().max(254),
      mobile: z.string().regex(/^[6-9]\d{9}$/),
      academicYear: z.string().regex(/^\d{4}-\d{4}$/),
      status: z.nativeEnum(StudentStatus)
    }).safeParse(req.body);
    if (!params.success) return validationError(res, params.error.issues);
    if (!parsed.success) return validationError(res, parsed.error.issues);
    try {
      const student = await prisma.student.findUnique({ where: { id: params.data.id } });
      if (!student) return res.status(404).json({ success: false, error: { code: 'STUDENT_NOT_FOUND', message: 'Student record was not found' } });
      if (Number(parsed.data.academicYear.slice(0, 4)) !== student.admissionYear || Number(parsed.data.academicYear.slice(5)) <= student.admissionYear) {
        return validationError(res, [{ code: z.ZodIssueCode.custom, path: ['academicYear'], message: 'Academic year must start with the student admission year and have a later end year' }]);
      }
      const updated = await prisma.$transaction(async (transaction) => {
        const result = await transaction.student.update({
          where: { id: student.id },
          data: { ...parsed.data, email: parsed.data.email.toLowerCase() },
          include: { college: true, branch: true, course: true }
        });
        if (student.status !== result.status) {
          await transaction.studentStatusHistory.create({
            data: { studentId: student.id, fromStatus: student.status, toStatus: result.status, reason: 'Updated by Super Admin', changedBy: req.superAdmin!.adminId }
          });
        }
        await transaction.auditLog.create({
          data: { userId: req.superAdmin!.userId, action: 'STUDENT_UPDATED', entity: 'Student', entityId: student.id, ipAddress: req.ip, newData: parsed.data }
        });
        return result;
      });
      return res.json({ success: true, data: updated, message: 'Student record updated' });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return res.status(409).json({ success: false, error: { code: 'DUPLICATE_STUDENT_CONTACT', message: 'Another student already uses that email or mobile number' } });
      return next(error);
    }
  });

  router.delete('/students/:id', async (req: SuperAdminRequest, res, next) => {
    const params = z.object({ id: z.string().min(1) }).safeParse(req.params);
    if (!params.success) return validationError(res, params.error.issues);
    try {
      const student = await prisma.student.findUnique({
        where: { id: params.data.id },
        include: { account: true, feeAssignments: true, payments: true, statusHistory: true }
      });
      if (!student) return res.status(404).json({ success: false, error: { code: 'STUDENT_NOT_FOUND', message: 'Student record was not found' } });
      if (student.account || student.feeAssignments.length || student.payments.length || student.statusHistory.length) {
        return res.status(409).json({ success: false, error: { code: 'STUDENT_HAS_RECORDS', message: 'This student has account, fee, payment, or status-history records and cannot be deleted.' } });
      }
      await prisma.$transaction(async (transaction) => {
        await transaction.auditLog.create({
          data: { userId: req.superAdmin!.userId, action: 'STUDENT_DELETED', entity: 'Student', entityId: student.id, ipAddress: req.ip, oldData: { studentUid: student.studentUid, name: student.name } }
        });
        await transaction.student.delete({ where: { id: student.id } });
      });
      return res.json({ success: true, data: { id: student.id }, message: 'Student record deleted' });
    } catch (error) { return next(error); }
  });

  return router;
}

function authenticateSuperAdmin(prisma: PrismaClient, secret: string) {
  return async (req: SuperAdminRequest, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return res.status(401).json({ success: false, error: { code: 'AUTHENTICATION_REQUIRED', message: 'Super Admin login is required' } });

    let decoded: string | jwt.JwtPayload;
    try {
      decoded = jwt.verify(token, secret);
    } catch {
      return res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Super Admin session is invalid or expired' } });
    }
    const parsed = z.object({ userId: z.string(), adminId: z.string(), role: z.literal('SUPER_ADMIN') }).safeParse(decoded);
    if (!parsed.success) return forbidden(res);
    const { userId, adminId, role } = parsed.data;
    if (!userId || !adminId || role !== 'SUPER_ADMIN') return forbidden(res);

    try {
      const user = await prisma.user.findFirst({
        where: { id: userId, adminId, isActive: true, roles: { some: { role: 'SUPER_ADMIN' } } },
        select: { id: true }
      });
      if (!user) return forbidden(res);
      req.superAdmin = { userId, adminId, role };
      return next();
    } catch (error) { return next(error); }
  };
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

class AdminCredentialDeliveryError extends Error { }

class InvalidFeeStructureError extends Error { }

async function generateStudentUid(transaction: Prisma.TransactionClient, locationName: string) {
  const locationCode = locationName.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3).padEnd(3, 'X');
  const prefix = `NSR${locationCode}-`;
  const existing = await transaction.student.findMany({ where: { studentUid: { startsWith: prefix } }, select: { studentUid: true } });
  const highestSequence = existing.reduce((highest, student) => Math.max(highest, Number(student.studentUid.slice(prefix.length)) || 0), 0);
  return `${prefix}${String(highestSequence + 1).padStart(3, '0')}`;
}

function generateTemporaryPassword() {
  const characters = [
    'ABCDEFGHJKLMNPQRSTUVWXYZ'[randomInt(24)]!,
    'abcdefghijkmnopqrstuvwxyz'[randomInt(25)]!,
    '23456789'[randomInt(8)]!,
    ...Array.from({ length: 3 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'[randomInt(57)]!)
  ];
  for (let index = characters.length - 1; index > 0; index--) {
    const swapIndex = randomInt(index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex]!, characters[index]!];
  }
  return characters.join('');
}
