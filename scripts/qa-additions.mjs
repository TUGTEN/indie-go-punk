import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const session='igp-additions-qa';
const browser=(...args)=>execFileSync('agent-browser',['--session',session,...args],{encoding:'utf8',timeout:120_000});
const evaluate=input=>{const r=JSON.parse(execFileSync('agent-browser',['--session',session,'eval','--stdin','--json'],{input,encoding:'utf8',timeout:120_000}));if(!r.success)throw new Error(JSON.stringify(r));return r.data.result};
const check=(pass,name)=>{if(!pass)throw new Error(name);console.log('PASS',name)};
const hash=selector=>evaluate(`document.querySelector('${selector}').getContext('2d').getImageData(0,0,document.querySelector('${selector}').width,document.querySelector('${selector}').height).data.reduce((h,v)=>Math.imul(h^v,16777619),2166136261)`);
try{
  browser('open','http://127.0.0.1:5173/icons');browser('wait','.icon-animation-export');
  const encoded=evaluate(`(async()=>{
    const blobs=[];let filename='';const create=URL.createObjectURL,click=HTMLAnchorElement.prototype.click;
    URL.createObjectURL=blob=>{if(blob.type==='image/apng')blobs.push(blob);return create(blob)};
    HTMLAnchorElement.prototype.click=function(){filename=this.download};
    try{
      document.querySelector('.icon-animation-export').click();
      for(let i=0;!blobs.length&&i<1500;i++)await new Promise(r=>setTimeout(r,10));
      if(!blobs[0])throw new Error('No APNG download');
      const bytes=new Uint8Array(await blobs[0].arrayBuffer());let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
      return{base64:btoa(binary),filename,type:blobs[0].type};
    }finally{URL.createObjectURL=create;HTMLAnchorElement.prototype.click=click}
  })()`);
  check(encoded.type==='image/apng'&&encoded.filename.endsWith('.apng'),'Actual icon download emits an animated PNG file');
  mkdirSync('artifacts/additions-qa',{recursive:true});
  writeFileSync('artifacts/additions-qa/icon.apng',Buffer.from(encoded.base64,'base64'));
  const decoder=JSON.parse(execFileSync('python3',['-c',`from PIL import Image,ImageSequence
import hashlib,json
im=Image.open('artifacts/additions-qa/icon.apng')
frames=[]
for frame in ImageSequence.Iterator(im):
 rgba=frame.convert('RGBA'); frames.append({'duration':frame.info.get('duration'),'alpha':rgba.getextrema()[3],'hash':hashlib.sha256(rgba.tobytes()).hexdigest()})
print(json.dumps({'animated':im.is_animated,'size':im.size,'frames':frames,'loop':im.info.get('loop')}))`],{encoding:'utf8'}));
  check(decoder.animated&&decoder.frames.length===12,'Independent Pillow decoder recognizes every APNG frame');
  check(decoder.size[0]===160&&decoder.size[1]===160,'Animated export uses selected integer pixel scale');
  check(decoder.frames.every(f=>f.alpha[0]===0&&f.alpha[1]>0),'Every decoded frame preserves transparent alpha');
  check(new Set(decoder.frames.map(f=>f.hash)).size>=3,'Decoded animation actually changes image pixels');
  check(decoder.frames.at(-1).hash===decoder.frames[0].hash,'Transparent frames replace old pixels without leaving ghost artifacts');
  check(decoder.loop===0&&decoder.frames.reduce((n,f)=>n+f.duration,0)===1460,'Default 3× motion plus quiet loop hold has correct timing');
  browser('uncheck','.icon-loop-export input');
  const once=evaluate(`(async()=>{
    const blobs=[];const create=URL.createObjectURL,click=HTMLAnchorElement.prototype.click;URL.createObjectURL=blob=>{if(blob.type==='image/apng')blobs.push(blob);return create(blob)};HTMLAnchorElement.prototype.click=()=>{};
    try{document.querySelector('.icon-animation-export').click();for(let i=0;!blobs.length&&i<1500;i++)await new Promise(r=>setTimeout(r,10));const data=new DataView(await blobs[0].arrayBuffer());let pos=8;while(pos<data.byteLength){const len=data.getUint32(pos);const type=String.fromCharCode(...new Uint8Array(data.buffer,pos+4,4));if(type==='acTL')return data.getUint32(pos+12);pos+=len+12}throw new Error('No acTL')}finally{URL.createObjectURL=create;HTMLAnchorElement.prototype.click=click}
  })()`);
  check(once===1,'Unchecking Loop downloads a one-shot animation');
  browser('select','[aria-label="Animation effect"]','None');
  check(evaluate(`document.querySelector('.icon-animation-export').disabled`),'None disables animated downloads');
  for(const name of ['Violet LCD','Neon cyan','Neon pink','Neon lime','Red / chalk','Red screen','Pocket blue'])check(evaluate(`!!document.querySelector('button[aria-label="${name}"]')`),'Icons includes '+name);
  browser('set','viewport','390','844');check(evaluate('document.documentElement.scrollWidth<=innerWidth'),'Expanded icon palettes and download controls fit mobile');
  browser('open','http://127.0.0.1:5173/');
  const fixture=evaluate(`(()=>{const c=document.createElement('canvas');c.width=180;c.height=240;const x=c.getContext('2d');x.fillStyle='#f0cf9e';x.fillRect(40,20,100,90);x.fillStyle='#bb233b';x.fillRect(25,110,100,130);x.fillStyle='#2577db';x.fillRect(125,120,30,90);return c.toDataURL()})()`);
  writeFileSync('artifacts/additions-qa/portrait.png',Buffer.from(fixture.split(',')[1],'base64'));
  browser('upload','#portrait-upload',resolve('artifacts/additions-qa/portrait.png'));
  browser('wait','--fn',`Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Mirror cutout ⇄'&&!b.disabled)`);
  browser('screenshot');const original=hash('.canvas-wrap canvas');
  browser('find','role','button','click','--name','Mirror cutout ⇄','--exact');browser('screenshot');
  check(hash('.canvas-wrap canvas')!==original,'Cutout Lab mirror visibly flips an asymmetric cutout');
  browser('find','role','button','click','--name','Mirror cutout ⇄','--exact');browser('screenshot');
  check(hash('.canvas-wrap canvas')===original,'Cutout mirror toggles back without changing treatment');
  browser('find','role','button','click','--name','Send cutout ↗','--exact');browser('wait','--url','**/compose?cutout=latest');browser('wait','--text','Clear portrait');
  const composeOriginal=hash('.composition-stage canvas');browser('click','.composition-mirror');
  check(hash('.composition-stage canvas')!==composeOriginal,'Compose mirror is independent of layout direction');browser('click','.composition-mirror');
  check(hash('.composition-stage canvas')===composeOriginal,'Compose mirror restores exact original pixels');
  const layouts=['Interview Split','Reverse split','Quote banner','Game first'];const hashes=[];
  for(const name of layouts){browser('click',`button[aria-label="Layout: ${name}"]`);check(evaluate(`!document.querySelector('[role="alert"]')`),'Layout renders: '+name);hashes.push(hash('.composition-stage canvas'))}
  check(new Set(hashes).size===4,'All four layout alternatives produce distinct compositions');
  browser('click','button[aria-label="Layout: Interview Split"]');check(hash('.composition-stage canvas')===composeOriginal,'Layout comparison preserves assets and returns to original');
  const paletteHashes=[];
  for(const name of ['Pocket blue','Violet LCD','Neon cyan','Neon pink','Neon lime','Red / chalk','Red screen']){
    browser('click',`button[aria-label="${name}"]`);check(evaluate(`!document.querySelector('[role="alert"]')`),'Compose palette renders: '+name);paletteHashes.push(hash('.composition-stage canvas'));
  }
  check(new Set(paletteHashes).size===paletteHashes.length,'New palette choices change the rendered PNG pixels');
  browser('set','viewport','390','844');check(evaluate('document.documentElement.scrollWidth<=innerWidth'),'Layout cards and shared palettes fit mobile');
}catch(error){console.error(browser('snapshot','-i'));throw error}
finally{browser('close')}
