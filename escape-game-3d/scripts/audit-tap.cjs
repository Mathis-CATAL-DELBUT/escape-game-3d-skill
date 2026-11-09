// Toucher tactile : une cible placée dans la moitié GAUCHE de l'écran (zone du joystick) est touchée à 20 px à
// côté → l'interaction doit avoir lieu ; puis, dans un espace dégagé, un glisser dans la même zone doit faire avancer.
// Usage : node audit-tap.js <cible> [moteur=chromium] [appareil=ipad1024]
//   <cible> : id de cible (ex. item:cle) dont l'usage change l'état serveur ou ouvre une fenêtre.
// Succès si : l'état serveur a changé OU une fenêtre s'est ouverte (.ov, .card) OU une invite a clignoté.
const L = require('./lib.cjs');

(async () => {
  const target = process.argv[2];
  if (!target) { console.log('usage : node audit-tap.js <cible> [moteur] [appareil]'); process.exit(2); }
  const engine = process.argv[3] || 'chromium', device = process.argv[4] || 'ipad1024';
  await L.reset();
  const b = await L.launch(engine);
  const p = await L.newPlayer(b, device, 'tap');
  await L.enterGame(p);
  await p.addScriptTag({ content: L.PAGE_HELPERS });
  const scr = await p.evaluate(async (target) => {
    const { g, W, Box3, V3, floorY, wait } = window.__qa;
    const meshes = W.targets.get(target) || [];
    const bb = new Box3(); for (const m of meshes) bb.expandByObject(m);
    const c = bb.getCenter(new V3()), fy = floorY(c.y);
    g.player.wake = 0; g.player.body.setFeet(c.x + 0.9, fy, c.z + 0.6);
    g.player.yaw = Math.atan2(-(c.x - (c.x + 0.9)), -(c.z - (c.z + 0.6))) - 0.45;
    g.player.pitch = Math.atan2(c.y - (fy + 1.6), 1.08);
    await wait(800);
    const v = c.clone().project(g.camera);
    return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, w: innerWidth, before: JSON.stringify(g.state.obj || {}) + JSON.stringify(g.state.items || {}) };
  }, target);
  console.log(`cible à l'écran : ${Math.round(scr.x)},${Math.round(scr.y)} / ${scr.w} ${scr.x < scr.w * 0.42 ? '(zone du joystick)' : '(hors zone joystick : ajuster le recul)'}`);
  await p.touchscreen.tap(scr.x + 20, scr.y + 12);
  await p.waitForTimeout(1500);
  const after = await p.evaluate(() => ({ s: JSON.stringify(window.__game.state.obj || {}) + JSON.stringify(window.__game.state.items || {}), ov: !!document.querySelector('.ov, .card, .dialog'), prompt: !!document.querySelector('#prompt.on') }));
  const acted = after.s !== scr.before || after.ov || after.prompt;
  console.log(acted ? 'toucher dans la zone du joystick : OK' : 'PROBLÈME : le toucher dans la zone du joystick n\'a rien fait');
  if (engine === 'chromium') {
    await p.keyboard.press('Escape').catch(() => {});
    await p.evaluate(() => { const o = window.__game.overlays; if (o && o.close) o.close(); });
    // Espace dégagé : le joueur est contre le meuble de la cible ; pousser le joystick vers lui donnerait un faux
    // « ne fait plus avancer ». On cherche un endroit du même étage avec 1,6 m libres devant, d'après le plan.
    const spot = await p.evaluate(async () => {
      const { g, W, Box3, floorY, wait } = window.__qa;
      const f = g.player.body.feet(), fy = floorY(f.y);
      const floorId = Object.entries(g.layout.floors).find(([, x]) => x.y === fy)[0];
      const boxes = [];
      for (const pr of g.layout.props || []) { const o = W.props[pr.id]; if (!o || pr.col === 'none' || window.__qa.ignored(pr.model)) continue; const q = new Box3().setFromObject(o); if (isFinite(q.min.x) && q.max.y > fy + 0.1 && q.min.y < fy + 1.8) boxes.push(q); }
      const rooms = (g.layout.rooms || []).filter((r) => r.floor === floorId);
      const free = (x, z) => rooms.some((r) => x > r.rect[0] + 0.35 && x < r.rect[2] - 0.35 && z > r.rect[1] + 0.35 && z < r.rect[3] - 0.35)
        && !(g.layout.walls || []).some((w) => w.floor === floorId && x > w.box[0] - 0.35 && x < w.box[2] + 0.35 && z > w.box[1] - 0.35 && z < w.box[3] + 0.35)
        && !boxes.some((q) => x > q.min.x - 0.35 && x < q.max.x + 0.35 && z > q.min.z - 0.35 && z < q.max.z + 0.35);
      for (const r of rooms) for (const [u, v] of [[0.5, 0.5], [0.3, 0.3], [0.7, 0.7], [0.3, 0.7], [0.7, 0.3]]) {
        const x = r.rect[0] + (r.rect[2] - r.rect[0]) * u, z = r.rect[1] + (r.rect[3] - r.rect[1]) * v;
        if (!free(x, z)) continue;
        for (let k = 0; k < 8; k++) {
          const yaw = k * Math.PI / 4, dx = -Math.sin(yaw), dz = -Math.cos(yaw);   // avant = -Z tourné de yaw
          let ok = true; for (let s = 0.25; s <= 1.6 && ok; s += 0.25) ok = free(x + dx * s, z + dz * s);
          if (ok) { g.player.body.setFeet(x, fy, z); g.player.yaw = yaw; g.player.pitch = 0; await wait(500); return { x, z, yaw, room: r.id }; }
        }
      }
      return null;
    });
    if (spot) console.log(`(joystick testé en espace dégagé : pièce ${spot.room}, ${spot.x.toFixed(2)},${spot.z.toFixed(2)})`);
    else console.log('(aucun espace dégagé de 1,6 m trouvé d\'après le plan : joystick testé sur place, un blocage peut être un faux négatif)');
    const f0 = await p.evaluate(() => { const f = window.__game.player.body.feet(); return [f.x, f.z]; });
    const cdp = await p.context().newCDPSession(p);
    const vp = p.viewportSize(), jx = vp.width * 0.15, jy = vp.height * 0.75;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: jx, y: jy }] });
    for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: jx, y: jy - i * 7 }] }); await p.waitForTimeout(40); }
    await p.waitForTimeout(900);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const f1 = await p.evaluate(() => { const f = window.__game.player.body.feet(); return [f.x, f.z]; });
    const moved = Math.hypot(f1[0] - f0[0], f1[1] - f0[1]);
    console.log(moved > 0.3 ? `joystick : OK (${moved.toFixed(2)} m)` : `PROBLÈME : le joystick ne fait plus avancer (${moved.toFixed(2)} m)${spot ? '' : ' — vérifier qu\'aucun obstacle n\'était devant'}`);
  }
  if (engine !== 'chromium') console.log('(test du joystick sauté : il demande Chromium pour simuler un glisser tactile)');
  await b.close();
})();
