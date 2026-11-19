/**
 * Shared input helpers for the catalog and fixture scripts.
 *
 * Every source can be a local file / directory, or a file inside a git checkout read from a
 * ref with `git show` (so a stale working tree never leaks into the generated data):
 *
 *   --apis      path to apis.json                (env SOCQ_APIS_JSON)
 *   --openapi   path to agent-api.json           (env SOCQ_OPENAPI_JSON)
 *   --docs      docs root that contains api-manual/<platform>/<resource>.mdx   (env SOCQ_DOCS_DIR)
 *   --docs-git  <repo>@<ref> instead of --docs, e.g. ../socq-docs@origin/main  (env SOCQ_DOCS_GIT)
 *   --apis-git  <repo>@<ref>:<path> instead of --apis                         (env SOCQ_APIS_GIT)
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export function args() {
  const out = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function splitGitSpec(spec) {
  // <repo>@<ref>[:<path>]  (the repo path may contain a drive letter, so split on the last "@")
  const at = spec.lastIndexOf('@');
  if (at <= 0) throw new Error(`Expected <repo>@<ref>, got "${spec}"`);
  const repo = spec.slice(0, at);
  const rest = spec.slice(at + 1);
  const colon = rest.indexOf(':');
  return colon < 0 ? { repo, ref: rest, file: '' } : { repo, ref: rest.slice(0, colon), file: rest.slice(colon + 1) };
}

export function gitShow(repo, ref, file) {
  return execFileSync('git', ['-C', repo, 'show', `${ref}:${file}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function gitList(repo, ref, dir) {
  return execFileSync('git', ['-C', repo, 'ls-tree', '-r', '--name-only', ref, dir], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
}

export function readJsonSource(opts, { flag, env, gitFlag, gitEnv, label }) {
  const gitSpec = opts[gitFlag] || process.env[gitEnv];
  if (gitSpec) {
    const { repo, ref, file } = splitGitSpec(gitSpec);
    if (!file) throw new Error(`--${gitFlag} needs <repo>@<ref>:<path>`);
    return JSON.parse(gitShow(repo, ref, file));
  }
  const p = opts[flag] || process.env[env];
  if (!p) throw new Error(`Missing ${label}: pass --${flag} <file> (or set ${env})`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/** Returns a reader for `api-manual/<id>.mdx` docs pages, or null when no docs source was given. */
export function docsReader(opts) {
  const gitSpec = opts['docs-git'] || process.env.SOCQ_DOCS_GIT;
  if (gitSpec) {
    const { repo, ref } = splitGitSpec(gitSpec);
    const files = new Set(gitList(repo, ref, 'api-manual'));
    return {
      label: `${repo}@${ref}`,
      read(id) {
        const file = `api-manual/${id}.mdx`;
        return files.has(file) ? gitShow(repo, ref, file) : null;
      },
    };
  }
  const dir = opts.docs || process.env.SOCQ_DOCS_DIR;
  if (!dir) return null;
  return {
    label: dir,
    read(id) {
      const file = path.join(dir, 'api-manual', `${id}.mdx`);
      return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    },
  };
}

/** First ```json block after `heading` (or the first one in the page when heading is null). */
export function jsonBlockAfter(mdx, heading) {
  let text = mdx;
  if (heading) {
    const i = mdx.indexOf(heading);
    if (i < 0) return undefined;
    text = mdx.slice(i);
  }
  const m = /```json\s*\n([\s\S]*?)```/.exec(text);
  if (!m) return undefined;
  return JSON.parse(m[1]);
}

export function writeJson(rel, data) {
  const file = path.resolve(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 1) + '\n');
  return file;
}
