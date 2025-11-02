// Admin app wiring. This file is loaded only after the protected admin UI fragment
(function(){
  const tokenKey = 'admin_jwt_token';
  const token = localStorage.getItem(tokenKey) || null;
  function authFetch(path, opts){
    opts = opts || {};
    opts.headers = opts.headers || {};
    opts.headers['Content-Type'] = opts.headers['Content-Type'] || 'application/json';
    if(token) opts.headers.Authorization = 'Bearer ' + token;
    return fetch(path, opts);
  }

  function escapeHtml(unsafe){
    return (unsafe||'').replace(/[&<>"'`]/g, function(m){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;', '`':'&#96;'}[m];
    });
  }

  async function fetchFolders(){
    try{
      const res = await authFetch('/.netlify/functions/listFolders', { method: 'GET' });
      if(!res.ok) return false;
      const j = await res.json();
      const sel = document.getElementById('postLocation');
      const imgSel = document.getElementById('imageFolder');
  if(sel) sel.innerHTML = '<option value="/">/</option>' + (j.folders || []).map(f=>`<option value="${f}">${f}</option>`).join('');
  if(imgSel) imgSel.innerHTML = '<option value="/">/</option>' + (j.folders || []).map(f=>`<option value="${f}">${f}</option>`).join('');
      return true;
    }catch(e){ return false; }
  }

  // Show build modal with result text
  function showBuildModalText(text){
    const modal = document.getElementById('buildModal');
    const body = document.getElementById('buildModalBody');
    if(body) body.textContent = text;
    if(modal) modal.classList.remove('hidden');
  }

  function hideBuildModal(){ const modal = document.getElementById('buildModal'); if(modal) modal.classList.add('hidden'); }

  function wire(){
    const imageFile = document.getElementById('imageFile');
    const imagePreview = document.getElementById('imagePreview');
    if(imageFile){
      imageFile.addEventListener('change', ()=>{
        const f = imageFile.files[0];
        if(!f) { imagePreview.src=''; imagePreview.classList.add('hidden'); return; }
        const r = new FileReader(); r.onload = ()=>{ imagePreview.src = r.result; imagePreview.classList.remove('hidden'); };
        r.readAsDataURL(f);
      });
    }

    const uploadBtn = document.getElementById('uploadImageBtn');
    if(uploadBtn){
      uploadBtn.addEventListener('click', async ()=>{
        const f = imageFile.files[0];
        if(!f) return alert('Choose an image');
        const folder = (document.getElementById('newImageFolder') && document.getElementById('newImageFolder').value.trim()) || (document.getElementById('imageFolder') && document.getElementById('imageFolder').value) || '/';
        const filename = (document.getElementById('imageFilename') && document.getElementById('imageFilename').value.trim()) || f.name;
        const b64 = await (new Promise((res,rej)=>{ const rd=new FileReader(); rd.onload=()=>res(rd.result.split(',')[1]); rd.onerror=rej; rd.readAsDataURL(f); }));
        const res = await authFetch('/.netlify/functions/uploadImage', { method: 'POST', body: JSON.stringify({ folder, filename, content: b64 }) });
        const j = await res.json();
        const out = document.getElementById('uploadResult'); if(out) out.textContent = res.ok ? `Uploaded: ${j.path}` : `Error: ${JSON.stringify(j)}`;
        if(res.ok) {
          await fetchFolders();
          try{ await refreshIndexViewer(); }catch(e){}
          // show simple success/fail modal when server returned build info
          if(j && j.build){
            showBuildModalText(j.build.ok ? 'Build succeeded' : 'Build failed');
            console.log('Build details:', j.build);
          }
        }
      });
    }

    const tabEdit = document.getElementById('tabEdit');
    const tabPreview = document.getElementById('tabPreview');
    const bodyEl = document.getElementById('postBody');
    const previewEl = document.getElementById('postPreview');
    // Monaco editor instance (optional)
    let monacoEditor = null;
    let usingMonaco = false;
  // Monaco read-only JSON viewer for computed index.json
  let monacoJsonEditor = null;

    // helper to load an external script
    function loadScript(src){ return new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=src; s.onload=()=>res(); s.onerror=(e)=>rej(e); document.body.appendChild(s); }); }

    // initialize Monaco editor in place of textarea if possible
    async function initMonacoIfAvailable(){
      // find existing container or create one next to the textarea
      let container = document.getElementById('monacoContainer');
      if(!container){
        if(bodyEl && bodyEl.parentNode){
          container = document.createElement('div');
          container.id = 'monacoContainer';
          container.style.minHeight = bodyEl.style.minHeight || '240px';
          container.style.height = bodyEl.style.minHeight || '420px';
          container.style.border = bodyEl.style.border || '1px solid #ddd';
          container.style.borderRadius = bodyEl.style.borderRadius || '6px';
          bodyEl.parentNode.insertBefore(container, bodyEl.nextSibling);
          bodyEl.style.display = 'none';
        } else {
          // no textarea present; attempt to find a placeholder container inside editorArea
          const editorArea = document.getElementById('editorArea');
          if(editorArea){
            container = document.getElementById('monacoContainer');
            if(!container){
              container = document.createElement('div'); container.id = 'monacoContainer'; container.style.minHeight = '420px'; container.style.border = '1px solid #ddd'; container.style.borderRadius = '6px'; container.style.overflow = 'hidden';
              // put container at top of editorArea
              editorArea.insertBefore(container, editorArea.firstChild);
            }
          }
        }
      }
      if(!container) return;
      try{
        // load Monaco loader and editor from CDN
        if(!window.require){ await loadScript('https://cdn.jsdelivr.net/npm/monaco-editor@0.34.1/min/vs/loader.js'); }
        // configure path
        if(window.require){ window.require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.34.1/min/vs' } }); }
        await new Promise((res,rej)=>{
          try{
            window.require(['vs/editor/editor.main'], ()=>{ res(); }, (err)=>{ rej(err); });
          }catch(e){ rej(e); }
        });
        // create editor
        monacoEditor = window.monaco.editor.create(container, { value: (bodyEl && bodyEl.value) || '', language: 'markdown', automaticLayout: true, minimap: { enabled: false }, theme: 'vs-dark' });
        usingMonaco = true;
        // wire change -> preview
        monacoEditor.onDidChangeModelContent(debouncedRender);

        // If index viewer container exists, create a read-only Monaco JSON viewer
        try{
          const idxContainer = document.getElementById('indexMonacoContainer');
          if(idxContainer){
            // create a model for JSON and assign to readonly editor
            monacoJsonEditor = window.monaco.editor.create(idxContainer, { value: '', language: 'json', automaticLayout: true, readOnly: true, minimap: { enabled: false }, theme: 'vs-dark' });
          }
        }catch(e){ console.warn('Failed to create index Monaco viewer', e); }
      }catch(e){
        // fallback: remove container and show textarea
        console.warn('Monaco load failed, using textarea fallback', e);
        if(container && container.parentNode) container.remove();
        bodyEl.style.display = '';
        usingMonaco = false;
      }
    }
    // setActiveTab dynamically finds the editor host (monaco container or textarea) each time
    function setActiveTab(which){
      const showEditor = (which === 'edit');
      const currentEditorHost = document.getElementById('monacoContainer') || bodyEl;
      if(currentEditorHost) currentEditorHost.style.display = showEditor ? '' : 'none';
      if(previewEl) previewEl.style.display = showEditor ? 'none' : '';
      if(showEditor){ tabEdit && tabEdit.classList.add('active'); tabPreview && tabPreview.classList.remove('active'); }
      else { tabEdit && tabEdit.classList.remove('active'); tabPreview && tabPreview.classList.add('active'); }
      // If showing Monaco, ensure layout is correct
      if(showEditor && window.monaco && monacoEditor){ try{ monacoEditor.layout(); }catch(e){} }
    }

    // render preview using admin renderer if available (falls back to marked)
    function renderPreview(){
      const md = usingMonaco && monacoEditor ? monacoEditor.getValue() : ((bodyEl && bodyEl.value) || '');
      let html = '';
      try{
        if(window.renderAdminMarkdown) html = window.renderAdminMarkdown(md);
        else if(window.marked) html = marked.parse(md);
        else html = escapeHtml(md).replace(/\n/g,'<br>');
      }catch(e){ html = `<pre>${escapeHtml(String(e))}</pre>`; }
      if(previewEl) previewEl.innerHTML = html;
      if(window.adjustAdminImageSrcs) try{ window.adjustAdminImageSrcs(previewEl); }catch(e){}
    }

    // debounce helper
    function debounce(fn,wait){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); }; }
    const debouncedRender = debounce(renderPreview, 220);

    if(tabEdit) tabEdit.addEventListener('click', ()=>{ setActiveTab('edit'); });
    if(tabPreview) tabPreview.addEventListener('click', ()=>{ setActiveTab('preview'); renderPreview(); });

  if(bodyEl){ bodyEl.addEventListener('input', ()=>{ if(previewEl && previewEl.style.display !== 'none'){ debouncedRender(); } }); }

    // attempt to initialize Monaco (non-blocking)
  initMonacoIfAvailable();

  // Function to refresh computed index.json viewer
  async function refreshIndexViewer(){
    const url = '/posts/index.json';
    const container = document.getElementById('indexMonacoContainer');
    try{
      const r = await fetch(url);
      if(!r.ok) throw new Error('Failed to fetch index.json');
      const j = await r.json();
      const pretty = JSON.stringify(j, null, 2);
      if(monacoJsonEditor && window.monaco){
        try{ monacoJsonEditor.setValue(pretty); }catch(e){ /* ignore */ }
      } else if(container){
        container.textContent = pretty;
        container.style.whiteSpace = 'pre';
        container.style.fontFamily = 'monospace';
        container.style.padding = '0.5rem';
      }
      // render visualization
      try{ renderIndexViz(j); }catch(e){}
      // populate posts select for edit/delete
      try{ populatePostSelect(j); }catch(e){ console.warn('populatePostSelect failed', e); }
    }catch(e){
      if(container) container.textContent = `Error loading index.json: ${String(e)}`;
    }
  }

  // load initial index.json into viewer (non-blocking)
  setTimeout(()=>{ try{ refreshIndexViewer(); }catch(e){} }, 400);

  // Populate existing posts select
  function populatePostSelect(indexJson){
    const sel = document.getElementById('existingPosts');
    if(!sel) return;
    // gather files with their folder path
    const items = [];
    function walk(node, prefix){
      (node.files||[]).forEach(f=>{
        // prefer the 'file' field from index.json which is like '/posts/2025/example-post.md'
        const filePath = (f.file || '').replace(/^\/+/, '');
        const folder = prefix ? `/${prefix}/` : '/';
        const filename = filePath.split('/').pop() || f.slug || '';
        const title = (f.meta && f.meta.Title) || f.slug || filename;
        items.push({ label: `${folder}${filename}`, path: filePath, title: title, description: f.meta && f.meta.Description });
      });
      Object.keys(node.folders||{}).forEach(k=> walk(node.folders[k], prefix? `${prefix}/${k}` : k));
    }
    // root files
    (indexJson.files||[]).forEach(f=>{
      const filePath = (f.file || '').replace(/^\/+/, '');
      const filename = filePath.split('/').pop() || f.slug || '';
      const title = (f.meta && f.meta.Title) || f.slug || filename;
      items.push({ label: `/${filename}`, path: filePath, title, description: f.meta && f.meta.Description });
    });
    Object.keys(indexJson.folders||{}).forEach(k=> walk(indexJson.folders[k], k));
    // build options
    // build option text: show truncated title up to 12 chars with ellipsis
    sel.innerHTML = '<option value="">-- Select post --</option>' + items.map(it=>{
      const t = String(it.title || '');
      const display = t.length > 12 ? t.slice(0,12) + '…' : t;
      const opt = document.createElement('option');
      opt.value = encodeURIComponent(it.path);
      opt.textContent = `${it.label} — ${display}`;
      opt.title = `${it.title}${it.description ? ' — ' + it.description : ''}`;
      return opt.outerHTML;
    }).join('');
    // store map for easy lookup (keyed by encoded path)
    sel._items = items.reduce((acc,it)=>{ acc[encodeURIComponent(it.path)] = it; return acc; }, {});
  }

  // Load post into editor given selected path
  async function loadSelectedPost(){
    const sel = document.getElementById('existingPosts');
    if(!sel) return alert('No select found');
    const v = sel.value;
    if(!v) return alert('Choose a post');
    const decoded = decodeURIComponent(v);
    try{
      const res = await authFetch('/.netlify/functions/getPost?path=' + encodeURIComponent(decoded), { method: 'GET' });
      if(!res.ok) return alert('Failed to load post');
      const j = await res.json();
      if(!j || !j.ok) return alert('Load failed: ' + JSON.stringify(j));
      // populate fields: meta and body
      const meta = j.meta || {};
      document.getElementById('postTitle').value = meta.Title || '';
      document.getElementById('postDescription').value = meta.Description || '';
      document.getElementById('postImageURL').value = meta.ImageURL || '';
      document.getElementById('postDate').value = meta.Date || '';
      // set filename and location
      const fullPath = (j.path || decoded).replace(/^posts\//,'');
      const parts = fullPath.split('/');
      const filename = parts.pop();
      const folder = parts.join('/');
      document.getElementById('postFilename').value = filename;
      if(folder) document.getElementById('postLocation').value = `/${folder}/`;
      // body
      if(usingMonaco && monacoEditor){ monacoEditor.setValue(j.content || j.body || ''); }
      else { const t = document.getElementById('postBody'); if(t) t.value = j.content || j.body || ''; }
      // switch to edit tab
      setActiveTab('edit');
    }catch(e){ alert('Error loading post: ' + String(e)); }
  }

  // Delete selected post
  async function deleteSelectedPost(){
    const sel = document.getElementById('existingPosts'); if(!sel) return;
    const v = sel.value; if(!v) return alert('Choose a post to delete');
    const decoded = decodeURIComponent(v);
    if(!confirm(`Delete post ${decoded}? This cannot be undone.`)) return;
    try{
      const res = await authFetch('/.netlify/functions/deletePost', { method: 'POST', body: JSON.stringify({ path: decoded }) });
      const j = await res.json();
      if(!res.ok) return alert('Delete failed: ' + JSON.stringify(j));
      await fetchFolders(); await refreshIndexViewer();
      alert('Deleted: ' + decoded);
    }catch(e){ alert('Delete error: ' + String(e)); }
  }

  // Delete folder of selected post
  async function deleteSelectedFolder(){
    const sel = document.getElementById('existingPosts'); if(!sel) return;
    const v = sel.value; if(!v) return alert('Choose a post to delete its folder');
    const decoded = decodeURIComponent(v);
    // infer folder
    const rel = decoded.replace(/^posts\//,'');
    const parts = rel.split('/');
    if(parts.length <= 1) return alert('Root-level file; no folder to delete');
    parts.pop();
    const folder = parts.join('/');
    if(!confirm(`Delete entire folder /${folder}/ and all its posts? This cannot be undone.`)) return;
    try{
      const res = await authFetch('/.netlify/functions/deleteFolder', { method: 'POST', body: JSON.stringify({ folder }) });
      const j = await res.json();
      if(!res.ok) return alert('Delete folder failed: ' + JSON.stringify(j));
      await fetchFolders(); await refreshIndexViewer();
      alert('Deleted folder: /' + folder + '/');
    }catch(e){ alert('Delete folder error: ' + String(e)); }
  }

  // Visualization using React Flow (UMD via CDN) with graceful fallback to nested list.
  async function renderIndexViz(indexJson){
    const container = document.getElementById('indexViz');
    if(!container) return;
    container.innerHTML = '';

    // Try to load React/ReactDOM and React Flow UMD from CDN and render interactive flow.
    // If anything fails, gracefully fall back to a nested list.
    try{
      // helper to inject script/link and await load
      function loadScriptTag(src){ return new Promise((res, rej)=>{ const s = document.createElement('script'); s.src = src; s.async = false; s.onload = ()=>res(); s.onerror = (e)=>rej(e); document.head.appendChild(s); }); }
      function loadCss(href){ const l = document.createElement('link'); l.rel='stylesheet'; l.href = href; document.head.appendChild(l); }

      // Load UMD builds (React 17 and matching ReactDOM) and React Flow UMD. These are best-effort and may be cached.
      if(!window.React) await loadScriptTag('https://unpkg.com/react@17/umd/react.production.min.js');
      if(!window.ReactDOM) await loadScriptTag('https://unpkg.com/react-dom@17/umd/react-dom.production.min.js');
      // React Flow UMD — try common CDN path for the UMD bundle
      if(!window.ReactFlow && !window.ReactFlowRenderer) {
        try{
          // load css first
          loadCss('https://unpkg.com/react-flow-renderer@9.6.8/dist/style.css');
          await loadScriptTag('https://unpkg.com/react-flow-renderer@9.6.8/dist/react-flow-renderer.min.js');
        }catch(err){
          // attempt alternate path
          await loadScriptTag('https://unpkg.com/react-flow-renderer/dist/react-flow-renderer.min.js');
        }
      }

      const React = window.React;
      const ReactDOM = window.ReactDOM;
      const RF = window.ReactFlow || window.ReactFlowRenderer || window.ReactFlowRendererDefault || window.ReactFlowRendererLib || window.ReactFlow;
      if(!React || !ReactDOM || !RF) throw new Error('React/ReactDOM/ReactFlow not available');

      const ReactFlowComp = RF.ReactFlow || RF.default || RF;
      const Background = RF.Background || RF.DefaultBackground || null;
      const Controls = RF.Controls || RF.DefaultControls || null;

      // Build nodes and edges using indexJson; nodes show truncated title, full title/description in tooltip
      const nodes = [];
      const edges = [];
      let nextXByDepth = {};
      function walk(node, prefix, depth, parentId){
        (node.files||[]).forEach(f=>{
          const filePath = (f.file || '').replace(/^\/+/, '');
          const id = filePath || (`${prefix}/${f.slug||''}`);
          const title = (f.meta && f.meta.Title) || f.slug || id;
          // position
          nextXByDepth[depth] = (nextXByDepth[depth] || 0) + 1;
          const x = nextXByDepth[depth] * 180;
          const y = depth * 120 + 20;
          nodes.push({ id, position: { x, y }, data: { label: title.length > 12 ? title.slice(0,12) + '…' : title, fullTitle: title, description: (f.meta && f.meta.Description) || '' }, style: { width: 160 } });
          if(parentId) edges.push({ id: `${parentId}->${id}`, source: parentId, target: id });
        });
        Object.keys(node.folders || {}).forEach(k=>{
          const fid = prefix ? `${prefix}/${k}` : k;
          nextXByDepth[depth] = (nextXByDepth[depth] || 0) + 1;
          const x = nextXByDepth[depth] * 180;
          const y = depth * 120;
          const folderId = fid + '::folder';
          nodes.push({ id: folderId, position:{ x, y }, data: { label: k, fullTitle: k, description: '' }, style: { background: '#1f6feb', color: '#fff' } });
          if(parentId) edges.push({ id: `${parentId}->${folderId}`, source: parentId, target: folderId });
          walk(node.folders[k], fid, depth+1, folderId);
        });
      }

      // root handling
      const rootId = '/::root';
      nodes.push({ id: rootId, position:{ x: 80, y: 0 }, data: { label: 'root', fullTitle: 'root' } });
      walk(indexJson, '', 1, rootId);

      // mount
      const mount = document.createElement('div'); mount.style.width='100%'; mount.style.height='480px'; container.appendChild(mount);

      // React component wrapper
      const App = ()=>{
        const [nState] = React.useState(nodes);
        const [eState] = React.useState(edges);
        // custom node render not necessary; use default and tooltip via DOM mouse events
        return React.createElement('div', { style:{ width:'100%', height:'100%' } }, React.createElement(ReactFlowComp, { nodes: nState, edges: eState, fitView: true }, Background ? React.createElement(Background) : null, Controls ? React.createElement(Controls) : null));
      };

      ReactDOM.render(React.createElement(App), mount);
      // small post-render pass to attach native tooltips (title) to node DOM elements
      setTimeout(()=>{
        try{
          const nodeEls = mount.querySelectorAll('.react-flow__node');
          nodeEls.forEach(el => {
            const id = el.getAttribute('data-id') || el.getAttribute('data-nodeid') || el.getAttribute('data-node-id');
            const node = nodes.find(n=>n.id === id);
            if(node){
              el.title = `${node.data.fullTitle}${node.data.description ? ' — ' + node.data.description : ''}`;
            }
          });
        }catch(e){/* ignore */}
      }, 300);
    }catch(err){
      console.warn('React Flow failed to load or render, falling back to nested list', err);
      const ul = document.createElement('ul'); ul.style.listStyle='none'; ul.style.paddingLeft='0';
      function makeFolderNode(name, node){
        const li = document.createElement('li');
        const title = document.createElement('div'); title.style.fontWeight = '600'; title.style.cursor = 'pointer'; title.textContent = name + (node.files ? ` (${node.files.length})` : '');
        const inner = document.createElement('ul'); inner.style.marginLeft = '0.75rem'; inner.style.listStyle = 'none';
        (node.files||[]).forEach(f=>{ const fi = document.createElement('li'); fi.textContent = (f.meta && f.meta.Title) || f.slug || (f.file || 'file'); inner.appendChild(fi); });
        Object.keys(node.folders || {}).forEach(k=>{ inner.appendChild(makeFolderNode(k, node.folders[k])); });
        li.appendChild(title); li.appendChild(inner);
        title.addEventListener('click', ()=>{ inner.style.display = inner.style.display === 'none' ? '' : 'none'; });
        return li;
      }
      if(indexJson.files && indexJson.files.length){ const filesLi = document.createElement('li'); const filesTitle = document.createElement('div'); filesTitle.textContent='Root files'; filesTitle.style.fontWeight='700'; filesLi.appendChild(filesTitle); const fUl=document.createElement('ul'); fUl.style.listStyle='none'; fUl.style.paddingLeft='0.5rem'; (indexJson.files||[]).forEach(f=>{ const li=document.createElement('li'); li.textContent=(f.meta && f.meta.Title) || f.slug || (f.file||'file'); fUl.appendChild(li); }); filesLi.appendChild(fUl); ul.appendChild(filesLi); }
      Object.keys(indexJson.folders || {}).forEach(k=>{ ul.appendChild(makeFolderNode(k, indexJson.folders[k])); });
      container.appendChild(ul);
    }
  }

    // start in edit mode
    setActiveTab('edit');

  const saveBtn = document.getElementById('savePostBtn');
    if(saveBtn) saveBtn.addEventListener('click', async ()=>{
      const payload = {
        title: (document.getElementById('postTitle') && document.getElementById('postTitle').value.trim()) || '',
        description: (document.getElementById('postDescription') && document.getElementById('postDescription').value.trim()) || '',
        body: (usingMonaco && monacoEditor) ? monacoEditor.getValue() : ((document.getElementById('postBody') && document.getElementById('postBody').value) || ''),
        imageURL: (document.getElementById('postImageURL') && document.getElementById('postImageURL').value.trim()) || 'image',
        filename: (document.getElementById('postFilename') && document.getElementById('postFilename').value.trim()) || undefined,
        location: (document.getElementById('newPostLocation') && document.getElementById('newPostLocation').value.trim()) || (document.getElementById('postLocation') && document.getElementById('postLocation').value) || '/',
        date: (document.getElementById('postDate') && document.getElementById('postDate').value.trim()) || undefined
      };
      if(!payload.title) return alert('Title is required');
      const res = await authFetch('/.netlify/functions/createOrUpdatePost', { method: 'POST', body: JSON.stringify(payload) });
      const j = await res.json();
      const out = document.getElementById('saveResult'); if(out) out.textContent = res.ok ? `Saved: ${j.path}` : `Error: ${JSON.stringify(j)}`;
      if(res.ok) {
        await fetchFolders();
        try{ await refreshIndexViewer(); }catch(e){}
        if(j && j.build){
          showBuildModalText(j.build.ok ? 'Build succeeded' : 'Build failed');
          console.log('Build details:', j.build);
        }
      }
      // update preview if visible
      if(previewEl && previewEl.style.display !== 'none') renderPreview();
    });

    const logoutBtn = document.getElementById('logoutBtn');
    if(logoutBtn) logoutBtn.addEventListener('click', ()=>{ localStorage.removeItem(tokenKey); location.reload(); });

    // Refresh index button
    const refreshBtn = document.getElementById('refreshIndexBtn');
    if(refreshBtn){
      refreshBtn.addEventListener('click', async ()=>{
        refreshBtn.disabled = true;
        try{
          const res = await authFetch('/.netlify/functions/rebuildIndex', { method: 'POST' });
          const j = await res.json();
          if(res.ok && j && j.build){
            showBuildModalText(j.build.ok ? 'Build succeeded' : 'Build failed');
            console.log('Build details:', j.build);
          } else {
            showBuildModalText('Build failed');
          }
  }catch(e){ showBuildModalText('Build failed'); }
        try{ await refreshIndexViewer(); }catch(e){}
        refreshBtn.disabled = false;
      });
    }

    const closeModalBtn = document.getElementById('closeBuildModal');
    if(closeModalBtn) closeModalBtn.addEventListener('click', hideBuildModal);
  // close when clicking backdrop
  const modalBackdrop = document.querySelector('#buildModal .modal-backdrop');
  if(modalBackdrop) modalBackdrop.addEventListener('click', hideBuildModal);
    // wire load/delete folder buttons
    const loadBtn = document.getElementById('loadPostBtn'); if(loadBtn) loadBtn.addEventListener('click', ()=>{ loadSelectedPost(); });
    const delBtn = document.getElementById('deletePostBtn'); if(delBtn) delBtn.addEventListener('click', ()=>{ deleteSelectedPost(); });
    const delFolderBtn = document.getElementById('deleteFolderBtn'); if(delFolderBtn) delFolderBtn.addEventListener('click', ()=>{ deleteSelectedFolder(); });
  }

  // initialize
  (async ()=>{ await fetchFolders(); wire(); })();
})();
