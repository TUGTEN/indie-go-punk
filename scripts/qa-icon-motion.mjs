import { execFileSync } from 'node:child_process';
const session = 'igp-motion-qa';
const browser = (...args) => execFileSync('agent-browser', ['--session', session, ...args], { encoding: 'utf8', timeout: 120_000 });
const evaluate = input => {
  const response = JSON.parse(execFileSync('agent-browser', ['--session', session, 'eval', '--stdin', '--json'], { input, encoding: 'utf8', timeout: 120_000 }));
  if (!response.success) throw new Error(JSON.stringify(response));
  return response.data.result;
};
const check = (condition, message) => { if (!condition) throw new Error(message); console.log('PASS', message); };
try {
  browser('open', 'http://127.0.0.1:5173/icons'); browser('wait', '.icon-preview svg');
  browser('click', '[aria-label="LCD green"]');
  browser('select', '[aria-label="Animation effect"]', 'None');
  check(evaluate(`!!document.querySelector('.icon-preview [data-layer="rear-shadow"]')`), 'LCD has independent rear silhouette');
  check(evaluate(`!document.querySelector('.icon-preview [data-layer="front"]').hasAttribute('filter')`), 'Front pixels remain unblurred');
  check(evaluate(`new Set(Array.from(document.querySelectorAll('[id]'),el=>el.id)).size === document.querySelectorAll('[id]').length`), 'Gallery and preview SVG definitions have unique IDs');
  check(evaluate(`Array.from(document.querySelectorAll('.icon-artwork [href]')).every(el=>document.getElementById(el.getAttribute('href').slice(1)))`), 'Every SVG glyph reference resolves');
  check(evaluate(`!document.querySelector('[aria-label="Animation frame"]')`), 'No timeline or frame scrubber');
  check(evaluate(`document.querySelector('.icon-trigger').disabled`), 'None disables the effect trigger');
  browser('select', '[aria-label="Animation effect"]', 'Glitch');
  check(evaluate(`document.querySelector('.icon-preview').dataset.playing === 'false' && document.querySelector('.icon-preview').dataset.phase === '0.0000'`), 'Choosing an effect stays idle until triggered');
  browser('select', '[aria-label="Animation speed"]', '0.5');
  browser('click', '.icon-trigger');
  browser('wait', '--fn', `Number(document.querySelector('.icon-preview').dataset.phase) > .03`);
  check(evaluate(`document.querySelector('.icon-preview').dataset.playing === 'true'`), 'Trigger starts immediately without a quiet lead-in');
  check(evaluate(`document.querySelector('.icon-preview').innerHTML.includes('#ff2450') && document.querySelector('.icon-preview').innerHTML.includes('#2dff83') && document.querySelector('.icon-preview').innerHTML.includes('#397bff')`), 'Triggered glitch contains all RGB channels');
  browser('wait', '--fn', `Number(document.querySelector('.icon-preview').dataset.phase) > .3`);
  browser('click', '.icon-trigger');
  check(evaluate(`Number(document.querySelector('.icon-preview').dataset.phase) < .2`), 'Trigger can restart an effect immediately');
  browser('wait', '--fn', `document.querySelector('.icon-preview').dataset.playing === 'false'`);
  check(evaluate(`document.querySelector('.icon-preview').dataset.phase === '0.0000'`), 'One-shot returns to rest without looping');
  browser('click', '[aria-label="Flipper amber"]');
  check(evaluate(`document.querySelector('.icon-preview').classList.contains('backlit')`), 'Orange preset enables backlit surface');
  const checks = evaluate(`(async () => {
    const { icons } = await import('/src/icons/library.ts');
    const { iconArtworkSvg, effects } = await import('/src/icons/artwork.ts');
    const results=[];
    const check=(pass,message)=>{if(!pass)throw new Error(message);results.push(message)};
    const options={size:160,ink:'#30230f',paper:'#f6a52b',depth:1,glow:.45,effect:'None',phase:0,background:true,surface:'Backlit'};
    const render=async(svg)=>{
      const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
      try { const img=new Image(); img.src=url; await img.decode(); const c=document.createElement('canvas'); c.width=c.height=160; const ctx=c.getContext('2d');ctx.drawImage(img,0,0,160,160);return ctx.getImageData(0,0,160,160).data; }
      finally {URL.revokeObjectURL(url)}
    };
    const hash=bytes=>bytes.reduce((h,b)=>Math.imul(h^b,16777619),2166136261);
    const surfaces=[];
    for(const surface of ['Flat','LCD','Backlit']) surfaces.push(hash(await render(iconArtworkSvg(icons[0],{...options,surface}))));
    check(new Set(surfaces).size===3,'Flat / reflective LCD / backlit render differently');
    const rest=hash(await render(iconArtworkSvg(icons[0],options)));
    for(const effect of effects.filter(e=>e!=='None')) {
      check(hash(await render(iconArtworkSvg(icons[0],{...options,effect,phase:.5})))!==rest,effect+' effect changes actual rendered pixels');
    }
    const rgb=await render(iconArtworkSvg(icons[0],{...options,effect:'Glitch',phase:.5,background:false}));
    const channels=[0,0,0];
    for(let i=0;i<rgb.length;i+=4) if(rgb[i+3]>100) {
      for(let c=0;c<3;c++)if(rgb[i+c]>140&&rgb[i+c]>rgb[i+(c+1)%3]+40&&rgb[i+c]>rgb[i+(c+2)%3]+40)channels[c]++;
    }
    check(channels.every(n=>n>20),'RGB glitch produces clearly visible red, green, and blue raster regions');
    const oldURL=URL.createObjectURL,oldClick=HTMLAnchorElement.prototype.click,blobs=[];
    URL.createObjectURL=blob=>{blobs.push(blob);return oldURL(blob)};HTMLAnchorElement.prototype.click=()=>{};
    try {
      document.querySelector('.icon-frame-export').click();
      for(let n=0;!blobs.some(b=>b.type==='image/png')&&n<100;n++)await new Promise(r=>setTimeout(r,20));
      const png=blobs.find(b=>b.type==='image/png');check(!!png,'Frame capture emits a real PNG');
      const bitmap=await createImageBitmap(png);check(bitmap.width===160&&bitmap.height===160,'Frame PNG uses 20-cell padded integer scale');
      const c=document.createElement('canvas');c.width=c.height=160;const ctx=c.getContext('2d');ctx.drawImage(bitmap,0,0);bitmap.close();
      const actual=ctx.getImageData(0,0,160,160).data;
      check(actual[3]===0,'Transparent frame omits the screen but retains glyph depth');
      const expected=await render(iconArtworkSvg(icons[0],{...options,effect:'Glitch',phase:0,background:false}));
      check(actual.every((v,i)=>v===expected[i]),'Captured frame matches renderer pixel for pixel');
    } finally {URL.createObjectURL=oldURL;HTMLAnchorElement.prototype.click=oldClick}
    return results;
  })()`);
  checks.forEach(message=>console.log('PASS',message));
  browser('click', '.icon-trigger');
  browser('set', 'media', 'light', 'reduced-motion');
  browser('wait', '--fn', `document.querySelector('.icon-motion p').textContent.includes('Reduced motion')`);
  check(evaluate(`document.querySelector('.icon-preview').dataset.phase === '0.0000' && document.querySelector('.icon-trigger').disabled`), 'Live reduced-motion change stops effects and disables trigger');
  browser('set', 'viewport', '390', '844');
  check(evaluate(`document.documentElement.scrollWidth <= innerWidth`), 'Trigger controls fit mobile viewport');
} catch (error) { console.error(browser('snapshot','-i')); throw error; }
finally { browser('close'); }
