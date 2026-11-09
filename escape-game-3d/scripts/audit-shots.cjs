// Captures « vue joueur » d'une liste d'objets (ids du plan) ou de cibles, pour vérifier à l'œil un correctif :
// objet posé, visible, pas derrière un meuble, porte/couvercle ouvert correctement (option --open pour forcer
// l'animation de l'objet à l'état ouvert). Planche : SHOTS/sheet-shots.png.
// Usage : node audit-shots.js id1 id2 … [--side] [--open] [--device=ipad1024]
const L = require('./lib.cjs');

(async () => {
  const args = process.argv.slice(2);
  const ids = args.filter((a) => !a.startsWith('--'));
  const side = args.includes('--side'), open = args.includes('--open');
  const device = (args.find((a) => a.startsWith('--device=')) || '--device=desktop').slice(9);
  await L.reset();
  const b = await L.launch('chromium');
  const p = await L.newPlayer(b, device, 'shots');
  await L.enterGame(p);
  await p.addScriptTag({ content: L.PAGE_HELPERS });
  await p.addStyleTag({ content: '#hud, #touch, #toasts, .toast { visibility: hidden !important; }' });
  const files = [];
  for (const id of ids) {
    const info = await p.evaluate(async ([id, side, open]) => {
      const { g, W, Box3, V3, floorY, unpause, wait } = window.__qa;
      await unpause();
      const obj = W.props[id] || (W.doors[id] && W.doors[id].group) || ((W.targets.get(id) || [])[0]);
      if (!obj) return 'introuvable';
      if (open) {
        for (const a of W.anims || []) if (a.propId === id) { a.when = () => true; a.target = 1; a.k = 1; W.setAnim(a); }
        if (W.doors[id]) { const d = W.doors[id]; d.open = d.target = 1; W.setDoorAngle(d); }
        W.applyState = () => {};
        W.root.updateMatrixWorld(true);
      }
      const bb = new Box3().setFromObject(obj), c = bb.getCenter(new V3());
      const pr = (g.layout.props || []).find((q) => q.id === id);
      const yaw = ((pr && pr.yaw) || 0) * Math.PI / 180;
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      const d = 1.3, lat = side ? 1.1 : 0.4, fwd = side ? 0.4 : d;
      const px = c.x + fx * fwd + fz * lat, pz = c.z + fz * fwd - fx * lat, fy = floorY(c.y);
      g.player.wake = 0; g.player.body.setFeet(px, fy, pz);
      const eye = Math.max(0.98, Math.min(1.6, c.y - fy + 0.3));
      g.player.crouch = eye < 1.3;
      g.player.yaw = Math.atan2(-(c.x - px), -(c.z - pz));
      g.player.pitch = Math.atan2(c.y - (fy + eye), Math.hypot(c.x - px, c.z - pz));
      if (g.player.hasLamp) g.player.hasLamp = () => true; if (g.player.light) g.player.light.on = true;
      await wait(1000);
      // centre puis quelques points autour (comme la tolérance du toucher) : un objet + sa gaine, un cadre…
      let hit = null;
      for (const [x, y] of [[0, 0], [0, -0.12], [0, 0.12], [-0.12, 0], [0.12, 0], [0, -0.25]]) { hit = g.interact.pick(x, y); if (hit) break; }
      return `vise : ${hit ? hit.target : 'rien'}`;
    }, [id, side, open]);
    console.log(`${id} : ${info}`);
    files.push([`${id} · ${info}`, await L.shot(p, `shot-${id.replace(/[:/]/g, '-')}`)]);
  }
  console.log(await L.sheet(b, 'shots', files));
  await b.close();
})();
