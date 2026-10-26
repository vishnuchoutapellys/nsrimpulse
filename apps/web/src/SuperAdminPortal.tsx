import {
  ArrowUpRight,
  BookOpen,
  Building2,
  Download,
  Eye,
  EyeOff,
  FileText,
  Home,
  LockKeyhole,
  LogOut,
  ShieldCheck as SearchIcon,
  ShieldCheck,
  ShieldCheck as Trash2,
  UserRound as UserPlus,
  UserRound,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import nsrLogo from "../../assets/nsrLogo.png";
import { apiBase } from "./api";

type SuperAdminView = "dashboard" | "admins" | "search" | "reports";

type SuperAdminContext = {
  superAdmin: { id: string; email: string; adminId: string };
  colleges: Array<{ id: string; name: string; branches: Array<{ id: string; name: string }> }>;
  courses: Array<{ id: string; name: string }>;
  admins: Array<{
    id: string;
    adminId: string;
    email: string;
    isActive: boolean;
    scopes: Array<{
      college: { id: string; name: string };
      branch: { id: string; name: string } | null;
    }>;
  }>;
};

export function SuperAdminPortal({
  onBack = () => { },
  onStudentLogin = () => { },
}: {
  onBack?: () => void;
  onStudentLogin?: () => void;
}) {
  const [token, setToken] = useState("");
  return token ? (
    <SuperAdminWorkspace token={token} onLogout={() => setToken("")} onBack={onBack} />
  ) : (
    <SuperAdminLogin onAuthenticated={setToken} onBack={onBack} onStudentLogin={onStudentLogin} />
  );
}

function SuperAdminLogin({
  onAuthenticated,
  onBack,
}: {
  onAuthenticated: (token: string) => void;
  onBack: () => void;
  onStudentLogin: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true);
    try {
      const response = await fetch(`${apiBase}/api/v1/super-admin/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(result.error?.message ?? result.message ?? "Unable to sign in");
      onAuthenticated(result.data.token);
    } catch (reason: any) {
      setError(reason.message || "Unable to sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-800 flex items-center justify-center p-4 font-sans selection:bg-amber-500 selection:text-white">
      <main className="w-full max-w-4xl bg-white border border-slate-200/80 rounded-3xl shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-12">
        <section className="md:col-span-5 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-slate-50 p-8 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-200/80">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <img className="h-10 w-auto object-contain" src={nsrLogo} alt="NSR Impulse" />
              <button
                onClick={onBack}
                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-amber-600 transition"
              >
                <Home size={18} />
              </button>
            </div>
            <div className="space-y-2 pt-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-700 text-xs font-semibold">
                <ShieldCheck size={13} /> Master Governance
              </span>
              <h2 className="text-2xl font-bold text-slate-900 leading-tight">
                Super Admin <span className="text-amber-600 italic font-serif">Control.</span>
              </h2>
            </div>
          </div>
          <p className="text-xs text-slate-500 italic mt-8 border-t border-slate-200/60 pt-4">
            Manage campuses, credentials, and institutional audits across NSR Impulse.
          </p>
        </section>

        <section className="md:col-span-7 p-8 space-y-6 flex flex-col justify-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Sign in</h1>
            <p className="text-xs text-slate-500 mt-1">Authorized master credentials required.</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Super Admin ID or Email</label>
              <div className="relative flex items-center">
                <UserRound size={17} className="absolute left-3.5 text-slate-400" />
                <input
                  name="adminId"
                  placeholder="superadmin@nsrimpulse.com"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:bg-white focus:border-amber-500 focus:outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Password</label>
              <div className="relative flex items-center">
                <LockKeyhole size={17} className="absolute left-3.5 text-slate-400" />
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:bg-white focus:border-amber-500 focus:outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {error && <p className="text-xs font-medium text-red-600 bg-red-50 p-3 rounded-xl border border-red-200">{error}</p>}

            <button
              disabled={busy}
              className="w-full py-3.5 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600 transition shadow-md shadow-amber-500/20 disabled:opacity-50 text-sm"
            >
              {busy ? "Authenticating..." : "Sign in as Super Admin"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

function SuperAdminWorkspace({
  token,
  onLogout,
  onBack,
}: {
  token: string;
  onLogout: () => void;
  onBack: () => void;
}) {
  const [context, setContext] = useState<SuperAdminContext | null>(null);
  const [view, setView] = useState<SuperAdminView>("dashboard");

  const loadContext = async () => {
    try {
      const res = await fetch(`${apiBase}/api/v1/super-admin/context`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) setContext(json.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadContext();
  }, [token]);

  if (!context)
    return (
      <main className="min-h-screen bg-[#F8F9FA] flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-500 font-medium">Loading workspace...</p>
      </main>
    );

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-800 flex flex-col font-sans">
      <header className="portal-app-header h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-50">
        <button onClick={onBack} className="portal-app-brand flex items-center gap-2">
          <img className="portal-app-logo" src={nsrLogo} alt="NSR Impulse Educational Institutions" />
        </button>
        <div className="portal-app-actions flex items-center gap-3">
          <span className="portal-app-id text-xs font-mono px-3 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 font-semibold">
            {context.superAdmin?.adminId || context.superAdmin?.email}
          </span>
          <button
            onClick={onLogout}
            className="portal-app-logout flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition text-xs font-bold"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12">
        <aside className="lg:col-span-3 bg-white border-r border-slate-200 p-6 space-y-6">
          <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Role</span>
            <strong className="text-slate-900 text-sm font-bold">Super Administrator</strong>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => setView("dashboard")}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition ${view === "dashboard" ? "bg-amber-500 text-white shadow-md shadow-amber-500/20" : "text-slate-600 hover:bg-slate-50"
                }`}
            >
              <BookOpen size={16} /> Overview
            </button>
            <button
              onClick={() => setView("admins")}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition ${view === "admins" ? "bg-amber-500 text-white shadow-md shadow-amber-500/20" : "text-slate-600 hover:bg-slate-50"
                }`}
            >
              <UserPlus size={16} /> Manage College Admins
            </button>
            <button
              onClick={() => setView("search")}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition ${view === "search" ? "bg-amber-500 text-white shadow-md shadow-amber-500/20" : "text-slate-600 hover:bg-slate-50"
                }`}
            >
              <SearchIcon size={16} /> Global Student Search
            </button>
            <button
              onClick={() => setView("reports")}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition ${view === "reports" ? "bg-amber-500 text-white shadow-md shadow-amber-500/20" : "text-slate-600 hover:bg-slate-50"
                }`}
            >
              <FileText size={16} /> System Fee Reports
            </button>
          </nav>
        </aside>

        <main className="lg:col-span-9 p-8 bg-[#F8F9FA] space-y-6">
          {view === "dashboard" && <SuperAdminOverview context={context} onNavigate={setView} />}
          {view === "admins" && <ManageAdmins token={token} context={context} onRefresh={loadContext} />}
          {view === "search" && <GlobalStudentSearch token={token} context={context} />}
          {view === "reports" && <SystemFeeReports token={token} />}
        </main>
      </div>
    </div>
  );
}


function ManageAdmins({ token, context, onRefresh }: { token: string; context: SuperAdminContext; onRefresh: () => Promise<void> }) {
  const [adminId, setAdminId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedCollegeId, setSelectedCollegeId] = useState(context.colleges[0]?.id || "");
  const [busy, setBusy] = useState(false);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`${apiBase}/api/v1/super-admin/admins`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ adminId, email, password, collegeId: selectedCollegeId, scopeType: "COLLEGE" }),
      });
      if (res.ok) {
        setAdminId(""); setEmail(""); setPassword("");
        await onRefresh();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4">
        <h3 className="text-lg font-bold text-slate-900">Provision College Admin</h3>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:bg-white" placeholder="Admin ID" value={adminId} onChange={e => setAdminId(e.target.value)} required />
            <input className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:bg-white" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:bg-white" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
          <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:bg-white" value={selectedCollegeId} onChange={e => setSelectedCollegeId(e.target.value)}>
            {context.colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button disabled={busy} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl text-xs transition shadow-md shadow-amber-500/20">
            {busy ? "Creating..." : "Create Account"}
          </button>
        </form>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 uppercase font-bold">
            <tr><th className="px-4 py-3">Admin ID & Email</th><th className="px-4 py-3">College</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {context.admins?.map(a => (
              <tr key={a.id}>
                <td className="px-4 py-3"><strong className="text-slate-900">{a.adminId}</strong><div className="text-[10px] text-slate-400">{a.email}</div></td>
                <td className="px-4 py-3">{a.scopes?.[0]?.college?.name || "All Colleges"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function SuperAdminOverview({ context, onNavigate }: { context: SuperAdminContext; onNavigate: (v: SuperAdminView) => void }) {
  const [branchStats, setBranchStats] = useState<Array<{ branchId: string; branchName: string; collegeName: string; studentCount: number }>>([]);

  useEffect(() => {
    fetch(`${apiBase}/api/v1/admin/super-admin/branches/student-counts`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("superAdminToken") || ""}` }
    })
      .then(res => res.json())
      .then(json => {
        if (json.success) setBranchStats(json.data);
      })
      .catch(err => console.error("Failed to load branch stats", err));
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-3xl p-6">
        <h2 className="text-xl font-bold text-slate-900">System Command & Analytics</h2>
        <p className="text-xs text-slate-500 mt-0.5">Global oversight and branch enrollment distribution across all colleges.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Total Colleges</span>
          <strong className="text-2xl font-bold text-slate-900 block">{context.colleges?.length || 0}</strong>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Active Admins</span>
          <strong className="text-2xl font-bold text-emerald-600 block">{context.admins?.length || 0}</strong>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Configured Courses</span>
          <strong className="text-2xl font-bold text-amber-600 block">{context.courses?.length || 0}</strong>
        </div>
      </div>

      {/* Branch Enrollment Distribution Table */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4">
        <h3 className="text-lg font-bold text-slate-900">Branch-wise Student Distribution</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 uppercase font-bold text-slate-400">
              <tr>
                <th className="px-4 py-3">Campus Branch</th>
                <th className="px-4 py-3">Parent College</th>
                <th className="px-4 py-3 text-right">Enrolled Students</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {branchStats.map(b => (
                <tr key={b.branchId} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3 font-bold text-slate-900">{b.branchName}</td>
                  <td className="px-4 py-3 text-slate-500">{b.collegeName}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="px-2.5 py-1 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      {b.studentCount} Students
                    </span>
                  </td>
                </tr>
              ))}
              {branchStats.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-400">No branch data available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function GlobalStudentSearch({ token, context }: { token: string; context: SuperAdminContext }) {
  const [query, setQuery] = useState("");
  const [selectedCollege, setSelectedCollege] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [sessionYear, setSessionYear] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const activeCollege = context.colleges.find(c => c.id === selectedCollege);

  const search = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const params = new URLSearchParams();
      if (query) params.append("query", query);
      if (selectedCollege) params.append("collegeId", selectedCollege);
      if (selectedBranch) params.append("branchId", selectedBranch);
      if (sessionYear) params.append("session", sessionYear);

      const res = await fetch(`${apiBase}/api/v1/super-admin/students/search?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) setResults(json.data);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4">
        <h3 className="text-lg font-bold text-slate-900">Global Student Directory & Branch Filter</h3>
        <form onSubmit={search} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:bg-white focus:outline-none"
              placeholder="ID, Name, or Keywords"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            <select
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:bg-white focus:outline-none"
              value={selectedCollege}
              onChange={e => { setSelectedCollege(e.target.value); setSelectedBranch(""); }}
            >
              <option value="">All Colleges</option>
              {context.colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:bg-white focus:outline-none"
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              disabled={!selectedCollege}
            >
              <option value="">All Branches</option>
              {activeCollege?.branches?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <input
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:bg-white focus:outline-none"
              placeholder="Session (e.g. 2026-2027)"
              value={sessionYear}
              onChange={e => setSessionYear(e.target.value)}
            />
          </div>
          <button disabled={busy} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl text-xs transition shadow-md shadow-amber-500/20">
            {busy ? "Searching records..." : "Search Student Directory"}
          </button>
        </form>
      </div>

      {results.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 uppercase font-bold text-slate-400">
              <tr>
                <th className="px-4 py-3">Student Details</th>
                <th className="px-4 py-3">College & Branch</th>
                <th className="px-4 py-3">Session</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {results.map(st => (
                <tr key={st.id} className="hover:bg-slate-50/80 transition">
                  <td className="px-4 py-3">
                    <strong className="text-slate-900 block text-sm">{st.firstName} {st.lastName}</strong>
                    <span className="text-amber-600 font-mono text-[11px]">{st.studentUid}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div>{st.college?.name || "N/A"}</div>
                    <div className="text-[10px] text-slate-400">{st.branch?.name || "All Branches"}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-700">{st.academicYear || "2026-2027"}</td>
                  <td className="px-4 py-3">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                      {st.status || "ACTIVE"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
function SystemFeeReports({ token }: { token: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-6">
      <h3 className="text-lg font-bold text-slate-900">System Fee Reports</h3>
      <p className="text-xs text-slate-500 mt-1">Audit transactions network-wide.</p>
    </div>
  );
}