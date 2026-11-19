/** Shapes of the generated catalog (src/data/catalog.json) and of app state. */

export type BillingMode = 'fixed' | 'base_plus_result' | 'input_count';

export interface Billing {
  mode: BillingMode;
  baseCredits: number;
  resultUnitSize?: number;
  resultUnitCredits?: number;
  estimateResultCount?: number;
  estimateInputField?: string;
  estimateResultCountPerInputField?: string;
  emptyResultPolicy?: string;
  inputField?: string;
  unitSize?: number;
  unitCredits?: number;
  minCredits?: number;
  maxCredits?: number;
}

export interface JsonSchemaField {
  type: 'string' | 'integer' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: (string | number)[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  multipleOf?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  minItems?: number;
  maxItems?: number;
  deprecated?: boolean;
  items?: JsonSchemaField;
}

export interface InputSchema {
  type: 'object';
  description?: string;
  properties: Record<string, JsonSchemaField>;
  required?: string[];
  anyOf?: { required?: string[] }[];
  allOf?: { not?: { required?: string[] } }[];
}

export interface Endpoint {
  /** `<platform>/<resource>`, the REST path after /v1/. */
  id: string;
  platform: string;
  resource: string;
  name: string;
  description: string;
  category: string;
  group?: string;
  popular: boolean;
  hotRank: number;
  launchedAt: string | null;
  tool: string;
  itemSchema: string;
  billing: Billing;
  billingNote?: string;
  input: InputSchema;
  example?: Record<string, unknown>;
  hints?: Record<string, string[]>;
}

export interface Platform {
  id: string;
  title: string;
  count: number;
}

export interface Catalog {
  generatedAt: string;
  schemaVersion: string | null;
  apiBase: string;
  creditUSD: number;
  counts: { endpoints: number; platforms: number };
  platforms: Platform[];
  itemFields: Record<string, string[]>;
  endpoints: Endpoint[];
}

export type Item = Record<string, unknown>;

export type RunStatus = 'submitting' | 'queued' | 'running' | 'succeeded' | 'failed' | 'error';

export interface RunOrigin {
  kind: 'console' | 'listening' | 'template';
  /** Monitor id or template run id. */
  ref?: string;
  /** Template id, for template runs. */
  template?: string;
  label?: string;
}

export interface Run {
  id: string;
  endpointId: string;
  input: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  status: RunStatus;
  taskId?: string;
  /** Idempotency key sent with the submit request (reused when a submit is retried). */
  idempotencyKey: string;
  estimate: number | null;
  credits?: number | null;
  resultCount?: number | null;
  error?: string;
  items: Item[];
  nextCursor: string | null;
  hasMore: boolean;
  schemaId?: string;
  origin: RunOrigin;
  finishedAt?: number;
}

export function isActive(status: RunStatus): boolean {
  return status === 'submitting' || status === 'queued' || status === 'running';
}
