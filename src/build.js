// Gera um index.html autossuficiente (engine inlinado) em dist/confrontos.html.
// Mantém engine.js como fonte única (testada); este arquivo é só distribuição.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..'); // raiz do projeto (build.js vive em src/)
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const engine = fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf8');

// Injeta data.json (se existir) como window.__DATA__ — página file:// não consegue fazer fetch dele.
let dataScript = '';
const dataPath = path.join(root, 'data', 'data.json');
if (fs.existsSync(dataPath)) {
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8')); // valida o JSON
  dataScript = '<script>window.__DATA__=' + JSON.stringify(data) + ';</script>\n';
  console.log('data.json injetado (' + (data.teams ? data.teams.length : 0) + ' times)');
}

// Injeta stats.json (se existir) como window.__STATS__ — contexto de calendário/tiers.
let statsScript = '';
const statsPath = path.join(root, 'data', 'stats.json');
if (fs.existsSync(statsPath)) {
  const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8')); // valida o JSON
  statsScript = '<script>window.__STATS__=' + JSON.stringify(stats) + ';</script>\n';
  console.log('stats.json injetado (' + Object.keys(stats.teams || {}).length + ' times)');
}

const out = html.replace('<script src="src/engine.js"></script>', dataScript + statsScript + '<script>\n' + engine + '\n</script>');
if (out.includes('src="src/engine.js"')) throw new Error('falha ao inlinar engine.js');

const distDir = path.join(root, 'dist');
fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(path.join(distDir, 'confrontos.html'), out);
console.log('gerado dist/confrontos.html (' + out.length + ' bytes, autossuficiente)');
