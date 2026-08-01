import React from "react";
import { Link } from "react-router-dom";
import {
  FiArrowRight,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiLock,
  FiMessageCircle,
  FiSearch,
  FiShield
} from "react-icons/fi";
import PublicNav from "../components/PublicNav";

const features = [
  {
    icon: FiSearch,
    title: "Verified lawyer discovery",
    text: "Search approved lawyers by expertise, city, experience and transparent client feedback."
  },
  {
    icon: FiCalendar,
    title: "Structured appointments",
    text: "Request, confirm, reschedule and track consultations from one secure timeline."
  },
  {
    icon: FiBriefcase,
    title: "Private case workspace",
    text: "Manage case progress and share documents through permission-checked downloads."
  },
  {
    icon: FiMessageCircle,
    title: "Real-time communication",
    text: "Keep every client-lawyer conversation linked to the correct account or case."
  }
];

export function Home() {
  return (
    <div className="marketing-page">
      <PublicNav />
      <main>
        <section className="hero-section">
          <div className="hero-orb hero-orb-one" />
          <div className="hero-orb hero-orb-two" />
          <div className="container-xl hero-grid">
            <div className="hero-copy hero-enter">
              <span className="eyebrow light">Secure legal collaboration</span>
              <h1>Legal help, organized around your case.</h1>
              <p>
                Find an approved lawyer, book a consultation, submit documents and follow
                every case update from a protected digital workspace.
              </p>
              <div className="hero-actions">
                <Link className="btn btn-gold btn-lg" to="/lawyers">
                  Find a lawyer <FiArrowRight />
                </Link>
                <Link className="btn btn-ghost-light btn-lg" to="/register?role=lawyer">
                  Join as a lawyer
                </Link>
              </div>
              <div className="hero-trust">
                <span><FiLock /> Private files</span>
                <span><FiShield /> Role-based access</span>
                <span><FiCheckCircle /> Verified profiles</span>
              </div>
            </div>

            <div className="hero-panel hero-panel-enter" aria-label="LegalSphere workflow">
              <div className="hero-panel-head">
                <span>Case workspace</span>
                <span className="secure-pill"><FiLock /> Protected</span>
              </div>
              <div className="hero-case">
                <span className="case-index">01</span>
                <div>
                  <strong>Consultation requested</strong>
                  <small>Appointment workflow started</small>
                </div>
                <FiCheckCircle />
              </div>
              <div className="hero-case">
                <span className="case-index">02</span>
                <div>
                  <strong>Documents submitted</strong>
                  <small>Visible only to case participants</small>
                </div>
                <FiCheckCircle />
              </div>
              <div className="hero-case current">
                <span className="case-index">03</span>
                <div>
                  <strong>Case in progress</strong>
                  <small>Timeline and messages stay synchronized</small>
                </div>
                <span className="pulse-dot" />
              </div>
              <div className="mini-chart">
                <span style={{ height: "32%" }} />
                <span style={{ height: "48%" }} />
                <span style={{ height: "42%" }} />
                <span style={{ height: "68%" }} />
                <span style={{ height: "82%" }} />
                <span style={{ height: "92%" }} />
              </div>
            </div>
          </div>
        </section>

        <section className="trust-strip" data-reveal="up">
          <div className="container-xl">
            <span>Built for clear legal workflows</span>
            <div>
              <strong>Private by design</strong>
              <strong>Human-readable status tracking</strong>
              <strong>Secure payments</strong>
              <strong>Audit-friendly records</strong>
            </div>
          </div>
        </section>

        <section className="section container-xl">
          <div className="section-heading centered" data-reveal="up">
            <span className="eyebrow">Everything in one place</span>
            <h2>A calmer way to manage legal work</h2>
            <p>Each feature follows the same permissions and status rules, so users always know what happens next.</p>
          </div>
          <div className="feature-grid">
            {features.map(({ icon: Icon, title, text }, index) => (
              <article
                className="feature-card"
                key={title}
                data-reveal="up"
                style={{ "--reveal-delay": `${index * 85}ms` }}
              >
                <span className="feature-icon"><Icon /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section process-section">
          <div className="container-xl process-grid">
            <div data-reveal="left">
              <span className="eyebrow">Simple process</span>
              <h2>From first search to final review</h2>
              <p>
                LegalSphere keeps appointments, case decisions, files, messages and reviews
                attached to the correct people and records.
              </p>
              <Link className="text-link" to="/register">Create your secure workspace <FiArrowRight /></Link>
            </div>
            <ol className="process-list" data-reveal="right">
              <li><span>1</span><div><strong>Choose an approved lawyer</strong><p>Filter by specialty and location.</p></div></li>
              <li><span>2</span><div><strong>Request a consultation</strong><p>Agree on time, mode and professional fee.</p></div></li>
              <li><span>3</span><div><strong>Open a case workspace</strong><p>Share protected documents and track decisions.</p></div></li>
              <li><span>4</span><div><strong>Close and review</strong><p>Leave one verified review for the completed case.</p></div></li>
            </ol>
          </div>
        </section>

        <section className="cta-section">
          <div className="container-xl cta-card" data-reveal="scale">
            <div>
              <span className="eyebrow light">Start securely</span>
              <h2>Your next legal step can be clearer.</h2>
            </div>
            <div className="hero-actions">
              <Link className="btn btn-gold btn-lg" to="/register">Create account</Link>
              <Link className="btn btn-ghost-light btn-lg" to="/lawyers">Browse lawyers</Link>
            </div>
          </div>
        </section>
      </main>
      <footer className="public-footer">
        <div className="container-xl">
          <Link className="brand" to="/"><span className="brand-mark">LS</span><span>LegalSphere</span></Link>
          <p>Secure legal workflow software. Not a substitute for independent legal advice.</p>
          <span>© {new Date().getFullYear()} LegalSphere</span>
        </div>
      </footer>
    </div>
  );
}

export function About() {
  return (
    <div className="marketing-page">
      <PublicNav />
      <main>
        <section className="inner-hero">
          <div className="container-xl" data-reveal="up">
            <span className="eyebrow light">About LegalSphere</span>
            <h1>Technology that keeps legal work understandable.</h1>
            <p>
              LegalSphere connects clients and verified lawyers through a secure workflow for
              consultations, cases, private documents, communication and transparent reviews.
            </p>
          </div>
        </section>
        <section className="section container-xl about-grid" data-reveal="up">
          <article>
            <span className="eyebrow">Our product principles</span>
            <h2>Clarity, privacy and accountability</h2>
            <p>
              Every sensitive action is validated on the server. Access is based on role and
              ownership, not merely on whether someone knows a URL.
            </p>
          </article>
          <div className="principle-cards">
            <div><FiLock /><strong>Private by default</strong><p>Documents remain outside the public web root.</p></div>
            <div><FiShield /><strong>Explicit permissions</strong><p>Clients, lawyers and administrators receive separate capabilities.</p></div>
            <div><FiCheckCircle /><strong>Controlled workflows</strong><p>Status transitions prevent accidental or invalid updates.</p></div>
          </div>
        </section>
      </main>
    </div>
  );
}
