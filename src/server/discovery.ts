import {
  CAREER_HISTORY,
  FEATURED_PROJECTS,
  KALYAN_PROFILE,
  VERIFIED_CERTIFICATES,
  WORKFLOW_TRANSFORMATIONS,
  type CommitEntry,
  type ProjectDispatch,
  type SubstackPost,
} from '../data/chronicleData.ts';

export interface DiscoveryDigestInput {
  fetchedAt: string;
  profile: {
    login: string;
    name: string;
    bio: string;
    publicRepos: number;
    htmlUrl: string;
  };
  latestProjects: ProjectDispatch[];
  commits: CommitEntry[];
  substackPosts: SubstackPost[];
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildLlmsTxt(digest: DiscoveryDigestInput, baseUrl: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const projects = digest.latestProjects.length > 0 ? digest.latestProjects : FEATURED_PROJECTS;

  const lines: string[] = [
    `# ${KALYAN_PROFILE.name} — The Kalyan Chronicle`,
    '',
    `> ${KALYAN_PROFILE.headline} (${KALYAN_PROFILE.location}). Live engineering broadsheet covering practical GenAI, Hybrid RAG, agentic systems, computer vision, and full-stack web architecture.`,
    '',
    '## Engineer Profile',
    `- Name: ${KALYAN_PROFILE.name}`,
    `- GitHub: ${digest.profile.htmlUrl} (${digest.profile.publicRepos} public repositories)`,
    `- Email: ${KALYAN_PROFILE.email}`,
    ...KALYAN_PROFILE.links.map((l) => `- ${l.label}: ${l.url}`),
    '',
    '## Machine-Readable Endpoints',
    `- JSON Feed 1.1: ${cleanBase}/feed.json`,
    `- RSS 2.0 Feed: ${cleanBase}/rss.xml`,
    `- Live Digest JSON: ${cleanBase}/api/digest`,
    `- Read-Only MCP Endpoint (JSON-RPC 2.0): ${cleanBase}/api/mcp`,
    `- Dynamic OpenGraph Broadsheet Card: ${cleanBase}/api/og`,
    '',
    '## Experience & Education',
    ...CAREER_HISTORY.map(
      (c) => `- **${c.role}** — ${c.company} (${c.period}, ${c.location}): ${c.focus}`
    ),
    '',
    '## Featured & Recently Synced Projects',
    ...projects.map(
      (p) =>
        `- **${p.title}** [${p.stack.join(', ')}]: ${p.summary} Architecture: ${p.architectureNote} (${p.liveUrl || p.repoUrl})`
    ),
    '',
    '## Daily Workflow Impact',
    ...WORKFLOW_TRANSFORMATIONS.map(
      (w) =>
        `- ${w.task} (${w.category}): ${w.minutesBefore} min/day -> ${w.minutesAfter} min/day via ${w.mechanism}`
    ),
    '',
    `## Verified Industry Credentials (${VERIFIED_CERTIFICATES.length})`,
    ...VERIFIED_CERTIFICATES.map(
      (cert) => `- ${cert.title} — ${cert.issuer} (${cert.date}) [${cert.url}]`
    ),
    '',
    '## Latest Substack Technical Notes',
    ...digest.substackPosts.map(
      (post) => `- [${post.title}](${post.link}) (${post.publishedAt}): ${post.excerpt}`
    ),
    '',
  ];

  return lines.join('\n');
}

export function buildJsonFeed(digest: DiscoveryDigestInput, baseUrl: string) {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const projects = digest.latestProjects.length > 0 ? digest.latestProjects : FEATURED_PROJECTS;

  const postItems = digest.substackPosts.map((post, idx) => ({
    id: post.link || `substack-${idx}`,
    url: post.link,
    title: `Essay: ${post.title}`,
    summary: post.excerpt,
    content_text: post.excerpt,
    date_published: new Date(post.publishedAt).toString() !== 'Invalid Date'
      ? new Date(post.publishedAt).toISOString()
      : digest.fetchedAt,
    tags: ['substack', 'ai-engineering'],
  }));

  const projectItems = projects.map((proj) => ({
    id: `${cleanBase}/#project-${proj.id}`,
    url: proj.liveUrl || proj.repoUrl,
    title: `Project: ${proj.title}`,
    summary: proj.summary,
    content_text: `${proj.summary} Architecture: ${proj.architectureNote} Stack: ${proj.stack.join(', ')}.`,
    date_published: digest.fetchedAt,
    tags: proj.stack.map((s) => s.toLowerCase()),
  }));

  return {
    version: 'https://jsonfeed.org/version/1.1',
    title: 'The Kalyan Chronicle — Engineering Broadsheet',
    home_page_url: cleanBase,
    feed_url: `${cleanBase}/feed.json`,
    description:
      'Daily engineering broadsheet, AI architecture notes, live GitHub commits, and verified projects by Saragadam Kalyan.',
    authors: [
      {
        name: KALYAN_PROFILE.name,
        url: digest.profile.htmlUrl,
      },
    ],
    language: 'en-US',
    items: [...postItems, ...projectItems].slice(0, 15),
  };
}

export function buildRssFeed(digest: DiscoveryDigestInput, baseUrl: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const jsonFeed = buildJsonFeed(digest, cleanBase);
  const lastBuild = new Date(digest.fetchedAt).toUTCString();

  const itemsXml = jsonFeed.items
    .map((item) => {
      const pubDate = new Date(item.date_published).toUTCString();
      return [
        '    <item>',
        `      <title>${escapeXml(item.title)}</title>`,
        `      <link>${escapeXml(item.url)}</link>`,
        `      <guid isPermaLink="false">${escapeXml(item.id)}</guid>`,
        `      <pubDate>${escapeXml(pubDate)}</pubDate>`,
        `      <description>${escapeXml(item.content_text)}</description>`,
        '    </item>',
      ].join('\n');
    })
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    '    <title>The Kalyan Chronicle — Engineering Broadsheet</title>',
    `    <link>${escapeXml(cleanBase)}</link>`,
    `    <atom:link href="${escapeXml(`${cleanBase}/rss.xml`)}" rel="self" type="application/rss+xml" />`,
    '    <description>Daily AI engineering broadsheet, Hybrid RAG systems, and live project dispatches by Saragadam Kalyan.</description>',
    '    <language>en-us</language>',
    `    <lastBuildDate>${escapeXml(lastBuild)}</lastBuildDate>`,
    itemsXml,
    '  </channel>',
    '</rss>',
  ].join('\n');
}

export function buildBroadsheetOgSvg(digest: DiscoveryDigestInput): string {
  const editionDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const topProjects = (digest.latestProjects.length > 0 ? digest.latestProjects : FEATURED_PROJECTS)
    .slice(0, 3)
    .map((p) => p.title);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="The Kalyan Chronicle Engineering Broadsheet">
  <rect width="1200" height="630" fill="#f7f3ea"/>
  <rect x="28" y="28" width="1144" height="574" fill="#fcfaf4" stroke="#2b2925" stroke-width="2"/>
  <line x1="56" y1="84" x2="1144" y2="84" stroke="#2b2925" stroke-width="3"/>
  <line x1="56" y1="90" x2="1144" y2="90" stroke="#2b2925" stroke-width="1"/>
  <text x="56" y="68" font-family="ui-monospace, monospace" font-size="16" fill="#524e46">VOL. IV · NO. 11 · ENGINEERING MONOGRAPH</text>
  <text x="1144" y="68" text-anchor="end" font-family="ui-monospace, monospace" font-size="16" fill="#524e46">${escapeXml(editionDate.toUpperCase())}</text>
  <text x="56" y="138" font-family="ui-monospace, monospace" font-size="15" font-weight="600" letter-spacing="3" fill="#8b261d">AI ENGINEERING · HYBRID RAG · FULL-STACK SYSTEMS</text>
  <text x="56" y="218" font-family="Georgia, 'Times New Roman', serif" font-size="68" font-weight="800" fill="#161513">THE KALYAN CHRONICLE</text>
  <text x="56" y="264" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="24" fill="#524e46">Live broadsheet portfolio, daily project dispatches &amp; engineering workbench by ${escapeXml(KALYAN_PROFILE.name)}</text>
  <line x1="56" y1="296" x2="1144" y2="296" stroke="#cfc7b6" stroke-width="1.5"/>
  <rect x="56" y="324" width="340" height="190" fill="#f7f3ea" stroke="#2b2925" stroke-width="1.5"/>
  <text x="76" y="362" font-family="ui-monospace, monospace" font-size="13" fill="#8b261d" font-weight="600">LEAD DISPATCH</text>
  <text x="76" y="402" font-family="Georgia, serif" font-size="26" font-weight="700" fill="#161513">${escapeXml((topProjects[0] || 'InterviewIQ AI').slice(0, 26))}</text>
  <text x="76" y="442" font-family="Georgia, serif" font-size="17" fill="#524e46">Production AI architecture, retrieval</text>
  <text x="76" y="468" font-family="Georgia, serif" font-size="17" fill="#524e46">evals &amp; grounded RAG press lookups.</text>
  <rect x="424" y="324" width="340" height="190" fill="#f7f3ea" stroke="#2b2925" stroke-width="1.5"/>
  <text x="444" y="362" font-family="ui-monospace, monospace" font-size="13" fill="#8b261d" font-weight="600">FEATURED SYSTEMS</text>
  <text x="444" y="402" font-family="Georgia, serif" font-size="22" font-weight="700" fill="#161513">${escapeXml((topProjects[1] || 'Enterprise Hybrid RAG').slice(0, 28))}</text>
  <text x="444" y="444" font-family="Georgia, serif" font-size="22" font-weight="700" fill="#161513">${escapeXml((topProjects[2] || 'Environmental Risk').slice(0, 28))}</text>
  <text x="444" y="484" font-family="ui-monospace, monospace" font-size="14" fill="#524e46">MCP · JSON Feed · Trace &amp; Eval Studio</text>
  <rect x="792" y="324" width="352" height="190" fill="#161513"/>
  <text x="816" y="362" font-family="ui-monospace, monospace" font-size="13" fill="#e5d9c3">EDITION TELEMETRY</text>
  <text x="816" y="418" font-family="Georgia, serif" font-size="42" font-weight="700" fill="#fcfaf4">${digest.profile.publicRepos} Repos</text>
  <text x="816" y="458" font-family="ui-monospace, monospace" font-size="16" fill="#cfc7b6">${digest.commits.length} Live Commits · ${VERIFIED_CERTIFICATES.length} Verified Certs</text>
  <text x="816" y="490" font-family="ui-monospace, monospace" font-size="14" fill="#d97757">/llms.txt · /feed.json · /api/mcp</text>
  <line x1="56" y1="544" x2="1144" y2="544" stroke="#2b2925" stroke-width="1"/>
  <text x="56" y="576" font-family="ui-monospace, monospace" font-size="15" fill="#524e46">github.com/kalyan870 · saragadamkalyan.substack.com · Vignan VIIT CSE</text>
  <text x="1144" y="576" text-anchor="end" font-family="ui-monospace, monospace" font-size="15" font-weight="600" fill="#8b261d">PRINTABLE PWA EDITION</text>
</svg>`;
}

export function buildRobotsTxt(baseUrl: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/storage/',
    '',
    `Sitemap: ${cleanBase}/sitemap.xml`,
    `# AI Agent Context: ${cleanBase}/llms.txt`,
    `# A2A Agent Card: ${cleanBase}/.well-known/agent-card.json`,
    '',
  ].join('\n');
}

export function buildSitemapXml(baseUrl: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const nowIso = new Date().toISOString();
  const urls = [
    { loc: `${cleanBase}/`, priority: '1.0', changefreq: 'daily' },
    { loc: `${cleanBase}/?dossier=scan`, priority: '0.8', changefreq: 'daily' },
    { loc: `${cleanBase}/llms.txt`, priority: '0.7', changefreq: 'daily' },
    { loc: `${cleanBase}/feed.json`, priority: '0.7', changefreq: 'daily' },
    { loc: `${cleanBase}/rss.xml`, priority: '0.7', changefreq: 'daily' },
    { loc: `${cleanBase}/.well-known/agent-card.json`, priority: '0.6', changefreq: 'weekly' },
    { loc: `${cleanBase}/openapi.json`, priority: '0.6', changefreq: 'weekly' },
  ];

  const entries = urls
    .map(
      (u) =>
        `  <url>\n    <loc>${escapeXml(u.loc)}</loc>\n    <lastmod>${escapeXml(nowIso)}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
    )
    .join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    '</urlset>',
  ].join('\n');
}

export function buildOpenApiSpec(baseUrl: string) {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  return {
    openapi: '3.1.0',
    info: {
      title: 'The Kalyan Chronicle API',
      version: '1.0.0',
      summary:
        'Live engineering broadsheet, SSE RAG stream, read-only MCP tools, A2A agent card, and developer trace/eval workbench APIs.',
      contact: {
        name: KALYAN_PROFILE.name,
        email: KALYAN_PROFILE.email,
      },
    },
    servers: [{ url: cleanBase }],
    paths: {
      '/healthz/live': {
        get: { summary: 'Process liveness check', responses: { '200': { description: 'UP' } } },
      },
      '/healthz/ready': {
        get: {
          summary: 'Backend readiness check (storage & digest)',
          responses: { '200': { description: 'READY' }, '503': { description: 'NOT_READY' } },
        },
      },
      '/api/digest': {
        get: { summary: 'Fetch live synced GitHub & Substack broadsheet digest', responses: { '200': { description: 'Digest JSON' } } },
      },
      '/api/rag/query': {
        post: { summary: 'Grounded RAG query with persistent session memory', responses: { '200': { description: 'Grounded answer + citations + telemetry' } } },
      },
      '/api/rag/stream': {
        post: { summary: 'Server-Sent Events (SSE) streaming RAG inquiry endpoint', responses: { '200': { description: 'text/event-stream token chunks' } } },
      },
      '/api/mcp': {
        get: { summary: 'Read-only MCP tool descriptor', responses: { '200': { description: 'MCP tool list' } } },
        post: { summary: 'Execute read-only MCP tool via JSON-RPC 2.0', responses: { '200': { description: 'JSON-RPC 2.0 result' } } },
      },
      '/.well-known/agent-card.json': {
        get: { summary: 'A2A Agent Card metadata', responses: { '200': { description: 'Agent Card JSON' } } },
      },
      '/a2a/v1': {
        post: { summary: 'A2A JSON-RPC message/send & SSE message/stream endpoint', responses: { '200': { description: 'A2A JSON or SSE stream' } } },
      },
      '/api/workbench/trace-audit': {
        post: { summary: 'Audit agent/RAG OpenTelemetry spans for silent tool failures', responses: { '200': { description: 'Diagnostic report' } } },
      },
      '/api/workbench/eval-matrix': {
        post: { summary: 'Compare baseline vs candidate RAG recall and generate PR Markdown diff', responses: { '200': { description: 'Eval diff matrix' } } },
      },
    },
  };
}
