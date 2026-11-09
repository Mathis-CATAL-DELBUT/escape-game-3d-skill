// Objets qui lévitent ou s'enfoncent. Pour chaque objet posé (ni fixé au mur, ni suspendu), rayons vers le
// bas depuis le DESSUS de l'objet (5 points de son empreinte) : écart entre sa base et le premier support.
// Objets muraux : écart entre leur dos et le mur. Écrit float.json et affiche les anomalies.
// Mural ou posé : drapeau `wall: true|false` du plan s'il existe ; sinon deviné (mur juste derrière ET rien
// dessous à moins de 2 cm). Seuls les maillages visibles comptent : les zones de toucher invisibles
// (visible = false ou material.visible = false) sont ignorées pour mesurer l'objet.
// Usage : node audit-float.js [seuil_cm=2] [appareil=desktop]
const L = require('./lib.cjs');
const fs = require('fs');
const path = require('path');

(async () => {
  const seuil = Number(process.argv[2] || 2) / 100;
  await L.reset();
  const b = await L.launch('chromium');
  const p = await L.newPlayer(b, process.argv[3] || 'desktop', 'float');
  await L.enterGame(p);
  await p.addScriptTag({ content: L.PAGE_HELPERS });
  const res = await p.evaluate(() => {
    const { g, W, Box3, V3, Raycaster } = window.__qa;
    const rc = new Raycaster(); rc.near = 0; rc.far = 8;
    W.root.updateMatrixWorld(true);
    // invisible « par lui-même » (zone de toucher) — mais pas parce que sa pièce est masquée par la visibilité
    const selfHidden = (o) => !o.visible || (o.material && (o.material.visible === false || (o.material.transparent && o.material.opacity === 0)));
    const all = []; W.root.traverse((o) => { if (o.isMesh && o.material && !selfHidden(o)) all.push(o); });
    // boîte des maillages visibles d'un objet (ancêtres compris jusqu'à l'objet)
    const visBox = (obj) => {
      const bb = new Box3();
      obj.traverse((o) => { if (!o.isMesh) return; for (let x = o; x && x !== obj.parent; x = x.parent) if (selfHidden(x) && (x.isMesh || !x.visible)) return; bb.expandByObject(o); });
      return isFinite(bb.min.x) ? bb : new Box3().setFromObject(obj);
    };
    const owner = new Map();
    for (const [id, obj] of Object.entries(W.props)) obj.traverse((o) => owner.set(o, id));
    const out = [];
    for (const pr of g.layout.props || []) {
      const obj = W.props[pr.id];
      if (!obj || window.__qa.ignored(pr.model) || pr.attach) continue;
      const bb = visBox(obj);
      if (!isFinite(bb.min.x)) continue;
      const others = all.filter((m) => owner.get(m) !== pr.id);
      const cast = (o, d) => { rc.set(o, d); const h = rc.intersectObjects(others, false)[0]; return h ? { d: h.distance, by: owner.get(h.object) || 'architecture' } : null; };
      const c = bb.getCenter(new V3()), sz = bb.getSize(new V3());
      const up = cast(new V3(c.x, bb.max.y - 0.01, c.z), new V3(0, 1, 0));
      const yaw = (pr.yaw || 0) * Math.PI / 180, back = new V3(-Math.sin(yaw), 0, -Math.cos(yaw));
      const wall = cast(c.clone(), back);
      const half = (Math.abs(back.x) > 0.5 ? sz.x : sz.z) / 2;
      const hang = !!up && up.d < 0.12;
      const wallNear = !!wall && wall.by === 'architecture' && wall.d < half + 0.08;
      let gap = Infinity, by = null;
      for (const [fx, fz] of [[0, 0], [-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) {
        const o = new V3(c.x + fx * sz.x, bb.max.y + 0.01, c.z + fz * sz.z);
        const h = cast(o, new V3(0, -1, 0));
        if (h) { const gg = bb.min.y - (o.y - h.d); if (gg < gap) { gap = gg; by = h.by; } }
      }
      // mural : drapeau du plan, sinon mur juste derrière ET pas posé sur un support (une caisse au sol contre
      // un mur est un objet posé, pas un objet mural)
      const onWall = typeof pr.wall === 'boolean' ? pr.wall : wallNear && !(gap <= 0.02 && gap >= -0.04);
      out.push({ id: pr.id, model: pr.model, pos: pr.pos, yaw: pr.yaw || 0, gap: +gap.toFixed(3), by, hang, onWall, wallGap: wall ? +(wall.d - half).toFixed(3) : null, size: [sz.x, sz.y, sz.z].map((v) => +v.toFixed(2)) });
    }
    return out;
  });
  fs.writeFileSync(path.join(L.SHOTS, 'float.json'), JSON.stringify(res, null, 1));
  const floating = res.filter((r) => !r.hang && !r.onWall && r.gap > seuil && r.gap < 3).sort((a, b) => b.gap - a.gap);
  const sunk = res.filter((r) => !r.hang && !r.onWall && r.gap < -0.04).sort((a, b) => a.gap - b.gap);
  const offWall = res.filter((r) => r.onWall && r.wallGap !== null && r.wallGap > 0.03 && r.wallGap <= 0.5);
  // mural sans mur derrière (rayon passé par une ouverture, yaw inversé ?) ET sans support dessous : à vérifier
  const noWall = res.filter((r) => r.onWall && (r.wallGap === null || r.wallGap > 0.5) && !(r.gap <= seuil && r.gap >= -0.04));
  console.log(`${res.length} objets · lévitent (> ${seuil * 100} cm) : ${floating.length}`);
  for (const r of floating) console.log(`  ${r.id.padEnd(24)} ${String(r.model).padEnd(26)} ${(r.gap * 100).toFixed(1).padStart(6)} cm au-dessus de ${r.by}  pos ${JSON.stringify(r.pos)}`);
  console.log(`enfoncés (> 4 cm, à vérifier en capture : un objet sous une étagère ou une chaise sous une table donne un faux positif) : ${sunk.length}`);
  for (const r of sunk.slice(0, 30)) console.log(`  ${r.id.padEnd(24)} ${(r.gap * 100).toFixed(1).padStart(7)} cm dans ${r.by}`);
  console.log(`muraux décollés du mur (> 3 cm) : ${offWall.length}`);
  for (const r of offWall) console.log(`  ${r.id.padEnd(24)} ${(r.wallGap * 100).toFixed(1)} cm`);
  if (noWall.length) console.log(`muraux sans mur derrière ni support (yaw inversé ? objet dans le vide ?) : ${noWall.length}`);
  for (const r of noWall) console.log(`  ${r.id.padEnd(24)} yaw ${r.yaw}  pos ${JSON.stringify(r.pos)}`);
  console.log('Corriger les hauteurs dans le plan (pos y −= écart), régénérer, relancer, puis vérifier avec audit-shots.cjs.');
  await b.close();
})();
