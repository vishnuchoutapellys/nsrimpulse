import { FormEvent, useState } from 'react';
import { apiBase } from './api';

type Installment = { amount: string; dueDate: string };

export function FeePlanAssignment({ studentUid, status, academicYear, totalFee, token, onAssigned }: {
  studentUid: string;
  status: string;
  academicYear: string;
  totalFee: number;
  token: string;
  onAssigned: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(totalFee <= 0);
  const [year, setYear] = useState(academicYear);
  const [amount, setAmount] = useState(totalFee > 0 ? String(totalFee) : '');
  const [installments, setInstallments] = useState<Installment[]>([{ amount: '', dueDate: '' }]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const isActive = status === 'ACTIVE';
  const total = Number(amount);
  const installmentTotal = installments.reduce((sum, installment) => sum + Number(installment.amount || 0), 0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!isActive) return setError('Only active students can receive a fee plan.');
    if (!Number.isFinite(total) || total <= 0) return setError('Enter a valid total fee.');
    if (Math.abs(installmentTotal - total) > 0.001) return setError('Installment amounts must add up to the total fee.');
    if (installments.some((installment) => !installment.dueDate || Number(installment.amount) <= 0)) return setError('Complete every installment amount and due date.');

    setBusy(true);
    try {
      const response = await fetch(`${apiBase}/api/v1/admin/students/${encodeURIComponent(studentUid)}/fee-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          academicYear: year,
          totalFee: total,
          installments: installments.map((installment) => ({
            amount: Number(installment.amount),
            dueDate: new Date(`${installment.dueDate}T00:00:00.000Z`).toISOString()
          }))
        })
      });
      const result = await response.json() as { success?: boolean; message?: string; error?: { message?: string } };
      if (!response.ok || !result.success) throw new Error(result.error?.message ?? result.message ?? 'Unable to assign the fee plan.');
      setSuccess(result.message ?? 'Fee plan assigned.');
      await onAssigned();
      setExpanded(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to assign the fee plan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="portal-card fee-plan-assignment">
      <div className="fee-plan-assignment-heading">
        <div>
          <h2>{totalFee > 0 ? 'Fee plan' : 'Fee plan not assigned'}</h2>
          <p>{totalFee > 0 ? 'Replace the current plan only when no successful payments exist.' : 'Assign a fee plan to make installments visible in the student portal.'}</p>
        </div>
        <button type="button" className="text-link" disabled={!isActive} onClick={() => setExpanded((open) => !open)}>
          {expanded ? 'Close' : totalFee > 0 ? 'Replace plan' : 'Assign plan'}
        </button>
      </div>
      {!isActive && <p className="fee-plan-assignment-note">Change the student status to Active before assigning fees.</p>}
      {success && <p className="fee-plan-assignment-success" role="status">{success}</p>}
      {expanded && isActive && (
        <form className="fee-plan-form" onSubmit={submit}>
          <div className="fee-plan-form-grid">
            <label>Academic year<input value={year} onChange={(event) => setYear(event.target.value)} pattern="\d{4}-\d{4}" placeholder="2026-2028" required /></label>
            <label>Total fee (₹)<input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
          </div>
          <div className="fee-plan-installments">
            <div className="fee-plan-installment-heading"><strong>Installments</strong><span>₹{installmentTotal.toLocaleString('en-IN')} of ₹{(Number.isFinite(total) ? total : 0).toLocaleString('en-IN')}</span></div>
            {installments.map((installment, index) => (
              <div className="fee-plan-installment-row" key={index}>
                <label>Installment {index + 1} amount<input aria-label={`Installment ${index + 1} amount`} type="number" min="0.01" step="0.01" value={installment.amount} onChange={(event) => setInstallments((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, amount: event.target.value } : item))} required /></label>
                <label>Due date<input aria-label={`Installment ${index + 1} due date`} type="date" value={installment.dueDate} onChange={(event) => setInstallments((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, dueDate: event.target.value } : item))} required /></label>
                {installments.length > 1 && <button type="button" className="fee-plan-remove" aria-label={`Remove installment ${index + 1}`} onClick={() => setInstallments((current) => current.filter((_, itemIndex) => itemIndex !== index))}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg></button>}
              </div>
            ))}
            <button type="button" className="fee-plan-add" disabled={installments.length >= 12} onClick={() => setInstallments((current) => [...current, { amount: '', dueDate: '' }])}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg></button>
          </div>
          {error && <p className="fee-plan-assignment-error" role="alert">{error}</p>}
          <button className="primary-button" disabled={busy}>{busy ? 'Saving plan...' : 'Save fee plan'}</button>
        </form>
      )}
    </section>
  );
}
