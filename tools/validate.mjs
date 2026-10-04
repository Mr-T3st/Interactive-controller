import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const story=JSON.parse(fs.readFileSync(path.join(root,'src/data/story.json'),'utf8'));

const stats=JSON.parse(fs.readFileSync(path.join(root,'src/data/stats.json'),'utf8'));
const fail=(msg)=>{throw new Error(msg)};
const assert=(ok,msg)=>{if(!ok)fail(msg)};
const catalog=JSON.parse(fs.readFileSync(path.join(root,'src/data/catalog.json'),'utf8'));
assert(catalog.length===93,`Expected 93 catalog entries, got ${catalog.length}`);
assert(catalog.every(item=>item.category&&item.series&&item.id),'Catalog entries must include category, series and id');
assert(catalog.filter(item=>item.series==='That Moment When').length===7,'That Moment When must expose 7 episode entries');
assert(catalog.filter(item=>item.series==='#WarGames').length===6,'#WarGames must expose 6 episode entries');
assert(catalog.some(item=>item.id==='mosaic'&&item.interactionModel==='povChapters'),'Mosaic interactive experience entry is missing');
assert(catalog.filter(item=>item.packStatus==='builtin').length===1,'Exactly one built-in Story Pack is expected');
assert(catalog.filter(item=>item.packStatus==='required').length===73,'Expected 73 Story-Pack-ready catalog entries');
assert(catalog.filter(item=>item.packStatus==='adapter-required').length===19,'Expected 19 adapter-required catalog entries');
assert(story.segments[story.initialSegment], 'Initial segment is missing');
assert(Object.keys(story.segments).length===250,'Expected 250 segments');
assert(stats.moments===285,'Expected 285 moments');
assert(stats.choices===339,'Expected 339 choices');
let refs=0;
for(const [sid,moments] of Object.entries(story.momentsBySegment)){
  assert(story.segments[sid],`Moments reference unknown segment ${sid}`);
  for(const m of moments){
    for(const c of m.choices||[]){
      if(c.segmentId){refs++; assert(story.segments[c.segmentId],`Choice ${c.id} -> missing segment ${c.segmentId}`);}
      if(c.sg){refs++; assert(story.segmentGroups[c.sg],`Choice ${c.id} -> missing segment group ${c.sg}`);}
      if(c.image) assert(!/^https?:/i.test(c.image),`Remote choice image remains: ${c.image}`);
    }
  }
}
for(const [gid,group] of Object.entries(story.segmentGroups)){
  for(const entry of group){
    if(typeof entry==='string') assert(story.segments[entry]||story.segmentGroups[entry],`Group ${gid} -> unknown ${entry}`);
    else if(entry?.segment) assert(story.segments[entry.segment],`Group ${gid} -> missing segment ${entry.segment}`);
    else if(entry?.segmentGroup) assert(story.segmentGroups[entry.segmentGroup],`Group ${gid} -> missing group ${entry.segmentGroup}`);
    if(entry?.precondition) assert(story.preconditions[entry.precondition]!==undefined,`Group ${gid} -> missing precondition ${entry.precondition}`);
  }
}
const sorted=Object.entries(story.segments).map(([id,s])=>({id,...s})).sort((a,b)=>a.startTimeMs-b.startTimeMs);
for(let i=1;i<sorted.length;i++){
  const prev=sorted[i-1],cur=sorted[i];
  if(prev.endTimeMs!==undefined){
    assert(cur.startTimeMs===prev.endTimeMs,`Master timeline gap/overlap: ${prev.id} -> ${cur.id}`);
  }
}
const buildFiles=['index.html','app.js','styles.css','sw.js'];
for(const file of buildFiles){
  const text=fs.readFileSync(path.join(root,'dist',file),'utf8');
  assert(!text.includes('assets.nflxext.com'),`Production build still references Netflix CDN in ${file}`);
}
for(const file of ['netflix_2x.webp','whitebear_2x.webp','pacs_2x_update.webp']){
  const p=path.join(root,'dist/assets/choice',file);
  assert(fs.existsSync(p)&&fs.statSync(p).size>500,`Missing offline choice asset ${file}`);
}

const sourceHtml=fs.readFileSync(path.join(root,'src/index.html'),'utf8');
const sourceApp=fs.readFileSync(path.join(root,'src/app.js'),'utf8');
assert(sourceHtml.includes('subtitle-size-minus')&&sourceHtml.includes('subtitle-background-slider'),'Subtitle appearance controls are missing');
assert(sourceHtml.includes('category-select')&&sourceHtml.includes('episode-select'),'Structured catalog selectors are missing');
assert(sourceHtml.includes('interactive-library-dialog')&&sourceHtml.includes('library-status-filter'),'Interactive Library UI is missing');
assert(sourceApp.includes('function catalogStatus')&&sourceApp.includes('function renderLibrary'),'Interactive Library runtime is missing');
assert(sourceHtml.includes('save-route-button')&&sourceHtml.includes('saved-route-list'),'Saved-route UI is missing');
assert(sourceApp.includes("key === 'ArrowUp'")&&sourceApp.includes('previousStoryScene()'),'Story-scene keyboard navigation is missing');
assert(sourceApp.includes("key === 'ArrowLeft'")&&sourceApp.includes('seekRelative(-10000)'),'Timeline arrow seeking is missing');
assert(sourceHtml.includes('rewind-10-button')&&sourceHtml.includes('forward-10-button'),'Dedicated timeline seek buttons are missing');
assert(sourceHtml.includes('speaker-button')&&sourceHtml.includes('compact-subtitle-button'),'Polished media controls are missing');
assert(sourceApp.includes('onPlayerPointerMove')&&sourceApp.includes('revealFullscreenControls'),'Fullscreen bottom-edge controls are missing');
assert(sourceApp.includes('navigator.getGamepads')&&sourceApp.includes('activateGamepadChoice'),'Gamepad support is missing');
const sourceCss=fs.readFileSync(path.join(root,'src/styles.css'),'utf8');
assert(sourceCss.includes('.player:fullscreen.controls-visible .control-bar'),'Fullscreen overlay control styling is missing');
const launcherPath=path.join(root,'dist','Interactive-controller.exe');
assert(fs.existsSync(launcherPath)&&fs.statSync(launcherPath).size>1500,'Windows portable launcher is missing');
const launcherHead=fs.readFileSync(launcherPath).subarray(0,2).toString('ascii');
assert(launcherHead==='MZ','Windows launcher is not a PE executable');
const appSize=fs.statSync(path.join(root,'dist/app.js')).size;
assert(appSize<1_200_000,`app.js unexpectedly large: ${appSize}`);
console.log('Validation passed');
console.log(JSON.stringify({segments:Object.keys(story.segments).length,moments:stats.moments,choices:stats.choices,segmentGroups:stats.segmentGroups,preconditions:stats.preconditions,stateVariables:stats.stateVariables,referenceChecks:refs,appKiB:(appSize/1024).toFixed(1)},null,2));
