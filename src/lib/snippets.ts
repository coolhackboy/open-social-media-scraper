/**
 * "Copy as" snippets for a request. They read the key from $SOCQ_API_KEY and never contain it.
 */
import { config } from '../config';
import type { Endpoint } from './types';

export type SnippetLang = 'curl' | 'python' | 'node' | 'mcp';

export const SNIPPET_LABELS: Record<SnippetLang, string> = {
  curl: 'cURL',
  python: 'Python',
  node: 'Node.js',
  mcp: 'MCP prompt',
};

const KEY = config.provider.keyEnvVar;

function pyLiteral(v: unknown, indent = 0): string {
  const pad = '    '.repeat(indent);
  if (v === null || v === undefined) return 'None';
  if (v === true) return 'True';
  if (v === false) return 'False';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map((x) => pyLiteral(x, indent)).join(', ')}]`;
  const entries = Object.entries(v as Record<string, unknown>);
  if (!entries.length) return '{}';
  return `{\n${entries.map(([k, x]) => `${pad}    ${JSON.stringify(k)}: ${pyLiteral(x, indent + 1)},`).join('\n')}\n${pad}}`;
}

export function snippet(lang: SnippetLang, ep: Endpoint, body: Record<string, unknown>, apiBase: string): string {
  const json = JSON.stringify(body, null, 2);
  const url = `${apiBase}/v1/${ep.id}`;

  if (lang === 'curl') {
    return `# 1) Submit
curl -s -X POST "${url}" \\
  -H "Authorization: Bearer $${KEY}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(body).replace(/'/g, "'\\''")}'
# → {"code":200,"data":{"task_id":"…","status":"queued"}}

# 2) Poll until status is "succeeded" or "failed"; results are included when it succeeds
curl -s "${apiBase}/v1/tasks/TASK_ID?limit=50" -H "Authorization: Bearer $${KEY}"

# 3) Next page: pass data.results.next_cursor
curl -s "${apiBase}/v1/tasks/TASK_ID?limit=50&cursor=NEXT_CURSOR" -H "Authorization: Bearer $${KEY}"`;
  }

  if (lang === 'python') {
    return `import os, time, requests

API = "${apiBase}"
HEADERS = {"Authorization": f"Bearer {os.environ['${KEY}']}"}

task = requests.post(f"{API}/v1/${ep.id}", headers=HEADERS, json=${pyLiteral(body)}).json()["data"]
task_id = task["task_id"]

delay = 1.5
while True:
    task = requests.get(f"{API}/v1/tasks/{task_id}", headers=HEADERS, params={"limit": 50}).json()["data"]
    if task["status"] in ("succeeded", "failed"):
        break
    time.sleep(delay)
    delay = min(delay * 1.5, 10)

if task["status"] == "failed":
    raise SystemExit(task.get("error_message"))

items = list(task["results"]["items"])
cursor = task["results"]["next_cursor"]
while cursor:
    page = requests.get(f"{API}/v1/tasks/{task_id}", headers=HEADERS,
                        params={"limit": 50, "cursor": cursor}).json()["data"]["results"]
    items += page["items"]
    cursor = page["next_cursor"]

print(len(items), "items,", task["credits_amount"], "credits")`;
  }

  if (lang === 'node') {
    return `// Node 18+ (global fetch). Run as an ES module.
const API = "${apiBase}";
const headers = { Authorization: \`Bearer \${process.env.${KEY}}\`, "Content-Type": "application/json" };
const get = (path) => fetch(\`\${API}\${path}\`, { headers }).then((r) => r.json());

const submit = await fetch(\`\${API}/v1/${ep.id}\`, {
  method: "POST",
  headers,
  body: JSON.stringify(${json.replace(/\n/g, '\n  ')}),
}).then((r) => r.json());
const taskId = submit.data.task_id;

let task, delay = 1500;
for (;;) {
  task = (await get(\`/v1/tasks/\${taskId}?limit=50\`)).data;
  if (task.status === "succeeded" || task.status === "failed") break;
  await new Promise((r) => setTimeout(r, delay));
  delay = Math.min(delay * 1.5, 10_000);
}
if (task.status === "failed") throw new Error(task.error_message);

const items = [...task.results.items];
let cursor = task.results.next_cursor;
while (cursor) {
  const page = (await get(\`/v1/tasks/\${taskId}?limit=50&cursor=\${encodeURIComponent(cursor)}\`)).data.results;
  items.push(...page.items);
  cursor = page.next_cursor;
}
console.log(items.length, "items,", task.credits_amount, "credits");`;
  }

  return `Use the SocQ MCP server (${config.provider.mcpUrl}) to collect public data.

Run the endpoint "${ep.id}" (${ep.name}) with socq_execute and this input:

${json}

Then call socq_get_task until the task status is "succeeded" or "failed". Follow results.next_cursor until has_more is false and collect every item from results.items. Report how many items were collected and the credits_amount charged, then summarize the results in a short table (author, text, key metrics, published_at, url).`;
}
