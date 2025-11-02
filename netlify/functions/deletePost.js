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
    let targetPath = body.path || '';
    if(!targetPath) return { statusCode: 400, body: JSON.stringify({ error: 'path required' }) };
    targetPath = targetPath.replace(/^\/+/, '');
    if(!targetPath.startsWith('posts/')) targetPath = `posts/${targetPath}`;

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
    const GITHUB_REPO = process.env.GITHUB_REPO || '';
    const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

    if(GITHUB_TOKEN && GITHUB_REPO){
      const [owner, repo] = GITHUB_REPO.split('/');
      // get sha
      let sha = await getFileSha(owner, repo, targetPath, GITHUB_TOKEN);
      // If not found, try to resolve the file path from posts/index.json in the repo
      if(!sha){
        try{
          const idxUrl = `https://api.github.com/repos/${owner}/${repo}/contents/posts/index.json`;
          const idxRes = await fetch(idxUrl, { headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } });
          if(idxRes.ok){
            const idxJson = await idxRes.json();
            if(idxJson && idxJson.content){
              const buf = Buffer.from(idxJson.content, 'base64').toString('utf8');
              const idx = JSON.parse(buf);
              // search recursively for matching file entry
              function findFile(node){
                const list = node.files || [];
                for(const f of list){
                  const filePath = (f.file||'').replace(/^\/+/, '');
                  const filename = filePath.split('/').pop();
                  const given = targetPath.replace(/^posts\//,'');
                  if(filePath === targetPath || filePath === given || f.path === given || f.slug === given || filename === given || filePath.endsWith('/' + given)){
                    return filePath;
                  }
                }
                const folders = node.folders || {};
                for(const k of Object.keys(folders)){
                  const r = findFile(folders[k]); if(r) return r;
                }
                return null;
              }
              const found = findFile(idx);
              if(found){
                targetPath = found.replace(/^\/+/, '');
                sha = await getFileSha(owner, repo, targetPath, GITHUB_TOKEN);
              }
            }
          }
        }catch(e){ /* ignore and fall through */ }
      }
      if(!sha) return { statusCode: 404, body: JSON.stringify({ error: 'File not found in repo' }) };
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(targetPath)}`;
      const delBody = { message: `Delete ${targetPath}`, sha, branch: GITHUB_BRANCH };
      const delRes = await fetch(url, { method: 'DELETE', headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' }, body: JSON.stringify(delBody) });
      const delJson = await delRes.json();
      if(!delRes.ok) return { statusCode: 500, body: JSON.stringify({ error: delJson }) };
      return { statusCode: 200, body: JSON.stringify({ ok:true, path: targetPath, result: delJson }) };
    } else {
      // local delete
      const workspaceRoot = process.cwd();
      let localPath = pathModule.join(workspaceRoot, targetPath);
      if(!fs.existsSync(localPath)){
        // attempt to resolve via local posts/index.json
        try{
          const indexPath = pathModule.join(workspaceRoot, 'posts', 'index.json');
          if(fs.existsSync(indexPath)){
            const idx = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
            function findFileLocal(node){
              for(const f of node.files || []){
                const filePath = (f.file||'').replace(/^\/+/, '');
                const given = targetPath.replace(/^posts\//,'');
                const filename = filePath.split('/').pop();
                if(filePath === targetPath || filePath === given || f.path === given || f.slug === given || filename === given || filePath.endsWith('/' + given)){
                  return filePath;
                }
              }
              for(const k of Object.keys(node.folders || {})){
                const r = findFileLocal(node.folders[k]); if(r) return r;
              }
              return null;
            }
            const found = findFileLocal(idx);
            if(found) localPath = pathModule.join(workspaceRoot, found);
          }
        }catch(e){ /* ignore */ }
      }
      if(!fs.existsSync(localPath)) return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
      await fs.promises.unlink(localPath);
      // attempt rebuild
      const { exec } = require('child_process');
      const runBuild = () => new Promise((resolve) => {
        try{
          const child = exec('npm run build-posts-index', { cwd: workspaceRoot, windowsHide: true }, (err, stdout, stderr) => {
            if(err) resolve({ ok:false, error:String(err), stdout:String(stdout||''), stderr:String(stderr||'') });
            else resolve({ ok:true, stdout:String(stdout||''), stderr:String(stderr||'') });
          });
          const timer = setTimeout(()=>{ try{ child.kill(); }catch(e){} }, 30_000);
          child.on('exit', ()=>clearTimeout(timer));
        }catch(e){ resolve({ ok:false, error:String(e) }); }
      });
      const buildResult = await runBuild();
      return { statusCode: 200, body: JSON.stringify({ ok:true, path: targetPath, local: true, build: buildResult }) };
    }
  }catch(err){
    const code = err && err.status ? err.status : 500;
    return { statusCode: code, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
