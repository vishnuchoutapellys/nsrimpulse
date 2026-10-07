import { Download, FileText, IndianRupee } from 'lucide-react';
import type { jsPDF as JsPdfDocument } from 'jspdf';
import { useEffect, useState } from 'react';

type PaymentHistoryItem = {
  id: string;
  transactionNumber: string;
  receiptNumber: string;
  amount: number;
  mode: string;
  status: string;
  paidAt: string;
  allocations: Array<{ installmentId: string; amount: number; dueDate: string }>;
};

type PaymentHistoryResponse = {
  student: { studentId: string; name: string; course: string; college: string };
  payments: PaymentHistoryItem[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
};

const apiBase = import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:4000`;

export function PaymentHistory({ studentId }: { studentId: string }) {
  const [history, setHistory] = useState<PaymentHistoryResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${apiBase}/api/v1/students/${encodeURIComponent(studentId)}/payments?page=1&pageSize=50`, { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json() as { success?: boolean; data?: PaymentHistoryResponse; error?: { message?: string } };
        if (!response.ok || !result.success || !result.data) throw new Error(result.error?.message ?? 'Unable to load payment history');
        setHistory(result.data);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load payment history'));
  }, [studentId]);

  if (error) return <section className="portal-card history-empty"><FileText size={30} /><h2>Payment history unavailable</h2><p>{error}</p></section>;
  if (!history) return <section className="portal-card history-empty"><div className="portal-loader"></div><p>Loading payment history...</p></section>;
  if (!history.payments.length) return <section className="portal-card history-empty"><FileText size={30} /><h2>No payments yet</h2><p>Paid receipts will appear here after a payment is confirmed.</p></section>;

  return <section className="history-view"><div className="history-summary"><div><span>SUCCESSFUL PAYMENTS</span><strong>{history.pagination.totalItems}</strong></div><div><span>TOTAL PAID</span><strong>₹{history.payments.reduce((sum, payment) => sum + payment.amount, 0).toLocaleString('en-IN')}</strong></div><button className="primary-button" onClick={() => downloadAllReceipts(history)}><Download size={16} /> Download all receipts</button></div><div className="history-list">{history.payments.map((payment) => <article className="portal-card history-item" key={payment.id}><div className="history-icon"><IndianRupee size={20} /></div><div className="history-main"><span className="history-date">{formatDateTime(payment.paidAt)}</span><h2>₹{payment.amount.toLocaleString('en-IN')}</h2><p>{payment.mode.replaceAll('_', ' ')} · {payment.status}</p><div className="history-identifiers"><span><b>Transaction</b>{payment.transactionNumber}</span><span><b>Receipt</b>{payment.receiptNumber}</span></div>{payment.allocations.length > 0 && <p className="history-allocation">Allocated: {payment.allocations.map((allocation) => `₹${allocation.amount.toLocaleString('en-IN')}`).join(' + ')}</p>}</div><button className="history-download" onClick={() => downloadReceipt(history.student, payment)} title="Download receipt"><Download size={18} /><span>Receipt</span></button></article>)}</div></section>;
}

function addReceiptPage(document: JsPdfDocument, student: PaymentHistoryResponse['student'], payment: PaymentHistoryItem, page: number, totalPages: number) {
  document.setFont('helvetica', 'bold');
  document.setFontSize(20);
  document.text('NSR IMPULSE KNOWLEDGE PARK', 20, 24);
  document.setFontSize(11);
  document.setTextColor(211, 91, 70);
  document.text('OFFICIAL PAYMENT RECEIPT', 20, 34);
  document.setDrawColor(24, 62, 54);
  document.line(20, 40, 190, 40);
  document.setTextColor(30, 60, 54);
  document.setFont('helvetica', 'normal');
  const rows: Array<[string, string]> = [
    ['Receipt number', payment.receiptNumber],
    ['Transaction number', payment.transactionNumber],
    ['Payment date', formatDateTime(payment.paidAt)],
    ['Payment mode', payment.mode.replaceAll('_', ' ')],
    ['Student ID', student.studentId],
    ['Student name', student.name],
    ['Course', student.course],
    ['College', student.college]
  ];
  let y = 54;
  for (const [label, value] of rows) {
    document.setFont('helvetica', 'bold');
    document.text(label, 20, y);
    document.setFont('helvetica', 'normal');
    document.text(String(value), 72, y);
    y += 10;
  }
  document.setFillColor(231, 239, 233);
  document.rect(20, y + 2, 170, 25, 'F');
  document.setFont('helvetica', 'bold');
  document.setFontSize(13);
  document.text('Amount paid', 27, y + 17);
  document.setFontSize(18);
  document.text(`INR ${payment.amount.toLocaleString('en-IN')}`, 135, y + 17);
  y += 42;
  document.setFontSize(10);
  document.setFont('helvetica', 'normal');
  document.text('Installment allocations', 20, y);
  y += 8;
  for (const allocation of payment.allocations) {
    document.text(`INR ${allocation.amount.toLocaleString('en-IN')} allocated to installment due ${formatDate(allocation.dueDate)}`, 25, y);
    y += 7;
  }
  document.setTextColor(100, 115, 108);
  document.text('This receipt was generated from the NSR Impulse payment database.', 20, 272);
  document.text(`Page ${page} of ${totalPages}`, 170, 285);
}

async function downloadReceipt(student: PaymentHistoryResponse['student'], payment: PaymentHistoryItem) {
  const { jsPDF } = await import('jspdf');
  const document = new jsPDF();
  addReceiptPage(document, student, payment, 1, 1);
  document.save(`${payment.receiptNumber || payment.transactionNumber}.pdf`);
}

async function downloadAllReceipts(history: PaymentHistoryResponse) {
  const { jsPDF } = await import('jspdf');
  const document = new jsPDF();
  history.payments.forEach((payment, index) => {
    if (index > 0) document.addPage();
    addReceiptPage(document, history.student, payment, index + 1, history.payments.length);
  });
  document.save(`${history.student.studentId}-payment-receipts.pdf`);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
