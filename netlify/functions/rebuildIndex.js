const { requireAuth } = require('./_auth');

exports.handler = async function(event){
  try{
    requireAuth(event);
    const workspaceRoot = process.cwd();
    const { exec } = require('child_process');
    const runBuild = () => new Promise((resolve) => {
      try{
        const child = exec('npm run build-posts-index', { cwd: workspaceRoot, windowsHide: true }, (err, stdout, stderr) => {
          if(err) resolve({ ok: false, error: String(err), stdout: String(stdout||''), stderr: String(stderr||'') });
          else resolve({ ok: true, stdout: String(stdout||''), stderr: String(stderr||'') });
        });
        const timer = setTimeout(()=>{ try{ child.kill(); }catch(e){} }, 30000);
        child.on('exit', ()=>clearTimeout(timer));
      }catch(e){ resolve({ ok: false, error: String(e) }); }
    });
    const result = await runBuild();
    return { statusCode: 200, body: JSON.stringify({ ok: true, build: result }) };
  }catch(err){
    const code = err && err.status ? err.status : 500;
    return { statusCode: code, body: JSON.stringify({ error: String(err && err.message ? err.message : err) }) };
  }
};
