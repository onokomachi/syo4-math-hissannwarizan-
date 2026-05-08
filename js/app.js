'use strict';

// ============================================================
// App — screen router, localStorage progress, GridRenderer
// ============================================================

const App = (() => {

  // ── Progress (localStorage) ──────────────────────────────
  const STORAGE_KEY = 'hissanwarizan_v1';

  function getProgress() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultProgress();
    } catch (_) {
      return defaultProgress();
    }
  }

  function defaultProgress() {
    return {
      level: 1,
      history: [],
      levelProgress: { 1: { attempted:0, perfect:0, bestTime:null, streak:0 },
                       2: { attempted:0, perfect:0, bestTime:null, streak:0 },
                       3: { attempted:0, perfect:0, bestTime:null, streak:0 },
                       4: { attempted:0, perfect:0, bestTime:null, streak:0 } },
      recentProblems: [],
    };
  }

  function saveProgress(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch(_) {}
  }

  function getCurrentLevel() { return getProgress().level; }

  function setLevel(n) {
    n = Math.max(1, Math.min(4, Number(n)));
    const p = getProgress();
    p.level = n;
    saveProgress(p);
    renderHomeLevel();
    highlightLevelBtn(n);
  }

  function recordResult({ level, dividend, divisor, hintsUsed, elapsedMs, mode }) {
    const p = getProgress();
    const key = `${dividend}÷${divisor}`;
    const perfect = hintsUsed === 0;

    p.history.unshift({ date: new Date().toISOString(), level, dividend, divisor,
                        hintsUsed, elapsedMs, mode, perfect });
    if (p.history.length > 100) p.history = p.history.slice(0, 100);

    const lp = p.levelProgress[level];
    lp.attempted++;
    if (perfect) { lp.perfect++; lp.streak++; } else { lp.streak = 0; }
    if (perfect && (lp.bestTime === null || elapsedMs < lp.bestTime)) {
      lp.bestTime = elapsedMs;
    }

    // Track recent to avoid repetition
    p.recentProblems = [key, ...p.recentProblems.filter(k => k !== key)].slice(0, 5);

    saveProgress(p);
    return lp.streak;
  }

  function clearProgress() {
    if (!confirm('きろくをすべて消しますか？')) return;
    saveProgress(defaultProgress());
    renderHomeLevel();
    highlightLevelBtn(getCurrentLevel());
    navigate('home');
  }

  function getRecentProblems() { return getProgress().recentProblems; }

  // ── Screen navigation ────────────────────────────────────
  function navigate(screenName, params = {}) {
    document.querySelectorAll('section[data-screen]')
      .forEach(s => s.classList.remove('active'));
    const target = document.querySelector(`[data-screen="${screenName}"]`);
    if (!target) return;
    target.classList.add('active');

    if (screenName === 'tutorial') Tutorial.init(params);
    if (screenName === 'practice') Practice.init(params);
    if (screenName === 'result')   renderResult(params);
    if (screenName === 'progress') renderProgressScreen();
    if (screenName === 'home')     renderHomeLevel();
  }

  // ── Home helpers ─────────────────────────────────────────
  function renderHomeLevel() {
    const lv = getCurrentLevel();
    const el = document.getElementById('home-level-num');
    if (el) el.textContent = lv;
    highlightLevelBtn(lv);
  }

  function highlightLevelBtn(n) {
    document.querySelectorAll('.lv-btn').forEach((btn, i) => {
      btn.classList.toggle('active', i + 1 === n);
    });
  }

  // ── Result screen ─────────────────────────────────────────
  function renderResult({ problem, hintsUsed, elapsedMs, testMode, level }) {
    const perfect = hintsUsed === 0;
    document.getElementById('result-icon').textContent  = perfect ? '🎉' : '✅';
    document.getElementById('result-title').textContent = perfect ? 'せいかい！パーフェクト！' : 'せいかい！';
    document.getElementById('result-problem').textContent =
      `${problem.dividend} ÷ ${problem.divisor} = ${problem.quotient}` +
      (problem.remainder > 0 ? ` あまり ${problem.remainder}` : '');
    document.getElementById('result-time').textContent = formatTime(elapsedMs);
    document.getElementById('result-hints').textContent = `${hintsUsed}回`;

    const streak = recordResult({
      level, dividend: problem.dividend, divisor: problem.divisor,
      hintsUsed, elapsedMs, mode: testMode ? 'test' : 'practice',
    });

    // Level promotion after 3 perfect-streak
    const promoteEl = document.getElementById('result-promote');
    const lv = getCurrentLevel();
    if (streak >= 3 && lv < 4 && perfect) {
      promoteEl.style.display = '';
      promoteEl.innerHTML = `🌟 すごい！ レベル ${lv + 1} にチャレンジしよう！`;
      setLevel(lv + 1);
    } else {
      promoteEl.style.display = 'none';
    }
  }

  function formatTime(ms) {
    if (!ms) return '--';
    const s = Math.round(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  }

  // ── Progress screen ───────────────────────────────────────
  function renderProgressScreen() {
    const p = getProgress();
    const container = document.getElementById('progress-content');
    container.innerHTML = '';
    [1,2,3,4].forEach(lv => {
      const lp = p.levelProgress[lv] || { attempted:0, perfect:0, bestTime:null };
      const card = document.createElement('div');
      card.className = 'progress-level-card';
      card.innerHTML = `
        <h3>レベル ${lv}</h3>
        <div class="progress-stat">といた数<strong>${lp.attempted}</strong></div>
        <div class="progress-stat">パーフェクト<strong>${lp.perfect}</strong></div>
        <div class="progress-stat">ベストタイム<strong>${lp.bestTime ? formatTime(lp.bestTime) : '--'}</strong></div>
      `;
      container.appendChild(card);
    });
  }

  // ── Init ─────────────────────────────────────────────────
  function init() {
    renderHomeLevel();
  }

  return { navigate, getCurrentLevel, setLevel, getRecentProblems,
           recordResult, clearProgress, formatTime, init };

})();

// ============================================================
// GridRenderer — draws the division tableau into a container
// ============================================================

const GridRenderer = (() => {

  /**
   * Render the problem grid into the given container element.
   * @param {HTMLElement} container
   * @param {object} problem — from Division.computeSteps()
   * @param {object} opts — { interactive: bool, allVisible: bool }
   */
  function render(container, problem, opts = {}) {
    const { interactive = false, allVisible = false } = opts;
    const { grid } = problem;
    const rows = grid.length;
    const cols = grid[0].length;

    container.innerHTML = '';
    container.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`;
    container.style.gridTemplateRows = '';

    // Build explicit row template: normal rows are cell-size, line rows are 12px
    const rowSizes = grid.map((row) => {
      const hasLine = row.some(c => c.kind === 'line');
      return hasLine ? '12px' : 'var(--cell-size)';
    });
    container.style.gridTemplateRows = rowSizes.join(' ');

    grid.forEach((row, r) => {
      row.forEach((cellDef, c) => {
        const el = document.createElement('div');
        el.className = `cell ${cellDef.kind}`;
        el.dataset.row = r;
        el.dataset.col = c;
        if (cellDef.digitPos !== undefined) el.dataset.digitPos = cellDef.digitPos;
        if (cellDef.stepKind)  el.dataset.stepKind = cellDef.stepKind;

        if (cellDef.kind === 'line') {
          // Line spans all filled columns of this round
          const span = cellDef.span || 1;
          const startCol = c + 1;
          el.style.gridColumn = `${startCol} / span ${span}`;
          el.style.gridRow = r + 1;
          container.appendChild(el);
          return;
        }

        el.style.gridColumn = c + 1;
        el.style.gridRow = r + 1;

        if (cellDef.given || allVisible) {
          if (cellDef.value !== null) el.textContent = cellDef.value;
        } else if (!cellDef.given && cellDef.kind !== 'empty') {
          if (interactive) {
            el.classList.add('input-target');
          }
        }

        if (cellDef.kind === 'empty') {
          el.style.visibility = 'hidden';
        }

        container.appendChild(el);
      });
    });

    // Draw the top bracket bar (horizontal line above dividend)
    drawBracketBar(container, problem);
  }

  /**
   * Draw the horizontal bar above dividend digits using an absolutely positioned div.
   * The divisor cell already has border-right to form the vertical part.
   */
  function drawBracketBar(container, problem) {
    // The bar sits above row 1 (dividend row), from col 1 to last col
    // We'll use a pseudo-element via the divisor cell's border-bottom (already done in CSS)
    // Just ensure the divisor cell border-bottom aligns with top of dividend
    // This is handled in CSS already via .cell.divisor border-bottom
  }

  /**
   * Get the DOM cell element for a given step.
   */
  function getCellForStep(container, step, problem) {
    const { grid } = problem;
    const rows = grid.length;
    const cols = grid[0].length;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c];
        if (cell.stepKind === step.kind && cell.digitPos === step.digitPos) {
          return container.querySelector(`[data-row="${r}"][data-col="${c}"]`);
        }
      }
    }
    return null;
  }

  /**
   * Get ALL DOM cells for a given step (product may span multiple cells).
   */
  function getCellsForStep(container, step, problem) {
    const { grid } = problem;
    const rows = grid.length;
    const cols = grid[0].length;
    const cells = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c];
        if (cell.stepKind === step.kind && cell.digitPos === step.digitPos) {
          const el = container.querySelector(`[data-row="${r}"][data-col="${c}"]`);
          if (el) cells.push({ el, cell });
        }
      }
    }
    return cells;
  }

  return { render, getCellForStep, getCellsForStep };

})();

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
