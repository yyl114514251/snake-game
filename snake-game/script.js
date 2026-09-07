/* ============================================================
 * 贪吃蛇 · Snake 小游戏
 * 纯原生 JavaScript + Canvas 实现，无任何外部依赖
 * ============================================================ */

(() => {
  "use strict";

  // ---------- 基础配置 ----------
  const COLS = 20;                // 列数
  const ROWS = 20;                // 行数
  const CELL = 30;                // 单格像素（逻辑画布 600x600）
  const BASE_SPEED = 160;         // 初始每步毫秒数
  const MIN_SPEED = 70;           // 最快每步毫秒数
  const SPEED_STEP = 4;           // 每吃一个食物提速量
  const SCORE_PER_FOOD = 10;      // 每个食物得分
  const BEST_KEY = "snake_best_score";

  // ---------- 画布 ----------
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  canvas.width = COLS * CELL;
  canvas.height = ROWS * CELL;

  // ---------- DOM ----------
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const lengthEl = document.getElementById("length");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const overlayDesc = document.getElementById("overlay-desc");
  const restartBtn = document.getElementById("restart-btn");

  // ---------- 游戏状态 ----------
  const DIRS = {
    up:    { x: 0,  y: -1 },
    down:  { x: 0,  y: 1 },
    left:  { x: -1, y: 0 },
    right: { x: 1,  y: 0 },
  };
  const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };

  let snake = [];        // 蛇身坐标数组，下标 0 为蛇头
  let food = null;       // 食物坐标
  let dir = "right";     // 当前方向
  let queue = [];        // 方向队列（缓冲快速连按）
  let score = 0;
  let best = Number(localStorage.getItem(BEST_KEY) || 0);
  let state = "ready";   // ready | running | paused | over
  let timer = null;      // 主循环定时器
  let stepMs = BASE_SPEED;
  let frame = 0;         // 用于食物呼吸动画

  bestEl.textContent = best;

  // ---------- 工具函数 ----------
  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  function samePoint(a, b) {
    return a.x === b.x && a.y === b.y;
  }

  // 生成不与蛇身重叠的食物
  function spawnFood() {
    const free = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!snake.some((p) => p.x === x && p.y === y)) free.push({ x, y });
      }
    }
    if (free.length === 0) return null; // 蛇占满全屏，游戏胜利
    food = free[randInt(0, free.length - 1)];
    return food;
  }

  // ---------- 游戏流程 ----------
  function resetGame() {
    snake = [
      { x: 8, y: 10 },
      { x: 7, y: 10 },
      { x: 6, y: 10 },
    ];
    dir = "right";
    queue = [];
    score = 0;
    stepMs = BASE_SPEED;
    spawnFood();
    updateStats();
    draw();
  }

  function start() {
    state = "running";
    hideOverlay();
    clearTimer();
    timer = setInterval(tick, stepMs);
  }

  function pause() {
    if (state !== "running") return;
    state = "paused";
    clearTimer();
    showOverlay("游戏暂停", "按空格键或点击继续");
  }

  function resume() {
    if (state !== "paused") return;
    state = "running";
    hideOverlay();
    timer = setInterval(tick, stepMs);
  }

  function gameOver(msg) {
    state = "over";
    clearTimer();
    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
      bestEl.textContent = best;
    }
    showOverlay("游戏结束", msg);
  }

  function clearTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  // 每帧推进
  function tick() {
    // 取方向队列中第一个合法方向
    while (queue.length > 0) {
      const next = queue.shift();
      if (next !== dir && next !== OPPOSITE[dir]) {
        dir = next;
        break;
      }
    }

    const head = { x: snake[0].x + DIRS[dir].x, y: snake[0].y + DIRS[dir].y };

    // 撞墙
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
      gameOver("撞到墙了，得分 " + score);
      return;
    }
    // 撞自己（尾巴即将移走时不算撞）
    const willMoveTail = !(food && samePoint(head, food));
    if (snake.some((p, i) => p.x === head.x && p.y === head.y && (willMoveTail || i < snake.length - 1))) {
      gameOver("撞到自己了，得分 " + score);
      return;
    }

    snake.unshift(head);

    if (food && samePoint(head, food)) {
      score += SCORE_PER_FOOD;
      stepMs = Math.max(MIN_SPEED, stepMs - SPEED_STEP);
      updateStats();
      // 提速后重启定时器
      clearTimer();
      timer = setInterval(tick, stepMs);
      if (!spawnFood()) {
        // 全屏占满 = 胜利
        gameOver("你赢了！满分通关！");
        return;
      }
    } else {
      snake.pop();
    }

    updateStats();
    draw();
  }

  // ---------- 渲染 ----------
  function draw() {
    frame++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 网格背景
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? "#263449" : "#232f43";
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }

    // 食物（带呼吸光晕）
    if (food) {
      const pulse = 0.5 + 0.5 * Math.sin(frame * 0.18);
      const fx = food.x * CELL + CELL / 2;
      const fy = food.y * CELL + CELL / 2;
      const glowR = CELL * (0.9 + 0.25 * pulse);
      const grad = ctx.createRadialGradient(fx, fy, 2, fx, fy, glowR);
      grad.addColorStop(0, "rgba(248,113,113,0.9)");
      grad.addColorStop(0.55, "rgba(248,113,113,0.35)");
      grad.addColorStop(1, "rgba(248,113,113,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(fx, fy, glowR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#f87171";
      roundRect(food.x * CELL + 5, food.y * CELL + 5, CELL - 10, CELL - 10, 7);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      roundRect(food.x * CELL + 8, food.y * CELL + 8, CELL - 18, CELL - 18, 5);
      ctx.fill();
    }

    // 蛇身
    for (let i = snake.length - 1; i >= 0; i--) {
      const p = snake[i];
      const isHead = i === 0;
      const pad = isHead ? 2 : 3;
      const t = i / Math.max(1, snake.length - 1); // 0=头 -> 1=尾
      const r = Math.round(52 + t * 40);
      const g = Math.round(211 - t * 90);
      const b = Math.round(153 - t * 50);

      ctx.fillStyle = isHead ? "#34d399" : `rgb(${r},${g},${b})`;
      roundRect(p.x * CELL + pad, p.y * CELL + pad, CELL - pad * 2, CELL - pad * 2, isHead ? 8 : 6);
      ctx.fill();

      // 蛇头眼睛
      if (isHead) {
        drawEyes(p);
      }
    }
  }

  // 根据当前方向画蛇头眼睛
  function drawEyes(head) {
    const cx = head.x * CELL + CELL / 2;
    const cy = head.y * CELL + CELL / 2;
    const look = DIRS[dir];
    const perp = { x: -look.y, y: look.x };
    const eyeOffset = 6;
    const fwdOffset = 6;
    const eyeR = 3.2;
    ctx.fillStyle = "#052e1f";

    for (const s of [-1, 1]) {
      const ex = cx + look.x * fwdOffset + perp.x * eyeOffset * s;
      const ey = cy + look.y * fwdOffset + perp.y * eyeOffset * s;
      ctx.beginPath();
      ctx.arc(ex, ey, eyeR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 圆角矩形
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function updateStats() {
    scoreEl.textContent = score;
    lengthEl.textContent = snake.length;
  }

  // ---------- 遮罩 ----------
  function showOverlay(title, desc) {
    overlayTitle.textContent = title;
    overlayDesc.textContent = desc;
    overlay.classList.remove("hidden");
  }

  function hideOverlay() {
    overlay.classList.add("hidden");
  }

  // ---------- 输入：键盘 ----------
  document.addEventListener("keydown", (e) => {
    const key = e.key;

    if (key === " " || key === "Spacebar") {
      e.preventDefault();
      if (state === "running") pause();
      else if (state === "paused") resume();
      return;
    }

    if (key === "Enter") {
      e.preventDefault();
      if (state === "ready") start();
      else if (state === "over") { resetGame(); start(); }
      else if (state === "paused") resume();
      return;
    }

    const map = {
      ArrowUp: "up", w: "up", W: "up",
      ArrowDown: "down", s: "down", S: "down",
      ArrowLeft: "left", a: "left", A: "left",
      ArrowRight: "right", d: "right", D: "right",
    };
    const d = map[key];
    if (!d) return;

    e.preventDefault();
    if (state === "ready") start();
    if (state !== "running") return;

    // 方向进队列，禁止 180° 掉头（结合当前实际移动方向判断）
    const last = queue.length > 0 ? queue[queue.length - 1] : dir;
    if (d === last || d === OPPOSITE[last]) return;
    queue.push(d);
  });

  // ---------- 输入：触屏滑动 ----------
  let touchStart = null;
  canvas.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  }, { passive: true });

  canvas.addEventListener("touchend", (e) => {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    touchStart = null;

    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return; // 误触阈值
    const d = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? "right" : "left")
      : (dy > 0 ? "down" : "up");
    pushDir(d);
  }, { passive: true });

  // 方向按钮
  document.querySelectorAll(".d-btn").forEach((btn) => {
    btn.addEventListener("click", () => pushDir(btn.dataset.dir));
  });

  function pushDir(d) {
    if (state === "ready") start();
    if (state !== "running") return;
    const last = queue.length > 0 ? queue[queue.length - 1] : dir;
    if (d === last || d === OPPOSITE[last]) return;
    queue.push(d);
  }

  // ---------- 其他 ----------
  restartBtn.addEventListener("click", () => {
    resetGame();
    start();
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay && state === "paused") resume();
  });

  // 页面可见性变化时自动暂停
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "running") pause();
  });

  // ---------- 启动 ----------
  resetGame();
  showOverlay("贪吃蛇", "按任意方向键 / 点击开始");
})();
