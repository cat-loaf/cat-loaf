#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const POSTS_DIR = path.join(__dirname, '..', 'posts');
const OUT_FILE = path.join(POSTS_DIR, 'index.json');
const PUBLIC_POSTS_DIR = path.join(__dirname, '..', 'public', 'posts');
let globalImageMap = null;

function readFileSyncSafe(p){
  try{ return fs.readFileSync(p, 'utf8'); }catch(e){ return null; }
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
  }
  return meta;
}

function buildTree(dir, relPath = ''){
  // Returns an object { folders: {name: node}, files: [ {slug,file,path,meta} ] }
  const node = { folders: {}, files: [] };
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for(const ent of entries){
    if(ent.isDirectory()){
      const childDir = path.join(dir, ent.name);
      node.folders[ent.name] = buildTree(childDir, path.posix.join(relPath, ent.name));
    } else if(ent.isFile() && ent.name.endsWith('.md')){
      const filePath = path.join(dir, ent.name);
      const txt = readFileSyncSafe(filePath) || '';
        const metaRaw = parseHeader(txt);
        // remove URL field from meta (we don't want to store it)
        if(metaRaw && typeof metaRaw === 'object' && metaRaw.URL) delete metaRaw.URL;
        const meta = metaRaw;
      const stat = fs.statSync(filePath);
      const slug = ent.name.replace(/\.md$/, '');
      const filePosix = '/' + path.posix.join('posts', relPath, ent.name).replace(/\\/g, '/').replace(/\/+/g,'/');
      const pathKey = (relPath ? (relPath + '/' + slug) : slug).replace(/^\/+|\/+$/g, '');
          // If meta.Date is provided and valid, use it for sorting (mtimeMs). Otherwise use file mtime
          let mtimeVal = stat.mtimeMs;
          if(meta && meta.Date){
            const parsed = Date.parse(meta.Date);
            if(!isNaN(parsed)) mtimeVal = parsed;
          }
          // Determine a cover image for this file if not provided in meta
          let cover = null;
          if(meta && meta.ImageURL){
            const resolved = lookupImageForKey(meta.ImageURL, globalImageMap || {});
            if(resolved) cover = resolved;
          }
          if(!cover && globalImageMap){
            // prefer dotted+slug (folder.subfolder.slug), then dotted (folder.subfolder), then slug, then last folder
            const parts = (relPath||'').split('/').filter(Boolean);
            const dotted = parts.join('.');
            const last = parts[parts.length-1];
            let tryDottedSlug = null;
            if(dotted) tryDottedSlug = lookupImageForKey(dotted + '.' + slug, globalImageMap);
            const tryDotted = dotted ? lookupImageForKey(dotted, globalImageMap) : null;
            const trySlug = lookupImageForKey(slug, globalImageMap);
            const tryLast = last ? lookupImageForKey(last, globalImageMap) : null;
            if(tryDottedSlug) cover = tryDottedSlug;
            else if(tryDotted) cover = tryDotted;
            else if(trySlug) cover = trySlug;
            else if(tryLast) cover = tryLast;
          }
          node.files.push({ slug, file: filePosix, path: pathKey, meta, mtimeMs: mtimeVal, cover });
    }
  }
  // compute mtimeMs for folder as max child mtime
  let max = 0;
  for(const f of node.files) if(f.mtimeMs && f.mtimeMs > max) max = f.mtimeMs;
  for(const k of Object.keys(node.folders)){
    const child = node.folders[k];
    if(child && typeof child.mtimeMs === 'number' && child.mtimeMs > max) max = child.mtimeMs;
  }
  if(max > 0) node.mtimeMs = max;
  // Attach possible cover image for this folder if present in image map
  if(globalImageMap){
    const parts = (relPath||'').split('/').filter(Boolean);
    const dotted = parts.join('.');
    const last = parts[parts.length-1];
    const tryDotted = dotted ? lookupImageForKey(dotted, globalImageMap) : null;
    const tryLast = last ? lookupImageForKey(last, globalImageMap) : null;
    if(tryDotted) node.cover = tryDotted;
    else if(tryLast) node.cover = tryLast;
  }
  return node;
}

// Scan public/posts for image files and build a map of basename -> url
function buildPublicImageMap(){
  const map = Object.create(null);
  try{
    if(!fs.existsSync(PUBLIC_POSTS_DIR)) return map;
    const entries = fs.readdirSync(PUBLIC_POSTS_DIR, { withFileTypes: true });
    for(const ent of entries){
      if(!ent.isFile()) continue;
      const name = ent.name;
      const m = name.match(/^(.+?)\.(png|jpg|jpeg|webp|gif)$/i);
      if(!m) continue;
      const key = m[1]; // keep case as-is but use lookup case-sensitively
      // store URL path starting with /public/posts/
      map[key] = path.posix.join('/public/posts', ent.name);
    }
  }catch(e){ /* ignore */ }
  return map;
}

function lookupImageForKey(key, imgMap){
  if(!key) return null;
  // if absolute http(s) or an absolute path, accept it (but for absolute /public/posts/ verify file exists)
  if(key.startsWith('http://') || key.startsWith('https://')) return key;
  if(key.startsWith('/')){
    // only accept if the file exists on disk under PUBLIC_POSTS_DIR
    const candidate = path.join(__dirname, '..', key.replace(/^\/+/, ''));
    if(fs.existsSync(candidate)) return key;
    return null;
  }
  // now key is relative name; try map case-insensitively and with extensions
  const exts = ['webp','png','jpg','jpeg','gif'];
  const lower = key.toLowerCase();
  // if key includes an extension, strip it and try base
  const maybeBase = key.replace(/\.[^/.]+$/, '');
  const lowerBase = maybeBase.toLowerCase();
  for(const k of Object.keys(imgMap)){
    if(k.toLowerCase() === lower || k.toLowerCase() === lowerBase) return imgMap[k];
  }
  // try adding extensions to the base name
  for(const e of exts){
    const tryKey = `${maybeBase}.${e}`;
    for(const k of Object.keys(imgMap)){
      if(k.toLowerCase() === tryKey.toLowerCase()) return imgMap[k];
    }
  }
  return null;
}

function main(){
  if(!fs.existsSync(POSTS_DIR)){
    console.error('posts directory not found:', POSTS_DIR);
    process.exit(1);
  }
  // build image map from public/posts so we can attach cover images into the index
  globalImageMap = buildPublicImageMap();
  const index = buildTree(POSTS_DIR, '');
  fs.writeFileSync(OUT_FILE, JSON.stringify(index, null, 2), 'utf8');
  console.log('Wrote', OUT_FILE);
}

main();
