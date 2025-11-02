const { requireAuth } = require('./_auth');

// Returns the admin UI HTML snippet. This endpoint requires a valid Bearer JWT.
exports.handler = async function(event){
  try{
    requireAuth(event);
    // Minimal admin UI HTML (structure only); the interactive logic lives in /public/admin/admin-app.js
    // Return the admin UI markup (only). The client will inject this into the page and load the admin-app script.
    const html = `
      <link rel="stylesheet" href="/public/admin/admin.css">
      <script src="/public/admin/markdown-renderer.js" defer></script>
      <div class="admin-panel container" style="max-width:1100px;margin:1.5rem auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem">
          <h2 style="margin:0">Admin</h2>
          <div><button id="logoutBtn" class="btn">Logout</button></div>
        </div>

        <div style="display:grid;grid-template-columns:320px 1fr;gap:1rem;align-items:start">
          <div class="admin-side" style="min-width:280px">
            <section style="margin-bottom:1rem">
              <h3>Image Upload</h3>
              <input type="file" id="imageFile"><br>
              <img id="imagePreview" class="preview-img hidden" style="margin-top:0.5rem;max-width:100%">
              <div class="row" style="margin-top:0.5rem"><label style="min-width:60px">Folder</label><select id="imageFolder"></select></div>
              <div class="row"><input id="newImageFolder" placeholder="Create folder (optional)" style="flex:1"></div>
              <div class="row"><input id="imageFilename" placeholder="Filename (optional)" style="flex:1"></div>
              <div class="row"><button id="uploadImageBtn">Upload Image</button><span id="uploadResult"></span></div>
            </section>

            <section>
              <h3>Post Meta</h3>
              <div class="row"><label style="min-width:60px">Existing</label><select id="existingPosts" style="flex:1"><option value="">-- Select post --</option></select></div>
              <div class="row" style="gap:0.5rem"><button id="loadPostBtn" class="btn">Load</button><button id="deletePostBtn" class="btn ghost">Delete Post</button><button id="deleteFolderBtn" class="btn ghost">Delete Folder</button></div>
              <div class="row"><input id="postTitle" placeholder="Title" style="flex:1"></div>
              <div class="row"><input id="postDescription" placeholder="Description" style="flex:1"></div>
              <div class="row"><label style="min-width:60px">Location</label><select id="postLocation"></select></div>
              <div class="row"><input id="newPostLocation" placeholder="Create folder (optional)" style="flex:1"></div>
              <div class="row"><input id="postDate" placeholder="YYYY-MM-DD"></div>
              <div class="row"><input id="postImageURL" placeholder="Image URL (defaults to image)" style="flex:1"></div>
              <div class="row"><input id="postFilename" placeholder="Filename (optional)" style="flex:1"></div>
              <div class="row" style="margin-top:0.5rem"><button id="savePostBtn">Save Post</button><span id="saveResult" style="margin-left:0.5rem"></span></div>
            </section>
          </div>

          <div class="admin-main">
            <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.5rem">
              <button id="tabEdit" class="btn">Edit</button>
              <button id="tabPreview" class="btn">Preview</button>
            </div>
            <div id="editorArea" style="display:grid;grid-template-columns:1fr;gap:0.75rem">
              <!-- Hidden textarea fallback for environments where Monaco hasn't loaded yet -->
              <textarea id="postBody" style="display:none;min-height:420px;padding:1rem;border:1px solid #ddd;border-radius:6px;font-family:inherit"></textarea>
              <div id="monacoContainer" style="min-height:420px;border:1px solid #ddd;border-radius:6px;overflow:hidden"></div>
              <div id="postPreview" class="post-body" style="display:none;border:1px solid #eee;padding:1rem;border-radius:6px;background:#fff"></div>
            </div>
          </div>
        </div>

        <hr style="margin:1rem 0;border-color:#eee">
        <section style="margin-top:1rem">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem">
            <h3 style="margin:0">Computed index.json</h3>
            <div style="display:flex;gap:0.5rem;align-items:center">
              <button id="refreshIndexBtn" title="Refresh index.json" class="btn ghost">⟳</button>
            </div>
          </div>
          <div id="index-area" style="display:flex;flex-direction:column;gap:1rem;margin-top:0.5rem">
            <div id="indexMonacoContainer" style="min-height:320px;border:1px solid #ddd;border-radius:6px;overflow:hidden"></div>
            <div id="indexViz" style="min-height:320px;border:1px solid #eee;border-radius:6px;padding:0.5rem;overflow:auto;background:#fafafa;width:100%"></div>
          </div>
        </section>

        <!-- Build status modal -->
        <div id="buildModal" class="modal hidden">
          <div class="modal-backdrop"></div>
          <div class="modal-panel">
            <header style="display:flex;justify-content:space-between;align-items:center">
              <h4 style="margin:0">Build Status</h4>
              <button id="closeBuildModal" class="btn ghost">✕</button>
            </header>
            <div id="buildModalBody" style="margin-top:0.5rem;max-height:60vh;overflow:auto;font-family:monospace;font-size:0.85rem"></div>
          </div>
        </div>
      </div>
    `;
    return { statusCode: 200, headers: { 'Content-Type': 'text/html' }, body: html };
  }catch(err){
    // Return error details for easier local debugging (in production you may want to hide details)
    const code = err && err.status ? err.status : 500;
    console.error('adminUI error:', err && err.stack ? err.stack : err);
    const body = { error: String(err && err.message ? err.message : err), stack: (err && err.stack) ? String(err.stack) : undefined };
    return { statusCode: code, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  }
};
