// Examen 3D : la fenêtre s'ouvre, glisser fait tourner l'objet SANS fermer la fenêtre, les boutons de rotation
// marchent (maintien), un toucher court sur le fond ferme. Ouvre la fenêtre via puzzles.use(<cible>).
// Attend : window.__game.overlays.inspecting = { pivot } pendant l'examen ; boutons .insp-btn[title="Tourner à droite"].
// Usage : node audit-inspect.js <cible> [moteur=chromium] [appareil=desktop|ipad1024]
const L = require('./lib.cjs');

(async () => {
  const target = process.argv[2];
  if (!target) { console.log('usage : node audit-inspect.js <cible> [moteur] [appareil]'); process.exit(2); }
  const engine = process.argv[3] || 'chromium', device = process.argv[4] || 'desktop';
  const touch = device !== 'desktop' && device !== 'laptop';
  await L.reset();
  const b = await L.launch(engine);
  const p = await L.newPlayer(b, device, 'insp');
  await L.enterGame(p);
  await p.evaluate(async (t) => { await window.__game.puzzles.use(t); }, target);
  await p.waitForTimeout(900);
  // angle total (y + x) : un glisser peut faire pencher autant que tourner
  const rot = () => p.evaluate(() => { const i = window.__game.overlays.inspecting; return i ? i.pivot.rotation.y + i.pivot.rotation.x : null; });
  const r0 = await rot();
  if (r0 === null) { console.log('PROBLÈME : pas de fenêtre d\'examen ouverte pour', target); await b.close(); return; }
  const vp = p.viewportSize(), cx = vp.width * 0.65, cy = vp.height * 0.4;
  if (!touch) {
    await p.mouse.move(cx, cy); await p.mouse.down();
    for (let i = 1; i <= 10; i++) await p.mouse.move(cx + i * 15, cy + i * 3);
    await p.mouse.up();
  } else if (engine !== 'chromium') {
    console.log('(glisser tactile non simulable sous WebKit : lancer ce test avec chromium pour le glisser ; on teste les boutons)');
  } else {
    const cdp = await p.context().newCDPSession(p);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] });
    for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + i * 15, y: cy + i * 3 }] }); await p.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  await p.waitForTimeout(300);
  const r1 = await rot();
  console.log(`glisser : fenêtre ${r1 !== null ? 'ouverte' : 'FERMÉE'} · rotation ${r0.toFixed(2)} → ${r1 === null ? '-' : r1.toFixed(2)}`);
  const btn = p.locator('.insp-btn[title="Tourner à droite"]');
  let r2 = r1;
  if (await btn.count()) {
    const bb = await btn.boundingBox();
    if (touch) await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2);
    else { await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down(); await p.waitForTimeout(600); await p.mouse.up(); }
    await p.waitForTimeout(200);
    r2 = await rot();
    console.log(`bouton : rotation ${r1 === null ? '-' : r1.toFixed(2)} → ${r2 === null ? '-' : r2.toFixed(2)}`);
  } else console.log('PROBLÈME : pas de boutons de rotation (.insp-btn)');
  await L.shot(p, `inspect-${device}`);
  if (touch) await p.touchscreen.tap(cx, cy); else await p.mouse.click(cx, cy);
  await p.waitForTimeout(300);
  const closed = (await rot()) === null;
  console.log(`toucher court : ${closed ? 'fermée' : 'TOUJOURS OUVERTE'}`);
  const dragOk = (touch && engine !== 'chromium') || (r1 !== null && Math.abs(r1 - r0) > 0.5);
  const ok = dragOk && r1 !== null && r2 !== null && Math.abs(r2 - r1) > 0.1 && closed;
  const partial = touch && engine !== 'chromium';
  console.log(ok ? (partial ? 'examen 3D : bon (boutons et fermeture seulement ; glisser tactile NON testé sous WebKit : relancer avec chromium)' : 'examen 3D : bon') : 'PROBLÈME examen 3D');
  await b.close();
})();
