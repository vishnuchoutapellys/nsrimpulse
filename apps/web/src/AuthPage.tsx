import { ArrowRight, Eye, EyeOff, Home, LockKeyhole, Mail, Phone, UserRound } from 'lucide-react';
import { FormEvent, useState } from 'react';

type AuthMode = 'login' | 'register';
type AuthPageProps = { mode: AuthMode; onModeChange: (mode: AuthMode) => void; onBack: () => void; onAdminLogin: () => void; onAuthenticated: (studentId: string, accessToken: string) => void };

type FormErrors = Record<string, string>;

const apiBase = import.meta.env.VITE_API_URL ?? `http://${window.location.hostname}:4000`;

export function AuthPage({ mode, onModeChange, onBack, onAdminLogin, onAuthenticated }: AuthPageProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  function validate(form: HTMLFormElement): FormErrors {
    const data = new FormData(form);
    const next: FormErrors = {};
    const email = String(data.get('email') ?? '').trim();
    const studentId = String(data.get('studentId') ?? '').trim();
    const password = String(data.get('password') ?? '');
    if (mode === 'login') {
      if (!studentId) next.studentId = 'Student ID is required.';
      else if (!/^NSRTS[A-Z]+-\d{3}$/.test(studentId)) next.studentId = 'Use the Student ID shared by your college.';
    } else if (!email) next.email = 'Email is required.';
    else if (!/^\S+@\S+\.\S+$/.test(email)) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Password is required.';
    else if (password.length < 8) next.password = 'Use at least 8 characters.';
    else if (!/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) next.password = 'Use an uppercase letter, number, and special character.';
    if (mode === 'register') {
      const name = String(data.get('name') ?? '').trim();
      const studentUid = String(data.get('studentUid') ?? '').trim();
      const mobile = String(data.get('mobile') ?? '').trim();
      const confirmPassword = String(data.get('confirmPassword') ?? '');
      if (name.length < 2) next.name = 'Enter your full name.';
      if (!/^NSRTS[A-Z]+-\d{3,6}$/.test(studentUid.toUpperCase())) next.studentUid = 'Use the Student ID shared by your college.';
      if (!/^[6-9]\d{9}$/.test(mobile)) next.mobile = 'Enter a valid 10-digit Indian mobile number.';
      if (confirmPassword !== password) next.confirmPassword = 'Passwords do not match.';
    }
    return next;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const next = validate(form);
    setErrors(next);
    setMessage('');
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const formData = Object.fromEntries(new FormData(form));
      const response = await fetch(`${apiBase}/api/v1/auth/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      const result = await response.json() as { success?: boolean; data?: { studentId?: string; accessToken?: string }; message?: string; error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message ?? 'Unable to complete the request.');
      if (mode === 'login' && result.data?.studentId && result.data.accessToken) onAuthenticated(result.data.studentId, result.data.accessToken);
      else { form.reset(); onModeChange('login'); setMessage(result.message ?? 'Account created. You can now sign in.'); }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to complete the request.');
    } finally { setBusy(false); }
  }

  return <main className="auth-shell"><div className="auth-brand"><div className="auth-brand-header"><div className="auth-brand-copy"><span className="brand-mark">N</span><span><strong>NSR</strong><small>IMPULSE KNOWLEDGE PARK</small></span></div><button className="auth-home-button" type="button" onClick={onBack} aria-label="Go to home" title="Home"><Home size={19} /></button></div>
    <div className="auth-quote"><p>"Education is the <em> Passport to the future.</em>"</p><span>Stay connected to your next chapter.</span></div></div><section className="auth-panel"><div className="auth-role-switch" role="group" aria-label="Choose account type"><button type="button" className="active" aria-pressed="true">Student</button><button type="button" aria-pressed="false" onClick={onAdminLogin}>College Admin</button></div><div className="auth-tabs"><button className={mode === 'login' ? 'active' : ''} onClick={() => { onModeChange('login'); setErrors({}); setMessage(''); }}>Sign in</button><button className={mode === 'register' ? 'active' : ''} onClick={() => { onModeChange('register'); setErrors({}); setMessage(''); }}>Create account</button></div>
      <h1>{mode === 'login' ? <>Your learning, <em>in motion.</em></> : <>Start your<br /><em>next chapter.</em></>}</h1><p className="auth-intro">{mode === 'login' ? 'Use the Student ID shared by your college to view fees, receipts, results and reminders.' : 'Enter the exact Student ID, name, mobile, and email stored by your college.'}</p><form onSubmit={submit} noValidate>{mode === 'register' && <><Field id="name" label="Full name" icon={<UserRound size={17} />} error={errors.name} /><Field id="studentUid" label="Student ID" placeholder="NSRTSHYD-002" icon={<LockKeyhole size={17} />} error={errors.studentUid} /><Field id="mobile" label="Registered mobile" placeholder="10-digit mobile number" icon={<Phone size={17} />} error={errors.mobile} /></>}{mode === 'login' ? <Field id="studentId" label="College-issued Student ID" placeholder="NSRTSHYD-001" icon={<LockKeyhole size={17} />} error={errors.studentId} /> : <Field id="email" label="Email address" type="email" icon={<Mail size={17} />} error={errors.email} />}<label className="field"><span>Password</span><div className="input-wrap"><LockKeyhole size={17} /><input name="password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>{errors.password && <small className="field-error">{errors.password}</small>}</label>{mode === 'register' && <Field id="confirmPassword" label="Confirm password" type="password" icon={<LockKeyhole size={17} />} error={errors.confirmPassword} />}<button className="primary-button auth-submit" disabled={busy}>{busy ? 'Please wait...' : mode === 'login' ? <>Sign in <ArrowRight size={17} /></> : <>Create student account <ArrowRight size={17} /></>}</button>{message && <p className={message.includes('Unable') || message.includes('valid') ? 'form-message error' : 'form-message'}>{message}</p>}</form>{mode === 'login' && <><p className="demo-hint">College demo ID: <strong>NSRTSHYD-001</strong></p><button className="forgot">Forgot password?</button></>}</section></main>;
}

function Field({ id, label, type = 'text', placeholder, icon, error }: { id: string; label: string; type?: string; placeholder?: string; icon: JSX.Element; error?: string }) { return <label className="field"><span>{label}</span><div className="input-wrap">{icon}<input name={id} id={id} type={type} placeholder={placeholder} autoComplete={id === 'email' ? 'email' : 'off'} /></div>{error && <small className="field-error">{error}</small>}</label>; }
