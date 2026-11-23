import path from 'path';

// Serverless providers expose the project bundle at their task root; local runs
// resolve against the repository root (the working directory used by scripts).
export const projectRoot = path.resolve(
  process.env.CHRONICLE_PROJECT_ROOT || process.env.LAMBDA_TASK_ROOT || process.cwd()
);
