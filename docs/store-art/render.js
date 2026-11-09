// Renders stage.html into Apple's three sizes, strips alpha, writes JPG alternatives and previews.
// Finals land next to this file; raw renders, guide previews and crop checks go in work/.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const path = require('path');

const DIR = __dirname;
const W_ = path.join(DIR, 'work');
const ALL = {
  header: { W: 3840, H: 1646, out: 'header-21x9.png', jpg: 'header-21x9.jpg' },
  search: { W: 3840, H: 2560, out: 'search-3x2.png', jpg: 'search-3x2.jpg' },
  universal: { W: 5244, H: 2950, out: 'universal-16x9.png' },
};
const run = (cmd, args) => execFileSync(cmd, args).toString().trim();

(async () => {
  const browser = await chromium.launch();
  for (const [v, { W, H, out, jpg }] of Object.entries(ALL)) {
    for (const guides of [false, true]) {
      const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => console.log(`[${v}] ERROR ${e.message}`));
      await page.goto('file://' + path.join(DIR, 'stage.html') + `?v=${v}` + (guides ? '&guides=1' : ''));
      await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(400);
      if (!guides) {
        const L = await page.evaluate(() => window.__layout);
        const r = (n) => Math.round(n);
        console.log(v, JSON.stringify({ T: L.T, T0: L.T0 || L.T, refW: r(L.refW), tbW: r(L.tbW), text: [r(L.textLeft), r(L.textTop), r(L.textRight), r(L.textTop + L.tbH)], phone: [r(L.phoneLeft), r(L.phoneTop), r(L.phoneRight), r(L.floorY)] }));
      }
      const raw = path.join(W_, `raw-${v}${guides ? '-guides' : ''}.png`);
      await page.screenshot({ path: raw, clip: { x: 0, y: 0, width: W, height: H } });
      await ctx.close();
      if (guides) {
        run('convert', [raw, '-alpha', 'off', '-resize', '1280x', path.join(W_, `preview-${v}-guides.png`)]);
        continue;
      }
      const fin = path.join(DIR, out);
      run('convert', [raw, '-alpha', 'off', '-define', 'png:color-type=2', fin]);
      if (jpg) run('convert', [fin, '-quality', '92', path.join(DIR, jpg)]);
    }
  }
  await browser.close();

  const P = (f) => path.join(DIR, f);
  run('convert', [P('header-21x9.png'), '-resize', '1280x', P('preview-header.png')]);
  run('convert', [P('search-3x2.png'), '-resize', '1280x', P('preview-search.png')]);
  // a narrow phone's view of the header: the centre 1646 x 1646 square, scaled to 800
  run('convert', [P('header-21x9.png'), '-crop', `1646x1646+${(3840 - 1646) / 2}+0`, '+repage', '-resize', '800x800', P('preview-phone-crop.png')]);
  // universal: Apple's 21:9 and 3:2 centre crops, for checking
  const uh = Math.round(5244 * 9 / 21), uw = Math.round(2950 * 1.5);
  run('convert', [P('universal-16x9.png'), '-crop', `5244x${uh}+0+${Math.round((2950 - uh) / 2)}`, '+repage', '-resize', '1280x', path.join(W_, 'universal-crop-21x9.png')]);
  run('convert', [P('universal-16x9.png'), '-crop', `${uw}x2950+${Math.round((5244 - uw) / 2)}+0`, '+repage', '-resize', '1280x', path.join(W_, 'universal-crop-3x2.png')]);
  run('convert', [P('universal-16x9.png'), '-resize', '1280x', path.join(W_, 'preview-universal.png')]);
  for (const f of ['header-21x9.png', 'search-3x2.png', 'universal-16x9.png', 'header-21x9.jpg', 'search-3x2.jpg']) {
    console.log(run('identify', ['-format', '%f  %w x %h  %[colorspace]  channels=%[channels]  alpha=%A  type=%[type]  ', P(f)]),
      run('stat', ['-c', '%s bytes', P(f)]));
  }
})();
