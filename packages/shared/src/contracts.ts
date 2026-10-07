export type Role = 'STUDENT' | 'COLLEGE_ADMIN' | 'SUPER_ADMIN';

export type ApiResponse<T> = {
  success: true;
  data: T;
  message?: string;
};

export type ApiError = {
  success: false;
  error: { code: string; message: string; details?: unknown[] };
};

export type StudentSummary = {
  studentUid: string;
  name: string;
  course: string;
  college: string;
  branch: string;
  academicYear: string;
  totalFee: number;
  paidAmount: number;
  outstandingAmount: number;
  nextInstallment?: { dueDate: string; amount: number };
};
