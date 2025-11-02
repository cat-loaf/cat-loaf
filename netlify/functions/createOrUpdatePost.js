const fetch = globalThis.fetch || require('node-fetch');
const fs = require('fs');
const pathModule = require('path');
const { requireAuth } = require('./_auth');

function buildHeader(meta){
  const lines = ['<!-- $header -->'];
  if(meta.Title) lines.push(`Title: "${String(meta.Title).replace(/"/g,'\\"')}"`);
  if(meta.Description) lines.push(`Description: "${String(meta.Description).replace(/"/g,'\\"')}"`);
  if(meta.ImageURL) lines.push(`ImageURL: "${String(meta.ImageURL).replace(/"/g,'\\"')}"`);
  if(meta.Date) lines.push(`Date: "${String(meta.Date).replace(/"/g,'\\"')}"`);
  lines.push('<!-- $/header -->\n');
  return lines.join('\n');
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
    const body = event.body ? JSON.parse(event.body) : {};
    const title = body.title || '';
    const description = body.description || '';
    const mdBody = body.body || '';
    const imageURL = body.imageURL || 'image';
    const filenameRaw = body.filename || '';
    const location = body.location || '/';
    const date = body.date || '';

    if(!title) return { statusCode: 400, body: JSON.stringify({ error: 'Title required' }) };

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
  const GITHUB_REPO = process.env.GITHUB_REPO || '';
  const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

  const [owner, repo] = GITHUB_REPO.split('/');
    const namePart = filenameRaw ? String(filenameRaw).replace(/\s+/g,'-') : `${Date.now().toString(36)}`;
    const filename = namePart.endsWith('.md') ? namePart : `${namePart}.md`;
    const folder = String(location || '/').replace(/^\/+/, '').replace(/\/+$/, '');
    const path = folder ? `posts/${folder}/${filename}` : `posts/${filename}`;

    const meta = { Title: title, Description: description, ImageURL: imageURL };
    if(date) meta.Date = date;
    const content = buildHeader(meta) + '\n' + mdBody + '\n';

    // If GitHub config is present, commit to repo via GitHub API. Otherwise, save locally for dev.
    if(GITHUB_TOKEN && GITHUB_REPO){
      const sha = await getFileSha(owner, repo, path, GITHUB_TOKEN);
      const commitBody = {
        message: sha ? `Update post ${path}` : `Create post ${path}`,
        branch: GITHUB_BRANCH,
        content: Buffer.from(content, 'utf8').toString('base64')
      };
      if(sha) commitBody.sha = sha;

      const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
      const putRes = await fetch(putUrl, { method: 'PUT', body: JSON.stringify(commitBody), headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' } });
      const putJson = await putRes.json();
      if(!putRes.ok) return { statusCode: 500, body: JSON.stringify({ error: putJson }) };
      return { statusCode: 200, body: JSON.stringify({ ok: true, path, result: putJson }) };
    } else {
      // Local save fallback (development): write file into workspace 'posts/' directory
      try{
        const workspaceRoot = process.cwd();
        const targetDir = folder ? pathModule.join(workspaceRoot, 'posts', folder) : pathModule.join(workspaceRoot, 'posts');
        await fs.promises.mkdir(targetDir, { recursive: true });
        const targetPath = pathModule.join(targetDir, filename);
        await fs.promises.writeFile(targetPath, content, 'utf8');

        // After local save, attempt to rebuild posts index so admin sees updated folders/files.
        // Run `npm run build-posts-index` in the workspace root. This is a best-effort step for dev.
        const { exec } = require('child_process');
        const runBuild = () => new Promise((resolve) => {
          try{
            const child = exec('npm run build-posts-index', { cwd: workspaceRoot, windowsHide: true }, (err, stdout, stderr) => {
              if(err){
                resolve({ ok: false, error: String(err), stdout: String(stdout||''), stderr: String(stderr||'') });
              } else {
                resolve({ ok: true, stdout: String(stdout||''), stderr: String(stderr||'') });
              }
            });
            // safety: kill child after 30s if it hangs
            const timer = setTimeout(()=>{ try{ child.kill(); }catch(e){} }, 30_000);
            child.on('exit', ()=>clearTimeout(timer));
          }catch(e){ resolve({ ok: false, error: String(e) }); }
        });

        const buildResult = await runBuild();

        return { statusCode: 200, body: JSON.stringify({ ok: true, path: `posts/${folder?folder + '/':''}${filename}`, local: true, build: buildResult }) };
      }catch(e){
        return { statusCode: 500, body: JSON.stringify({ error: 'Local save failed', detail: String(e) }) };
      }
    }
  }catch(err){
    const code = err && err.status ? err.status : 500;
    return { statusCode: code, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
