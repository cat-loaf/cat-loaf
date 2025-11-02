// post.js
// Load a markdown file from /posts/<year>/<slug>.md and render it inside posts.html
// Behavior:
// - URL: /posts/<year>/<slug>  OR  /posts/<slug> (will try known years)
// - parses a special header block between <!-- $header --> and <!-- $/header -->
//   with lines like: Key: "value"
// - adjusts image srcs that are relative to be served from /public/posts/

 (function(){
  const INDEX_PATH = '/posts/index.json';

  function showError(root){
    root.innerHTML = `\n      <div style="padding:2rem;">\n        <h2>Not found</h2>\n        <p>The requested post or folder couldn't be found.</p>\n      </div>`;
  }

  function parseHeader(md){
    const startMarker = '<!-- $header -->';
    const endMarker = '<!-- $/header -->';
    const start = md.indexOf(startMarker);
    const end = md.indexOf(endMarker);
    const meta = {};
    if(start !== -1 && end !== -1 && end > start){
      const chunk = md.slice(start + startMarker.length, end).trim();
      const lines = chunk.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
      for(const line of lines){
        const m = line.match(/^([A-Za-z0-9_]+):\s*"([\s\S]*?)"$/);
        if(m) meta[m[1]] = m[2];
      }
      md = md.slice(0, start) + md.slice(end + endMarker.length);
    }
    return { md: md.trim(), meta };
  }

  function adjustImageSrcs(container){
    const imgs = container.querySelectorAll('img');
    imgs.forEach(img => {
      const src = img.getAttribute('src') || '';
      if(!src) return;
      if(src.startsWith('http') || src.startsWith('/')) return; // leave alone
      const newSrc = `/public/posts/${src}`;
      img.setAttribute('src', newSrc);
    });
  }

  // Try to find a representative image for a folder by checking a sequence
  // of candidate files under /public/posts/. Candidates tried (in order):
  // 1) joined pathParts with dots: a.b.c.png/jpg...
  // 2) last segment alone: c.png/jpg...
  // Returns a Promise<string|null>
  // Cache and deduplicate folder image probes to avoid repeated HEAD requests
  const _folderImageCache = new Map(); // key -> Promise<string|null> or string|null
  async function findFolderImage(pathParts){
    if(!pathParts || pathParts.length===0) return null;
    const exts = ['png','jpg','jpeg','webp','gif'];
    const dotted = pathParts.join('.');
    const last = pathParts[pathParts.length-1];

    // Build ordered candidate URLs
    const candidates = [];
    if(dotted) for(const e of exts) candidates.push(`/public/posts/${dotted}.${e}`);
    if(last) for(const e of exts) candidates.push(`/public/posts/${last}.${e}`);

    // Use the dotted name as the cache key when present, otherwise the last segment
    const cacheKey = dotted || last;
    if(!cacheKey) return null;

    // If we've resolved this key before, return cached value (may be null)
    if(_folderImageCache.has(cacheKey)){
      const v = _folderImageCache.get(cacheKey);
      // If stored value is a Promise, await it; if string or null, return directly
      if(v && typeof v.then === 'function') return await v;
      return v;
    }

    // Start probe and store the in-progress promise so concurrent callers reuse it
    const probe = (async ()=>{
      for(const url of candidates){
        try{
          const r = await fetch(url, { method: 'HEAD' });
          if(r && r.ok) return url;
        }catch(e){ /* ignore individual probe errors */ }
      }
      return null;
    })();
    _folderImageCache.set(cacheKey, probe);
    try{
      const resolved = await probe;
      // store final resolved value (string|null)
      _folderImageCache.set(cacheKey, resolved);
      return resolved;
    }catch(e){
      _folderImageCache.set(cacheKey, null);
      return null;
    }
  }
  // helper: escape string for regex
  function escapeForRegex(s){
    return (s||'').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Helpers to safely decode/encode URL path segments (used by routing and link-building)
  function safeDecodeSegment(seg){
    if(!seg) return seg;
    try{ return decodeURIComponent(String(seg).replace(/\+/g, ' ')); }catch(e){ return seg; }
  }
  function encodePathFromParts(parts){
    return (parts||[]).map(p => encodeURIComponent(String(p))).join('/');
  }
  // Encode a path or URL to be safe for fetch(): for full http(s) URLs use encodeURI, otherwise encode each segment
  function encodeFetchPath(fp){
    if(!fp || typeof fp !== 'string') return fp;
    if(fp.startsWith('http://') || fp.startsWith('https://')) return encodeURI(fp);
    // split on '/', preserve leading empty segment for absolute paths
    const parts = fp.split('/');
    return parts.map(p => encodeURIComponent(p)).join('/');
  }

  // Convert special GitHub-style callouts in blockquotes into HTML callout blocks.
  // Syntax: > [!NOTE] Optional Title\n> content lines...
  function processCallouts(md){
    const lines = md.split(/\r?\n/);
    const out = [];
    let i = 0;
    while(i < lines.length){
      const line = lines[i];
      const m = line.match(/^> \s*\[!(NOTE|TIP|WARNING|CAUTION|IMPORTANT|BUG|INFO|QUESTION)\]\s*(.*)$/i);
      if(m){
        const type = (m[1]||'NOTE').toLowerCase();
        const title = (m[2]||'').trim();
        // collect subsequent > lines
        i++;
        const bodyLines = [];
        while(i < lines.length){
          const l = lines[i];
          if(l.startsWith('>')){
            bodyLines.push(l.replace(/^>\s?/, ''));
            i++; continue;
          }
          // stop on blank line not starting with > or new block
          break;
        }
        const bodyMd = bodyLines.join('\n');
        const innerHtml = marked.parse(bodyMd);
        const titleHtml = title ? `<div class="callout-title">${escapeHtml(title)}</div>` : '';
        // include an inline SVG icon per callout type
        const icons = {
          note: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="4" width="14" height="16" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M7 8h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
          tip: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 18h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M12 2a5 5 0 0 0-3 9v3a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-3a5 5 0 0 0-3-9z" stroke="currentColor" stroke-width="1.5" fill="currentColor" opacity="0.03"/></svg>',
          warning: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" stroke-width="1.2"/><path d="M12 9v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M12 17h.01" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
          important: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/><path d="M12 7v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M12 16h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
          info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/><path d="M12 10h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M11 14h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
          bug: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 8l-4 1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M4 8l4 1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M12 3v4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M8 21a6 6 0 0 1 8 0" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
          question: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 18h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M10.5 9.5a2 2 0 1 1 3 1.5c-.5.5-.5 1.5-.5 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'
        };
        const icon = icons[type] || icons.note;
        const headerHtml = `<div class="callout-header"><span class="callout-icon">${icon}</span>${titleHtml}</div>`;
        out.push(`<div class="callout callout-${type}">${headerHtml}<div class="callout-body">${innerHtml}</div></div>`);
        continue;
      }
      out.push(line);
      i++;
    }
    return out.join('\n');
  }

  // perform a recursive search under `node` (basePathParts) for rawQuery
  // supports /regex/ (when query is wrapped in slashes) and wildcard '*' in queries
  async function doSearch(node, basePathParts, rawQuery, filter){
    const q = (rawQuery||'').trim();
    if(!q) return [];
    let re = null;
    if(q.length >=2 && q[0] === '/' && q[q.length-1] === '/'){
      try{ re = new RegExp(q.slice(1,-1), 'i'); }catch(e){ re = new RegExp(escapeForRegex(q.slice(1,-1)), 'i'); }
    } else if(q.indexOf('*') !== -1){
      // convert wildcard to regex
      const converted = escapeForRegex(q).replace(/\\\*/g, '.*');
      re = new RegExp(converted, 'i');
    } else {
      re = new RegExp(escapeForRegex(q), 'i');
    }

    const descendants = collectDescendants(node, basePathParts);
    const out = [];
    for(const it of descendants){
      const name = (it.type === 'folder') ? it.name : (it.file && (it.file.meta && it.file.meta.Title ? it.file.meta.Title : it.file.slug));
      const desc = (it.type === 'file' && it.file && it.file.meta && it.file.meta.Description) ? it.file.meta.Description : '';
      const slug = (it.type === 'file' && it.file) ? it.file.slug : it.name;
      const hay = `${name || ''}\n${desc || ''}\n${slug || ''}`;
      if(re.test(hay)){
        const item = Object.assign({}, it);
        item.name = name || it.name;
        item.mtimeMs = (it.type === 'folder') ? (it.node && it.node.mtimeMs ? it.node.mtimeMs : 0) : (it.file && it.file.mtimeMs ? it.file.mtimeMs : 0);
        out.push(item);
      }
    }
    // apply filter
    if(filter === 'files') return out.filter(x=>x.type === 'file');
    if(filter === 'folders') return out.filter(x=>x.type === 'folder');
    return out;
  }



  // render a single card HTML for a match item (folder or file)
  async function renderCardHtml(it){
    if(it.type === 'folder'){
      const count = countFiles(it.node);
      if(!count) return '';
    // prefer precomputed cover in index.json if available
    let img = (it.node && it.node.cover) ? it.node.cover : null;
      if(img && !img.startsWith('/')) img = '/' + img.replace(/^\/+/, '');
      let imgHtml = '';
      if(img){
        imgHtml = `<div class="card-image"><img src="${img}" alt="${escapeHtml(it.name)}"/></div>`;
      } else {
        // render nicer placeholder for numeric/year folders
        const isYear = /^\d{4}$/.test(String(it.name));
        const isNumber = /^\d+$/.test(String(it.name));
        const cls = isYear || isNumber ? 'card-image placeholder year' : 'card-image placeholder';
        imgHtml = `<div class="${cls}"><span class="placeholder-text">${escapeHtml(it.name)}</span></div>`;
      }
  return `<article class="post-card" data-title="${escapeHtml(it.name).toLowerCase()}"><a class="card-link" href="/posts/${encodePathFromParts(it.pathParts||[])}/">${imgHtml}<div class="card-body"><h3>${escapeHtml(it.name)}</h3><p>${count} post${count!==1?'s':''}</p></div></a></article>`;
    } else {
      const p = it.file;
      const t = p.meta && p.meta.Title ? p.meta.Title : p.slug;
      const desc = p.meta && p.meta.Description ? p.meta.Description : '';
      // prefer cover provided by the index (file.cover), then meta.ImageURL; do not probe at runtime
      let img = p.cover || '';
      // only accept meta.ImageURL if it's absolute (http) or an absolute path
      if(!img && p.meta && p.meta.ImageURL){
        const m = p.meta.ImageURL;
        if(m.startsWith('http://') || m.startsWith('https://') || m.startsWith('/')) img = m;
      }
      if(img && !img.startsWith('http') && !img.startsWith('/')) img = `/public/posts/${img}`;
      const imgHtml = img ? `<div class="card-image"><img src="${img}" alt="${escapeHtml(t)}"/></div>` : `<div class="card-image placeholder">${escapeHtml(t)}</div>`;
      // build an encoded href for the file path
      const fileHref = '/posts/' + encodePathFromParts(String(p.path || p.file || '').split('/'));
      return `<article class="post-card" data-title="${escapeHtml(t).toLowerCase()}"><a class="card-link" href="${fileHref}">${imgHtml}<div class="card-body"><h3>${escapeHtml(t)}</h3><p>${escapeHtml(desc)}</p></div></a></article>`;
    }
  }

  async function renderRootIndex(root, index){
    // Combine folders and root files and sort by mtime (newest first)
    const items = [];
    for(const fname of Object.keys(index.folders || {})){
      const node = index.folders[fname];
      items.push({ type: 'folder', name: fname, node, mtimeMs: node.mtimeMs || 0, pathParts: [fname] });
    }
    for(const f of (index.files || [])){
      items.push({ type: 'file', name: f.slug, file: f, mtimeMs: f.mtimeMs || 0 });
    }
    items.sort((a,b)=> (b.mtimeMs||0) - (a.mtimeMs||0));

  let html = '<div class="container"><h1>Posts</h1>';
  html += `<div class="search-controls" style="margin:0.5rem 0;">
      <input id="posts-search" type="text" placeholder="Search posts and folders (supports * wildcard or /regex/)" />
      <select id="posts-filter"><option value="all">All</option><option value="files">Only posts</option><option value="folders">Only folders</option></select>
      <select id="posts-sort"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name-asc">Name ↑</option><option value="name-desc">Name ↓</option></select>
      <button id="posts-clear" class="btn-clear" style="display:none">← Back</button>
    </div>`;
  // empty grid - we'll populate it via renderRootGrid so we can re-render on filter/sort changes
  html += '<div class="posts-grid" id="posts-grid"></div></div>';
  root.innerHTML = html;

  // set document title for root posts index
  try{ document.title = (index && index.title) ? index.title : 'Posts'; }catch(e){}

  // helper to render the main grid with sorting/filtering
  async function renderRootGrid(allItems, filterValue, sortValue){
    const grid = document.getElementById('posts-grid');
    if(!grid) return;
    grid.innerHTML = '';
    // apply filter
    let toRender = allItems.slice();
    if(filterValue === 'files') toRender = toRender.filter(x=>x.type === 'file');
    if(filterValue === 'folders') toRender = toRender.filter(x=>x.type === 'folder');
    // apply sort
    toRender.sort((a,b)=>{
      if(sortValue === 'name-asc') return ((a.name||'') > (b.name||''))?1:-1;
      if(sortValue === 'name-desc') return ((a.name||'') < (b.name||''))?1:-1;
      const am = a.mtimeMs || 0; const bm = b.mtimeMs || 0;
      return sortValue === 'oldest' ? am - bm : bm - am;
    });
    // build cards
    if(toRender.length === 0){ grid.innerHTML = '<p>No posts or folders found.</p>'; return; }
    // render cards in parallel to avoid serial await delays
    const cardPromises = toRender.map(it => renderCardHtml(it.type === 'file' ? Object.assign({}, it, { pathParts: it.pathParts || [] }) : it));
    const cardHtmls = await Promise.all(cardPromises);
    for(let i=0;i<cardHtmls.length;i++){
      const htmlPiece = cardHtmls[i];
      // skip empty cards (e.g., empty folders)
      if(!htmlPiece) continue;
      grid.insertAdjacentHTML('beforeend', htmlPiece);
    }
  }
  // initial render
  await renderRootGrid(items, (document.getElementById('posts-filter')||{}).value || 'all', (document.getElementById('posts-sort')||{}).value || 'newest');

    // wire up root search controls
    const postsSearch = document.getElementById('posts-search');
    const postsFilter = document.getElementById('posts-filter');
    const postsSort = document.getElementById('posts-sort');
    const postsClear = document.getElementById('posts-clear');
    const postsGrid = document.getElementById('posts-grid');
    const postsResultsId = 'posts-results';
    function clearResults(){
      const existing = document.getElementById(postsResultsId);
      if(existing) existing.remove();
      postsGrid.style.display = '';
      postsClear.style.display = 'none';
    }
    async function runRootSearch(q){
      const filter = postsFilter.value || 'all';
      const sort = postsSort.value || 'newest';
      const matches = await doSearch(index, [], q, filter);
      // sort
      matches.sort((a,b)=>{
        if(sort === 'name-asc') return ((a.name||'') > (b.name||''))?1:-1;
        if(sort === 'name-desc') return ((a.name||'') < (b.name||''))?1:-1;
        const am = a.mtimeMs || 0; const bm = b.mtimeMs || 0;
        return sort === 'oldest' ? am - bm : bm - am;
      });
      // render results into a separate container
      let container = document.getElementById(postsResultsId);
      if(!container){ container = document.createElement('div'); container.id = postsResultsId; container.className = 'container'; postsGrid.insertAdjacentElement('afterend', container); }
      let html = `<h2>Search results</h2><div class="posts-grid">`;
        // render all result cards in parallel
        const resultPromises = matches.map(it => renderCardHtml(it));
        const resultHtmls = await Promise.all(resultPromises);
        for(const piece of resultHtmls) if(piece) html += piece;
      html += '</div>';
      container.innerHTML = html;
      postsGrid.style.display = 'none';
      postsClear.style.display = '';
    }
    if(postsSearch){
      postsSearch.addEventListener('input', async (e)=>{
        const raw = e.target.value || '';
        const q = raw.trim();
        if(!q){ clearResults(); return; }
        await runRootSearch(q);
      });
    }
    // re-run search when user changes filter or sort so they take effect immediately
    if(postsFilter){
      postsFilter.addEventListener('change', async ()=>{
        const q = (postsSearch.value||'').trim();
        if(!q){ await renderRootGrid(items, postsFilter.value, postsSort.value); return; }
        await runRootSearch(q);
      });
    }
    if(postsSort){
      postsSort.addEventListener('change', async ()=>{
        const q = (postsSearch.value||'').trim();
        if(!q){ await renderRootGrid(items, postsFilter.value, postsSort.value); return; }
        await runRootSearch(q);
      });
    }
    if(postsClear){ postsClear.addEventListener('click', async ()=>{ postsSearch.value = ''; clearResults(); await renderRootGrid(items, postsFilter.value, postsSort.value); }); }
  }

  function countFiles(node){
    if(!node) return 0;
    let total = (node.files && node.files.length) || 0;
    for(const k of Object.keys(node.folders || {})){
      total += countFiles(node.folders[k]);
    }
    return total;
  }

  async function renderFolder(root, folderPathParts, node){
    // folderPathParts: array of path segments leading to current folder
  const folderName = folderPathParts.length ? folderPathParts[folderPathParts.length-1] : 'Posts';
  // set document title for folder view
  try{ document.title = `Posts (${folderName})`; }catch(e){}
    let html = `<div class="container">`;
    // up link if parent exists
    if(folderPathParts.length){
      const parent = folderPathParts.slice(0, -1).join('/');
      const parentHref = parent ? `/posts/${encodePathFromParts(parent.split('/'))}/` : '/posts';
      html += `<div class="back-row"><a class="btn-back" href="${parentHref}">← Up</a></div>`;
    }
    html += `<h1>${escapeHtml(folderName)}</h1>`;

    // search bar with controls
    html += `<div class="search-controls" style="margin:0.5rem 0;">
      <input id="folder-search" type="text" placeholder="Search posts and folders (supports * wildcard or /regex/)" />
      <select id="folder-filter"><option value="all">All</option><option value="files">Only posts</option><option value="folders">Only folders</option></select>
      <select id="folder-sort"><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="name-asc">Name ↑</option><option value="name-desc">Name ↓</option></select>
      <button id="folder-clear" class="btn-clear" style="display:none">← Back</button>
    </div>`;
    // placeholder grid - we'll populate it via renderFolderGrid so changes to filter/sort re-render
    html += `<div class="posts-grid" id="folder-grid"></div></div>`;
    root.innerHTML = html;

    // combine folders and files
    const items = [];
    for(const k of Object.keys(node.folders || {})){
      const child = node.folders[k];
      items.push({ type: 'folder', name: k, node: child, mtimeMs: child.mtimeMs || 0, pathParts: [...folderPathParts, k] });
    }
    for(const f of (node.files || [])){
      items.push({ type: 'file', file: f, name: f.slug, mtimeMs: f.mtimeMs || 0, pathParts: [...folderPathParts] });
    }
    items.sort((a,b)=> (b.mtimeMs||0) - (a.mtimeMs||0));

    // helper to render the folder grid with filtering/sorting
    async function renderFolderGrid(allItems, filterValue, sortValue){
      const grid = document.getElementById('folder-grid');
      if(!grid) return;
      grid.innerHTML = '';
      let toRender = allItems.slice();
      if(filterValue === 'files') toRender = toRender.filter(x=>x.type === 'file');
      if(filterValue === 'folders') toRender = toRender.filter(x=>x.type === 'folder');
      toRender.sort((a,b)=>{
        if(sortValue === 'name-asc') return ((a.name||'') > (b.name||''))?1:-1;
        if(sortValue === 'name-desc') return ((a.name||'') < (b.name||''))?1:-1;
        const am = a.mtimeMs || 0; const bm = b.mtimeMs || 0;
        return sortValue === 'oldest' ? am - bm : bm - am;
      });
      if(toRender.length === 0){ grid.innerHTML = '<p>No posts in this folder.</p>'; return; }
      // render cards in parallel to avoid serial waits
      const cardPromises = toRender.map(it => renderCardHtml(it.type === 'file' ? Object.assign({}, it, { pathParts: it.pathParts || folderPathParts }) : it));
      const cardHtmls = await Promise.all(cardPromises);
      for(const htmlPiece of cardHtmls){ if(!htmlPiece) continue; grid.insertAdjacentHTML('beforeend', htmlPiece); }
    }

    // initial folder grid render
    await renderFolderGrid(items, (document.getElementById('folder-filter')||{}).value || 'all', (document.getElementById('folder-sort')||{}).value || 'newest');

    // wire up folder search (recursive) controls
    const search = document.getElementById('folder-search');
    const folderFilter = document.getElementById('folder-filter');
    const folderSort = document.getElementById('folder-sort');
    const folderClear = document.getElementById('folder-clear');
    const folderGrid = document.getElementById('folder-grid');
    const folderResultsId = 'folder-results';
    function clearFolderResults(){
      const existing = document.getElementById(folderResultsId);
      if(existing) existing.remove();
      folderGrid.style.display = '';
      folderClear.style.display = 'none';
    }
    async function runFolderSearch(q){
      const filter = folderFilter.value || 'all';
      const sort = folderSort.value || 'newest';
      const matches = await doSearch(node, folderPathParts, q, filter);
      matches.sort((a,b)=>{
        if(sort === 'name-asc') return ((a.name||'') > (b.name||''))?1:-1;
        if(sort === 'name-desc') return ((a.name||'') < (b.name||''))?1:-1;
        const am = a.mtimeMs || 0; const bm = b.mtimeMs || 0;
        return sort === 'oldest' ? am - bm : bm - am;
      });
      let container = document.getElementById(folderResultsId);
      if(!container){ container = document.createElement('div'); container.id = folderResultsId; container.className = 'container'; folderGrid.insertAdjacentElement('afterend', container); }
      let html = `<h2>Search results</h2><div class="posts-grid">`;
  // render folder search results in parallel
  const resPromises = matches.map(it => renderCardHtml(it));
  const resHtmls = await Promise.all(resPromises);
  for(const p of resHtmls) if(p) html += p;
      html += '</div>';
      container.innerHTML = html;
      folderGrid.style.display = 'none';
      folderClear.style.display = '';
    }
    if(search){
      search.addEventListener('input', async (e)=>{
        const raw = e.target.value || '';
        const q = raw.trim();
        if(!q){ clearFolderResults(); return; }
        await runFolderSearch(q);
      });
    }
    // re-run folder search when filter/sort changes
    if(folderFilter){
      folderFilter.addEventListener('change', async ()=>{
        const q = (search.value||'').trim();
        if(!q){ await renderFolderGrid(items, folderFilter.value, folderSort.value); return; }
        await runFolderSearch(q);
      });
    }
    if(folderSort){
      folderSort.addEventListener('change', async ()=>{
        const q = (search.value||'').trim();
        if(!q){ await renderFolderGrid(items, folderFilter.value, folderSort.value); return; }
        await runFolderSearch(q);
      });
    }
    if(folderClear){ folderClear.addEventListener('click', async ()=>{ search.value = ''; clearFolderResults(); await renderFolderGrid(items, folderFilter.value, folderSort.value); }); }
  }

  // collect all descendant files and folders under a node. Returns items with type folder|file
  function collectDescendants(node, basePathParts){
    const out = [];
    // include the immediate folders as folder items and recurse
    for(const k of Object.keys(node.folders || {})){
      const child = node.folders[k];
      const pathParts = [...(basePathParts||[]), k];
      out.push({ type: 'folder', name: k, node: child, pathParts });
      // recurse
      const deeper = collectDescendants(child, pathParts);
      for(const d of deeper) out.push(d);
    }
    // include files
    for(const f of (node.files || [])){
      const pathParts = [...(basePathParts||[])];
      out.push({ type: 'file', file: f, pathParts });
    }
    return out;
  }

  async function renderPostFromFile(root, filePath, folderName){
    try{
      // normalize filePath which may be a string or an object from the index
      let fetchPath = filePath;
      if(typeof fetchPath !== 'string'){
        if(fetchPath && typeof fetchPath === 'object') fetchPath = fetchPath.path || fetchPath.file || fetchPath.filePath || null;
        else fetchPath = null;
      }
      if(!fetchPath){ showError(root); return; }
      const res = await fetch(encodeFetchPath(fetchPath));
      if(!res.ok){ showError(root); return; }
      const txt = await res.text();
      const parsed = parseHeader(txt);
  const title = parsed.meta.Title || '';
  // set document title for single post view (prefer header Title)
  try{ if(title) document.title = title; else if(parsed.meta && parsed.meta.Title) document.title = parsed.meta.Title; else document.title = 'Post'; }catch(e){}
      const desc = parsed.meta.Description || '';
      let hero = parsed.meta.ImageURL || '';
      if(hero && !hero.startsWith('http') && !hero.startsWith('/')) hero = `/public/posts/${hero}`;
  // compute parent href for back/up link (encode segments so spaces/special chars work)
  const parentHref = folderName ? ('/posts/' + encodePathFromParts(String(folderName).replace(/^\/+|\/+$/g,'').split('/')) + '/') : '/posts';
      const backHtml = `<div class="container"><div class="back-row"><a class="btn-back" href="${parentHref}">← Back</a></div></div>`;

      // process callouts and then render markdown (marked will include HTML produced by processCallouts)
      const processed = processCallouts(parsed.md);
      const mdHtml = marked.parse(processed);
      const articleHtml = `
        ${backHtml}
        <div class="container">
          <article class="post-full">
            <div class="post-header">
              <h1>${escapeHtml(title)}</h1>
              <p class="post-description">${escapeHtml(desc)}</p>
              ${hero?`<img src="${hero}" alt="${escapeHtml(title)}" style="max-width:100%"/>`:''}
            </div>
            <section class="post-body">${mdHtml}</section>
          </article>
        </div>`;

      root.innerHTML = articleHtml;
      const container = root.querySelector('.post-body');
      if(container) adjustImageSrcs(container);
    }catch(e){ console.error(e); showError(root); }
  }

  function escapeHtml(unsafe){
    return (unsafe||'').replace(/[&<>\"'`]/g, function(m){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;', '`':'&#96;'}[m];
    });
  }

  // Entry
  (async function(){
    const root = document.getElementById('post-root');
    if(!root){ console.error('post-root not found'); return; }

    // fetch index.json
    let index = null;
    try{
      const r = await fetch(INDEX_PATH);
      if(r.ok) index = await r.json();
      else index = {};
    }catch(e){ index = {}; }

    const cleaned = window.location.pathname.replace(/^\/+|\/+$/g,''); // posts/... or posts
    const parts = cleaned.split('/');
    const sub = parts.slice(1); // may be []

    // Decode path segments from URL so they match index keys which are filesystem names (may contain spaces)
    const decodedSub = sub.map(safeDecodeSegment);

    if(sub.length === 0){
      await renderRootIndex(root, index);
      return;
    }

    // remove special-case; traversal below handles folders and files at any depth

    // traverse index tree by sub parts
    let node = index;
    const pathParts = [];
    for(const part of decodedSub){
      // if this part matches a folder and there are more parts, descend
      if(node.folders && node.folders[part]){
        node = node.folders[part];
        pathParts.push(part);
        continue;
      }
      // otherwise, this part might be a file slug inside current node
      // attempt to find file with matching slug or path
      const slug = decodedSub.slice(pathParts.length).join('/');
      const found = node.files && node.files.find(f=>f.slug === slug || f.path === ([...pathParts, slug].join('/')));
      if(found){
        // render single post; parent path is pathParts
        // found may store the actual file path under different keys depending on build; prefer found.file, then found.path
        const fileToFetch = found.file || found.path || found;
        await renderPostFromFile(root, fileToFetch, pathParts.join('/'));
        return;
      }
      showError(root); return;
    }
  // If we fully consumed parts and ended on a folder node, show folder view
  await renderFolder(root, pathParts, node);
  })();

})();
