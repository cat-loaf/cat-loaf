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

async function deleteFileGithub(owner, repo, path, token, branch){
  const sha = await getFileSha(owner, repo, path, token);
  if(!sha) return { ok:false, error: 'not found', path };
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const delBody = { message: `Delete ${path}`, sha, branch };
  const delRes = await fetch(url, { method: 'DELETE', headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' }, body: JSON.stringify(delBody) });
  const delJson = await delRes.json();
  if(!delRes.ok) return { ok:false, error: delJson, path };
  return { ok:true, result: delJson, path };
}

// recursively list a folder in GitHub by using contents API
async function listFolderGithub(owner, repo, folderPath, token){
  const items = [];
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(folderPath)}`;
  const res = await fetch(url, { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' } });
  if(!res.ok) return items;
  const j = await res.json();
  for(const it of j){
    if(it.type === 'file') items.push(it.path);
    else if(it.type === 'dir'){
      const child = await listFolderGithub(owner, repo, it.path, token);
      items.push(...child);
    }
  }
  return items;
}

exports.handler = async function(event){
  try{
    requireAuth(event);
    const body = event.body ? JSON.parse(event.body) : {};
    let folder = body.folder || '';
    if(!folder) return { statusCode: 400, body: JSON.stringify({ error: 'folder required' }) };
    folder = String(folder).replace(/^\/+/, '').replace(/\/+$/, '');
    const targetPrefix = `posts/${folder}`;

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
    const GITHUB_REPO = process.env.GITHUB_REPO || '';
    const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

    if(GITHUB_TOKEN && GITHUB_REPO){
      const [owner, repo] = GITHUB_REPO.split('/');
      // list all files under folder and delete each
      const files = await listFolderGithub(owner, repo, targetPrefix, GITHUB_TOKEN);
      const results = [];
      for(const f of files){
        const r = await deleteFileGithub(owner, repo, f, GITHUB_TOKEN, GITHUB_BRANCH);
        results.push(r);
      }
      return { statusCode: 200, body: JSON.stringify({ ok:true, folder: targetPrefix, results }) };
    } else {
      const workspaceRoot = process.cwd();
      const targetDir = pathModule.join(workspaceRoot, 'posts', folder);
      if(!fs.existsSync(targetDir)) return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
      // remove dir recursively
      const rimraf = (p)=>{
        if(fs.existsSync(p)){
          for(const e of fs.readdirSync(p)){
            const fp = pathModule.join(p, e);
            if(fs.lstatSync(fp).isDirectory()) rimraf(fp);
            else fs.unlinkSync(fp);
          }
          fs.rmdirSync(p);
        }
      };
      rimraf(targetDir);
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
      return { statusCode: 200, body: JSON.stringify({ ok:true, folder: targetDir, local: true, build: buildResult }) };
    }
  }catch(err){
    const code = err && err.status ? err.status : 500;
    return { statusCode: code, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
