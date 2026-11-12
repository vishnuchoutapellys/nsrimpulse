import { ArrowLeft, ArrowRight, Eye, EyeOff, Home, LockKeyhole, Mail, Phone, Sparkles, UserRound as UserIcon, CalendarDays as Calendar1Icon } from 'lucide-react';
import { FormEvent, useState, useEffect } from 'react';
import nsrLogo from '../../assets/nsrLogo.png';
import { apiBase } from './api';

type AuthStep = 'login' | 'change-password' | 'forgot' | 'verify' | 'reset';
type AuthMode = 'signin' | 'register';
type RoleType = 'STUDENT' | 'COLLEGE_ADMIN';

type ApiResult = { success?: boolean; data?: Record<string, unknown>; message?: string; error?: { message?: string } };
type RegistrationBranch = { id: string; name: string };
type RegistrationCollege = { id: string; name: string; location: string; branches: RegistrationBranch[] };
type RegistrationCourse = { id: string; name: string; programType?: string };
const studentIdPattern = /^(?:demo-account-\d+|NSR[A-Z]+-\d{3,6}|NSR-[A-Z]{2}-[A-Z]+-\d{4}-\d{6})$/i;


export function StudentLoginPage({ onBack, onAdminLogin, onAuthenticated }: { onBack: () => void; onAdminLogin: () => void; onAuthenticated: (studentId: string, accessToken: string) => void }) {
  const [collegesData, setCollegesData] = useState<RegistrationCollege[]>([]);
  const [coursesData, setCoursesData] = useState<RegistrationCourse[]>([]);
  const [metadataLoading, setMetadataLoading] = useState(true);
  const [metadataError, setMetadataError] = useState('');
  const [selectedCollegeId, setSelectedCollegeId] = useState('');
  const [mode, setMode] = useState<AuthMode>('signin');
  const [step, setStep] = useState<AuthStep>('login');
  const [studentId, setStudentId] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [changeToken, setChangeToken] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [recoveryChannels, setRecoveryChannels] = useState({ email: false, mobile: false });
  const [resetToken, setResetToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Registration specific state
  const [regRole, setRegRole] = useState<RoleType>('STUDENT');
  useEffect(() => {
    const controller = new AbortController();
    async function loadMetadata() {
      try {
        const response = await fetch(`${apiBase}/api/v1/public/metadata`, { signal: controller.signal });
        const result = await response.json() as {
          success?: boolean;
          data?: { colleges?: unknown[]; courses?: unknown[] };
          error?: { message?: string };
          message?: string;
        };
        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.error?.message ?? result.message ?? `Unable to load registration options (HTTP ${response.status}).`);
        }

        const colleges = (result.data.colleges ?? []).flatMap((value): RegistrationCollege[] => {
          if (!value || typeof value !== 'object') return [];
          const college = value as Record<string, unknown>;
          if (typeof college.id !== 'string' || typeof college.name !== 'string') return [];
          const location = typeof college.location === 'string'
            ? college.location
            : college.location && typeof college.location === 'object' && 'name' in college.location
              ? String((college.location as { name: unknown }).name ?? '')
              : '';
          const branches = Array.isArray(college.branches)
            ? college.branches.flatMap((branchValue): RegistrationBranch[] => {
                if (!branchValue || typeof branchValue !== 'object') return [];
                const branch = branchValue as Record<string, unknown>;
                return typeof branch.id === 'string' && typeof branch.name === 'string'
                  ? [{ id: branch.id, name: branch.name }]
                  : [];
              })
            : [];
          return [{ id: college.id, name: college.name, location, branches }];
        });
        const courses = (result.data.courses ?? []).flatMap((value): RegistrationCourse[] => {
          if (!value || typeof value !== 'object') return [];
          const course = value as Record<string, unknown>;
          return typeof course.id === 'string' && typeof course.name === 'string'
            ? [{ id: course.id, name: course.name, programType: typeof course.programType === 'string' ? course.programType : undefined }]
            : [];
        });
        setCollegesData(colleges);
        setCoursesData(courses);
        setMetadataError(colleges.length && courses.length ? '' : 'Registration options are currently unavailable. Please try again later.');
      } catch (reason) {
        if (reason instanceof Error && reason.name === 'AbortError') return;
        const message = reason instanceof Error ? reason.message : 'Unable to load registration options.';
        setMetadataError(message);
        console.error('Failed to load registration metadata:', reason);
      } finally {
        if (!controller.signal.aborted) setMetadataLoading(false);
      }
    }
    void loadMetadata();
    return () => controller.abort();
  }, []);
  // Filter branches based on selected college
  const selectedCollege = collegesData.find((c) => c.id === selectedCollegeId);
  const availableBranches = selectedCollege ? selectedCollege.branches : [];

  function moveTo(nextStep: AuthStep) { setStep(nextStep); setError(''); setMessage(''); setShowPassword(false); }
  function switchMode(newMode: AuthMode) { setMode(newMode); setError(''); setMessage(''); setStep('login'); }

  async function request(path: string, body: Record<string, string>) {
    const response = await fetch(`${apiBase}/api/v1/auth/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      throw new Error(`Authentication service returned ${response.status}. Check the API deployment configuration.`);
    }
    const result = await response.json() as ApiResult;
    if (!response.ok || !result.success) throw new Error(result.error?.message ?? result.message ?? 'Unable to complete the request.');
    return result;
  }
  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('');
    const data = new FormData(event.currentTarget);
    const rawInput = String(data.get('studentId') ?? '').trim();
    const normalizedStudentId = rawInput.toLowerCase().startsWith('demo-')
      ? rawInput.toLowerCase()
      : rawInput.toUpperCase();
    const password = String(data.get('password') ?? '');

    if (!studentIdPattern.test(normalizedStudentId)) return setError('Enter the Student ID issued by your college (e.g., NSRHYD-001 or demo-account-001).');
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
      }
      else if (typeof responseData.accessToken === 'string') {
        // 1. Save directly to browser Local Storage first
        localStorage.setItem('studentUid', normalizedStudentId);
        localStorage.setItem('accessToken', responseData.accessToken);

        // 2. Then invoke authentication callback
        onAuthenticated(normalizedStudentId, responseData.accessToken);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }
  async function submitRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');

    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const password = String(data.get('password') ?? '');

    const validation = validateNewPassword(password, password); // check basic strength
    if (validation) return setError(validation);

    setBusy(true);
    try {
      let bodyData: Record<string, string> = { role: regRole, name, password };

      if (regRole === 'STUDENT') {
        // NOTE: studentUid extraction removed because backend auto-generates it!
        bodyData.collegeId = String(data.get('collegeId') ?? '').trim();
        bodyData.branchId = String(data.get('branchId') ?? '').trim();
        bodyData.courseId = String(data.get('courseId') ?? '').trim();

        bodyData.mobile = String(data.get('mobile') ?? '').trim();
        bodyData.email = String(data.get('email') ?? '').trim();
        bodyData.fatherName = String(data.get('fatherName') ?? '').trim();
        bodyData.motherName = String(data.get('motherName') ?? '').trim();
        bodyData.dateOfBirth = String(data.get('dateOfBirth') ?? '');
        bodyData.village = String(data.get('village') ?? '').trim();
        bodyData.pin = String(data.get('pin') ?? '').trim();
      }
      else {
        bodyData.email = String(data.get('email') ?? '').trim();
        bodyData.adminSecretKey = String(data.get('adminSecretKey') ?? '');
      }

      const result = await request('register', bodyData);

      // Display auto-generated studentUid in success message if provided
      const successMsg = result.data?.studentUid
        ? `Registration successful! Your Student ID is ${result.data.studentUid}. You can now sign in.`
        : (result.message ?? 'Registration successful! You can now sign in.');

      setMessage(successMsg);
      setMode('signin');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to register account.');
    } finally {
      setBusy(false);
    }
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
    const rawForgotInput = String(new FormData(event.currentTarget).get('studentId') ?? '').trim();
    const normalizedStudentId = rawForgotInput.toLowerCase().startsWith('demo-')
      ? rawForgotInput.toLowerCase()
      : rawForgotInput.toUpperCase();
    if (!studentIdPattern.test(normalizedStudentId)) return setError('Enter the Student ID issued by your college.');
    setBusy(true);
    try {
      const result = await request('forgot-password', { studentId: normalizedStudentId });
      const nextChallengeId = result.data?.challengeId;
      setStudentId(normalizedStudentId);
      if (typeof nextChallengeId === 'string' && nextChallengeId.length > 0) {
        const channels = result.data?.channels;
        const availableChannels = isRecoveryChannels(channels)
          ? channels
          : { email: true, mobile: true };
        if (!availableChannels.email && !availableChannels.mobile) {
          setError('We could not deliver a verification code. Please contact your College Admin and try again later.');
          return;
        }
        setChallengeId(nextChallengeId);
        setRecoveryChannels(availableChannels);
        setStep('verify');
        setMessage(availableChannels.email && availableChannels.mobile
          ? 'The same verification code was sent to your registered email and mobile. Enter it below to continue.'
          : availableChannels.email
            ? 'A verification code was sent to your registered email. Enter it below to continue.'
            : 'A verification code was sent to your registered mobile. Enter it below to continue.');
      } else {
        setError('We could not send a verification code to your registered email or mobile. Please contact your College Admin to check your contact details and try again later.');
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to request password reset.'); }
    finally { setBusy(false); }
  }
  async function submitOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    const data = new FormData(event.currentTarget);
    const otp = String(data.get('otp') ?? '').trim();
    setBusy(true);
    try {
      const result = await request('forgot-password/verify', { challengeId, otp });
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
  const isLogin = mode === 'signin' && step === 'login';

  return (
    <div className="auth-page min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-3 sm:p-6 lg:p-8 font-sans selection:bg-amber-500 selection:text-slate-950 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <main className="auth-card w-full max-w-5xl bg-slate-900/80 backdrop-blur-2xl border border-slate-800 rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 relative z-10">

        {/* Left Branding Sidebar */}
        <div className="auth-branding lg:col-span-5 bg-gradient-to-br from-slate-900 via-indigo-950/60 to-slate-950 p-8 lg:p-12 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800 relative">
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <div className="app-logo-frame bg-white/95 p-3 rounded-2xl shadow-lg inline-block">
                <img className="app-logo" src={nsrLogo} alt="NSR Impulse Educational Institutions" />
              </div>
              <button
                className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-amber-400 transition-colors border border-slate-700/80"
                type="button"
                onClick={onBack}
                aria-label="Go to home"
                title="Home"
              >
                <Home size={18} />
              </button>
            </div>

            <div className="space-y-3 pt-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold">
                <Sparkles size={13} /> {mode === 'signin' ? 'Student Portal' : 'Account Registration'}
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                {mode === 'signin' ? (
                  <>Welcome back to your <span className="text-amber-400 italic font-normal">learning hub.</span></>
                ) : (
                  <>Begin your journey with <span className="text-amber-400 italic font-normal">NSR Impulse.</span></>
                )}
              </h2>
            </div>
          </div>

          <div className="auth-quote mt-12 space-y-2 border-t border-slate-800/80 pt-6">
            <p className="text-slate-300 italic text-base">“Education is the <span className="text-amber-400 font-semibold italic">passport to the future.</span>”</p>
            <span className="text-xs text-slate-400 block font-medium">Stay connected to your next chapter.</span>
          </div>
        </div>

        {/* Right Authentication Panel */}
        <section className="auth-form-panel lg:col-span-7 p-8 lg:p-12 space-y-6 flex flex-col justify-center">

          {/* Top Switcher: Sign In vs Register & Role Switcher */}
          <div className="auth-switchers flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            {/* Mode Switcher (Sign In / Register) */}
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-950 border border-slate-800/80">
              <button
                type="button"
                onClick={() => switchMode('signin')}
                className={`py-1.5 px-4 rounded-xl text-xs font-bold transition-all ${mode === 'signin' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => switchMode('register')}
                className={`py-1.5 px-4 rounded-xl text-xs font-bold transition-all ${mode === 'register' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                Register
              </button>
            </div>

            {/* Role Switcher (Student / College Admin) */}
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-950 border border-slate-800/80">
              <button
                type="button"
                className={`py-1.5 px-3 rounded-xl text-xs font-semibold transition-all ${(mode === 'signin' || regRole === 'STUDENT') ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-white'}`}
                onClick={() => {
                  if (mode === 'signin') {
                    // Stay on student signin
                  } else {
                    setRegRole('STUDENT');
                  }
                }}
              >
                Student
              </button>
              <button
                type="button"
                className={`py-1.5 px-3 rounded-xl text-xs font-semibold transition-all ${mode === 'signin' ? 'text-slate-400 hover:text-white' : (regRole === 'COLLEGE_ADMIN' ? 'text-amber-400 font-bold' : 'text-slate-400 hover:text-white')}`}
                onClick={() => {
                  if (mode === 'signin') {
                    onAdminLogin();
                  } else {
                    setError('College Admin accounts are provisioned by a Super Admin.');
                  }
                }}
                disabled={mode === 'register'}
                title={mode === 'register' ? 'College Admin accounts are provisioned by a Super Admin' : undefined}
              >
                College Admin
              </button>
            </div>
          </div>

          {/* Back button for sub-steps */}
          {(!isLogin && mode === 'signin') && (
            <button
              className="inline-flex items-center gap-2 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors"
              type="button"
              onClick={() => moveTo(step === 'forgot' ? 'login' : step === 'change-password' ? 'login' : 'forgot')}
            >
              <ArrowLeft size={15} /> Back
            </button>
          )}

          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {mode === 'register' ? (
                <>Create <span className="text-amber-400 italic font-normal">Account.</span></>
              ) : (
                step === 'login' ? <>Student <span className="text-amber-400 italic font-normal">Sign In.</span></> :
                  step === 'change-password' ? <>Secure your <span className="text-amber-400 italic font-normal">account.</span></> :
                    step === 'forgot' ? <>Forgot your <span className="text-amber-400 italic font-normal">password?</span></> :
                      step === 'verify' ? <>Verify your <span className="text-amber-400 italic font-normal">code.</span></> :
                        <>Set a new <span className="text-amber-400 italic font-normal">password.</span></>
              )}
            </h1>
            <p className="text-sm text-slate-400 leading-relaxed">
              {mode === 'register' ? (
                regRole === 'STUDENT' ? 'Register using your college-issued student ID and mobile number.' : 'Register as a College Admin using your institutional email and secret key.'
              ) : (
                step === 'login' ? 'Use the Student ID and password issued by your college.' :
                  step === 'change-password' ? 'Your temporary password must be changed before accessing the student portal.' :
                    step === 'forgot' ? 'We will send a verification code to your registered email and mobile.' :
                      step === 'verify'
                        ? recoveryChannels.email && recoveryChannels.mobile
                        ? 'Enter the same 6-digit code sent to your registered email and mobile.'
                          : recoveryChannels.email
                          ? 'Enter the 6-digit code sent to your registered email.'
                          : 'Enter the 6-digit code sent to your registered mobile.'
                        :
                        'Choose a secure password for future sign-ins.'
              )}
            </p>
          </div>

          {/* Forms */}
          {mode === 'register' && (
            <form onSubmit={submitRegister} className="space-y-4">
              <AuthField name="name" label="Full Name" placeholder="Narayan Vyas" icon={<UserIcon size={17} />} />

              {regRole === 'STUDENT' ? (
                <>
                  {/* 1. COLLEGE SELECT */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Select College</label>
                    <select
                      name="collegeId"
                      required
                      value={selectedCollegeId}
                      onChange={(e) => setSelectedCollegeId(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm bg-white"
                    >
                      <option value="">-- Choose College --</option>
                      {collegesData.map((college) => (
                        <option key={college.id} value={college.id}>
                          {college.name}{college.location ? ` (${college.location})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2. BRANCH SELECT */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Select Branch</label>
                    <select
                      name="branchId"
                      required
                      className="w-full px-3 py-2 border rounded-md text-sm bg-white"
                    >
                      <option value="">-- Choose Branch --</option>
                      {collegesData
                        .find((c) => c.id === selectedCollegeId)
                        ?.branches.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* 3. COURSE SELECT */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Select Course Program</label>
                    <select
                      name="courseId"
                      required
                      className="w-full px-3 py-2 border rounded-md text-sm bg-white"
                    >
                      <option value="">-- Choose Course --</option>
                      {coursesData.map((course) => (
                        <option key={course.id} value={course.id}>
                          {course.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <AuthField name="mobile" label="Mobile Number" placeholder="9876543210" inputMode="tel" icon={<Phone size={17} />} />
                  <AuthField name="email" label="Email Address" type="email" placeholder="student@nsrimpulse.com" icon={<Mail size={17} />} />
                  <AuthField name="fatherName" label="Father's Name" placeholder="Shankar Lal Vyas" icon={<UserIcon size={17} />} />
                  <AuthField name="motherName" label="Mother's Name" placeholder="Mother Name" icon={<UserIcon size={17} />} />
                  <AuthField name="dateOfBirth" label="Date of Birth" type="date" icon={<Calendar1Icon size={17} />} />
                  <AuthField name="village" label="Village / City" placeholder="Hyderabad" icon={<Home size={17} />} />
                  <AuthField name="pin" label="PIN Code" placeholder="500001" inputMode="numeric" maxLength={6} icon={<LockKeyhole size={17} />} />
                </>
              ) : (
                <>
                  <AuthField name="email" label="Institutional Email" type="email" placeholder="admin@nsrimpulse.com" icon={<Mail size={17} />} />
                  <AuthField name="adminSecretKey" label="Admin Registration Secret Key" type="password" placeholder="Enter secret setup key" icon={<LockKeyhole size={17} />} />
                </>
              )}

              <PasswordField name="password" label="Password" show={showPassword} onToggle={() => setShowPassword(!showPassword)} autoComplete="new-password" />
              {regRole === 'STUDENT' && metadataError && (
                <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-xs font-medium text-red-300" role="alert">
                  {metadataError}
                </p>
              )}
              <SubmitButton busy={busy || (regRole === 'STUDENT' && (metadataLoading || !!metadataError))}>Register Account <ArrowRight size={17} /></SubmitButton>
            </form>
          )}

          {mode === 'signin' && step === 'login' && (
            <form onSubmit={submitLogin} className="space-y-5">
              <AuthField name="studentId" label="College-issued Student ID" placeholder="NSRHYD-001" icon={<LockKeyhole size={17} />} defaultValue={studentId} />
              <PasswordField name="password" label="Password" show={showPassword} onToggle={() => setShowPassword(!showPassword)} autoComplete="current-password" />
              <div className="flex justify-end">
                <button className="text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors" type="button" onClick={() => moveTo('forgot')}>
                  Forgot password?
                </button>
              </div>
              <SubmitButton busy={busy}>Sign in <ArrowRight size={17} /></SubmitButton>
            </form>
          )}

          {mode === 'signin' && step === 'change-password' && (
            <form onSubmit={submitPasswordChange} className="space-y-5">
              <PasswordField name="newPassword" label="New password" show={showPassword} onToggle={() => setShowPassword(!showPassword)} autoComplete="new-password" />
              <AuthField name="confirmPassword" label="Confirm new password" type="password" icon={<LockKeyhole size={17} />} />
              <SubmitButton busy={busy}>Change password <ArrowRight size={17} /></SubmitButton>
            </form>
          )}

          {mode === 'signin' && step === 'forgot' && (
            <form onSubmit={submitForgot} className="space-y-5">
              <AuthField name="studentId" label="College-issued Student ID" placeholder="NSRHYD-001" icon={<LockKeyhole size={17} />} defaultValue={studentId} />
              <SubmitButton busy={busy}>Send verification codes <ArrowRight size={17} /></SubmitButton>
            </form>
          )}

          {mode === 'signin' && step === 'verify' && (
            <form onSubmit={submitOtp} className="space-y-5">
              <AuthField name="otp" label="Enter OTP" placeholder="Enter your 6-digit code" inputMode="numeric" maxLength={6} icon={<LockKeyhole size={17} />} />
              <SubmitButton busy={busy}>Verify code and continue <ArrowRight size={17} /></SubmitButton>
            </form>
          )}

          {mode === 'signin' && step === 'reset' && (
            <form onSubmit={submitReset} className="space-y-5">
              <PasswordField name="newPassword" label="New password" show={showPassword} onToggle={() => setShowPassword(!showPassword)} autoComplete="new-password" />
              <AuthField name="confirmPassword" label="Confirm new password" type="password" icon={<LockKeyhole size={17} />} />
              <SubmitButton busy={busy}>Reset password <ArrowRight size={17} /></SubmitButton>
            </form>
          )}

          {/* Error & Success Notifications */}
          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium" role="alert">
              {error}
            </div>
          )}
          {message && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium" role="status">
              {message}
            </div>
          )}

        </section>
      </main >
    </div >
  );
}

function validateNewPassword(password: string, confirmation: string) {
  if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return 'Use at least 8 characters with uppercase, lowercase, number, and special character.';
  }
  if (password !== confirmation) return 'Passwords do not match.';
  return '';
}

function isRecoveryChannels(value: unknown): value is { email: boolean; mobile: boolean } {
  return value !== null
    && typeof value === 'object'
    && 'email' in value
    && typeof value.email === 'boolean'
    && 'mobile' in value
    && typeof value.mobile === 'boolean';
}

function AuthField({ name, label, icon, type = 'text', ...props }: { name: string; label: string; icon: JSX.Element; type?: string;[key: string]: unknown }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">{label}</span>
      <div className="relative flex items-center">
        <span className="absolute left-4 text-slate-500">{icon}</span>
        <input
          name={name}
          type={type}
          required
          className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors text-sm"
          {...props}
        />
      </div>
    </label>
  );
}

function PasswordField({ name, label, show, onToggle, autoComplete }: { name: string; label: string; show: boolean; onToggle: () => void; autoComplete: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">{label}</span>
      <div className="relative flex items-center">
        <span className="absolute left-4 text-slate-500"><LockKeyhole size={17} /></span>
        <input
          name={name}
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          required
          className="w-full pl-11 pr-11 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors text-sm"
        />
        <button
          type="button"
          aria-label={show ? 'Hide password' : 'Show password'}
          onClick={onToggle}
          className="absolute right-4 text-slate-500 hover:text-slate-300 transition-colors"
        >
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </label>
  );
}

function SubmitButton({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <button
      className="w-full py-3.5 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 mt-2"
      disabled={busy}
    >
      {children}
    </button>
  );
}