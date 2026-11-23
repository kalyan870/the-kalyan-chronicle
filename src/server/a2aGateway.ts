import type { Request, Response } from 'express';
import { FEATURED_PROJECTS, KALYAN_PROFILE, type ProjectDispatch } from '../data/chronicleData.ts';
import { sanitizeAiOutput, validateRagInput } from './aiGuardrails.ts';
import { queryChronicleRagWithMemory, type LiveDigestContext } from './ragMemory.ts';

export function buildAgentCard(
  digest: {
    profile: { publicRepos: number };
    latestProjects: ProjectDispatch[];
  },
  baseUrl: string
) {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const projectNames = (
    digest.latestProjects.length > 0 ? digest.latestProjects : FEATURED_PROJECTS
  )
    .slice(0, 4)
    .map((p) => p.title);

  return {
    name: 'The Kalyan Chronicle Engineering Agent',
    description: `A2A-compatible portfolio, grounded RAG research desk, and trace/eval workbench for ${KALYAN_PROFILE.name} (${digest.profile.publicRepos} public repos).`,
    version: '1.0.0',
    provider: {
      organization: KALYAN_PROFILE.name,
      url: cleanBase,
    },
    documentationUrl: `${cleanBase}/llms.txt`,
    supportedInterfaces: [
      {
        url: `${cleanBase}/a2a/v1`,
        protocolBinding: 'JSON-RPC',
        protocolVersion: '1.0',
      },
    ],
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['text/plain', 'application/json'],
    skills: [
      {
        id: 'chronicle-rag-inquiry',
        name: 'Chronicle Portfolio & RAG Lookup',
        description: `Answers grounded questions covering ${projectNames.join(', ')}, commits, internships, and verified certificates.`,
        tags: ['rag', 'portfolio', 'citations'],
      },
      {
        id: 'mcp-tools',
        name: 'Read-Only MCP Tool Execution',
        description: `Exposes 4 JSON-RPC 2.0 tools at ${cleanBase}/api/mcp.`,
        tags: ['mcp', 'tools'],
      },
    ],
  };
}

export async function handleA2aRpcRequest(
  req: Request,
  res: Response,
  digestContext: LiveDigestContext
): Promise<void> {
  const body = req.body as {
    jsonrpc?: unknown;
    id?: string | number | null;
    method?: unknown;
    params?: {
      message?: {
        parts?: Array<{ kind?: string; text?: string }>;
      };
    };
  } | null;

  const id = body?.id ?? null;
  if (!body || body.jsonrpc !== '2.0' || typeof body.method !== 'string') {
    res.status(400).json({
      jsonrpc: '2.0',
      id,
      error: { code: -32600, message: 'Invalid JSON-RPC 2.0 A2A request.' },
    });
    return;
  }

  const rawText =
    body.params?.message?.parts?.find((p) => typeof p.text === 'string')?.text || '';

  const check = validateRagInput(rawText, 'a2a_agent_session');
  if (!check.allowed) {
    res.status(400).json({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32602,
        message: check.blockedReason || 'Invalid or unsafe A2A prompt input.',
      },
    });
    return;
  }

  if (body.method === 'message/send') {
    const rag = await queryChronicleRagWithMemory({
      query: check.sanitizedQuery,
      sessionId: `a2a_${Date.now().toString(36)}`,
      userId: 'a2a-client',
      digestContext,
      skipPersistence: true,
    });

    res.json({
      jsonrpc: '2.0',
      id,
      result: {
        kind: 'message',
        role: 'agent',
        parts: [{ kind: 'text', text: sanitizeAiOutput(rag.answer) }],
        metadata: {
          citations: rag.citations,
          telemetry: rag.telemetry,
        },
      },
    });
    return;
  }

  if (body.method === 'message/stream') {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    let closed = false;
    req.on('close', () => {
      closed = true;
    });

    const rag = await queryChronicleRagWithMemory({
      query: check.sanitizedQuery,
      sessionId: `a2a_${Date.now().toString(36)}`,
      userId: 'a2a-stream-client',
      digestContext,
      skipPersistence: true,
    });

    const safeAnswer = sanitizeAiOutput(rag.answer);
    const words = safeAnswer.split(/(\s+)/);
    const chunkSize = 8;

    for (let i = 0; i < words.length; i += chunkSize) {
      if (closed) return;
      const chunkText = words.slice(i, i + chunkSize).join('');
      if (!chunkText) continue;
      const chunkEvent = {
        jsonrpc: '2.0',
        id,
        result: {
          kind: 'chunk',
          role: 'agent',
          parts: [{ kind: 'text', text: chunkText }],
        },
      };
      res.write(`data: ${JSON.stringify(chunkEvent)}\n\n`);
      await new Promise((resolve) => setTimeout(resolve, 18));
    }

    if (!closed) {
      res.write(
        `data: ${JSON.stringify({
          jsonrpc: '2.0',
          id,
          result: {
            kind: 'status-update',
            final: true,
            is_task_complete: true,
            citations: rag.citations,
            telemetry: rag.telemetry,
          },
        })}\n\n`
      );
      res.end();
    }
    return;
  }

  res.status(404).json({
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: `Unsupported A2A method "${body.method}".` },
  });
}
