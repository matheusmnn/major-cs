// Gera um index.html autossuficiente (engine inlinado) em dist/confrontos.html.
// Mantém engine.js como fonte única (testada); este arquivo é só distribuição.
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const engine = fs.readFileSync(path.join(root, 'engine.js'), 'utf8');

// Injeta data.json (se existir) como window.__DATA__ — página file:// não consegue fazer fetch dele.
let dataScript = '';
const dataPath = path.join(root, 'data.json');
if (fs.existsSync(dataPath)) {
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8')); // valida o JSON
  dataScript = '<script>window.__DATA__=' + JSON.stringify(data) + ';</script>\n';
  console.log('data.json injetado (' + (data.teams ? data.teams.length : 0) + ' times)');
}

const out = html.replace('<script src="engine.js"></script>', dataScript + '<script>\n' + engine + '\n</script>');
if (out.includes('src="engine.js"')) throw new Error('falha ao inlinar engine.js');

const distDir = path.join(root, 'dist');
fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(path.join(distDir, 'confrontos.html'), out);
console.log('gerado dist/confrontos.html (' + out.length + ' bytes, autossuficiente)');
