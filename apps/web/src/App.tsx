import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Building2, ChevronRight, GraduationCap, Menu, ShieldCheck, Sparkles, Star, Trophy, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import nsrLogo from '../../assets/nsrLogo.png';
import { CollegeAdminPortal } from './CollegeAdminPortal';
import { referenceContent } from './referenceContent';
import { StudentPortal } from './StudentPortal';
import { StudentLoginPage } from './StudentLoginPage';
import { SuperAdminPortal } from './SuperAdminPortal';

const navItems = [
  { path: '/about', label: 'About Us' },
  { path: '/courses', label: 'Courses' },
  { path: '/branches', label: 'Branches' },
  { path: '/results', label: 'Results' },
  { path: '/gallery', label: 'Gallery' },
  { path: '/contact', label: 'Contact' }
];

export function App() {
  const [studentId, setStudentId] = useState('');
  const [studentAccessToken, setStudentAccessToken] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);

  const authenticateStudent = (id: string, accessToken: string) => {
    setStudentId(id);
    setStudentAccessToken(accessToken);
    navigate('/student');
  };

  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage onRegister={() => navigate('/register')} onPageChange={(path) => navigate(path)} />} />
        <Route path="about" element={<AboutPage onRegister={() => navigate('/register')} />} />
        <Route path="courses" element={<CoursesPage onRegister={() => navigate('/register')} />} />
        <Route path="courses/:slug" element={<CourseDetailPage onRegister={() => navigate('/register')} />} />
        <Route path="branches" element={<BranchesPage onRegister={() => navigate('/register')} />} />
        <Route path="results" element={<ResultsPage onRegister={() => navigate('/register')} />} />
        <Route path="gallery" element={<GalleryPage onRegister={() => navigate('/register')} />} />
        <Route path="contact" element={<ContactPage onRegister={() => navigate('/register')} />} />
      </Route>
      <Route path="login" element={<StudentLoginPage onBack={() => navigate('/')} onAdminLogin={() => navigate('/admin')} onAuthenticated={authenticateStudent} />} />
      <Route path="register" element={<Navigate to="/login" replace />} />
      <Route path="student" element={studentId && studentAccessToken ? <StudentPortal studentId={studentId} accessToken={studentAccessToken} onBack={() => { setStudentId(''); setStudentAccessToken(''); navigate('/'); }} /> : <Navigate to="/login" replace />} />
      <Route path="admin" element={<CollegeAdminPortal onBack={() => navigate('/')} onStudentLogin={() => navigate('/login')} />} />
      <Route path="super-admin" element={<SuperAdminPortal />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function PublicLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const root = document.documentElement;
    const scrollPosition = window.scrollY;
    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;
    const previousRootOverflow = root.style.overflow;
    const previousOverscrollBehavior = root.style.overscrollBehavior;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    root.style.overflow = 'hidden';
    root.style.overscrollBehavior = 'none';
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      root.style.overflow = previousRootOverflow;
      root.style.overscrollBehavior = previousOverscrollBehavior;
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
      document.removeEventListener('keydown', closeOnEscape);
      window.scrollTo(0, scrollPosition);
    };
  }, [mobileOpen]);

  return (
    <div className="public-site min-h-screen flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Sticky Glassmorphism Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/80 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link className="flex items-center gap-3 group focus:outline-none" to="/" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="NSR Impulse Educational Institutions home">
            <img
              className="app-logo"
              src={nsrLogo}
              alt="NSR Impulse Educational Institutions"
            />
          </Link>

          <button
            className="mobile-menu-toggle md:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-amber-400 focus:outline-none"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            aria-controls="public-navigation"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <button
            className={`mobile-menu-backdrop ${mobileOpen ? 'is-open' : ''}`}
            type="button"
            aria-label="Close menu"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setMobileOpen(false)}
          />

          <nav id="public-navigation" className={`public-navigation ${mobileOpen ? 'is-open' : ''}`}>
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `text-sm font-medium transition-colors duration-200 ${isActive ? 'text-amber-400 font-semibold' : 'text-slate-300 hover:text-amber-400'}`}
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
            <Link
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-semibold text-sm shadow-lg shadow-amber-500/20 hover:bg-amber-400 transition-all transform hover:-translate-y-0.5"
              to="/login"
              onClick={() => setMobileOpen(false)}
            >
              Login <ArrowUpRight size={16} />
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-grow">
        <Outlet />
      </main>

      {/* Premium Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 text-slate-400 py-8 sm:py-12 px-4 sm:px-6 lg:px-8 mt-12 sm:mt-16">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex flex-col items-center md:items-start gap-3">
            <Link to="/" className="flex items-center gap-3">
              <img
                className="app-logo"
                src={nsrLogo}
                alt="NSR Impulse Educational Institutions"
              />
            </Link>
            <p className="site-footer-tagline text-sm text-slate-400">One connected community for ambitious learners.</p>
          </div>
          <div className="flex flex-col items-center md:items-end gap-2 text-xs text-slate-500">
            <div className="site-footer-links flex gap-6">
              <Link to="/about" className="hover:text-amber-400 transition-colors">About</Link>
              <Link to="/courses" className="hover:text-amber-400 transition-colors">Courses</Link>
              <Link to="/branches" className="hover:text-amber-400 transition-colors">Branches</Link>
              <Link to="/contact" className="hover:text-amber-400 transition-colors">Contact</Link>
            </div>
            <p className="site-footer-copyright">© 2026 NSR Impulse Educational Institutions. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

const campusSlides = [
  {
    image: '/images/campus/campus-building.jpg',
    alt: 'Campus building surrounded by greenery',
    eyebrow: 'A place to grow',
    title: 'Build a bright future.',
    description: 'Discover a learning community that helps students move forward with confidence.'
  },
  {
    image: '/images/campus/classroom.jpg',
    alt: 'Bright classroom prepared for focused learning',
    eyebrow: 'Learning together',
    title: 'Make room to understand.',
    description: 'Focused preparation and supportive teaching help make every lesson count.'
  },
  {
    image: '/images/campus/library.jpg',
    alt: 'Quiet library with study tables and bookshelves',
    eyebrow: 'Your next chapter',
    title: 'Find focus. Reach further.',
    description: 'A calm place to learn, ask questions, and take the next step toward your goals.'
  }
];

function HomePage({ onRegister, onPageChange }: { onRegister: () => void; onPageChange: (path: string) => void }) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [selectedCourseIndex, setSelectedCourseIndex] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);
  const slide = campusSlides[activeSlide]!;
  const selectedCourse = courseDetails[selectedCourseIndex]!;

  useEffect(() => {
    if (isCarouselPaused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % campusSlides.length);
    }, 6000);

    return () => window.clearInterval(timer);
  }, [isCarouselPaused]);

  const showSlide = (direction: number) => {
    setActiveSlide((current) => (current + direction + campusSlides.length) % campusSlides.length);
  };

  return (
    <div className="home-page space-y-10 pb-10 overflow-hidden sm:space-y-14 sm:pb-14 lg:space-y-20 lg:pb-20">
      {/* Hero Section */}
      <section className="relative pt-8 pb-8 sm:pt-12 sm:pb-12 lg:pt-28 lg:pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="lg:col-span-7 space-y-5 sm:space-y-7 lg:space-y-8 z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-semibold tracking-wide uppercase">
            <Sparkles size={14} /> Admissions 2026-27 Open
          </div>
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.1]">
            Start your beautiful <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 italic font-normal">and bright future.</span>
          </h1>
          <p className="text-base sm:text-xl text-slate-300 max-w-2xl leading-relaxed">
            Focused preparation, inspiring mentors, and a learning community that helps every student move with purpose.
          </p>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-1 sm:pt-2">
            <button
              className="px-5 py-3 sm:px-8 sm:py-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold shadow-xl shadow-amber-500/25 hover:from-amber-400 hover:to-amber-500 transition-all transform hover:-translate-y-0.5 flex items-center gap-2.5"
              onClick={onRegister}
            >
              Join NSR Impulse <ArrowRight size={18} />
            </button>
            <button
              type="button"
              className="px-4 py-3 sm:px-6 sm:py-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 font-medium hover:bg-slate-800 hover:text-amber-400 transition-all flex items-center gap-2"
              onClick={() => onPageChange('about')}
            >
              About our approach <ArrowUpRight size={17} />
            </button>
          </div>
        </div>

        <div className="lg:col-span-5 relative z-10">
          <div
            className="campus-carousel group relative aspect-[4/3] min-h-[260px] sm:min-h-[320px] w-full overflow-hidden rounded-3xl shadow-xl"
            role="region"
            aria-roledescription="carousel"
            aria-label="Campus and learning highlights"
            onMouseEnter={() => setIsCarouselPaused(true)}
            onMouseLeave={() => setIsCarouselPaused(false)}
            onFocus={() => setIsCarouselPaused(true)}
            onBlur={(event) => {
              if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
                setIsCarouselPaused(false);
              }
            }}
          >
            <img
              key={slide.image}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              src={slide.image}
              alt={slide.alt}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 space-y-5 p-6 text-white sm:p-8">
              <div aria-live={isCarouselPaused ? 'polite' : 'off'}>
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">{slide.eyebrow}</span>
                <h2 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">{slide.title}</h2>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-white/90 sm:text-base">{slide.description}</p>
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-white/30 pt-4">
                <Link to="/about" className="inline-flex items-center gap-2 text-sm font-semibold text-white transition-colors hover:text-amber-300">
                  Discover NSR Impulse <ArrowUpRight size={16} />
                </Link>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-white/50 p-2 text-white transition-colors hover:bg-white/20"
                    onClick={() => showSlide(-1)}
                    aria-label="Previous campus highlight"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-white/50 p-2 text-white transition-colors hover:bg-white/20"
                    onClick={() => showSlide(1)}
                    aria-label="Next campus highlight"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
              <div className="flex justify-center gap-2" aria-label="Choose a campus highlight">
                {campusSlides.map((item, index) => (
                  <button
                    key={item.title}
                    type="button"
                    className={`h-2 rounded-full transition-all ${index === activeSlide ? 'w-7 bg-amber-400' : 'w-2 bg-white/70 hover:bg-white'}`}
                    onClick={() => setActiveSlide(index)}
                    aria-label={`Show slide ${index + 1}: ${item.title}`}
                    aria-current={index === activeSlide ? 'true' : undefined}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Marquee Banner */}
      {/* Stats Marquee Banner with Animated Counter */}
      <section className="home-stats max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="home-stats-grid rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 p-8 lg:p-12 shadow-2xl grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-y md:divide-y-0 md:divide-x divide-slate-800/80">
          {referenceContent.stats.map(([value, label]) => (
            <div key={label} className="home-stat-item space-y-1">
              <div className="home-stat-value text-4xl lg:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200">
                <AnimatedCounter value={value} />
              </div>
              <div className="home-stat-label text-sm font-medium text-slate-400 uppercase tracking-wider">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Intro Section */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-4 sm:py-8 lg:py-12">
        <div className="space-y-6">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight">
            Learning with a <span className="text-amber-400 italic font-normal">longer view.</span>
          </h2>
          <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
            NSR Impulse brings together rigorous academic preparation and the human support students need to keep going. Across our campuses, we build habits that last beyond an exam hall.
          </p>
          <div>
            <button type="button" className="inline-flex items-center gap-2 text-amber-400 font-semibold hover:text-amber-300 transition-colors pt-2" onClick={() => onPageChange('courses')}>
              Discover our facilities <ArrowUpRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* Facilities Section */}
      <section className="home-facilities max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-10 lg:space-y-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-900 pb-6">
          <div className="space-y-2">
            <span className="text-amber-400 font-semibold text-xs uppercase tracking-widest">Campus Infrastructure</span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white">More than <span className="text-amber-400 italic font-normal">a classroom.</span></h2>
            <p className="text-slate-400">Every detail has a job: make learning clearer, calmer, and more consistent.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {referenceContent.facilities.map(([title, description], index) => (
            <article
              key={title}
              className={`home-feature-card rounded-2xl p-8 border transition-all duration-300 flex flex-col justify-between group ${index === 1
                ? 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900'
                : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900'
                }`}
            >
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:scale-110 transition-transform">
                    {index === 0 ? <ShieldCheck size={22} /> : index === 1 ? <GraduationCap size={22} /> : index === 2 ? <BookOpen size={22} /> : <Building2 size={22} />}
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white group-hover:text-amber-400 transition-colors">{title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
                </div>
              </div>
              <div className="pt-6 mt-6 border-t border-slate-800/60 flex items-center justify-between text-amber-400 text-xs font-semibold">
                <span>Explore feature</span>
                <ChevronRight size={16} className="transform group-hover:translate-x-1 transition-transform" />
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Courses Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-10 lg:space-y-12">
        <div className="space-y-2">
          <span className="text-amber-400 font-semibold text-xs uppercase tracking-widest">Academic Tracks</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white">Find your <span className="text-amber-400 italic font-normal">next challenge.</span></h2>
          <p className="text-slate-400">Structured pathways for students preparing to take a confident step forward.</p>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2" role="tablist" aria-label="Select an academic course">
          {courseDetails.map((course, index) => (
            <button
              key={course.slug}
              id={`course-tab-${course.slug}`}
              role="tab"
              aria-selected={index === selectedCourseIndex}
              aria-controls="course-panel"
              tabIndex={index === selectedCourseIndex ? 0 : -1}
              onClick={() => setSelectedCourseIndex(index)}
              onKeyDown={(event) => {
                let nextIndex: number;
                if (event.key === 'ArrowRight') nextIndex = (index + 1) % courseDetails.length;
                else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + courseDetails.length) % courseDetails.length;
                else if (event.key === 'Home') nextIndex = 0;
                else if (event.key === 'End') nextIndex = courseDetails.length - 1;
                else return;

                event.preventDefault();
                setSelectedCourseIndex(nextIndex);
                document.getElementById(`course-tab-${courseDetails[nextIndex]!.slug}`)?.focus();
              }}
              className={`shrink-0 px-5 py-3 rounded-xl text-sm font-semibold transition-all ${index === selectedCourseIndex
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                : 'bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                }`}
              type="button"
            >
              {course.title}
            </button>
          ))}
        </div>

        <div
          className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 p-6 sm:p-8 lg:p-12 shadow-2xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
          id="course-panel"
          role="tabpanel"
          aria-labelledby={`course-tab-${selectedCourse.slug}`}
          tabIndex={0}
        >
          <div className="lg:col-span-8 space-y-5">
            <span className="text-xs font-mono font-bold text-amber-400 tracking-wider">
              {String(selectedCourseIndex + 1).padStart(2, '0')} / {String(courseDetails.length).padStart(2, '0')} · {selectedCourse.eyebrow}
            </span>
            <h3 className="text-3xl lg:text-4xl font-bold text-white">{selectedCourse.title} <span className="text-amber-400 italic font-normal">with a clear plan.</span></h3>
            <p className="text-slate-300 text-lg leading-relaxed">{selectedCourse.description}</p>
            <ul className="grid gap-2 text-sm text-slate-400 sm:grid-cols-2" aria-label={`${selectedCourse.title} course highlights`}>
              {selectedCourse.highlights.map((highlight) => (
                <li key={highlight} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  {highlight}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 transition-colors hover:border-amber-500 hover:text-amber-700"
                to={`/courses/${selectedCourse.slug}`}
              >
                Course details <ArrowUpRight size={17} />
              </Link>
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 font-bold text-slate-950 transition-colors hover:bg-amber-400"
                onClick={onRegister}
              >
                Enquire now <ArrowRight size={17} />
              </button>
            </div>
          </div>
          <div className="lg:col-span-4 flex flex-col items-center justify-center rounded-2xl border border-slate-800/80 bg-slate-950/60 p-6 text-center space-y-4">
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-400">
              <BookOpen size={32} />
            </div>
            <h4 className="font-bold text-white">Core subjects</h4>
            <div className="flex flex-wrap justify-center gap-2">
              {selectedCourse.subjects.map((subject) => (
                <span key={subject} className="rounded-full border border-slate-700 bg-white/80 px-3 py-1.5 text-sm font-medium text-slate-700">
                  {subject}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Results Section */}
      <section className="home-results max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="home-results-panel rounded-3xl bg-slate-900/60 border border-slate-800 p-8 lg:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-5 space-y-3">
            <p className="text-xs font-bold text-amber-400 tracking-widest uppercase">Results that matter</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">Small wins. <br /><span className="text-amber-400 italic font-normal">Big momentum.</span></h2>
          </div>
          <div className="home-results-stats lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="home-result-stat p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-2">
              <div className="text-3xl font-bold text-amber-400">98%</div>
              <div className="text-xs text-slate-400">regular assessment participation</div>
            </div>
            <div className="home-result-stat p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-2">
              <div className="text-3xl font-bold text-amber-400">100+</div>
              <div className="text-xs text-slate-400">rank holders supported</div>
            </div>
            <div className="home-result-stat p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-2">
              <div className="text-3xl font-bold text-amber-400">5</div>
              <div className="text-xs text-slate-400">campus communities</div>
            </div>
          </div>
        </div>
      </section>

      {/* Branches Section */}
      <section className="home-branches max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 sm:space-y-10 lg:space-y-12">
        <div className="space-y-2">
          <span className="text-amber-400 font-semibold text-xs uppercase tracking-widest">Our Locations</span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white">Close to <span className="text-amber-400 italic font-normal">your ambition.</span></h2>
          <p className="text-slate-400">Find a campus, find your people, and give your goals a place to grow.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {referenceContent.branches.map((branch, index) => (
            <article key={branch} className="home-branch-card rounded-2xl bg-slate-900/50 border border-slate-800 p-6 flex flex-col justify-between hover:border-amber-500/40 transition-all group">
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white group-hover:text-amber-400 transition-colors">{branch}</h3>
                <p className="text-sm text-slate-400">NSR Impulse Educational Institutions</p>
              </div>
              <div className="pt-6 mt-6 border-t border-slate-800/80">
                <button type="button" className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300">
                  Explore campus <ArrowUpRight size={15} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Voices / Testimonial Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-5 space-y-4">
            <h2 className="text-4xl sm:text-5xl font-bold text-white leading-tight">
              “The right <span className="text-amber-400 italic font-normal">place to begin.”</span>
            </h2>
            <p className="text-slate-400 text-lg">From the first lesson to the final result, the best progress feels shared.</p>
          </div>
          <div className="lg:col-span-7">
            <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-950 border border-slate-800 p-8 lg:p-10 shadow-2xl relative">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold text-lg">
                  RK
                </div>
                <div>
                  <h4 className="font-bold text-white">Riya Kumar</h4>
                  <p className="text-xs text-slate-400">Student, Hyderabad campus</p>
                </div>
              </div>
              <p className="text-lg text-slate-200 italic leading-relaxed">
                “The teachers made every difficult topic feel possible. I learned how to prepare, but also how to trust my preparation.”
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-slate-900/60 border border-slate-800 p-8 lg:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-3">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">Let’s plan your <span className="text-amber-400 italic font-normal">next step.</span></h2>
            <p className="text-slate-400 max-w-md">Admissions, course guidance, and campus visits are just a conversation away.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
            <a href="tel:+919390112235" className="px-6 py-3.5 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition-all text-center w-full sm:w-auto">
              +91 93901 12235
            </a>
            <a href="mailto:info@nsrimpulse.com" className="px-6 py-3.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 font-medium hover:bg-slate-700 transition-all text-center w-full sm:w-auto">
              info@nsrimpulse.com
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

function AboutPage({ onRegister }: { onRegister: () => void }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-800 pb-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white">Learning that grows <span className="text-amber-400 italic font-normal">with students.</span></h1>
        <button className="px-8 py-3.5 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20" onClick={onRegister}>
          Apply now <ArrowRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <article className="rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-950 border border-slate-800 p-8 lg:p-10 space-y-4">
          <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">Our Mission</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Make academic growth structured, personal, and measurable.</h2>
          <p className="text-slate-300 leading-relaxed">We combine mentoring, discipline, and confidence-building with the real preparation students need for competitive exams and long-term academic success.</p>
        </article>

        <article className="rounded-3xl bg-slate-900/50 border border-slate-800 p-8 lg:p-10 space-y-6">
          <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">Why Students Choose Us</p>
          <ul className="space-y-4 text-slate-300">
            <li className="flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-amber-400"></span> Small-group mentoring and personal attention</li>
            <li className="flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-amber-400"></span> Consistent performance tracking and actionable feedback</li>
            <li className="flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-amber-400"></span> Strong leadership and exam-focused preparation culture</li>
          </ul>
        </article>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <article className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
          <div className="text-amber-400"><ShieldCheck size={24} /></div>
          <h3 className="text-xl font-bold text-white">Vision</h3>
          <p className="text-sm text-slate-400">To help students become confident, capable and future-ready.</p>
        </article>
        <article className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
          <div className="text-amber-400"><GraduationCap size={24} /></div>
          <h3 className="text-xl font-bold text-white">Approach</h3>
          <p className="text-sm text-slate-400">Academic rigor grounded in practical coaching and structured routines.</p>
        </article>
        <article className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
          <div className="text-amber-400"><BookOpen size={24} /></div>
          <h3 className="text-xl font-bold text-white">Values</h3>
          <p className="text-sm text-slate-400">Consistency, clarity, support, and a culture of disciplined effort.</p>
        </article>
      </div>
    </div>
  );
}

const courseDetails = [
  { slug: 'jee-advanced', title: 'JEE Advanced', eyebrow: 'ENGINEERING · ADVANCED', description: 'High-intensity preparation for students aiming to master advanced concepts and multi-step problem solving.', image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=800', subjects: ['Physics', 'Chemistry', 'Mathematics'], highlights: ['Concept-first teaching', 'Advanced problem-solving workshops', 'Regular mock tests with review'] },
  { slug: 'jee-mains', title: 'JEE Mains', eyebrow: 'ENGINEERING · FOUNDATION', description: 'A structured path to build speed, accuracy, and the fundamentals needed for a confident JEE Main attempt.', image: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&q=80&w=800', subjects: ['Physics', 'Chemistry', 'Mathematics'], highlights: ['Topic-wise learning plans', 'Timed practice and analysis', 'Doubt-clearing sessions'] },
  { slug: 'neet', title: 'NEET', eyebrow: 'MEDICAL · ENTRANCE PREPARATION', description: 'Focused preparation across biology, physics, and chemistry, supported by frequent practice and mentor guidance.', image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80&w=800', subjects: ['Biology', 'Physics', 'Chemistry'], highlights: ['NCERT-aligned study support', 'Frequent subject assessments', 'Revision and test strategy'] },
  { slug: 'eamcet', title: 'EAMCET', eyebrow: 'STATE ENTRANCE · PREPARATION', description: 'A goal-oriented course to strengthen core concepts and develop the exam discipline needed for EAMCET.', image: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&q=80&w=800', subjects: ['Mathematics', 'Physics', 'Chemistry'], highlights: ['State syllabus coverage', 'Practice built around exam patterns', 'Progress check-ins'] }
];

function CoursesPage({ onRegister }: { onRegister: () => void }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-800 pb-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white">Programs built for <span className="text-amber-400 italic font-normal">focus and growth.</span></h1>
        <button className="px-8 py-3.5 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20" onClick={onRegister}>
          Book counselling <ArrowRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {courseDetails.map((course) => (
          <article key={course.slug} className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden flex flex-col justify-between hover:border-amber-500/50 transition-all group">
            <div className="h-48 overflow-hidden relative">
              <img src={course.image} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
              <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-slate-950/80 backdrop-blur-md text-amber-400 text-xs font-semibold">Core track</div>
            </div>
            <div className="p-6 space-y-4 flex-grow flex flex-col justify-between">
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white group-hover:text-amber-400 transition-colors">{course.title}</h3>
                <p className="text-sm text-slate-400 line-clamp-3">{course.description}</p>
              </div>
              <Link className="inline-flex items-center gap-1.5 text-amber-400 text-sm font-semibold hover:text-amber-300 pt-2" to={`/courses/${course.slug}`}>
                Course details <ArrowUpRight size={16} />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function CourseDetailPage({ onRegister }: { onRegister: () => void }) {
  const { slug } = useParams();
  const course = courseDetails.find((item) => item.slug === slug);
  if (!course) return <main className="max-w-7xl mx-auto px-4 py-20 text-center"><h1 className="text-3xl font-bold text-white mb-4">Course not found</h1><Link className="text-amber-400 underline" to="/courses">Browse all courses</Link></main>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
      <Link className="inline-flex items-center gap-2 text-amber-400 font-semibold text-sm hover:text-amber-300" to="/courses"><ArrowRight size={16} className="rotate-180" /> All courses</Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center rounded-3xl bg-slate-900/60 border border-slate-800 p-8 lg:p-12">
        <div className="lg:col-span-5 rounded-2xl overflow-hidden shadow-2xl h-80">
          <img src={course.image} alt={course.title} className="w-full h-full object-cover" />
        </div>
        <div className="lg:col-span-7 space-y-6">
          <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">{course.eyebrow}</span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white">{course.title} <br /><span className="text-amber-400 italic font-normal">with a clear plan.</span></h1>
          <p className="text-slate-300 text-lg">{course.description}</p>
          <button className="px-8 py-3.5 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20" onClick={onRegister}>
            Enquire about this course <ArrowRight size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <article className="rounded-3xl bg-slate-900/40 border border-slate-800 p-8 space-y-6">
          <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">What you'll study</p>
          <h2 className="text-2xl font-bold text-white">Core subjects</h2>
          <div className="flex flex-wrap gap-3">
            {course.subjects.map((subject) => (
              <span key={subject} className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-medium text-sm">{subject}</span>
            ))}
          </div>
        </article>

        <article className="rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-950 border border-slate-800 p-8 space-y-6">
          <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">How we support you</p>
          <h2 className="text-2xl font-bold text-white">Built around steady progress.</h2>
          <ul className="space-y-3 text-slate-300">
            {course.highlights.map((highlight) => (
              <li key={highlight} className="flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-amber-400"></span> {highlight}</li>
            ))}
          </ul>
        </article>
      </div>
    </div>
  );
}

function BranchesPage({ onRegister }: { onRegister: () => void }) {
  const branchImages = [
    'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=800',
    'https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&q=80&w=800',
    'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&q=80&w=800',
    'https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?auto=format&fit=crop&q=80&w=800'
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-800 pb-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white">Campus access, close to <span className="text-amber-400 italic font-normal">your goals.</span></h1>
        <button className="px-8 py-3.5 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20" onClick={onRegister}>
          Visit a branch <ArrowRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {referenceContent.branches.map((branch, index) => (
          <article key={branch} className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden flex flex-col justify-between hover:border-amber-500/50 transition-all group">
            <div className="h-44 overflow-hidden relative">
              <img src={branchImages[index % branchImages.length]} alt={branch} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
              <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-slate-950/80 backdrop-blur-md text-amber-400 text-xs font-semibold">Branch 0{index + 1}</div>
            </div>
            <div className="p-6 space-y-4">
              <h3 className="text-xl font-bold text-white group-hover:text-amber-400 transition-colors">{branch}</h3>
              <p className="text-sm text-slate-400">NSR Impulse Educational Institutions campus with mentoring support, digital resources, and student-first guidance.</p>
              <ul className="space-y-2 text-xs text-slate-300 pt-2 border-t border-slate-800">
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Career counselling</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Faculty support</li>
                <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Weekend mentoring</li>
              </ul>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ResultsPage({ onRegister }: { onRegister: () => void }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-16">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-800 pb-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white">Measured progress, visible <span className="text-amber-400 italic font-normal">outcomes.</span></h1>
        <button className="px-8 py-3.5 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20" onClick={onRegister}>
          Get result guidance <ArrowRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
          <div className="text-4xl lg:text-5xl font-extrabold text-amber-400">98%</div>
          <div className="text-sm text-slate-400 uppercase tracking-wider font-medium">student participation</div>
        </div>
        <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
          <div className="text-4xl lg:text-5xl font-extrabold text-amber-400">100+</div>
          <div className="text-sm text-slate-400 uppercase tracking-wider font-medium">rank holders</div>
        </div>
        <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
          <div className="text-4xl lg:text-5xl font-extrabold text-amber-400">5</div>
          <div className="text-sm text-slate-400 uppercase tracking-wider font-medium">active campus hubs</div>
        </div>
        <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
          <div className="text-4xl lg:text-5xl font-extrabold text-amber-400">12k+</div>
          <div className="text-sm text-slate-400 uppercase tracking-wider font-medium">practice hours tracked</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <article className="rounded-3xl bg-slate-900/40 border border-slate-800 p-8 space-y-4">
          <p className="text-lg text-slate-200 italic leading-relaxed">“The difference came from consistent coaching, excellent mentors and a system that held students accountable without stress.”</p>
          <p className="text-sm font-bold text-amber-400">— Student mentor, Hyderabad</p>
        </article>
        <article className="rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-950 border border-slate-800 p-8 space-y-4">
          <p className="text-lg text-slate-200 italic leading-relaxed">“Every test improved my approach. The data and mentoring made the next step clear.”</p>
          <p className="text-sm font-bold text-amber-400">— Top performer, JEE track</p>
        </article>
      </div>
    </div>
  );
}

function GalleryPage({ onRegister }: { onRegister: () => void }) {
  const gallery: Array<[string, string]> = [
    ['Campus architecture', 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&q=80&w=1200'],
    ['Classroom environment', 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&q=80&w=1200'],
    ['Library and study', 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&q=80&w=1200'],
    ['Focused learning', 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=1200']
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-800 pb-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white">Snapshots of a vibrant <span className="text-amber-400 italic font-normal">learning culture.</span></h1>
        <button className="px-8 py-3.5 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20" onClick={onRegister}>
          Join the campus <ArrowRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {gallery.map(([item, image]) => (
          <article key={item} className="relative h-80 rounded-3xl overflow-hidden border border-slate-800 group shadow-2xl">
            <div className="absolute inset-0 bg-cover bg-center group-hover:scale-105 transition-transform duration-700" style={{ backgroundImage: `url(${image})` }}></div>
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
            <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
              <span className="text-lg font-bold text-white">{item}</span>
              <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-semibold">NSR Impulse</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ContactPage({ onRegister }: { onRegister: () => void }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-800 pb-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white">Let’s talk about your <span className="text-amber-400 italic font-normal">next step.</span></h1>
        <button className="px-8 py-3.5 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20" onClick={onRegister}>
          Schedule a call <ArrowRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-950 border border-slate-800 p-8 lg:p-10 space-y-6">
          <h3 className="text-2xl font-bold text-white">Reach us</h3>
          <div className="space-y-4 text-slate-300">
            <p className="font-semibold text-amber-400">+91 93901 12235</p>
            <p className="font-semibold text-amber-400">info@nsrimpulse.com</p>
            <p className="leading-relaxed">Simhapuri Colony, Dundigal,<br />Pragathi Nagar, Hyderabad.</p>
          </div>
        </div>

        <form className="lg:col-span-7 rounded-3xl bg-slate-900/60 border border-slate-800 p-8 lg:p-10 space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Full name</label>
            <input type="text" placeholder="Your name" className="w-full px-4 py-3.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Email</label>
            <input type="email" placeholder="you@example.com" className="w-full px-4 py-3.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">Course interest</label>
            <select defaultValue="" className="w-full px-4 py-3.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-amber-500 transition-colors">
              <option value="" disabled>Select a program</option>
              <option>JEE Advanced</option>
              <option>JEE Mains</option>
              <option>NEET</option>
              <option>EAMCET</option>
            </select>
          </div>
          <button type="button" className="w-full py-4 rounded-xl bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20">
            Send enquiry
          </button>
        </form>
      </div>
    </div>
  );
}
export function AnimatedCounter({ value }: { value?: string }) {
  // Extract target numeric value and non-numeric suffixes (e.g. "1,900+" -> number: 1900, suffix: "+", hasComma: true)
  const safeValue = value ?? '0';
  const numericMatch = safeValue.match(/[\d,]+/);
  const rawNumberString = numericMatch ? numericMatch[0].replace(/,/g, '') : '0';
  const targetNumber = parseInt(rawNumberString, 10);
  const hasComma = safeValue.includes(',');
  const suffix = safeValue.replace(/[\d,]/g, '');

  const [count, setCount] = useState(0);
  const elementRef = useRef<HTMLDivElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          let start = 0;
          const duration = 2000; // Total duration in ms (2 seconds)
          const frameDuration = 1000 / 60; // 60 FPS
          const totalFrames = Math.round(duration / frameDuration);
          let frame = 0;

          const counterInterval = setInterval(() => {
            frame++;
            // Ease-out curve for smooth deceleration towards the end
            const progress = frame / totalFrames;
            const easeOutProgress = 1 - Math.pow(1 - progress, 3);
            const currentCount = Math.round(start + (targetNumber - start) * easeOutProgress);

            if (frame >= totalFrames) {
              setCount(targetNumber);
              clearInterval(counterInterval);
            } else {
              setCount(currentCount);
            }
          }, frameDuration);
        }
      },
      { threshold: 0.3 } // Trigger when 30% of the element is visible
    );

    if (elementRef.current) observer.observe(elementRef.current);

    return () => observer.disconnect();
  }, [targetNumber, hasAnimated]);

  const formattedCount = hasComma ? count.toLocaleString() : count;

  return (
    <span ref={elementRef} className="tabular-nums">
      {hasAnimated ? formattedCount : 0}{suffix}
    </span>
  );
}