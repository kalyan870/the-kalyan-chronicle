import {
  ENGINEERING_DESKS,
  FEATURED_PROJECTS,
  KALYAN_PROFILE,
  WORKFLOW_TRANSFORMATIONS,
  type CommitEntry,
  type SubstackPost,
} from '../data/chronicleData.ts';
import { toSafeExternalHref } from '../utils/safeUrl.ts';

export interface NewsletterInput {
  editionTitle: string;
  editionDate: string;
  editorNote: string;
  publicRepos: number;
  commits: CommitEntry[];
  substackPosts: SubstackPost[];
  unsubscribeUrl?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildBroadsheetNewsletterHtml(input: NewsletterInput): string {
  const totalBefore = WORKFLOW_TRANSFORMATIONS.reduce((sum, r) => sum + r.minutesBefore, 0);
  const totalAfter = WORKFLOW_TRANSFORMATIONS.reduce((sum, r) => sum + r.minutesAfter, 0);
  const savedHours = ((totalBefore - totalAfter) / 60).toFixed(1);

  const deskRows = ENGINEERING_DESKS.map(
    (desk) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #cfc7b6;font-size:13px;vertical-align:top;">
          <strong style="color:#161513;">${escapeHtml(desk.index)}. ${escapeHtml(desk.name)}</strong><br/>
          <span style="color:#524e46;font-size:12px;">${escapeHtml(desk.scope)}</span>
        </td>
        <td style="padding:8px 0 8px 12px;border-bottom:1px solid #cfc7b6;font-family:monospace;font-size:12px;color:#8b261d;text-align:right;white-space:nowrap;vertical-align:top;">
          ${escapeHtml(desk.dailyTimeBefore)} &rarr; ${escapeHtml(desk.dailyTimeAfter)}
        </td>
      </tr>`
  ).join('');

  const commitItems = input.commits
    .slice(0, 5)
    .map(
      (c) => `
      <li style="margin-bottom:10px;">
        <span style="font-family:monospace;font-size:12px;color:#8b261d;font-weight:bold;">${escapeHtml(c.sha)}</span>
        <span style="font-size:12px;color:#524e46;"> &middot; ${escapeHtml(c.repo)} (${escapeHtml(c.date)})</span><br/>
        <a href="${escapeHtml(toSafeExternalHref(c.url, 'https://github.com/kalyan870'))}" style="color:#161513;text-decoration:none;font-size:13px;">${escapeHtml(c.message)}</a>
      </li>`
    )
    .join('');

  const substackItems = input.substackPosts
    .slice(0, 3)
    .map(
      (p) => `
      <li style="margin-bottom:12px;">
        <a href="${escapeHtml(toSafeExternalHref(p.link, 'https://saragadamkalyan.substack.com/'))}" style="color:#8b261d;font-weight:bold;font-size:14px;text-decoration:none;">${escapeHtml(p.title)}</a>
        <div style="font-size:11px;color:#756f64;font-family:monospace;margin:2px 0;">${escapeHtml(p.publishedAt)}</div>
        <div style="font-size:13px;color:#524e46;line-height:1.45;">${escapeHtml(p.excerpt)}</div>
      </li>`
    )
    .join('');

  const workflowRows = WORKFLOW_TRANSFORMATIONS.map(
    (row) => `
      <tr>
        <td style="padding:7px 8px 7px 0;border-bottom:1px solid #cfc7b6;font-size:12px;color:#161513;">
          <strong>${escapeHtml(row.task)}</strong><br/>
          <span style="color:#524e46;">${escapeHtml(row.kalyanSystem)}</span>
        </td>
        <td style="padding:7px 0 7px 8px;border-bottom:1px solid #cfc7b6;font-family:monospace;font-size:12px;text-align:right;white-space:nowrap;vertical-align:top;">
          <span style="color:#756f64;text-decoration:line-through;">${row.minutesBefore}m</span>
          <strong style="color:#8b261d;margin-left:4px;">${row.minutesAfter}m</strong>
        </td>
      </tr>`
  ).join('');

  const projectSummary = FEATURED_PROJECTS.slice(0, 4)
    .map(
      (proj) =>
        `<li style="margin-bottom:8px;font-size:13px;"><strong>${escapeHtml(proj.title)}</strong> (${escapeHtml(proj.kicker)}) &mdash; ${escapeHtml(proj.summary)}</li>`
    )
    .join('');

  const footerLinks = KALYAN_PROFILE.links
    .map(
      (link) =>
        `<a href="${escapeHtml(toSafeExternalHref(link.url, 'https://github.com/kalyan870'))}" style="color:#8b261d;text-decoration:underline;margin-right:12px;">${escapeHtml(link.label)}</a>`
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(input.editionTitle)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f7f3ea;color:#161513;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f3ea;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="660" cellpadding="0" cellspacing="0" style="max-width:660px;width:100%;background-color:#fcfaf4;border:1px solid #2b2925;padding:28px;">
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #cfc7b6;padding-bottom:8px;font-family:monospace;font-size:11px;color:#524e46;">
                <tr>
                  <td align="left">Vol. IV &middot; No. 11 &middot; Broadsheet Dispatch</td>
                  <td align="center">${escapeHtml(input.editionDate)}</td>
                  <td align="right">${input.publicRepos} Public Repos</td>
                </tr>
              </table>

              <div style="text-align:center;border-top:3px double #2b2925;border-bottom:1px solid #2b2925;padding:18px 0;margin-top:8px;">
                <div style="font-size:11px;letter-spacing:2.5px;text-transform:uppercase;color:#8b261d;font-weight:bold;">
                  Special Engineering Monograph
                </div>
                <h1 style="margin:6px 0 4px;font-size:32px;line-height:1.1;letter-spacing:-0.5px;color:#161513;">
                  THE KALYAN CHRONICLE
                </h1>
                <div style="font-size:13px;font-style:italic;color:#524e46;">
                  ${escapeHtml(input.editionTitle)} &middot; ${escapeHtml(KALYAN_PROFILE.name)} (${escapeHtml(KALYAN_PROFILE.headline)})
                </div>
              </div>

              ${
                input.editorNote
                  ? `<div style="margin-top:16px;padding:12px 14px;background-color:#efe9dc;border:1px solid #cfc7b6;font-size:13px;line-height:1.5;">
                      <strong style="color:#8b261d;text-transform:uppercase;font-size:11px;letter-spacing:1px;">Editor Note:</strong>
                      <span> ${escapeHtml(input.editorNote)}</span>
                    </div>`
                  : ''
              }

              <div style="margin-top:20px;">
                <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#8b261d;font-weight:bold;">
                  Lead Feature &middot; Five-Desk Execution
                </div>
                <h2 style="margin:4px 0 10px;font-size:22px;line-height:1.2;color:#161513;">
                  Kalyan’s Engineering Systems &amp; Daily Workflow Shift
                </h2>
                <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#161513;">
                  Built on Vignan B.Tech CSE foundations and scaled into GenAI, Hybrid RAG, FastAPI/Express, and Agentic workflows, your unified architecture compresses <strong>${totalBefore} min/day</strong> of manual engineering friction down to <strong>${totalAfter} min/day</strong>&mdash;reclaiming <strong>${savedHours} hours</strong> every day for deep build cycles.
                </p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #2b2925;">
                  ${deskRows}
                </table>
              </div>

              <div style="margin-top:24px;">
                <h3 style="margin:0 0 10px;font-size:17px;border-bottom:2px solid #2b2925;padding-bottom:4px;color:#161513;">
                  GitHub Commit Wire (${escapeHtml(KALYAN_PROFILE.links[0].handle)})
                </h3>
                <ul style="margin:0;padding-left:18px;line-height:1.5;">
                  ${commitItems}
                </ul>
              </div>

              <div style="margin-top:22px;">
                <h3 style="margin:0 0 10px;font-size:17px;border-bottom:2px solid #2b2925;padding-bottom:4px;color:#161513;">
                  Substack Dispatches (saragadamkalyan.substack.com)
                </h3>
                <ul style="margin:0;padding-left:18px;line-height:1.5;">
                  ${substackItems}
                </ul>
              </div>

              <div style="margin-top:22px;">
                <h3 style="margin:0 0 8px;font-size:17px;border-bottom:2px solid #2b2925;padding-bottom:4px;color:#161513;">
                  Daily Efficiency Ledger (${totalBefore}m &rarr; ${totalAfter}m)
                </h3>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${workflowRows}
                </table>
              </div>

              <div style="margin-top:22px;">
                <h3 style="margin:0 0 8px;font-size:17px;border-bottom:2px solid #2b2925;padding-bottom:4px;color:#161513;">
                  Featured Systems &amp; Package Audit Highlights
                </h3>
                <ul style="margin:0;padding-left:18px;line-height:1.5;">
                  ${projectSummary}
                </ul>
                <p style="margin:10px 0 0;font-size:12px;color:#524e46;line-height:1.5;">
                  <strong>Credentials &amp; Dossier:</strong> Includes 12 verified certificates (Databricks GenAI, AWS Claude Prompt Engineering, Anthropic Claude 101, Google Cloud Gen AI Academy, Forage Tata/Deloitte, HCL GUVI), LinkedIn, GitHub, and live portfolios via QR scan.
                </p>
                <p style="margin:8px 0 0;font-size:12px;color:#524e46;line-height:1.5;">
                  <strong>Editorial Standards:</strong> Verified engineering dispatches, daily project updates, and morning broadsheet editions.
                </p>
              </div>

              <div style="margin-top:24px;padding-top:14px;border-top:2px solid #2b2925;font-size:12px;color:#524e46;">
                <div style="margin-bottom:6px;">
                  <strong>Colophon:</strong> The Kalyan Chronicle &middot; ${escapeHtml(KALYAN_PROFILE.location)}
                </div>
                <div>${footerLinks}</div>
                ${
                  input.unsubscribeUrl
                    ? `<div style="margin-top:10px;font-size:11px;color:#756f64;">
                        Prefer fewer emails? <a href="${escapeHtml(toSafeExternalHref(input.unsubscribeUrl, '#top'))}" style="color:#8b261d;text-decoration:underline;">Unsubscribe from daily digests</a>.
                      </div>`
                    : ''
                }
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildBroadsheetNewsletterText(input: NewsletterInput): string {
  const totalBefore = WORKFLOW_TRANSFORMATIONS.reduce((sum, r) => sum + r.minutesBefore, 0);
  const totalAfter = WORKFLOW_TRANSFORMATIONS.reduce((sum, r) => sum + r.minutesAfter, 0);
  const savedHours = ((totalBefore - totalAfter) / 60).toFixed(1);

  return [
    `THE KALYAN CHRONICLE — ${input.editionTitle}`,
    `${input.editionDate} | ${input.publicRepos} Public GitHub Repos`,
    input.editorNote ? `Editor Note: ${input.editorNote}` : '',
    '',
    `WORKFLOW EFFICIENCY SHIFT: ${totalBefore} min/day -> ${totalAfter} min/day (${savedHours} hrs/day reclaimed)`,
    '',
    'RECENT GITHUB COMMITS:',
    ...input.commits.slice(0, 5).map((c) => `- [${c.sha}] ${c.repo}: ${c.message}`),
    '',
    'SUBSTACK DISPATCHES:',
    ...input.substackPosts.slice(0, 3).map((p) => `- ${p.title} (${p.link})`),
    '',
    'PROFILE LINKS:',
    ...KALYAN_PROFILE.links.map((l) => `- ${l.label}: ${l.url}`),
    input.unsubscribeUrl ? '' : '',
    input.unsubscribeUrl ? `UNSUBSCRIBE: ${input.unsubscribeUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
