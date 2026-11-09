// Visite photographique : deux points de vue libres par pièce (sur la diagonale, loin des meubles et des murs),
// lampe torche allumée ; planche contact par pièce. Optionnel : forcer l'éclairage avec world.override si le
// jeu le gère (ex. { piece: { r: 1, g: 1 } }). À REGARDER : obscurité, objets flottants, trous, textures.
// Usage : node audit-tour.js [appareil=desktop] [pièce,pièce,…]
const L = require('./lib.cjs');

(async () => {
  const device = process.argv[2] || 'desktop';
  const only = (process.argv[3] || '').split(',').filter(Boolean);
  await L.reset();
  const b = await L.launch('chromium');
  const p = await L.newPlayer(b, device, 'tour');
  await L.enterGame(p);
  await p.addScriptTag({ content: L.PAGE_HELPERS });
  await p.addStyleTag({ content: '#hud, #touch, #toasts, .toast, #prompt { visibility: hidden !important; }' });
  const spots = await p.evaluate(() => {
    const { g, W, Box3 } = window.__qa, out = {};
    const boxes = [];
    for (const pr of g.layout.props || []) { const o = W.props[pr.id]; if (!o || window.__qa.ignored(pr.model)) continue; const bb = new Box3().setFromObject(o); if (isFinite(bb.min.x)) boxes.push(bb); }
    for (const r of g.layout.rooms || []) {
      const fy = g.layout.floors[r.floor].y, [x0, z0, x1, z1] = r.rect;
      const free = (x, z) => (!W.cameraRoom || W.cameraRoom({ x, y: fy + 1.6, z }) === r.id)
        && !(g.layout.walls || []).some((w) => w.floor === r.floor && x > w.box[0] - 0.35 && x < w.box[2] + 0.35 && z > w.box[1] - 0.35 && z < w.box[3] + 0.35)
        && !boxes.some((bb) => bb.max.y > fy + 0.4 && bb.min.y < fy + 1.9 && x > bb.min.x - 0.3 && x < bb.max.x + 0.3 && z > bb.min.z - 0.3 && z < bb.max.z + 0.3);
      const pick = (fr) => { for (const f of fr) { const x = x0 + (x1 - x0) * f, z = z0 + (z1 - z0) * f; if (free(x, z)) return [x, z]; } for (const f of fr) { const x = x0 + (x1 - x0) * f, z = z1 - (z1 - z0) * f; if (free(x, z)) return [x, z]; } return null; };
      out[r.id] = { fy, c: [(x0 + x1) / 2, (z0 + z1) / 2], pts: [pick([0.15, 0.25, 0.35, 0.45]), pick([0.85, 0.75, 0.65, 0.55])].filter(Boolean) };
    }
    return out;
  });
  for (const [id, s] of Object.entries(spots)) {
    if (only.length && !only.includes(id)) continue;
    const files = [];
    for (let i = 0; i < s.pts.length; i++) {
      const [px, pz] = s.pts[i];
      await p.evaluate(async ([px, py, pz, cx, cz]) => {
        const { g, unpause, wait } = window.__qa; await unpause();
        g.player.wake = 0; g.player.body.setFeet(px, py, pz);
        g.player.yaw = Math.atan2(-(cx - px), -(cz - pz)); g.player.pitch = -0.12;
        if (g.player.hasLamp) g.player.hasLamp = () => true; if (g.player.light) g.player.light.on = true;
        await wait(900); await unpause();
      }, [px, s.fy, pz, s.c[0], s.c[1]]);
      files.push([`${id} ${i + 1}`, await L.shot(p, `tour-${id}-${i + 1}`)]);
    }
    if (!files.length) console.log(`${id} : aucun point de vue libre (pièce encombrée ?)`);
    else console.log(await L.sheet(b, `tour-${id}`, files, 2));
  }
  if (p.logs.length) console.log(p.logs.slice(0, 10).join('\n'));
  await b.close();
})();
