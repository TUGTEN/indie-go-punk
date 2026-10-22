// Optional browser regression checks; requires Vite dev server and agent-browser.
import { execFileSync } from 'node:child_process';
const session = 'igp-icons-qa';
const browser = (...args) => execFileSync('agent-browser', ['--session', session, ...args], { encoding: 'utf8', timeout: 120_000 });
const evaluate = input => JSON.parse(execFileSync('agent-browser', ['--session', session, 'eval', '--stdin', '--json'], { input, encoding: 'utf8', timeout: 120_000 })).data.result;
try {
  browser('open', process.argv[2] || 'http://127.0.0.1:5173/icons');
  browser('wait', '.icon-card');
  browser('click', '.icon-filters button:nth-child(4)');
  if (evaluate(`document.querySelectorAll('.icon-card').length`) !== 8) throw new Error('Game category filtering');
  browser('fill', 'input[type=search]', 'potion');
  if (evaluate(`document.querySelectorAll('.icon-card').length`) !== 1) throw new Error('Search and category intersection');
  browser('click', '.icon-card');
  if (evaluate(`document.querySelector('.icon-inspector h2').textContent`) !== 'Potion') throw new Error('Selection updates inspector');
  browser('fill', 'input[type=search]', 'no-such-glyph');
  if (evaluate(`!!document.querySelector('.icon-empty')`) !== true) throw new Error('Empty state');
  browser('fill', 'input[type=search]', 'heart');
  browser('click', '.icon-filters button:first-child');
  browser('click', '[aria-label="Flipper amber"]');
  if (evaluate(`document.querySelector('input[aria-label="Paper color value"]').value`) !== '#f6a52b') throw new Error('Palette syncs DialKit');
  const results = evaluate(`(async () => {
    const { icons, iconSvg, drawPixelIcon } = await import('/src/icons/library.ts');
    const checks = ['Category, search, selection, empty state, palette sync'];
    const check = (pass, message) => { if (!pass) throw new Error(message); checks.push(message); };
    for (const icon of icons) {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
      const ctx = canvas.getContext('2d'); drawPixelIcon(ctx, icon, 0, 0, 8, '#234567');
      const expected = ctx.getImageData(0,0,128,128).data;
      const url = URL.createObjectURL(new Blob([iconSvg(icon, '#234567', 8)], { type: 'image/svg+xml' }));
      const img = new Image(); img.src = url; await img.decode();
      ctx.clearRect(0,0,128,128); ctx.drawImage(img,0,0); URL.revokeObjectURL(url);
      const actual = ctx.getImageData(0,0,128,128).data;
      check(actual.every((v,i) => v === expected[i]), icon.id + ': SVG matches Canvas pixel for pixel');
    }
    const blobs = []; const original = URL.createObjectURL; const click = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = blob => { blobs.push(blob); return original(blob); };
    HTMLAnchorElement.prototype.click = () => {};
    try {
      document.querySelector('.icon-exports .primary').click();
      check((await blobs.pop().text()).includes('<svg'), 'UI downloads SVG');
      document.querySelector('.icon-exports .button:not(.primary)').click();
      for(let i=0; !blobs.length && i<100; i++) await new Promise(r => setTimeout(r,20));
      const png = blobs.pop(); check(png?.type === 'image/png', 'UI downloads PNG');
      const bitmap = await createImageBitmap(png); check(bitmap.width === 128 && bitmap.height === 128, 'PNG integer scale dimensions');
      const c = document.createElement('canvas'); c.width=c.height=128; const ctx = c.getContext('2d'); ctx.drawImage(bitmap,0,0);
      check(ctx.getImageData(0,0,1,1).data[3] === 0, 'PNG transparent background'); bitmap.close();
      document.querySelector('.icon-library-note button').click();
      const sheet = new DOMParser().parseFromString(await blobs.pop().text(),'image/svg+xml').documentElement;
      check(sheet.getAttribute('width') === '1280' && sheet.getAttribute('height') === '720' && sheet.querySelectorAll('path').length === 32, 'Full sheet has all icons at 1280 × 720');
    } finally { URL.createObjectURL = original; HTMLAnchorElement.prototype.click = click; }
    return checks;
  })()`);
  console.log(`${results.length} browser checks passed:\n${results.join('\n')}`);
  browser('set', 'viewport', '390', '844');
  if (!evaluate('document.documentElement.scrollWidth <= innerWidth')) throw new Error('Mobile horizontal overflow');
  browser('click', '[aria-label="Select Heart"]');
  if (!evaluate(`document.querySelector('.icon-inspector').getBoundingClientRect().top < 50`)) throw new Error('Mobile tap opens inspector');
  browser('click', '.icon-back');
  if (!evaluate(`document.querySelector('.icon-filters').getBoundingClientRect().top < 50`)) throw new Error('Mobile return to library');
  console.log('Mobile layout: no horizontal overflow');
} catch (error) {
  console.error(browser('snapshot', '-i'));
  throw error;
} finally { browser('close'); }
