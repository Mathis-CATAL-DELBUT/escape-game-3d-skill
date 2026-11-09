// Passage physique : chaque porte est ouverte (côté client, état serveur neutralisé pendant le test), le
// personnage se place à 0,9 m devant et marche (touche W/Z maintenue) jusqu'à l'autre côté, dans les deux sens.
// Usage : node audit-walk.js [appareil=desktop] [touche=KeyW] [porteExclue,…]
// Les portes qui terminent la partie (sorties) peuvent rester bloquées dans un sens : normal.
const L = require('./lib.cjs');

(async () => {
  const key = process.argv[3] || 'KeyW';
  const exclude = (process.argv[4] || '').split(',').filter(Boolean);
  await L.reset();
  const b = await L.launch('chromium');
  const p = await L.newPlayer(b, process.argv[2] || 'desktop', 'walk');
  await L.enterGame(p);
  await p.addScriptTag({ content: L.PAGE_HELPERS });
  const doors = await p.evaluate((exclude) => {
    const { g, W } = window.__qa;
    g.__forced = new Set();
    const orig = W.applyState.bind(W);
    W.applyState = (s, f) => { orig(s, f); for (const id of g.__forced) { const d = W.doors[id]; d.open = d.target = 1; W.setDoorAngle(d); W.updateDoorColliders(id); } };
    return Object.values(W.doors).map((d) => d.def).filter((d) => !exclude.includes(d.id)).map((d) => ({
      id: d.id, floor: d.floor, along: d.planeZ !== undefined ? 'x' : 'z', plane: d.planeZ !== undefined ? d.planeZ : d.planeX, mid: (d.a0 + d.a1) / 2
    }));
  }, exclude);
  const fails = [];
  for (const d of doors) for (const dir of [1, -1]) {
    await p.evaluate(async ([d, dir]) => {
      const { g, W, unpause, wait } = window.__qa;
      await unpause();
      g.__forced.add(d.id);
      const door = W.doors[d.id]; door.open = door.target = 1; W.setDoorAngle(door); W.updateDoorColliders(d.id);
      const y = g.layout.floors[d.floor].y, s = -dir * 0.9;
      const [x, z] = d.along === 'x' ? [d.mid, d.plane + s] : [d.plane + s, d.mid];
      const [tx, tz] = d.along === 'x' ? [d.mid, d.plane - s] : [d.plane - s, d.mid];
      g.player.wake = 0; g.player.body.setFeet(x, y, z);
      g.player.yaw = Math.atan2(-(tx - x), -(tz - z)); g.player.pitch = 0;
      await wait(300);
    }, [d, dir]);
    await p.keyboard.down(key); await p.waitForTimeout(1500); await p.keyboard.up(key);
    await p.waitForTimeout(200);
    const pos = await p.evaluate(() => { const f = window.__game.player.body.feet(); return [f.x, f.z]; });
    const crossed = d.along === 'x' ? (pos[1] - d.plane) * dir > 0.3 : (pos[0] - d.plane) * dir > 0.3;
    console.log(`${crossed ? 'ok    ' : 'BLOQUÉ'} ${d.id.padEnd(16)} ${dir > 0 ? '→' : '←'} plan ${d.plane.toFixed(2)} arrivée ${pos.map((v) => v.toFixed(2)).join(',')}`);
    if (!crossed) fails.push(`${d.id} ${dir > 0 ? '→' : '←'}`);
  }
  console.log(fails.length ? 'ÉCHECS : ' + fails.join(' | ') : 'toutes les portes se franchissent');
  await b.close();
})();
