import { FormEvent, useEffect, useState } from 'react';
import { ArrowRight, Building2, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import nsrLogo from '../../assets/nsrLogo.png';
import { apiBase } from './api';

type CollegeOption = { id: string; name: string; branches: Array<{ id: string; name: string }> };
type SuperAdminContext = { colleges: CollegeOption[] };
type ApiResponse<T> = { success?: boolean; data?: T; message?: string; error?: { message?: string } };

async function superAdminRequest<T>(path: string, token?: string, body?: unknown): Promise<ApiResponse<T>> {
  const response = await fetch(`${apiBase}/api/v1/admin/super-admin/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const result = await response.json() as ApiResponse<T>;
  if (!response.ok || !result.success) throw new Error(result.error?.message ?? result.message ?? 'Unable to complete the request');
  return result;
}

export function SuperAdminPortal() {
  const [token, setToken] = useState('');
  const [context, setContext] = useState<SuperAdminContext | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [collegeId, setCollegeId] = useState('');
  const [scopeType, setScopeType] = useState<'COLLEGE' | 'BRANCH'>('COLLEGE');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    superAdminRequest<SuperAdminContext>('context', token)
      .then((result) => { if (!cancelled && result.data) setContext(result.data); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Unable to load organization data'); });
    return () => { cancelled = true; };
  }, [token]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = new FormData(event.currentTarget);
      const result = await superAdminRequest<{ accessToken: string }>('auth/login', undefined, {
        adminId: String(data.get('adminId') ?? ''),
        password: String(data.get('password') ?? '')
      });
      if (!result.data?.accessToken) throw new Error('The authentication service did not return a valid session.');
      setToken(result.data.accessToken);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign in');
    } finally {
      setBusy(false);
    }
  }

  async function provisionAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setBusy(true);
    setError('');
    setMessage('');
    const data = new FormData(event.currentTarget);
    try {
      const result = await superAdminRequest<{ adminId: string; email: string; college: string; scope: string }>('admins', token, {
        adminId: String(data.get('adminId') ?? ''),
        email: String(data.get('email') ?? ''),
        password: String(data.get('password') ?? ''),
        collegeId,
        scopeType,
        branchId: scopeType === 'BRANCH' ? String(data.get('branchId') ?? '') : undefined
      });
      if (!result.data) throw new Error('The server did not return the created administrator details.');
      setMessage(`Created ${result.data.adminId} for ${result.data.college} (${result.data.scope}). Share the initial password using a separate secure channel.`);
      event.currentTarget.reset();
      setScopeType('COLLEGE');
      setCollegeId('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create College Admin');
    } finally {
      setBusy(false);
    }
  }

  const selectedCollege = context?.colleges.find((college) => college.id === collegeId);

  return (
    <main className="super-admin-page">
      <section className="super-admin-card">
        <header className="super-admin-header">
          <img src={nsrLogo} alt="NSR Impulse Educational Institutions" />
          {token && <button type="button" className="super-admin-logout" onClick={() => { setToken(''); setContext(null); setMessage(''); setError(''); }}><LogOut size={16} /> Sign out</button>}
        </header>
        {!token ? (
          <form className="super-admin-form" onSubmit={signIn}>
            <div className="super-admin-heading">
              <span className="super-admin-icon"><ShieldCheck size={24} /></span>
              <p className="super-admin-eyebrow">Restricted access</p>
              <h1>Super Admin sign in</h1>
              <p>Use the Super Admin account provisioned by your system administrator.</p>
            </div>
            <label>Admin ID<input name="adminId" autoComplete="username" required /></label>
            <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
            {error && <p className="super-admin-error" role="alert">{error}</p>}
            <button className="super-admin-submit" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'} <ArrowRight size={17} /></button>
            <a className="super-admin-back" href="/admin">College Admin sign in</a>
          </form>
        ) : !context ? (
          <div className="super-admin-heading" role={error ? 'alert' : 'status'}>
            <p>{error || 'Loading authorized organization data...'}</p>
            {error && <button className="super-admin-submit" onClick={() => { setError(''); setToken(''); }}>Sign in again</button>}
          </div>
        ) : (
          <section className="super-admin-workspace">
            <div className="super-admin-heading">
              <span className="super-admin-icon"><ShieldCheck size={24} /></span>
              <p className="super-admin-eyebrow">Privileged administration</p>
              <h1>Provision a College Admin</h1>
              <p>Create an account with only the organization scope it needs. The initial password is never returned by the server.</p>
            </div>
            <form className="super-admin-form" onSubmit={provisionAdmin}>
              <div className="super-admin-form-grid">
                <label>College Admin ID<input name="adminId" placeholder="NSRADMIN-002" autoComplete="off" minLength={8} maxLength={40} required /></label>
                <label>Institutional email<input name="email" type="email" autoComplete="email" required /></label>
              </div>
              <label>Initial password<input name="password" type="password" autoComplete="new-password" minLength={12} required /><small>Use 12+ characters with uppercase, lowercase, a number, and a symbol. Share it with the administrator separately.</small></label>
              <label>Authorized college
                <select value={collegeId} onChange={(event) => setCollegeId(event.target.value)} required>
                  <option value="">Select a college</option>
                  {context.colleges.map((college) => <option key={college.id} value={college.id}>{college.name}</option>)}
                </select>
              </label>
              <fieldset>
                <legend>Access scope</legend>
                <label className="super-admin-radio"><input type="radio" name="scopeType" checked={scopeType === 'COLLEGE'} onChange={() => setScopeType('COLLEGE')} /> All branches in this college</label>
                <label className="super-admin-radio"><input type="radio" name="scopeType" checked={scopeType === 'BRANCH'} onChange={() => setScopeType('BRANCH')} /> One branch only</label>
              </fieldset>
              {scopeType === 'BRANCH' && (
                <label>Authorized branch
                  <select name="branchId" defaultValue="" required>
                    <option value="">Select a branch</option>
                    {selectedCollege?.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                  </select>
                </label>
              )}
              {error && <p className="super-admin-error" role="alert">{error}</p>}
              {message && <p className="super-admin-success" role="status">{message}</p>}
              <button className="super-admin-submit" disabled={busy || context.colleges.length === 0}>{busy ? 'Creating account...' : 'Create College Admin'} <UserRound size={17} /></button>
            </form>
            {context.colleges.length === 0 && <p className="super-admin-error" role="alert">No colleges are configured. Add the college and branches before provisioning an administrator.</p>}
            <p className="super-admin-security-note"><Building2 size={16} /> Every request is checked against the active Super Admin role and college scope on the server.</p>
          </section>
        )}
      </section>
    </main>
  );
}
