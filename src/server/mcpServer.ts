import {
  CAREER_HISTORY,
  FEATURED_PROJECTS,
  KALYAN_PROFILE,
  VERIFIED_CERTIFICATES,
  type ProjectDispatch,
} from '../data/chronicleData.ts';
import { listEditionMetadata } from './neonDb.ts';
import { queryChronicleRagWithMemory, type LiveDigestContext } from './ragMemory.ts';
import { sanitizeAiOutput, validateRagInput } from './aiGuardrails.ts';

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
}

export const CHRONICLE_MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'get_engineer_profile',
    description:
      'Retrieve Saragadam Kalyan profile details, public engineering links, career history, and verified credentials summary.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_projects',
    description:
      'List featured and GitHub-synced engineering projects with optional keyword filtering or highlighted-only filtering.',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description: 'Optional keyword to match against title, stack, or summary.',
        },
        highlightedOnly: {
          type: 'boolean',
          description: 'When true, return only front-page highlighted projects.',
        },
      },
    },
  },
  {
    name: 'search_chronicle_rag',
    description:
      'Run a grounded editorial RAG lookup over Kalyan Chronicle projects, commits, certificates, and architecture notes.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language question about Saragadam Kalyan engineering work.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_archived_editions',
    description:
      'List saved broadsheet snapshots including automated daily edition runs and metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of archived editions to return (default 10).',
        },
      },
    },
  },
];

export function getMcpServerDescriptor() {
  return {
    name: 'kalyan-chronicle-mcp',
    version: '1.0.0',
    protocolVersion: '2025-03-26',
    transport: 'http-json-rpc-2.0',
    readOnly: true,
    tools: CHRONICLE_MCP_TOOLS,
  };
}

export async function handleMcpJsonRpc(
  body: unknown,
  digestContext: LiveDigestContext & { publicRepos?: number; latestProjects?: ProjectDispatch[] }
): Promise<{ status: number; payload: Record<string, unknown> }> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      status: 400,
      payload: {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32600, message: 'Invalid JSON-RPC 2.0 request object.' },
      },
    };
  }

  const rpc = body as {
    jsonrpc?: unknown;
    id?: string | number | null;
    method?: unknown;
    params?: Record<string, unknown>;
  };

  const id = rpc.id ?? null;
  if (rpc.jsonrpc !== '2.0' || typeof rpc.method !== 'string') {
    return {
      status: 400,
      payload: {
        jsonrpc: '2.0',
        id,
        error: { code: -32600, message: 'Expected jsonrpc="2.0" and string method.' },
      },
    };
  }

  if (rpc.method === 'initialize') {
    return {
      status: 200,
      payload: {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2025-03-26',
          capabilities: { tools: { listChanged: false } },
          serverInfo: {
            name: 'kalyan-chronicle-mcp',
            version: '1.0.0',
          },
        },
      },
    };
  }

  if (rpc.method === 'tools/list') {
    return {
      status: 200,
      payload: {
        jsonrpc: '2.0',
        id,
        result: {
          tools: CHRONICLE_MCP_TOOLS,
        },
      },
    };
  }

  if (rpc.method === 'tools/call') {
    const toolName = typeof rpc.params?.name === 'string' ? rpc.params.name.trim() : '';
    const args =
      rpc.params?.arguments && typeof rpc.params.arguments === 'object' && !Array.isArray(rpc.params.arguments)
        ? (rpc.params.arguments as Record<string, unknown>)
        : {};

    if (toolName === 'get_engineer_profile') {
      const profilePayload = {
        profile: KALYAN_PROFILE,
        publicRepos: digestContext.publicRepos ?? 54,
        career: CAREER_HISTORY,
        certificatesCount: VERIFIED_CERTIFICATES.length,
        certificates: VERIFIED_CERTIFICATES,
      };
      return {
        status: 200,
        payload: {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(profilePayload, null, 2) }],
            structuredContent: profilePayload,
          },
        },
      };
    }

    if (toolName === 'list_projects') {
      const keyword = typeof args.keyword === 'string' ? args.keyword.trim().toLowerCase() : '';
      const highlightedOnly = args.highlightedOnly === true;
      const pool =
        digestContext.latestProjects && digestContext.latestProjects.length > 0
          ? digestContext.latestProjects
          : FEATURED_PROJECTS;

      const filtered = pool.filter((p) => {
        if (highlightedOnly && !p.highlighted) return false;
        if (!keyword) return true;
        const hay = `${p.title} ${p.kicker} ${p.summary} ${p.stack.join(' ')}`.toLowerCase();
        return hay.includes(keyword);
      });

      const structured = { count: filtered.length, projects: filtered };
      return {
        status: 200,
        payload: {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(structured, null, 2) }],
            structuredContent: structured,
          },
        },
      };
    }

    if (toolName === 'search_chronicle_rag') {
      const rawQuery = typeof args.query === 'string' ? args.query : '';
      const check = validateRagInput(rawQuery, 'mcp-stateless-session');
      if (!check.allowed) {
        return {
          status: 200,
          payload: {
            jsonrpc: '2.0',
            id,
            result: {
              isError: true,
              content: [{ type: 'text', text: check.blockedReason || 'Invalid query input.' }],
            },
          },
        };
      }

      const rag = await queryChronicleRagWithMemory({
        query: check.sanitizedQuery,
        sessionId: `mcp_${Date.now().toString(36)}`,
        userId: 'mcp-readonly-client',
        digestContext,
        skipPersistence: true,
      });

      const safeText = sanitizeAiOutput(rag.answer);
      const structured = {
        answer: safeText,
        citations: rag.citations,
        telemetry: rag.telemetry,
      };
      return {
        status: 200,
        payload: {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(structured, null, 2) }],
            structuredContent: structured,
          },
        },
      };
    }

    if (toolName === 'list_archived_editions') {
      const limit =
        typeof args.limit === 'number' && Number.isFinite(args.limit)
          ? Math.min(Math.max(1, Math.floor(args.limit)), 25)
          : 10;
      const editions = (await listEditionMetadata()).slice(0, limit);
      const structured = { count: editions.length, editions };
      return {
        status: 200,
        payload: {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(structured, null, 2) }],
            structuredContent: structured,
          },
        },
      };
    }

    return {
      status: 404,
      payload: {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Unknown MCP tool "${toolName}".` },
      },
    };
  }

  return {
    status: 404,
    payload: {
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Unsupported MCP method "${rpc.method}".` },
    },
  };
}
