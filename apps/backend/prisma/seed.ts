import { PrismaClient, StudentStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config({ path: new URL('../../../.env', import.meta.url) });
const prisma = new PrismaClient();
const studentUid = 'NSRTSHYD-001';

async function main() {
  const state = await prisma.state.upsert({ where: { name: 'Telangana' }, update: {}, create: { name: 'Telangana' } });
  const location = await prisma.location.upsert({ where: { stateId_name: { stateId: state.id, name: 'Pragathi Nagar' } }, update: {}, create: { name: 'Pragathi Nagar', stateId: state.id } });
  const college = await prisma.college.findFirst({ where: { name: 'NSR Impulse Knowledge Park', locationId: location.id } }) ?? await prisma.college.create({ data: { name: 'NSR Impulse Knowledge Park', locationId: location.id } });
  const branch = await prisma.branch.upsert({ where: { collegeId_name: { collegeId: college.id, name: 'Pragathi Nagar Campus' } }, update: {}, create: { name: 'Pragathi Nagar Campus', collegeId: college.id } });
  const adminPasswordHash = await bcrypt.hash('NSRTSADMMIN@2026', 12);
  const collegeAdmin = await prisma.user.upsert({ where: { adminId: 'NSRTSADMMIN-001' }, update: { email: 'admin.pragathinagar@nsrimpulse.com', passwordHash: adminPasswordHash, isActive: true }, create: { adminId: 'NSRTSADMMIN-001', email: 'admin.pragathinagar@nsrimpulse.com', passwordHash: adminPasswordHash } });
  await prisma.userRole.upsert({ where: { userId_role: { userId: collegeAdmin.id, role: 'COLLEGE_ADMIN' } }, update: {}, create: { userId: collegeAdmin.id, role: 'COLLEGE_ADMIN' } });
  const existingScope = await prisma.collegeAdminScope.findFirst({ where: { userId: collegeAdmin.id, collegeId: college.id, branchId: branch.id } });
  if (!existingScope) await prisma.collegeAdminScope.create({ data: { userId: collegeAdmin.id, collegeId: college.id, branchId: branch.id } });
  const course = await prisma.course.upsert({ where: { name: 'MPC' }, update: {}, create: { name: 'MPC' } });
  const feeStructure = await prisma.feeStructure.upsert({ where: { courseId_academicYear: { courseId: course.id, academicYear: '2026-2028' } }, update: { totalAmount: '180000' }, create: { courseId: course.id, academicYear: '2026-2028', totalAmount: '180000' } });
  const student = await prisma.student.upsert({
    where: { studentUid },
    update: { name: 'CH Vishnu', age: 26, mobile: '9014249898', email: 'Vishnuchoutapellys@gmail.com', fatherName: 'Nagabushanam', address: 'Hyderabad, Bachupally', village: 'Hyderabad, Bachupally', pin: '500090', admissionYear: 2026, academicYear: '2026-2028', status: StudentStatus.ACTIVE, collegeId: college.id, branchId: branch.id, courseId: course.id },
    create: { studentUid, name: 'CH Vishnu', age: 26, mobile: '9014249898', email: 'Vishnuchoutapellys@gmail.com', fatherName: 'Nagabushanam', address: 'Hyderabad, Bachupally', village: 'Hyderabad, Bachupally', pin: '500090', admissionYear: 2026, academicYear: '2026-2028', status: StudentStatus.ACTIVE, collegeId: college.id, branchId: branch.id, courseId: course.id }
  });
  const passwordHash = await bcrypt.hash('NSRTSHYD@2026', 12);
  await prisma.studentAccount.upsert({ where: { studentId: student.id }, update: { email: student.email, passwordHash }, create: { studentId: student.id, email: student.email, passwordHash } });
  const assignment = await prisma.feeAssignment.upsert({ where: { id: `demo-fee-${student.id}` }, update: { originalAmount: '180000', feeStructureId: feeStructure.id }, create: { id: `demo-fee-${student.id}`, studentId: student.id, feeStructureId: feeStructure.id, originalAmount: '180000' } });
  const existingInstallments = await prisma.feeInstallment.findMany({ where: { feeAssignmentId: assignment.id }, orderBy: { dueDate: 'asc' } });
  const installmentData = [{ dueDate: new Date('2026-10-15T00:00:00+05:30'), amount: '90000' }, { dueDate: new Date('2027-10-15T00:00:00+05:30'), amount: '90000' }];
  for (const [index, data] of installmentData.entries()) {
    const existing = existingInstallments[index];
    if (existing) await prisma.feeInstallment.update({ where: { id: existing.id }, data });
    else await prisma.feeInstallment.create({ data: { feeAssignmentId: assignment.id, ...data } });
  }
  console.log(`Seeded student ${student.studentUid} with a 180000 INR fee assignment and two installments.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
