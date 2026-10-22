import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const session = 'igp-composition-qa';
const browser = (...args) => execFileSync('agent-browser', ['--session', session, ...args], { encoding: 'utf8', timeout: 120_000 });
const evaluate = input => {
  const response = JSON.parse(execFileSync('agent-browser', ['--session', session, 'eval', '--stdin', '--json'], { input, encoding: 'utf8', timeout: 120_000 }));
  if (!response.success) throw new Error(JSON.stringify(response));
  return response.data.result;
};
const check = (pass, message) => { if (!pass) throw new Error(message); console.log('PASS',message); };
const hash = () => evaluate(`document.querySelector('.composition-stage canvas').getContext('2d').getImageData(0,0,1280,720).data.reduce((h,v)=>Math.imul(h^v,16777619),2166136261)`);
try {
  browser('open','http://127.0.0.1:5173/');
  const fixtures = evaluate(`(()=>{
    const portrait=document.createElement('canvas');portrait.width=180;portrait.height=260;const p=portrait.getContext('2d');
    p.fillStyle='#efd3ab';p.fillRect(55,20,70,100);p.fillStyle='#231f24';p.fillRect(50,15,80,30);p.fillRect(68,65,10,10);p.fillRect(104,65,10,10);p.fillStyle='#bf5437';p.fillRect(30,130,120,130);
    const gameplay=document.createElement('canvas');gameplay.width=360;gameplay.height=160;const g=gameplay.getContext('2d');g.fillStyle='#de4939';g.fillRect(0,0,120,160);g.fillStyle='#3c8e54';g.fillRect(120,0,120,160);g.fillStyle='#4264bc';g.fillRect(240,0,120,160);g.fillStyle='#f4e6b8';g.fillRect(45,40,50,25);g.fillRect(265,90,50,25);
    return {portrait:portrait.toDataURL(),gameplay:gameplay.toDataURL()};
  })()`);
  mkdirSync('artifacts/composition-qa',{recursive:true});
  for(const kind of ['portrait','gameplay']) writeFileSync(`artifacts/composition-qa/${kind}.png`,Buffer.from(fixtures[kind].split(',')[1],'base64'));
  writeFileSync('artifacts/composition-qa/invalid.txt','not an image');
  browser('upload','#portrait-upload',resolve('artifacts/composition-qa/portrait.png'));
  browser('wait','--fn',`Array.from(document.querySelectorAll('button')).some(b=>b.textContent.includes('Send cutout')&&!b.disabled)`);
  browser('find','role','button','click','--name','Send cutout ↗','--exact');
  browser('wait','--url','**/compose?cutout=latest');
  browser('wait','--fn',`Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Clear portrait')`);
  check(evaluate(`!document.querySelector('[role="alert"]')`),'Cutout Lab Send action transfers and loads the treated cutout');
  const stored = evaluate(`(async()=>{const{loadCutout,decodeCompositionAsset}=await import('/src/composition/assets.ts');const saved=await loadCutout();const bitmap=await createImageBitmap(saved.blob);const c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;c.getContext('2d').drawImage(bitmap,0,0);bitmap.close();const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;const transparent=data.some((v,i)=>i%4===3&&v===0);const trimmed=await decodeCompositionAsset(saved.blob,true);const result={transparent,trimmed:trimmed.bitmap.width<c.width||trimmed.bitmap.height<c.height,name:saved.name};trimmed.bitmap.close();return result})()`);
  check(stored.transparent,'Transfer excludes the portrait-lab background');
  check(stored.trimmed,'Composer trims transparent export framing');
  browser('upload','input[aria-label="Upload gameplay image"]',resolve('artifacts/composition-qa/gameplay.png'));
  browser('wait','--fn',`Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Clear gameplay')`);
  check(evaluate(`!document.querySelector('[role="alert"]')`),'Gameplay screenshot uploads and renders locally');
  const withBoth=hash();
  browser('find','role','button','click','--name','Name in bubble','--exact');
  check(hash()!==withBoth,'Attribution moves into the speech bubble');
  browser('find','role','button','click','--name','Nameplate ↙','--exact');
  check(hash()===withBoth,'Returning to nameplate restores identical pixels');
  browser('fill','[aria-label="Game name"]','A tiny game\nwith a long name');
  check(hash()!==withBoth,'Editable game title respects new text and line breaks');
  browser('focus','[role="slider"][aria-label="Aspect"]');browser('press','Home');
  const narrow=hash();
  check(evaluate(`Number(document.querySelector('[role="slider"][aria-label="Aspect"]').getAttribute('aria-valuenow'))<.8`),'Gameplay aspect slider can create a tall frame');
  browser('press','End');check(hash()!==narrow,'Aspect control visibly reframes gameplay');
  const beforeBad=hash();browser('upload','input[aria-label="Upload gameplay image"]',resolve('artifacts/composition-qa/invalid.txt'));
  browser('wait','[role="alert"]');
  check(hash()===beforeBad && evaluate(`!document.querySelector('.composition-export').disabled`),'Failed upload keeps existing image and export available');
  const checks=evaluate(`(async()=>{
    const{compositionControls,compositionSettings}=await import('/src/composition/settings.ts');
    const{compositionLayout,renderComposition}=await import('/src/composition/renderer.ts');
    const{renderLcd}=await import('/src/lcd/renderer.ts');const{createArtwork}=await import('/src/lcd/model.ts');
    const resolve=config=>Object.fromEntries(Object.entries(config).filter(([key])=>key!=='_collapsed').map(([key,value])=>[key,Array.isArray(value)?value[0]:value&&typeof value==='object'?value.type==='select'?value.default:resolve(value):value]));
    const settings=compositionSettings(resolve(compositionControls));const text={quote:'WE MADE THIS.',person:'ALEX RIVERA',role:'GAME DEVELOPER',game:'SOME LONG GAME NAME'};
    const field=createArtwork(settings.simulation,41).field;const bg=document.createElement('canvas');renderLcd(bg,field,{...settings.screen,motif:null,motifScale:1});
    const output=document.createElement('canvas');const bytes=c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data;const hash=c=>bytes(c).reduce((h,v)=>Math.imul(h^v,16777619),2166136261);const checks=[];const check=(pass,name)=>{if(!pass)throw new Error(name);checks.push(name)};
    renderComposition(output,bg,{portrait:null,gameplay:null},text,settings);const original=hash(output);
    check(output.width===1280&&output.height===720,'Composition renderer uses exact 1280 × 720 output');
    for(let n=0;n<5;n++){renderComposition(output,bg,{portrait:null,gameplay:null},text,settings);check(hash(output)===original,'Composition repeat '+n+' is deterministic');}
    const layout=compositionLayout(settings);const inset={x:layout.bubble.x+24,y:layout.bubble.y+24,w:layout.bubble.width-48,h:layout.bubble.height-48};
    const region=c=>c.getContext('2d').getImageData(inset.x,inset.y,inset.w,inset.h).data;
    const colors=new Set();const b=region(output);for(let i=0;i<b.length;i+=4)colors.add('#'+[b[i],b[i+1],b[i+2]].map(v=>v.toString(16).padStart(2,'0')).join(''));
    check(colors.size===2&&colors.has(settings.screen.paper)&&colors.has(settings.screen.ink),'Negative quote lettering uses exactly solid screen color and opaque dark panel');
    const bubblePixels=region(output).slice();const otherBg=document.createElement('canvas');renderLcd(otherBg,createArtwork(settings.simulation,42).field,{...settings.screen,motif:null,motifScale:1});renderComposition(output,otherBg,{portrait:null,gameplay:null},text,settings);
    check(region(output).every((v,i)=>v===bubblePixels[i]),'Changing procedural pattern cannot show through the negative letters or panel');
    check(hash(output)!==original,'Procedural pattern still changes the surrounding composition');
    const target=document.querySelector('.composition-stage canvas');const expected=bytes(target).slice(),blobs=[];const oldURL=URL.createObjectURL,oldClick=HTMLAnchorElement.prototype.click;
    URL.createObjectURL=blob=>{blobs.push(blob);return oldURL(blob)};HTMLAnchorElement.prototype.click=()=>{};
    try{document.querySelector('.composition-export').click();for(let i=0;!blobs.length&&i<100;i++)await new Promise(r=>setTimeout(r,20));const bmp=await createImageBitmap(blobs[0]);check(bmp.width===1280&&bmp.height===720,'UI PNG export dimensions are exact');const c=document.createElement('canvas');c.width=1280;c.height=720;c.getContext('2d').drawImage(bmp,0,0);bmp.close();check(bytes(c).every((v,i)=>v===expected[i]),'PNG export matches preview pixel for pixel');}finally{URL.createObjectURL=oldURL;HTMLAnchorElement.prototype.click=oldClick}
    const{decodeCompositionAsset}=await import('/src/composition/assets.ts');const empty=document.createElement('canvas');empty.width=empty.height=8;const blob=await new Promise(r=>empty.toBlob(r));let rejected=false;try{await decodeCompositionAsset(blob,true)}catch{rejected=true}check(rejected,'Fully transparent portraits are rejected');
    return checks;
  })()`);
  checks.forEach(message=>console.log('PASS',message));
  browser('click','.composition-details summary');
  browser('find','role','button','click','--name','Forget saved cutout in this browser','--exact');
  browser('wait','--fn',`document.querySelector('.composition-status').textContent.includes('removed')`);
  check(evaluate(`(async()=>{const{loadCutout}=await import('/src/composition/assets.ts');return await loadCutout()===null})()`),'Saved cutout can be removed from local storage');
  browser('set','viewport','390','844');
  check(evaluate(`document.documentElement.scrollWidth<=innerWidth`),'Composer fits mobile viewport without horizontal overflow');
} catch(error){console.error(browser('snapshot','-i'));throw error;}
finally{browser('close');}
