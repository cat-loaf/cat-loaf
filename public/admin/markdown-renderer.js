// Lightweight markdown renderer for admin preview that mirrors the site's post rendering.
// Exposes window.renderAdminMarkdown(md) -> HTML string and window.adjustAdminImageSrcs(container)
(function(){
  // reuse marked from CDN (admin page loads marked already)
  function escapeForRegex(s){ return (s||'').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function escapeHtml(unsafe){
    return (unsafe||'').replace(/[&<>\"'`]/g, function(m){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;', '`':'&#96;'}[m];
    });
  }

  // Convert special GitHub-style callouts in blockquotes into HTML callout blocks.
  // Copied from public/scripts/post.js for consistent rendering in admin preview.
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
        i++;
        const bodyLines = [];
        while(i < lines.length){
          const l = lines[i];
          if(l.startsWith('>')){ bodyLines.push(l.replace(/^>\s?/, '')); i++; continue; }
          break;
        }
        const bodyMd = bodyLines.join('\n');
        const innerHtml = marked.parse(bodyMd);
        const titleHtml = title ? `<div class="callout-title">${escapeHtml(title)}</div>` : '';
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

  function adjustImageSrcs(container){
    if(!container) return;
    const imgs = container.querySelectorAll('img');
    imgs.forEach(img => {
      const src = img.getAttribute('src') || '';
      if(!src) return;
      if(src.startsWith('http') || src.startsWith('/')) return; // leave alone
      const newSrc = `/public/posts/${src}`;
      img.setAttribute('src', newSrc);
    });
  }

  function renderAdminMarkdown(md){
    const processed = processCallouts(md || '');
    return marked.parse(processed || '');
  }

  // Expose
  window.renderAdminMarkdown = renderAdminMarkdown;
  window.adjustAdminImageSrcs = adjustImageSrcs;
})();
