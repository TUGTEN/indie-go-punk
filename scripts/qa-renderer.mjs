// Optional real-browser checks. Requires agent-browser and a running Vite dev server.
import { execFileSync } from 'node:child_process';

const session = 'igp-renderer-qa';
const browser = (...args) => execFileSync('agent-browser', ['--session', session, ...args], { encoding: 'utf8', timeout: 120_000 });
try {
  browser('open', process.argv[2] || 'http://127.0.0.1:5173');
  const response = JSON.parse(execFileSync('agent-browser', ['--session', session, 'eval', '--stdin', '--json'], {
    encoding: 'utf8', timeout: 120_000,
    input: `(async () => {
      const { PortraitRenderer, hasTransparency } = await import('/src/renderer.ts');
      const { controls } = await import('/src/settings.ts');
      const resolve = config => Object.fromEntries(Object.entries(config).filter(([key]) => key !== '_collapsed').map(([key, value]) => [key,
        Array.isArray(value) ? value[0] : value && typeof value === 'object'
          ? value.type === 'select' ? value.default : resolve(value) : value]));
      const settings = resolve(controls);
      const checks = [];
      const check = (condition, name) => { if (!condition) throw new Error(name); checks.push(name); };
      const source = document.createElement('canvas'); source.width = 200; source.height = 300;
      const ctx = source.getContext('2d');
      const gradient = ctx.createLinearGradient(0, 0, 200, 300);
      gradient.addColorStop(0, '#f5c58d'); gradient.addColorStop(1, '#342d26');
      ctx.fillStyle = gradient;
      ctx.beginPath(); ctx.ellipse(100, 110, 60, 90, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(40, 190, 120, 100);
      ctx.fillRect(5, 5, 3, 3); // Disconnected false-positive island.
      const bitmap = await createImageBitmap(source);
      check(hasTransparency(bitmap), 'detect transparent uploads');
      const renderer = new PortraitRenderer(); renderer.setSource(bitmap);
      const output = document.createElement('canvas');
      const hash = (surface = output) => {
        const bytes = surface.getContext('2d').getImageData(0, 0, surface.width, surface.height).data;
        let h = 2166136261; for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i], 16777619);
        return h >>> 0;
      };
      const pixel = (x,y) => Array.from(output.getContext('2d').getImageData(x,y,1,1).data);
      renderer.render(output, settings, 'Square', 31);
      const initial = hash();
      renderer.render(output, settings, 'Square', 31);
      check(hash() === initial, 'deterministic cached rendering');
      const freshExport = document.createElement('canvas');
      renderer.render(freshExport, settings, 'Square', 31);
      check(hash(freshExport) === initial, 'fresh export matches preview pixel for pixel');
      renderer.render(output, settings, 'Square', 32);
      check(hash() !== initial, 'reseed changes texture');
      settings.background.transparent = true; settings.border.shadow = 0;
      renderer.render(output, settings, 'Square', 31);
      check(pixel(0,0)[3] === 0 && pixel(540,540)[3] === 255, 'transparent background preserves subject alpha');
      const face = pixel(540,540).join(); const pixelBorder = hash();
      settings.border.style = 'None';
      renderer.render(output, settings, 'Square', 31);
      check(hash() !== pixelBorder && pixel(540,540).join() === face, 'pixel border changes silhouette, not facial detail');
      const cleanHash = hash();
      settings.cutout.keepMain = false;
      renderer.render(output, settings, 'Square', 31);
      check(hash() !== cleanHash, 'main-subject cleanup removes false-positive islands and reframes');
      settings.cutout.keepMain = true;
      renderer.render(output, settings, 'Square', 31);
      check(hash() === cleanHash, 'mask cleanup toggles non-destructively');
      const alphaHash = () => {
        const bytes = output.getContext('2d').getImageData(0,0,output.width,output.height).data;
        let h=2166136261; for(let i=3;i<bytes.length;i+=4) h=Math.imul(h^bytes[i],16777619); return h;
      };
      const cleanAlpha = alphaHash();
      settings.recovery = {exposure:0.3,shadows:65,localContrast:15,sharpen:25,denoise:15};
      renderer.render(output, settings, 'Square', 31);
      check(hash() !== cleanHash, 'recovery controls invalidate preparation and filter caches');
      check(alphaHash() === cleanAlpha, 'facial recovery does not change the cutout silhouette');
      renderer.render(freshExport, settings, 'Square', 31);
      check(hash(freshExport) === hash(), 'enhanced export matches preview');
      settings.recovery = {exposure:0,shadows:0,localContrast:0,sharpen:0,denoise:0};
      renderer.render(output, settings, 'Square', 31);
      check(hash() === cleanHash, 'recovery reset restores original photograph non-destructively');
      const hashes = new Set();
      settings.background.transparent = false;
      for (const style of ['Photo','Duotone','Halftone','Dither','Newsprint']) {
        settings.treatment.style = style; renderer.render(output, settings, 'Square', 31); hashes.add(hash());
      }
      check(hashes.size === 5, 'all five filters produce distinct output');
      const edges = new Set();
      for (const style of ['None','Pixel','Sticker','Sketch']) {
        settings.border.style = style; renderer.render(output, settings, 'Square', 31); edges.add(hash());
      }
      check(edges.size === 4, 'all four border modes produce distinct output');
      const textures = new Set();
      for (const texture of ['None','Paper','Noise','Grunge']) {
        settings.background.texture = texture; renderer.render(output, settings, 'Square', 31); textures.add(hash());
      }
      check(textures.size === 4, 'paper, noise, grunge, and plain backgrounds are distinct');
      // Every requested mode-specific control must affect the real renderer.
      const changes = (group, key, next, name) => {
        renderer.render(output, settings, 'Square', 31); const before = hash();
        settings[group][key] = next; renderer.render(output, settings, 'Square', 31);
        check(hash() !== before, name);
      };
      settings.background.texture = 'None'; settings.border.style = 'None';
      settings.treatment.style = 'Halftone';
      changes('treatment','halftoneSize',15,'halftone dot size changes printed face');
      settings.treatment.style = 'Dither';
      changes('treatment','ditherPixelSize',7,'dither pixel size changes bitmap cells directly');
      settings.treatment.style = 'Photo'; settings.border.style = 'Sketch'; settings.border.width = 0;
      changes('border','sketchStroke',12,'sketch pen thickness works with zero outline gap');
      settings.border.style = 'None'; settings.treatment.style = 'Newsprint';
      changes('treatment','stippleSize',4,'newsprint grain size changes ink clusters');
      changes('treatment','printGamma',1.2,'newsprint gamma adjusts midtone lightness');
      changes('treatment','screenStrength',0,'newsprint screen can blend back to a continuous portrait');
      changes('treatment','inkDensity',80,'newsprint ink density changes coverage');
      settings.background.texture = 'Grunge';
      changes('background','patchSize',240,'generated grunge patch scale changes');
      changes('background','coverage',0.3,'generated grunge coverage changes');
      changes('background','distress',0.85,'generated grunge distress changes');
      changes('background','edgeBias',0,'generated grunge composition bias changes');
      renderer.render(output, settings, 'Square', 31); const grungeHash=hash();
      renderer.render(output, settings, 'Square', 31);
      check(hash()===grungeHash,'generated grunge is stable while tuning other controls');
      renderer.render(freshExport, settings, 'Square', 31);
      check(hash(freshExport)===grungeHash,'poster export matches preview');
      settings.background.transparent=true; renderer.render(output,settings,'Square',31);
      check(pixel(0,0)[3]===0,'transparent export omits generated grunge');
      for (const [format,width,height] of [['Square',1080,1080],['Landscape',1280,720],['Portrait',1080,1350]]) {
        renderer.render(output,settings,format,31);
        check(output.width === width && output.height === height, format + ' output dimensions');
      }
      const beforeCrop = hash(); settings.portrait.cropBottom = 35;
      renderer.render(output, settings, 'Portrait', 31);
      check(hash() !== beforeCrop, 'head/chest crop changes composition');
      check(output.toDataURL('image/png').startsWith('data:image/png;base64,'), 'PNG export is readable');
      const empty = new PortraitRenderer();
      const blank = document.createElement('canvas'); blank.width=10; blank.height=10;
      const transparent = await createImageBitmap(blank);
      let rejected = false; try { empty.setSource(transparent); } catch { rejected = true; }
      check(rejected, 'empty alpha is rejected');
      bitmap.close(); transparent.close();
      return { passed: checks.length, checks };
    })()`,
  }));
  if (!response.success) throw new Error(JSON.stringify(response.error));
  console.log(JSON.stringify(response.data.result, null, 2));
} finally {
  browser('close');
}
