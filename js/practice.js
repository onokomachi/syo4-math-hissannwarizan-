'use strict';

// ============================================================
// Practice — interactive input, step-by-step validation,
//            hint scaffolding, test mode timer
// ============================================================

const Practice = (() => {

  let problem     = null;
  let stepIndex   = 0;
  let hintsUsed   = 0;
  let startTime   = null;
  let testMode    = false;
  let timerInterval = null;
  let inputBuffer = '';   // for multi-digit entry (products ≥ 10)
  let level       = 1;
  let hintTimeout = null;

  // Expose for result screen "もう一問" button
  let _wasTestMode = false;
  Object.defineProperty(Practice, 'wasTestMode', { get: () => _wasTestMode });

  // ── Public: init ──────────────────────────────────────────
  function init(params = {}) {
    stopTimer();
    clearHintTimeout();

    testMode = !!params.testMode;
    _wasTestMode = testMode;
    level = params.level !== undefined ? params.level : App.getCurrentLevel();
    stepIndex = 0;
    hintsUsed = 0;
    inputBuffer = '';
    startTime = Date.now();

    const recent = App.getRecentProblems();
    const { dividend, divisor } = Division.selectProblem(level, recent);
    problem = Division.computeSteps(dividend, divisor);

    // Title & timer
    const titleEl = document.getElementById('practice-title');
    if (titleEl) titleEl.textContent = testMode ? 'テスト' : 'れんしゅう';

    const timerEl = document.getElementById('practice-timer');
    if (timerEl) timerEl.style.display = testMode ? '' : 'none';

    // Hint button
    const hintBtn = document.getElementById('hint-btn');
    if (hintBtn) hintBtn.style.display = testMode ? 'none' : '';

    // Render grid (interactive)
    const container = document.getElementById('practice-grid');
    GridRenderer.render(container, problem, { interactive: true, allVisible: false });

    if (testMode) startTimer();
    activateCurrentStep();
  }

  // ── Input entry point ────────────────────────────────────
  function numpadInput(digit) {
    if (!problem || stepIndex >= problem.steps.length) return;
    const step = problem.steps[stepIndex];

    if (step.kind === 'orosu') {
      // オロス is automatic — just advance
      advanceStep();
      return;
    }

    const expectedStr = String(step.value);
    const expectedDigits = expectedStr.length;

    inputBuffer += String(digit);
    updateActiveCell(inputBuffer);

    if (inputBuffer.length < expectedDigits) return; // wait for more digits

    const entered = inputBuffer;
    inputBuffer = '';

    if (entered === expectedStr) {
      onCorrect(step);
    } else {
      onIncorrect(step);
    }
  }

  function numpadBackspace() {
    if (!problem || inputBuffer.length === 0) return;
    inputBuffer = inputBuffer.slice(0, -1);
    updateActiveCell(inputBuffer || '');
  }

  // ── Hint ─────────────────────────────────────────────────
  function showHint() {
    if (testMode || !problem || stepIndex >= problem.steps.length) return;
    const step = problem.steps[stepIndex];
    if (step.kind === 'orosu') { advanceStep(); return; }

    hintsUsed++;

    const container = document.getElementById('practice-grid');
    const cells = GridRenderer.getCellsForStep(container, step, problem);

    if (hintsUsed <= 2) {
      // Show the answer briefly, then hide
      cells.forEach(({ el, cell }) => {
        el.textContent = cell.value;
        el.classList.add('hint-shown');
      });
      clearHintTimeout();
      hintTimeout = setTimeout(() => {
        cells.forEach(({ el }) => {
          el.classList.remove('hint-shown');
          el.textContent = '';
        });
        inputBuffer = '';
        updateInstruction();
      }, 1500);
    } else {
      // Only show mnemonic label
      setMnemonic(step.kind);
      const pill = document.querySelector(`.mnemonic-pill[data-kind="${step.kind}"]`);
      if (pill) {
        pill.classList.add('active');
        setTimeout(() => pill.style.transform = 'scale(1.3)', 50);
        setTimeout(() => pill.style.transform = '', 400);
      }
    }
  }

  // ── Internal: correct answer ──────────────────────────────
  function onCorrect(step) {
    const container = document.getElementById('practice-grid');
    const cells = GridRenderer.getCellsForStep(container, step, problem);
    cells.forEach(({ el, cell }) => {
      el.textContent = cell.value;
      el.classList.remove('input-target', 'active-input', 'incorrect', 'hint-shown');
      el.classList.add('correct');
    });

    stepIndex++;
    inputBuffer = '';

    if (stepIndex >= problem.steps.length) {
      onComplete();
      return;
    }

    // Auto-handle オロス steps
    setTimeout(() => handleAutoSteps(), 350);
  }

  function handleAutoSteps() {
    if (!problem || stepIndex >= problem.steps.length) return;
    const step = problem.steps[stepIndex];
    if (step.kind === 'orosu') {
      animateOrosu(step);
      stepIndex++;
      setTimeout(() => {
        if (stepIndex < problem.steps.length) activateCurrentStep();
        else onComplete();
      }, 600);
    } else {
      activateCurrentStep();
    }
  }

  // ── Internal: wrong answer ───────────────────────────────
  function onIncorrect(step) {
    const container = document.getElementById('practice-grid');
    const cells = GridRenderer.getCellsForStep(container, step, problem);
    cells.forEach(({ el }) => {
      el.classList.add('incorrect');
      el.textContent = inputBuffer || '?';
    });
    inputBuffer = '';
    setTimeout(() => {
      cells.forEach(({ el }) => {
        el.classList.remove('incorrect');
        el.textContent = '';
      });
      updateActiveCell('');
    }, 600);
  }

  // ── Internal: activate current step ──────────────────────
  function activateCurrentStep() {
    if (!problem || stepIndex >= problem.steps.length) return;
    const step = problem.steps[stepIndex];

    if (step.kind === 'orosu') {
      animateOrosu(step);
      stepIndex++;
      setTimeout(() => {
        if (stepIndex < problem.steps.length) activateCurrentStep();
        else onComplete();
      }, 600);
      return;
    }

    setMnemonic(step.kind);
    updateInstruction();

    const container = document.getElementById('practice-grid');
    // Remove previous active-input
    container.querySelectorAll('.active-input').forEach(el => el.classList.remove('active-input'));

    const cells = GridRenderer.getCellsForStep(container, step, problem);
    // Activate only the first cell (for multi-digit, we show buffer in it)
    if (cells.length > 0) {
      cells[0].el.classList.add('active-input');
    }
  }

  function advanceStep() {
    stepIndex++;
    inputBuffer = '';
    if (stepIndex >= problem.steps.length) { onComplete(); return; }
    setTimeout(() => handleAutoSteps(), 200);
  }

  function animateOrosu(step) {
    // Highlight the dividend digit being brought down
    const container = document.getElementById('practice-grid');
    const { grid } = problem;
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[0].length; c++) {
        if (grid[r][c].kind === 'dividend' && c - 1 === step.digitPos) {
          const el = container.querySelector(`[data-row="${r}"][data-col="${c}"]`);
          if (el) {
            el.classList.add('step-highlight');
            setTimeout(() => el.classList.remove('step-highlight'), 500);
          }
        }
      }
    }
    setSpeech(Division.stepExplanation(step, problem.divisor));
  }

  // ── Update active cell display ────────────────────────────
  function updateActiveCell(text) {
    const container = document.getElementById('practice-grid');
    const activeEl = container.querySelector('.active-input');
    if (activeEl) activeEl.textContent = text;
  }

  // ── Instruction text ──────────────────────────────────────
  function updateInstruction() {
    if (!problem || stepIndex >= problem.steps.length) return;
    const step = problem.steps[stepIndex];
    setSpeech(Division.stepExplanation(step, problem.divisor));
    const badge = document.getElementById('practice-step-label');
    if (badge) {
      const labels = { tateru:'たてる', kakeru:'かける', hiku:'ひく', orosu:'おろす' };
      badge.textContent = labels[step.kind] || '';
    }
  }

  // ── Completion ───────────────────────────────────────────
  function onComplete() {
    stopTimer();
    const elapsed = Date.now() - startTime;

    // Show final answer in grid
    const container = document.getElementById('practice-grid');
    container.querySelectorAll('.active-input').forEach(el => el.classList.remove('active-input'));

    setTimeout(() => {
      App.navigate('result', { problem, hintsUsed, elapsedMs: elapsed, testMode, level });
    }, 600);
  }

  // ── Timer ─────────────────────────────────────────────────
  function startTimer() {
    let seconds = 0;
    const el = document.getElementById('practice-timer');
    timerInterval = setInterval(() => {
      seconds++;
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      if (el) el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  // ── Helpers ───────────────────────────────────────────────
  function setMnemonic(kind) {
    document.querySelectorAll('.mnemonic-pill').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.kind === kind);
    });
  }

  function setSpeech(text) {
    const el = document.getElementById('practice-instruction');
    if (el) el.textContent = text;
  }

  function clearHintTimeout() {
    if (hintTimeout) { clearTimeout(hintTimeout); hintTimeout = null; }
  }

  return { init, numpadInput, numpadBackspace, showHint };

})();
