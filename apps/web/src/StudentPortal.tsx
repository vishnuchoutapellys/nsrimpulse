import { ArrowLeft, Bell, BookOpen, CalendarDays, CheckCircle2, Download, FileText, IndianRupee, LogOut, UserRound, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PaymentHistory } from './PaymentHistory';

type StudentRecord = {
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
    installments: Array<{ label: string; amount: number; dueDate: string; status: string }>;
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
  reminders: Array<{ id: string; title: string; message: string; dueDate: string; severity: string; read: boolean }>;
};
type PortalTab = 'overview' | 'profile' | 'fees' | 'receipt' | 'history' | 'reminders';
type PaymentMode = 'UPI' | 'ONLINE' | 'CASH' | 'BANK_TRANSFER' | 'CHEQUE' | 'OTHER';
type PaymentResult = { transactionNumber: string; receiptNumber: string; amount: number; mode: PaymentMode; paidAt: string; outstandingAmount: number };
const apiBase = import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:4000`;
let studentRecord: StudentRecord;

function createPaymentRequestId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function fetchStudentRecord(studentId: string, accessToken: string): Promise<StudentRecord> {
  const response = await fetch(`${apiBase}/api/v1/students/${encodeURIComponent(studentId)}/portal`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' });
  const result = await response.json() as { success?: boolean; data?: StudentRecord; error?: { message?: string } };
  if (!response.ok || !result.success || !result.data) throw new Error(result.error?.message ?? 'Unable to load student data');
  return result.data;
}

function validateStudentRecord(record: StudentRecord): void {
  if (!/^NSRTS[A-Z]+-\d{3}$/.test(record.studentId)) throw new Error('Invalid student ID');
  if (!record.name.trim() || !record.fatherName.trim()) throw new Error('Student name and father name are required');
  if (!/^[6-9]\d{9}$/.test(record.mobile)) throw new Error('Invalid mobile number');
  if (!/^\S+@\S+\.\S+$/.test(record.email)) throw new Error('Invalid email address');
  if (!/^\d{6}$/.test(record.pin)) throw new Error('Invalid PIN');
  if (record.courseDurationYears !== 2 || record.courseType !== 'MPC') throw new Error('Invalid course configuration');
  if (record.fee.total <= 0 || record.fee.paid < 0 || record.fee.paid > record.fee.total || record.fee.pending !== record.fee.total - record.fee.paid) throw new Error('Invalid fee totals');
  if (record.fee.installments.reduce((total, installment) => total + installment.amount, 0) !== record.fee.total) throw new Error('Installments do not match total fee');
}

export function StudentPortal({ studentId, accessToken, onBack }: { studentId: string; accessToken: string; onBack: () => void }) {
  const [record, setRecord] = useState<StudentRecord | null>(null);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<PortalTab>('overview');
  const [showPayment, setShowPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('UPI');
  const [paymentError, setPaymentError] = useState('');
  const [paymentResult, setPaymentResult] = useState<PaymentResult | null>(null);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentRequestId, setPaymentRequestId] = useState(createPaymentRequestId);
  useEffect(() => {
    fetchStudentRecord(studentId, accessToken)
      .then(setRecord)
      .catch((error: unknown) => setLoadError(error instanceof Error ? error.message : 'Unable to load student data'));
  }, [studentId]);

  async function submitPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!record) return;
    const amount = Number(paymentAmount);
    setPaymentError('');
    setPaymentResult(null);
    if (!navigator.onLine) return setPaymentError('Payments cannot be submitted while offline.');
    if (!Number.isFinite(amount) || amount <= 0) return setPaymentError('Enter a payment amount greater than zero.');
    if (!Number.isInteger(amount * 100)) return setPaymentError('Use no more than two decimal places.');
    if (amount > record.fee.pending) return setPaymentError(`Amount cannot exceed ₹${record.fee.pending.toLocaleString('en-IN')}.`);
    setPaymentBusy(true);
    try {
      const response = await fetch(`${apiBase}/api/v1/payments/student`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ studentUid: record.studentId, amount, mode: paymentMode, idempotencyKey: paymentRequestId }) });
      const result = await response.json() as { success?: boolean; data?: PaymentResult; error?: { message?: string } };
      if (!response.ok || !result.success || !result.data) throw new Error(result.error?.message ?? 'Payment could not be recorded.');
      setPaymentResult(result.data);
      setRecord(await fetchStudentRecord(studentId, accessToken));
      setPaymentAmount('');
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Payment could not be recorded.');
    } finally { setPaymentBusy(false); }
  }
  if (loadError) return <main className="portal-state"><h1>Unable to load your account</h1><p>{loadError}</p><button className="primary-button" onClick={() => window.location.reload()}>Retry</button></main>;
  if (!record) return <main className="portal-state"><div className="portal-loader"></div><p>Loading your student account...</p></main>;
  validateStudentRecord(record);
  studentRecord = record;
  const unreadReminders = studentRecord.reminders.filter((reminder) => !reminder.read).length;
  const tabs = [
    ['overview', 'Overview', <BookOpen size={17} />],
    ['profile', 'Profile', <UserRound size={17} />],
    ['fees', 'Fees', <IndianRupee size={17} />],
    ['receipt', 'Receipt', <FileText size={17} />],
    ['history', 'History', <CalendarDays size={17} />],
    ['reminders', `Alerts ${unreadReminders ? `(${unreadReminders})` : ''}`, <Bell size={17} />]
  ] as const;

  const openPayment = () => { setPaymentRequestId(createPaymentRequestId()); setPaymentResult(null); setPaymentError(''); setShowPayment(true); };
  const displayStudentName = toDisplayName(studentRecord.name);
  return <main className="student-portal"><header className="portal-top"><button className="brand plain" onClick={onBack}><span className="brand-mark">N</span><span><strong>NSR</strong><small>STUDENT PWA</small></span></button><div className="portal-top-actions"><span className="portal-id">{studentRecord.studentId}</span><span className="student-header-name" title={displayStudentName}>{displayStudentName}</span><button className="portal-logout" onClick={onBack}><LogOut size={16} /> Exit</button></div></header><div className="portal-layout"><aside className="portal-sidebar"><div className="portal-student-mini"><span className="portal-avatar">CV</span><div><strong>{studentRecord.name}</strong><small>{studentRecord.courseType} · {studentRecord.location}</small></div></div><nav>{tabs.map(([key, label, icon]) => <button className={tab === key ? 'active' : ''} key={key} onClick={() => setTab(key)}>{icon}<span>{label}</span></button>)}</nav><div className="portal-side-note"><CheckCircle2 size={16} /><span>Account verified<br /><small>PostgreSQL record</small></span></div></aside><section className="portal-main"><div className="portal-heading"><div><p className="eyebrow">STUDENT ACCOUNT</p><h1>{tab === 'overview' ? <>Your fees, <em>clearly.</em></> : tabs.find(([key]) => key === tab)?.[1]}</h1></div><span className="portal-status"><CheckCircle2 size={15} /> Active</span></div>{tab === 'overview' && <Overview onTabChange={setTab} onPay={openPayment} />}{tab === 'profile' && <Profile />}{tab === 'fees' && <Fees onTabChange={setTab} onPay={openPayment} />}{tab === 'receipt' && <Receipt />}{tab === 'history' && <PaymentHistory studentId={studentId} accessToken={accessToken} />}{tab === 'reminders' && <Reminders />}</section></div>{showPayment && <div className="payment-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !paymentBusy) setShowPayment(false); }}><section className="payment-dialog" role="dialog" aria-modal="true" aria-labelledby="payment-title"><button className="payment-close" onClick={() => setShowPayment(false)} disabled={paymentBusy} aria-label="Close payment"><X size={19} /></button>{paymentResult ? <div className="payment-success"><CheckCircle2 size={42} /><p className="eyebrow">PAYMENT RECORDED</p><h2 id="payment-title">₹{paymentResult.amount.toLocaleString('en-IN')} received</h2><dl><div><dt>Transaction</dt><dd>{paymentResult.transactionNumber}</dd></div><div><dt>Receipt</dt><dd>{paymentResult.receiptNumber}</dd></div><div><dt>Mode</dt><dd>{paymentResult.mode.replace('_', ' ')}</dd></div><div><dt>Remaining</dt><dd>₹{paymentResult.outstandingAmount.toLocaleString('en-IN')}</dd></div></dl><button className="primary-button" onClick={() => { setShowPayment(false); setTab('receipt'); }}>View receipt</button></div> : <form onSubmit={submitPayment}><p className="eyebrow">SECURE PAYMENT ENTRY</p><h2 id="payment-title">Pay an installment</h2><p className="payment-intro">Outstanding balance: <strong>₹{studentRecord.fee.pending.toLocaleString('en-IN')}</strong></p><label className="payment-field"><span>Amount (₹)</span><input type="number" min="0.01" max={studentRecord.fee.pending} step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} placeholder="Enter amount" autoFocus required /></label><label className="payment-field"><span>Payment mode</span><select value={paymentMode} onChange={(event) => setPaymentMode(event.target.value as PaymentMode)}><option value="UPI">UPI</option><option value="ONLINE">Online</option><option value="CASH">Cash</option><option value="BANK_TRANSFER">Bank transfer</option><option value="CHEQUE">Cheque</option><option value="OTHER">Other</option></select></label><p className="payment-warning">This demo records a confirmed payment directly. A production online gateway must verify its webhook before marking payment successful.</p>{paymentError && <p className="payment-error">{paymentError}</p>}<button className="primary-button payment-submit" disabled={paymentBusy || !paymentAmount}>{paymentBusy ? 'Recording payment...' : 'Confirm payment'}</button></form>}</section></div>}</main>;
}

function Overview({ onTabChange, onPay }: { onTabChange: (tab: PortalTab) => void; onPay: () => void }) { const nextReminder = studentRecord.reminders[0]; return <><section className="portal-stat-grid"><div className="portal-stat pending"><span>REMAINING PENDING</span><strong>₹{studentRecord.fee.pending.toLocaleString('en-IN')}</strong><small>of ₹{studentRecord.fee.total.toLocaleString('en-IN')} total fee</small>{studentRecord.fee.pending > 0 && <button className="pay-installment-button" onClick={onPay}>Pay installment</button>}</div><div className="portal-stat"><span>COURSE</span><strong>{studentRecord.courseType}</strong><small>{studentRecord.courseDurationYears} year programme</small></div><div className="portal-stat"><span>PAID SO FAR</span><strong>₹{studentRecord.fee.paid.toLocaleString('en-IN')}</strong><small>{studentRecord.fee.paid > 0 ? 'Recorded payments' : 'No payment recorded'}</small></div></section><div className="portal-columns"><section className="portal-card installment-card"><div className="card-heading"><div><p className="eyebrow">PAYMENT PLAN</p><h2>Two-year fee schedule</h2></div><button className="text-link" onClick={() => onTabChange('fees')}>View details <ArrowRightIcon /></button></div>{studentRecord.fee.installments.map((installment) => <div className="installment-row" key={installment.label}><span className="installment-icon"><CalendarDays size={17} /></span><div><strong>{installment.label}</strong><small>Due {formatDate(installment.dueDate)}</small></div><b>₹{installment.amount.toLocaleString('en-IN')}</b><span className={`fee-status ${installment.status.toLowerCase()}`}>{installment.status}</span></div>)}</section><section className="portal-card reminder-card"><div className="card-heading"><div><p className="eyebrow">NEXT REMINDER</p><h2>{nextReminder?.title ?? 'Fees are up to date'}</h2></div><Bell size={18} /></div><p>{nextReminder?.message ?? 'There are no pending installment reminders.'}</p><button className="primary-button" onClick={() => onTabChange('reminders')}>View reminders</button></section></div></>; }
function Profile() { return <section className="portal-card detail-card"><div className="card-heading"><div><p className="eyebrow">PERSONAL DETAILS</p><h2>{studentRecord.name}</h2></div><span className="immutable-label">ID immutable</span></div><div className="detail-grid">{[['Student ID', studentRecord.studentId], ['Father name', studentRecord.fatherName], ['Age', `${studentRecord.age} years`], ['Course type', studentRecord.courseType], ['Location', studentRecord.location], ['Mobile', studentRecord.mobile], ['Email', studentRecord.email], ['Village', studentRecord.village], ['PIN', studentRecord.pin]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></section>; }
function Fees({ onTabChange, onPay }: { onTabChange: (tab: PortalTab) => void; onPay: () => void }) { return <><section className="portal-card fee-summary"><div><span>Total fee for 2 years</span><strong>₹{studentRecord.fee.total.toLocaleString('en-IN')}</strong></div><div><span>Paid</span><strong className="green">₹{studentRecord.fee.paid.toLocaleString('en-IN')}</strong></div><div><span>Pending</span><strong className="coral">₹{studentRecord.fee.pending.toLocaleString('en-IN')}</strong></div></section><section className="portal-card"><div className="card-heading"><div><p className="eyebrow">INSTALLMENTS</p><h2>Payment schedule</h2></div><div className="fee-actions">{studentRecord.fee.pending > 0 && <button className="primary-button" onClick={onPay}>Pay installment</button>}<button className="text-link" onClick={() => onTabChange('receipt')}>Open receipt <FileText size={15} /></button></div></div><div className="fee-table"><div className="fee-table-row fee-table-label"><span>Installment</span><span>Due date</span><span>Amount</span><span>Status</span></div>{studentRecord.fee.installments.map((installment) => <div className="fee-table-row" key={installment.label}><span><b>{installment.label}</b></span><span>{formatDate(installment.dueDate)}</span><strong>₹{installment.amount.toLocaleString('en-IN')}</strong><span className={`fee-status ${installment.status.toLowerCase()}`}>{installment.status}</span></div>)}</div></section></>; }
function Receipt() { return <section className="receipt-wrap"><div className="receipt paper"><div className="receipt-header"><div className="brand"><span className="brand-mark">N</span><span><strong>NSR</strong><small>IMPULSE KNOWLEDGE PARK</small></span></div><span className="receipt-label">FEE INVOICE</span></div><div className="receipt-meta"><div><span>Invoice number</span><strong>{studentRecord.receipt.invoiceNumber}</strong></div><div><span>Transaction number</span><strong>{studentRecord.receipt.transactionNumber}</strong></div><div><span>Date & time</span><strong>{formatDateTime(studentRecord.receipt.dateTime)}</strong></div><div><span>Payment type</span><strong>{studentRecord.receipt.paymentType}</strong></div></div><div className="receipt-student"><span>BILLED TO</span><strong>{studentRecord.name}</strong><p>{studentRecord.studentId} · {studentRecord.courseType} · {studentRecord.location}</p><p>{studentRecord.email} · {studentRecord.mobile}</p></div><div className="receipt-line"><span>Two-year {studentRecord.courseType} course fee</span><strong>₹{studentRecord.fee.total.toLocaleString('en-IN')}</strong></div><div className="receipt-line"><span>Amount paid</span><strong>₹{studentRecord.fee.paid.toLocaleString('en-IN')}</strong></div><div className="receipt-total"><span>Remaining amount</span><strong>₹{studentRecord.fee.pending.toLocaleString('en-IN')}</strong></div><div className="receipt-pending"><Bell size={16} /><span>{studentRecord.receipt.note}</span></div><button className="primary-button print-button" onClick={() => window.print()}><Download size={16} /> Print / download invoice</button></div></section>; }
function Reminders() { return <section className="reminder-list">{studentRecord.reminders.map((reminder) => <article className={`portal-card reminder-item ${reminder.severity.toLowerCase()}`} key={reminder.id}><span className="reminder-icon"><Bell size={18} /></span><div><span className="reminder-date">Due {formatDate(reminder.dueDate)}</span><h2>{reminder.title}</h2><p>{reminder.message}</p></div><span className="reminder-unread">{reminder.read ? 'Read' : 'New'}</span></article>)}</section>; }
function ArrowRightIcon() { return <span aria-hidden="true">→</span>; }
function formatDate(value: string) { return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
function toDisplayName(value: string) { return value.trim().toLowerCase().replace(/\b\p{L}/gu, (letter) => letter.toUpperCase()); }
