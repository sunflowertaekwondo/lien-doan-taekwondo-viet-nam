// make-gs.mjs - ghep apps-script/Code.template.gs + src/cms-sanitize.js thanh apps-script/Code.gs (tep dan vao Google Apps Script).
// Dung: node apps-script/make-gs.mjs          -> ghi Code.gs
//       node apps-script/make-gs.mjs --check  -> thoat 1 neu Code.gs khong khop nguon (check.mjs dung lenh nay)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
export function buildGs() {
  const tpl = fs.readFileSync(path.join(HERE, 'Code.template.gs'), 'utf8').replace(/\r\n/g, '\n');
  const san = fs.readFileSync(path.join(ROOT, 'src', 'cms-sanitize.js'), 'utf8').replace(/\r\n/g, '\n').replace(/^\/\*[\s\S]*?\*\/\n/, '');
  return tpl.replace('/*@SANITIZE@*/', () => `// ---------------------------------------------------------------- bo loc noi dung (nguon: src/cms-sanitize.js)\n${san.trim()}\n`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = path.join(HERE, 'Code.gs'), want = buildGs();
  if (process.argv.includes('--check')) {
    const have = fs.existsSync(out) ? fs.readFileSync(out, 'utf8').replace(/\r\n/g, '\n') : '';
    if (have !== want) { console.error('apps-script/Code.gs da cu: chay  node apps-script/make-gs.mjs'); process.exit(1); }
    console.log('Code.gs khop nguon');
  } else {
    const tmp = out + '.tmp';
    fs.writeFileSync(tmp, want, 'utf8'); fs.renameSync(tmp, out);
    console.log(`Da ghi ${path.relative(ROOT, out)} (${want.length} ky tu)`);
  }
}
