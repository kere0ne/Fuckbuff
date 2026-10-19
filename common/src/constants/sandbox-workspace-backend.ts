/**
 * Who answers the Cloud preview and workspace-service actions
 * (`cloud/preview:*`): the Convex actions, or fuckbuff-web's registry twins
 * running the same bodies (`codebase-utils/cloud-preview-actions.ts`) with
 * access from the project spine (COD-742 sandboxes,
 * docs/fuckbuff-sandbox-workspace-actions.md).
 *
 * - `convex`   (default): the browser calls Convex; the twins answer
 *              `unknown_function`.
 * - `postgres` the browser calls fuckbuff-web. Refused (the map keeps the
 *              browser on Convex) until the spine reads are on Postgres.
 *
 * No `shadow`: these are actions with side effects on the sandbox, so running
 * both would start or stop a dev server twice. A flip is a reviewed one-line
 * diff here, never an env var.
 */
export type SandboxWorkspaceBackend = 'convex' | 'postgres'

export const SANDBOX_WORKSPACE_BACKEND: SandboxWorkspaceBackend = 'convex'
