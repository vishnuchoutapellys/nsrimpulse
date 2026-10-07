import { ArrowRight, ArrowUpRight, Bell, BookOpen, Building2, CalendarDays, CheckCircle2, ChevronRight, GraduationCap, IndianRupee, Menu, ShieldCheck, Sparkles, Star, Trophy, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AuthPage } from './AuthPage';
import { CollegeAdminPortal } from './CollegeAdminPortal';
import { referenceContent } from './referenceContent';
import { StudentPortal } from './StudentPortal';

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
  const authenticateStudent = (id: string, accessToken: string) => { setStudentId(id); setStudentAccessToken(accessToken); navigate('/student'); };

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
      <Route path="login" element={<AuthPage mode="login" onModeChange={() => navigate('/register')} onBack={() => navigate('/')} onAuthenticated={authenticateStudent} />} />
      <Route path="register" element={<AuthPage mode="register" onModeChange={() => navigate('/login')} onBack={() => navigate('/')} onAuthenticated={authenticateStudent} />} />
      <Route path="student" element={studentId && studentAccessToken ? <StudentPortal studentId={studentId} accessToken={studentAccessToken} onBack={() => { setStudentId(''); setStudentAccessToken(''); navigate('/'); }} /> : <Navigate to="/login" replace />} />
      <Route path="admin" element={<CollegeAdminPortal onBack={() => navigate('/')} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function PublicLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <main className="site-shell">
      <header className="topbar">
        <Link className="brand brand-button" to="/" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <span className="brand-mark">N</span>
          <span><strong>NSR</strong><small>IMPULSE KNOWLEDGE PARK</small></span>
        </Link>
        <button className="menu-button" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu">
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <nav className={mobileOpen ? 'nav open' : 'nav'}>
          {navItems.map((item) => (
            <NavLink key={item.path} to={item.path} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} onClick={() => setMobileOpen(false)}>
              {item.label}
            </NavLink>
          ))}
          <Link className="nav-login" to="/login">Student login <ArrowUpRight size={16} /></Link>
        </nav>
      </header>
      <Outlet />
      <footer className="main-footer">
        <div>
          <Link className="brand" to="/"><span className="brand-mark">N</span><span><strong>NSR</strong><small>IMPULSE KNOWLEDGE PARK</small></span></Link>
          <p>One connected community for ambitious learners.</p>
        </div>
        <div className="footer-links">
          <div><b>Explore</b>{navItems.map((item) => <Link key={item.path} className="footer-link" to={item.path}>{item.label}</Link>)}</div>
          <div><b>Student access</b><Link className="footer-link" to="/login">Sign in</Link><Link className="footer-link" to="/register">Register</Link><Link className="footer-link" to="/admin">College admin</Link></div>
        </div>
        <small className="copyright">© 2026 NSR Impulse Knowledge Park. All rights reserved.</small>
      </footer>
    </main>
  );
}

function HomePage({ onRegister, onPageChange }: { onRegister: () => void; onPageChange: (path: string) => void }) {
  return (
    <>
      <section className="hero reference-hero" id="home">
        <div className="hero-copy">
          <p className="eyebrow"><Sparkles size={15} /> WELCOME TO NSR IMPULSE</p>
          <h1>Start your beautiful<br /><em>and bright future.</em></h1>
          <p className="hero-text">Focused preparation, inspiring mentors, and a learning community that helps every student move with purpose.</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={onRegister}>Join NSR Impulse <ArrowRight size={17} /></button>
            <button type="button" className="text-link" onClick={() => onPageChange('about')}>About our approach <ArrowUpRight size={16} /></button>
          </div>
        </div>

        <div className="hero-art">
          <div className="art-sun"></div>
          <div className="art-card">
            <span>Admissions open</span>
            <strong>Make room<br />for ambition.</strong>
            <small>JEE · NEET · EAMCET</small>
          </div>
          <div className="art-stamp">NSR<br /><span>learn · lead</span></div>
        </div>
      </section>

      <section className="stats">
        {referenceContent.stats.map(([value, label]) => (
          <div key={label}><strong>{value}</strong><span>{label}</span></div>
        ))}
      </section>

      <section className="page-grid intro-section">
        <div className="section-kicker"><span>01</span><p className="eyebrow">OUR PURPOSE</p></div>
        <div>
          <h2>Learning with a<br /><em>longer view.</em></h2>
          <p>NSR Impulse brings together rigorous academic preparation and the human support students need to keep going. Across our campuses, we build habits that last beyond an exam hall.</p>
          <button type="button" className="text-link" onClick={() => onPageChange('courses')}>Discover our facilities <ArrowUpRight size={16} /></button>
        </div>
      </section>

      <section className="facilities">
        <div className="section-heading">
          <div>
            <p className="eyebrow">WHAT WE BELIEVE</p>
            <h2>More than<br /><em>a classroom.</em></h2>
          </div>
          <p>Every detail has a job: make learning clearer, calmer, and more consistent.</p>
        </div>

        <div className="facility-grid">
          {referenceContent.facilities.map(([title, description], index) => (
            <article key={title} className={index === 1 ? 'featured' : ''}>
              <span className="facility-number">0{index + 1}</span>
              <div className="facility-icon">{index === 0 ? <ShieldCheck /> : index === 1 ? <GraduationCap /> : index === 2 ? <BookOpen /> : <Building2 />}</div>
              <h3>{title}</h3>
              <p>{description}</p>
              <ChevronRight size={17} />
            </article>
          ))}
        </div>
      </section>

      <section className="courses-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">OUR COURSES</p>
            <h2>Find your<br /><em>next challenge.</em></h2>
          </div>
          <p>Structured pathways for students preparing to take a confident step forward.</p>
        </div>

        <div className="course-tabs">
          {referenceContent.courses.map((course, index) => (
            <button key={course} className={index === 0 ? 'active' : ''} type="button">{course}</button>
          ))}
        </div>

        <div className="course-feature">
          <div>
            <span className="course-number">01 / 04</span>
            <h3>Prepare with<br /><em>precision.</em></h3>
            <p>Study plans, regular assessments, and teaching that stays close to the way you learn.</p>
            <button className="primary-button" onClick={onRegister}>Enquire now <ArrowUpRight size={16} /></button>
          </div>
          <div className="course-visual">
            <Trophy size={42} />
            <strong>100+</strong>
            <span>rank holders and rising</span>
          </div>
        </div>
      </section>

      <section className="results-section">
        <div>
          <p className="eyebrow">RESULTS THAT MATTER</p>
          <h2>Small wins.<br /><em>Big momentum.</em></h2>
        </div>
        <div className="result-list">
          <div><strong>98%</strong><span>regular assessment participation</span></div>
          <div><strong>100+</strong><span>rank holders supported</span></div>
          <div><strong>5</strong><span>campus communities</span></div>
        </div>
      </section>

      <section className="branches-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">OUR BRANCHES</p>
            <h2>Close to<br /><em>your ambition.</em></h2>
          </div>
          <p>Find a campus, find your people, and give your goals a place to grow.</p>
        </div>

        <div className="branch-grid">
          {referenceContent.branches.map((branch, index) => (
            <article key={branch}>
              <span>0{index + 1}</span>
              <h3>{branch}</h3>
              <p>NSR Impulse Knowledge Park</p>
              <button type="button" className="text-link">Explore campus <ArrowUpRight size={15} /></button>
            </article>
          ))}
        </div>
      </section>

      <section className="voices">
        <div className="voice-quote">
          <p className="eyebrow"><Star size={14} /> STUDENT VOICES</p>
          <h2>“The right<br /><em>place to begin.</em>”</h2>
          <p>From the first lesson to the final result, the best progress feels shared.</p>
        </div>
        <div className="voice-card">
          <div className="voice-avatar">RK</div>
          <p>“The teachers made every difficult topic feel possible. I learned how to prepare, but also how to trust my preparation.”</p>
          <strong>Riya Kumar</strong>
          <span>Student, Hyderabad campus</span>
        </div>
      </section>

      <section className="contact-section">
        <div>
          <p className="eyebrow">COME SAY HELLO</p>
          <h2>Let’s plan your<br /><em>next step.</em></h2>
        </div>
        <div className="contact-details">
          <p>Admissions, course guidance, and campus visits are just a conversation away.</p>
          <a href="tel:+919390112235">+91 93901 12235</a>
          <a href="mailto:info@nsrimpulse.com">info@nsrimpulse.com</a>
          <span>Simhapuri Colony, Dundigal,<br />Pragathi Nagar, Hyderabad.</span>
        </div>
      </section>
    </>
  );
}

function AboutPage({ onRegister }: { onRegister: () => void }) {
  return (
    <section className="page-shell subpage-shell">
      <div className="subpage-hero">
        <div>
          <p className="eyebrow">ABOUT US</p>
          <h1>Learning that grows <em>with students.</em></h1>
        </div>
        <button className="primary-button" onClick={onRegister}>Apply now <ArrowRight size={17} /></button>
      </div>

      <div className="page-grid detail-grid">
        <article className="info-card dark-card">
          <p className="eyebrow">OUR MISSION</p>
          <h2>Make academic growth structured, personal, and measurable.</h2>
          <p>We combine mentoring, discipline, and confidence-building with the real preparation students need for competitive exams and long-term academic success.</p>
        </article>

        <article className="info-card light-card">
          <p className="eyebrow">WHY STUDENTS CHOOSE US</p>
          <ul className="feature-list">
            <li>Small-group mentoring and personal attention</li>
            <li>Consistent performance tracking and actionable feedback</li>
            <li>Strong leadership and exam-focused preparation culture</li>
          </ul>
        </article>
      </div>

      <div className="three-column-grid">
        <article className="mini-card"><ShieldCheck size={20} /><h3>Vision</h3><p>To help students become confident, capable and future-ready.</p></article>
        <article className="mini-card"><GraduationCap size={20} /><h3>Approach</h3><p>Academic rigor grounded in practical coaching and structured routines.</p></article>
        <article className="mini-card"><BookOpen size={20} /><h3>Values</h3><p>Consistency, clarity, support, and a culture of disciplined effort.</p></article>
      </div>
    </section>
  );
}

const courseDetails = [
  { slug: 'jee-advanced', title: 'JEE Advanced', eyebrow: 'ENGINEERING · ADVANCED', description: 'High-intensity preparation for students aiming to master advanced concepts and multi-step problem solving.', image: '/images/campus/campus-building.jpg', subjects: ['Physics', 'Chemistry', 'Mathematics'], highlights: ['Concept-first teaching', 'Advanced problem-solving workshops', 'Regular mock tests with review'] },
  { slug: 'jee-mains', title: 'JEE Mains', eyebrow: 'ENGINEERING · FOUNDATION', description: 'A structured path to build speed, accuracy, and the fundamentals needed for a confident JEE Main attempt.', image: '/images/campus/classroom.jpg', subjects: ['Physics', 'Chemistry', 'Mathematics'], highlights: ['Topic-wise learning plans', 'Timed practice and analysis', 'Doubt-clearing sessions'] },
  { slug: 'neet', title: 'NEET', eyebrow: 'MEDICAL · ENTRANCE PREPARATION', description: 'Focused preparation across biology, physics, and chemistry, supported by frequent practice and mentor guidance.', image: '/images/campus/library.jpg', subjects: ['Biology', 'Physics', 'Chemistry'], highlights: ['NCERT-aligned study support', 'Frequent subject assessments', 'Revision and test strategy'] },
  { slug: 'eamcet', title: 'EAMCET', eyebrow: 'STATE ENTRANCE · PREPARATION', description: 'A goal-oriented course to strengthen core concepts and develop the exam discipline needed for EAMCET.', image: '/images/campus/classroom.jpg', subjects: ['Mathematics', 'Physics', 'Chemistry'], highlights: ['State syllabus coverage', 'Practice built around exam patterns', 'Progress check-ins'] }
];

function CoursesPage({ onRegister }: { onRegister: () => void }) {

  return (
    <section className="page-shell subpage-shell">
      <div className="subpage-hero">
        <div>
          <p className="eyebrow">COURSES</p>
          <h1>Programs built for <em>focus and growth.</em></h1>
        </div>
        <button className="primary-button" onClick={onRegister}>Book counselling <ArrowRight size={17} /></button>
      </div>

      <div className="card-grid four-grid">
        {courseDetails.map((course) => (
          <article key={course.slug} className="info-card course-card">
            <img src={course.image} alt="Illustrative education environment, not an NSR campus photograph" loading="lazy" />
            <span className="pill">Core track</span>
            <h3>{course.title}</h3>
            <p>{course.description}</p>
            <Link className="text-link" to={`/courses/${course.slug}`}>Course details <ArrowUpRight size={15} /></Link>
          </article>
        ))}
      </div>
    </section>
  );
}

function CourseDetailPage({ onRegister }: { onRegister: () => void }) {
  const { slug } = useParams();
  const course = courseDetails.find((item) => item.slug === slug);
  if (!course) return <main className="page-shell"><h1>Course not found</h1><Link className="text-link" to="/courses">Browse all courses</Link></main>;

  return (
    <section className="page-shell subpage-shell course-detail-page">
      <Link className="text-link back-link" to="/courses"><ArrowRight size={15} /> All courses</Link>
      <div className="course-detail-hero">
        <img src={course.image} alt="Illustrative education environment, not an NSR campus photograph" />
        <div className="course-detail-copy">
          <p className="eyebrow">{course.eyebrow}</p>
          <h1>{course.title}<br /><em>with a clear plan.</em></h1>
          <p>{course.description}</p>
          <button className="primary-button" onClick={onRegister}>Enquire about this course <ArrowRight size={17} /></button>
        </div>
      </div>
      <div className="course-detail-columns">
        <article className="info-card">
          <p className="eyebrow">WHAT YOU'LL STUDY</p>
          <h2>Core subjects</h2>
          <div className="subject-list">{course.subjects.map((subject) => <span key={subject}>{subject}</span>)}</div>
        </article>
        <article className="info-card light-card">
          <p className="eyebrow">HOW WE SUPPORT YOU</p>
          <h2>Built around steady progress.</h2>
          <ul className="feature-list">{course.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}</ul>
        </article>
      </div>
      <p className="photo-disclaimer">Campus photography is illustrative and is not a verified image of an NSR Impulse facility.</p>
    </section>
  );
}

function BranchesPage({ onRegister }: { onRegister: () => void }) {
  return (
    <section className="page-shell subpage-shell">
      <div className="subpage-hero">
        <div>
          <p className="eyebrow">BRANCHES</p>
          <h1>Campus access, close to <em>your goals.</em></h1>
        </div>
        <button className="primary-button" onClick={onRegister}>Visit a branch <ArrowRight size={17} /></button>
      </div>

      <div className="card-grid three-grid">
        {referenceContent.branches.map((branch, index) => (
          <article key={branch} className="info-card branch-card">
            <img src={['/images/campus/campus-building.jpg', '/images/campus/classroom.jpg', '/images/campus/library.jpg', '/images/campus/classroom.jpg'][index]} alt="Illustrative education environment, not a verified branch photo" loading="lazy" />
            <span className="branch-tag">Branch 0{index + 1}</span>
            <h3>{branch}</h3>
            <p>NSR Impulse Knowledge Park campus with mentoring support, digital resources, and student-first guidance.</p>
            <ul>
              <li>Career counselling</li>
              <li>Faculty support</li>
              <li>Weekend mentoring</li>
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

function ResultsPage({ onRegister }: { onRegister: () => void }) {
  return (
    <section className="page-shell subpage-shell">
      <div className="subpage-hero">
        <div>
          <p className="eyebrow">RESULTS</p>
          <h1>Measured progress, visible <em>outcomes.</em></h1>
        </div>
        <button className="primary-button" onClick={onRegister}>Get result guidance <ArrowRight size={17} /></button>
      </div>

      <div className="stats-grid">
        <div className="stat-box"><strong>98%</strong><span>student participation</span></div>
        <div className="stat-box"><strong>100+</strong><span>rank holders</span></div>
        <div className="stat-box"><strong>5</strong><span>active campus hubs</span></div>
        <div className="stat-box"><strong>12k+</strong><span>practice hours tracked</span></div>
      </div>

      <div className="quote-row">
        <article className="info-card light-card">
          <p>“The difference came from consistent coaching, excellent mentors and a system that held students accountable without stress.”</p>
          <strong>— Student mentor, Hyderabad</strong>
        </article>
        <article className="info-card dark-card">
          <p>“Every test improved my approach. The data and mentoring made the next step clear.”</p>
          <strong>— Top performer, JEE track</strong>
        </article>
      </div>
    </section>
  );
}

function GalleryPage({ onRegister }: { onRegister: () => void }) {
  const gallery: Array<[string, string]> = [
    ['Campus architecture', '/images/campus/campus-building.jpg'],
    ['Classroom environment', '/images/campus/classroom.jpg'],
    ['Library and study', '/images/campus/library.jpg'],
    ['Focused learning', '/images/campus/classroom.jpg']
  ];

  return (
    <section className="page-shell subpage-shell">
      <div className="subpage-hero">
        <div>
          <p className="eyebrow">GALLERY</p>
          <h1>Snapshots of a vibrant <em>learning culture.</em></h1>
        </div>
        <button className="primary-button" onClick={onRegister}>Join the campus <ArrowRight size={17} /></button>
      </div>

      <div className="gallery-grid">
        {gallery.map(([item, image], index) => (
          <article key={item} className={`gallery-tile tile-${index + 1}`} style={{ backgroundImage: `linear-gradient(180deg,transparent 35%,rgba(15,23,42,.68)),url(${image})` }}>
            <span>{item}</span>
          </article>
        ))}
      </div>
      <p className="photo-disclaimer">These licensed stock photos are illustrative examples, not verified images of NSR Impulse campuses or events.</p>
    </section>
  );
}

function ContactPage({ onRegister }: { onRegister: () => void }) {
  return (
    <section className="page-shell subpage-shell">
      <div className="subpage-hero">
        <div>
          <p className="eyebrow">CONTACT</p>
          <h1>Let’s talk about your <em>next step.</em></h1>
        </div>
        <button className="primary-button" onClick={onRegister}>Schedule a call <ArrowRight size={17} /></button>
      </div>

      <div className="contact-layout">
        <div className="info-card dark-card">
          <h3>Reach us</h3>
          <p>+91 93901 12235</p>
          <p>info@nsrimpulse.com</p>
          <p>Simhapuri Colony, Dundigal,<br />Pragathi Nagar, Hyderabad.</p>
        </div>

        <form className="info-card light-card contact-form">
          <label>
            <span>Full name</span>
            <input type="text" placeholder="Your name" />
          </label>
          <label>
            <span>Email</span>
            <input type="email" placeholder="you@example.com" />
          </label>
          <label>
            <span>Course interest</span>
            <select defaultValue="">
              <option value="" disabled>Select a program</option>
              <option>JEE Advanced</option>
              <option>JEE Mains</option>
              <option>NEET</option>
              <option>EAMCET</option>
            </select>
          </label>
          <button type="button" className="primary-button">Send enquiry</button>
        </form>
      </div>
    </section>
  );
}

function StudentDashboard({ onBack }: { onBack: () => void }) { return <main className="dashboard"><header className="dash-top"><button className="brand plain" onClick={onBack}><span className="brand-mark">N</span><span><strong>NSR</strong><small>STUDENT PWA</small></span></button><div className="dash-actions"><button aria-label="Notifications"><Bell size={19} /></button><span className="avatar">AK</span></div></header><div className="dash-content"><div className="dash-heading"><div><p className="eyebrow">GOOD MORNING, ARJUN</p><h1>Your learning, <em>in motion.</em></h1></div><span className="status"><CheckCircle2 size={15} /> Active student</span></div><section className="student-grid"><div className="student-id panel"><div className="panel-label">STUDENT ID <span>Immutable record</span></div><strong>NSR-TS-HYD-2026-000001</strong><p>Arjun Kumar · BCA · Hyderabad Campus</p></div><div className="fee-card panel"><div className="panel-label">OUTSTANDING FEES <IndianRupee size={16} /></div><strong>₹70,000</strong><p>of ₹1,00,000 total payable</p><button className="primary-button">Pay next installment <ArrowUpRight size={16} /></button></div><div className="quick panel"><div className="panel-label">QUICK ACCESS</div><div className="quick-links"><button><BookOpen /> Results</button><button><CalendarDays /> Documents</button><button><Bell /> Notices</button></div></div><div className="next panel"><div className="panel-label">NEXT INSTALLMENT <span>Due 15 Nov 2026</span></div><strong>₹25,000</strong><div className="progress"><span></span></div><small>1 of 4 installments paid</small></div></section></div></main>; }
function AdminDashboard({ onBack }: { onBack: () => void }) { return <main className="dashboard admin-dashboard"><header className="dash-top"><button className="brand plain" onClick={onBack}><span className="brand-mark">N</span><span><strong>NSR</strong><small>COLLEGE ADMIN</small></span></button><span className="admin-user">Hyderabad Campus · Admin</span></header><div className="dash-content"><div className="dash-heading"><div><p className="eyebrow">OPERATIONS OVERVIEW</p><h1>Good morning, <em>Meera.</em></h1></div><button className="primary-button">Add student <ArrowUpRight size={16} /></button></div><div className="metric-grid"><div><span>Total students</span><strong>1,248</strong><small>↑ 8.4% this year</small></div><div><span>Pending fees</span><strong>₹18.4L</strong><small>Across 326 students</small></div><div><span>Today's collection</span><strong>₹2.1L</strong><small>↑ 12.7% vs yesterday</small></div><div><span>New admissions</span><strong>38</strong><small>Last 30 days</small></div></div><section className="admin-table panel"><div className="table-head"><div><p className="eyebrow">RECENT ACTIVITY</p><h2>Admissions & payments</h2></div><button className="text-link">View all <ArrowUpRight size={15} /></button></div><div className="table-row table-label"><span>Student</span><span>Course</span><span>Status</span><span>Amount</span></div>{[['Riya Sharma', 'B.Com · Hyderabad', 'New admission', '₹40,000'], ['Karan Reddy', 'BCA · Hyderabad', 'Payment received', '₹25,000'], ['Sana Khan', 'MBA · Hyderabad', 'Fee reminder', '₹15,000']].map(row => <div className="table-row" key={row[0]}><span><b>{row[0]}</b><small>{row[1]}</small></span><span className="mobile-hide">{row[1]}</span><span className="tag">{row[2]}</span><strong>{row[3]}</strong></div>)}</section></div></main>; }
