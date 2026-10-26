import {
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  IndianRupee,
  LogOut,
  UserRound,
  X,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import nsrLogo from "../../assets/nsrLogo.png";
import { apiBase } from "./api";
import { PaymentHistory } from "./PaymentHistory";

type PortalTab = "overview" | "profile" | "fees" | "history" | "reminders";
type PaymentMode = "UPI" | "ONLINE" | "CASH" | "BANK_TRANSFER" | "CHEQUE" | "OTHER";

type PaymentSubmissionResult = {
  paymentId: string;
  transactionNumber: string;
  receiptNumber: string;
  amount: number;
  mode: PaymentMode;
  paidAt: string;
  outstandingAmount: number;
};

type StudentPortalRecord = {
  approvalPending: boolean;
  feePlanMissing: boolean;
  status: string;
  studentId: string;
  name: string;
  fatherName: string;
  age: number;
  courseType: string;
  courseDurationYears: number;
  location: string;
  mobile: string;
  email: string;
  village: string;
  pin: string;
  fee: {
    total: number;
    paid: number;
    pending: number;
    currency: string;
    installments: Array<{
      label: string;
      amount: number;
      paid: number;
      dueDate: string;
      status: "PAID" | "PARTIAL" | "PENDING";
    }>;
  };
  receipt: {
    invoiceNumber: string;
    transactionNumber: string;
    dateTime: string;
    paymentType: string;
    amount: number;
    status: string;
    note: string;
  };
  reminders: Array<{
    id: string;
    title: string;
    message: string;
    dueDate: string;
    severity: string;
    read: boolean;
  }>;
};

function createPaymentRequestId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function fetchStudentRecord(
  studentId: string,
  accessToken: string
): Promise<StudentPortalRecord> {
  const response = await fetch(
    `${apiBase}/api/v1/students/${encodeURIComponent(studentId)}/portal`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }
  );
  const result = (await response.json()) as {
    success?: boolean;
    data?: any;
    error?: { message?: string };
  };

  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error?.message ?? "Unable to load student data");
  }

  const raw = result.data;
  const fullName =
    [raw.firstName, raw.lastName].filter(Boolean).join(" ") ||
    raw.name ||
    "Student";

  if (raw.status !== "ACTIVE") {
    return {
      approvalPending: true,
      feePlanMissing: true,
      status: raw.status || "ON_HOLD",
      studentId: raw.studentUid || studentId,
      name: fullName,
      fatherName: raw.fatherName || "",
      age: 20,
      courseType: raw.course?.name || "General Course",
      courseDurationYears: 2,
      location: raw.college?.location?.name || raw.college?.name || "Campus",
      mobile: raw.mobile || "",
      email: raw.email || "",
      village: raw.village || "",
      pin: raw.pin || "",
      fee: { total: 0, paid: 0, pending: 0, currency: "INR", installments: [] },
      receipt: {
        invoiceNumber: "",
        transactionNumber: "",
        dateTime: "",
        paymentType: "",
        amount: 0,
        status: "",
        note: "",
      },
      reminders: [],
    };
  }

  const currentAssignment = raw.feeAssignments?.find((fa: any) => fa.isCurrent === true);

  const feeTotal = Number(
    currentAssignment?.originalAmount || currentAssignment?.totalAmount || 0
  );
  const feePaid = raw.payments
    ?.filter((payment: any) => payment.status === "SUCCESS")
    .reduce((acc: number, payment: any) => acc + (Number(payment.amount) || 0), 0) || 0;

  const installments = currentAssignment?.installments?.map((inst: any, index: number) => {
    const amount = Number(inst.amount) || 0;
    const paid = inst.allocations
      ?.filter((allocation: any) => allocation.payment?.status === "SUCCESS")
      .reduce((total: number, allocation: any) => total + (Number(allocation.amount) || 0), 0) || 0;
    return {
      label: inst.title || `Installment ${index + 1}`,
      amount,
      paid,
      dueDate: inst.dueDate
        ? String(inst.dueDate).substring(0, 10)
        : new Date().toISOString().substring(0, 10),
      status: paid >= amount ? "PAID" as const : paid > 0 ? "PARTIAL" as const : "PENDING" as const,
    };
  }) || [];

  return {
    approvalPending: false,
    feePlanMissing: !currentAssignment,
    status: raw.status,
    studentId: raw.studentUid || studentId,
    name: fullName,
    fatherName: raw.fatherName || "Not specified",
    age: 20,
    courseType: raw.course?.name || "MPC",
    courseDurationYears: 2,
    location: raw.college?.name || "NSR Impulse Knowledge Park",
    mobile: raw.mobile || "",
    email: raw.email || "",
    village: raw.village || "",
    pin: raw.pin || "500001",
    fee: {
      total: feeTotal,
      paid: feePaid,
      pending: Math.max(0, feeTotal - feePaid),
      currency: "INR",
      installments,
    },
    receipt: {
      invoiceNumber: raw.payments?.[0]?.receipt?.receiptNumber || raw.payments?.[0]?.receiptNumber || "",
      transactionNumber: raw.payments?.[0]?.reference || raw.payments?.[0]?.gatewayTransactionId || raw.payments?.[0]?.transactionNumber || "",
      dateTime: raw.payments?.[0]?.createdAt || new Date().toISOString(),
      paymentType: raw.payments?.[0]?.mode || "ONLINE",
      amount: raw.payments?.[0]?.amount || feePaid,
      status: "CONFIRMED",
      note: "Keep this receipt for your college records.",
    },
    reminders: [
      {
        id: "1",
        title: "Welcome to NSR Impulse",
        message: "Your registration is successfully recorded.",
        dueDate: "23 OCT 2026",
        severity: "INFO",
        read: false,
      },
    ],
  };
}

export function StudentPortal({
  studentId = "NSRPRA-0002",
  accessToken = "mock-token",
  onBack = () => { },
}: {
  studentId?: string;
  accessToken?: string;
  onBack?: () => void;
}) {
  const [record, setRecord] = useState<StudentPortalRecord | null>(null);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState<PortalTab>("overview");
  const [showPayment, setShowPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("UPI");
  const [paymentError, setPaymentError] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState("");
  const [paymentRequestId, setPaymentRequestId] = useState(createPaymentRequestId);

  useEffect(() => {
    let cancelled = false;
    fetchStudentRecord(studentId, accessToken)
      .then((data) => {
        if (!cancelled) setRecord(data);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err.message || "Failed to load account");
      });
    return () => {
      cancelled = true;
    };
  }, [studentId, accessToken]);

  useEffect(() => {
    if (!paymentSuccess) return;
    const timeout = window.setTimeout(() => setPaymentSuccess(""), 5000);
    return () => window.clearTimeout(timeout);
  }, [paymentSuccess]);

  if (loadError)
    return (
      <main className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-6 text-slate-800">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-xl">
          <h1 className="text-xl font-bold text-red-600">Account Access Issue</h1>
          <p className="text-xs text-slate-500">{loadError}</p>
          <button
            className="w-full py-3 rounded-xl bg-amber-500 text-white font-bold text-xs hover:bg-amber-600 transition shadow-md shadow-amber-500/20"
            onClick={onBack}
          >
            Back to Sign In
          </button>
        </div>
      </main>
    );

  if (!record)
    return (
      <main className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center space-y-3 text-slate-800">
        <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 font-medium">Loading Student Workspace...</p>
      </main>
    );

  if (record.approvalPending) {
    return (
      <main className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center p-6 text-slate-800">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-md w-full text-center space-y-4 shadow-xl">
          <CheckCircle2 size={40} className="mx-auto text-amber-500" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            ID: {record.studentId}
          </span>
          <h1 className="text-2xl font-bold text-slate-900">Registration Pending</h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            Your registration has been submitted and is currently under review by your college administrator.
          </p>
          <button
            className="w-full py-3.5 rounded-xl bg-amber-500 text-white font-bold text-xs hover:bg-amber-600 transition shadow-md shadow-amber-500/20"
            onClick={onBack}
          >
            Back to Sign In
          </button>
        </div>
      </main>
    );
  }

  const tabs = [
    ["overview", "Overview", <BookOpen size={16} />],
    ["profile", "Profile", <UserRound size={16} />],
    ["fees", "Fees", <IndianRupee size={16} />],
    ["history", "Payment History", <CalendarDays size={16} />],
    [
      "reminders",
      `Alerts (${record.reminders.length})`,
      <Bell size={16} />,
    ],
  ] as const;

  const openPayment = () => {
    setPaymentError("");
    setPaymentSuccess("");
    if (record?.feePlanMissing) {
      setPaymentSuccess("Your fee plan has not been assigned yet. Contact your College Admin.");
      return;
    }
    setPaymentRequestId(createPaymentRequestId());
    setShowPayment(true);
  };

  const submitPayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!record || paymentBusy) return;

    const amount = Number(paymentAmount);
    setPaymentError("");
    setPaymentSuccess("");
    if (!navigator.onLine) return setPaymentError("Payments cannot be submitted while offline.");
    if (!Number.isFinite(amount) || amount <= 0) return setPaymentError("Enter a payment amount greater than zero.");
    if (!Number.isInteger(amount * 100)) return setPaymentError("Use no more than two decimal places.");
    if (amount > record.fee.pending) return setPaymentError(`Payment cannot exceed ₹${record.fee.pending.toLocaleString("en-IN")}.`);

    setPaymentBusy(true);
    try {
      const response = await fetch(`${apiBase}/api/v1/payments/student`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          studentUid: record.studentId,
          amount,
          mode: paymentMode,
          idempotencyKey: paymentRequestId,
        }),
      });
      const result = (await response.json()) as {
        success?: boolean;
        data?: PaymentSubmissionResult;
        message?: string;
        error?: { message?: string };
      };
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error?.message ?? result.message ?? "Payment could not be recorded.");
      }

      setPaymentSuccess(result.message ?? `Payment of ₹${amount.toLocaleString("en-IN")} recorded successfully.`);
      setShowPayment(false);
      setPaymentAmount("");
      setTab("overview");
      setPaymentRequestId(createPaymentRequestId());

      try {
        setRecord(await fetchStudentRecord(studentId, accessToken));
      } catch {
        setPaymentSuccess("Payment was recorded successfully. Refresh the page to load the latest balance.");
      }
    } catch (reason) {
      setPaymentError(reason instanceof Error ? reason.message : "Payment could not be recorded.");
    } finally {
      setPaymentBusy(false);
    }
  };

  return (
    <div className="student-account-page min-h-screen bg-[#F8F9FA] text-slate-800 flex flex-col font-sans selection:bg-amber-500 selection:text-white">
      {/* Top Navbar */}
      <header className="student-account-header h-16 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between sticky top-0 z-50">
        <button onClick={onBack} className="flex items-center gap-2">
          <img className="h-8 w-auto object-contain" src={nsrLogo} alt="NSR Impulse" />
        </button>
        <div className="flex items-center gap-4">
          <span className="text-xs font-mono px-3 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 font-semibold">
            {record.studentId}
          </span>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition text-xs font-bold"
          >
            <LogOut size={14} /> Logout
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="student-account-layout flex-1 grid grid-cols-1 lg:grid-cols-12">
        {/* Sidebar */}
        <aside className="student-account-sidebar lg:col-span-3 bg-white border-r border-slate-200/80 p-6 space-y-6">
          <div className="student-account-identity flex items-center gap-3 p-3 rounded-2xl bg-amber-500/5 border border-amber-500/10">
            <div className="w-10 h-10 rounded-full bg-amber-500 text-white font-bold text-xs flex items-center justify-center uppercase">
              {record.name.substring(0, 2)}
            </div>
            <div>
              <strong className="text-slate-900 text-sm block font-bold">{record.name}</strong>
              <span className="text-[11px] text-slate-500 block">
                {record.courseType} · {record.location}
              </span>
            </div>
          </div>

          <nav className="student-account-nav space-y-1" aria-label="Student account sections">
            {tabs.map(([key, label, icon]) => (
              <button
                key={key}
                onClick={() => setTab(key as PortalTab)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition ${tab === key
                  ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                  : "text-slate-600 hover:bg-slate-50"
                  }`}
              >
                {icon}
                <span>{label}</span>
              </button>
            ))}
          </nav>

          <div className="student-account-verified pt-4 border-t border-slate-100 flex items-center gap-2 text-emerald-600 text-xs font-bold">
            <CheckCircle2 size={16} />
            <div>
              <span>Account verified</span>
              <small className="block text-[10px] text-slate-400 font-normal">
                PostgreSQL record
              </small>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="student-account-main lg:col-span-9 p-8 bg-[#F8F9FA] space-y-6">
          {/* Header Banner */}
          <div className="student-account-heading flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                STUDENT ACCOUNT
              </p>
              <h2 className="text-2xl font-bold text-slate-900 mt-0.5">
                {tab === "overview" ? (
                  <>
                    Welcome, <span className="font-serif italic text-amber-600">{record.name}</span>
                  </>
                ) : (
                  tabs.find(([k]) => k === tab)?.[1]
                )}
              </h2>
            </div>
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
              <CheckCircle2 size={13} /> Active
            </span>
          </div>

          {record.feePlanMissing && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800" role="status">
              Your fee plan has not been assigned yet. Payments will be available after your College Admin adds the approved fee schedule.
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {tab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900 text-white rounded-3xl p-6 flex flex-col justify-between space-y-4 shadow-lg">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    REMAINING PENDING
                  </span>
                  <div>
                    <strong className="text-3xl font-extrabold font-serif">
                      ₹{record.fee.pending.toLocaleString("en-IN")}
                    </strong>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      of ₹{record.fee.total.toLocaleString("en-IN")} total fee
                    </span>
                  </div>
                  {!record.feePlanMissing && record.fee.pending > 0 && <button
                    onClick={openPayment}
                    className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition shadow-md shadow-amber-500/20"
                  >
                    Pay installment
                  </button>}
                </div>

                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    COURSE
                  </span>
                  <div>
                    <strong className="text-2xl font-bold text-slate-900 block font-serif">
                      {record.courseType}
                    </strong>
                    <span className="text-xs text-slate-500 block mt-1">
                      {record.courseDurationYears} year programme
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">Regular Enrollment</div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-3xl p-6 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    PAID SO FAR
                  </span>
                  <div>
                    <strong className="text-2xl font-bold text-slate-900 block font-serif">
                      ₹{record.fee.paid.toLocaleString("en-IN")}
                    </strong>
                    <span className="text-xs text-slate-500 block mt-1">
                      Recorded payments
                    </span>
                  </div>
                  <div className="text-[10px] text-emerald-600 font-bold">Confirmed</div>
                </div>
              </div>

              {/* Installment Plan */}
              <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">
                      PAYMENT PLAN
                    </p>
                    <h3 className="text-xl font-bold text-slate-900 font-serif">
                      Fee schedule
                    </h3>
                  </div>
                  <button
                    onClick={() => setTab("fees")}
                    className="text-xs font-bold text-amber-600 hover:underline"
                  >
                    View details →
                  </button>
                </div>

                <div className="space-y-3">
                  {record.fee.installments.map((inst, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100"
                    >
                      <div>
                        <strong className="text-slate-900 text-sm block font-bold">
                          {inst.label}
                        </strong>
                        <span className="text-xs text-slate-400">Due {inst.dueDate}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <strong className="text-slate-900 text-sm font-serif block">
                            ₹{inst.amount.toLocaleString("en-IN")}
                          </strong>
                          {inst.paid > 0 && <small className="text-[10px] font-semibold text-emerald-600">Paid ₹{inst.paid.toLocaleString("en-IN")}</small>}
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${inst.status === "PAID"
                            ? "bg-emerald-100 text-emerald-700"
                            : inst.status === "PARTIAL"
                              ? "bg-blue-100 text-blue-700"
                            : "bg-amber-100 text-amber-700"
                            }`}
                        >
                          {inst.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PROFILE */}
          {tab === "profile" && (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-6">
              <h3 className="text-lg font-bold text-slate-900">Personal & Academic Profile</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-2xl bg-slate-50 space-y-1">
                  <span className="text-slate-400 block font-semibold">Student ID</span>
                  <strong className="text-slate-900 text-sm">{record.studentId}</strong>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 space-y-1">
                  <span className="text-slate-400 block font-semibold">Full Name</span>
                  <strong className="text-slate-900 text-sm">{record.name}</strong>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 space-y-1">
                  <span className="text-slate-400 block font-semibold">Father's Name</span>
                  <strong className="text-slate-900 text-sm">{record.fatherName}</strong>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 space-y-1">
                  <span className="text-slate-400 block font-semibold">Mobile</span>
                  <strong className="text-slate-900 text-sm">{record.mobile || "N/A"}</strong>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 space-y-1">
                  <span className="text-slate-400 block font-semibold">Email</span>
                  <strong className="text-slate-900 text-sm">{record.email || "N/A"}</strong>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 space-y-1">
                  <span className="text-slate-400 block font-semibold">College / Campus</span>
                  <strong className="text-slate-900 text-sm">{record.location}</strong>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FEES */}
          {tab === "fees" && (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">Fee Breakup & Installments</h3>
                <button
                  onClick={openPayment}
                  disabled={record.feePlanMissing}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition shadow-md shadow-amber-500/20"
                >
                  {record.feePlanMissing ? "Fee Plan Pending" : "Make Payment"}
                </button>
              </div>

              <div className="space-y-3">
                {record.fee.installments.map((inst, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs"
                  >
                    <div>
                      <strong className="text-slate-900 block text-sm font-bold">
                        {inst.label}
                      </strong>
                      <span className="text-slate-400">Due date: {inst.dueDate}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <strong className="text-slate-900 font-serif text-sm block">
                          ₹{inst.amount.toLocaleString("en-IN")}
                        </strong>
                        {inst.paid > 0 && <small className="text-[10px] font-semibold text-emerald-600">Paid ₹{inst.paid.toLocaleString("en-IN")}</small>}
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full font-bold ${inst.status === "PAID"
                          ? "bg-emerald-100 text-emerald-700"
                          : inst.status === "PARTIAL"
                            ? "bg-blue-100 text-blue-700"
                          : "bg-amber-100 text-amber-700"
                          }`}
                      >
                        {inst.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: PAYMENT HISTORY */}
          {tab === "history" && (
            <PaymentHistory studentId={record.studentId} accessToken={accessToken} />
          )}

          {/* TAB 5: ALERTS */}
          {tab === "reminders" && (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 space-y-4">
              <h3 className="text-lg font-bold text-slate-900">
                Alerts ({record.reminders.length})
              </h3>
              <div className="space-y-3">
                {record.reminders.map((rem) => (
                  <div
                    key={rem.id}
                    className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/10 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-amber-700 uppercase">
                        DUE {rem.dueDate}
                      </span>
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                        New
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-slate-900 font-serif">
                      {rem.title}
                    </h4>
                    <p className="text-xs text-slate-600">{rem.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {paymentSuccess && (
        <div className="fixed top-20 right-4 left-4 sm:left-auto sm:max-w-sm z-[80] rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700 shadow-xl" role="status">
          {paymentSuccess}
        </div>
      )}

      {/* Payment Overlay Modal */}
      {showPayment && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Pay Installment</h3>
              <button
                type="button"
                disabled={paymentBusy}
                onClick={() => setShowPayment(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Outstanding Balance:{" "}
              <strong className="text-slate-900">
                ₹{record.fee.pending.toLocaleString("en-IN")}
              </strong>
            </p>

            <form className="space-y-3" onSubmit={submitPayment}>
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={record.fee.pending}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none"
                  placeholder="Enter amount"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                  Payment Mode
                </label>
                <select
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:bg-white focus:outline-none"
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                >
                  <option value="UPI">UPI</option>
                  <option value="ONLINE">Online</option>
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>
              </div>

              {paymentError && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700" role="alert">
                  {paymentError}
                </p>
              )}

              <button
                type="submit"
                disabled={!paymentAmount || paymentBusy}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl transition shadow-md shadow-amber-500/20 disabled:opacity-50"
              >
                {paymentBusy ? "Recording Payment..." : "Confirm Payment"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}