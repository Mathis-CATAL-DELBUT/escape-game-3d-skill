// Escaliers : pour chaque escalier du plan (layout.stairs : x0,x1,z0,z1,y0,y1,dir), monter depuis le bas sur
// trois lignes puis redescendre, en marchant réellement. Option --shots : captures image par image pendant
// la montée (planche sheet-stairs-<id>.png) pour repérer un vide entre étages (pitfalls.md B3).
// Usage : node audit-stairs.js [appareil=desktop] [--shots]
const L = require('./lib.cjs');

(async () => {
  const device = process.argv.find((a) => L.DEVICES[a]) || 'desktop';
  const withShots = process.argv.includes('--shots');
  await L.reset();
  const b = await L.launch('chromium');
  const p = await L.newPlayer(b, device, 'stairs');
  await L.enterGame(p);
  await p.addScriptTag({ content: L.PAGE_HELPERS });
  const stairs = await p.evaluate(() => window.__game.layout.stairs || []);
  const feet = () => p.evaluate(() => { const f = window.__game.player.body.feet(); return [+f.x.toFixed(2), +f.y.toFixed(2), +f.z.toFixed(2)]; });
  const place = (x, y, z, yaw) => p.evaluate(async ([x, y, z, yaw]) => {
    const { g, unpause, wait } = window.__qa; await unpause();
    g.player.wake = 0; g.player.body.setFeet(x, y, z); g.player.yaw = yaw; g.player.pitch = 0.05;
    if (g.player.hasLamp) g.player.hasLamp = () => true; if (g.player.light) g.player.light.on = true;
    await wait(500);
  }, [x, y, z, yaw]);
  const problems = [];
  const holdKey = async (ms, onTick) => { await p.keyboard.down('KeyW'); const t0 = Date.now(); while (Date.now() - t0 < ms) { await p.waitForTimeout(280); if (onTick) await onTick(); } await p.keyboard.up('KeyW'); };
  for (const s of stairs) {
    // sens de montée : dir 'x+' | 'x-' | 'z+' | 'z-'
    const ax = s.dir[0], sg = s.dir[1] === '+' ? 1 : -1;
    const lo = ax === 'x' ? (sg > 0 ? s.x0 : s.x1) : (sg > 0 ? s.z0 : s.z1), hi = ax === 'x' ? (sg > 0 ? s.x1 : s.x0) : (sg > 0 ? s.z1 : s.z0);
    const across = ax === 'x' ? [s.z0, s.z1] : [s.x0, s.x1];
    const yawUp = ax === 'x' ? (sg > 0 ? -Math.PI / 2 : Math.PI / 2) : (sg > 0 ? Math.PI : 0);
    for (const f of [0.25, 0.5, 0.75]) {
      const c = across[0] + (across[1] - across[0]) * f, start = lo - sg * 0.5;
      const [x, z] = ax === 'x' ? [start, c] : [c, start];
      await place(x, s.y0, z, yawUp);
      const files = [];
      let i = 0;
      await holdKey(6000, withShots && f === 0.5 ? async () => { const q = await feet(); files.push([`${q.join(' ')}`, await L.shot(p, `stairs-${s.id}-${i++}`)]); } : null);
      const q = await feet();
      console.log(`montée ${s.id} ligne ${f} → ${q.join(', ')}`);
      if (q[1] < s.y1 - 0.2) problems.push(`montée bloquée ${s.id} (ligne ${f}) à ${q.join(', ')}`);
      if (files.length) console.log('planche :', await L.sheet(b, `stairs-${s.id}`, files));
    }
    const c = (across[0] + across[1]) / 2, top = hi + sg * 0.6;
    const [x, z] = ax === 'x' ? [top, c] : [c, top];
    await place(x, s.y1, z, yawUp + Math.PI);
    await holdKey(6000);
    const q = await feet();
    console.log(`descente ${s.id} → ${q.join(', ')}`);
    if (q[1] > s.y0 + 0.2) problems.push(`descente bloquée ${s.id} à ${q.join(', ')}`);
  }
  console.log(problems.length ? 'PROBLÈMES : ' + problems.join(' | ') : (stairs.length ? 'escaliers : bons' : 'aucun escalier dans le plan'));
  await b.close();
})();
