import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const src = path.join(root, 'src');
const targets = [path.join(root, 'dist'), path.join(root, 'docs')];
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const story = readJson(path.join(src, 'data', 'story.json'));
const catalog = readJson(path.join(src, 'data', 'catalog.json'));
const allTranslations = readJson(path.join(src, 'data', 'translations.json'));
const translations = { en: allTranslations.en || {} }; // Production UI intentionally ships English choices only.
const subtitles = readJson(path.join(src, 'data', 'subtitles.json'));
const app = fs.readFileSync(path.join(src, 'app.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(src, 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
const manifest = fs.readFileSync(path.join(src, 'manifest.webmanifest'), 'utf8');

const banner = `/* Interactive-controller v2.8.1 - dependency-free production bundle */\n`;
const bundle = `${banner}globalThis.__BIP_DATA__=${JSON.stringify({catalog,packs:{bandersnatch:{story,translations,subtitles}}})};\n${app}`;
const css = cssSource
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s+/g, ' ')
  .replace(/\s*([{}:;,>])\s*/g, '$1')
  .trim();

const cacheVersion = `ic28-${Date.now().toString(36)}`;
const sw = `const CACHE=${JSON.stringify(cacheVersion)};\nconst ASSETS=['./','./index.html','./app.js','./styles.css','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./assets/choice/netflix_2x.webp','./assets/choice/whitebear_2x.webp','./assets/choice/pacs_2x_update.webp'];\nself.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));\nself.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));\nself.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{const copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return resp;}).catch(()=>caches.match('./index.html'))));});\n`;

for (const target of targets) {
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(path.join(target, 'assets', 'choice'), { recursive: true });
  fs.mkdirSync(path.join(target, 'icons'), { recursive: true });
  fs.writeFileSync(path.join(target, 'index.html'), html);
  fs.writeFileSync(path.join(target, 'app.js'), bundle);
  fs.writeFileSync(path.join(target, 'styles.css'), css);
  fs.writeFileSync(path.join(target, 'manifest.webmanifest'), manifest);
  fs.writeFileSync(path.join(target, 'sw.js'), sw);
  fs.writeFileSync(path.join(target, '.nojekyll'), '');
  for (const name of ['netflix_2x.webp','whitebear_2x.webp','pacs_2x_update.webp']) {
    fs.copyFileSync(path.join(src, 'assets', 'choice', name), path.join(target, 'assets', 'choice', name));
  }
  for (const size of [192,512]) fs.copyFileSync(path.join(src, 'icons', `icon-${size}.png`), path.join(target, 'icons', `icon-${size}.png`));
  if (path.basename(target) === 'dist') {
    const launcher = path.join(src, 'launcher', 'Interactive-controller.exe');
    if (fs.existsSync(launcher)) fs.copyFileSync(launcher, path.join(target, 'Interactive-controller.exe'));
    for (const rootFile of ['LICENSE']) {
      const sourceFile = path.join(root, rootFile);
      if (fs.existsSync(sourceFile)) fs.copyFileSync(sourceFile, path.join(target, rootFile));
    }
    fs.mkdirSync(path.join(target, 'story-packs'), { recursive: true });
    const packTemplate = path.join(root, 'story-packs', 'STORY-PACK-TEMPLATE.json');
    if (fs.existsSync(packTemplate)) fs.copyFileSync(packTemplate, path.join(target, 'story-packs', 'STORY-PACK-TEMPLATE.json'));
    fs.writeFileSync(path.join(target, 'START-HERE.txt'), [
      'Interactive-controller v2.8.1',
      '',
      'Windows: double-click Interactive-controller.exe (x64) or index.html.',
      'Linux/macOS: open index.html in a recent browser, or serve the folder locally for PWA behavior.',
      'Android: use the hosted HTTPS/PWA build and choose the movie from device storage.',
      '1. Choose the interactive title / episode.',
      '2. If the title has no bundled pack, load its verified Interactive-controller Story Pack.',
      '3. Drag/drop or select the matching full internal/master movie file.',
      '',
      'Use Interactive Library to see which titles are Built-in, Installed, Pack required, Adapter required, or Invalid.',
      'Bandersnatch includes a built-in Story Pack. Other playable catalog titles require exact branching metadata.',
      'No Node.js, npm, installation, account, or video upload is required for this portable build.',
      'Extract the ZIP before running so the Windows launcher can find index.html.',
      'Updates: https://github.com/Mr-T3st/Interactive-controller/releases'
    ].join('\r\n'));
  }
}
console.log(`Built ${targets.map(t=>path.relative(root,t)).join(' + ')}`);
console.log(`app.js ${(Buffer.byteLength(bundle)/1024).toFixed(1)} KiB`);
console.log(`styles.css ${(Buffer.byteLength(css)/1024).toFixed(1)} KiB`);
