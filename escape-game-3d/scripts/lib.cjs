// Bibliothèque commune des contrôles navigateur (Playwright).
// Contrat : le jeu expose window.__game avec ?dev (voir references/architecture.md §7).
// Variables d'environnement :
//   BASE       URL du serveur (défaut http://localhost:3000)
//   GAME       chemin du jeu (défaut /) — la page ouverte est BASE + GAME + '?dev'
//   RESET_URL  facultatif : URL POST de remise à zéro (corps RESET_BODY, défaut {"type":"reset","confirm":"RESET"} ;
//              en-têtes en plus : RESET_HEADERS='{"x-admin-token":"…"}' si l'API est protégée par un jeton)
//   NO_RESET   1 = ne pas remettre à zéro (partie avancée exprès, objets révélés à contrôler)
//   PREP       code JavaScript (async) exécuté dans la page après l'entrée en jeu, ex. "await __game.net.act('code', {...})"
//   READY_SEL  sélecteur du bouton « prêt » de la salle d'attente (défaut #ready)
//   INTRO_SEL  sélecteur des boutons de l'introduction à passer (défaut "#intro button")
//   PLAYWRIGHT chemin du module playwright s'il n'est pas résolvable normalement
//   SHOTS      dossier des captures (défaut ./shots)
const fs = require('fs');
const path = require('path');
const pw = require(process.env.PLAYWRIGHT || 'playwright');

const BASE = process.env.BASE || 'http://localhost:3000';
const GAME = process.env.GAME || '/';
const SHOTS = path.resolve(process.env.SHOTS || 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const DEVICES = {
  desktop: { viewport: { width: 1280, height: 800 } },
  laptop: { viewport: { width: 1440, height: 900 } },
  phone: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  phonePortrait: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  ipad768: { viewport: { width: 768, height: 1024 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  ipad1024: { viewport: { width: 1024, height: 768 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  tablet: { viewport: { width: 1180, height: 820 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  android: { viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2.6 }
};

async function reset() {
  if (!process.env.RESET_URL || process.env.NO_RESET === '1') return;
  let extra = {}; try { extra = JSON.parse(process.env.RESET_HEADERS || '{}'); } catch (e) { /* ignoré */ }
  const r = await fetch(process.env.RESET_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', ...extra }, body: process.env.RESET_BODY || JSON.stringify({ type: 'reset', confirm: 'RESET' }) }).catch((e) => ({ ok: false, status: e.message }));
  if (!r.ok) console.log(`(remise à zéro refusée : ${r.status} — jeton RESET_HEADERS ? partie non remise à zéro)`);
  await new Promise((res) => setTimeout(res, 300));
}

async function launch(engine = 'chromium') {
  const args = engine === 'chromium' ? ['--enable-gpu', '--ignore-gpu-blocklist'] : [];
  // PW_CHANNEL=chrome : utiliser le Google Chrome installé ; sinon repli automatique sur Chrome si le Chromium
  // de Playwright n'est pas téléchargé (npx playwright install chromium).
  if (engine === 'chromium' && process.env.PW_CHANNEL) return pw.chromium.launch({ headless: true, args, channel: process.env.PW_CHANNEL });
  try { return await pw[engine].launch({ headless: true, args }); } catch (e) {
    if (engine !== 'chromium') throw e;
    return pw.chromium.launch({ headless: true, args, channel: 'chrome' });
  }
}

async function newPlayer(browser, device = 'desktop', label = 'p') {
  const opts = { ...DEVICES[device] };
  if (browser.browserType().name() === 'firefox') delete opts.isMobile;
  const ctx = await browser.newContext(opts);
  // Jeu dont l'accès de test porte un autre nom (GAME_HOOK=__h) ou dont l'indicateur de chargement diffère
  // (LOADED_PROP=loadedG) : on crée un alias window.__game pour que les contrôles marchent sans modifier le jeu.
  const hook = process.env.GAME_HOOK, loadedProp = process.env.LOADED_PROP;
  if (hook || loadedProp) {
    await ctx.addInitScript(([hook, loadedProp]) => {
      if (hook && hook !== '__game') Object.defineProperty(window, '__game', { configurable: true, get() { return window[hook]; } });
      if (loadedProp) {
        const t = setInterval(() => { const g = window.__game; if (g && !('loaded' in g)) { try { Object.defineProperty(g, 'loaded', { get() { return !!g[loadedProp]; } }); clearInterval(t); } catch (e) { clearInterval(t); } } }, 200);
      }
    }, [hook || '', loadedProp || '']);
  }
  const page = await ctx.newPage();
  page.logs = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) page.logs.push(`[${label} ${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => page.logs.push(`[${label} pageerror] ${e.message}`));
  return page;
}

// Ouvre le jeu, se déclare prêt UNE fois, passe l'introduction et attend le chargement complet.
// options.waitStart = false : rendre la main dès que le joueur est prêt (multijoueur : chacun se déclare prêt,
// puis on attend le début de partie sur toutes les pages). Un joueur qui arrive en cours de partie n'a pas de
// salle d'attente : on ne l'attend pas.
async function enterGame(page, options = {}) {
  const waitStart = options.waitStart !== false;
  await page.goto(`${BASE}${GAME}${GAME.includes('?') ? '&' : '?'}dev`, { waitUntil: 'domcontentloaded' });
  const ready = process.env.READY_SEL || '#ready';
  const phase = () => page.evaluate(() => { const g = window.__game; return g && g.state ? g.state.phase : null; }).catch(() => null);
  // attendre la salle d'attente OU une partie déjà lancée
  await page.waitForFunction((sel) => {
    const g = window.__game, el = document.querySelector(sel);
    return (g && g.state && g.state.phase && g.state.phase !== 'lobby') || (el && el.offsetParent !== null);
  }, ready, { timeout: 90000 }).catch(() => {});
  const ph0 = await phase();
  const lobbyShown = await page.evaluate((sel) => { const el = document.querySelector(sel); return !!(el && el.offsetParent !== null); }, ready).catch(() => false);
  if (ph0 === 'lobby' || (ph0 === null && lobbyShown)) {   // null : l'accès de test n'expose pas encore l'état
    // prêt de ce joueur selon l'état serveur, si le jeu l'expose (state.players[pid].ready)
    const isReady = () => page.evaluate(() => { const g = window.__game, pid = g && g.net && g.net.pid, pl = g && g.state && g.state.players; return !!(pid && pl && pl[pid] && pl[pid].ready); }).catch(() => false);
    await page.click(ready).catch(() => {});
    // un bouton « prêt » bascule souvent prêt / pas prêt : ne recliquer que si l'état dit « pas prêt »
    // si l'état n'expose pas « prêt » (state.players[pid].ready), ne pas recliquer : on risquerait d'annuler
    for (let i = 0; i < 2; i++) {
      await page.waitForTimeout(1500);
      const ph = await phase();
      if ((ph && ph !== 'lobby') || (await isReady())) break;
      const known = await page.evaluate(() => { const g = window.__game; return !!(g && g.net && g.net.pid && g.state && g.state.players); }).catch(() => false);
      if (!known) break;
      await page.click(ready).catch(() => {});
    }
    if (!waitStart) return;
    await page.waitForFunction(() => { const g = window.__game; return g && g.state && g.state.phase !== 'lobby'; }, null, { timeout: 30000 })
      .catch(() => console.log('(la partie n\'a pas démarré : d\'autres joueurs doivent-ils être prêts ?)'));
  }
  await finishEntry(page);
}

// Passe l'introduction, attend le chargement complet, puis exécute PREP si défini.
async function finishEntry(page) {
  const intro = process.env.INTRO_SEL || '#intro button';
  for (let i = 0; i < 20; i++) {
    const btn = page.locator(intro);
    if (!(await btn.count())) break;
    await btn.first().click({ timeout: 1500 }).catch(() => {});
    await page.waitForTimeout(400);
  }
  await page.waitForFunction(() => window.__game && window.__game.loaded, null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  if (process.env.PREP) {
    await page.evaluate(`(async () => { const __game = window.__game; ${process.env.PREP} })()`);
    await page.waitForTimeout(1200);
  }
}

async function shot(page, name) {
  const f = path.join(SHOTS, `${name}.png`);
  await page.screenshot({ path: f });
  return f;
}

// Planche contact : [[légende, fichier], …] → SHOTS/sheet-<nom>.png
async function sheet(browser, name, files, cols = 4) {
  const p = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const imgs = files.map(([cap, f]) => `<figure><img src="data:image/png;base64,${fs.readFileSync(f).toString('base64')}"><figcaption>${cap}</figcaption></figure>`).join('');
  await p.setContent(`<style>body{margin:0;background:#000;display:grid;grid-template-columns:repeat(${cols},1fr);gap:3px}figure{margin:0;position:relative}img{width:100%;display:block}figcaption{position:absolute;top:3px;left:6px;color:#ff0;font:bold 12px sans-serif;text-shadow:0 0 3px #000}</style>${imgs}`);
  await p.waitForTimeout(300);
  const out = path.join(SHOTS, `sheet-${name}.png`);
  await p.screenshot({ path: out, fullPage: true });
  await p.close();
  return out;
}

// Code injecté dans la page : utilitaires Three.js récupérés depuis la scène (pas d'import nécessaire).
const IGNORE = JSON.stringify((process.env.IGNORE_MODEL_PREFIX || 'decal:').split(',').filter(Boolean));
const PAGE_HELPERS = `
  var process_env_ignore = ${IGNORE};
  window.__qa = window.__qa || (() => {
    const g = window.__game, W = g.world;
    let mesh = null; W.root.traverse((o) => { if (!mesh && o.isMesh) mesh = o; });
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const Box3 = mesh.geometry.boundingBox.constructor, V3 = mesh.position.constructor;
    const Raycaster = g.interact.ray.constructor;
    const visible = (o) => { for (let x = o; x; x = x.parent) if (!x.visible) return false; return true; };
    const unpause = async () => { for (let i = 0; i < 15 && g.state && g.state.pausedAt; i++) { g.net.act('pause', { on: false }); await new Promise((r) => setTimeout(r, 300)); } };
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const frames = (n = 2) => new Promise((r) => { const f = () => (--n <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
    if (!g.layout.floors) g.layout.floors = { main: { y: 0 } };
    // étage d'une position : le plus haut dont le sol est sous elle (5 cm de tolérance)
    const floorY = (y) => { const fl = Object.values(g.layout.floors).sort((a, b) => b.y - a.y); for (const f of fl) if (y >= f.y - 0.05) return f.y; return fl[fl.length - 1].y; };
    const ignored = (m) => (process_env_ignore).some((pre) => String(m || '').startsWith(pre));
    return { g, W, Box3, V3, Raycaster, visible, unpause, wait, frames, floorY, ignored };
  })();
`;

module.exports = { pw, BASE, GAME, SHOTS, DEVICES, reset, launch, newPlayer, enterGame, finishEntry, shot, sheet, PAGE_HELPERS };
