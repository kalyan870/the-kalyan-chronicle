export interface EngineerProfile {
  name: string;
  headline: string;
  location: string;
  email: string;
  links: {
    label: string;
    url: string;
    handle: string;
  }[];
  bundleStats: {
    codeOnlyFiles: number;
    codeOnlySize: string;
    fullFiles: number;
    fullSize: string;
  };
}

export interface EngineeringDesk {
  index: string;
  name: string;
  scope: string;
  howDevsExecute: string;
  dailyTimeBefore: string;
  dailyTimeAfter: string;
  keyModules: string[];
}

export interface WorkflowRow {
  id: string;
  task: string;
  category: 'Architecture' | 'AI & Retrieval' | 'Delivery & Ops' | 'Writing & Sync';
  legacyManual: string;
  kalyanSystem: string;
  minutesBefore: number;
  minutesAfter: number;
  mechanism: string;
}

export interface ProjectDispatch {
  id: string;
  title: string;
  kicker: string;
  highlighted?: boolean;
  summary: string;
  architectureNote: string;
  stack: string[];
  repoUrl: string;
  liveUrl?: string;
}

export interface CertificateEntry {
  id: string;
  title: string;
  issuer: string;
  date: string;
  code: string;
  url: string;
}

export interface CommitEntry {
  sha: string;
  repo: string;
  message: string;
  date: string;
  url: string;
}

export interface SubstackPost {
  title: string;
  link: string;
  publishedAt: string;
  excerpt: string;
  source: 'live' | 'archive';
}

export interface PackageFinding {
  id: string;
  packageName: string;
  currentVersion: string;
  category: 'Version & Compatibility' | 'Security Hardening' | 'DX & Performance';
  severity: 'High' | 'Moderate' | 'Advisory';
  issue: string;
  recommendation: string;
  workflowImpact: string;
}

export interface PackageAuditReport {
  projectName: string;
  analyzedAt: string;
  totalDependencies: number;
  totalDevDependencies: number;
  summary: string;
  aiCommentary?: string;
  findings: PackageFinding[];
  suggestedScripts: Record<string, string>;
}

export interface SavedEditionRecord {
  key: string;
  title: string;
  savedAt: string;
  savedBy: string;
  storageBackend: 'cloudflare-r2' | 'local-archive';
  repoCount: number;
  commitCount: number;
  notes?: string;
}

export const KALYAN_PROFILE: EngineerProfile = {
  name: 'Saragadam Kalyan',
  headline: 'AI Engineer & Full-Stack Developer',
  location: 'Visakhapatnam · Vignan VIIT CSE ’28',
  email: 'saragadamkalyan068@gmail.com',
  links: [
    {
      label: 'GitHub',
      url: 'https://github.com/kalyan870',
      handle: 'github.com/kalyan870',
    },
    {
      label: 'LinkedIn',
      url: 'https://www.linkedin.com/in/saragadamkalyan/',
      handle: 'in/saragadamkalyan',
    },
    {
      label: 'Portfolio (Nexus)',
      url: 'https://kalyannexus.vercel.app/',
      handle: 'kalyannexus.vercel.app',
    },
    {
      label: 'Portfolio (Main)',
      url: 'https://kalyanportfolio-five.vercel.app/',
      handle: 'kalyanportfolio-five.vercel.app',
    },
    {
      label: 'KalyanHub',
      url: 'https://kalyanhub.netlify.app/',
      handle: 'kalyanhub.netlify.app',
    },
    {
      label: 'Substack',
      url: 'https://saragadamkalyan.substack.com/',
      handle: 'saragadamkalyan.substack.com',
    },
  ],
  bundleStats: {
    codeOnlyFiles: 35,
    codeOnlySize: '312 KB',
    fullFiles: 47,
    fullSize: '13.5 MB',
  },
};

export const CAREER_HISTORY = [
  {
    role: 'Artificial Intelligence Intern',
    company: 'Internship Studio',
    period: '2026',
    location: 'Remote',
    focus:
      'Built FaceRecognition-PCA-ANN using Principal Component Analysis (eigenfaces) and an Artificial Neural Network with a live Python and Streamlit interface.',
  },
  {
    role: 'Web Developer Intern',
    company: 'Codec Technologies India',
    period: 'May – Jun 2026',
    location: 'Hyderabad, India',
    focus:
      'Engineered modular web components, client-side state workflows, REST API data bindings, responsive layouts, and cross-browser fixes.',
  },
  {
    role: 'B.Tech CSE ’28 · AI & Full-Stack Builder',
    company: 'Vignan’s Institute of Information Technology',
    period: '2024 – 2028 Track',
    location: 'Visakhapatnam, India',
    focus:
      'Building production GenAI, Hybrid RAG, AI Agents, FastAPI + React/Express systems, and publishing live project decks on KalyanHub, GitHub, and Substack.',
  },
];

export const VERIFIED_CERTIFICATES: CertificateEntry[] = [
  {
    id: 'databricks-genai',
    title: 'Databricks Accredited Generative AI Fundamentals',
    issuer: 'Databricks',
    date: 'Mar 2026',
    code: 'DATABRICKS / 2026',
    url: 'https://drive.google.com/file/d/1XY-rb24OZRL6a5N1jdPKNsp_FUeXTYIR/view?usp=sharing',
  },
  {
    id: 'aws-claude-prompt',
    title: 'Fundamentals of Prompt Engineering with Claude',
    issuer: 'Amazon Web Services (AWS)',
    date: 'Mar 2026',
    code: 'AWS / 2026',
    url: 'https://drive.google.com/file/d/1hhMZx5XdCAviU_fF0R9sPwN_6G_lKIZT/view?usp=sharing',
  },
  {
    id: 'anthropic-claude-101',
    title: 'Claude 101',
    issuer: 'Anthropic',
    date: 'Apr 2026',
    code: 'CLAUDE 101 / 2026',
    url: 'https://drive.google.com/file/d/1FHWuwwUM8QmvwS6w9W6MROI9Kd5lU-vK/view?usp=drivesdk',
  },
  {
    id: 'google-cloud-genai-apac',
    title: 'Google Cloud Gen AI Academy APAC — Cohort 2',
    issuer: 'Hack2skill · Google Cloud',
    date: 'Jun 2026',
    code: 'HACK2SKILL / 2026',
    url: 'https://drive.google.com/file/d/1Bbm1aZMJcL-8mmFuPiZFv8rXR6X7Qln1/view?usp=sharing',
  },
  {
    id: 'tata-forage-genai',
    title: 'Tata — GenAI Powered Data Analytics Job Simulation',
    issuer: 'Forage',
    date: 'Apr 2026',
    code: 'KxJZsEhbvsC9diJMj',
    url: 'https://www.theforage.com/completion-certificates/ifobHAoMjQs9s6bKS/gMTdCXwDdLYoXZ3wG_ifobHAoMjQs9s6bKS_693697c55e7415c2462ac0dd_1777138051289_completion_certificate.pdf',
  },
  {
    id: 'deloitte-forage-tech',
    title: 'Deloitte Technology Job Simulation',
    issuer: 'Forage',
    date: 'Apr 2026',
    code: 'DELOITTE / 2026',
    url: 'https://drive.google.com/file/d/1jJe0vDamZrnRlHlW0zdgaDA6LKRhRMxk/view?usp=drivesdk',
  },
  {
    id: 'guvi-hcl-fullstack',
    title: 'GUVI x HCL Full Stack Development Workshop 2026',
    issuer: 'HCL GUVI',
    date: 'May 2026',
    code: 'GUVI / HCL / 2026',
    url: 'https://drive.google.com/file/d/18aDkbo6LT6y6qtGO_IFM0F_Ta2Vu4QPR/view?usp=sharing',
  },
  {
    id: 'freeacademy-prompt',
    title: 'Prompt Engineering',
    issuer: 'FreeAcademy.ai',
    date: 'Aug 2026',
    code: 'FREEACADEMY / 2026',
    url: 'https://drive.google.com/file/d/1Yux5otqBL-NfW7iSIOaT8_GkL0ae0b-3/view?usp=sharing',
  },
  {
    id: 'growthschool-genai',
    title: 'Generative AI Workshop',
    issuer: 'GrowthSchool',
    date: 'Jul 2026',
    code: 'GROWTHSCHOOL / 2026',
    url: 'https://drive.google.com/file/d/10lIuFuwXhFcnrgYBdKcEZki5rB2LfSWh/view?usp=sharing',
  },
  {
    id: 'freedom-ai-masterclass',
    title: 'AI Masterclass',
    issuer: 'Freedom With AI',
    date: 'Apr 2026',
    code: 'AI MASTERCLASS / 2026',
    url: 'https://drive.google.com/file/d/1D5N83OcCowYj0BwTt3RWjFwKpxiiLrwO/view?usp=drivesdk',
  },
  {
    id: 'guvi-solidworks',
    title: 'SolidWorks Masterclass',
    issuer: 'HCL GUVI',
    date: 'May 2026',
    code: '6j77W3iv7H139741nR',
    url: 'https://www.guvi.in/share-certificate/6j77W3iv7H139741nR',
  },
  {
    id: 'aincat-2026',
    title: 'AINCAT 2026 — Certificate of Participation',
    issuer: 'Naukri Campus',
    date: 'Jun 2026',
    code: 'AINCAT / 2026',
    url: 'https://drive.google.com/file/d/1Fm8ZuhLqrVrsNTu4CICfgAC0UXx16hY9/view?usp=drivesdk',
  },
];

export const ENGINEERING_DESKS: EngineeringDesk[] = [
  {
    index: '01',
    name: 'Frontend & Editorial Interface Desk',
    scope: 'Component systems, React 19 + Tailwind v4, syntax highlighting',
    howDevsExecute:
      'Developers compose discrete sections (HeroSection, AboutSection, LabVaultSection, FocusDimensions, GitHubActivitySection, BlogSection) driven by a single typed catalog (kalyanData.ts) rather than hardcoding markup per page.',
    dailyTimeBefore: '110 min/day',
    dailyTimeAfter: '25 min/day',
    keyModules: ['HeroSection.tsx', 'LabVaultSection.tsx', 'prismHighlighter.ts', 'kalyanData.ts'],
  },
  {
    index: '02',
    name: 'Dual-Target Server, Security & API Desk',
    scope: 'Unified Express APIs, session validation & request hardening',
    howDevsExecute:
      'Shared routes in src/server/createApp.ts mount cleanly across Express (server.ts) and serverless deployments: enforcing server-side validation, rate limiting, and strict API key isolation.',
    dailyTimeBefore: '95 min/day',
    dailyTimeAfter: '20 min/day',
    keyModules: ['createApp.ts', 'security.ts', 'api/index.ts', 'server.ts'],
  },
  {
    index: '03',
    name: 'Retrieval & LLM Systems Desk',
    scope: 'Hybrid RAG, reranking, FastAPI, @google/genai & Ollama routing',
    howDevsExecute:
      'Engineers isolate model calls behind server-side proxies with deterministic evaluation harnesses—combining lexical + dense vector retrieval with cross-encoder reranking before synthesizing grounded answers.',
    dailyTimeBefore: '80 min/day',
    dailyTimeAfter: '18 min/day',
    keyModules: ['RAG System', '@google/genai', 'FastAPI', 'Customer Feedback Analyzer'],
  },
  {
    index: '04',
    name: 'Autonomous Agents & Vision Desk',
    scope: 'Tool-calling workflows, MediaPipe facial emotion & Risk Dashboards',
    howDevsExecute:
      'Repetitive profile parsing, job-matching triage, environmental sensor telemetry, and real-time MediaPipe vision processing run as structured Python/TypeScript pipelines emitting typed JSON events.',
    dailyTimeBefore: '75 min/day',
    dailyTimeAfter: '15 min/day',
    keyModules: ['AI Job Agent', 'Environmental Risk Dashboard', 'Face Emotion Dashboard'],
  },
  {
    index: '05',
    name: 'Knowledge & Archival Packaging Desk',
    scope: 'Substack publishing, GitHub feed sync, zero-omission bundles',
    howDevsExecute:
      'Technical notes written on Substack and commits pushed to github.com/kalyan870 hydrate the portfolio dynamically, while full-source snapshots (35 code files / 47 total assets) keep handoffs reproducible.',
    dailyTimeBefore: '60 min/day',
    dailyTimeAfter: '12 min/day',
    keyModules: ['BlogSection.tsx', 'GitHubActivitySection.tsx', 'kalyan_portfolio_code_only.json'],
  },
];

export const WORKFLOW_TRANSFORMATIONS: WorkflowRow[] = [
  {
    id: 'wf-1',
    task: 'Morning Context & Architecture Lookup',
    category: 'AI & Retrieval',
    legacyManual: 'Hunting across scattered notebooks, old PR threads, and browser bookmarks.',
    kalyanSystem: 'Querying Hybrid RAG + KalyanHub documentation index with cited source chunks.',
    minutesBefore: 45,
    minutesAfter: 10,
    mechanism: 'Hybrid lexical + semantic retrieval with reranked citations',
  },
  {
    id: 'wf-2',
    task: 'Full-Stack Feature & API Endpoint Delivery',
    category: 'Architecture',
    legacyManual: 'Writing duplicated route glue for local Express vs. cloud serverless deploys.',
    kalyanSystem: 'One shared createApp.ts mounted in server.ts and re-exported in api/index.ts.',
    minutesBefore: 160,
    minutesAfter: 40,
    mechanism: 'Unified Express + serverless deployment contract & typed React sections',
  },
  {
    id: 'wf-3',
    task: 'Auth, Schema & Dependency Security Triage',
    category: 'Delivery & Ops',
    legacyManual: 'Manually checking session tokens, raw SQL drift, and dependency advisories.',
    kalyanSystem: 'Server session validation + typed schemas + automated package.json audit.',
    minutesBefore: 40,
    minutesAfter: 8,
    mechanism: 'Server-only secret boundaries + automated manifest analyzer',
  },
  {
    id: 'wf-4',
    task: 'Interview Prep, ATS Resume & Internship Drills',
    category: 'AI & Retrieval',
    legacyManual: 'Static question lists and manual rubric notes across spreadsheets.',
    kalyanSystem: 'InterviewIQ AI + AI Job Agent parsing resumes, voice drills, and project defense.',
    minutesBefore: 60,
    minutesAfter: 15,
    mechanism: 'Structured rubric evaluation & resume-aware prompt pipelines',
  },
  {
    id: 'wf-5',
    task: 'Environmental Telemetry & Feedback Triage',
    category: 'Delivery & Ops',
    legacyManual: 'Reading raw sensor metrics and user feedback rows line by line.',
    kalyanSystem: 'Environmental Risk Dashboard + Customer Feedback Analyzer sentiment digest.',
    minutesBefore: 45,
    minutesAfter: 12,
    mechanism: 'Real-time risk trend mapping + RAG-grounded root-cause extraction',
  },
  {
    id: 'wf-6',
    task: 'Media Archiving, Digest & Portfolio Sync',
    category: 'Writing & Sync',
    legacyManual: 'Manually uploading assets, updating HTML pages, and pasting weekly updates.',
    kalyanSystem: 'Automated asset pipelines + live GitHub telemetry + Substack feed sync.',
    minutesBefore: 50,
    minutesAfter: 10,
    mechanism: 'Scheduled CI/CD feeds, broadsheet snapshots & RSS synchronization',
  },
];

export const FEATURED_PROJECTS: ProjectDispatch[] = [
  {
    id: 'interviewiq',
    title: 'InterviewIQ AI',
    kicker: 'Highlighted · Voice & Resume Intelligence',
    highlighted: true,
    summary:
      'End-to-end interview preparation platform delivering personalized mock sessions, automated answer evaluation, voice interaction loops, and project defense questioning.',
    architectureNote:
      'Synchronizes candidate resume parsing with stateful session scoring across devices.',
    stack: ['React', 'TypeScript', 'Node.js', 'LLM Evaluation', 'Voice AI'],
    repoUrl: 'https://github.com/kalyan870/interviewiq-ai',
  },
  {
    id: 'enterprise-rag',
    title: 'Enterprise Hybrid RAG System',
    kicker: 'Highlighted · Retrieval & Evaluation Engine',
    highlighted: true,
    summary:
      'Production-oriented document Q&A architecture combining dense embeddings with keyword matching, cross-encoder reranking, and automated faithfulness evaluation.',
    architectureNote:
      'Eliminates single-retriever blind spots on technical identifiers and exact policy clauses.',
    stack: ['Python', 'FastAPI', 'Hybrid Search', 'Reranking', 'RAG Evals'],
    repoUrl: 'https://github.com/kalyan870/rag-system',
  },
  {
    id: 'env-risk-dashboard',
    title: 'Environmental Risk & Safety Dashboard',
    kicker: 'Highlighted · Live Weather, AQI & Radar',
    highlighted: true,
    summary:
      'Interactive monitoring cockpit tracking real-time AQI (PM2.5, PM10, NO2, O3), temperature, humidity, animated Windy rain radar, and 7-day predictive safety curves.',
    architectureNote:
      'Combines live sensor & radar ingestion with threshold classification for rapid operational triage.',
    stack: ['React', 'TypeScript', 'Windy Radar', 'AQI Telemetry', 'REST API'],
    repoUrl: 'https://github.com/kalyan870/Real-Time-Environmental-Risk-Safety-Dashboard',
    liveUrl: 'https://instant-forecast.netlify.app/',
  },
  {
    id: 'kalyanhub',
    title: 'KalyanHub — Learning & Certificate Archive',
    kicker: 'Highlighted · Portfolio, Posts & Credentials',
    highlighted: true,
    summary:
      'Personal AI engineering & learning hub tracking 15 technical posts, courses, project architectures, GitHub live sync, and verified industry certificates.',
    architectureNote:
      'Unifies developer portfolio, interactive study tracking, and automated GitHub credential indexing.',
    stack: ['React', 'Vite', 'Supabase', 'GitHub Sync', 'SEO'],
    repoUrl: 'https://github.com/kalyan870/kalyanhub',
    liveUrl: 'https://kalyanhub.netlify.app/',
  },
  {
    id: 'promptdock',
    title: 'PromptDock & AdSpy AI',
    kicker: 'Full-Stack Generative AI Workbenches',
    highlighted: false,
    summary:
      'Structured prompt engineering registry (PromptDock) paired with AdSpy AI (Next.js + Expo creative hook scoring and script analysis prototype).',
    architectureNote:
      'Demonstrates rapid multi-platform delivery spanning Next.js web and mobile companions.',
    stack: ['Next.js', 'TypeScript', 'Expo', 'Generative AI', 'Vercel'],
    repoUrl: 'https://github.com/kalyan870/promptdock',
    liveUrl: 'https://promptdock-eight.vercel.app',
  },
  {
    id: 'face-recognition-pca',
    title: 'FaceRecognition (PCA + ANN) & Emotion Vision',
    kicker: 'Internship Studio · Computer Vision & MediaPipe',
    highlighted: false,
    summary:
      'Combines Internship Studio eigenfaces face-recognition (PCA + ANN in Streamlit) with real-time MediaPipe facial emotion telemetry.',
    architectureNote:
      'Bridges classical ML dimensionality reduction and real-time MediaPipe landmark inference.',
    stack: ['Python', 'PCA / ANN', 'MediaPipe', 'Streamlit', 'TypeScript'],
    repoUrl: 'https://github.com/kalyan870/FaceRecognition-PCA-ANN',
    liveUrl: 'https://appapppy-82gfkkrhjfskrpay5mtyqz.streamlit.app/',
  },
];

export const FALLBACK_COMMITS: CommitEntry[] = [
  {
    sha: '8a4f2c1',
    repo: 'kalyan870/InterviewIQ-AI',
    message: 'feat(eval): refine project-defense rubric scoring and resume context chunking',
    date: 'Recent archive',
    url: 'https://github.com/kalyan870',
  },
  {
    sha: '3d91b0e',
    repo: 'kalyan870/Enterprise-RAG-System',
    message: 'perf(retrieval): add reciprocal rank fusion between BM25 and dense vectors',
    date: 'Recent archive',
    url: 'https://github.com/kalyan870',
  },
  {
    sha: 'c7e1294',
    repo: 'kalyan870/KalyanHub',
    message: 'feat(hub): streamline learning archive indexing, project decks, and credential sync',
    date: 'Recent archive',
    url: 'https://github.com/kalyan870',
  },
  {
    sha: '5f08a3d',
    repo: 'kalyan870/Face-Emotion-Dashboard',
    message: 'fix(vision): stabilize MediaPipe landmark smoothing across variable frame rates',
    date: 'Recent archive',
    url: 'https://github.com/kalyan870',
  },
];

export const FALLBACK_SUBSTACK_POSTS: SubstackPost[] = [
  {
    title: 'Code, Experiment, Learn, Repeat: From Vignan CSE to AI Systems',
    link: 'https://saragadamkalyan.substack.com/',
    publishedAt: 'Substack Dispatch',
    excerpt:
      'Field notes on turning B.Tech CSE curiosity into deployed LLM applications, FastAPI services, Dockerized agents, and a disciplined 2028 engineering portfolio.',
    source: 'archive',
  },
  {
    title: 'Designing Production RAG That Survives Exact Technical Queries',
    link: 'https://saragadamkalyan.substack.com/',
    publishedAt: 'Substack Dispatch',
    excerpt:
      'Why pure cosine similarity fails on error codes and library names, and how combining lexical search with reranking and evaluation harnesses restores engineering trust.',
    source: 'archive',
  },
  {
    title: 'Building InterviewIQ & Tool-Use Agents Without Fragile Glue Code',
    link: 'https://saragadamkalyan.substack.com/',
    publishedAt: 'Substack Dispatch',
    excerpt:
      'Lessons from turning prompt prototypes into stateful, cross-device full-stack products with clean Express/Vercel boundaries and measurable latency budgets.',
    source: 'archive',
  },
];

export const DEFAULT_USER_PACKAGE_JSON = `{
  "name": "react-example",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx server.ts",
    "start": "node server.ts",
    "build": "vite build",
    "preview": "vite preview",
    "clean": "rm -rf dist server.js",
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "@google/genai": "^2.4.0",
    "@tailwindcss/vite": "^4.3.3",
    "@types/prismjs": "^1.26.6",
    "@vitejs/plugin-react": "^6.1.1",
    "dotenv": "^17.2.3",
    "express": "^4.21.2",
    "lucide-react": "^0.546.0",
    "motion": "^12.23.24",
    "prismjs": "^1.30.0",
    "react": "^19.0.1",
    "react-dom": "^19.0.1",
    "vite": "^8.3.0"
  },
  "devDependencies": {
    "@types/node": "^22.14.0",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "autoprefixer": "^10.4.21",
    "esbuild": "^0.25.0",
    "tailwindcss": "^4.3.3",
    "tsx": "^4.21.0",
    "typescript": "^7.0.2",
    "@types/express": "^4.17.21"
  }
}`;
