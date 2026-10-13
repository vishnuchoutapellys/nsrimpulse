import { ArrowLeft, ArrowRight, Eye, EyeOff, Home, LockKeyhole, Mail, Phone } from 'lucide-react';
import { FormEvent, useState } from 'react';
import nsrLogo from '../../assets/nsrLogo.png';
import { apiBase } from './api';

type AuthStep = 'login' | 'change-password' | 'forgot' | 'verify' | 'reset';
type ApiResult = { success?: boolean; data?: Record<string, unknown>; message?: string; error?: { message?: string } };
const studentIdPattern = /^NSR[A-Z]+-\d{3,6}$/;

export function StudentLoginPage({ onBack, onAdminLogin, onAuthenticated }: { onBack: () => void; onAdminLogin: () => void; onAuthenticated: (studentId: string, accessToken: string) => void }) {
  const [step, setStep] = useState<AuthStep>('login');
  const [studentId, setStudentId] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [changeToken, setChangeToken] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function moveTo(nextStep: AuthStep) { setStep(nextStep); setError(''); setMessage(''); setShowPassword(false); }

  async function request(path: string, body: Record<string, string>) {
    const response = await fetch(`${apiBase}/api/v1/auth/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json() as ApiResult;
    if (!response.ok || !result.success) throw new Error(result.error?.message ?? 'Unable to complete the request.');
    return result;
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('');
    const data = new FormData(event.currentTarget);
    const normalizedStudentId = String(data.get('studentId') ?? '').trim().toUpperCase();
    const password = String(data.get('password') ?? '');
    if (!studentIdPattern.test(normalizedStudentId)) return setError('Enter the Student ID issued by your college.');
    if (password.length < 6) return setError('Enter your password.');
    setBusy(true);
    try {
      const result = await request('login', { studentId: normalizedStudentId, password });
      const responseData = result.data ?? {};
      setStudentId(normalizedStudentId);
      if (responseData.requiresPasswordChange === true && typeof responseData.changeToken === 'string') {
        setTemporaryPassword(password);
        setChangeToken(responseData.changeToken);
        moveTo('change-password');
      } else if (typeof responseData.accessToken === 'string') {
        onAuthenticated(normalizedStudentId, responseData.accessToken);
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to sign in.'); }
    finally { setBusy(false); }
  }

  async function submitPasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const data = new FormData(event.currentTarget);
    const newPassword = String(data.get('newPassword') ?? '');
    const confirmPassword = String(data.get('confirmPassword') ?? '');
    const validation = validateNewPassword(newPassword, confirmPassword);
    if (validation) return setError(validation);
    setBusy(true);
    try {
      const result = await request('change-temporary-password', { changeToken, currentPassword: temporaryPassword, newPassword });
      const accessToken = result.data?.accessToken;
      if (typeof accessToken === 'string') onAuthenticated(studentId, accessToken);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to change password.'); }
    finally { setBusy(false); }
  }

  async function submitForgot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('');
    const normalizedStudentId = String(new FormData(event.currentTarget).get('studentId') ?? '').trim().toUpperCase();
    if (!studentIdPattern.test(normalizedStudentId)) return setError('Enter the Student ID issued by your college.');
    setBusy(true);
    try {
      const result = await request('forgot-password', { studentId: normalizedStudentId });
      const nextChallengeId = result.data?.challengeId;
      setStudentId(normalizedStudentId);
      setMessage(result.message ?? 'Verification codes sent.');
      if (typeof nextChallengeId === 'string') { setChallengeId(nextChallengeId); setStep('verify'); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to request password reset.'); }
    finally { setBusy(false); }
  }

  async function submitOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const result = await request('forgot-password/verify', { challengeId, emailOtp: String(data.get('emailOtp') ?? ''), mobileOtp: String(data.get('mobileOtp') ?? '') });
      const nextResetToken = result.data?.resetToken;
      if (typeof nextResetToken === 'string') { setResetToken(nextResetToken); moveTo('reset'); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to verify codes.'); }
    finally { setBusy(false); }
  }

  async function submitReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const data = new FormData(event.currentTarget);
    const newPassword = String(data.get('newPassword') ?? '');
    const confirmPassword = String(data.get('confirmPassword') ?? '');
    const validation = validateNewPassword(newPassword, confirmPassword);
    if (validation) return setError(validation);
    setBusy(true);
    try {
      const result = await request('forgot-password/reset', { resetToken, newPassword });
      moveTo('login');
      setMessage(result.message ?? 'Password reset successfully. Sign in with your new password.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to reset password.'); }
    finally { setBusy(false); }
  }

  const isLogin = step === 'login';
  return <main className="auth-shell"><div className="auth-brand"><div className="auth-brand-header"><div className="auth-brand-copy"><img className="brand-wordmark" src={nsrLogo} alt="NSR Impulse Educational Institutions" /></div><button className="auth-home-button" type="button" onClick={onBack} aria-label="Go to home" title="Home"><Home size={19} /></button></div><div className="auth-quote"><p>"Education is the <em>Passport to the future.</em>"</p><span>Stay connected to your next chapter.</span></div></div>
    <section className="auth-panel"><div className="auth-role-switch" role="group" aria-label="Choose account type"><button type="button" className="active" aria-pressed="true">Student</button><button type="button" aria-pressed="false" onClick={onAdminLogin}>College Admin</button></div>{!isLogin && <button className="auth-back-link" type="button" onClick={() => moveTo(step === 'forgot' ? 'login' : step === 'change-password' ? 'login' : 'forgot')}><ArrowLeft size={15} /> Back</button>}
      <h1>{step === 'login' ? <>Student <em>Sign In.</em></> : step === 'change-password' ? <>Secure your <em>account.</em></> : step === 'forgot' ? <>Forgot your <em>password?</em></> : step === 'verify' ? <>Verify both <em>codes.</em></> : <>Set a new <em>password.</em></>}</h1>
      <p className="auth-intro">{step === 'login' ? 'Use the Student ID and password issued by your college.' : step === 'change-password' ? 'Your temporary password must be changed before accessing the student portal.' : step === 'forgot' ? 'We will send separate verification codes to your registered email and mobile.' : step === 'verify' ? 'Enter the code from your email and the different code sent to your mobile.' : 'Choose a secure password for future sign-ins.'}</p>
      {step === 'login' && <form onSubmit={submitLogin}><AuthField name="studentId" label="College-issued Student ID" placeholder="NSRHYD-001" icon={<LockKeyhole size={17} />} defaultValue={studentId} /><PasswordField name="password" label="Password" show={showPassword} onToggle={() => setShowPassword(!showPassword)} autoComplete="current-password" /><button className="auth-forgot-link" type="button" onClick={() => moveTo('forgot')}>Forgot password?</button><SubmitButton busy={busy}>Sign in <ArrowRight size={17} /></SubmitButton></form>}
      {step === 'change-password' && <form onSubmit={submitPasswordChange}><PasswordField name="newPassword" label="New password" show={showPassword} onToggle={() => setShowPassword(!showPassword)} autoComplete="new-password" /><AuthField name="confirmPassword" label="Confirm new password" type="password" icon={<LockKeyhole size={17} />} /><SubmitButton busy={busy}>Change password <ArrowRight size={17} /></SubmitButton></form>}
      {step === 'forgot' && <form onSubmit={submitForgot}><AuthField name="studentId" label="College-issued Student ID" placeholder="NSRHYD-001" icon={<LockKeyhole size={17} />} defaultValue={studentId} /><SubmitButton busy={busy}>Send verification codes <ArrowRight size={17} /></SubmitButton></form>}
      {step === 'verify' && <form onSubmit={submitOtp}><AuthField name="emailOtp" label="Email OTP" placeholder="6-digit code" inputMode="numeric" maxLength={6} icon={<Mail size={17} />} /><AuthField name="mobileOtp" label="Mobile OTP" placeholder="6-digit code" inputMode="numeric" maxLength={6} icon={<Phone size={17} />} /><SubmitButton busy={busy}>Verify both codes <ArrowRight size={17} /></SubmitButton></form>}
      {step === 'reset' && <form onSubmit={submitReset}><PasswordField name="newPassword" label="New password" show={showPassword} onToggle={() => setShowPassword(!showPassword)} autoComplete="new-password" /><AuthField name="confirmPassword" label="Confirm new password" type="password" icon={<LockKeyhole size={17} />} /><SubmitButton busy={busy}>Reset password <ArrowRight size={17} /></SubmitButton></form>}
      {error && <p className="admin-form-error" role="alert">{error}</p>}{message && <p className="admin-form-success" role="status">{message}</p>}
    </section></main>;
}

function validateNewPassword(password: string, confirmation: string) {
  if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) return 'Use at least 8 characters with uppercase, lowercase, number, and special character.';
  if (password !== confirmation) return 'Passwords do not match.';
  return '';
}

function AuthField({ name, label, icon, type = 'text', ...props }: { name: string; label: string; icon: JSX.Element; type?: string; [key: string]: unknown }) { return <label className="field"><span>{label}</span><div className="input-wrap">{icon}<input name={name} type={type} required {...props} /></div></label>; }
function PasswordField({ name, label, show, onToggle, autoComplete }: { name: string; label: string; show: boolean; onToggle: () => void; autoComplete: string }) { return <label className="field"><span>{label}</span><div className="input-wrap"><LockKeyhole size={17} /><input name={name} type={show ? 'text' : 'password'} autoComplete={autoComplete} required /><button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={onToggle}>{show ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>; }
function SubmitButton({ busy, children }: { busy: boolean; children: React.ReactNode }) { return <button className="primary-button auth-submit" disabled={busy}>{busy ? 'Please wait...' : children}</button>; }