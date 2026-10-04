import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'src/assets/choice');
const urls={
  'netflix_2x.webp':'https://assets.nflxext.com/ffe/oui/interactive/bs/choicepoint/web/20181116/netflix_2x.webp',
  'whitebear_2x.webp':'https://assets.nflxext.com/ffe/oui/interactive/bs/choicepoint/web/20181116/whitebear_2x.webp',
  'pacs_2x_update.webp':'https://assets.nflxext.com/ffe/oui/interactive/bs/choicepoint/web/20181116/pacs_2x_update.webp'
};
fs.mkdirSync(out,{recursive:true});
for(const [name,url] of Object.entries(urls)){
  console.log(`Downloading ${name} ...`);
  const response=await fetch(url,{redirect:'follow'});
  if(!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length<500) throw new Error(`${name} download is unexpectedly small`);
  fs.writeFileSync(path.join(out,name),bytes);
  console.log(`  ${bytes.length} bytes`);
}
console.log('Original legacy choice images downloaded. Run npm run build.');
