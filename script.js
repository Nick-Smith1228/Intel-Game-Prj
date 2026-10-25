const screens = {
  welcome: document.getElementById("welcomeScreen"),
  levels: document.getElementById("levelScreen"),
  game: document.getElementById("gameScreen"),
  win: document.getElementById("winScreen"),
};

const canvas = document.getElementById("gameCanvas");
const context = canvas.getContext("2d");
const canvasWrap = document.getElementById("canvasWrap");
const timerText = document.getElementById("timerText");
const waterText = document.getElementById("waterText");
const linesText = document.getElementById("linesText");
const gameHint = document.getElementById("gameHint");
const controlHint = document.getElementById("controlHint");
const canvasMessage = document.getElementById("canvasMessage");
const rainButton = document.getElementById("rainButton");
const levelTwoButton = document.getElementById("levelTwoButton");
const levelIntro = document.getElementById("levelIntro");
const levelIntroButton = document.getElementById("levelIntroButton");
const levelHeading = document.querySelector("#levelScreen .section-heading > p");
const gameHeading = document.getElementById("gameHeading");
const gameLevelLabel = document.querySelector(".game-title-group .eyebrow");
const cloudLabel = document.querySelector(".label-cloud");
const canLabel = document.querySelector(".label-can");

const state = {
  selectedLevel: 1,
  levelIntroOpen: false,
  width: 0,
  height: 0,
  strokes: [],
  activeStroke: null,
  drops: [],
  particles: [],
  waterCaught: 0,
  canFill: { left: 0, right: 0 },
  lineCount: 0,
  timeLeft: 15,
  running: false,
  roundEnded: false,
  won: false,
  lastFrame: 0,
  spawnTimer: 0,
  unlockedLevelTwo: localStorage.getItem("rainCatcherLevelTwo") === "true",
  drawing: false,
};

const random = (min, max) => min + Math.random() * (max - min);

function showScreen(name) {
  Object.entries(screens).forEach(([screenName, screen]) => {
    screen.classList.toggle("hidden", screenName !== name);
  });
  if (name === "game") {
    requestAnimationFrame(resizeCanvas);
  }
}

function updateLevelCards() {
  if (!state.unlockedLevelTwo) return;
  levelTwoButton.disabled = false;
  levelTwoButton.classList.remove("level-locked");
  levelTwoButton.classList.add("level-open");
  levelTwoButton.querySelector(".level-card-bottom small").textContent = "Fill both cans. Dodge the lightning.";
  levelTwoButton.querySelector(".lock-icon").textContent = "↗";
  levelTwoButton.querySelector(".lock-icon").setAttribute("aria-label", "Unlocked");
}

function resizeCanvas() {
  if (screens.game.classList.contains("hidden")) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const oldWidth = state.width;
  const oldHeight = state.height;
  const scaleX = oldWidth ? rect.width / oldWidth : 1;
  const scaleY = oldHeight ? rect.height / oldHeight : 1;
  if (oldWidth && oldHeight) {
    state.strokes.forEach((stroke) => {
      stroke.points.forEach((point) => {
        point.x *= scaleX;
        point.y *= scaleY;
      });
    });
    state.drops = [];
  }

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.width = rect.width;
  state.height = rect.height;
  drawScene();
}

function scenePoints() {
  const { width, height } = state;
  const groundY = height * 0.91;
  if (state.selectedLevel === 2) {
    const canHeight = Math.min(height * 0.21, 88);
    return {
      cloudX: width * 0.5,
      cloudY: height * 0.17,
      groundY,
      canTop: groundY - canHeight,
      canWidth: Math.min(width * 0.09, 56),
      canHeight,
      leftCanX: width * 0.11,
      rightCanX: width * 0.89,
    };
  }
  const canHeight = Math.min(height * 0.29, 124);
  return {
    cloudX: width * 0.22,
    cloudY: height * 0.2,
    canX: width * 0.79,
    canTop: groundY - canHeight,
    groundY,
    canWidth: Math.min(width * 0.19, canHeight * 0.76, 104),
  };
}

function drawStormCloud(x, y, scale, color) {
  context.save();
  context.fillStyle = color;
  context.beginPath();
  context.ellipse(x, y + scale * 0.13, scale * 0.72, scale * 0.24, 0, 0, Math.PI * 2);
  context.arc(x - scale * 0.35, y, scale * 0.24, Math.PI, Math.PI * 2);
  context.arc(x - scale * 0.08, y - scale * 0.11, scale * 0.34, Math.PI, Math.PI * 2);
  context.arc(x + scale * 0.25, y - scale * 0.02, scale * 0.27, Math.PI, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawStormySky(width, height) {
  const sky = context.createLinearGradient(0, 0, 0, height * 0.78);
  sky.addColorStop(0, "#71818e");
  sky.addColorStop(0.55, "#96a5ac");
  sky.addColorStop(1, "#c0ccca");
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);

  drawStormCloud(width * 0.12, height * 0.19, Math.min(width * 0.24, 170), "#63737f");
  drawStormCloud(width * 0.53, height * 0.12, Math.min(width * 0.29, 205), "#74838d");
  drawStormCloud(width * 0.94, height * 0.23, Math.min(width * 0.27, 190), "#687984");
  drawStormCloud(width * 0.76, height * 0.39, Math.min(width * 0.2, 135), "rgba(112, 128, 138, 0.72)");
}

function lightningBolts() {
  const { width, height } = state;
  return [
    [
      { x: width * 0.29, y: height * 0.36 },
      { x: width * 0.255, y: height * 0.54 },
      { x: width * 0.295, y: height * 0.54 },
      { x: width * 0.235, y: height * 0.86 },
    ],
    [
      { x: width * 0.71, y: height * 0.36 },
      { x: width * 0.745, y: height * 0.54 },
      { x: width * 0.705, y: height * 0.54 },
      { x: width * 0.765, y: height * 0.86 },
    ],
  ];
}

function drawLightning() {
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "#fff3a6";
  context.lineWidth = 5;
  context.shadowColor = "#ffe36a";
  context.shadowBlur = 16;
  lightningBolts().forEach((bolt) => {
    context.beginPath();
    context.moveTo(bolt[0].x, bolt[0].y);
    bolt.slice(1).forEach((point) => context.lineTo(point.x, point.y));
    context.stroke();
  });
  context.restore();
}

function drawCloud(x, y) {
  context.save();
  context.fillStyle = "#ffffff";
  context.shadowColor = "rgba(53, 112, 106, 0.11)";
  context.shadowBlur = 18;
  context.shadowOffsetY = 5;
  context.beginPath();
  context.arc(x - 28, y + 7, 27, Math.PI * 0.85, Math.PI * 1.97);
  context.arc(x + 1, y - 8, 35, Math.PI, Math.PI * 1.98);
  context.arc(x + 31, y + 8, 24, Math.PI * 1.12, Math.PI * 0.08);
  context.closePath();
  context.fill();
  context.restore();
  context.fillStyle = "rgba(21, 107, 106, 0.22)";
  context.beginPath();
  context.arc(x - 10, y + 5, 1.7, 0, Math.PI * 2);
  context.arc(x + 10, y + 5, 1.7, 0, Math.PI * 2);
  context.fill();
}

function drawTree(x, baseY, size) {
  context.save();
  context.fillStyle = "#8b7655";
  context.fillRect(x - size * 0.055, baseY - size * 0.28, size * 0.11, size * 0.3);
  context.fillStyle = "#4f9272";
  context.beginPath();
  context.moveTo(x, baseY - size);
  context.lineTo(x - size * 0.34, baseY - size * 0.48);
  context.lineTo(x - size * 0.19, baseY - size * 0.48);
  context.lineTo(x - size * 0.43, baseY - size * 0.14);
  context.lineTo(x + size * 0.43, baseY - size * 0.14);
  context.lineTo(x + size * 0.19, baseY - size * 0.48);
  context.lineTo(x + size * 0.34, baseY - size * 0.48);
  context.closePath();
  context.fill();
  context.restore();
}

function drawLandscape(width, height, groundY) {
  context.save();

  context.fillStyle = "#aebfba";
  context.beginPath();
  context.moveTo(0, height * 0.64);
  context.lineTo(width * 0.16, height * 0.34);
  context.lineTo(width * 0.3, height * 0.58);
  context.lineTo(width * 0.48, height * 0.29);
  context.lineTo(width * 0.7, height * 0.61);
  context.lineTo(width * 0.86, height * 0.39);
  context.lineTo(width, height * 0.59);
  context.lineTo(width, groundY + 12);
  context.lineTo(0, groundY + 12);
  context.closePath();
  context.fill();

  context.fillStyle = "#91ab9e";
  context.beginPath();
  context.moveTo(0, height * 0.72);
  context.quadraticCurveTo(width * 0.17, height * 0.55, width * 0.35, height * 0.7);
  context.quadraticCurveTo(width * 0.57, height * 0.53, width * 0.76, height * 0.71);
  context.quadraticCurveTo(width * 0.91, height * 0.59, width, height * 0.7);
  context.lineTo(width, groundY + 10);
  context.lineTo(0, groundY + 10);
  context.closePath();
  context.fill();

  context.fillStyle = "#82bc83";
  context.beginPath();
  context.moveTo(0, groundY - 23);
  context.quadraticCurveTo(width * 0.45, groundY - 38, width, groundY - 20);
  context.lineTo(width, height);
  context.lineTo(0, height);
  context.closePath();
  context.fill();

  const trees = [
    [width * 0.1, groundY - 18, Math.min(height * 0.25, 76)],
    [width * 0.36, groundY - 22, Math.min(height * 0.19, 58)],
    [width * 0.94, groundY - 18, Math.min(height * 0.26, 80)],
  ];
  trees.forEach(([x, baseY, size]) => drawTree(x, baseY, size));

  context.strokeStyle = "rgba(63, 139, 83, 0.45)";
  context.lineWidth = 2;
  context.lineCap = "round";
  for (let index = 0; index < 24; index += 1) {
    const x = (width * index) / 23;
    const y = groundY - 18 + Math.sin(index * 1.8) * 5;
    context.beginPath();
    context.moveTo(x, y + 5);
    context.lineTo(x + Math.sin(index) * 3, y);
    context.stroke();
  }

  context.strokeStyle = "rgba(63, 139, 83, 0.6)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(0, groundY - 23);
  context.quadraticCurveTo(width * 0.45, groundY - 38, width, groundY - 20);
  context.stroke();
  context.restore();
}

function drawCanAt(canX, canTop, groundY, canWidth, caught, capacity) {
  const canHeight = groundY - canTop;
  const left = canX - canWidth / 2;
  const top = canTop;
  const bottom = groundY;
  const fillHeight = canHeight * Math.min(1, caught / capacity);
  const body = new Path2D();

  context.save();
  body.moveTo(left + canWidth * 0.13, top + canHeight * 0.08);
  body.lineTo(left + canWidth * 0.24, top + canHeight * 0.02);
  body.lineTo(left + canWidth * 0.76, top + canHeight * 0.02);
  body.lineTo(left + canWidth * 0.87, top + canHeight * 0.08);
  body.lineTo(left + canWidth * 0.96, top + canHeight * 0.19);
  body.lineTo(left + canWidth * 0.96, bottom - canHeight * 0.07);
  body.quadraticCurveTo(left + canWidth * 0.96, bottom, left + canWidth * 0.86, bottom);
  body.lineTo(left + canWidth * 0.14, bottom);
  body.quadraticCurveTo(left + canWidth * 0.04, bottom, left + canWidth * 0.04, bottom - canHeight * 0.07);
  body.lineTo(left + canWidth * 0.04, top + canHeight * 0.19);
  body.closePath();
  context.fillStyle = "#f2d20d";
  context.fill(body);

  if (fillHeight > 0) {
    context.save();
    context.clip(body);
    context.fillStyle = "rgba(34, 177, 177, 0.72)";
    context.fillRect(left, bottom - fillHeight, canWidth, fillHeight);
    context.restore();
  }

  context.globalCompositeOperation = "destination-out";
  context.fillStyle = "#000";
  context.beginPath();
  context.roundRect(left + canWidth * 0.36, top + canHeight * 0.1, canWidth * 0.28, canHeight * 0.065, canWidth * 0.04);
  context.fill();
  context.beginPath();
  context.lineCap = "round";
  context.lineWidth = Math.max(3, canWidth * 0.075);
  context.moveTo(left + canWidth * 0.19, top + canHeight * 0.32);
  context.lineTo(left + canWidth * 0.37, top + canHeight * 0.49);
  context.moveTo(left + canWidth * 0.81, top + canHeight * 0.32);
  context.lineTo(left + canWidth * 0.63, top + canHeight * 0.49);
  context.moveTo(left + canWidth * 0.19, top + canHeight * 0.82);
  context.lineTo(left + canWidth * 0.37, top + canHeight * 0.63);
  context.moveTo(left + canWidth * 0.81, top + canHeight * 0.82);
  context.lineTo(left + canWidth * 0.63, top + canHeight * 0.63);
  context.stroke();
  context.restore();
}

function drawCan() {
  const points = scenePoints();
  if (state.selectedLevel === 2) {
    drawCanAt(points.leftCanX, points.canTop, points.groundY, points.canWidth, state.canFill.left, 15);
    drawCanAt(points.rightCanX, points.canTop, points.groundY, points.canWidth, state.canFill.right, 15);
    return;
  }
  drawCanAt(points.canX, points.canTop, points.groundY, points.canWidth, state.waterCaught, 30);
}

function drawScene() {
  const { width, height } = state;
  if (!width || !height) return;
  const { cloudX, cloudY, groundY } = scenePoints();
  context.clearRect(0, 0, width, height);

  drawStormySky(width, height);
  drawLandscape(width, height, groundY);
  if (state.selectedLevel === 2) {
    drawStormCloud(width * 0.29, height * 0.32, Math.min(width * 0.14, 92), "#596874");
    drawStormCloud(width * 0.71, height * 0.32, Math.min(width * 0.14, 92), "#596874");
    drawLightning();
  }
  drawCloud(cloudX, cloudY);
  drawCan();

  state.strokes.forEach((stroke) => {
    if (!stroke.points.length) return;
    context.save();
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "rgba(0, 166, 166, 0.78)";
    context.lineWidth = 4;
    context.shadowColor = "rgba(0, 166, 166, 0.18)";
    context.shadowBlur = 6;
    context.beginPath();
    context.moveTo(stroke.points[0].x, stroke.points[0].y);
    stroke.points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
    context.stroke();
    context.restore();
  });

  state.drops.forEach((drop) => {
    context.save();
    context.translate(drop.x, drop.y);
    context.rotate(Math.atan2(drop.vx, drop.vy) * 0.22);
    context.fillStyle = "#4bbfc0";
    context.beginPath();
    context.moveTo(0, -drop.radius * 1.5);
    context.bezierCurveTo(drop.radius * 0.4, -drop.radius * 0.75, drop.radius, 0, drop.radius, drop.radius * 0.4);
    context.bezierCurveTo(drop.radius, drop.radius * 1.15, -drop.radius, drop.radius * 1.15, -drop.radius, drop.radius * 0.4);
    context.bezierCurveTo(-drop.radius, 0, -drop.radius * 0.4, -drop.radius * 0.75, 0, -drop.radius * 1.5);
    context.fill();
    context.restore();
  });

  state.particles.forEach((particle) => {
    context.globalAlpha = Math.max(0, particle.life / 0.35);
    context.fillStyle = "#27b5b0";
    context.beginPath();
    context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
  });
}

function updateStats() {
  timerText.innerHTML = `${Math.ceil(state.timeLeft)}<span>s</span>`;
  waterText.innerHTML = `${Math.min(100, Math.round((state.waterCaught / 30) * 100))}<span>%</span>`;
  linesText.textContent = String(state.lineCount);
}

function setRoundMessage(message) {
  canvasMessage.textContent = message;
  canvasMessage.classList.remove("hidden");
}

function clearRoundMessage() {
  canvasMessage.classList.add("hidden");
}

function resetGame() {
  state.strokes = [];
  state.activeStroke = null;
  state.drops = [];
  state.particles = [];
  state.waterCaught = 0;
  state.canFill.left = 0;
  state.canFill.right = 0;
  state.lineCount = 0;
  state.timeLeft = 15;
  state.running = false;
  state.roundEnded = false;
  state.won = false;
  state.spawnTimer = 0;
  state.drawing = false;
  rainButton.disabled = state.levelIntroOpen;
  rainButton.innerHTML = state.selectedLevel === 2
    ? 'Start the storm <span aria-hidden="true">→</span>'
    : 'Start the rain <span aria-hidden="true">→</span>';
  gameHint.textContent = state.selectedLevel === 2
    ? "Fill both cans before the 15-second storm passes."
    : "Draw a path from the cloud to the can.";
  controlHint.textContent = state.selectedLevel === 2
    ? "Guide the rain to both cans. Keep clear of the lightning."
    : "Drag to draw a path. Fewer lines = a better score.";
  levelIntro.classList.toggle("hidden", !state.levelIntroOpen);
  clearRoundMessage();
  updateStats();
  drawScene();
}

function makeConfetti() {
  const colors = ["#00a6a6", "#f0b270", "#79c8ba", "#d7e8df", "#64b9cb"];
  for (let index = 0; index < 54; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${random(0, 100)}vw`;
    piece.style.backgroundColor = colors[index % colors.length];
    piece.style.setProperty("--drift", `${random(-90, 90)}px`);
    piece.style.animationDelay = `${random(0, 0.7)}s`;
    document.body.append(piece);
    piece.addEventListener("animationend", () => piece.remove(), { once: true });
  }
}

function winRound() {
  const objectivesComplete = state.selectedLevel === 2
    ? state.canFill.left >= 15 && state.canFill.right >= 15
    : state.waterCaught >= 30;
  if (state.won || !objectivesComplete) return;
  state.running = false;
  state.roundEnded = true;
  state.won = true;
  state.unlockedLevelTwo = true;
  localStorage.setItem("rainCatcherLevelTwo", "true");
  updateLevelCards();
  document.getElementById("winWater").textContent = String(state.waterCaught);
  document.getElementById("winLines").textContent = String(state.lineCount);
  const score = Math.max(0, state.waterCaught * 100 - Math.max(0, state.lineCount - 1) * 250);
  document.getElementById("scoreText").textContent = score.toLocaleString();
  const unlockNote = document.getElementById("unlockNote");
  unlockNote.classList.toggle("hidden", state.selectedLevel !== 1);
  showScreen("win");
  makeConfetti();
}

function endRound() {
  state.running = false;
  state.roundEnded = true;
  gameHint.textContent = "The rain stopped. Let the last drops land!";
  controlHint.textContent = "Drops already falling can still fill the can. Reset to try again.";
  rainButton.disabled = false;
  rainButton.innerHTML = 'Try again <span aria-hidden="true">↻</span>';
  setRoundMessage("The rain stopped! Remaining drops can still count.");
}

function startRain() {
  if (state.roundEnded) resetGame();
  if (state.levelIntroOpen) return;
  state.running = true;
  state.lastFrame = performance.now();
  state.spawnTimer = 0;
  rainButton.disabled = true;
  rainButton.innerHTML = "Rain is falling…";
  gameHint.textContent = state.selectedLevel === 2
    ? "Fill both cans with 15 drops each before time runs out."
    : "Catch 30 drops before the 15 seconds are up.";
  controlHint.textContent = state.selectedLevel === 2
    ? "Draw around the lightning and guide rain to both cans."
    : "Keep drawing a path to guide each drop into the can.";
  clearRoundMessage();
}

function pointerPosition(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function isLightningZone(point) {
  if (state.selectedLevel !== 2) return false;
  return lightningBolts().some((bolt) => bolt.slice(1).some((end, index) =>
    segmentDistance(point, bolt[index], end).distance <= 14));
}

function beginDrawing(event) {
  if (screens.game.classList.contains("hidden") || state.roundEnded) return;
  event.preventDefault();
  const point = pointerPosition(event);
  if (isLightningZone(point)) {
    gameHint.textContent = "Lightning strikes here! Draw around the glowing bolts.";
    return;
  }
  if (state.selectedLevel === 2) {
    gameHint.textContent = "Fill both cans with 15 drops each before time runs out.";
  }
  canvas.setPointerCapture(event.pointerId);
  state.drawing = true;
  state.activeStroke = { points: [point] };
  state.strokes.push(state.activeStroke);
  drawScene();
}

function moveDrawing(event) {
  if (!state.drawing || !state.activeStroke) return;
  const point = pointerPosition(event);
  const previous = state.activeStroke.points.at(-1);
  const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
  if (distance < 3) return;

  const steps = Math.ceil(distance / 3);
  for (let index = 1; index <= steps; index += 1) {
    const candidate = {
      x: previous.x + ((point.x - previous.x) * index) / steps,
      y: previous.y + ((point.y - previous.y) * index) / steps,
    };
    if (isLightningZone(candidate)) {
      gameHint.textContent = "Lightning strikes here! Draw around the glowing bolts.";
      finishDrawing();
      return;
    }
    const lastPoint = state.activeStroke.points.at(-1);
    if (Math.hypot(candidate.x - lastPoint.x, candidate.y - lastPoint.y) >= 3) {
      state.activeStroke.points.push(candidate);
    }
  }
  drawScene();
}

function finishDrawing() {
  if (!state.drawing || !state.activeStroke) return;
  const stroke = state.activeStroke;
  const length = stroke.points.reduce((total, point, index) => {
    if (index === 0) return total;
    const previous = stroke.points[index - 1];
    return total + Math.hypot(point.x - previous.x, point.y - previous.y);
  }, 0);
  if (length < 14) {
    state.strokes.pop();
  } else {
    state.lineCount += 1;
    updateStats();
  }
  state.drawing = false;
  state.activeStroke = null;
  drawScene();
}

function segmentDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return { distance: Math.hypot(point.x - start.x, point.y - start.y), t: 0 };
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  const closestX = start.x + t * dx;
  const closestY = start.y + t * dy;
  return { distance: Math.hypot(point.x - closestX, point.y - closestY), t };
}

function updateDrops(delta) {
  const { cloudX, cloudY, canX, canTop, groundY, canWidth } = scenePoints();
  if (state.running) {
    state.spawnTimer += delta;
    while (state.spawnTimer >= 0.12) {
      state.spawnTimer -= 0.12;
      state.drops.push({
        x: cloudX + random(-34, 34),
        y: cloudY + 17,
        vx: random(-7, 7),
        vy: random(35, 65),
        radius: random(2.5, 3.4),
      });
    }
  }

  state.drops.forEach((drop) => {
    const stepCount = Math.max(1, Math.ceil(Math.hypot(drop.vx, drop.vy) * delta / Math.max(2, drop.radius)));
    const step = delta / stepCount;
    for (let stepIndex = 0; stepIndex < stepCount; stepIndex += 1) {
      drop.vy += 460 * step;
      drop.x += drop.vx * step;
      drop.y += drop.vy * step;

      for (let strokeIndex = 0; strokeIndex < state.strokes.length; strokeIndex += 1) {
        const points = state.strokes[strokeIndex].points;
        for (let segmentIndex = 0; segmentIndex < points.length - 1; segmentIndex += 1) {
          const start = points[segmentIndex];
          const end = points[segmentIndex + 1];
          const nearest = segmentDistance(drop, start, end);
          if (nearest.distance > drop.radius + 3) continue;

          const dx = end.x - start.x;
          const dy = end.y - start.y;
          const length = Math.hypot(dx, dy) || 1;
          let normalX = drop.x - (start.x + dx * nearest.t);
          let normalY = drop.y - (start.y + dy * nearest.t);
          const distance = Math.hypot(normalX, normalY);
          if (distance > 0) {
            normalX /= distance;
            normalY /= distance;
          } else {
            normalX = -dy / length;
            normalY = dx / length;
            if (drop.vx * normalX + drop.vy * normalY > 0) {
              normalX *= -1;
              normalY *= -1;
            }
          }

          const normalSpeed = drop.vx * normalX + drop.vy * normalY;
          if (normalSpeed >= 0) continue;
          const overlap = drop.radius + 3 - distance;
          drop.x += normalX * overlap;
          drop.y += normalY * overlap;
          drop.vx -= 1.12 * normalSpeed * normalX;
          drop.vy -= 1.12 * normalSpeed * normalY;
          const tangentSpeed = drop.vx * (dy / length) + drop.vy * (-dx / length);
          const tangentFriction = 0.995;
          drop.vx += (dy / length) * tangentSpeed * (tangentFriction - 1);
          drop.vy += (-dx / length) * tangentSpeed * (tangentFriction - 1);
        }
      }
    }

    if (state.selectedLevel === 2) {
      const points = scenePoints();
      if (drop.y >= points.canTop && drop.y <= points.groundY) {
        const caughtCan = [points.leftCanX, points.rightCanX].find((x) =>
          drop.x >= x - points.canWidth * 0.48 && drop.x <= x + points.canWidth * 0.48);
        if (caughtCan !== undefined) {
          drop.caught = true;
          const side = caughtCan === points.leftCanX ? "left" : "right";
          if (state.canFill[side] < 15) {
            state.canFill[side] += 1;
            state.waterCaught += 1;
            state.particles.push({ x: drop.x, y: drop.y, radius: 3, life: 0.35 });
            updateStats();
            if (state.canFill.left >= 15 && state.canFill.right >= 15) winRound();
          }
        }
      }
    } else if (drop.y >= canTop && drop.y <= groundY && drop.x >= canX - canWidth * 0.43 && drop.x <= canX + canWidth * 0.43) {
      drop.caught = true;
      state.waterCaught += 1;
      state.particles.push({ x: drop.x, y: drop.y, radius: 3, life: 0.35 });
      updateStats();
      if (state.waterCaught >= 30) winRound();
    }
  });

  state.drops = state.drops.filter((drop) => !drop.caught && drop.y < groundY + 20 && drop.x > -20 && drop.x < state.width + 20);
  state.particles.forEach((particle) => {
    particle.life -= delta;
    particle.radius += delta * 10;
  });
  state.particles = state.particles.filter((particle) => particle.life > 0);
}

function animate(timestamp) {
  const delta = Math.min(0.05, Math.max(0, (timestamp - state.lastFrame) / 1000 || 0));
  state.lastFrame = timestamp;

  if (state.running) {
    state.timeLeft = Math.max(0, state.timeLeft - delta);
    updateDrops(delta);
    updateStats();
    if (state.running && state.timeLeft <= 0) {
      endRound();
    }
  } else if (state.drops.length || state.particles.length) {
    updateDrops(delta);
  }

  drawScene();
  requestAnimationFrame(animate);
}

document.getElementById("playButton").addEventListener("click", () => {
  updateLevelCards();
  levelHeading.textContent = "One little puddle at a time.";
  showScreen("levels");
});
document.getElementById("homeButton").addEventListener("click", () => showScreen("welcome"));
document.getElementById("levelOneButton").addEventListener("click", () => {
  state.selectedLevel = 1;
  state.levelIntroOpen = false;
  gameHeading.firstChild.textContent = "The Calm Before";
  gameLevelLabel.lastChild.textContent = " LEVEL 01";
  cloudLabel.textContent = "THE CLOUD";
  canLabel.textContent = "YOUR CAN";
  canvas.setAttribute("aria-label", "Draw a line from the rain cloud to guide water into the can.");
  resetGame();
  showScreen("game");
});
levelTwoButton.addEventListener("click", () => {
  if (!state.unlockedLevelTwo) return;
  state.selectedLevel = 2;
  state.levelIntroOpen = true;
  gameHeading.firstChild.textContent = "The Eye";
  gameLevelLabel.lastChild.textContent = " LEVEL 02";
  cloudLabel.textContent = "RAIN CLOUD";
  canLabel.textContent = "TWO CANS";
  canvas.setAttribute("aria-label", "Draw lines to guide rain from the center cloud into both cans, avoiding lightning strikes.");
  resetGame();
  showScreen("game");
});
levelIntroButton.addEventListener("click", () => {
  state.levelIntroOpen = false;
  levelIntro.classList.add("hidden");
  rainButton.disabled = false;
  startRain();
});
document.getElementById("levelsButton").addEventListener("click", () => {
  state.running = false;
  showScreen("levels");
});
document.getElementById("resetButton").addEventListener("click", resetGame);
rainButton.addEventListener("click", startRain);
document.getElementById("winLevelsButton").addEventListener("click", () => showScreen("levels"));
document.getElementById("againButton").addEventListener("click", () => {
  resetGame();
  showScreen("game");
});
canvas.addEventListener("pointerdown", beginDrawing);
canvas.addEventListener("pointermove", moveDrawing);
canvas.addEventListener("pointerup", finishDrawing);
canvas.addEventListener("pointercancel", finishDrawing);
window.addEventListener("resize", resizeCanvas);

updateLevelCards();
updateStats();
requestAnimationFrame(animate);
