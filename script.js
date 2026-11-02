const HOLD_MS = 3000;
const LIFT_GRACE_MS = 400;
const FIREWORKS_MS = 20000;
const FIREWORK_COLORS = ['#ffd166', '#ff6b6b', '#5dffb4', '#39e6ff', '#ff8ad8', '#ffffff'];
// Salyut HUD birliklarida hisoblanadi: har qanday ekranda bir xil ko'rinadi
const ROCKET_GRAVITY = 900;
const SPARK_GRAVITY = 170;
const SPARK_DRAG = 2.2;
const FLASH_SECONDS = 0.2;
const FLASH_RADIUS = 100;
const TRAIL_POINTS = 14;
const HEAD_POINTS = 4;

const startButton = document.getElementById('start-button');
const emblem = document.getElementById('emblem');
const fireworks = document.getElementById('fireworks');
const fireworksContext = fireworks.getContext('2d');
const contacts = new Set();

let finished = false;
let holdTimer = null;
let liftTimer = null;
let rockets = [];
let sparks = [];
let flashes = [];
let fieldWidth = 0;
let fieldHeight = 0;
let launchSide = 1;
let launchEndsAt = 0;
let nextLaunchIn = 0;
let lastFrameAt = 0;

document.documentElement.style.setProperty('--hold', `${HOLD_MS}ms`);

// F11 rejimi ham to'liq ekran hisoblanadi, u document.fullscreenElement'da ko'rinmaydi
function isFullscreen() {
  return document.fullscreenElement !== null || Math.abs(window.innerHeight - screen.height) <= 1;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function randomColor() {
  return FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
}

function resizeFireworks() {
  const scale = Math.min(window.innerWidth / 1600, window.innerHeight / 900);
  const pixelScale = scale * window.devicePixelRatio;
  fieldWidth = window.innerWidth / scale;
  fieldHeight = window.innerHeight / scale;
  fireworks.width = window.innerWidth * window.devicePixelRatio;
  fireworks.height = window.innerHeight * window.devicePixelRatio;
  // Canvas o'lchami o'zgarganda kontekst sozlamalari tozalanadi
  fireworksContext.setTransform(pixelScale, 0, 0, pixelScale, 0, 0);
  fireworksContext.lineCap = 'round';
  fireworksContext.globalCompositeOperation = 'lighter';
}

// Raketalar navbat bilan chap va o'ng tomonga otiladi: portlashlar o'rtadagi matnni to'sib qo'ymaydi.
// O'rtaga faqat matndan yuqoriga otiladi
function launchRocket() {
  launchSide = -launchSide;
  const isTop = Math.random() < 0.25;
  const targetX = fieldWidth * (isTop ? randomBetween(0.38, 0.62) : 0.5 + launchSide * randomBetween(0.18, 0.36));
  const targetY = fieldHeight * (isTop ? randomBetween(0.08, 0.16) : randomBetween(0.14, 0.55));
  const x = targetX + randomBetween(-80, 80);
  const vy = -Math.sqrt(2 * ROCKET_GRAVITY * (fieldHeight - targetY));
  const flightSeconds = -vy / ROCKET_GRAVITY;
  rockets.push({ x, y: fieldHeight, vx: (targetX - x) / flightSeconds, vy, color: randomColor(), trail: [] });
}

function explodeRocket(rocket) {
  const isRing = Math.random() < 0.3;
  const count = isRing ? 70 : 140;
  const speed = randomBetween(420, 620);
  const accent = randomColor();
  flashes.push({ x: rocket.x, y: rocket.y, life: FLASH_SECONDS });
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const force = speed * (isRing ? randomBetween(0.92, 1) : randomBetween(0.5, 1));
    const life = randomBetween(1.1, 1.9);
    sparks.push({
      x: rocket.x,
      y: rocket.y,
      vx: Math.cos(angle) * force,
      vy: Math.sin(angle) * force,
      life,
      maxLife: life,
      color: i % 3 === 0 ? accent : rocket.color,
      trail: [],
    });
  }
}

function moveAlongTrail(item, seconds) {
  item.x += item.vx * seconds;
  item.y += item.vy * seconds;
  item.trail.push({ x: item.x, y: item.y });
  if (item.trail.length > TRAIL_POINTS) {
    item.trail.shift();
  }
}

function strokePoints(points, width, alpha) {
  fireworksContext.globalAlpha = alpha;
  fireworksContext.lineWidth = width;
  fireworksContext.beginPath();
  points.forEach((point) => fireworksContext.lineTo(point.x, point.y));
  fireworksContext.stroke();
}

// Har bir bo'lakni alohida xiralashtirish og'ir: uzun xira dum, ustida nurli qisqa bosh chiziladi
function drawTrail(item, width, alpha) {
  const head = item.trail.slice(-HEAD_POINTS);
  fireworksContext.strokeStyle = item.color;
  strokePoints(item.trail, width, alpha * 0.35);
  strokePoints(head, width * 3.5, alpha * 0.2);
  strokePoints(head, width * 1.2, alpha);
}

function drawFlash(flash) {
  const glow = fireworksContext.createRadialGradient(flash.x, flash.y, 0, flash.x, flash.y, FLASH_RADIUS);
  glow.addColorStop(0, 'rgb(255 255 255 / 90%)');
  glow.addColorStop(1, 'rgb(255 255 255 / 0%)');
  fireworksContext.globalAlpha = flash.life / FLASH_SECONDS;
  fireworksContext.fillStyle = glow;
  fireworksContext.beginPath();
  fireworksContext.arc(flash.x, flash.y, FLASH_RADIUS, 0, Math.PI * 2);
  fireworksContext.fill();
}

function drawFireworks(now) {
  const seconds = Math.min((now - lastFrameAt) / 1000, 0.05);
  lastFrameAt = now;

  nextLaunchIn -= seconds;
  if (now < launchEndsAt && nextLaunchIn <= 0) {
    launchRocket();
    nextLaunchIn = randomBetween(0.3, 0.7);
  }

  fireworksContext.clearRect(0, 0, fieldWidth, fieldHeight);

  rockets = rockets.filter((rocket) => {
    rocket.vy += ROCKET_GRAVITY * seconds;
    moveAlongTrail(rocket, seconds);
    if (rocket.vy >= 0) {
      explodeRocket(rocket);
      return false;
    }
    drawTrail(rocket, 2.5, 1);
    return true;
  });

  flashes = flashes.filter((flash) => {
    flash.life -= seconds;
    if (flash.life <= 0) {
      return false;
    }
    drawFlash(flash);
    return true;
  });

  sparks = sparks.filter((spark) => {
    spark.life -= seconds;
    if (spark.life <= 0) {
      return false;
    }
    spark.vx -= spark.vx * SPARK_DRAG * seconds;
    spark.vy += (SPARK_GRAVITY - spark.vy * SPARK_DRAG) * seconds;
    moveAlongTrail(spark, seconds);
    // Uchqun so'nishdan oldin miltillaydi
    const fade = spark.life / spark.maxLife;
    drawTrail(spark, 2, fade < 0.4 ? (fade / 0.4) * randomBetween(0.4, 1) : 1);
    return true;
  });

  if (now < launchEndsAt || rockets.length > 0 || flashes.length > 0 || sparks.length > 0) {
    requestAnimationFrame(drawFireworks);
  } else {
    window.removeEventListener('resize', resizeFireworks);
  }
}

function startFireworks() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }
  resizeFireworks();
  window.addEventListener('resize', resizeFireworks);
  requestAnimationFrame((now) => {
    lastFrameAt = now;
    launchEndsAt = now + FIREWORKS_MS;
    drawFireworks(now);
  });
}

function finishScan() {
  clearTimeout(liftTimer);
  holdTimer = null;
  finished = true;
  document.body.classList.add('verified');
  startFireworks();
}

function beginScan() {
  clearTimeout(liftTimer);
  if (finished || holdTimer !== null) {
    return;
  }
  document.body.classList.add('scanning');
  holdTimer = setTimeout(finishScan, HOLD_MS);
}

function cancelScan() {
  clearTimeout(holdTimer);
  holdTimer = null;
  document.body.classList.remove('scanning');
}

startButton.addEventListener('pointerdown', (event) => {
  contacts.add(event.pointerId);
  beginScan();
});

// pointercancel ataylab tinglanmaydi: Windows kaftni rad etsa ham tekshiruv davom etadi
document.addEventListener('pointerup', (event) => {
  // Sensor bir lahza uzilsa tekshiruv to'xtab qolmasligi uchun kechiktirib bekor qilinadi
  if (contacts.delete(event.pointerId) && contacts.size === 0 && holdTimer !== null) {
    liftTimer = setTimeout(cancelScan, LIFT_GRACE_MS);
  }
});

// start.ps1 shu sarlavhani kutib, Chrome'ni kiosk rejimida ochadi: yozuvsiz to'liq ekran faqat shu rejimda bo'ladi.
// Sahifa start.bat'siz ochilgan bo'lsa, to'liq ekranga brauzerning o'z yozuvi bilan o'tadi
emblem.addEventListener('click', () => {
  if (location.hash === '#launcher') {
    document.title = 'Start kiosk';
  } else if (!isFullscreen()) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
});

// Sensor ishlamay qolsa, klaviaturadan zaxira: kaftsiz ham tekshiruv effekti boshlanadi
document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    beginScan();
  }
});

document.addEventListener('contextmenu', (event) => event.preventDefault());
