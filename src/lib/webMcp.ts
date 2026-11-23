interface WebMcpToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

interface ModelContextContainer {
  registerTool?: (tool: WebMcpToolSpec) => (() => void) | void;
  unregisterTool?: (name: string) => void;
}

export function registerChronicleWebMcpTools(handlers: {
  onOpenArchive: () => void;
  onOpenWorkbench: () => void;
}): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const navWithCtx = navigator as Navigator & { modelContext?: ModelContextContainer };
  const docWithCtx = document as Document & { modelContext?: ModelContextContainer };
  const container = navWithCtx.modelContext || docWithCtx.modelContext;

  if (!container || typeof container.registerTool !== 'function') {
    return () => {};
  }

  const registeredNames: string[] = [];
  const unregisterCallbacks: Array<() => void> = [];

  const specs: WebMcpToolSpec[] = [
    {
      name: 'query_chronicle_edition',
      description:
        "Ask a question about Saragadam Kalyan's AI engineering projects, commits, architecture, or verified certificates.",
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Question to ask the edition index.' },
        },
        required: ['query'],
      },
      execute: async (args) => {
        const q = typeof args.query === 'string' ? args.query.trim() : '';
        const res = await fetch('/api/mcp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'tools/call',
            params: { name: 'search_chronicle_rag', arguments: { query: q } },
          }),
        });
        return res.json();
      },
    },
    {
      name: 'open_archive_issues',
      description: 'Open the Back Issues & Automation Ledger modal in The Kalyan Chronicle.',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        handlers.onOpenArchive();
        return { opened: true, view: 'archive-issues' };
      },
    },
    {
      name: 'open_dev_workbench',
      description:
        'Open the interactive Engineering Workbench with Trace Debugger, PR Eval Matrix, Local Code Indexer, and Schema Inspector.',
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        handlers.onOpenWorkbench();
        return { opened: true, view: 'dev-workbench' };
      },
    },
  ];

  for (const spec of specs) {
    try {
      const cleanup = container.registerTool(spec);
      registeredNames.push(spec.name);
      if (typeof cleanup === 'function') {
        unregisterCallbacks.push(cleanup);
      }
    } catch {
      // Non-fatal if browser WebMCP draft rejects registration
    }
  }

  return () => {
    for (const cb of unregisterCallbacks) {
      try {
        cb();
      } catch {
        // Ignore cleanup errors
      }
    }
    if (typeof container.unregisterTool === 'function') {
      for (const name of registeredNames) {
        try {
          container.unregisterTool(name);
        } catch {
          // Ignore unregister errors
        }
      }
    }
  };
}
