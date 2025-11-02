const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'node_modules', 'monaco-editor', 'min', 'vs');
const dest = path.join(__dirname, '..', 'public', 'vendor', 'monaco', 'vs');

function copyDir(srcDir, destDir){
  if(!fs.existsSync(srcDir)){
    console.error('Source not found:', srcDir);
    process.exit(1);
  }
  fs.mkdirSync(destDir, { recursive: true });
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for(const ent of entries){
    const s = path.join(srcDir, ent.name);
    const d = path.join(destDir, ent.name);
    if(ent.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

try{
  console.log('Copying Monaco from', src, 'to', dest);
  copyDir(src, dest);
  console.log('Done.');
}catch(e){
  console.error('Failed to copy Monaco:', e);
  process.exit(1);
}
