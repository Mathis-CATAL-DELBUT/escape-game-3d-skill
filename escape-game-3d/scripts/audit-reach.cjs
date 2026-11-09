// Portée : chaque cible interactive doit pouvoir être visée avec le VRAI code de visée (occlusion comprise)
// depuis un endroit libre du sol, debout (œil 1,60) ou accroupi (0,98). On vise 7 points de la cible.
// Signale : inatteignables, accroupi seulement, peu d'endroits, et cibles « cachées » vues depuis leur pièce
// (presque toujours un problème de pièce d'appartenance : porte, objet mural, voir pitfalls.md B1/B2).
// Usage : node audit-reach.js [appareil=ipad1024] [cible,cible,…]
// Objets révélés plus tard (contenu d'un casier) : ils sont « cachés » au départ, c'est normal. Pour les
// contrôler une fois révélés : PREP='await __game.net.act(...)' (résout ce qu'il faut dans la page) ou
// NO_RESET=1 après avoir avancé la partie autrement, et la liste des cibles en 2ᵉ argument.
const L = require('./lib.cjs');

(async () => {
  const device = process.argv[2] || 'ipad1024';
  await L.reset();
  const b = await L.launch('chromium');
  const p = await L.newPlayer(b, device, 'reach');
  await L.enterGame(p);
  await p.addScriptTag({ content: L.PAGE_HELPERS });
  let ids = await p.evaluate(() => [...window.__game.world.targets.keys()]);
  if (process.argv[3]) ids = process.argv[3].split(',');
  const res = [];
  for (const id of ids) {
    res.push(await p.evaluate(async (id) => {
      const { g, W, Box3, V3, visible, floorY, wait } = window.__qa;
      const meshes = W.targets.get(id) || [];
      const bb = new Box3(); for (const m of meshes) bb.expandByObject(m);
      if (!isFinite(bb.min.x)) return { id, skip: true };
      const c = bb.getCenter(new V3()), sz = bb.getSize(new V3()).multiplyScalar(0.35);
      const aims = [c.clone()]; for (const [ax, s] of [['x', 1], ['x', -1], ['y', 1], ['y', -1], ['z', 1], ['z', -1]]) { const q = c.clone(); q[ax] += s * sz[ax]; aims.push(q); }
      const fy = floorY(c.y);
      const floorId = Object.entries(g.layout.floors).find(([, f]) => f.y === fy)[0];
      const boxes = [];
      for (const pr of g.layout.props || []) { const o = W.props[pr.id]; if (!o || pr.col === 'none' || window.__qa.ignored(pr.model)) continue; const q = new Box3().setFromObject(o); if (isFinite(q.min.x) && q.max.y > fy + 0.35 && q.min.y < fy + 1.8) boxes.push(q); }
      const rooms = (g.layout.rooms || []).filter((r) => r.floor === floorId);
      const free = (x, z) => rooms.some((r) => x > r.rect[0] + 0.25 && x < r.rect[2] - 0.25 && z > r.rect[1] + 0.25 && z < r.rect[3] - 0.25)
        && !(g.layout.walls || []).some((w) => w.floor === floorId && x > w.box[0] - 0.28 && x < w.box[2] + 0.28 && z > w.box[1] - 0.28 && z < w.box[3] + 0.28)
        && !boxes.some((q) => x > q.min.x - 0.28 && x < q.max.x + 0.28 && z > q.min.z - 0.28 && z < q.max.z + 0.28);
      g.player.wake = 0; g.player.body.setFeet(c.x, fy, c.z);
      await wait(150);
      const vis = meshes.some(visible);
      const cam = g.camera, ok = { stand: 0, crouch: 0 }, instead = {}; let tried = 0;
      for (const d of [0.5, 0.8, 1.1, 1.4, 1.8, 2.2]) for (let k = 0; k < 16; k++) {
        const a = k / 16 * Math.PI * 2, x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
        if (!free(x, z)) continue;
        tried++;
        for (const [mode, eye] of [['stand', 1.6], ['crouch', 0.98]]) {
          let got = false, last = null;
          for (const aim of aims) {
            cam.position.set(x, fy + eye, z); cam.lookAt(aim); cam.updateMatrixWorld(true);
            const hit = g.interact.pick(0, 0);
            if (hit && hit.target === id) { got = true; break; }
            last = hit ? hit.target : 'rien';
          }
          if (got) ok[mode]++; else instead[last] = (instead[last] || 0) + 1;
        }
      }
      return { id, vis, tried, ok, instead };
    }, id));
  }
  const r = res.filter((x) => !x.skip);
  const hidden = r.filter((x) => !x.vis);
  const bad = r.filter((x) => x.vis && x.ok.stand + x.ok.crouch === 0);
  const crouch = r.filter((x) => x.vis && x.ok.stand === 0 && x.ok.crouch > 0);
  const tight = r.filter((x) => x.vis && x.ok.stand > 0 && x.ok.stand < 3);
  console.log(`${r.length} cibles`);
  console.log(`cachées vues depuis leur pièce (objet pas encore révélé = normal ; sinon bug de visibilité)${process.argv[3] ? ' — cibles demandées : elles devraient être révélées (PREP / NO_RESET)' : ''} :`, hidden.map((x) => x.id).join(', ') || 'aucune');
  console.log('INATTEIGNABLES :', bad.map((x) => `${x.id} (essais ${x.tried}, vu à la place ${JSON.stringify(x.instead)})`).join('\n  ') || 'aucune');
  console.log('accroupi seulement :', crouch.map((x) => x.id).join(', ') || 'aucune');
  console.log('peu d\'endroits debout :', tight.map((x) => `${x.id}:${x.ok.stand}`).join(', ') || 'aucune');
  if (p.logs.length) console.log(p.logs.slice(0, 5).join('\n'));
  await b.close();
})();
