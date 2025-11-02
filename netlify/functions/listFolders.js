const fetch = globalThis.fetch || require('node-fetch');
const { requireAuth } = require('./_auth');

exports.handler = async function(event){
  try{
    requireAuth(event);
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
    const GITHUB_REPO = process.env.GITHUB_REPO || '';

    // If GitHub info is available, list repo contents via GitHub API
    if(GITHUB_TOKEN && GITHUB_REPO){
      const [owner, repo] = GITHUB_REPO.split('/');
      // Prefer reading the generated posts/index.json which includes nested folder structure
      try{
        const idxUrl = `https://api.github.com/repos/${owner}/${repo}/contents/posts/index.json`;
        const idxRes = await fetch(idxUrl, { headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } });
        if(idxRes.ok){
          const idxJson = await idxRes.json();
          if(idxJson && idxJson.content){
            const buf = Buffer.from(idxJson.content, 'base64').toString('utf8');
            const idx = JSON.parse(buf);
            const out = [];
            function walk(node, prefix){
              const foldersNode = node && node.folders ? node.folders : {};
              for(const name of Object.keys(foldersNode)){
                const p = prefix ? `${prefix}/${name}` : `${name}`;
                out.push(p);
                walk(foldersNode[name], p);
              }
            }
            walk(idx, '');
            const folders = out.map(p => `/${p}/`);
            return { statusCode: 200, body: JSON.stringify({ folders }) };
          }
        }
      }catch(e){ /* fall back to directory listing below */ }

      // Fallback: list top-level directories under posts
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/posts`;
      const res = await fetch(url, { headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' } });
      if(!res.ok) return { statusCode: res.status, body: JSON.stringify({ error: await res.text() }) };
      const j = await res.json();
      // Filter directories and return their names (as '/name/')
      const folders = (j || []).filter(x=>x.type === 'dir').map(d => `/${d.name}/`);
      return { statusCode: 200, body: JSON.stringify({ folders }) };
    }

    // Fallback for local dev: prefer reading posts/index.json (build output) and collect folders recursively
    const fs = require('fs');
    const path = require('path');
    const indexPath = path.resolve(__dirname, '..', '..', 'posts', 'index.json');
    let folders = [];
    try{
      if(fs.existsSync(indexPath)){
        const idx = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        const out = [];
        function walk(node, prefix){
          const foldersNode = node && node.folders ? node.folders : {};
          for(const name of Object.keys(foldersNode)){
            const p = prefix ? `${prefix}/${name}` : `${name}`;
            out.push(p);
            walk(foldersNode[name], p);
          }
        }
        walk(idx, '');
        // Normalize to '/path/' format
        folders = out.map(p => `/${p}/`);
      } else {
        // fallback to scanning filesystem for directories under posts/
        const postsDir = path.resolve(__dirname, '..', '..', 'posts');
        try{
          function scan(dir, prefix){
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for(const e of entries){
              if(e.isDirectory()){
                const rel = prefix ? `${prefix}/${e.name}` : e.name;
                folders.push(`/${rel}/`);
                scan(path.join(dir, e.name), rel);
              }
            }
          }
          if(fs.existsSync(postsDir)) scan(postsDir, '');
        }catch(e){ /* ignore */ }
      }
    }catch(e){
      folders = [];
    }
    return { statusCode: 200, body: JSON.stringify({ folders }) };
  }catch(err){
    const code = err && err.status ? err.status : 500;
    return { statusCode: code, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
