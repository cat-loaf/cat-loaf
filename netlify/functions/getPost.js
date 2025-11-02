const fetch = globalThis.fetch || require('node-fetch');
const fs = require('fs');
const pathModule = require('path');
const { requireAuth } = require('./_auth');

function parseHeaderAndBody(raw){
  const headerStart = '<!-- $header -->';
  const headerEnd = '<!-- $/header -->';
  const res = { meta: {}, body: raw };
  const si = raw.indexOf(headerStart);
  const ei = raw.indexOf(headerEnd);
  if(si !== -1 && ei !== -1 && ei > si){
    const hdr = raw.substring(si + headerStart.length, ei).trim();
    const lines = hdr.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    lines.forEach(line=>{
      const m = line.match(/^([A-Za-z0-9_\-]+):\s*"([\s\S]*)"$/);
      if(m){ res.meta[m[1]] = m[2]; }
    });
    res.body = raw.substring(ei + headerEnd.length).trimStart();
  }
  return res;
}

async function getFileSha(owner, repo, path, token){
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const res = await fetch(url, { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } });
  if(res.status === 200){ const j = await res.json(); return j.sha; }
  return null;
}

exports.handler = async function(event){
  try{
    requireAuth(event);
    const qp = event.queryStringParameters || {};
    let targetPath = qp.path || (event.body && JSON.parse(event.body).path) || '';
    if(!targetPath) return { statusCode: 400, body: JSON.stringify({ error: 'path required' }) };

    // Normalize path: allow values like '/folder/file.md' or 'folder/file.md' or 'posts/f.md'
    targetPath = targetPath.replace(/^\/+/, '');
    if(!targetPath.startsWith('posts/')) targetPath = `posts/${targetPath}`;

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
    const GITHUB_REPO = process.env.GITHUB_REPO || '';
    const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

    if(GITHUB_TOKEN && GITHUB_REPO){
      const [owner, repo] = GITHUB_REPO.split('/');
      // fetch via GitHub contents API
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(targetPath)}`;
      const res = await fetch(url, { headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } });
      if(!res.ok) return { statusCode: res.status, body: JSON.stringify({ error: await res.text() }) };
      const j = await res.json();
      const raw = Buffer.from(j.content || '', 'base64').toString('utf8');
      const parsed = parseHeaderAndBody(raw);
      return { statusCode: 200, body: JSON.stringify({ ok:true, path: targetPath, sha: j.sha, content: raw, meta: parsed.meta, body: parsed.body }) };
    } else {
      // local file
      const workspaceRoot = process.cwd();
      const localPath = pathModule.join(workspaceRoot, targetPath);
      if(!fs.existsSync(localPath)) return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
      const raw = fs.readFileSync(localPath, 'utf8');
      const parsed = parseHeaderAndBody(raw);
      return { statusCode: 200, body: JSON.stringify({ ok:true, path: targetPath, local: true, content: raw, meta: parsed.meta, body: parsed.body }) };
    }
  }catch(err){
    const code = err && err.status ? err.status : 500;
    return { statusCode: code, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
