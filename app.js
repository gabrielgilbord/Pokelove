const STORAGE_KEY = "pokelove_route_progress_v2";

const memories = [
  {
    year: 1,
    label: "RECUERDO AÑO 1",
    photoUrl: "Pon aquí la URL de tu foto",
    text:
      "Nuestro primer año: el inicio de la aventura. Ese momento en el que todo se sintió nuevo, sencillo y perfecto.",
  },
  {
    year: 2,
    label: "RECUERDO AÑO 2",
    photoUrl: "Pon aquí la URL de tu foto",
    text:
      "Segundo año: aprendimos a elegirnos incluso en días difíciles. Y aun así, seguimos sumando alegría.",
  },
  {
    year: 3,
    label: "RECUERDO AÑO 3",
    photoUrl: "Pon aquí la URL de tu foto",
    text:
      "Tercer año: más equipo, más casa, más historia. De esos recuerdos que se sienten como checkpoint guardado.",
  },
  {
    year: 4,
    label: "RECUERDO AÑO 4",
    photoUrl: "Pon aquí la URL de tu foto",
    text:
      "Cuarto año: seguimos evolucionando. Me encanta cómo celebramos lo simple y nos cuidamos en lo grande.",
  },
  {
    year: 5,
    label: "RECUERDO AÑO 5",
    photoUrl: "Pon aquí la URL de tu foto",
    text:
      "Quinto año: cinco capítulos de nosotros. Y lo mejor es que esta historia aún está empezando.",
  },
];

const $ = (id) => document.getElementById(id);

// Assets de prueba:
// - Primero intenta archivos locales en `assets/` (evita CORS)
// - Si no existen, hace fallback a algunos remotos (pueden fallar)
const ASSETS = {
  trainerLocal: "./assets/children/Children/child_walk_light.png",
  grassLocal: "./assets/grass.png",
  pokeBallLocal: "./assets/pokeball.png",
  routeBgmLocalMp3: "./assets/route.mp3",
  routeBgmLocalOgg: "./assets/route.ogg",
  victoryBgmLocalMp3: "./assets/victory.mp3",
  victoryBgmLocalOgg: "./assets/victory.ogg",
  snorlaxLocal: "./assets/snorlax.png",
  sylveonLocal: "./assets/pokemon.png",
  pikachuLocal: "./assets/pikachu.png",
  mimikyuLocal: "./assets/mimikiu.png",
  trophy1Local: "./assets/copa1.png",
  trophy2Local: "./assets/copa2.png",

  // remotos (último recurso)
  grassRemote: "https://opengameart.org/sites/default/files/oga-textures/79629/grass_green_block_256x.png",
  pokeBallRemote: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png",
};

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar: ${url}`));
    img.src = url;
  });
}

const ui = {
  screens: {
    title: $("screen-title"),
    route: $("screen-route"),
    event: $("screen-event"),
    finale: $("screen-finale"),
  },
  btnStart: $("btnStart"),
  btnSound: $("btnSound"),
  btnMusic: $("btnMusic"),
  btnPause: $("btnPause"),
  btnResume: $("btnResume"),
  btnToggleSound2: $("btnToggleSound2"),
  btnToggleMusic2: $("btnToggleMusic2"),
  btnReset: $("btnReset"),
  btnReset2: $("btnReset2"),
  btnA: $("btnA"),
  dpad: $("dpad"),
  toast: $("toast"),
  hudProgress: $("hudProgress"),
  transition: $("transition"),
  menu: $("menu"),
  routeCanvas: $("routeCanvas"),
  confettiCanvas: $("confettiCanvas"),
  finaleAvatarCanvas: $("finaleAvatarCanvas"),
  eventLabel: $("eventLabel"),
  eventImg: $("eventImg"),
  eventText: $("eventText"),
  btnRegister: $("btnRegister"),
  btnSkip: $("btnSkip"),
  nextArrow: $("nextArrow"),
  btnBackToRoute: $("btnBackToRoute"),
  routeBgm: $("routeBgm"),
  victoryBgm: $("victoryBgm"),
  previewCanvas: $("previewCanvas"),
  previewDebug: $("previewDebug"),
  portraitCanvas: $("portraitCanvas"),
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

let state = {
  screen: "title",
  soundEnabled: false,
  musicEnabled: false,
  collected: [false, false, false, false, false],
  activeEventIndex: 0, // 0..4
  canMove: false,
  autoWalkToMedal: false,
  finaleUnlocked: false,
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.collected) && parsed.collected.length === 5) {
      state.collected = parsed.collected.map(Boolean);
    }
  } catch {
    // ignore
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ collected: state.collected }));
  } catch {
    // ignore
  }
}

function skinMultiply() {
  return null;
}

function setScreen(next) {
  state.screen = next;
  Object.entries(ui.screens).forEach(([k, el]) => {
    el.classList.toggle("screen--active", k === next);
  });
  window.scrollTo({ top: 0, behavior: "auto" });

  // Importante: cuando un canvas está en una pantalla oculta, su tamaño “visible” es 0.
  // Reajustamos al entrar a Ruta o Final para que el mapa/confeti se dibujen.
  if (next === "route" || next === "finale") {
    window.setTimeout(() => resizeCanvas(), 0);
  }
}

function collectedCount() {
  return state.collected.reduce((a, v) => a + (v ? 1 : 0), 0);
}

function nextRequiredIndex() {
  return state.collected.findIndex((v) => !v);
}

function showToast(msg, ms = 1200) {
  ui.toast.textContent = msg;
  ui.toast.classList.add("toast--show");
  window.clearTimeout(showToast._t);
  showToast._t = window.setTimeout(() => ui.toast.classList.remove("toast--show"), ms);
}

function flashTransition() {
  ui.transition.classList.remove("transition--go");
  // reflow
  void ui.transition.offsetWidth;
  ui.transition.classList.add("transition--go");
}

// --- Audio (SFX WebAudio + BGM archivos)
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
}

function playSfxConfirm() {
  if (!state.soundEnabled) return;
  ensureAudio();
  const now = audioCtx.currentTime;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.16, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
  g.connect(audioCtx.destination);

  const o = audioCtx.createOscillator();
  o.type = "square";
  o.frequency.setValueAtTime(659.25, now);
  o.frequency.setValueAtTime(784, now + 0.07);
  o.connect(g);
  o.start(now);
  o.stop(now + 0.18);
}

function playSfxItemGet() {
  if (!state.soundEnabled) return;
  ensureAudio();
  const now = audioCtx.currentTime;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.22, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
  g.connect(audioCtx.destination);

  const o = audioCtx.createOscillator();
  o.type = "square";
  o.frequency.setValueAtTime(523.25, now);
  o.frequency.setValueAtTime(659.25, now + 0.08);
  o.frequency.setValueAtTime(784, now + 0.16);
  o.frequency.setValueAtTime(1046.5, now + 0.26);
  o.connect(g);
  o.start(now);
  o.stop(now + 0.40);
}

async function playBgm(which) {
  if (!state.musicEnabled) return;
  try {
    if (which === "route") {
      ui.victoryBgm.pause();
      if (!ui.routeBgm.src) {
        const ok = await trySetAudioSource(ui.routeBgm, [ASSETS.routeBgmLocalMp3, ASSETS.routeBgmLocalOgg]);
        if (!ok) {
          showToast("No encuentro `assets/route.mp3` (o .ogg).", 1600);
          return;
        }
      }
      await ui.routeBgm.play();
    } else {
      ui.routeBgm.pause();
      if (!ui.victoryBgm.src) {
        const ok = await trySetAudioSource(ui.victoryBgm, [ASSETS.victoryBgmLocalMp3, ASSETS.victoryBgmLocalOgg]);
        if (!ok) {
          showToast("No encuentro `assets/victory.mp3` (o .ogg).", 1600);
          return;
        }
      }
      await ui.victoryBgm.play();
    }
  } catch {
    // autoplay bloqueado; se desbloquea con el siguiente gesto
  }
}

function stopBgm() {
  try {
    ui.routeBgm.pause();
    ui.victoryBgm.pause();
    ui.routeBgm.removeAttribute("src");
    ui.victoryBgm.removeAttribute("src");
  } catch {
    // ignore
  }
}

function syncSoundButtons() {
  ui.btnSound.setAttribute("aria-pressed", String(state.soundEnabled));
  ui.btnToggleSound2.setAttribute("aria-pressed", String(state.soundEnabled));
  ui.btnSound.textContent = state.soundEnabled ? "Sonido: ON" : "Sonido: OFF";
  ui.btnToggleSound2.textContent = state.soundEnabled ? "Sonido: ON" : "Sonido: OFF";
}

function syncMusicButtons() {
  ui.btnMusic.setAttribute("aria-pressed", String(state.musicEnabled));
  ui.btnToggleMusic2.setAttribute("aria-pressed", String(state.musicEnabled));
  ui.btnMusic.textContent = state.musicEnabled ? "Música: ON" : "Música: OFF";
  ui.btnToggleMusic2.textContent = state.musicEnabled ? "Música: ON" : "Música: OFF";
}

// --- Canvas RPG
const BASE_TILE = 16; // “unidad” de sprite/tile para dibujar (se escala a tilePx)
let tilePx = 16; // tamaño real del tile en píxeles (dinámico según pantalla)
const WORLD_W = 40;
const WORLD_H = 80;

const canvas = ui.routeCanvas;
const ctx = canvas.getContext("2d", { alpha: false });
ctx.imageSmoothingEnabled = false;

const renderAssets = {
  grassImg: null,
  grassPattern: null,
  pokeBallImg: null,
  lpc: {
    female: null,
    male: null,
    hairFemale: null,
    hairMale: null,
    malePants: null,
  },
  cute: {
    grass: null,
    path: null,
    water: null,
    treeSmall: null,
    chicken: null,
    pig: null,
    cow: null,
    sheep: null,
    decorSheet: null,
    fences: null,
    chest: null,
    patterns: {
      grass: null,
      path: null,
      water: null,
    },
  },
  pokelove: {
    layers: {},
  },
  mons: {
    snorlax: null,
    sylveon: null,
    pikachu: null,
    mimikyu: null,
  },
  trophy: {
    a: null,
    b: null,
  },
};

const preview = {
  ctx: null,
  t: 0,
  pattern: null,
  n: 0,
};

function resizePreviewCanvas() {
  if (!ui.previewCanvas) return;
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const w = ui.previewCanvas.clientWidth || 240;
  const h = ui.previewCanvas.clientHeight || 220;
  ui.previewCanvas.width = Math.max(1, Math.floor(w * dpr));
  ui.previewCanvas.height = Math.max(1, Math.floor(h * dpr));
  if (preview.ctx) preview.ctx.imageSmoothingEnabled = false;
  preview.pattern = null; // recrear patrón al cambiar tamaño
}

function resizeFinaleAvatarCanvas() {
  if (!ui.finaleAvatarCanvas) return;
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const w = ui.finaleAvatarCanvas.clientWidth || 320;
  const h = ui.finaleAvatarCanvas.clientHeight || 220;
  ui.finaleAvatarCanvas.width = Math.max(1, Math.floor(w * dpr));
  ui.finaleAvatarCanvas.height = Math.max(1, Math.floor(h * dpr));
}

const world = {
  tiles: new Uint8Array(WORLD_W * WORLD_H), // 0 grass, 1 path, 2 tree, 3 tallgrass, 4 water
  solid: new Uint8Array(WORLD_W * WORLD_H),
};

const camera = {
  x: 0,
  y: 0,
};

const fx = {
  shakeT: 0,
  shakeAmp: 0,
};

function idx(x, y) {
  return y * WORLD_W + x;
}

function generateWorld() {
  // Base: grass
  world.tiles.fill(0);
  world.solid.fill(0);

  // A winding-ish path from bottom to top
  let px = Math.floor(WORLD_W / 2);
  for (let y = WORLD_H - 4; y >= 4; y--) {
    const drift = (y % 7 === 0 ? (Math.random() < 0.5 ? -1 : 1) : 0);
    px = clamp(px + drift, 6, WORLD_W - 7);
    for (let w = -2; w <= 2; w++) {
      world.tiles[idx(px + w, y)] = 1;
    }
    // Tall grass patches around path
    if (y % 9 === 0) {
      for (let gx = px - 8; gx <= px - 4; gx++) {
        if (gx > 2) world.tiles[idx(gx, y)] = 3;
      }
      for (let gx = px + 4; gx <= px + 8; gx++) {
        if (gx < WORLD_W - 3) world.tiles[idx(gx, y)] = 3;
      }
    }
  }

  // Sin “bosque repetido” en tiles: dejamos el mapa limpio (césped + camino).

  // Water pond somewhere near middle-right
  const wx0 = Math.floor(WORLD_W * 0.65);
  const wy0 = Math.floor(WORLD_H * 0.45);
  for (let y = wy0; y < wy0 + 8; y++) {
    for (let x = wx0; x < wx0 + 10; x++) {
      if (world.tiles[idx(x, y)] === 1) continue;
      world.tiles[idx(x, y)] = 4;
      world.solid[idx(x, y)] = 1;
    }
  }
}

const player = {
  x: WORLD_W / 2,
  y: WORLD_H - 8,
  vx: 0,
  vy: 0,
  dir: "down",
  speed: 4.2, // tiles per second-ish (scaled by dt)
  walkFrame: 0,
  target: null, // {x,y} in tiles
};

// Sprite (soporte para sprite-sheet opcional del usuario)
// Si pones `assets/trainer.png`, se intentará usar como sprite-sheet.
// Formato esperado: 4 filas (down,left,right,up) x 4 columnas (frames).
// Cada frame: 16x24 (o similar; se infiere).
const trainerSprite = {
  img: null,
  ready: false,
  cols: 4,
  rows: 4,
  frameW: 16,
  frameH: 24,
  drawW: 16,
  drawH: 24,
};

function dirToRow(dir) {
  if (dir === "down") return 0;
  if (dir === "left") return 1;
  if (dir === "right") return 2;
  return 3; // up
}

function maybeLoadTrainerSprite() {
  // Usa un spritesheet walk (LPC) local como prueba (4 filas x 9 cols típico)
  Promise.resolve()
    .then(() => loadImage(ASSETS.trainerLocal))
    .then((img) => {
      trainerSprite.img = img;
      trainerSprite.ready = true;

      // heurística de recorte
      const w = img.width;
      const h = img.height;
      const looks4x9 = w % 9 === 0 && h % 4 === 0 && w / 9 >= 16 && h / 4 >= 16;
      const looks4x4 = w % 4 === 0 && h % 4 === 0 && w / 4 >= 16 && h / 4 >= 16;

      if (looks4x9) {
        // LPC walk suele tener 9 columnas por dirección; usamos 4 frames del medio
        trainerSprite.cols = 9;
        trainerSprite.rows = 4;
        trainerSprite.frameW = Math.floor(w / 9);
        trainerSprite.frameH = Math.floor(h / 4);
      } else {
        trainerSprite.cols = looks4x4 ? 4 : 1;
        trainerSprite.rows = looks4x4 ? 4 : 1;
        trainerSprite.frameW = looks4x4 ? Math.floor(w / 4) : w;
        trainerSprite.frameH = looks4x4 ? Math.floor(h / 4) : h;
      }

      // tamaño dibujado “GBA-ish” dentro de un tile
      trainerSprite.drawW = 16;
      trainerSprite.drawH = 24;
    })
    .catch(() => {
      trainerSprite.ready = false;
    });
}

function loadRenderAssets() {
  loadImage(ASSETS.grassLocal)
    .then((img) => {
      renderAssets.grassImg = img;
      try {
        renderAssets.grassPattern = ctx.createPattern(img, "repeat");
      } catch {
        renderAssets.grassPattern = null;
      }
    })
    .catch(() => {
      loadImage(ASSETS.grassRemote)
        .then((img) => {
          renderAssets.grassImg = img;
          try {
            renderAssets.grassPattern = ctx.createPattern(img, "repeat");
          } catch {
            renderAssets.grassPattern = null;
          }
        })
        .catch(() => {});
    });

  loadImage(ASSETS.pokeBallLocal)
    .then((img) => {
      renderAssets.pokeBallImg = img;
    })
    .catch(() => {
      loadImage(ASSETS.pokeBallRemote)
        .then((img) => {
          renderAssets.pokeBallImg = img;
        })
        .catch(() => {});
    });
}

function loadMonAssets() {
  loadImage(ASSETS.snorlaxLocal).then((img) => (renderAssets.mons.snorlax = img)).catch(() => {});
  loadImage(ASSETS.sylveonLocal).then((img) => (renderAssets.mons.sylveon = img)).catch(() => {});
  loadImage(ASSETS.pikachuLocal).then((img) => (renderAssets.mons.pikachu = img)).catch(() => {});
  loadImage(ASSETS.mimikyuLocal).then((img) => (renderAssets.mons.mimikyu = img)).catch(() => {});
  loadImage(ASSETS.trophy1Local).then((img) => (renderAssets.trophy.a = img)).catch(() => {});
  loadImage(ASSETS.trophy2Local).then((img) => (renderAssets.trophy.b = img)).catch(() => {});
}

function loadLpcLayers() {
  // Deprecated: ahora usamos `assets/pokelove_assets.png` como spritesheet principal.
}

function drawImageLayer(ctx2d, img, dx, dy, dw, dh, tint = null) {
  if (!img) return;
  ctx2d.imageSmoothingEnabled = false;
  ctx2d.drawImage(img, dx, dy, dw, dh);
  if (tint) {
    ctx2d.save();
    ctx2d.globalCompositeOperation = "multiply";
    ctx2d.globalAlpha = 0.30;
    ctx2d.fillStyle = tint;
    ctx2d.fillRect(dx, dy, dw, dh);
    ctx2d.restore();
  }
}

const AVATAR_LAYER_FILES = {
  body: "avatar 1.png",
  hairLong: "avatar hair 1.png",
  hairPonytail: "avatar hair 2.png",
  shirtBlue: "avatar shirt.png",
  shirtRed: "avatar shirt.png",
  jacketBlue: "avatar jacket 1.png",
  jacketRed: "avatar jacket 2.png",
  portraitLong: "avatar hair 1.png",
  portraitPonytail: "avatar hair 2.png",
  walkDown: ["avatar front.png", "avatar 1.png", "avatar front.png", "avatar 1.png"],
  // Animaciones laterales (3 frames) — usa los PNG recortados `left*.png` / `right*.png`
  walkLeft: ["left.png", "left 1.png", "left 2.png"],
  walkRight: ["right.png", "right 1.png", "right 2.png"],
  walkBack: ["avatar back.png", "avatar back 2.png", "avatar back.png", "avatar back 2.png"],
};

const AVATAR_OVERLAY_TUNING = {
  spinAmpRad: 0.08,
  spinSpeed: 0.9,
};

function assetUrl(fileName) {
  return `./assets/${encodeURIComponent(fileName)}`;
}

async function loadAvatarLayerAssets() {
  const entries = [
    ["body", AVATAR_LAYER_FILES.body],
    ["hairLong", AVATAR_LAYER_FILES.hairLong],
    ["hairPonytail", AVATAR_LAYER_FILES.hairPonytail],
    ["shirtBlue", AVATAR_LAYER_FILES.shirtBlue],
    ["shirtRed", AVATAR_LAYER_FILES.shirtRed],
    ["jacketBlue", AVATAR_LAYER_FILES.jacketBlue],
    ["jacketRed", AVATAR_LAYER_FILES.jacketRed],
    ["portraitLong", AVATAR_LAYER_FILES.portraitLong],
    ["portraitPonytail", AVATAR_LAYER_FILES.portraitPonytail],
  ];

  AVATAR_LAYER_FILES.walkDown.forEach((f, i) => entries.push([`walkDown${i}`, f]));
  AVATAR_LAYER_FILES.walkLeft.forEach((f, i) => entries.push([`walkLeft${i}`, f]));
  AVATAR_LAYER_FILES.walkRight.forEach((f, i) => entries.push([`walkRight${i}`, f]));
  AVATAR_LAYER_FILES.walkBack.forEach((f, i) => entries.push([`walkBack${i}`, f]));

  const results = await Promise.all(
    entries.map(async ([key, file]) => {
      try {
        const img = await loadImage(assetUrl(file));
        return [key, img];
      } catch {
        return [key, null];
      }
    })
  );

  renderAssets.pokelove.layers = Object.fromEntries(results);

  const layers = renderAssets.pokelove.layers;
  const base = layers.body;
  if (base) {
    const fullCanvasCandidates = [
      ["shirtBlue", layers.shirtBlue],
      ["jacketRed", layers.jacketRed],
      ["jacketBlue", layers.jacketBlue],
      ["walkDown0", layers.walkDown0],
      ["walkLeft0", layers.walkLeft0],
      ["walkRight0", layers.walkRight0],
      ["walkBack0", layers.walkBack0],
    ];
    const mismatch = fullCanvasCandidates.filter(([, img]) => img && (img.width !== base.width || img.height !== base.height));
    if (mismatch.length) {
      console.warn("Avatar layer canvas mismatch:", mismatch.map(([k]) => k).join(", "));
    }
  }
}

function getMenuAvatarLayers() {
  const layers = renderAssets.pokelove.layers || {};
  return [layers.body].filter(Boolean);
}

function getPortraitLayer() {
  const layers = renderAssets.pokelove.layers || {};
  return layers.body || layers.portraitLong || layers.walkDown0 || null;
}

function getWalkLayer(dir, frame) {
  const layers = renderAssets.pokelove.layers || {};
  if (dir === "left") {
    const f = frame % AVATAR_LAYER_FILES.walkLeft.length;
    return layers[`walkLeft${f}`] || layers.walkLeft0 || null;
  }
  if (dir === "right") {
    const f = frame % AVATAR_LAYER_FILES.walkRight.length;
    return layers[`walkRight${f}`] || layers.walkRight0 || null;
  }
  if (dir === "up") {
    const f = frame % AVATAR_LAYER_FILES.walkBack.length;
    return layers[`walkBack${f}`] || layers.walkBack0 || null;
  }
  const f = frame % AVATAR_LAYER_FILES.walkDown.length;
  return layers[`walkDown${f}`] || layers.walkDown0 || null;
}

function buildMenuAvatarComposite(dir, walkFrame, unit = 1) {
  const parts = getMenuAvatarLayers();
  const base = parts[0];
  if (!base) return { width: 0, height: 0, baselineY: 0, layers: [] };

  const w = base.width * unit;
  const h = base.height * unit;
  const tint = skinMultiply();
  const layers = parts.map((img, idx) => ({
    img,
    x: 0,
    y: 0,
    w,
    h,
    tint: idx === 0 ? tint : null,
  }));
  return { width: w, height: h, baselineY: h, layers };
}

function drawAvatarComposite(ctx2d, composite, x, y, idleBob = 0) {
  composite.layers.forEach((layer) => {
    drawImageLayer(ctx2d, layer.img, x + layer.x, y + layer.y + idleBob, layer.w, layer.h, layer.tint);
  });
}

function loadCuteAssets() {
  const base = "./assets/Cute_Fantasy_Free/Cute_Fantasy_Free";
  const urls = {
    grass: `${base}/Tiles/Grass_Middle.png`,
    path: `${base}/Tiles/Path_Middle.png`,
    water: `${base}/Tiles/Water_Middle.png`,
    treeSmall: `${base}/Outdoor decoration/Oak_Tree_Small.png`,
    decorSheet: `${base}/Outdoor decoration/Outdoor_Decor_Free.png`,
    fences: `${base}/Outdoor decoration/Fences.png`,
    chest: `${base}/Outdoor decoration/Chest.png`,
    chicken: `${base}/Animals/Chicken/Chicken.png`,
    pig: `${base}/Animals/Pig/Pig.png`,
    cow: `${base}/Animals/Cow/Cow.png`,
    sheep: `${base}/Animals/Sheep/Sheep.png`,
  };
  Object.entries(urls).forEach(([k, url]) => {
    loadImage(url)
      .then((img) => {
        renderAssets.cute[k] = img;
        if (k === "grass") {
          try {
            renderAssets.cute.patterns.grass = ctx.createPattern(img, "repeat");
          } catch {}
        }
        if (k === "path") {
          try {
            renderAssets.cute.patterns.path = ctx.createPattern(img, "repeat");
          } catch {}
        }
        if (k === "water") {
          try {
            renderAssets.cute.patterns.water = ctx.createPattern(img, "repeat");
          } catch {}
        }
      })
      .catch(() => {});
  });
}

// Quitamos los animalitos móviles: dejamos solo los Pokémon flotantes.
const critters = [];

const props = [];
// Pokémon flotantes decorativos (no bloquean movimiento)
const floatingMons = [];

function spawnCuteProps() {
  props.length = 0;
  // Coloca props deterministas: arbolitos, flores del sheet, vallas y cofres
  for (let y = 3; y < WORLD_H - 3; y++) {
    for (let x = 3; x < WORLD_W - 3; x++) {
      const t = world.tiles[idx(x, y)];
      if (t !== 0) continue; // solo sobre césped
      // evita cerca del camino
      const nearPath =
        world.tiles[idx(x, y - 1)] === 1 ||
        world.tiles[idx(x, y + 1)] === 1 ||
        world.tiles[idx(x - 1, y)] === 1 ||
        world.tiles[idx(x + 1, y)] === 1;
      if (nearPath) continue;

      const r = tileHash(x * 13, y * 17);
      // sin “bosque”: solo flores/rocas pequeñas
      if (r < 0.018) {
        // flor del decor sheet (varias filas)
        props.push({ kind: "flower", x: x + 0.2, y: y + 0.15, v: r, layer: "ground" });
      } else if (r < 0.021) {
        props.push({ kind: "rock", x: x + 0.2, y: y + 0.25, v: r, layer: "ground" });
      }
    }
  }

  // Un (1) árbol suelto, colocado en un sitio seguro y sin recortes.
  // Nota: treeSmall ocupa 2x2 tiles; lo colocamos con margen y sobre césped.
  for (let tries = 0; tries < 300; tries++) {
    const x = 6 + Math.floor(tileHash(tries + 11, 99) * (WORLD_W - 14));
    const y = 8 + Math.floor(tileHash(tries + 37, 101) * (WORLD_H - 18));
    const ok =
      world.tiles[idx(x, y)] === 0 &&
      world.tiles[idx(x + 1, y)] === 0 &&
      world.tiles[idx(x, y + 1)] === 0 &&
      world.tiles[idx(x + 1, y + 1)] === 0 &&
      // lejos del camino
      world.tiles[idx(x, y - 1)] !== 1 &&
      world.tiles[idx(x, y + 2)] !== 1 &&
      world.tiles[idx(x - 1, y)] !== 1 &&
      world.tiles[idx(x + 2, y)] !== 1;
    if (ok) {
      props.push({ kind: "treeSmall", x, y, w: 2, h: 2, layer: "tall" });
      break;
    }
  }

  // Un cercadito y un cofre cerca de la parte media
  props.push({ kind: "fenceBox", x: 12, y: 52, layer: "tall" });
  props.push({ kind: "chest", x: 14.2, y: 53.2, layer: "ground" });

  spawnFloatingMons();
}

function findSafeSpotNearPath(targetY, side = 1) {
  const y = clamp(Math.floor(targetY), 8, WORLD_H - 10);
  let pathX = null;
  for (let x = 4; x < WORLD_W - 4; x++) {
    if (world.tiles[idx(x, y)] === 1) {
      pathX = x;
      break;
    }
  }
  if (pathX == null) pathX = Math.floor(WORLD_W / 2);

  const tooCloseToGoal = (tx, ty) => {
    // evita tapar pokéballs o la medalla (que están sobre el camino)
    const nearItem = items?.some((it) => Math.abs((it.x + 0.5) - (tx + 0.5)) <= 0.9 && Math.abs((it.y + 0.5) - (ty + 0.5)) <= 0.9);
    const nearMedal = medal?.visible && Math.abs((medal.x + 0.5) - (tx + 0.5)) <= 1.2 && Math.abs((medal.y + 0.5) - (ty + 0.5)) <= 1.2;
    return Boolean(nearItem || nearMedal);
  };

  // PRIORIDAD: ponerlos en el camino principal (tile 1) y, si no cabe, justo al borde.
  const offsets = [0, side * 1, -side * 1, side * 2, -side * 2, side * 3, -side * 3];
  for (const off of offsets) {
    const x = clamp(pathX + off, 3, WORLD_W - 4);
    if (world.tiles[idx(x, y)] === 1 && !tooCloseToGoal(x, y)) return { x: x + 0.5, y: y + 0.8 };
  }

  for (const off of offsets) {
    const x = clamp(pathX + off, 3, WORLD_W - 4);
    // borde inmediato del camino: césped (0) y caminable
    if (world.tiles[idx(x, y)] === 0 && !isSolidAt(x, y) && !tooCloseToGoal(x, y)) return { x: x + 0.5, y: y + 0.8 };
  }

  return { x: pathX + 0.5, y: y + 0.8 };
}

function spawnFloatingMons() {
  floatingMons.length = 0;
  const specs = [
    { key: "snorlax", thought: "Zzz… ¿ya es hora del regalo?" },
    { key: "sylveon", thought: "¡Modo celebración activado!" },
    { key: "pikachu", thought: "¡Pika! (no olvides la guantera)" },
    { key: "mimikyu", thought: "Shh… te guardo el secreto del botín." },
  ];
  const ys = [62, 46, 30, 16];
  specs.forEach((s, i) => {
    const side = i % 2 === 0 ? 1 : -1;
    const spot = findSafeSpotNearPath(ys[i], side);
    floatingMons.push({
      key: s.key,
      x: spot.x,
      y: spot.y,
      t0: Math.random() * Math.PI * 2,
      thought: s.thought,
    });
  });
}

function updateCritters(dt) {
  critters.forEach((c, i) => {
    c.t += dt;
    if (c.nextTurn == null) c.nextTurn = 0.8 + (tileHash(i + 33, 77) * 1.4);
    c.nextTurn -= dt;

    // elige dirección aleatoria a intervalos
    if (c.nextTurn <= 0) {
      c.nextTurn = 0.8 + tileHash(i + Math.floor(perfNow / 400), 77) * 1.6;
      const pick = tileHash(i + 9, Math.floor(perfNow / 600)) * 4;
      c.moveDir =
        pick < 1 ? { x: 1, y: 0 } : pick < 2 ? { x: -1, y: 0 } : pick < 3 ? { x: 0, y: 1 } : { x: 0, y: -1 };
    }

    const md = c.moveDir || { x: 0, y: 0 };
    const speed = 0.55; // tiles/s
    const nx = c.x + md.x * speed * dt;
    const ny = c.y + md.y * speed * dt;

    // colisión simple con sólidos
    if (!isSolidAt(Math.floor(nx), Math.floor(ny))) {
      c.x = nx;
      c.y = ny;
      if (md.x !== 0) c.dir = md.x;
    } else {
      // rebote: cambia dirección
      c.nextTurn = 0;
    }
  });
}

function drawProp(p, view) {
  const px = (p.x - view.x) * tilePx;
  const py = (p.y - view.y) * tilePx;
  if (px < -tilePx * 4 || py < -tilePx * 4 || px > canvas.width + tilePx * 4 || py > canvas.height + tilePx * 4) return;

  if (p.kind === "treeSmall" && renderAssets.cute.treeSmall) {
    const img = renderAssets.cute.treeSmall;
    // deja el árbol estático (sin animación)
    const fw = Math.floor(img.width / 2);
    const fh = img.height;
    const frame = 0;
    // sombra
    ctx.save();
    ctx.translate(px, py);
    ctx.fillStyle = "rgba(0,0,0,.20)";
    ctx.beginPath();
    ctx.ellipse(tilePx * 1.0, tilePx * 1.85, tilePx * 0.60, tilePx * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.imageSmoothingEnabled = false;
    // Dibujo exacto 2x2 tiles para que no haya “medios árboles”
    ctx.drawImage(img, frame * fw, 0, fw, fh, 0, 0, tilePx * 2, tilePx * 2);
    ctx.restore();
    return;
  }

  if (p.kind === "chest" && renderAssets.cute.chest) {
    const img = renderAssets.cute.chest;
    const fw = Math.floor(img.width / 2);
    const fh = img.height;
    const frame = 0;
    ctx.save();
    ctx.translate(px, py);
    ctx.fillStyle = "rgba(0,0,0,.18)";
    ctx.beginPath();
    ctx.ellipse(tilePx * 0.55, tilePx * 0.95, tilePx * 0.28, tilePx * 0.10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, frame * fw, 0, fw, fh, 0, 0, tilePx * 1.1, tilePx * 1.1);
    ctx.restore();
    return;
  }

  if (p.kind === "fenceBox" && renderAssets.cute.fences) {
    const img = renderAssets.cute.fences;
    // dibuja un cercado 3x3 (tiles 16x16)
    const tile = Math.floor(img.width / 3);
    const drawTile = (tx, ty, sx, sy) => {
      ctx.drawImage(img, sx * tile, sy * tile, tile, tile, px + tx * tilePx, py + ty * tilePx, tilePx, tilePx);
    };
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    // top row
    drawTile(0, 0, 0, 0);
    drawTile(1, 0, 1, 0);
    drawTile(2, 0, 2, 0);
    // mid
    drawTile(0, 1, 0, 1);
    drawTile(1, 1, 1, 1);
    drawTile(2, 1, 2, 1);
    // bottom
    drawTile(0, 2, 0, 2);
    drawTile(1, 2, 1, 2);
    drawTile(2, 2, 2, 2);
    ctx.restore();
    return;
  }

  if (renderAssets.cute.decorSheet) {
    // Outdoor_Decor_Free: usa unas flores/rocas desde el sheet (aprox 16x16)
    const img = renderAssets.cute.decorSheet;
    const cell = 16;
    const pick = p.kind === "rock" ? 1 : 0;
    const sx = pick === 1 ? 0 : 0;
    const sy = pick === 1 ? 4 : 5; // filas aproximadas
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, sx * cell, sy * cell, cell, cell, px, py, tilePx, tilePx);
    ctx.restore();
  }
}

function drawCritter(c, view) {
  const img = renderAssets.cute[c.type];
  if (!img) return;
  const sx = (c.x - view.x) * tilePx;
  const sy = (c.y - view.y) * tilePx;
  if (sx < -tilePx * 2 || sy < -tilePx * 2 || sx > canvas.width + tilePx * 2 || sy > canvas.height + tilePx * 2) return;

  // sombra
  ctx.save();
  ctx.translate(sx, sy);
  ctx.fillStyle = "rgba(0,0,0,.22)";
  ctx.beginPath();
  ctx.ellipse(tilePx * 0.6, tilePx * 0.92, tilePx * 0.22, tilePx * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();

  // animación simple: 4 frames horizontales
  const frames = 4;
  const fw = Math.floor(img.width / frames);
  const fh = img.height;
  const frame = Math.floor(perfNow / 160 + c.t) % frames;
  const bob = Math.sin(perfNow / 220 + c.t) * (tilePx * 0.04);
  ctx.imageSmoothingEnabled = false;
  if (c.dir < 0) {
    ctx.scale(-1, 1);
    ctx.drawImage(img, frame * fw, 0, fw, fh, -tilePx * 1.4, tilePx * 0.10 + bob, tilePx * 1.4, tilePx * 1.2);
  } else {
    ctx.drawImage(img, frame * fw, 0, fw, fh, 0, tilePx * 0.10 + bob, tilePx * 1.4, tilePx * 1.2);
  }
  ctx.restore();
}

function drawAvatarLayers(ctx2d, dir, walkFrame, scale, ox, oy, idleBob = 0) {
  const composite = buildMenuAvatarComposite(dir, walkFrame, scale);
  if (!composite.layers.length) return;
  const cx = ox + composite.width / 2;
  const cy = oy + composite.height / 2;
  const rot = Math.sin(preview.t * AVATAR_OVERLAY_TUNING.spinSpeed) * AVATAR_OVERLAY_TUNING.spinAmpRad;
  ctx2d.save();
  ctx2d.translate(cx, cy);
  ctx2d.rotate(rot);
  drawAvatarComposite(ctx2d, composite, -composite.width / 2, -composite.height / 2, idleBob);
  ctx2d.restore();
}

function drawPreview(dt) {
  if (!ui.previewCanvas) return;
  if (!preview.ctx) {
    preview.ctx = ui.previewCanvas.getContext("2d", { alpha: true });
    preview.ctx.imageSmoothingEnabled = false;
  }

  preview.t += dt;
  preview.n += 1;
  if (ui.previewDebug) ui.previewDebug.textContent = "";
  const ctx2d = preview.ctx;
  const w = ui.previewCanvas.width;
  const h = ui.previewCanvas.height;

  ctx2d.clearRect(0, 0, w, h);

  // fondo neutro (sin césped)
  ctx2d.fillStyle = "#d9dee6";
  ctx2d.fillRect(0, 0, w, h);

  // overlay “pantalla” con brillo
  ctx2d.fillStyle = "rgba(0,0,0,.18)";
  ctx2d.fillRect(12, 12, w - 24, h - 24);
  ctx2d.fillStyle = "rgba(255,255,255,.08)";
  ctx2d.fillRect(14, 14, w - 28, h - 28);

  // idle bob (respira)
  const idleBob = Math.round(Math.sin(preview.t * 2.2) * 2);
  const walkFrame = Math.floor(preview.t * 6) % 4;

  const hasAvatarLayers = Boolean(renderAssets.pokelove.layers?.body);
  if (!hasAvatarLayers) {
    ctx2d.fillStyle = "#0b1020";
    ctx2d.font = "12px 'Press Start 2P'";
    ctx2d.textAlign = "center";
    ctx2d.textBaseline = "middle";
    ctx2d.fillText("CARGANDO...", w / 2, h / 2);
    return;
  }

  // Doblamos el tamaño percibido y centramos el conjunto completo.
  const baseComposite = buildMenuAvatarComposite("down", walkFrame, 1);
  const scale = Math.min((w * 0.90) / baseComposite.width, (h * 0.90) / baseComposite.height) * 0.88;
  const composite = buildMenuAvatarComposite("down", walkFrame, scale);
  const ox = Math.floor((w - composite.width) / 2);
  const oyRaw = Math.floor((h - composite.height) / 2 - h * 0.04);
  const oy = clamp(oyRaw, 4, Math.max(4, h - composite.height - 4));

  // reajusta la sombra bajo los pies del conjunto ya centrado
  const shadowCx = ox + composite.width / 2;
  const shadowCy = oy + composite.baselineY + idleBob + 6;
  ctx2d.fillStyle = "rgba(0,0,0,.16)";
  ctx2d.beginPath();
  ctx2d.ellipse(shadowCx, shadowCy, composite.width * 0.16, composite.height * 0.045, 0, 0, Math.PI * 2);
  ctx2d.fill();

  drawAvatarComposite(ctx2d, composite, ox, oy, idleBob);
}

function drawPortrait() {
  if (!ui.portraitCanvas) return;
  const ctx2d = ui.portraitCanvas.getContext("2d", { alpha: true });
  ctx2d.imageSmoothingEnabled = false;
  const w = ui.portraitCanvas.width;
  const h = ui.portraitCanvas.height;
  ctx2d.clearRect(0, 0, w, h);
  const portrait = getPortraitLayer();
  if (!portrait) return;

  // fondo suave
  ctx2d.fillStyle = "rgba(255,255,255,.12)";
  ctx2d.fillRect(0, 0, w, h);

  const scale = Math.max(1, Math.floor(Math.min((w * 0.92) / portrait.width, (h * 0.92) / portrait.height)));
  const dw = portrait.width * scale;
  const dh = portrait.height * scale;
  const ox = Math.floor(w / 2 - dw / 2);
  const oy = Math.floor(h / 2 - dh / 2);
  drawImageLayer(ctx2d, portrait, ox, oy, dw, dh, skinMultiply());
}

async function trySetAudioSource(audioEl, urls) {
  for (const url of urls) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) {
        audioEl.src = url;
        audioEl.load();
        return true;
      }
    } catch {
      // ignore
    }
  }
  return false;
}

const items = [
  { n: 1, x: 20, y: 66, taken: false },
  { n: 2, x: 20, y: 54, taken: false },
  { n: 3, x: 20, y: 42, taken: false },
  { n: 4, x: 20, y: 30, taken: false },
  { n: 5, x: 20, y: 18, taken: false },
];

const medal = { x: 20, y: 6, visible: false };

function syncItemsFromProgress() {
  items.forEach((it, i) => {
    it.taken = Boolean(state.collected[i]);
  });
  medal.visible = collectedCount() === 5;
  state.finaleUnlocked = collectedCount() === 5;
}

function isSolidAt(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) return true;
  return world.solid[idx(tx, ty)] === 1;
}

function tryMove(dx, dy, dt) {
  const nx = player.x + dx * player.speed * dt;
  const ny = player.y + dy * player.speed * dt;

  // simple collision: check target tile
  const tx = Math.round(nx);
  const ty = Math.round(ny);
  if (!isSolidAt(tx, ty)) {
    player.x = nx;
    player.y = ny;
    player.walkFrame += dt * 10;
  }
}

function setPlayerTargetFromTap(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const sx = (clientX - rect.left) / rect.width;
  const sy = (clientY - rect.top) / rect.height;
  const view = getView();
  const tx = Math.floor(view.x + sx * view.w);
  const ty = Math.floor(view.y + sy * view.h);
  if (isSolidAt(tx, ty)) return;
  player.target = { x: tx + 0.5, y: ty + 0.5 };
}

function getView() {
  // Cámara suave: la ruta se desplaza con el jugador.
  const tilesWide = Math.floor(canvas.width / tilePx);
  const tilesHigh = Math.floor(canvas.height / tilePx);
  const w = clamp(tilesWide, 10, WORLD_W);
  const h = clamp(tilesHigh, 12, WORLD_H);
  const x = clamp(camera.x, 0, WORLD_W - w);
  const y = clamp(camera.y, 0, WORLD_H - h);
  return { x, y, w, h };
}

function resizeCanvas() {
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const w = ui.routeCanvas.clientWidth || window.innerWidth || 360;
  const h = ui.routeCanvas.clientHeight || window.innerHeight || 640;

  const cw = Math.floor(w * dpr);
  const ch = Math.floor(h * dpr);
  ui.routeCanvas.width = cw;
  ui.routeCanvas.height = ch;
  ctx.imageSmoothingEnabled = false;

  // confetti
  ui.confettiCanvas.width = cw;
  ui.confettiCanvas.height = ch;

  // Zoom “Habbo”: menos tiles visibles = avatar más grande
  const targetW = 12;
  const targetH = 18;
  const byW = Math.floor(cw / targetW);
  const byH = Math.floor(ch / targetH);
  tilePx = clamp(Math.min(byW, byH), 18 * dpr, 64 * dpr);
  // fuerza a múltiplo de dpr para que quede “pixel-perfect”
  tilePx = Math.max(dpr, Math.floor(tilePx / dpr) * dpr);

  // clamp player within world after resize
  player.x = clamp(player.x, 2, WORLD_W - 3);
  player.y = clamp(player.y, 2, WORLD_H - 3);
  // Re-centra cámara cerca del jugador tras resize
  const tilesWide = Math.floor(ui.routeCanvas.width / tilePx);
  const tilesHigh = Math.floor(ui.routeCanvas.height / tilePx);
  const wTiles = clamp(tilesWide, 10, WORLD_W);
  const hTiles = clamp(tilesHigh, 12, WORLD_H);
  camera.x = clamp(player.x - wTiles / 2, 0, WORLD_W - wTiles);
  camera.y = clamp(player.y - hTiles / 2, 0, WORLD_H - hTiles);
}

function resizeConfettiToViewport() {
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  const w = window.innerWidth || 360;
  const h = window.innerHeight || 640;
  ui.confettiCanvas.width = Math.max(1, Math.floor(w * dpr));
  ui.confettiCanvas.height = Math.max(1, Math.floor(h * dpr));
}

function tileHash(tx, ty) {
  // deterministic pseudo-random 0..1 based on coords
  const n = (tx * 73856093) ^ (ty * 19349663);
  const x = (n >>> 0) * 2654435761;
  return ((x >>> 0) % 1024) / 1024;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function shadeHex(hex, amt) {
  // amt: -1..1
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const f = (v) => clamp(Math.round(v + amt * 255), 0, 255);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

function drawDither(px, py, base, tx, ty) {
  // ruido/dithering “pixel art” con 2-3 tonos
  const a = tileHash(tx + 11, ty + 3);
  const b = tileHash(tx + 2, ty + 19);
  const c = tileHash(tx + 29, ty + 7);
  const t1 = shadeHex(base, -0.10);
  const t2 = shadeHex(base, 0.07);
  ctx.fillStyle = base;
  ctx.fillRect(px, py, tilePx, tilePx);
  ctx.fillStyle = a < 0.5 ? "rgba(0,0,0,.08)" : "rgba(255,255,255,.05)";
  ctx.fillRect(px + Math.floor(tilePx * 0.18), py + Math.floor(tilePx * 0.22), Math.max(1, Math.floor(tilePx * 0.08)), Math.max(1, Math.floor(tilePx * 0.08)));
  ctx.fillRect(px + Math.floor(tilePx * 0.68), py + Math.floor(tilePx * 0.62), Math.max(1, Math.floor(tilePx * 0.08)), Math.max(1, Math.floor(tilePx * 0.08)));
  ctx.fillStyle = b < 0.5 ? t1 : t2;
  ctx.fillRect(px + Math.floor(tilePx * 0.44), py + Math.floor(tilePx * 0.32), Math.max(1, Math.floor(tilePx * 0.06)), Math.max(1, Math.floor(tilePx * 0.06)));
  if (c < 0.25) {
    ctx.fillStyle = "rgba(0,0,0,.06)";
    ctx.fillRect(px + Math.floor(tilePx * 0.10), py + Math.floor(tilePx * 0.76), Math.max(1, Math.floor(tilePx * 0.18)), Math.max(1, Math.floor(tilePx * 0.06)));
  }
}

function drawTile(t, tx, ty, px, py) {
  // px,py in pixels
  if (t === 0) {
    // césped estático: dibuja tile por tile (evita patrón "deslizante")
    const grassTile = renderAssets.cute.grass || renderAssets.grassImg;
    if (grassTile) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(grassTile, 0, 0, grassTile.width, grassTile.height, px, py, tilePx, tilePx);
    } else {
      const base = tileHash(tx, ty) < 0.5 ? "#4aa24f" : "#3f9145";
      drawDither(px, py, base, tx, ty);
    }

    // “tiles aleatorios” de decoración (flores/piedras/briznas) deterministas
    const f = tileHash(tx * 5 + 1, ty * 5 + 9);
    if (f < 0.028) {
      // flor
      ctx.fillStyle = f < 0.014 ? "#ff6aa2" : "#ffd44a";
      ctx.fillRect(px + Math.floor(tilePx * 0.22), py + Math.floor(tilePx * 0.58), Math.max(1, Math.floor(tilePx * 0.10)), Math.max(1, Math.floor(tilePx * 0.10)));
      ctx.fillRect(px + Math.floor(tilePx * 0.30), py + Math.floor(tilePx * 0.50), Math.max(1, Math.floor(tilePx * 0.10)), Math.max(1, Math.floor(tilePx * 0.10)));
    } else if (f < 0.040) {
      // piedra
      ctx.fillStyle = "rgba(40,45,60,.55)";
      ctx.fillRect(px + Math.floor(tilePx * 0.62), py + Math.floor(tilePx * 0.64), Math.max(2, Math.floor(tilePx * 0.14)), Math.max(2, Math.floor(tilePx * 0.10)));
      ctx.fillStyle = "rgba(255,255,255,.12)";
      ctx.fillRect(px + Math.floor(tilePx * 0.64), py + Math.floor(tilePx * 0.66), Math.max(1, Math.floor(tilePx * 0.06)), Math.max(1, Math.floor(tilePx * 0.04)));
    } else if (f < 0.060) {
      // brizna distinta
      ctx.fillStyle = "rgba(255,255,255,.09)";
      ctx.fillRect(px + Math.floor(tilePx * 0.14), py + Math.floor(tilePx * 0.38), Math.max(1, Math.floor(tilePx * 0.06)), Math.max(2, Math.floor(tilePx * 0.18)));
      ctx.fillRect(px + Math.floor(tilePx * 0.18), py + Math.floor(tilePx * 0.42), Math.max(1, Math.floor(tilePx * 0.06)), Math.max(2, Math.floor(tilePx * 0.16)));
    }
  } else if (t === 1) {
    // camino estático
    const pathTile = renderAssets.cute.path;
    if (pathTile) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(pathTile, 0, 0, pathTile.width, pathTile.height, px, py, tilePx, tilePx);
    } else if (renderAssets.grassImg) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(renderAssets.grassImg, 0, 0, renderAssets.grassImg.width, renderAssets.grassImg.height, px, py, tilePx, tilePx);
      ctx.fillStyle = "rgba(168,126,66,.55)";
      ctx.fillRect(px, py, tilePx, tilePx);
      const n = tileHash(tx * 3 + 5, ty * 3 + 9);
      ctx.fillStyle = n < 0.5 ? "rgba(0,0,0,.10)" : "rgba(255,255,255,.06)";
      ctx.fillRect(px + Math.floor(tilePx * 0.18), py + Math.floor(tilePx * 0.28), Math.max(1, Math.floor(tilePx * 0.10)), Math.max(1, Math.floor(tilePx * 0.10)));
      ctx.fillRect(px + Math.floor(tilePx * 0.62), py + Math.floor(tilePx * 0.62), Math.max(1, Math.floor(tilePx * 0.10)), Math.max(1, Math.floor(tilePx * 0.10)));
    } else {
      // camino de tierra procedural (fallback)
      drawDither(px, py, "#d6be7d", tx + 101, ty + 101);
    }
    // bordes suavizados (si vecino no es camino)
    const bw = Math.max(1, Math.floor(tilePx * 0.10));
    const isPath = (x, y) => (x >= 0 && y >= 0 && x < WORLD_W && y < WORLD_H ? world.tiles[idx(x, y)] === 1 : false);
    if (!isPath(tx, ty - 1)) {
      ctx.fillStyle = "rgba(255,255,255,.10)";
      ctx.fillRect(px, py, tilePx, bw);
    }
    if (!isPath(tx, ty + 1)) {
      ctx.fillStyle = "rgba(0,0,0,.12)";
      ctx.fillRect(px, py + tilePx - bw, tilePx, bw);
    }
    if (!isPath(tx - 1, ty)) {
      ctx.fillStyle = "rgba(0,0,0,.10)";
      ctx.fillRect(px, py, bw, tilePx);
    }
    if (!isPath(tx + 1, ty)) {
      ctx.fillStyle = "rgba(0,0,0,.10)";
      ctx.fillRect(px + tilePx - bw, py, bw, tilePx);
    }

    // sombreado inferior extra
    ctx.fillStyle = "rgba(0,0,0,.07)";
    ctx.fillRect(px, py + Math.floor(tilePx * 0.78), tilePx, Math.max(2, Math.floor(tilePx * 0.22)));
  } else if (t === 3) {
    // hierba alta con “hojitas”
    if (renderAssets.grassPattern) {
      ctx.fillStyle = renderAssets.grassPattern;
      ctx.fillRect(px, py, tilePx, tilePx);
      ctx.fillStyle = "rgba(0,0,0,.10)";
      ctx.fillRect(px, py, tilePx, tilePx);
    } else {
      drawDither(px, py, "#2f8d3b", tx + 17, ty + 17);
    }
    ctx.fillStyle = "rgba(255,255,255,.08)";
    ctx.fillRect(px + Math.floor(tilePx * 0.10), py + Math.floor(tilePx * 0.15), Math.max(2, Math.floor(tilePx * 0.12)), Math.floor(tilePx * 0.75));
    ctx.fillRect(px + Math.floor(tilePx * 0.34), py + Math.floor(tilePx * 0.08), Math.max(2, Math.floor(tilePx * 0.12)), Math.floor(tilePx * 0.85));
    ctx.fillRect(px + Math.floor(tilePx * 0.62), py + Math.floor(tilePx * 0.18), Math.max(2, Math.floor(tilePx * 0.12)), Math.floor(tilePx * 0.70));
    ctx.fillStyle = "rgba(0,0,0,.10)";
    ctx.fillRect(px + Math.floor(tilePx * 0.18), py + Math.floor(tilePx * 0.55), Math.max(1, Math.floor(tilePx * 0.10)), Math.max(1, Math.floor(tilePx * 0.10)));
    ctx.fillRect(px + Math.floor(tilePx * 0.70), py + Math.floor(tilePx * 0.40), Math.max(1, Math.floor(tilePx * 0.10)), Math.max(1, Math.floor(tilePx * 0.10)));
  } else if (t === 2) {
    // (desactivado) antes eran árboles repetidos en tiles; ahora lo tratamos como césped
    const grassTile = renderAssets.cute.grass || renderAssets.grassImg;
    if (grassTile) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(grassTile, 0, 0, grassTile.width, grassTile.height, px, py, tilePx, tilePx);
    } else {
      const base = tileHash(tx, ty) < 0.5 ? "#4aa24f" : "#3f9145";
      drawDither(px, py, base, tx, ty);
    }
  } else if (t === 4) {
    const waterTile = renderAssets.cute.water;
    if (waterTile) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(waterTile, 0, 0, waterTile.width, waterTile.height, px, py, tilePx, tilePx);
    } else {
      ctx.fillStyle = "#1e4e80";
      ctx.fillRect(px, py, tilePx, tilePx);
      ctx.fillStyle = "rgba(255,255,255,.10)";
      ctx.fillRect(px, py + Math.floor(tilePx * 0.2), tilePx, Math.max(2, Math.floor(tilePx * 0.12)));
      ctx.fillRect(px, py + Math.floor(tilePx * 0.65), tilePx, Math.max(2, Math.floor(tilePx * 0.12)));
    }
  }
}

function drawItem(it, view) {
  if (it.taken) return;
  const required = nextRequiredIndex();
  const locked = required !== -1 && it.n - 1 !== required;

  const sx = (it.x - view.x) * tilePx;
  const sy = (it.y - view.y) * tilePx;
  if (sx < -tilePx || sy < -tilePx || sx > canvas.width || sy > canvas.height) return;

  // sparkle "pokeball" object
  const bob = Math.sin(perfNow / 220 + it.n) * (tilePx * 0.09);
  ctx.save();
  ctx.translate(sx + tilePx / 2, sy + tilePx / 2 + bob);
  const s = tilePx / BASE_TILE;
  ctx.scale(s, s);

  // shadow
  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.fillRect(-6, 6, 12, 3);

  if (renderAssets.pokeBallImg) {
    ctx.globalAlpha = locked ? 0.55 : 1;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(renderAssets.pokeBallImg, -8, -10, 16, 16);
    ctx.globalAlpha = 1;
    if (!locked) {
      const tw = 0.45 + 0.55 * Math.sin(perfNow / 120 + it.n);
      ctx.fillStyle = `rgba(255,255,255,${0.30 + tw * 0.45})`;
      ctx.fillRect(7, -12, 2, 2);
      ctx.fillRect(10, -9, 2, 2);
    }
  } else {
    // fallback procedural
    const top = locked ? "rgba(170,170,170,.90)" : "#d33b3b";
    const top2 = locked ? "rgba(150,150,150,.90)" : "#7c1212";
    const bot = locked ? "rgba(245,245,245,.90)" : "#ffffff";
    const bot2 = locked ? "rgba(215,215,215,.90)" : "#d9d9d9";
    ctx.fillStyle = top;
    ctx.fillRect(-7, -6, 14, 6);
    ctx.fillStyle = top2;
    ctx.fillRect(-7, -1, 14, 1);
    ctx.fillStyle = bot;
    ctx.fillRect(-7, 0, 14, 6);
    ctx.fillStyle = bot2;
    ctx.fillRect(-7, 5, 14, 1);
    ctx.fillStyle = "#1b1b23";
    ctx.fillRect(-7, -1, 14, 2);
    ctx.fillRect(-2, -3, 4, 6);
    ctx.fillStyle = "rgba(255,255,255,.35)";
    ctx.fillRect(-5, -5, 3, 2);
    ctx.fillRect(-4, -3, 2, 1);
  }

  // número pequeño sobre la pokéball (sutil)
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = "rgba(11,16,32,.85)";
  ctx.fillRect(-7, -16, 14, 7);
  ctx.fillStyle = "#fff";
  ctx.font = "8px 'Press Start 2P'";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(it.n), 0, -12);
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawMedal(view) {
  if (!medal.visible) return;
  const sx = (medal.x - view.x) * tilePx;
  const sy = (medal.y - view.y) * tilePx;
  if (sx < -tilePx || sy < -tilePx || sx > canvas.width || sy > canvas.height) return;

  const glow = 0.5 + 0.5 * Math.sin(perfNow / 180);
  ctx.save();
  ctx.translate(sx + tilePx / 2, sy + tilePx / 2);
  // brillo de fondo
  ctx.fillStyle = `rgba(255,223,0,${0.16 + glow * 0.22})`;
  ctx.beginPath();
  ctx.ellipse(0, 6, tilePx * 1.2, tilePx * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  // copa animada (2 frames)
  const a = renderAssets.trophy?.a;
  const b = renderAssets.trophy?.b;
  const img = (Math.floor(perfNow / 220) % 2 === 0 ? a : b) || a || b;
  if (img) {
    ctx.imageSmoothingEnabled = false;
    // tamaño: ~2.4 tiles de alto para que sea “final boss”
    const dh = tilePx * 2.4;
    const dw = (img.width / img.height) * dh;
    ctx.drawImage(img, -dw / 2, -dh + tilePx * 0.25, dw, dh);
    // destello extra
    if (Math.sin(perfNow / 160) > 0.65) {
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = "rgba(255,255,255,.95)";
      ctx.fillRect(-dw * 0.15, -dh * 0.70, tilePx * 0.18, tilePx * 0.18);
      ctx.globalAlpha = 1;
    }
  } else {
    // fallback (si no cargan las imágenes)
    const s = tilePx / BASE_TILE;
    ctx.scale(s, s);
    ctx.fillStyle = "#ffdf00";
    ctx.fillRect(-14, -14, 28, 28);
    ctx.fillStyle = "#11131a";
    ctx.fillRect(-2, -12, 4, 24);
    ctx.fillRect(-12, -2, 24, 4);
  }
  ctx.restore();
}

function drawPlayer(view) {
  const sx = (player.x - view.x) * tilePx;
  const sy = (player.y - view.y) * tilePx;

  const moving = Boolean(player.target) || input.up || input.down || input.left || input.right;
  // Frames por dirección: izquierda (0,1,2) y derecha (0,1,2,3)
  const t = Math.floor(perfNow / 120);
  // Orden pedido: base -> (2) -> (1) -> (2) ...
  // left: left, left 2, left 1, left 2...
  // right: right, right 2, right 1, right 2...
  const leftSeq = [0, 2, 1, 2];
  const rightSeq = [0, 2, 1, 2];
  const frame =
    !moving
      ? 0
      : player.dir === "left"
        ? leftSeq[t % leftSeq.length]
        : player.dir === "right"
          ? rightSeq[t % rightSeq.length]
          : (t % 4);
  const bob = frame % 2 === 0 ? 0 : Math.max(1, Math.floor(tilePx * 0.06));

  ctx.save();
  // Avatar grande (Habbo vibes): 15–20% del alto de pantalla
  const desiredH = Math.floor(canvas.height * 0.18);
  const desiredW = Math.floor(desiredH * 0.66);
  ctx.translate(Math.floor(sx - desiredW * 0.35), Math.floor(sy - desiredH * 0.72 + bob));

  // shadow
  ctx.fillStyle = "rgba(0,0,0,.22)";
  ctx.beginPath();
  ctx.ellipse(desiredW * 0.52, desiredH * 0.92, desiredW * 0.22, desiredH * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();

  const hasWalkLayers = Boolean(renderAssets.pokelove.layers?.walkDown0);
  if (hasWalkLayers) {
    const walkCol = frame % 4;
    const dir = player.dir;
    const walk = getWalkLayer(dir, walkCol);
    if (!walk) {
      ctx.restore();
      return;
    }
    const drawH = desiredH * 0.98;
    const drawW = (walk.width / walk.height) * drawH;
    const ox = Math.floor((desiredW - drawW) / 2);
    const oy = Math.floor(desiredH - drawH);
    // Base completa de caminata
    drawImageLayer(ctx, walk, ox, oy, drawW, drawH, skinMultiply());
  } else if (trainerSprite.ready && trainerSprite.img) {
    // fallback antiguo
    const row = dirToRow(player.dir);
    const sw = trainerSprite.frameW;
    const sh = trainerSprite.frameH;
    const col2 = trainerSprite.cols === 9 ? [1, 3, 5, 7][frame] : frame;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(trainerSprite.img, col2 * sw, row * sh, sw, sh, 0, 0, desiredW, desiredH);
  }

  ctx.restore();
}

function drawWorld() {
  const view = getView();
  // “shake” de cámara (entrada a evento)
  let ox = 0;
  let oy = 0;
  if (fx.shakeT > 0) {
    const p = fx.shakeT;
    const a = fx.shakeAmp * p;
    ox = Math.round(Math.sin(perfNow / 18) * a);
    oy = Math.round(Math.cos(perfNow / 22) * a);
  }

  // Todo se pinta en el MISMO espacio (con shake) para evitar “barras” que parecen moverse.
  ctx.save();
  ctx.translate(ox, oy);
  ctx.fillStyle = "#3f9145";
  ctx.fillRect(-tilePx * 4, -tilePx * 4, canvas.width + tilePx * 8, canvas.height + tilePx * 8);

  // Dibuja SIEMPRE suficientes tiles para cubrir el canvas (evita “corte” por clamp de view.w/h)
  const cols = Math.ceil(canvas.width / tilePx) + 3;
  const rows = Math.ceil(canvas.height / tilePx) + 3;
  const baseTx = Math.floor(view.x) - 1;
  const baseTy = Math.floor(view.y) - 1;

  const tileAt = (tx, ty) => {
    if (tx < 0 || ty < 0 || tx >= WORLD_W || ty >= WORLD_H) return 0; // fuera: césped (sin árboles raros)
    return world.tiles[idx(tx, ty)];
  };

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const tx = baseTx + x;
      const ty = baseTy + y;
      const t = tileAt(tx, ty);
      drawTile(t, tx, ty, (x - 1) * tilePx, (y - 1) * tilePx);
    }
  }

  // Orden de dibujo por “profundidad” (y): props/animales/objetos/jugador
  const drawables = [];
  props.forEach((p) => {
    // capa ground se dibuja temprano, tall se ordena con y para overlap
    drawables.push({ y: p.y + (p.layer === "tall" ? 1.6 : 0), draw: () => drawProp(p, view) });
  });
  // critters desactivados (array vacío)
  // Orden por “contacto con el suelo” (sombra) para que el jugador pueda pasar por delante
  floatingMons.forEach((m) => drawables.push({ y: m.y + 0.28, draw: () => drawFloatingMon(m, view) }));
  items.forEach((it) => drawables.push({ y: it.y + 0.9, draw: () => drawItem(it, view) }));
  drawables.push({ y: medal.y + 1.0, draw: () => drawMedal(view) });
  drawables.push({ y: player.y + 1.2, draw: () => drawPlayer(view) });

  drawables.sort((a, b) => a.y - b.y);
  drawables.forEach((d) => d.draw());
  ctx.restore();
}

function drawSpeechBubble(ctx2d, x, y, text, maxW) {
  ctx2d.save();
  ctx2d.imageSmoothingEnabled = false;
  const fontFamily = (getComputedStyle(document.documentElement).getPropertyValue("--font") || "monospace").trim() || "monospace";
  // MUY grande para móvil
  const fs = clamp(Math.round(tilePx * 0.62), 16, 26);
  ctx2d.font = `${fs}px ${fontFamily}`;
  ctx2d.textBaseline = "top";

  const pad = clamp(Math.round(tilePx * 0.26), 8, 14);

  // wrap simple por palabras para que sea legible
  const words = String(text).split(/\s+/g);
  const lines = [];
  let line = "";
  words.forEach((wrd) => {
    const next = line ? `${line} ${wrd}` : wrd;
    if (ctx2d.measureText(next).width <= maxW || !line) line = next;
    else {
      lines.push(line);
      line = wrd;
    }
  });
  if (line) lines.push(line);
  const maxLineW = Math.min(
    maxW,
    Math.max(1, ...lines.map((ln) => Math.ceil(ctx2d.measureText(ln).width)))
  );

  const w = maxLineW + pad * 2;
  const h = pad * 2 + lines.length * (fs + 5);
  const bx = Math.floor(x - w / 2);
  const by = Math.floor(y - h);

  ctx2d.fillStyle = "rgba(255,255,255,.92)";
  ctx2d.fillRect(bx, by, w, h);
  ctx2d.fillStyle = "rgba(0,0,0,.85)";
  ctx2d.fillRect(bx, by, w, 2);
  ctx2d.fillRect(bx, by + h - 2, w, 2);
  ctx2d.fillRect(bx, by, 2, h);
  ctx2d.fillRect(bx + w - 2, by, 2, h);

  ctx2d.fillStyle = "rgba(0,0,0,.92)";
  lines.forEach((ln, i) => {
    ctx2d.fillText(ln, bx + pad, by + pad + i * (fs + 5));
  });
  ctx2d.restore();
}

function drawFloatingMon(m, view) {
  const img = renderAssets.mons?.[m.key];
  if (!img) return;
  const px = (m.x - view.x) * tilePx;
  const py = (m.y - view.y) * tilePx;
  if (px < -tilePx * 10 || py < -tilePx * 10 || px > canvas.width + tilePx * 10 || py > canvas.height + tilePx * 10) return;

  const bob = Math.sin(perfNow / 360 + m.t0) * (tilePx * 0.18);
  const targetH = tilePx * 2.8;
  const scale = Math.min(targetH / img.height, (tilePx * 3.6) / img.width);
  const dw = img.width * scale;
  const dh = img.height * scale;
  const ox = Math.floor(px - dw / 2);
  const oy = Math.floor(py - dh + bob);

  // sombra
  ctx.fillStyle = "rgba(0,0,0,.18)";
  ctx.beginPath();
  ctx.ellipse(px, py + tilePx * 0.25, dw * 0.28, tilePx * 0.10, 0, 0, Math.PI * 2);
  ctx.fill();

  drawImageLayer(ctx, img, ox, oy, dw, dh);

  // burbuja graciosa (si cabe)
  const bubbleY = oy - tilePx * 0.25;
  if (bubbleY > -10) drawSpeechBubble(ctx, px, bubbleY, m.thought, tilePx * 8);
}

function placeItemsOnPath() {
  // Place each item on a path tile close to the center for its row.
  const targetYs = items.map((it) => it.y);
  targetYs.forEach((y, i) => {
    let bestX = null;
    let bestScore = Infinity;
    for (let x = 2; x < WORLD_W - 2; x++) {
      if (world.tiles[idx(x, y)] !== 1) continue;
      const score = Math.abs(x - Math.floor(WORLD_W / 2));
      if (score < bestScore) {
        bestScore = score;
        bestX = x;
      }
    }
    if (bestX != null && !isSolidAt(bestX, y)) {
      items[i].x = bestX;
      items[i].y = y;
    }
  });
}

function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function canInteractWithItem(it) {
  if (it.taken) return false;
  const req = nextRequiredIndex();
  if (req === -1) return false;
  if (it.n - 1 !== req) return false;
  const p = { x: player.x, y: player.y };
  const o = { x: it.x + 0.5, y: it.y + 0.5 };
  return dist2(p, o) < 1.4 * 1.4;
}

function canInteractWithMedal() {
  if (!medal.visible) return false;
  const p = { x: player.x, y: player.y };
  const m = { x: medal.x + 0.5, y: medal.y + 0.5 };
  return dist2(p, m) < 1.6 * 1.6;
}

function startEventForIndex(i) {
  state.canMove = false;
  state.activeEventIndex = i;
  fx.shakeT = 1;
  fx.shakeAmp = Math.max(2, Math.floor(tilePx * 0.18));
  flashTransition();
  window.setTimeout(() => {
    const mem = memories[i];
    ui.eventLabel.textContent = mem.label;
    ui.eventImg.src =
      mem.photoUrl && mem.photoUrl !== "Pon aquí la URL de tu foto"
        ? mem.photoUrl
        : "data:image/svg+xml;charset=utf-8," +
          encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600">
              <rect width="100%" height="100%" fill="#15182a"/>
              <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle"
                font-family="monospace" font-size="28" fill="#cfe1ff">Pon aquí la URL de tu foto</text>
              <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle"
                font-family="monospace" font-size="18" fill="#9fb3d6">Tip: usa una URL HTTPS pública</text>
            </svg>`
          );
    setScreen("event");
    typeText(mem.text);
    playSfxConfirm();
  }, 220);
}

let typer = { running: false, full: "", i: 0, t: 0 };
function typeText(text) {
  typer = { running: true, full: text, i: 0, t: 0 };
  ui.eventText.textContent = "";
  ui.btnRegister.disabled = true;
  ui.nextArrow?.classList?.remove("poke-dialog__next--on");
}
function skipType() {
  if (!typer.running) return;
  typer.running = false;
  ui.eventText.textContent = typer.full;
  ui.btnRegister.disabled = false;
  ui.nextArrow?.classList?.add("poke-dialog__next--on");
}

function registerMoment() {
  const i = state.activeEventIndex;
  if (state.collected[i]) return;
  state.collected[i] = true;
  saveState();
  syncItemsFromProgress();
  updateHud();
  playSfxItemGet();

  const msg = `¡El recuerdo del Año ${i + 1} ha sido registrado en tu corazón!`;
  typeText(msg);
  skipType();

  window.setTimeout(() => {
    flashTransition();
    window.setTimeout(() => {
      setScreen("route");
      state.canMove = true;
      if (collectedCount() === 5) {
        showToast("¡La Medalla legendaria te espera al final del camino!", 1600);
        state.autoWalkToMedal = true;
      } else {
        showToast(`Camino desbloqueado hacia el objeto ${i + 2}.`, 1400);
      }
    }, 220);
  }, 700);
}

function updateHud() {
  ui.hudProgress.textContent = `Recuerdos: ${collectedCount()}/5`;
}

// --- Input
const input = {
  up: false,
  down: false,
  left: false,
  right: false,
};

function setDir(dir, on) {
  input.up = dir === "up" ? on : input.up && dir !== "up";
  input.down = dir === "down" ? on : input.down && dir !== "down";
  input.left = dir === "left" ? on : input.left && dir !== "left";
  input.right = dir === "right" ? on : input.right && dir !== "right";
}

function clearDir(dir) {
  input[dir] = false;
}

function handleDpadPress(dir) {
  player.target = null;
  input[dir] = true;
  player.dir = dir;
}

function handleDpadRelease(dir) {
  input[dir] = false;
}

function interact() {
  if (state.screen !== "route") return;
  if (!state.canMove) return;

  if (canInteractWithMedal()) {
    openFinale();
    return;
  }

  const req = nextRequiredIndex();
  if (req === -1) return;
  const it = items[req];
  if (canInteractWithItem(it)) {
    startEventForIndex(req);
  } else {
    if (req >= 0) showToast(`Busca el objeto ${req + 1} en la ruta.`, 900);
  }
}

function openMenu() {
  ui.menu.classList.add("menu--open");
  ui.menu.setAttribute("aria-hidden", "false");
  state.canMove = false;
}
function closeMenu() {
  ui.menu.classList.remove("menu--open");
  ui.menu.setAttribute("aria-hidden", "true");
  state.canMove = true;
}

function resetAll() {
  state.collected = [false, false, false, false, false];
  saveState();
  syncItemsFromProgress();
  updateHud();
  state.finaleUnlocked = false;
  state.autoWalkToMedal = false;
  player.x = WORLD_W / 2;
  player.y = WORLD_H - 8;
  player.target = null;
  setScreen("route");
  state.canMove = true;
  playSfxConfirm();
  stopVictory();
  playBgm("route");
  showToast("Progreso reiniciado.", 1100);
}

// --- Finale (confetti)
const cctx = ui.confettiCanvas.getContext("2d");
let confetti = [];
function seedConfetti() {
  confetti = [];
  const colors = ["#ffdf00", "#4caf50", "#1e88e5", "#e53935", "#ffffff"];
  for (let i = 0; i < 220; i++) {
    confetti.push({
      x: Math.random() * ui.confettiCanvas.width,
      y: Math.random() * ui.confettiCanvas.height,
      vx: (Math.random() - 0.5) * 40,
      vy: 30 + Math.random() * 70,
      w: 4 + Math.floor(Math.random() * 8),
      h: 3 + Math.floor(Math.random() * 7),
      c: colors[i % colors.length],
      t: Math.random() * Math.PI * 2,
      a: 0.75 + Math.random() * 0.25,
    });
  }
}
function drawConfetti(dt) {
  // confeti infinito: añade piezas nuevas a ritmo constante
  const colors = ["#ffdf00", "#4caf50", "#1e88e5", "#e53935", "#ffffff"];
  const spawn = Math.floor(28 * dt);
  for (let i = 0; i < spawn; i++) {
    confetti.push({
      x: Math.random() * ui.confettiCanvas.width,
      y: -12 - Math.random() * 40,
      vx: (Math.random() - 0.5) * 55,
      vy: 40 + Math.random() * 90,
      w: 4 + Math.floor(Math.random() * 10),
      h: 3 + Math.floor(Math.random() * 9),
      c: colors[Math.floor(Math.random() * colors.length)],
      t: Math.random() * Math.PI * 2,
      a: 0.75 + Math.random() * 0.25,
    });
  }
  // recorta para no crecer infinito
  if (confetti.length > 520) confetti.splice(0, confetti.length - 520);

  cctx.clearRect(0, 0, ui.confettiCanvas.width, ui.confettiCanvas.height);
  confetti.forEach((p) => {
    p.t += dt * 6;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.y > ui.confettiCanvas.height + 12) {
      p.y = -12;
      p.x = Math.random() * ui.confettiCanvas.width;
    }
    if (p.x < -20) p.x = ui.confettiCanvas.width + 20;
    if (p.x > ui.confettiCanvas.width + 20) p.x = -20;
    cctx.globalAlpha = p.a;
    cctx.fillStyle = p.c;
    const wob = Math.sin(p.t);
    const ww = p.w + Math.round(Math.abs(wob) * 2);
    const hh = p.h;
    cctx.fillRect(Math.floor(p.x), Math.floor(p.y), ww, hh);
    // “destello” pequeño para que se note más
    if (wob > 0.85) {
      cctx.fillStyle = "rgba(255,255,255,.95)";
      cctx.fillRect(Math.floor(p.x + ww * 0.2), Math.floor(p.y - 2), 2, 2);
    }
  });
  cctx.globalAlpha = 1;
}

function drawFinaleAvatar(dt) {
  if (!ui.finaleAvatarCanvas) return;
  const canvas2 = ui.finaleAvatarCanvas;
  const ctx2d = canvas2.getContext("2d", { alpha: true });
  ctx2d.imageSmoothingEnabled = false;
  const w = canvas2.width;
  const h = canvas2.height;
  ctx2d.clearRect(0, 0, w, h);

  // fondo suave
  ctx2d.fillStyle = "rgba(255,255,255,.06)";
  ctx2d.fillRect(0, 0, w, h);
  ctx2d.fillStyle = "rgba(0,0,0,.18)";
  ctx2d.fillRect(0, h * 0.70, w, h * 0.30);

  const layers = renderAssets.pokelove.layers || {};
  const img = layers.body || layers.walkDown0 || null;
  if (!img) return;

  const scale = Math.min((w * 0.55) / img.width, (h * 0.82) / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  const ox = Math.floor(w / 2 - dw / 2);
  const oy = Math.floor(h * 0.86 - dh);

  // sombra
  ctx2d.fillStyle = "rgba(0,0,0,.22)";
  ctx2d.beginPath();
  ctx2d.ellipse(w / 2, oy + dh + 10, dw * 0.22, dh * 0.06, 0, 0, Math.PI * 2);
  ctx2d.fill();

  // avatar
  drawImageLayer(ctx2d, img, ox, oy, dw, dh);

  // brillo en la mano (aprox)
  const pulse = 0.55 + 0.45 * Math.sin(perfNow / 160);
  const gx = ox + dw * 0.76;
  const gy = oy + dh * 0.70;
  const r1 = dw * (0.045 + pulse * 0.045);
  const grad = ctx2d.createRadialGradient(gx, gy, 0, gx, gy, r1);
  grad.addColorStop(0, `rgba(255,223,0,${0.95})`);
  grad.addColorStop(0.5, `rgba(255,255,255,${0.55 * pulse})`);
  grad.addColorStop(1, "rgba(255,223,0,0)");
  ctx2d.fillStyle = grad;
  ctx2d.beginPath();
  ctx2d.arc(gx, gy, r1, 0, Math.PI * 2);
  ctx2d.fill();

  // chispas “pixel” alrededor de la mano
  ctx2d.fillStyle = `rgba(255,255,255,${0.7 * pulse})`;
  const s = Math.max(1, Math.floor(dw * 0.012));
  ctx2d.fillRect(Math.floor(gx - s * 3), Math.floor(gy - s * 0.5), s, s);
  ctx2d.fillRect(Math.floor(gx + s * 2), Math.floor(gy - s * 2.2), s, s);
  ctx2d.fillRect(Math.floor(gx + s * 0.6), Math.floor(gy + s * 2.0), s, s);
}

async function openFinale() {
  if (!state.finaleUnlocked) return;
  flashTransition();
  window.setTimeout(async () => {
    setScreen("finale");
    resizeConfettiToViewport();
    resizeFinaleAvatarCanvas();
    seedConfetti();
    await playBgm("victory");
    playSfxItemGet();
  }, 220);
}

function stopVictory() {
  try {
    ui.victoryBgm.pause();
    ui.victoryBgm.currentTime = 0;
  } catch {
    // ignore
  }
}

// --- Loop
let last = performance.now();
let perfNow = performance.now();
function loop(now) {
  perfNow = now;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  // Live preview en el probador (pantalla inicial)
  if (state.screen === "title") {
    drawPreview(dt);
  }

  if (state.screen === "route") {
    // critters desactivados: solo Pokémon flotantes
    // cámara suave: sigue al jugador con “lerp”
    const viewTilesWide = clamp(Math.floor(canvas.width / tilePx), 10, WORLD_W);
    const viewTilesHigh = clamp(Math.floor(canvas.height / tilePx), 12, WORLD_H);
    const targetX = clamp(player.x - viewTilesWide / 2, 0, WORLD_W - viewTilesWide);
    const targetY = clamp(player.y - viewTilesHigh / 2, 0, WORLD_H - viewTilesHigh);
    const camSmooth = 1 - Math.pow(0.001, dt); // independiente de FPS
    camera.x = lerp(camera.x, targetX, camSmooth);
    camera.y = lerp(camera.y, targetY, camSmooth);

    if (fx.shakeT > 0) fx.shakeT = Math.max(0, fx.shakeT - dt * 6.5);

    const movingByDpad = input.up || input.down || input.left || input.right;
    if (state.canMove) {
      if (state.autoWalkToMedal && medal.visible) {
        // auto walk to medal
        const dx = medal.x + 0.5 - player.x;
        const dy = medal.y + 0.5 - player.y;
        const ax = Math.abs(dx);
        const ay = Math.abs(dy);
        if (ax < 0.25 && ay < 0.25) {
          state.autoWalkToMedal = false;
          showToast("Toca la Medalla o pulsa A.", 1400);
        } else {
          const mx = dx === 0 ? 0 : dx / (ax + ay);
          const my = dy === 0 ? 0 : dy / (ax + ay);
          if (Math.abs(mx) > Math.abs(my)) player.dir = mx < 0 ? "left" : "right";
          else player.dir = my < 0 ? "up" : "down";
          tryMove(mx, my, dt);
        }
      } else if (player.target && !movingByDpad) {
        const dx = player.target.x - player.x;
        const dy = player.target.y - player.y;
        const d = Math.hypot(dx, dy);
        if (d < 0.12) {
          player.target = null;
        } else {
          const mx = dx / d;
          const my = dy / d;
          if (Math.abs(mx) > Math.abs(my)) player.dir = mx < 0 ? "left" : "right";
          else player.dir = my < 0 ? "up" : "down";
          tryMove(mx, my, dt);
        }
      } else if (movingByDpad) {
        let dx = 0;
        let dy = 0;
        if (input.up) dy -= 1;
        if (input.down) dy += 1;
        if (input.left) dx -= 1;
        if (input.right) dx += 1;
        const d = Math.hypot(dx, dy) || 1;
        tryMove(dx / d, dy / d, dt);
      }
    }

    drawWorld();

    // hint if near required item
    const req = nextRequiredIndex();
    if (req >= 0) {
      const it = items[req];
      if (canInteractWithItem(it)) {
        showToast(`Objeto ${it.n} listo. Pulsa A para recoger.`, 700);
      }
    }
  } else if (state.screen === "event") {
    drawPortrait();
    // typewriter
    if (typer.running) {
      typer.t += dt;
      const cps = 32; // chars per second
      const nextI = Math.min(typer.full.length, Math.floor(typer.t * cps));
      if (nextI !== typer.i) {
        typer.i = nextI;
        ui.eventText.textContent = typer.full.slice(0, typer.i);
      }
      if (typer.i >= typer.full.length) {
        typer.running = false;
        ui.btnRegister.disabled = false;
        ui.nextArrow?.classList?.add("poke-dialog__next--on");
      }
    }
  } else if (state.screen === "finale") {
    drawConfetti(dt);
    drawFinaleAvatar(dt);
  }

  requestAnimationFrame(loop);
}

// --- Wiring
async function init() {
  loadState();
  maybeLoadTrainerSprite();
  loadRenderAssets();
  loadMonAssets();
  await loadAvatarLayerAssets();
  loadCuteAssets();
  generateWorld();
  placeItemsOnPath();
  spawnCuteProps();
  syncItemsFromProgress();
  updateHud();

  syncSoundButtons();
  syncMusicButtons();

  resizeCanvas();
  resizePreviewCanvas();
  resizeFinaleAvatarCanvas();
  // Fuerza un primer render del probador
  window.setTimeout(() => drawPreview(0), 0);
  // Inicializa cámara centrada en el jugador
  const view = getView();
  camera.x = clamp(player.x - view.w / 2, 0, WORLD_W - view.w);
  camera.y = clamp(player.y - view.h / 2, 0, WORLD_H - view.h);
  window.addEventListener("resize", () => {
    resizeCanvas();
    resizePreviewCanvas();
    resizeFinaleAvatarCanvas();
    if (state.screen === "finale") resizeConfettiToViewport();
  });

  // Start / Title
  ui.btnStart.addEventListener("click", async () => {
    setScreen("route");
    state.canMove = true;
    playSfxConfirm();
    await playBgm("route");
  });

  // Fallback: repinta el probador aunque el loop se corte
  window.setInterval(() => {
    if (state.screen === "title") drawPreview(1 / 30);
  }, 1000 / 30);

  const toggleSound = () => {
    state.soundEnabled = !state.soundEnabled;
    syncSoundButtons();
    playSfxConfirm();
  };
  const toggleMusic = async () => {
    state.musicEnabled = !state.musicEnabled;
    syncMusicButtons();
    playSfxConfirm();
    if (state.musicEnabled) {
      await playBgm(state.screen === "finale" ? "victory" : "route");
    } else {
      stopBgm();
    }
  };

  ui.btnSound.addEventListener("click", toggleSound);
  ui.btnToggleSound2.addEventListener("click", toggleSound);
  ui.btnMusic.addEventListener("click", toggleMusic);
  ui.btnToggleMusic2.addEventListener("click", toggleMusic);

  ui.btnPause.addEventListener("click", () => {
    openMenu();
    playSfxConfirm();
  });
  ui.btnResume.addEventListener("click", () => {
    closeMenu();
    playSfxConfirm();
  });

  ui.btnReset.addEventListener("click", resetAll);
  ui.btnReset2.addEventListener("click", resetAll);

  ui.btnA.addEventListener("click", () => {
    playSfxConfirm();
    interact();
  });

  ui.btnSkip.addEventListener("click", () => {
    playSfxConfirm();
    skipType();
  });
  ui.btnRegister.addEventListener("click", () => {
    playSfxConfirm();
    registerMoment();
  });

  ui.btnBackToRoute.addEventListener("click", async () => {
    playSfxConfirm();
    setScreen("route");
    state.canMove = true;
    stopVictory();
    await playBgm("route");
  });

  // Tap-to-move on canvas + touch item to interact
  const onCanvasTap = (e) => {
    if (state.screen !== "route") return;
    if (!state.canMove) return;
    const p = e.changedTouches ? e.changedTouches[0] : e;
    setPlayerTargetFromTap(p.clientX, p.clientY);
  };
  ui.routeCanvas.addEventListener("pointerdown", onCanvasTap);
  ui.routeCanvas.addEventListener("touchstart", onCanvasTap, { passive: true });

  // D-pad supports hold
  const bindHold = (btn) => {
    const dir = btn.dataset.dir;
    const down = (e) => {
      e.preventDefault();
      if (state.screen !== "route") return;
      if (!state.canMove) return;
      handleDpadPress(dir);
    };
    const up = (e) => {
      e.preventDefault();
      handleDpadRelease(dir);
    };
    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointercancel", up);
    btn.addEventListener("pointerleave", up);
  };
  ui.dpad.querySelectorAll(".dpad__btn").forEach(bindHold);

  // Unlock audio on first gesture (mobile)
  const unlock = async () => {
    if (state.soundEnabled) ensureAudio();
    if (state.musicEnabled) await playBgm(state.screen === "finale" ? "victory" : "route");
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("touchstart", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("touchstart", unlock, { once: true });

  // Keyboard fallback (desktop)
  window.addEventListener("keydown", (e) => {
    if (state.screen !== "route") return;
    if (!state.canMove) return;
    if (e.key === "ArrowUp") input.up = true;
    if (e.key === "ArrowDown") input.down = true;
    if (e.key === "ArrowLeft") input.left = true;
    if (e.key === "ArrowRight") input.right = true;
    if (e.key.toLowerCase() === "a" || e.key === "Enter") interact();
    if (e.key === "Escape") openMenu();
  });
  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowUp") input.up = false;
    if (e.key === "ArrowDown") input.down = false;
    if (e.key === "ArrowLeft") input.left = false;
    if (e.key === "ArrowRight") input.right = false;
  });

  requestAnimationFrame(loop);
}

init().catch(() => {
  // noop
});
