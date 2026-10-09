import { ArrowUpRight, BookOpen, CheckCircle2, Eye, EyeOff, FileText, Home, IndianRupee, LockKeyhole, LogOut, UserRound } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';

const apiBase = import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:4000`;
type AdminView = 'dashboard' | 'search' | 'create' | 'certificates';
type CertificateType = 'TRANSFER' | 'BONAFIDE_CONDUCT';
type AdminContext = { admin: { adminId: string; email: string }; scopes: Array<{ college: { id: string; name: string }; branch: { id: string; name: string } | null }>; courses: Array<{ id: string; name: string }> };
type InstallmentInput = { amount: string; dueDate: string };
type OfflinePaymentResult = { studentUid: string; paymentId: string; amount: number; mode: 'CASH' | 'UPI'; transactionNumber: string; receiptNumber: string; paidAt: string; outstandingAmount?: number };
type StudentDetail = {
  student: { studentUid: string; name: string; fatherName: string | null; motherName: string | null; dateOfBirth: string | null; nationality: string | null; religion: string | null; casteCommunity: string | null; mediumOfInstruction: string | null; firstLanguage: string | null; secondLanguage: string | null; thirdLanguage: string | null; gender: string | null; age: number | null; mobile: string; email: string | null; address: string | null; village: string | null; pin: string | null; admissionYear: number; academicYear: string; status: string; createdAt: string };
  organization: { state: string; location: string; college: string; branch: string; course: string };
  fees: { totalFee: number; paid: number; pending: number; installments: Array<{ id: string; amount: number; paid: number; dueDate: string }>; discounts: Array<{ name: string; amount: number; approvedAt: string }> };
  payments: Array<{ amount: number; mode: string; reference: string | null; receiptNumber: string | null; paidAt: string }>;
  statusHistory: Array<{ id: string; fromStatus: string | null; toStatus: string; reason: string | null; changedBy: string; createdAt: string }>;
};

export function CollegeAdminPortal({ onBack, onStudentLogin }: { onBack: () => void; onStudentLogin: () => void }) {
  const [token, setToken] = useState('');
  return token ? <AdminWorkspace token={token} onLogout={() => setToken('')} onBack={onBack} /> : <AdminLogin onAuthenticated={setToken} onBack={onBack} onStudentLogin={onStudentLogin} />;
}

function AdminLogin({ onAuthenticated, onBack, onStudentLogin }: { onAuthenticated: (token: string) => void; onBack: () => void; onStudentLogin: () => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (!String(data.adminId ?? '').trim() || String(data.password ?? '').length < 8) return setError('Enter the College Admin ID and password.');
    setBusy(true);
    try {
      const response = await fetch(`${apiBase}/api/v1/admin/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const result = await response.json() as { success?: boolean; data?: { accessToken: string }; error?: { message?: string } };
      if (!response.ok || !result.data) throw new Error(result.error?.message ?? 'Unable to sign in');
      onAuthenticated(result.data.accessToken);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to sign in'); }
    finally { setBusy(false); }
  }
  return <main className="auth-shell admin-auth"><section className="auth-brand admin-auth-brand"><div className="auth-brand-header"><div className="auth-brand-copy"><span className="brand-mark">N</span><span><strong>NSR</strong><small>IMPULSE KNOWLEDGE PARK</small></span></div><button className="auth-home-button" type="button" onClick={onBack} aria-label="Go to home" title="Home"><Home size={19} /></button></div><div className="auth-quote"><p>"One campus, <em>Clear control."</em></p><span>Accurate records and traceable student services.</span></div></section><section className="auth-panel admin-auth-form"><div className="auth-role-switch" role="group" aria-label="Choose account type"><button type="button" aria-pressed="false" onClick={onStudentLogin}>Student</button><button type="button" className="active" aria-pressed="true">College Admin</button></div><h1>College <em>Admin.</em></h1><p className="auth-intro">Use the account issued by your organization.</p><form onSubmit={submit}><label className="field"><span>Admin ID</span><div className="input-wrap"><UserRound size={17} /><input name="adminId" placeholder="NSRTSADMMIN-001" autoComplete="username" required /></div></label><label className="field"><span>Password</span><div className="input-wrap"><LockKeyhole size={17} /><input name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>{error && <p className="admin-form-error">{error}</p>}<button className="primary-button auth-submit" disabled={busy}>{busy ? 'Signing in...' : 'Sign in as College Admin'}</button></form><p className="admin-demo">Demo ID: <strong>NSRTSADMMIN-001</strong></p></section></main>;
}

function AdminWorkspace({ token, onLogout, onBack }: { token: string; onLogout: () => void; onBack: () => void }) {
  const [context, setContext] = useState<AdminContext | null>(null);
  const [view, setView] = useState<AdminView>('dashboard');
  const [error, setError] = useState('');
  useEffect(() => { adminFetch<AdminContext>('/context', token).then(setContext).catch((reason) => setError(reason.message)); }, [token]);
  if (error) return <main className="portal-state"><h1>Admin portal unavailable</h1><p>{error}</p><button className="primary-button" onClick={onLogout}>Sign in again</button></main>;
  if (!context) return <main className="portal-state"><div className="portal-loader"></div><p>Loading authorized scope...</p></main>;
  return <main className="admin-portal"><header className="portal-top"><button className="brand plain" onClick={onBack}><span className="brand-mark">N</span><span><strong>NSR</strong><small>COLLEGE ADMIN</small></span></button><div className="portal-top-actions"><span className="portal-id">{context.admin.adminId}</span><button className="portal-logout" onClick={onLogout}><LogOut size={16} /> Sign out</button></div></header><div className="admin-layout"><aside className="admin-nav"><div><strong>{context.scopes[0]?.college.name}</strong><small>{context.scopes[0]?.branch?.name ?? 'All branches'}</small></div><nav><button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}><BookOpen size={17} /> Overview</button><button className={view === 'search' ? 'active' : ''} onClick={() => setView('search')}><UserRound size={17} /> Search student</button><button className={view === 'create' ? 'active' : ''} onClick={() => setView('create')}><IndianRupee size={17} /> New admission</button><button className={view === 'certificates' ? 'active' : ''} onClick={() => setView('certificates')}><FileText size={17} /> Certificates</button></nav></aside><section className="admin-main">{view === 'dashboard' && <AdminOverview context={context} onNavigate={setView} />}{view === 'search' && <StudentSearch token={token} />}{view === 'create' && <CreateStudent token={token} context={context} onCreated={() => setView('search')} />}{view === 'certificates' && <CertificateCenter token={token} />}</section></div></main>;
}

function AdminOverview({ context, onNavigate }: { context: AdminContext; onNavigate: (view: AdminView) => void }) {
  const collegeCount = new Set(context.scopes.map((scope) => scope.college.id)).size;
  const assignedBranches = new Set(context.scopes.map((scope) => scope.branch?.id).filter(Boolean)).size;
  const branchCount = assignedBranches || 'All';
  return (
    <>
      <div className="admin-page-heading admin-welcome">
        <div><p className="eyebrow">CAMPUS OPERATIONS</p><h1>Good morning,<br /><em>{context.admin.adminId}</em></h1><p>Your authorized workspace is ready. Choose an action or review your access scope.</p></div>
        <div className="admin-date"><span>WORKSPACE</span><strong>College administration</strong><small>Secure · Role-scoped access</small></div>
      </div>
      <div className="admin-overview-metrics">
        <article><span>Assigned colleges</span><strong>{collegeCount}</strong><small>Within your authorized scope</small></article>
        <article><span>Assigned branches</span><strong>{branchCount}</strong><small>{assignedBranches ? 'Branch-specific access' : 'College-wide access'}</small></article>
        <article><span>Available courses</span><strong>{context.courses.length}</strong><small>Courses available for admission</small></article>
      </div>
      <div className="admin-section-title"><div><p className="eyebrow">QUICK ACTIONS</p><h2>What would you like to do?</h2></div></div>
      <div className="admin-action-grid">
        <button onClick={() => onNavigate('create')}><span>01</span><UserRound size={24} /><h2>Create student</h2><p>Create the student master record, fee assignment, and installment plan in one flow.</p><b>Start admission <ArrowUpRight size={15} /></b></button>
        <button onClick={() => onNavigate('search')}><span>02</span><BookOpen size={24} /><h2>Find student</h2><p>Search by immutable Student ID to review academic and financial details.</p><b>Search records <ArrowUpRight size={15} /></b></button>
      </div>
      <section className="portal-card admin-scope-card"><div className="admin-section-title"><div><p className="eyebrow">AUTHORIZED SCOPE</p><h2>Your access</h2></div><CheckCircle2 size={21} /></div>{context.scopes.map((scope) => <div key={`${scope.college.id}-${scope.branch?.id}`}><CheckCircle2 size={17} /><span><strong>{scope.college.name}</strong><small>{scope.branch?.name ?? 'All branches'}</small></span></div>)}</section>
    </>
  );
}

function StudentSearch({ token }: { token: string }) {
  const [studentId, setStudentId] = useState('');
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function loadStudent(id: string) { setError(''); setBusy(true); try { setDetail(await adminFetch<StudentDetail>(`/students/${encodeURIComponent(id.trim().toUpperCase())}`, token)); } catch (reason) { setDetail(null); setError(reason instanceof Error ? reason.message : 'Search failed'); } finally { setBusy(false); } }
  async function search(event: FormEvent) { event.preventDefault(); await loadStudent(studentId); }
  return <><div className="admin-page-heading compact"><p className="eyebrow">STUDENT SEARCH</p><h1>Find the master record.</h1></div><form className="admin-search" onSubmit={search}><input value={studentId} onChange={(event) => setStudentId(event.target.value)} placeholder="Enter Student ID" required /><button className="primary-button" disabled={busy}>{busy ? 'Searching...' : 'Search'}</button></form>{error && <p className="admin-form-error">{error}</p>}{detail && <StudentDetails detail={detail} token={token} onPaymentRecorded={() => loadStudent(detail.student.studentUid)} />}</>;
}

type CertificateField = { key: string; label: string; type?: 'text' | 'date'; required?: boolean };

const transferCertificateFields: CertificateField[] = [
  { key: 'certificateNumber', label: 'Transfer certificate number' },
  { key: 'collegeName', label: 'Junior college name', required: true },
  { key: 'pupilName', label: 'Name of the pupil', required: true },
  { key: 'fatherName', label: 'Name of the father' },
  { key: 'motherName', label: 'Name of the mother' },
  { key: 'nationality', label: 'Nationality' },
  { key: 'religion', label: 'Religion' },
  { key: 'casteCommunity', label: 'Caste / community' },
  { key: 'dateOfBirth', label: 'Date of birth', type: 'date' },
  { key: 'admissionNumber', label: 'Admission number' },
  { key: 'dateOfAdmission', label: 'Date of admission', type: 'date' },
  { key: 'classAtAdmission', label: 'Class at admission' },
  { key: 'mediumOfInstruction', label: 'Medium of instruction' },
  { key: 'firstLanguage', label: 'First language' },
  { key: 'secondLanguage', label: 'Second language' },
  { key: 'thirdLanguage', label: 'Third language' },
  { key: 'lastClassStudied', label: 'Last class studied' },
  { key: 'qualifiedForPromotion', label: 'Qualified for promotion' },
  { key: 'reasonForLeaving', label: 'Reason for leaving' },
  { key: 'feeConcession', label: 'Fee concession / scholarship' },
  { key: 'personalMarks', label: 'Personal marks of identification' },
  { key: 'dateLeft', label: 'Date the pupil left', type: 'date' },
  { key: 'conduct', label: 'Conduct', required: true },
  { key: 'issueDate', label: 'Date of issue', type: 'date', required: true }
];

const bonafideCertificateFields: CertificateField[] = [
  { key: 'certificateNumber', label: 'Certificate number' },
  { key: 'admissionNumber', label: 'Admission number' },
  { key: 'pupilName', label: 'Student name', required: true },
  { key: 'parentName', label: 'Father / parent name' },
  { key: 'course', label: 'Course studied', required: true },
  { key: 'academicYear', label: 'Academic year / group', required: true },
  { key: 'dateOfBirth', label: 'Date of birth', type: 'date' },
  { key: 'conduct', label: 'Conduct and character', required: true },
  { key: 'place', label: 'Place of issue' },
  { key: 'issueDate', label: 'Date of issue', type: 'date', required: true }
];

function CertificateCenter({ token }: { token: string }) {
  const [studentUid, setStudentUid] = useState('');
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [certificateType, setCertificateType] = useState<CertificateType>('TRANSFER');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [searching, setSearching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const activeFields = certificateType === 'TRANSFER' ? transferCertificateFields : bonafideCertificateFields;

  async function loadStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    setSearching(true);
    try {
      const result = await adminFetch<StudentDetail>(`/students/${encodeURIComponent(studentUid.trim().toUpperCase())}`, token);
      setDetail(result);
      setFields(makeCertificateFields(result, certificateType));
    } catch (reason) {
      setDetail(null);
      setFields({});
      setError(reason instanceof Error ? reason.message : 'Unable to load student record');
    } finally { setSearching(false); }
  }

  function changeType(nextType: CertificateType) {
    setCertificateType(nextType);
    setNotice('');
    if (detail) setFields(makeCertificateFields(detail, nextType));
  }

  async function generateCertificate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    setError('');
    setNotice('');
    setGenerating(true);
    try {
      const result = await adminFetch<{ outstandingAmount: number }>(`/students/${encodeURIComponent(detail.student.studentUid)}/certificates/issue`, token, {
        method: 'POST',
        body: JSON.stringify({ certificateType, fields })
      });
      if (result.outstandingAmount > 0) {
        const dueAmount = result.outstandingAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
        setNotice(`Fee due alert: ${dueAmount} remains unpaid. Certificate generation is continuing.`);
        window.alert(`Fee due alert: ${dueAmount} remains unpaid. The certificate will still be generated.`);
      } else {
        setNotice('Certificate generated and recorded successfully.');
      }
      await downloadCertificate(certificateType, fields, detail.organization.college);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to generate certificate');
    } finally { setGenerating(false); }
  }

  return <div className="certificate-center">
    <div className="admin-page-heading compact"><p className="eyebrow">STUDENT DOCUMENTS</p><h1>Generate a certificate.</h1><p>Look up the student record. Available profile details are filled in automatically.</p></div>
    <form className="admin-search certificate-lookup" onSubmit={loadStudent}><input value={studentUid} onChange={(event) => setStudentUid(event.target.value)} placeholder="Enter Student ID" aria-label="Student ID" required /><button className="primary-button" disabled={searching}>{searching ? 'Loading...' : 'Load student'}</button></form>
    {error && <p className="admin-form-error" role="alert">{error}</p>}
    {detail && <>
      {detail.fees.pending > 0 && <div className="certificate-fee-alert" role="status"><IndianRupee size={20} /><div><strong>Outstanding fees</strong><span>₹{detail.fees.pending.toLocaleString('en-IN')} remains unpaid. You may continue, but confirm dues before issuing the certificate.</span></div></div>}
      <section className="certificate-student-summary"><div><span>STUDENT RECORD</span><strong>{detail.student.name}</strong><small>{detail.student.studentUid} · {detail.organization.course} · {detail.organization.branch}</small></div><div><span>FEE BALANCE</span><strong className={detail.fees.pending > 0 ? 'certificate-balance-due' : ''}>₹{detail.fees.pending.toLocaleString('en-IN')}</strong><small>{detail.fees.pending > 0 ? 'Outstanding' : 'Clear'}</small></div></section>
      <div className="certificate-type-switch" role="group" aria-label="Certificate type"><button type="button" className={certificateType === 'TRANSFER' ? 'active' : ''} aria-pressed={certificateType === 'TRANSFER'} onClick={() => changeType('TRANSFER')}>Transfer Certificate (TC)</button><button type="button" className={certificateType === 'BONAFIDE_CONDUCT' ? 'active' : ''} aria-pressed={certificateType === 'BONAFIDE_CONDUCT'} onClick={() => changeType('BONAFIDE_CONDUCT')}>Bonafide & Conduct (CC)</button></div>
      <form className="certificate-fields" onSubmit={generateCertificate}><div className="certificate-fields-heading"><div><p className="eyebrow">{certificateType === 'TRANSFER' ? 'TRANSFER CERTIFICATE' : 'BONAFIDE & CONDUCT CERTIFICATE'}</p><h2>{certificateType === 'TRANSFER' ? 'Transfer Certificate' : 'Bonafide and Conduct Certificate'}</h2></div><span>Prefilled from student record where available</span></div><div className="certificate-field-grid">{activeFields.map((field) => <label key={field.key}><span>{field.label}{field.required ? ' *' : ''}</span><input type={field.type ?? 'text'} value={fields[field.key] ?? ''} onChange={(event) => setFields((current) => ({ ...current, [field.key]: event.target.value }))} required={field.required} /></label>)}</div><div className="certificate-actions"><button className="primary-button" disabled={generating}>{generating ? 'Generating...' : `Generate ${certificateType === 'TRANSFER' ? 'TC' : 'CC'} PDF`}</button></div></form>
      {notice && <p className={detail.fees.pending > 0 ? 'certificate-notice due' : 'certificate-notice'} role="status">{notice}</p>}
    </>}
  </div>;
}

function makeCertificateFields(detail: StudentDetail, type: CertificateType): Record<string, string> {
  const date = new Date().toISOString().slice(0, 10);
  const base = {
    pupilName: detail.student.name,
    fatherName: detail.student.fatherName ?? '',
    admissionNumber: detail.student.studentUid,
    course: detail.organization.course,
    academicYear: detail.student.academicYear,
    issueDate: date,
    conduct: 'GOOD'
  };
  const profile = detail.student;
  if (type === 'TRANSFER') return { ...base, certificateNumber: `NSR/TC/${new Date().getFullYear()}/${profile.studentUid}`, collegeName: detail.organization.college, qualifiedForPromotion: '', dateOfBirth: profile.dateOfBirth ?? '', dateOfAdmission: '', classAtAdmission: '', mediumOfInstruction: profile.mediumOfInstruction ?? '', firstLanguage: profile.firstLanguage ?? '', secondLanguage: profile.secondLanguage ?? '', thirdLanguage: profile.thirdLanguage ?? '', lastClassStudied: detail.organization.course, reasonForLeaving: '', feeConcession: '', personalMarks: '', motherName: profile.motherName ?? '', nationality: profile.nationality ?? 'INDIAN', religion: profile.religion ?? '', casteCommunity: profile.casteCommunity ?? '', dateLeft: '' };
  return { ...base, certificateNumber: `NSR/CC/${new Date().getFullYear()}/${profile.studentUid}`, parentName: profile.fatherName ?? '', dateOfBirth: profile.dateOfBirth ?? '', course: detail.organization.course, place: detail.organization.location };
}

async function downloadCertificate(type: CertificateType, fields: Record<string, string>, collegeName: string) {
  const { jsPDF } = await import('jspdf');
  const isTransfer = type === 'TRANSFER';
  const document = new jsPDF({ orientation: isTransfer ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = document.internal.pageSize.getWidth();
  document.setDrawColor(23, 61, 55);
  document.setLineWidth(0.8);
  document.rect(8, 8, pageWidth - 16, document.internal.pageSize.getHeight() - 16);
  document.setTextColor(23, 61, 55);
  document.setFont('helvetica', 'bold');
  document.setFontSize(isTransfer ? 17 : 18);
  document.text(collegeName.toUpperCase(), pageWidth / 2, 18, { align: 'center' });
  document.setFontSize(isTransfer ? 12 : 15);
  document.text(isTransfer ? 'TRANSFER CERTIFICATE' : 'BONAFIDE AND CONDUCT CERTIFICATE', pageWidth / 2, 27, { align: 'center' });
  document.setFont('helvetica', 'normal');
  document.setFontSize(9);
  document.text(`Certificate No: ${fields.certificateNumber ?? ''}`, 14, 35);
  if (isTransfer) {
    const rows: Array<[string, string]> = transferCertificateFields.map((field) => [field.label, fields[field.key] || '—']);
    const half = Math.ceil(rows.length / 2);
    const drawColumn = (items: Array<[string, string]>, x: number) => {
      let y = 43;
      for (const [label, value] of items) {
        document.setFont('helvetica', 'bold');
        document.text(label, x, y);
        document.setFont('helvetica', 'normal');
        const valueLines = document.splitTextToSize(value, 67) as string[];
        document.text(valueLines.slice(0, 2), x + 60, y);
        y += 10;
      }
    };
    drawColumn(rows.slice(0, half), 14);
    drawColumn(rows.slice(half), 154);
    document.setFont('helvetica', 'bold');
    document.text('Principal signature: ____________________', pageWidth - 86, 194);
  } else {
    const statement = `This is to certify that ${fields.pupilName ?? ''}, son/daughter of ${fields.parentName ?? fields.fatherName ?? ''}, is/was a student of ${collegeName}, studying/studied ${fields.course ?? ''} during the academic year ${fields.academicYear ?? ''}. The date of birth as per college records is ${fields.dateOfBirth || '________________'}. His/Her conduct and character are ${fields.conduct ?? ''}.`;
    document.setFontSize(13);
    const lines = document.splitTextToSize(statement, pageWidth - 48) as string[];
    document.text(lines, 24, 85, { lineHeightFactor: 1.8 });
    document.setFontSize(10);
    document.text(`Admission No: ${fields.admissionNumber ?? ''}`, 24, 55);
    document.text(`Course: ${fields.course ?? ''}`, 24, 65);
    document.text(`Academic year: ${fields.academicYear ?? ''}`, 24, 75);
    document.text(`Place: ${fields.place ?? ''}`, 24, 153);
    document.text(`Date: ${fields.issueDate ?? ''}`, 24, 162);
    document.setFont('helvetica', 'bold');
    document.text('Principal', pageWidth - 45, 175);
    document.text('________________________', pageWidth - 68, 170);
  }
  document.save(`${fields.certificateNumber || detailFileName(fields.pupilName)}.pdf`);
}

function detailFileName(value?: string) { return (value || 'student-certificate').trim().replace(/[^a-z0-9-]+/gi, '-'); }

function StudentDetails({ detail, token, onPaymentRecorded }: { detail: StudentDetail; token: string; onPaymentRecorded: () => Promise<void> }) {
  const fields = [['Student ID', detail.student.studentUid], ['Name', detail.student.name], ['Father name', detail.student.fatherName], ['Age', detail.student.age], ['Gender', detail.student.gender], ['Mobile', detail.student.mobile], ['Email', detail.student.email], ['Address', detail.student.address], ['Village', detail.student.village], ['PIN', detail.student.pin], ['Academic year', detail.student.academicYear], ['Status', detail.student.status], ['College', detail.organization.college], ['Branch', detail.organization.branch], ['Course', detail.organization.course]];
  return <div className="admin-student-detail"><section className="portal-card"><div className="card-heading"><div><p className="eyebrow">MASTER RECORD</p><h2>{detail.student.name}</h2></div><span className="immutable-label">ID immutable</span></div><div className="detail-grid">{fields.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value ?? 'Not provided'}</strong></div>)}</div></section><section className="portal-card fee-summary"><div><span>Total fee</span><strong>₹{detail.fees.totalFee.toLocaleString('en-IN')}</strong></div><div><span>Paid</span><strong className="green">₹{detail.fees.paid.toLocaleString('en-IN')}</strong></div><div><span>Pending</span><strong className="coral">₹{detail.fees.pending.toLocaleString('en-IN')}</strong></div></section>{detail.fees.pending > 0 && <OfflinePaymentCard detail={detail} token={token} onPaymentRecorded={onPaymentRecorded} />}<section className="portal-card"><p className="eyebrow">INSTALLMENTS</p>{detail.fees.installments.map((installment, index) => <div className="admin-installment" key={installment.id}><span>Year {index + 1}<small>Due {formatDate(installment.dueDate)}</small></span><strong>₹{installment.amount.toLocaleString('en-IN')}</strong><b>Paid ₹{installment.paid.toLocaleString('en-IN')}</b></div>)}</section><section className="portal-card"><p className="eyebrow">PAYMENTS & RECEIPTS</p>{detail.payments.length ? detail.payments.map((payment) => <div className="admin-record-row" key={payment.reference}><span><strong>₹{payment.amount.toLocaleString('en-IN')}</strong><small>{formatDate(payment.paidAt)} · {payment.mode.replaceAll('_', ' ')}</small></span><span><b>{payment.reference}</b><small>{payment.receiptNumber ?? 'Receipt pending'}</small></span></div>) : <p className="admin-empty-copy">No successful payments recorded.</p>}</section><section className="portal-card"><p className="eyebrow">DISCOUNTS</p>{detail.fees.discounts.length ? detail.fees.discounts.map((discount) => <div className="admin-record-row" key={`${discount.name}-${discount.approvedAt}`}><span><strong>{discount.name}</strong><small>Approved {formatDate(discount.approvedAt)}</small></span><b>₹{discount.amount.toLocaleString('en-IN')}</b></div>) : <p className="admin-empty-copy">No discounts applied.</p>}</section><section className="portal-card"><p className="eyebrow">STATUS HISTORY</p>{detail.statusHistory.map((history) => <div className="admin-record-row" key={history.id}><span><strong>{history.fromStatus ? `${history.fromStatus} → ` : ''}{history.toStatus}</strong><small>{history.reason ?? 'Status updated'} · {formatDate(history.createdAt)}</small></span><b>{history.changedBy}</b></div>)}</section></div>;
}

function OfflinePaymentCard({ detail, token, onPaymentRecorded }: { detail: StudentDetail; token: string; onPaymentRecorded: () => Promise<void> }) {
  const [mode, setMode] = useState<'CASH' | 'UPI'>('CASH');
  const [amount, setAmount] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<OfflinePaymentResult | null>(null);
  const [requestId, setRequestId] = useState(createRequestId);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setResult(null); const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return setError('Enter a positive payment amount.');
    if (numericAmount > detail.fees.pending) return setError(`Amount cannot exceed ₹${detail.fees.pending.toLocaleString('en-IN')}.`);
    if (mode === 'UPI' && !referenceNumber.trim()) return setError('UPI reference number is required.');
    setBusy(true);
    try {
      const payment = await adminFetch<OfflinePaymentResult>(`/students/${encodeURIComponent(detail.student.studentUid)}/offline-payments`, token, { method: 'POST', body: JSON.stringify({ amount: numericAmount, mode, referenceNumber: referenceNumber.trim() || undefined, notes: notes.trim() || undefined, paymentDate: new Date().toISOString(), idempotencyKey: requestId }) });
      setResult(payment); setAmount(''); setReferenceNumber(''); setNotes(''); await onPaymentRecorded();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to record payment'); }
    finally { setBusy(false); }
  }
  return <section className="portal-card admin-offline-payment"><div className="card-heading"><div><p className="eyebrow">OFFLINE COLLECTION</p><h2>Record Cash / UPI payment</h2></div><IndianRupee size={20} /></div>{result ? <div className="admin-payment-result"><CheckCircle2 size={28} /><div><strong>₹{result.amount.toLocaleString('en-IN')} recorded</strong><p>{result.receiptNumber} · {result.transactionNumber}</p></div><button className="primary-button" onClick={() => downloadAdminReceipt(detail, result)}>Download receipt</button><button className="text-link" onClick={() => { setResult(null); setRequestId(createRequestId()); }}>Record another</button></div> : <form onSubmit={submit}><label><span>Amount (₹)</span><input type="number" min="0.01" max={detail.fees.pending} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label><label><span>Mode</span><select value={mode} onChange={(event) => setMode(event.target.value as 'CASH' | 'UPI')}><option value="CASH">Cash</option><option value="UPI">UPI</option></select></label>{mode === 'UPI' && <label><span>UPI reference</span><input value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} maxLength={100} required /></label>}<label className="admin-notes"><span>Notes</span><input value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} placeholder="Optional collection note" /></label>{error && <p className="admin-form-error">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? 'Recording...' : 'Record payment & generate receipt'}</button></form>}</section>;
}

function CreateStudent({ token, context, onCreated }: { token: string; context: AdminContext; onCreated: () => void }) {
  const scope = context.scopes[0];
  const currentYear = new Date().getFullYear();
  const [installments, setInstallments] = useState<InstallmentInput[]>([{ amount: '', dueDate: `${currentYear}-10-15` }, { amount: '', dueDate: `${currentYear + 1}-10-15` }]);
  const [totalFee, setTotalFee] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  function splitFee(value: string) { setTotalFee(value); const total = Number(value); if (total > 0) { const base = Math.floor((total / installments.length) * 100) / 100; setInstallments((items) => items.map((item, index) => ({ ...item, amount: String(index === items.length - 1 ? Number((total - base * (items.length - 1)).toFixed(2)) : base) }))); } }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage(''); if (!scope?.branch) return setError('An assigned branch is required.');
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const body = { ...form, age: Number(form.age), admissionYear: Number(form.admissionYear), totalFee: Number(totalFee), collegeId: scope.college.id, branchId: scope.branch.id, installments: installments.map((installment) => ({ amount: Number(installment.amount), dueDate: new Date(`${installment.dueDate}T00:00:00+05:30`).toISOString() })) };
    setBusy(true); try { const result = await adminFetch<{ studentUid: string }>('/students', token, { method: 'POST', body: JSON.stringify(body) }); setMessage(`Student ${result.studentUid} created successfully.`); event.currentTarget.reset(); setTotalFee(''); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to create student'); } finally { setBusy(false); }
  }
  return <><div className="admin-page-heading compact"><p className="eyebrow">NEW ADMISSION</p><h1>Create student and fee plan.</h1></div><form className="admin-create-form" onSubmit={submit}><fieldset><legend>Student identity</legend><FormField name="studentUid" label="Student ID" placeholder="NSRTSHYD-002" required /><FormField name="name" label="Full name" required /><FormField name="fatherName" label="Father name" required /><label><span>Gender</span><select name="gender" required><option value="">Select</option><option value="MALE">Male</option><option value="FEMALE">Female</option><option value="OTHER">Other</option></select></label><FormField name="age" label="Age" type="number" min="14" max="80" required /><FormField name="mobile" label="Mobile" placeholder="10-digit number" required /><FormField name="email" label="Email" type="email" required /></fieldset><fieldset><legend>Address & academics</legend><FormField name="address" label="Address" required /><FormField name="village" label="Village / City" required /><FormField name="pin" label="PIN" placeholder="6 digits" required /><FormField name="admissionYear" label="Admission year" type="number" defaultValue={String(currentYear)} required /><FormField name="academicYear" label="Academic year" defaultValue={`${currentYear}-${currentYear + 2}`} required /><label><span>Course</span><select name="courseId" required>{context.courses.map((course) => <option value={course.id} key={course.id}>{course.name}</option>)}</select></label><label><span>College / branch</span><input value={`${scope?.college.name ?? ''} · ${scope?.branch?.name ?? ''}`} disabled /></label></fieldset><fieldset><legend>Certificate profile</legend><FormField name="motherName" label="Mother name" /><FormField name="dateOfBirth" label="Date of birth" type="date" /><FormField name="nationality" label="Nationality" defaultValue="INDIAN" /><FormField name="religion" label="Religion" /><FormField name="casteCommunity" label="Caste / community" /><FormField name="mediumOfInstruction" label="Medium of instruction" /><FormField name="firstLanguage" label="First language" /><FormField name="secondLanguage" label="Second language" /><FormField name="thirdLanguage" label="Third language" /></fieldset><fieldset className="fee-fieldset"><legend>Fee assignment</legend><label><span>Total fee (₹)</span><input type="number" min="0.01" step="0.01" value={totalFee} onChange={(event) => splitFee(event.target.value)} required /></label><div className="admin-installment-editor">{installments.map((installment, index) => <div key={index}><strong>Installment {index + 1}</strong><input aria-label={`Installment ${index + 1} amount`} type="number" min="0.01" step="0.01" value={installment.amount} onChange={(event) => setInstallments((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, amount: event.target.value } : item))} required /><input aria-label={`Installment ${index + 1} due date`} type="date" value={installment.dueDate} onChange={(event) => setInstallments((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, dueDate: event.target.value } : item))} required />{installments.length > 1 && <button type="button" onClick={() => setInstallments((items) => items.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>}</div>)}</div><button type="button" className="text-link" onClick={() => setInstallments((items) => [...items, { amount: '', dueDate: `${currentYear + items.length}-10-15` }])} disabled={installments.length >= 12}>+ Add installment</button></fieldset>{error && <p className="admin-form-error">{error}</p>}{message && <p className="admin-form-success">{message}</p>}<div className="admin-form-actions"><button type="button" className="text-link" onClick={onCreated}>Search students</button><button className="primary-button" disabled={busy}>{busy ? 'Creating student...' : 'Create student'}</button></div></form></>;
}

function FormField({ name, label, ...props }: { name: string; label: string;[key: string]: string | boolean | undefined }) { return <label><span>{label}</span><input name={name} {...props} /></label>; }
function createRequestId() { const bytes = crypto.getRandomValues(new Uint8Array(16)); bytes[6] = (bytes[6]! & 0x0f) | 0x40; bytes[8] = (bytes[8]! & 0x3f) | 0x80; const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(''); return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`; }
async function downloadAdminReceipt(detail: StudentDetail, payment: OfflinePaymentResult) { const { jsPDF } = await import('jspdf'); const document = new jsPDF(); document.setFont('helvetica', 'bold'); document.setFontSize(20); document.text('NSR IMPULSE KNOWLEDGE PARK', 20, 24); document.setTextColor(211, 91, 70); document.setFontSize(11); document.text('OFFICIAL PAYMENT RECEIPT', 20, 34); document.setDrawColor(24, 62, 54); document.line(20, 40, 190, 40); document.setTextColor(30, 60, 54); document.setFont('helvetica', 'normal'); const rows: Array<[string, string]> = [['Receipt number', payment.receiptNumber], ['Transaction number', payment.transactionNumber], ['Payment date', formatDate(payment.paidAt)], ['Payment mode', payment.mode], ['Student ID', detail.student.studentUid], ['Student name', detail.student.name], ['Course', detail.organization.course], ['College', detail.organization.college], ['Branch', detail.organization.branch]]; let y = 54; for (const [label, value] of rows) { document.setFont('helvetica', 'bold'); document.text(label, 20, y); document.setFont('helvetica', 'normal'); document.text(value, 72, y); y += 10; } document.setFillColor(231, 239, 233); document.rect(20, y + 2, 170, 25, 'F'); document.setFont('helvetica', 'bold'); document.setFontSize(13); document.text('Amount paid', 27, y + 17); document.setFontSize(18); document.text(`INR ${payment.amount.toLocaleString('en-IN')}`, 135, y + 17); document.setFont('helvetica', 'normal'); document.setFontSize(10); document.setTextColor(100, 115, 108); document.text('Recorded by an authorized College Admin and stored in the central database.', 20, 272); document.save(`${payment.receiptNumber}.pdf`); }
async function adminFetch<T>(path: string, token: string, init: RequestInit = {}): Promise<T> { const response = await fetch(`${apiBase}/api/v1/admin${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers }, cache: 'no-store' }); const result = await response.json() as { success?: boolean; data?: T; error?: { message?: string } }; if (!response.ok || !result.success || !result.data) throw new Error(result.error?.message ?? 'Admin request failed'); return result.data; }
function formatDate(value: string) { return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value)); }
