// Gera um index.html autossuficiente (engine inlinado) em dist/confrontos.html.
// Mantém engine.js como fonte única (testada); este arquivo é só distribuição.
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const engine = fs.readFileSync(path.join(root, 'engine.js'), 'utf8');

const out = html.replace('<script src="engine.js"></script>', '<script>\n' + engine + '\n</script>');
if (out.includes('src="engine.js"')) throw new Error('falha ao inlinar engine.js');

const distDir = path.join(root, 'dist');
fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(path.join(distDir, 'confrontos.html'), out);
console.log('gerado dist/confrontos.html (' + out.length + ' bytes, autossuficiente)');
