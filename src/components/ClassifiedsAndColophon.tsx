import { useState, type FormEvent } from 'react';
import { Award, CheckCircle2, ExternalLink, Mail, QrCode } from 'lucide-react';
import {
  CAREER_HISTORY,
  FEATURED_PROJECTS,
  KALYAN_PROFILE,
  VERIFIED_CERTIFICATES,
  type ProjectDispatch,
} from '../data/chronicleData';
import { BroadsheetQrCode, buildSectionQrUrl } from './BroadsheetQrCode';
import { NewspaperImage } from './NewspaperImage';
import { validateSubscriberEmail } from '../utils/emailValidation';
import { toSafeExternalHref } from '../utils/safeUrl';
import { publicAssetUrl } from '../utils/publicAssetUrl';

interface ClassifiedsAndColophonProps {
  scanDossierUrl: string;
  onOpenQuickDossier: () => void;
  latestProjects?: ProjectDispatch[];
}

type QrTargetKey = 'edition' | 'linkedin' | 'portfolio' | 'kalyanhub';

export function ClassifiedsAndColophon({
  scanDossierUrl,
  onOpenQuickDossier,
  latestProjects,
}: ClassifiedsAndColophonProps) {
  const displayedProjects =
    latestProjects && latestProjects.length > 0 ? latestProjects : FEATURED_PROJECTS;
  const [qrTarget, setQrTarget] = useState<QrTargetKey>('edition');
  const [sealLoaded, setSealLoaded] = useState<boolean>(false);

  const [subName, setSubName] = useState<string>('');
  const [subEmail, setSubEmail] = useState<string>('');
  const [subEmailError, setSubEmailError] = useState<string | null>(null);
  const [subTouched, setSubTouched] = useState<boolean>(false);
  const [submittingSub, setSubmittingSub] = useState<boolean>(false);
  const [subNotice, setSubNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [subPreviewHtml, setSubPreviewHtml] = useState<string | null>(null);
  const [showSubPreview, setShowSubPreview] = useState<boolean>(false);

  async function handleSubscribeDigest(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubTouched(true);
    setSubNotice(null);

    const emailValidationError = validateSubscriberEmail(subEmail);
    if (emailValidationError) {
      setSubEmailError(emailValidationError);
      return;
    }

    const cleanName = subName.trim();
    if (cleanName.length > 100) {
      setSubNotice({ ok: false, text: 'Name must be 100 characters or fewer.' });
      return;
    }

    setSubEmailError(null);
    setSubmittingSub(true);
    setSubPreviewHtml(null);
    setShowSubPreview(false);

    const normalizedEmail = subEmail.trim().toLowerCase();

    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          name: cleanName || undefined,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        message?: string;
        error?: string;
        previewHtml?: string;
      };
      if (!res.ok || !data.ok) {
        setSubNotice({ ok: false, text: data.error || 'Could not complete digest subscription.' });
      } else {
        setSubNotice({
          ok: true,
          text: data.message || `Subscribed ${normalizedEmail} to the daily Kalyan Chronicle.`,
        });
        if (data.previewHtml) {
          setSubPreviewHtml(data.previewHtml);
        }
        setSubEmail('');
        setSubName('');
        setSubTouched(false);
        setSubEmailError(null);
      }
    } catch {
      setSubNotice({ ok: false, text: 'Network error submitting subscription. Please try again.' });
    } finally {
      setSubmittingSub(false);
    }
  }

  const qrTargets: Record<
    QrTargetKey,
    { label: string; buttonLabel: string; url: string; sublabel: string }
  > = {
    edition: {
      label: 'Entire Newspaper & Verified Dossier',
      buttonLabel: 'Full Newspaper',
      url: scanDossierUrl,
      sublabel:
        'Opens the complete broadsheet, portfolios, LinkedIn, highlighted projects & 12 certificates.',
    },
    linkedin: {
      label: 'LinkedIn Executive Profile',
      buttonLabel: 'LinkedIn',
      url: 'https://www.linkedin.com/in/saragadamkalyan/',
      sublabel: 'Direct verification on LinkedIn (in/saragadamkalyan).',
    },
    portfolio: {
      label: 'KalyanNexus AI Portfolio',
      buttonLabel: 'Portfolio',
      url: 'https://kalyannexus.vercel.app/',
      sublabel: 'Interactive flagship engineering portfolio & case studies.',
    },
    kalyanhub: {
      label: 'KalyanHub Projects & Certificates',
      buttonLabel: 'KalyanHub',
      url: 'https://kalyanhub.netlify.app/',
      sublabel: 'Learning hub, 15 technical posts, courses, and certificates archive.',
    },
  };

  const activeQr = qrTargets[qrTarget];

  return (
    <section id="project-index" className="pt-8 pb-12">
      <div className="pb-4 border-b border-[var(--color-rule)] flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-[var(--color-press-red)] font-medium">
            Section V · Highlighted Projects, Verified Certificates &amp; Creator Chronicle
          </p>
          <h2 className="font-display text-3xl font-bold text-[var(--color-ink)] mt-1">
            Highlighted Engineering Systems &amp; Verified Credentials
          </h2>
        </div>
        <div className="shrink-0 border border-[var(--color-rule)] bg-[var(--color-paper-surface)] p-1.5">
          <BroadsheetQrCode
            url={buildSectionQrUrl('project-index')}
            label="Section V QR"
            sublabel="Projects & Credentials"
            compact
          />
        </div>
      </div>

      {/* Highlighted & Latest Projects Grid */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6 border-b border-[var(--color-rule-strong)] pb-8">
        {displayedProjects.map((proj) => (
          <article
            key={proj.id}
            className={`pt-4 flex flex-col justify-between gap-3 print-avoid-break ${
              proj.highlighted
                ? 'border-t-2 border-[var(--color-press-red)]'
                : 'border-t border-[var(--color-rule)]'
            }`}
          >
            <div className="space-y-1.5">
              <p
                className={`text-xs font-mono ${
                  proj.highlighted
                    ? 'text-[var(--color-press-red)] font-semibold'
                    : 'text-[var(--color-ink-subtle)]'
                }`}
              >
                {proj.kicker}
              </p>
              <h3 className="font-display text-xl font-bold text-[var(--color-ink)]">
                <a
                  href={toSafeExternalHref(proj.liveUrl || proj.repoUrl, 'https://github.com/kalyan870')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[var(--color-press-red)] inline-flex items-baseline gap-1.5"
                >
                  <span>{proj.title}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                </a>
              </h3>
              <p className="text-sm text-[var(--color-ink)] leading-relaxed">{proj.summary}</p>
              <p className="text-xs italic text-[var(--color-ink-muted)] pt-1">
                {proj.architectureNote}
              </p>
            </div>
            <div className="border-t border-[var(--color-rule)] pt-2 space-y-1.5">
              <p className="text-xs font-mono text-[var(--color-ink-subtle)]">
                {proj.stack.join(' · ')}
              </p>
              <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                <a
                  href={toSafeExternalHref(proj.repoUrl, 'https://github.com/kalyan870')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4 text-[var(--color-ink)] hover:text-[var(--color-press-red)]"
                >
                  Source Repo
                </a>
                {proj.liveUrl && (
                  <>
                    <span aria-hidden="true" className="text-[var(--color-ink-subtle)]">
                      ·
                    </span>
                    <a
                      href={toSafeExternalHref(proj.liveUrl, 'https://github.com/kalyan870')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-4 text-[var(--color-press-red)] hover:text-[var(--color-ink)]"
                    >
                      Live Demo
                    </a>
                  </>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Verified Certificates Ledger */}
      <div id="certificates-ledger" className="mt-8 border-b border-[var(--color-rule-strong)] pb-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2 pb-4 border-b border-[var(--color-rule)]">
          <div>
            <p className="text-xs uppercase tracking-widest text-[var(--color-press-red)] font-medium flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Verified Credentials &amp; Industry Simulations</span>
            </p>
            <h3 className="font-display text-2xl font-bold text-[var(--color-ink)] mt-0.5">
              Certificates &amp; Technical Accreditations ({VERIFIED_CERTIFICATES.length})
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <a
              href="https://kalyanhub.netlify.app/"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-mono underline underline-offset-4 text-[var(--color-ink-muted)] hover:text-[var(--color-press-red)]"
            >
              Archived on KalyanHub ↗
            </a>
            <div className="shrink-0 border border-[var(--color-rule)] bg-[var(--color-paper-surface)] p-1.5">
              <BroadsheetQrCode
                url={buildSectionQrUrl('certificates-ledger')}
                label="Certificates QR"
                sublabel="12 Verified Credentials"
                compact
              />
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-8 divide-y md:divide-y-0 divide-[var(--color-rule)]">
          {VERIFIED_CERTIFICATES.map((cert) => (
            <div
              key={cert.id}
              className="py-3 border-b border-[var(--color-rule)] flex items-start justify-between gap-4 print-avoid-break"
            >
              <div className="space-y-0.5">
                <a
                  href={cert.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-display text-base font-bold text-[var(--color-ink)] hover:text-[var(--color-press-red)] inline-flex items-baseline gap-1.5"
                >
                  <span>{cert.title}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                </a>
                <p className="text-xs text-[var(--color-ink-muted)]">
                  {cert.issuer} · <span className="font-mono">{cert.date}</span>
                </p>
              </div>
              <span className="font-mono text-[11px] text-[var(--color-ink-subtle)] shrink-0 text-right">
                {cert.code}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 space-y-6">
          <div>
            <h3 className="font-display text-2xl font-bold text-[var(--color-ink)]">
              Creator Journey &amp; Verified Experience
            </h3>
            <div className="mt-3 divide-y divide-[var(--color-rule)] border-t border-b border-[var(--color-rule)]">
              {CAREER_HISTORY.map((entry) => (
                <div key={`${entry.role}-${entry.company}`} className="py-4 space-y-1 print-avoid-break">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h4 className="font-display text-lg font-bold text-[var(--color-ink)]">
                      {entry.role} — {entry.company}
                    </h4>
                    <span className="font-mono text-xs tabular-nums text-[var(--color-ink-muted)]">
                      {entry.period} · {entry.location}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-[var(--color-ink)]">{entry.focus}</p>
                </div>
              ))}
            </div>
          </div>

          <figure>
            <NewspaperImage
              src="/assets/aistudio/file_00000000aa788207b7097a5b0df6eaeb_cc569b19.webp"
              alt="Saragadam Kalyan Creator Journey from Vignan B.Tech CSE to GenAI, AI Agents, RAG, and LLM Applications for 2028"
              aspectClass="aspect-[4/4]"
              imgClassName="object-cover object-top"
              caption="Fig. 5 — Creator Journey: Vignan VIIT B.Tech CSE foundations progressing through GenAI, RAG, FastAPI, System Design, and autonomous AI Agents."
            />
          </figure>

          {/* Classifieds — Subscribe to Digest */}
          <div
            id="classifieds-subscribe"
            className="no-print border border-[var(--color-rule-strong)] bg-[var(--color-paper-surface)] p-5 space-y-3 print-avoid-break"
          >
            <div className="border-b border-[var(--color-rule)] pb-2.5">
              <p className="text-xs uppercase tracking-widest text-[var(--color-press-red)] font-medium flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Classifieds · Daily Morning Edition</span>
              </p>
              <h4 className="font-display text-xl font-bold text-[var(--color-ink)] mt-0.5">
                Subscribe to Digest
              </h4>
              <p className="text-xs text-[var(--color-ink-muted)] mt-1 leading-relaxed">
                Receive the daily Kalyan Chronicle—fresh engineering dispatches, latest project releases, and Substack essays—automatically in your inbox.
              </p>
            </div>

            <form noValidate onSubmit={(e) => void handleSubscribeDigest(e)} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="classifieds-sub-name"
                    className="block text-xs font-medium text-[var(--color-ink-muted)] mb-1"
                  >
                    Name (Optional)
                  </label>
                  <input
                    id="classifieds-sub-name"
                    type="text"
                    maxLength={100}
                    autoComplete="name"
                    placeholder="Reader name"
                    value={subName}
                    onChange={(e) => setSubName(e.target.value)}
                    className="w-full border border-[var(--color-rule)] bg-[var(--color-paper)] px-3 py-2 text-xs text-[var(--color-ink)] focus:outline-2 focus:outline-[var(--color-press-red)]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="classifieds-sub-email"
                    className="block text-xs font-medium text-[var(--color-ink-muted)] mb-1"
                  >
                    Email Address
                  </label>
                  <input
                    id="classifieds-sub-email"
                    type="email"
                    required
                    maxLength={180}
                    autoComplete="email"
                    inputMode="email"
                    placeholder="you@domain.com"
                    value={subEmail}
                    aria-invalid={Boolean(subEmailError)}
                    aria-describedby={subEmailError ? 'classifieds-sub-email-error' : undefined}
                    onChange={(e) => {
                      const nextVal = e.target.value;
                      setSubEmail(nextVal);
                      if (subNotice) setSubNotice(null);
                      if (subTouched || subEmailError) {
                        setSubEmailError(validateSubscriberEmail(nextVal));
                      }
                    }}
                    onBlur={() => {
                      if (subEmail.trim().length > 0 || subTouched) {
                        setSubTouched(true);
                        setSubEmailError(validateSubscriberEmail(subEmail));
                      }
                    }}
                    className={`w-full border bg-[var(--color-paper)] px-3 py-2 text-xs text-[var(--color-ink)] focus:outline-2 focus:outline-[var(--color-press-red)] ${
                      subEmailError
                        ? 'border-[var(--color-press-red)]'
                        : 'border-[var(--color-rule)]'
                    }`}
                  />
                  {subEmailError && (
                    <p
                      id="classifieds-sub-email-error"
                      role="alert"
                      className="mt-1 text-[11px] text-[var(--color-press-red)]"
                    >
                      {subEmailError}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[11px] font-mono text-[var(--color-ink-subtle)]">
                  Daily 07:00 UTC Edition · Morning Dispatch
                </span>
                <button
                  type="submit"
                  disabled={submittingSub}
                  className="inline-flex items-center gap-2 bg-[var(--color-press-red)] px-4 py-2 text-xs font-medium text-[#FCF9F5] hover:bg-[#701D16] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{submittingSub ? 'Subscribing…' : 'Subscribe to Digest'}</span>
                </button>
              </div>
            </form>

            {subNotice && (
              <div className="border-t border-[var(--color-rule)] pt-2.5 flex flex-wrap items-start justify-between gap-2 text-xs">
                <div className="flex items-start gap-2">
                  {subNotice.ok && (
                    <CheckCircle2
                      className="h-4 w-4 text-[var(--color-press-red)] shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                  )}
                  <span className={subNotice.ok ? 'text-[var(--color-ink)]' : 'text-[var(--color-press-red)]'}>
                    {subNotice.text}
                  </span>
                </div>
                {subPreviewHtml && (
                  <button
                    type="button"
                    onClick={() => setShowSubPreview((prev) => !prev)}
                    className="text-xs underline underline-offset-4 text-[var(--color-press-red)] hover:text-[var(--color-ink)] cursor-pointer shrink-0"
                  >
                    {showSubPreview ? 'Hide Sample Edition' : 'Preview Sample Edition'}
                  </button>
                )}
              </div>
            )}

            {showSubPreview && subPreviewHtml && (
              <iframe
                title="Kalyan Chronicle Digest Preview"
                sandbox=""
                srcDoc={subPreviewHtml}
                className="w-full h-64 border border-[var(--color-rule)] bg-white"
              />
            )}
          </div>
        </div>

        <footer className="lg:col-span-5 space-y-5 print-avoid-break">
          <figure>
            <NewspaperImage
              src="/assets/aistudio/file_0000000014488211bc6f30b8fdbf6bda_e26db9b0.webp"
              alt="Portrait of Saragadam Kalyan, AI Engineer and Full-Stack Developer"
              aspectClass="aspect-[4/4]"
              imgClassName="object-cover object-top"
              caption="Fig. 6 — Publisher & Systems Author: Saragadam Kalyan."
            />
          </figure>

          {/* Scannable QR Reader Dossier Card */}
          <div className="border border-[var(--color-rule-strong)] bg-[var(--color-paper-surface)] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-rule)] pb-2.5">
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-[var(--color-press-red)] font-medium">
                <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Scannable Digital Dossier</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onOpenQuickDossier();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="no-print text-xs underline underline-offset-4 text-[var(--color-ink-muted)] hover:text-[var(--color-press-red)] cursor-pointer"
              >
                Preview Scan View ↑
              </button>
            </div>

            <BroadsheetQrCode
              url={activeQr.url}
              size={104}
              label={activeQr.label}
              sublabel={activeQr.sublabel}
            />

            <div className="no-print flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-[var(--color-rule)] pt-3 text-xs">
              {(Object.keys(qrTargets) as QrTargetKey[]).map((key) => {
                const selected = key === qrTarget;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setQrTarget(key)}
                    className={`cursor-pointer underline-offset-4 transition-colors ${
                      selected
                        ? 'font-semibold text-[var(--color-press-red)] underline'
                        : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
                    }`}
                  >
                    {qrTargets[key].buttonLabel}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border border-[var(--color-rule-strong)] bg-[var(--color-paper-surface)] p-5 space-y-4">
            <div className="flex items-center justify-between gap-4 border-b border-[var(--color-rule)] pb-3">
              <div>
                <p className="text-xs uppercase tracking-widest text-[var(--color-press-red)] font-medium">
                  Colophon &amp; Correspondence
                </p>
                <h3 className="font-display text-xl font-bold text-[var(--color-ink)] mt-0.5">
                  {KALYAN_PROFILE.name}
                </h3>
              </div>
              <div className="relative h-12 w-12 shrink-0 overflow-hidden border border-[var(--color-rule)] bg-[var(--color-paper-alt)]">
                {!sealLoaded && (
                  <div
                    aria-hidden="true"
                    className="no-print absolute inset-0 bg-[var(--color-rule)]/50 animate-pulse"
                  />
                )}
                <img
                  src={publicAssetUrl('/assets/aistudio/1794827712607_4847db64.webp')}
                  alt="Kalyan With AI brand seal"
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onLoad={() => setSealLoaded(true)}
                  onError={() => setSealLoaded(true)}
                  className={`h-full w-full object-contain transition-opacity duration-300 ${
                    sealLoaded ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              </div>
            </div>

            <p className="text-sm text-[var(--color-ink-muted)] leading-relaxed">
              Printed and assembled as a live web broadsheet uniting GitHub telemetry, Substack essays, verified certificates, and daily updated engineering systems.
            </p>
            <dl className="divide-y divide-[var(--color-rule)] text-xs pt-1">
              <div className="flex justify-between py-1.5 gap-3">
                <dt className="text-[var(--color-ink-muted)]">Direct Email</dt>
                <dd className="font-mono text-[var(--color-ink)]">{KALYAN_PROFILE.email}</dd>
              </div>
              {KALYAN_PROFILE.links.map((link) => (
                <div key={link.label} className="flex justify-between py-1.5 gap-3">
                  <dt className="text-[var(--color-ink-muted)]">{link.label}</dt>
                  <dd>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-[var(--color-ink)] underline underline-offset-2 hover:text-[var(--color-press-red)]"
                    >
                      {link.handle}
                    </a>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </footer>
      </div>

      {/* Final Larger Footer QR Code — Chronicle Archives */}
      <div
        id="final-qr-code"
        className="mt-10 border-2 border-[var(--color-rule-strong)] bg-[var(--color-paper-surface)] p-6 print-avoid-break"
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-press-red)] font-semibold">
              Chronicle Archives · Complete Digital Edition &amp; Verified Portfolio
            </p>
            <h3 className="font-display text-2xl sm:text-3xl font-bold text-[var(--color-ink)]">
              Chronicle Archives: Scan for the Entire Newspaper, Projects, LinkedIn &amp; {VERIFIED_CERTIFICATES.length} Certificates
            </h3>
            <p className="text-sm text-[var(--color-ink-muted)] leading-relaxed">
              Scanning the <strong>Chronicle Archives</strong> QR opens the full hosted edition of <strong>The Kalyan Chronicle</strong> in Dossier mode with instant links to Saragadam Kalyan’s portfolios (<span className="font-mono text-xs">kalyannexus.vercel.app</span>, <span className="font-mono text-xs">kalyanportfolio-five.vercel.app</span>, <span className="font-mono text-xs">kalyanhub.netlify.app</span>), LinkedIn (<span className="font-mono text-xs">in/saragadamkalyan</span>), GitHub (<span className="font-mono text-xs">kalyan870</span>), highlighted projects, all {VERIFIED_CERTIFICATES.length} verified certificates, and every section archive.
            </p>
          </div>

          <div className="shrink-0 border border-[var(--color-rule)] bg-[var(--color-paper)] p-3.5">
            <BroadsheetQrCode
              url={scanDossierUrl}
              size={156}
              label="Chronicle Archives"
              sublabel="Entire Newspaper + Portfolio + LinkedIn + Projects + Certificates"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
