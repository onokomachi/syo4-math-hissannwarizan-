'use strict';

// ============================================================
// App — screen router, localStorage progress, GridRenderer
// ============================================================

const App = (() => {

  const STORAGE_KEY = 'hissanwarizan_v2';

  // ── Progress (localStorage) ──────────────────────────────
  function getProgress() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || defaultProgress(); }
    catch (_) { return defaultProgress(); }
  }

  function defaultProgress() {
    const stats = () => ({ attempted: 0, perfect: 0, bestTime: null, streak: 0 });
    return {
      difficulty: { digits: 2, remainder: false },
      history: [],
      difficultyProgress: { '2-0': stats(), '2-1': stats(), '3-0': stats(), '3-1': stats() },
      recentProblems: [],
    };
  }

  function saveProgress(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) {}
  }

  function getDifficulty() { return getProgress().difficulty; }

  function getDifficultyKey() {
    const d = getDifficulty();
    return `${d.digits}-${d.remainder ? 1 : 0}`;
  }

  function setDifficulty(digits, remainder) {
    const p = getProgress();
    p.difficulty = { digits, remainder: !!remainder };
    saveProgress(p);
    renderHomeUI();
  }

  function recordResult({ diffKey, dividend, divisor, hintsUsed, elapsedMs, mode }) {
    const p = getProgress();
    const key = `${dividend}÷${divisor}`;
    const perfect = hintsUsed === 0;

    p.history.unshift({ date: new Date().toISOString(), diffKey, dividend, divisor,
                        hintsUsed, elapsedMs, mode, perfect });
    if (p.history.length > 200) p.history = p.history.slice(0, 200);

    if (!p.difficultyProgress[diffKey]) {
      p.difficultyProgress[diffKey] = { attempted:0, perfect:0, bestTime:null, streak:0 };
    }
    const lp = p.difficultyProgress[diffKey];
    lp.attempted++;
    if (perfect) { lp.perfect++; lp.streak++; } else { lp.streak = 0; }
    if (perfect && (lp.bestTime === null || elapsedMs < lp.bestTime)) lp.bestTime = elapsedMs;

    p.recentProblems = [key, ...p.recentProblems.filter(k => k !== key)].slice(0, 6);
    saveProgress(p);
    return lp.streak;
  }

  function clearProgress() {
    if (!confirm('きろくをすべて消しますか？')) return;
    saveProgress(defaultProgress());
    renderHomeUI();
    navigate('home');
  }

  function getRecentProblems() { return getProgress().recentProblems; }

  // ── Navigation ────────────────────────────────────────────
  function navigate(screenName, params = {}) {
    document.querySelectorAll('section[data-screen]')
      .forEach(s => s.classList.remove('active'));
    const target = document.querySelector(`[data-screen="${screenName}"]`);
    if (!target) return;
    target.classList.add('active');

    if (screenName === 'tutorial')  Tutorial.init(params);
    if (screenName === 'practice')  Practice.init(params);
    if (screenName === 'result')    renderResult(params);
    if (screenName === 'progress')  renderProgressScreen();
    if (screenName === 'home')      renderHomeUI();
  }

  // ── Home UI ───────────────────────────────────────────────
  function renderHomeUI() {
    const d = getDifficulty();
    // Highlight digit buttons
    document.querySelectorAll('.digit-btn').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.digits) === d.digits);
    });
    // Highlight remainder buttons
    document.querySelectorAll('.remainder-btn').forEach(btn => {
      const isRemainder = btn.dataset.remainder === 'true';
      btn.classList.toggle('active', isRemainder === d.remainder);
    });
    // Update badge
    const badge = document.getElementById('difficulty-badge');
    if (badge) {
      badge.textContent = `${d.digits}けた　・　あまり${d.remainder ? 'あり' : 'なし'}`;
    }
  }

  // ── Result screen ─────────────────────────────────────────
  function renderResult({ problem, hintsUsed, elapsedMs, testMode, diffKey }) {
    const perfect = hintsUsed === 0;
    document.getElementById('result-icon').textContent  = perfect ? '🎉' : '✅';
    document.getElementById('result-title').textContent = perfect ? 'パーフェクト！' : 'せいかい！';
    const remainder = problem.remainder > 0 ? ` あまり ${problem.remainder}` : '';
    document.getElementById('result-problem').textContent =
      `${problem.dividend} ÷ ${problem.divisor} = ${problem.quotient}${remainder}`;
    document.getElementById('result-time').textContent = formatTime(elapsedMs);
    document.getElementById('result-hints').textContent = `${hintsUsed}回`;

    const streak = recordResult({
      diffKey, dividend: problem.dividend, divisor: problem.divisor,
      hintsUsed, elapsedMs, mode: testMode ? 'test' : 'practice',
    });

    // Streak bonus
    const bonusEl = document.getElementById('result-bonus');
    if (streak >= 3 && perfect) {
      bonusEl.style.display = '';
      bonusEl.textContent = `🌟 ${streak}問れんぞくせいかい！すごい！`;
    } else {
      bonusEl.style.display = 'none';
    }
  }

  function formatTime(ms) {
    if (!ms && ms !== 0) return '--';
    const s = Math.round(ms / 1000);
    return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  }

  // ── Progress screen ───────────────────────────────────────
  function renderProgressScreen() {
    const p = getProgress();
    const container = document.getElementById('progress-content');
    container.innerHTML = '';

    const configs = [
      { key: '2-0', label: '2けた あまりなし' },
      { key: '2-1', label: '2けた あまりあり' },
      { key: '3-0', label: '3けた あまりなし' },
      { key: '3-1', label: '3けた あまりあり' },
    ];
    configs.forEach(({ key, label }) => {
      const lp = p.difficultyProgress[key] || { attempted:0, perfect:0, bestTime:null };
      const card = document.createElement('div');
      card.className = 'progress-card';
      const stars = '⭐'.repeat(Math.min(lp.perfect, 5));
      card.innerHTML = `
        <div class="pcl">${label}</div>
        <div class="pcv">${lp.attempted}<span>問</span></div>
        <div class="pcs">パーフェクト ${lp.perfect}問</div>
        <div class="pcs">ベスト ${formatTime(lp.bestTime)}</div>
        <div class="pcstars">${stars || '－'}</div>
      `;
      container.appendChild(card);
    });
  }

  // ── Init ─────────────────────────────────────────────────
  function init() { renderHomeUI(); }

  return { navigate, getDifficulty, getDifficultyKey, setDifficulty,
           getRecentProblems, recordResult, clearProgress, formatTime, init };

})();

// ============================================================
// GridRenderer — renders division tableau into a container
// ============================================================

const GridRenderer = (() => {

  /**
   * Render the problem grid.
   * @param {HTMLElement} container
   * @param {object} problem - from Division.computeSteps()
   * @param {object} opts - { interactive, allVisible }
   */
  function render(container, problem, opts = {}) {
    const { interactive = false, allVisible = false } = opts;
    const { grid } = problem;
    const rows = grid.length;
    const cols = grid[0].length;

    container.innerHTML = '';

    // Build row template: line rows are thin, others use --cell-size
    const rowSizes = grid.map(row =>
      row.some(c => c.kind === 'line') ? '10px' : 'var(--cell-size)'
    );
    container.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`;
    container.style.gridTemplateRows = rowSizes.join(' ');

    grid.forEach((row, r) => {
      row.forEach((cellDef, c) => {

        // Line cells: span from col1 to col i+1 (CSS col 2 to span)
        if (cellDef.kind === 'line') {
          const el = document.createElement('div');
          el.className = 'cell line';
          el.dataset.row = r;
          el.dataset.col = c;
          // Always start at CSS column 2 (grid array col 1), span = cellDef.span
          el.style.gridColumn = `2 / span ${cellDef.span}`;
          el.style.gridRow = r + 1;
          container.appendChild(el);
          return;
        }

        const el = document.createElement('div');
        el.className = `cell ${cellDef.kind}`;
        el.dataset.row = r;
        el.dataset.col = c;
        if (cellDef.digitPos !== undefined) el.dataset.digitPos = cellDef.digitPos;
        if (cellDef.stepKind)              el.dataset.stepKind  = cellDef.stepKind;

        el.style.gridColumn = c + 1;
        el.style.gridRow    = r + 1;

        if (cellDef.kind === 'empty') {
          el.style.visibility = 'hidden';
          container.appendChild(el);
          return;
        }

        if (cellDef.given || allVisible) {
          if (cellDef.value !== null) el.textContent = cellDef.value;
        } else if (interactive && !cellDef.given) {
          el.classList.add('input-target');
        }

        container.appendChild(el);
      });
    });
  }

  /**
   * Get all DOM cells for a step (may be multiple for multi-digit products).
   */
  function getCellsForStep(container, step, problem) {
    const { grid } = problem;
    const cells = [];
    grid.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell.stepKind === step.kind && cell.digitPos === step.digitPos) {
          const el = container.querySelector(`[data-row="${r}"][data-col="${c}"]`);
          if (el) cells.push({ el, cell });
        }
      });
    });
    return cells;
  }

  return { render, getCellsForStep };

})();

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
