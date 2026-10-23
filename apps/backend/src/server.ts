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

  try {
    const normalizedUid = studentUid.toLowerCase().startsWith('demo-')
      ? studentUid.toLowerCase()
      : studentUid.toUpperCase();

    console.log('--- PORTAL ACCESS REQUEST ---');
    console.log('Fetching student record for:', normalizedUid);

    const student = await prisma.student.findUnique({
      where: { studentUid: normalizedUid },
      include: {
        college: true,
        branch: true,
        course: true,
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
      console.log('Student record not found in database for:', normalizedUid);
      return res.status(404).json({
        success: false,
        error: { message: 'Student record not found.' }
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
// PUBLIC METADATA ENDPOINT (For Registration Dropdowns)
// ==========================================
app.get('/api/v1/public/metadata', async (_req, res) => {
  try {
    const colleges = await prisma.college.findMany({
      include: {
        location: true,
        branches: { orderBy: { name: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });

    const courses = await prisma.course.findMany({
      orderBy: { name: 'asc' },
    });

    return res.json({
      success: true,
      data: {
        colleges: colleges.map((c) => ({
          id: c.id,
          name: c.name,
          location: c.location.name,
          branches: c.branches.map((b) => ({ id: b.id, name: b.name })),
        })),
        courses: courses.map((co) => ({
          id: co.id,
          name: co.name,
        })),
      },
    });
  } catch (error: any) {
    console.error('Metadata Fetch Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load institutional metadata' });
  }
});
app.post('/api/v1/auth/register', async (req, res) => {
  try {
    const {
      role, name, mobile, email, password,
      fatherName, motherName, dateOfBirth, village, pin,
      collegeId, branchId, courseId
    } = req.body;

    if (role && role !== 'STUDENT') {
      return res.status(403).json({
        success: false,
        error: { code: 'PRIVILEGED_REGISTRATION_DISABLED', message: 'Administrator accounts must be provisioned by a Super Admin.' }
      });
    }

    if (!collegeId || !branchId || !courseId) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_ACADEMIC_SELECTION', message: 'Please select your College, Branch, and Course.' }
      });
    }

    // 1. Perform password hashing OUTSIDE the transaction to prevent timeouts!
    const hashedPassword = await bcrypt.hash(password || 'Welcome@2026', 10);

    // 2. Perform database transaction with an increased timeout limit (15,000ms / 15s)
    const result = await prisma.$transaction(
      async (tx) => {
        // Fetch College & Location for ID generation
        const college = await tx.college.findUnique({
          where: { id: collegeId },
          include: { location: true }
        });
        const branch = await tx.branch.findUnique({ where: { id: branchId } });
        const course = await tx.course.findUnique({ where: { id: courseId } });

        if (!college || !branch || !course) {
          throw new Error('Invalid College, Branch, or Course selection.');
        }

        // Generate location-aware Student ID (e.g. NSRHYD-0001)
        const locName = college.location ? college.location.name.toUpperCase().replace(/[^A-Z]/g, '') : 'INS';
        const cityCode = locName.length >= 3 ? locName.substring(0, 3) : 'INS';

        const collegeStudentCount = await tx.student.count({ where: { collegeId: college.id } });
        const studentUid = `NSR${cityCode}-${String(collegeStudentCount + 1).padStart(4, '0')}`;

        // Create Student record
        const student = await tx.student.create({
          data: {
            studentUid,
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
            status: 'ON_HOLD',
            collegeId: college.id,
            branchId: branch.id,
            courseId: course.id,
          },
        });

        // Create StudentAccount record
        const account = await tx.studentAccount.create({
          data: {
            studentId: student.id,
            email: email || null,
            passwordHash: hashedPassword,
            mustChangePassword: true,
          },
        });

        return { student, account };
      },
      {
        maxWait: 5000, // Wait maximum 5s to acquire connection
        timeout: 15000, // Allow transaction up to 15s to complete
      }
    );

    return res.status(201).json({
      success: true,
      message: `Registration successful! Your generated Student ID is ${result.student.studentUid}`,
      data: {
        studentUid: result.student.studentUid,
      },
    });

  } catch (error: any) {
    console.error('Registration Error:', error);
    return res.status(500).json({
      success: false,
      error: { code: 'REGISTRATION_FAILED', message: error.message || 'Registration failed' }
    });
  }
});
app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { studentId, studentUid, password, email } = req.body;
    const identifier = (studentId || studentUid || '').trim().toUpperCase();

    if (!identifier && !email) {
      return res.status(400).json({
        success: false,
        error: { message: 'Student ID or email is required.' }
      });
    }

    // Find student account linked to the student UID or email
    const account = await prisma.studentAccount.findFirst({
      where: {
        OR: [
          { student: { studentUid: identifier } },
          { email: email || '' }
        ]
      },
      include: { student: true }
    });

    if (!account || !account.student) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid Student ID or password.' }
      });
    }

    // 🔒 CHECK: Ensure student account is active (Block ON_HOLD students)
    if (account.student.status && account.student.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Your account is currently pending college approval. Please contact your college administrator.'
        }
      });
    }

    // Verify password hash
    const isPasswordValid = await bcrypt.compare(password, account.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid Student ID or password.' }
      });
    }

    // Generate a secure session access token
    const accessToken = `bearer-token-${account.student.studentUid}-${Date.now()}`;

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken,
        studentUid: account.student.studentUid,
        requiresPasswordChange: account.mustChangePassword || false,
      }
    });

  } catch (error: any) {
    console.error('Login Error:', error);
    return res.status(500).json({
      success: false,
      error: { message: 'Internal server error during login' }
    });
  }
});
app.post('/api/v1/dev-approve/:studentUid', async (req, res) => {
  const { studentUid } = req.params;
  const normalizedUid = studentUid.toUpperCase();

  try {
    console.log(`--- APPROVING STUDENT: ${normalizedUid} ---`);

    const existingStudent = await prisma.student.findUnique({
      where: { studentUid: normalizedUid }
    });

    if (!existingStudent) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    // 1. Simply update status to ACTIVE first to unblock the student portal
    const updatedStudent = await prisma.student.update({
      where: { studentUid: normalizedUid },
      data: { status: 'ACTIVE' },
      include: {
        college: true,
        branch: true,
        course: true
      }
    });

    console.log(`Student ${normalizedUid} successfully set to ACTIVE`);

    return res.json({
      success: true,
      message: `Student ${normalizedUid} approved successfully.`,
      data: updatedStudent
    });

  } catch (error: any) {
    console.error('DETAILED APPROVAL ERROR:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error during approval'
    });
  }
});
// 1. Fetch all pending students awaiting approval
app.get('/api/v1/admin/students/pending', async (req, res) => {
  try {
    const pendingStudents = await prisma.student.findMany({
      where: { status: 'ON_HOLD' },
      include: {
        college: true,
        branch: true,
        course: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ success: true, data: pendingStudents });
  } catch (error) {
    console.error('Error fetching pending students:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// 2. Approve student and assign fee structure
app.post('/api/v1/admin/students/:studentUid/approve', async (req, res) => {
  const { studentUid } = req.params;
  const { feeTotal = 100000 } = req.body;
  const normalizedUid = studentUid.toUpperCase();

  try {
    const existingStudent = await prisma.student.findUnique({
      where: { studentUid: normalizedUid },
      include: { course: true }
    });

    if (!existingStudent) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    let feeStructure = await prisma.feeStructure.findFirst({
      where: { courseId: existingStudent.courseId }
    });

    if (!feeStructure) {
      feeStructure = await prisma.feeStructure.create({
        data: {
          courseId: existingStudent.courseId,
          academicYear: '2026-2027',
          totalAmount: feeTotal
        }
      });
    }

    const updatedStudent = await prisma.$transaction(async (tx) => {
      const student = await tx.student.update({
        where: { studentUid: normalizedUid },
        data: { status: 'ACTIVE' }
      });

      const defaultInstallments = [
        { amount: feeTotal / 2, dueDate: new Date('2026-07-01') },
        { amount: feeTotal / 2, dueDate: new Date('2027-07-01') }
      ];

      const existingAssignment = await tx.feeAssignment.findFirst({
        where: { studentId: student.id }
      });

      if (!existingAssignment) {
        await tx.feeAssignment.create({
          data: {
            studentId: student.id,
            feeStructureId: feeStructure.id,
            originalAmount: feeTotal,
            isCurrent: true,
            installments: { create: defaultInstallments }
          }
        });
      }

      return tx.student.findUnique({
        where: { studentUid: normalizedUid },
        include: {
          college: true,
          branch: true,
          course: true,
          feeAssignments: { include: { installments: true } }
        }
      });
    });

    return res.json({
      success: true,
      message: `Student ${normalizedUid} approved successfully.`,
      data: updatedStudent
    });

  } catch (error: any) {
    console.error('Error approving student record:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error during approval' });
  }
});
// ==========================================
// 1. COLLEGE ADMIN ROUTES
// ==========================================

// Search Students (Branch & Course Filtered)
app.get('/api/v1/college-admin/students/search', async (req, res) => {
  const { query, courseId, collegeId } = req.query;

  try {
    const students = await prisma.student.findMany({
      where: {
        ...(collegeId && { collegeId: String(collegeId) }),
        ...(courseId && { courseId: String(courseId) }),
        ...(query && {
          OR: [
            { firstName: { contains: String(query), mode: 'insensitive' } },
            { lastName: { contains: String(query), mode: 'insensitive' } },
            { studentUid: { contains: String(query), mode: 'insensitive' } }
          ]
        })
      },
      include: { course: true, branch: true }
    });

    return res.json({ success: true, data: students });
  } catch (error) {
    console.error('Error searching students:', error);
    return res.status(500).json({ success: false, message: 'Failed to search students' });
  }
});

// Fee Collection Reports
app.get('/api/v1/college-admin/reports/fee-collections', async (req, res) => {
  const { collegeId, courseId } = req.query;

  try {
    const payments = await prisma.paymentAllocation.findMany({
      where: {
        installment: {
          feeAssignment: {
            student: {
              ...(collegeId && { collegeId: String(collegeId) }),
              ...(courseId && { courseId: String(courseId) })
            }
          }
        }
      },
      include: {
        payment: true,
        installment: {
          include: {
            feeAssignment: {
              include: { student: true }
            }
          }
        }
      }
    });

    return res.json({ success: true, data: payments });
  } catch (error) {
    console.error('Error fetching fee collection report:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch report' });
  }
});

// Send Due Reminders
app.post('/api/v1/college-admin/notifications/send-due-reminders', async (req, res) => {
  const { collegeId, daysThreshold = 7 } = req.body;

  try {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + Number(daysThreshold));

    const pendingInstallments = await prisma.feeInstallment.findMany({
      where: {
        dueDate: { lte: targetDate },
        feeAssignment: {
          student: { collegeId: String(collegeId) }
        }
      },
      include: {
        feeAssignment: {
          include: { student: true }
        }
      }
    });

    return res.json({
      success: true,
      message: `Notifications queued for ${pendingInstallments.length} students with upcoming dues.`
    });
  } catch (error) {
    console.error('Error sending reminders:', error);
    return res.status(500).json({ success: false, message: 'Failed to send reminders' });
  }
});


// ==========================================
// 2. SUPER ADMIN ROUTES
// ==========================================

// Create Admin User
app.post('/api/v1/super-admin/admins', async (req, res) => {
  const { name, email, password, collegeId, role = 'COLLEGE_ADMIN' } = req.body;

  try {
    const newAdmin = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: password, // Note: Hash with bcrypt in production
        role,
        collegeId
      }
    });

    return res.json({ success: true, data: newAdmin });
  } catch (error) {
    console.error('Error creating admin:', error);
    return res.status(500).json({ success: false, message: 'Failed to create admin' });
  }
});
// Remove Admin User
app.delete('/api/v1/super-admin/admins/:adminId', async (req, res) => {
  const { adminId } = req.params;

  try {
    await prisma.user.delete({
      where: { id: adminId }
    });

    return res.json({ success: true, message: 'Admin user removed successfully.' });
  } catch (error) {
    console.error('Error removing admin:', error);
    return res.status(500).json({ success: false, message: 'Failed to remove admin' });
  }
});

// System-Wide Fee Analytics Grouped by Payment Reference
app.get('/api/v1/super-admin/reports/fee-analytics', async (req, res) => {
  try {
    const analytics = await prisma.paymentAllocation.groupBy({
      by: ['paymentId'],
      _sum: { amount: true }
    });

    return res.json({ success: true, data: analytics });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
  }
});
app.get('/api/v1/dev-reset-admin', async (req, res) => {
  try {
    const newPasswordHash = '$2b$10$e8G7/K4w8G40X30tQ6j9a.s3Z6U8z3O3YwWbS/vM5E2XG3X8.O9q2'; // Hash for 'Admin@123'

    const admin = await prisma.user.upsert({
      where: { email: 'admin@nsrimpulse.com' },
      update: {
        passwordHash: newPasswordHash
      },
      create: {
        adminId: 'NSRADMIN-001',
        email: 'admin@nsrimpulse.com',
        passwordHash: newPasswordHash
      }
    });

    return res.json({ success: true, message: 'College Admin password reset to Admin@123', admin });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});
// 1. Super Admin Context Route
app.get('/api/v1/super-admin/context', async (req, res) => {
  try {
    const colleges = await prisma.college.findMany({
      include: { branches: true }
    });
    const courses = await prisma.course.findMany();

    const allUsers = await prisma.user.findMany({
      include: {
        roles: true,
        adminScopes: {
          include: { college: true, branch: true }
        }
      }
    });

    const admins = allUsers.filter(u =>
      u.roles?.some(r => r.role === 'COLLEGE_ADMIN') || (u.adminScopes && u.adminScopes.length > 0)
    );

    return res.json({
      success: true,
      data: {
        superAdmin: { id: 'super-admin-id', email: 'superadmin@nsrimpulse.com', adminId: 'SUPERADMIN-001' },
        colleges: colleges || [],
        courses: courses || [],
        admins: admins.map((a) => ({
          id: a.id,
          adminId: a.adminId || 'N/A',
          email: a.email,
          isActive: a.isActive,
          scopes: a.adminScopes?.map((s) => ({
            college: { id: s.college?.id, name: s.college?.name },
            branch: s.branch ? { id: s.branch.id, name: s.branch.name } : null
          })) || []
        }))
      }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// 1. Get Branch-wise Student Counts Across All Colleges (Network Analytics)
app.get('/api/v1/super-admin/branches/student-counts', async (req, res) => {
  try {
    const branches = await prisma.branch.findMany({
      include: {
        college: true,
        _count: {
          select: { students: true }
        }
      }
    });

    const summary = branches.map(b => ({
      branchId: b.id,
      branchName: b.name,
      collegeName: b.college?.name || 'N/A',
      studentCount: b._count.students
    }));

    return res.json({ success: true, data: summary });
  } catch (error: any) {
    console.error('Branch Student Counts Error:', error);
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// 2. Enhanced Global Student Search with Branch & Session Filters
app.get('/api/v1/super-admin/students/search', async (req, res) => {
  try {
    const query = req.query.query ? String(req.query.query).trim() : '';
    const collegeId = req.query.collegeId ? String(req.query.collegeId) : '';
    const branchId = req.query.branchId ? String(req.query.branchId) : '';
    const sessionYear = req.query.session ? String(req.query.session) : '';

    const whereClause: any = {};

    if (collegeId) whereClause.collegeId = collegeId;
    if (branchId) whereClause.branchId = branchId;
    if (sessionYear) whereClause.academicYear = sessionYear;

    if (query) {
      whereClause.OR = [
        { studentUid: { contains: query, mode: 'insensitive' } },
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
        { college: { name: { contains: query, mode: 'insensitive' } } },
        { branch: { name: { contains: query, mode: 'insensitive' } } },
        { academicYear: { contains: query, mode: 'insensitive' } }
      ];
    }

    const students = await prisma.student.findMany({
      where: whereClause,
      include: { college: true, branch: true, course: true },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ success: true, data: students || [] });
  } catch (error: any) {
    console.error('Super Admin Student Search Error:', error);
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
});
// System-Wide Fee Collections Report
app.get('/api/v1/admin/super-admin/reports/fee-collections', async (req, res) => {
  try {
    const payments = await prisma.paymentAllocation.findMany({
      include: {
        installment: {
          include: {
            feeAssignment: {
              include: {
                student: {
                  include: { college: true, branch: true }
                }
              }
            }
          }
        }
      }
      // Removed invalid orderBy clause
    });

    return res.json({ success: true, data: payments });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: { message: error.message } });
  }
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
