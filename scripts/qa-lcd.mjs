// Real browser checks: run Vite dev server first, then npm run qa:lcd.
import { execFileSync } from 'node:child_process';
const session = 'igp-lcd-qa';
const browser = (...args) => execFileSync('agent-browser', ['--session', session, ...args], { encoding: 'utf8', timeout: 120_000 });
const evaluate = input => {
  const response = JSON.parse(execFileSync('agent-browser', ['--session', session, 'eval', '--stdin', '--json'], { input, encoding: 'utf8', timeout: 120_000 }));
  if (!response.success) throw new Error(JSON.stringify(response));
  return response.data.result;
};
const check = (pass, name) => { if (!pass) throw new Error(name); console.log('PASS', name); };
const canvasHash = () => evaluate(`Array.from(document.querySelector('.lcd-stage canvas').getContext('2d').getImageData(0,0,1280,720).data).reduce((h,v)=>Math.imul(h^v,16777619),2166136261)`);
const generation = () => evaluate(`Number(document.querySelector('.lcd-generation').dataset.generation)`);
try {
  browser('open', 'http://127.0.0.1:5173/lcd'); browser('wait', '.lcd-stage canvas');
  browser('click', '.lcd-algorithms button:first-child');
  check(evaluate(`!document.querySelector('[role="alert"]')`), 'Life renders without errors');
  const initial = canvasHash(); const firstGeneration = generation();
  browser('click', '.lcd-transport button:nth-child(2)');
  check(generation() === firstGeneration + 1 && canvasHash() !== initial, 'Step advances one generation and updates artwork');
  browser('click', '.lcd-transport button:nth-child(3)');
  check(canvasHash() === initial, 'Reset reproduces the settled seed');
  browser('click', '.lcd-transport button:first-child');
  browser('wait', '--fn', `Number(document.querySelector('.lcd-generation').dataset.generation)>${firstGeneration}`);
  browser('click', '.lcd-transport button:first-child');
  const paused = generation();
  check(evaluate(`new Promise(resolve=>setTimeout(()=>resolve(Number(document.querySelector('.lcd-generation').dataset.generation)===${paused}),300))`), 'Pause freezes simulation');
  browser('click', '[aria-label="Flipper amber"]');
  check(generation() === paused, 'Changing material preserves generation');
  browser('fill', '[aria-label="Artwork seed"]', 'bad seed'); browser('find','role','button','click','--name','Apply','--exact');
  check(evaluate(`document.querySelector('.lcd-status').textContent.includes('whole number')`), 'Invalid seeds are rejected without destroying artwork');
  browser('fill', '[aria-label="Artwork seed"]', '123'); browser('find','role','button','click','--name','Apply','--exact');
  const seed123 = canvasHash();
  browser('find','role','button','click','--name','Regenerate ↻','--exact');
  check(canvasHash() !== seed123, 'Regenerate changes a seeded field');
  browser('fill', '[aria-label="Artwork seed"]', '123'); browser('find','role','button','click','--name','Apply','--exact');
  check(canvasHash() === seed123, 'Reapplying seed restores pixel-identical artwork');
  browser('click', '.lcd-algorithms button:nth-child(2)');
  check(evaluate(`!document.querySelector('[role="alert"]')`), 'Elementary history renders');
  browser('click', '.lcd-algorithms button:nth-child(3)');
  check(evaluate(`!document.querySelector('[role="alert"]')`), 'Cyclic waves render');
  browser('click', '.lcd-algorithms button:nth-child(4)');
  check(evaluate(`!document.querySelector('[role="alert"]') && Array.from(document.querySelectorAll('.lcd-transport button')).slice(0,2).every(b=>b.disabled)`), 'WFC solves and correctly disables time stepping');
  browser('find','role','button','click','--name','Icon None','--exact');
  browser('screenshot'); // Flush DialKit's lazy popover paint in background/headless tabs.
  browser('find','text','Controller','click','--exact');
  const withIcon = canvasHash();
  check(evaluate(`!document.querySelector('[role="alert"]')`), 'Hero glyph renders in circuit artwork');
  browser('find','role','button','click','--name','Icon Controller','--exact');
  browser('screenshot');
  browser('find','text','None','click','--exact');
  check(canvasHash() !== withIcon, 'Hero motif changes composition independently');
  const checks = evaluate(`(async()=>{
    const {createArtwork,advanceField}=await import('/src/lcd/model.ts');
    const {renderLcd}=await import('/src/lcd/renderer.ts');
    const {icons}=await import('/src/icons/library.ts');
    const checks=[];const check=(pass,name)=>{if(!pass)throw new Error(name);checks.push(name)};
    const config={algorithm:'Cyclic CA',width:160,height:90,density:.32,rule:90,randomStart:false,states:8,threshold:1,wrap:true,settle:36};
    const field=createArtwork(config,41).field;const saved=field.cells.slice();
    const options={paper:'#477e43',ink:'#2d612d',surface:'LCD',tones:'Shaded',depth:1,glow:.45,gap:.12,threshold:.5,invert:false,motif:null,motifScale:2};
    const output=document.createElement('canvas');
    const bytes=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    const hash=c=>bytes(c).reduce((h,v)=>Math.imul(h^v,16777619),2166136261);
    renderLcd(output,field,options);const first=hash(output);
    check(output.width===1280&&output.height===720,'Renderer always produces 1280 × 720');
    renderLcd(output,field,options);check(hash(output)===first,'Deterministic repeated render');
    for(let i=0;i<6;i++){renderLcd(output,field,options);check(hash(output)===first,'Readback '+i+' preserves filter rounding across reset/export');}
    const fresh=document.createElement('canvas');renderLcd(fresh,field,options);check(hash(fresh)===first,'Fresh export canvas matches preview renderer');
    const surfaceHashes=['Flat','LCD','Backlit'].map(surface=>{renderLcd(output,field,{...options,surface});return hash(output)});
    check(new Set(surfaceHashes).size===3,'Flat / LCD / Backlit have distinct baked-in pixels');
    renderLcd(output,field,{...options,depth:0});check(hash(output)!==first,'Depth changes the baked-in rear silhouette');
    renderLcd(output,field,{...options,gap:0});check(hash(output)!==first,'Pixel gap changes cell geometry');
    renderLcd(output,field,{...options,motif:icons[0]});check(hash(output)!==first,'Motif is included in raster, not a CSS overlay');
    check(field.cells.every((v,i)=>v===saved[i]),'Rendering never mutates the simulation');
    for(const [paper,ink] of [['#477e43','#2d612d'],['#f6a52b','#30230f'],['#ffffff','#000000'],['#000000','#ffffff']]){
      const colors=tones=>{renderLcd(output,field,{...options,paper,ink,surface:'Flat',tones});const b=bytes(output),set=new Set();for(let i=0;i<b.length;i+=4){if(b[i+3]!==255)throw new Error('Unexpected alpha');set.add(b[i]+','+b[i+1]+','+b[i+2])}return set.size};
      check(colors('Two tone')===2,paper+' two-tone has exactly two opaque colors');
      check(colors('Shaded')>2,paper+' shaded uses tinted or neutral grayscale');
    }
    const html=document.querySelector('.lcd-stage canvas');const expected=bytes(html).slice();const captured=[];
    const oldURL=URL.createObjectURL,oldClick=HTMLAnchorElement.prototype.click;
    URL.createObjectURL=blob=>{captured.push(blob);return oldURL(blob)};HTMLAnchorElement.prototype.click=()=>{};
    try{
      document.querySelector('.lcd-export').click();
      for(let i=0;!captured.length&&i<100;i++)await new Promise(r=>setTimeout(r,20));
      check(captured[0]?.type==='image/png','UI exports an actual PNG');
      const bitmap=await createImageBitmap(captured[0]);check(bitmap.width===1280&&bitmap.height===720,'Exported PNG is exactly 1280 × 720');
      const c=document.createElement('canvas');c.width=1280;c.height=720;c.getContext('2d').drawImage(bitmap,0,0);bitmap.close();
      check(bytes(c).every((v,i)=>v===expected[i]),'Exported PNG equals the visible frame pixel-for-pixel');
    }finally{URL.createObjectURL=oldURL;HTMLAnchorElement.prototype.click=oldClick}
    return checks;
  })()`);
  checks.forEach(name=>console.log('PASS',name));
  browser('click', '.lcd-algorithms button:first-child');
  browser('set','media','light','reduced-motion');
  browser('wait','--fn',`document.querySelector('.lcd-transport button:first-child').disabled`);
  check(evaluate(`!document.querySelector('.lcd-transport button:nth-child(2)').disabled`), 'Reduced motion disables playback but leaves manual stepping');
  browser('set','viewport','390','844');
  check(evaluate(`document.documentElement.scrollWidth<=innerWidth`), 'LCD controls fit mobile viewport');
} catch (error) { console.error(browser('snapshot','-i'));throw error; }
finally { browser('close'); }
