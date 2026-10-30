import { ArrowUpRight, BookOpen, Building2, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { apiBase } from "./api";

type OverviewContext = {
  colleges: Array<{ id: string; name: string; branches: Array<{ id: string; name: string }> }>;
  courses: Array<{ id: string; name: string; programType: string }>;
  admins: Array<{ isActive: boolean }>;
};

type OverviewData = {
  totalStudents: number;
  activeStudents: number;
  recentStudents: number;
  branches: Array<{ branchId: string; branchName: string; collegeName: string; studentCount: number }>;
  courses: Array<{ courseId: string; courseName: string; programType: string; studentCount: number }>;
  admissionsByYear: Array<{ year: number; studentCount: number }>;
  studentsByStatus: Array<{ status: string; studentCount: number }>;
};

export function SuperAdminOverview({ token, context }: { token: string; context: OverviewContext }) {
  const [collegeId, setCollegeId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const availableBranches = context.colleges
    .filter((college) => !collegeId || college.id === collegeId)
    .flatMap((college) =>
      college.branches.map((branch) => ({ ...branch, collegeName: college.name })),
    );

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (collegeId) params.set("collegeId", collegeId);
    if (branchId) params.set("branchId", branchId);
    if (courseId) params.set("courseId", courseId);
    setLoading(true);
    setError("");

    fetch(`${apiBase}/api/v1/super-admin/overview?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.success) {
          throw new Error(result?.error?.message ?? `Unable to load overview analytics (HTTP ${response.status}).`);
        }
        setData(result.data as OverviewData);
      })
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name === "AbortError") return;
        setError(reason instanceof Error ? reason.message : "Unable to load overview analytics.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [token, collegeId, branchId, courseId, refreshKey]);

  const maxBranchCount = Math.max(1, ...(data?.branches.map((branch) => branch.studentCount) ?? []));
  const maxCourseCount = Math.max(1, ...(data?.courses.map((course) => course.studentCount) ?? []));
  const maxAdmissionCount = Math.max(1, ...(data?.admissionsByYear.map((entry) => entry.studentCount) ?? []));
  const activeAdmins = context.admins.filter((admin) => admin.isActive).length;
  const statusLabels: Record<string, string> = {
    ACTIVE: "Active",
    ON_HOLD: "On hold",
    DISCONTINUED: "Discontinued",
    TRANSFERRED: "Transferred",
    COMPLETED: "Completed",
    ALUMNI: "Alumni",
  };
  const metrics = [
    { label: "Total students", value: data?.totalStudents ?? 0, note: "Across selected filters", icon: UserRound, tone: "text-slate-900", accent: "bg-amber-100 text-amber-700" },
    { label: "Active students", value: data?.activeStudents ?? 0, note: "Currently active", icon: BookOpen, tone: "text-emerald-700", accent: "bg-emerald-100 text-emerald-700" },
    { label: "New student records", value: data?.recentStudents ?? 0, note: "Added in the last 30 days", icon: ArrowUpRight, tone: "text-indigo-700", accent: "bg-indigo-100 text-indigo-700" },
    { label: "Active college admins", value: activeAdmins, note: `${context.colleges.length} colleges · ${context.courses.length} courses`, icon: Building2, tone: "text-orange-700", accent: "bg-orange-100 text-orange-700" },
  ];

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300">Network overview</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Student enrollment, at a glance</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">A live view of student reach across NSR Impulse campuses, branches, and courses.</p>
          </div>
          <button
            type="button"
            onClick={() => setRefreshKey((current) => current + 1)}
            disabled={loading}
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/15 disabled:opacity-60"
          >
            Refresh overview
          </button>
        </div>
      </section>

      <section aria-label="Filter enrollment analytics" className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3">
        <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
          College
          <select
            value={collegeId}
            onChange={(event) => {
              setCollegeId(event.target.value);
              setBranchId("");
            }}
            className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium normal-case text-slate-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          >
            <option value="">All colleges</option>
            {context.colleges.map((college) => <option key={college.id} value={college.id}>{college.name}</option>)}
          </select>
        </label>
        <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
          Branch
          <select
            value={branchId}
            onChange={(event) => setBranchId(event.target.value)}
            className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium normal-case text-slate-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          >
            <option value="">All branches</option>
            {availableBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name} · {branch.collegeName}</option>)}
          </select>
        </label>
        <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
          Course
          <select
            value={courseId}
            onChange={(event) => setCourseId(event.target.value)}
            className="mt-1.5 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium normal-case text-slate-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          >
            <option value="">All courses</option>
            {context.courses.map((course) => <option key={course.id} value={course.id}>{course.name} · {course.programType.replaceAll("_", " ")}</option>)}
          </select>
        </label>
      </section>

      {error && (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 sm:flex-row sm:items-center sm:justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setRefreshKey((current) => current + 1)} className="font-bold underline">Try again</button>
        </div>
      )}

      <section aria-label="Enrollment summary" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <article key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{metric.label}</span>
              <span className={`rounded-xl p-2 ${metric.accent}`}><metric.icon size={17} /></span>
            </div>
            <strong className={`mt-3 block text-3xl font-bold tracking-tight ${metric.tone}`}>{loading && !data ? "—" : metric.value.toLocaleString("en-IN")}</strong>
            <span className="mt-1 block text-xs text-slate-500">{metric.note}</span>
          </article>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div><p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Campus reach</p><h2 className="mt-1 text-lg font-bold text-slate-900">Students by branch</h2></div>
            <span className="rounded-xl bg-amber-50 p-2.5 text-amber-700"><Building2 size={18} /></span>
          </div>
          {loading && !data ? <p className="py-8 text-center text-sm text-slate-400">Loading branch enrollment…</p> :
            data?.branches.length ? (
              <div className="space-y-4">
                {[...data.branches].sort((a, b) => b.studentCount - a.studentCount).slice(0, 8).map((branch) => (
                  <div key={branch.branchId}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate font-semibold text-slate-700">{branch.branchName}<span className="ml-1.5 font-normal text-slate-400">· {branch.collegeName}</span></span>
                      <strong className="shrink-0 text-slate-900">{branch.studentCount.toLocaleString("en-IN")}</strong>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all" style={{ width: `${Math.max(branch.studentCount ? 3 : 0, (branch.studentCount / maxBranchCount) * 100)}%` }} /></div>
                  </div>
                ))}
                {data.branches.length > 8 && <p className="pt-1 text-xs text-slate-400">Showing the 8 highest-enrollment branches.</p>}
              </div>
            ) : <p className="py-8 text-center text-sm text-slate-400">No branches match these filters.</p>}
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div><p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Academic mix</p><h2 className="mt-1 text-lg font-bold text-slate-900">Enrollment by course</h2></div>
            <span className="rounded-xl bg-indigo-50 p-2.5 text-indigo-700"><BookOpen size={18} /></span>
          </div>
          {loading && !data ? <p className="py-8 text-center text-sm text-slate-400">Loading course enrollment…</p> :
            data?.courses.length ? (
              <div className="space-y-4">
                {[...data.courses].sort((a, b) => b.studentCount - a.studentCount).slice(0, 8).map((course) => (
                  <div key={course.courseId}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                      <span className="min-w-0 truncate font-semibold text-slate-700">{course.courseName}<span className="ml-1.5 font-normal text-slate-400">· {course.programType.replaceAll("_", " ")}</span></span>
                      <strong className="shrink-0 text-slate-900">{course.studentCount.toLocaleString("en-IN")}</strong>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-500 transition-all" style={{ width: `${Math.max(course.studentCount ? 3 : 0, (course.studentCount / maxCourseCount) * 100)}%` }} /></div>
                  </div>
                ))}
                {data.courses.length > 8 && <p className="pt-1 text-xs text-slate-400">Showing the 8 highest-enrollment courses.</p>}
              </div>
            ) : <p className="py-8 text-center text-sm text-slate-400">No courses match these filters.</p>}
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 xl:col-span-3">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Admission trend</p><h2 className="mt-1 text-lg font-bold text-slate-900">Students by admission year</h2></div>
            <span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700"><ArrowUpRight size={18} /></span>
          </div>
          {loading && !data ? <p className="py-8 text-center text-sm text-slate-400">Loading admission trend…</p> :
            data?.admissionsByYear.length ? (
              <div className="flex h-44 items-end gap-3 border-b border-slate-100 px-2">
                {data.admissionsByYear.slice(-8).map((entry) => (
                  <div key={entry.year} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                    <span className="text-[10px] font-bold text-slate-600">{entry.studentCount}</span>
                    <div className="w-full max-w-12 rounded-t-lg bg-gradient-to-t from-emerald-600 to-teal-400 transition-all" style={{ height: `${Math.max(entry.studentCount ? 5 : 0, (entry.studentCount / maxAdmissionCount) * 72)}%` }} title={`${entry.year}: ${entry.studentCount} students`} />
                    <span className="pb-2 text-[10px] font-semibold text-slate-500">{entry.year}</span>
                  </div>
                ))}
              </div>
            ) : <p className="py-8 text-center text-sm text-slate-400">No admission-year records match these filters.</p>}
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 xl:col-span-2">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Student lifecycle</p><h2 className="mt-1 text-lg font-bold text-slate-900">Status breakdown</h2></div>
            <span className="rounded-xl bg-slate-100 p-2.5 text-slate-600"><UserRound size={18} /></span>
          </div>
          {loading && !data ? <p className="py-8 text-center text-sm text-slate-400">Loading student statuses…</p> :
            data?.studentsByStatus.length ? (
              <div className="space-y-3">
                {data.studentsByStatus.map((entry) => (
                  <div key={entry.status} className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-3">
                    <span className="text-xs font-semibold text-slate-600">{statusLabels[entry.status] ?? entry.status}</span>
                    <strong className="text-sm text-slate-900">{entry.studentCount.toLocaleString("en-IN")}</strong>
                  </div>
                ))}
              </div>
            ) : <p className="py-8 text-center text-sm text-slate-400">No student status data available.</p>}
        </article>
      </section>
    </div>
  );
}
