const fetch = globalThis.fetch || require('node-fetch');
const fs = require('fs');
const pathModule = require('path');
const { requireAuth } = require('./_auth');

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
    const folderRaw = body.folder || '';
    const filenameRaw = body.filename || '';
    const b64 = body.content || '';

    if(!b64) return { statusCode: 400, body: JSON.stringify({ error: 'No content provided' }) };

    const folder = String(folderRaw || '').replace(/^\/+/, '').replace(/\/+$/, '');
    const filename = String(filenameRaw || `${Date.now().toString(36)}.png`).replace(/^\/+/, '');
    const path = folder ? `public/posts/${folder}/${filename}` : `public/posts/${filename}`;

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
    const GITHUB_REPO = process.env.GITHUB_REPO || '';
    const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

    if(GITHUB_TOKEN && GITHUB_REPO){
      const [owner, repo] = GITHUB_REPO.split('/');
      const sha = await getFileSha(owner, repo, path, GITHUB_TOKEN);
      const commitBody = {
        message: sha ? `Update image ${path}` : `Add image ${path}`,
        branch: GITHUB_BRANCH,
        content: b64
      };
      if(sha) commitBody.sha = sha;

      const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
      const putRes = await fetch(putUrl, { method: 'PUT', body: JSON.stringify(commitBody), headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' } });
      const putJson = await putRes.json();
      if(!putRes.ok) return { statusCode: 500, body: JSON.stringify({ error: putJson }) };
      // Return the path where the image will be served from
      const publicPath = `/public/posts/${folder ? folder + '/' : ''}${filename}`;
      return { statusCode: 200, body: JSON.stringify({ ok: true, path: publicPath, result: putJson }) };
    } else {
      // Local save fallback for dev: write file to public/posts/<folder>/filename
      try{
        const workspaceRoot = process.cwd();
        const targetDir = folder ? pathModule.join(workspaceRoot, 'public', 'posts', folder) : pathModule.join(workspaceRoot, 'public', 'posts');
        await fs.promises.mkdir(targetDir, { recursive: true });
        const targetPath = pathModule.join(targetDir, filename);
        const buffer = Buffer.from(b64, 'base64');
        await fs.promises.writeFile(targetPath, buffer);
        const publicPath = `/public/posts/${folder ? folder + '/' : ''}${filename}`;

        // Best-effort: rebuild posts index so admin sees updated files
        const { exec } = require('child_process');
        const runBuild = () => new Promise((resolve) => {
          try{
            const child = exec('npm run build-posts-index', { cwd: workspaceRoot, windowsHide: true }, (err, stdout, stderr) => {
              if(err){ resolve({ ok: false, error: String(err), stdout: String(stdout||''), stderr: String(stderr||'') }); }
              else { resolve({ ok: true, stdout: String(stdout||''), stderr: String(stderr||'') }); }
            });
            const timer = setTimeout(()=>{ try{ child.kill(); }catch(e){} }, 30000);
            child.on('exit', ()=>clearTimeout(timer));
          }catch(e){ resolve({ ok: false, error: String(e) }); }
        });
        const buildResult = await runBuild();

        return { statusCode: 200, body: JSON.stringify({ ok: true, path: publicPath, local: true, build: buildResult }) };
      }catch(e){
        return { statusCode: 500, body: JSON.stringify({ error: 'Local image save failed', detail: String(e) }) };
      }
    }
  }catch(err){
    const code = err && err.status ? err.status : 500;
    return { statusCode: code, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
