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
import { SuperAdminOverview as SuperAdminAnalyticsOverview } from "./SuperAdminOverview";

type SuperAdminView = "dashboard" | "admins" | "search" | "reports" | "fees";
type SuperAdminContext = {
  superAdmin: { id: string; email: string; adminId: string };
  colleges: Array<{ id: string; name: string; branches: Array<{ id: string; name: string }> }>;
  courses: Array<{ id: string; name: string; programType: string }>;
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
type SuperAdminOverviewData = {
  totalStudents: number;
  activeStudents: number;
  recentStudents: number;
  branches: Array<{ branchId: string; branchName: string; collegeName: string; studentCount: number }>;
  courses: Array<{ courseId: string; courseName: string; programType: string; studentCount: number }>;
  admissionsByYear: Array<{ year: number; studentCount: number }>;
  studentsByStatus: Array<{ status: string; studentCount: number }>;
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
              Sign in as Super Admin
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
  const [contextError, setContextError] = useState("");

  const loadContext = async () => {
    setContextError("");
    try {
      const res = await fetch(`${apiBase}/api/v1/super-admin/context`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message ?? `Unable to load Super Admin context (HTTP ${res.status}).`);
      }
      setContext(json.data);
    } catch (reason) {
      setContextError(reason instanceof Error ? reason.message : "Unable to load Super Admin context.");
    }
  };

  useEffect(() => {
    void loadContext();
  }, [token]);

  if (!context)
    return (
      <main className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
        <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-busy={!contextError}>
          {contextError ? (
            <>
              <h1 className="text-lg font-bold text-slate-900">Unable to load Super Admin</h1>
              <p role="alert" className="mt-2 text-sm text-red-700">{contextError}</p>
              <p className="mt-3 text-xs text-slate-500">If the server reports a database schema error, apply the pending Prisma migrations and restart the backend.</p>
              <div className="mt-5 flex gap-3">
                <button onClick={() => void loadContext()} className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-bold text-white">Retry</button>
                <button onClick={onLogout} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">Sign out</button>
              </div>
            </>
          ) : <p className="text-sm text-slate-500">Loading Super Admin...</p>}
        </section>
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
            <button
              onClick={() => setView("fees")}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition ${view === "fees" ? "bg-amber-500 text-white shadow-md shadow-amber-500/20" : "text-slate-600 hover:bg-slate-50"
                }`}
            >
              <BookOpen size={16} /> Master Fee & Discounts
            </button>
          </nav>
        </aside>

        <main className="lg:col-span-9 p-8 bg-[#F8F9FA] space-y-6">
          {view === "dashboard" && <SuperAdminAnalyticsOverview token={token} context={context} />}
          {view === "admins" && <ManageAdmins token={token} context={context} onRefresh={loadContext} />}
          {view === "search" && <GlobalStudentSearch token={token} context={context} />}
          {view === "fees" && <MasterFeeControls token={token} context={context} onRefresh={loadContext} />}
          {view === "reports" && <SystemFeeReports token={token} context={context} />}
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
            Create Account
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
function GlobalStudentSearch({ token, context }: { token: string; context: SuperAdminContext }) {
  const [query, setQuery] = useState("");
  const [selectedCollege, setSelectedCollege] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [sessionYear, setSessionYear] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  // Edit Modal State
  const [editingStudent, setEditingStudent] = useState<any | null>(null);

  const activeCollege = context.colleges.find(c => c.id === selectedCollege);

  const search = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    setSearched(true);
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
      if (!res.ok || !json.success) throw new Error(json.error?.message || "Unable to search the student directory.");
      setResults(json.data);
    } catch (reason) {
      setResults([]);
      setError(reason instanceof Error ? reason.message : "Unable to search the student directory.");
    } finally {
      setBusy(false);
    }
  };

  // Handle Delete Student
  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete student ${name}? This action cannot be undone.`)) return;

    try {
      const res = await fetch(`${apiBase}/api/v1/super-admin/students/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (json.success) {
        setResults(results.filter(st => st.id !== id));
        alert("Student deleted successfully.");
      } else {
        alert(`Error: ${json.error?.message}`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to delete student record.");
    }
  };

  // Handle Save Edit Student
  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    try {
      const res = await fetch(`${apiBase}/api/v1/super-admin/students/${editingStudent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: editingStudent.name,
          email: editingStudent.email,
          mobile: editingStudent.mobile,
          academicYear: editingStudent.academicYear,
          status: editingStudent.status,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setResults(results.map(st => st.id === json.data.id ? json.data : st));
        setEditingStudent(null);
        alert("Student record updated successfully!");
      } else {
        alert(`Error: ${json.error?.message}`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to update student record.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4">
        <h3 className="text-lg font-bold text-slate-900">Global Student Directory & Management</h3>
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
            Search Student Directory
          </button>
        </form>
      </div>

      {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>}
      {searched && !busy && !error && results.length === 0 && (
        <p role="status" className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl p-4">No students matched that search.</p>
      )}
      {results.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 uppercase font-bold text-slate-400">
              <tr>
                <th className="px-4 py-3">Student Details</th>
                <th className="px-4 py-3">College & Branch</th>
                <th className="px-4 py-3">Session</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {results.map(st => (
                <tr key={st.id} className="hover:bg-slate-50/80 transition">
                  <td className="px-4 py-3">
                    <strong className="text-slate-900 block text-sm">{st.name}</strong>
                    <span className="student-id-highlight mt-1">{st.studentUid}</span>
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
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => setEditingStudent(st)}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(st.id, st.name)}
                      className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-lg transition"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* EDIT STUDENT MODAL */}
      {editingStudent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Edit Student Record</h3>
            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Student Name</label>
                <input
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white"
                  value={editingStudent.name || `${editingStudent.firstName || ""} ${editingStudent.lastName || ""}`.trim()}
                  onChange={e => setEditingStudent({ ...editingStudent, name: e.target.value, firstName: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Email Address</label>
                <input
                  type="email"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white"
                  value={editingStudent.email || ""}
                  onChange={e => setEditingStudent({ ...editingStudent, email: e.target.value })}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase">Mobile Number</label>
                <input
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white"
                  value={editingStudent.mobile || ""}
                  onChange={e => setEditingStudent({ ...editingStudent, mobile: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Academic Year</label>
                  <input
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white"
                    value={editingStudent.academicYear || ""}
                    onChange={e => setEditingStudent({ ...editingStudent, academicYear: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Status</label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:bg-white"
                    value={editingStudent.status || "ACTIVE"}
                    onChange={e => setEditingStudent({ ...editingStudent, status: e.target.value })}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="SUSPENDED">SUSPENDED</option>
                    <option value="GRADUATED">GRADUATED</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
function SystemFeeReports({ token, context }: { token: string; context: SuperAdminContext }) {
  const [collegeId, setCollegeId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [academicYear, setAcademicYear] = useState("2026-2027");
  const [reportData, setReportData] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [reportError, setReportError] = useState("");

  const activeCollege = context.colleges.find(c => c.id === collegeId);

  const fetchReport = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setBusy(true);
    setReportError("");
    try {
      const params = new URLSearchParams();
      if (collegeId) params.append("collegeId", collegeId);
      if (branchId) params.append("branchId", branchId);
      if (academicYear) params.append("academicYear", academicYear);

      const res = await fetch(`${apiBase}/api/v1/super-admin/reports/fees?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Unable to load fee report.");
      }
      setReportData(json.data);
    } catch (err) {
      console.error("Failed to fetch fee report", err);
      setReportError(err instanceof Error ? err.message : "Unable to load fee report.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);
  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4">
        <h3 className="text-lg font-bold text-slate-900">System-Wide Financial & Fee Reports</h3>
        <form onSubmit={fetchReport} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:bg-white focus:outline-none"
            value={collegeId}
            onChange={e => { setCollegeId(e.target.value); setBranchId(""); }}
          >
            <option value="">All Colleges</option>
            {context.colleges.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:bg-white focus:outline-none"
            value={branchId}
            onChange={e => setBranchId(e.target.value)}
            disabled={!collegeId}
          >
            <option value="">All Branches</option>
            {activeCollege?.branches?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <input
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs focus:bg-white focus:outline-none"
            placeholder="Academic Year (e.g. 2026-2027)"
            value={academicYear}
            onChange={e => setAcademicYear(e.target.value)}
          />
          <button disabled={busy} className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-md shadow-amber-500/20">
            Generate Report
          </button>
        </form>
        {reportError && <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{reportError}</p>}
      </div>

      {reportData && (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Assigned Accounts</span>
              <strong className="text-2xl font-bold text-slate-900 block">{reportData.summary.totalStudents}</strong>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Total Fee Value</span>
              <strong className="text-2xl font-bold text-slate-900 block">₹{reportData.summary.totalAssignedAmount.toLocaleString()}</strong>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Total Waivers / Discounts</span>
              <strong className="text-2xl font-bold text-amber-600 block">₹{reportData.summary.totalDiscountsGiven.toLocaleString()}</strong>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Net Receivable</span>
              <strong className="text-2xl font-bold text-emerald-600 block">₹{reportData.summary.totalNetPayable.toLocaleString()}</strong>
            </div>
          </div>

          {/* Detailed Fee Records Table */}
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-200">
              <h4 className="text-base font-bold text-slate-900">Student Fee Concession & Ledger Breakdown</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 uppercase font-bold text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Campus / Branch</th>
                    <th className="px-4 py-3">Course & Year</th>
                    <th className="px-4 py-3 text-right">Base Fee (₹)</th>
                    <th className="px-4 py-3 text-right">Discount (₹)</th>
                    <th className="px-4 py-3 text-right">Net Payable (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportData.records.map((rec: any) => (
                    <tr key={rec.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3">
                        <strong className="text-slate-900 block">{rec.studentName}</strong>
                        <span className="text-[10px] font-mono text-slate-400">{rec.studentUid}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div>{rec.collegeName}</div>
                        <div className="text-[10px] text-slate-400">{rec.branchName}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div>{rec.courseName}</div>
                        <div className="text-[10px] font-mono text-slate-400">{rec.academicYear}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">₹{rec.baseAmount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-amber-600">-₹{rec.studentDiscountTotal.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">₹{rec.netPayable.toLocaleString()}</td>
                    </tr>
                  ))}
                  {reportData.records.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-400">No fee records found for the selected filters.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
function MasterFeeControls({ token, context, onRefresh }: { token: string; context: SuperAdminContext; onRefresh: () => Promise<void> }) {
  const [feeForm, setFeeForm] = useState({ courseId: context.courses[0]?.id || "", academicYear: "2026-2027", totalAmount: "" });
  const [courseForm, setCourseForm] = useState({ programType: "INTERMEDIATE", name: "" });
  const [courseError, setCourseError] = useState("");
  const [courseMessage, setCourseMessage] = useState("");
  const [masterFees, setMasterFees] = useState<any[]>([]);

  // Student Discount State
  const [filterCollegeId, setFilterCollegeId] = useState("");
  const [filterBranchId, setFilterBranchId] = useState("");
  const [filterAcademicYear, setFilterAcademicYear] = useState("");
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [foundStudents, setFoundStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [discountData, setDiscountData] = useState({ name: "Special Concession", type: "FIXED", value: "", reason: "" });
  const [studentSearchError, setStudentSearchError] = useState("");
  const [busySearch, setBusySearch] = useState(false);
  const [discountSuccess, setDiscountSuccess] = useState("");
  const activeFilterCollege = context.colleges.find((c: any) => c.id === filterCollegeId);
  const [busyFee, setBusyFee] = useState(false);
  const [busyDisc, setBusyDisc] = useState(false);
  const selectedFeeAssignment = selectedStudent?.feeAssignments?.find((assignment: any) => assignment.isCurrent);
  const assignedDiscountTotal = selectedFeeAssignment?.discounts?.reduce(
    (total: number, discount: any) => total + Number(discount.amount),
    0
  ) ?? 0;
  const remainingFeeForDiscount = selectedFeeAssignment
    ? Math.max(0, Number(selectedFeeAssignment.originalAmount) - assignedDiscountTotal)
    : 0;

  useEffect(() => {
    let active = true;
    fetch(`${apiBase}/api/v1/super-admin/fee-structures`, {
      headers: { Authorization: "Bearer " + token }
    }).then(async (response) => {
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error?.message || "Unable to load master fee structures.");
      if (active) setMasterFees(result.data);
    }).catch((reason) => {
      if (active) setCourseError(reason instanceof Error ? reason.message : "Unable to load master fee structures.");
    });
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    const fee = masterFees.find((item) => item.courseId === feeForm.courseId && item.academicYear === feeForm.academicYear);
    setFeeForm((current) => ({ ...current, totalAmount: fee ? String(fee.totalAmount) : "" }));
  }, [feeForm.courseId, feeForm.academicYear, masterFees]);

  async function createCourse(event: FormEvent) {
    event.preventDefault();
    setCourseError("");
    setCourseMessage("");
    try {
      const response = await fetch(`${apiBase}/api/v1/super-admin/courses`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify(courseForm),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error?.message || "Unable to create course.");
      await onRefresh();
      setFeeForm((current) => ({ ...current, courseId: result.data.id }));
      setCourseForm((current) => ({ ...current, name: "" }));
      setCourseMessage(`${result.data.programType.replaceAll("_", " ")} course ${result.data.name} added.`);
    } catch (reason) {
      setCourseError(reason instanceof Error ? reason.message : "Unable to create course.");
    }
  }

  const handleUpdateFeeStructure = async (e: FormEvent) => {
    e.preventDefault();
    setBusyFee(true);
    try {
      const res = await fetch(`${apiBase}/api/v1/super-admin/fee-structures`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          courseId: feeForm.courseId,
          academicYear: feeForm.academicYear,
          totalAmount: parseFloat(feeForm.totalAmount),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message || "Unable to update master fee structure.");
      if (data.success) {
        setMasterFees((items) => [
          ...items.filter((fee) => fee.id !== data.data.id),
          data.data
        ]);
        alert("Master Fee Structure successfully updated!");
      }
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to update fee structure");
    } finally {
      setBusyFee(false);
    }
  };

  // 2. Search Students for Discount Assignment with Advanced Filters
  const handleSearchStudents = async (e: FormEvent) => {
    e.preventDefault();
    setStudentSearchError("");
    setBusySearch(true);
    try {
      const params = new URLSearchParams();
      if (studentSearchQuery) params.append("query", studentSearchQuery);
      if (filterCollegeId) params.append("collegeId", filterCollegeId);
      if (filterBranchId) params.append("branchId", filterBranchId);
      if (filterAcademicYear) params.append("session", filterAcademicYear);

      const res = await fetch(`${apiBase}/api/v1/super-admin/students/search?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Unable to search students.");
      }
      setFoundStudents(data.data);
    } catch (err) {
      console.error("Failed to search students", err);
      setStudentSearchError(err instanceof Error ? err.message : "Unable to search students.");
    } finally {
      setBusySearch(false);
    }
  };
  // 3. Assign Discount to Selected Student's Active Fee Assignment
  const handleAssignStudentDiscount = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !selectedFeeAssignment?.id) {
      alert("Please select a student with an active fee assignment.");
      return;
    }

    const enteredValue = Number(discountData.value);
    if (!Number.isFinite(enteredValue) || enteredValue <= 0) {
      alert("Enter a discount value greater than zero.");
      return;
    }
    if (discountData.type === "PERCENTAGE" && enteredValue > 100) {
      alert("Percentage discounts cannot exceed 100%.");
      return;
    }
    const requestedAmount = discountData.type === "PERCENTAGE"
      ? Math.round(Number(selectedFeeAssignment.originalAmount) * enteredValue) / 100
      : enteredValue;
    if (requestedAmount > remainingFeeForDiscount) {
      alert("The discount cannot exceed the remaining fee amount.");
      return;
    }

    setBusyDisc(true);
    try {
      const assignRes = await fetch(`${apiBase}/api/v1/super-admin/student-discounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          feeAssignmentId: selectedFeeAssignment.id,
          name: discountData.name,
          type: discountData.type,
          value: enteredValue,
          reason: discountData.reason,
          approvedBy: context.superAdmin?.adminId || "SUPER_ADMIN",
        }),
      });
      const assignJson = await assignRes.json();

      if (!assignRes.ok || !assignJson.success) {
        throw new Error(assignJson.error?.message || "Failed to assign student discount");
      }
      const appliedAmount = Number(assignJson.data.amount);
      setSelectedStudent({
        ...selectedStudent,
        feeAssignments: selectedStudent.feeAssignments.map((assignment: any) =>
          assignment.id === selectedFeeAssignment.id
            ? {
                ...assignment,
                discounts: [...(assignment.discounts || []), { amount: appliedAmount }]
              }
            : assignment
        )
      });
      setDiscountSuccess(
        `₹${appliedAmount.toLocaleString("en-IN")} waiver saved for ${selectedStudent.name || "student"}.`
      );
      setDiscountData({ name: "Special Concession", type: "FIXED", value: "", reason: "" });
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to assign student discount");
    } finally {
      setBusyDisc(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-3xl p-6">
        <h3 className="text-xl font-bold text-slate-900">Master Fee Structure & Student Discount Governance</h3>
        <p className="text-xs text-slate-500 mt-0.5">Control base course tuition fees and grant custom institutional fee waivers to specific students.</p>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-4">
        <h4 className="text-lg font-bold text-slate-900">Master Course Catalog</h4>
        <p className="text-xs text-slate-500">Add courses under Intermediate, IIT-JEE, or NEET. College Admins can only assign fees configured here.</p>
        <form onSubmit={createCourse} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-3">
          <label className="text-xs font-semibold text-slate-600">
            Program
            <select
              value={courseForm.programType}
              onChange={(event) => setCourseForm({ ...courseForm, programType: event.target.value })}
              className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50"
            >
              <option value="INTERMEDIATE">Intermediate</option>
              <option value="IIT_JEE">IIT-JEE</option>
              <option value="NEET">NEET</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Course name
            <input
              value={courseForm.name}
              onChange={(event) => setCourseForm({ ...courseForm, name: event.target.value })}
              placeholder="e.g., MPC"
              required
              className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50"
            />
          </label>
          <button type="submit" className="self-end px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold">Add course</button>
        </form>
        {courseError && <p role="alert" className="text-xs text-red-700">{courseError}</p>}
        {courseMessage && <p role="status" className="text-xs text-emerald-700">{courseMessage}</p>}
        <div className="flex flex-wrap gap-2">
          {context.courses.map((course) => (
            <span key={course.id} className="px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
              {course.programType.replaceAll("_", " ")} · {course.name}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CARD 1: MASTER COURSE FEE CONTROLS */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-4">
          <h4 className="text-lg font-bold text-slate-900">Master Course Fee Controls</h4>
          <form onSubmit={handleUpdateFeeStructure} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Select Course</label>
              <select
                value={feeForm.courseId}
                onChange={(e) => setFeeForm({ ...feeForm, courseId: e.target.value })}
                required
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none"
              >
                <option value="">-- Choose Course --</option>
                {context.courses.map((course: any) => (
                  <option key={course.id} value={course.id}>{course.programType.replaceAll("_", " ")} · {course.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Academic Year</label>
              <input
                type="text"
                value={feeForm.academicYear}
                onChange={(e) => setFeeForm({ ...feeForm, academicYear: e.target.value })}
                placeholder="e.g., 2026-2027"
                required
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Total Course Fee (₹)</label>
              <input
                type="number"
                value={feeForm.totalAmount}
                onChange={(e) => setFeeForm({ ...feeForm, totalAmount: e.target.value })}
                placeholder="e.g., 85000"
                required
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={busyFee}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition shadow-md shadow-amber-500/20 disabled:opacity-50"
            >
              Update Master Base Fee
            </button>
          </form>
        </div>
        {/* CARD 2: GRANT STUDENT-SPECIFIC DISCOUNT WITH ADVANCED FILTERS */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-4">
          <h4 className="text-lg font-bold text-slate-900">Grant Student Custom Discount</h4>

          {!selectedStudent ? (
            <div className="space-y-3">
              <form onSubmit={handleSearchStudents} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    placeholder="Name or ID..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none"
                  />
                  <input
                    type="text"
                    value={filterAcademicYear}
                    onChange={(e) => setFilterAcademicYear(e.target.value)}
                    placeholder="Session (e.g. 2026-2027)"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <select
                    value={filterCollegeId}
                    onChange={(e) => { setFilterCollegeId(e.target.value); setFilterBranchId(""); }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none"
                  >
                    <option value="">All Colleges</option>
                    {context.colleges.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>

                  <select
                    value={filterBranchId}
                    onChange={(e) => setFilterBranchId(e.target.value)}
                    disabled={!filterCollegeId}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none disabled:opacity-50"
                  >
                    <option value="">All Branches</option>
                    {activeFilterCollege?.branches?.map((b: any) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <button type="submit" disabled={busySearch} className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition disabled:opacity-50">
                  {busySearch ? "Searching..." : "Filter & Search Students"}
                </button>
              </form>

              {studentSearchError && (
                <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
                  {studentSearchError}
                </p>
              )}

              <div className="max-h-48 overflow-y-auto space-y-2 border border-slate-100 rounded-xl p-2">
                {foundStudents.map((st) => (
                  <div
                    key={st.id}
                    onClick={() => { setDiscountSuccess(""); setSelectedStudent(st); }}
                    className="p-3 bg-slate-50 hover:bg-amber-50 border border-slate-200 rounded-xl cursor-pointer transition flex justify-between items-center"
                  >
                    <div>
                      <strong className="text-slate-900 text-xs block">{st.name}</strong>
                      <span className="text-[10px] text-slate-500">{st.studentUid} • {st.college?.name} ({st.branch?.name || "General"})</span>
                    </div>
                    <span className="text-xs font-bold text-amber-600">Select</span>
                  </div>
                ))}
                {foundStudents.length === 0 && <p className="text-xs text-slate-400 text-center py-4">{busySearch ? "Searching students..." : "No students found. Use filters above to search."}</p>}
              </div>
            </div>
          ) : (
            <form onSubmit={handleAssignStudentDiscount} className="space-y-3">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-bold text-amber-700 uppercase block">Selected Student</span>
                  <strong className="text-slate-900 text-xs block">
                    {selectedStudent.name || `${selectedStudent.firstName || ""} ${selectedStudent.lastName || ""}`.trim() || "Student"}
                  </strong>
                  <span className="text-[10px] font-mono text-slate-500">{selectedStudent.studentUid || selectedStudent.id}</span>
                </div>
                <button type="button" onClick={() => setSelectedStudent(null)} className="text-xs text-red-600 font-bold hover:underline">Change</button>
              </div>
              {discountSuccess && (
                <p role="status" className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  {discountSuccess}
                </p>
              )}
              {selectedFeeAssignment ? (
                <p className="text-[11px] text-slate-500">
                  Remaining fee available for discount: ₹{remainingFeeForDiscount.toLocaleString("en-IN")}
                </p>
              ) : (
                <p role="alert" className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  This student has no active fee assignment, so a discount cannot be applied.
                </p>
              )}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Discount Title / Reason</label>
                <input
                  type="text"
                  value={discountData.name}
                  onChange={(e) => setDiscountData({ ...discountData, name: e.target.value })}
                  placeholder="e.g., Merit Scholarship / Management Quota Waiver"
                  required
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Concession Type</label>
                  <select
                    value={discountData.type}
                    onChange={(e) => setDiscountData({ ...discountData, type: e.target.value })}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none"
                  >
                    <option value="FIXED">Fixed Amount (₹)</option>
                    <option value="PERCENTAGE">Percentage (%)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Discount Value</label>
                  <input
                    type="number"
                    min="0.01"
                    max={discountData.type === "PERCENTAGE" ? 100 : remainingFeeForDiscount}
                    step="0.01"
                    value={discountData.value}
                    onChange={(e) => setDiscountData({ ...discountData, value: e.target.value })}
                    placeholder="e.g., 10000"
                    required
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Approval Notes</label>
                <input
                  type="text"
                  value={discountData.reason}
                  onChange={(e) => setDiscountData({ ...discountData, reason: e.target.value })}
                  placeholder="Approved by Director"
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={busyDisc || !selectedFeeAssignment || remainingFeeForDiscount <= 0}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition disabled:opacity-50 shadow-md"
              >
                Apply Discount Waiver to Student
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}