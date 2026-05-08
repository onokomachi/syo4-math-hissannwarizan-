'use strict';

// ============================================================
// Practice — interactive input, step-by-step validation,
//            hint scaffolding, test mode timer
// ============================================================

const Practice = (() => {

  let problem       = null;
  let stepIndex     = 0;
  let hintsUsed     = 0;
  let startTime     = null;
  let testMode      = false;
  let timerInterval = null;
  let inputBuffer   = '';
  let diffKey       = '2-0';
  let hintTimeout   = null;
  // Exposed via getter — DO NOT reference Practice inside IIFE
  let _wasTestMode  = false;

  // ── Public: init ──────────────────────────────────────────
  function init(params = {}) {
    stopTimer();
    clearHintTimeout();

    testMode = !!params.testMode;
    _wasTestMode = testMode;

    const d = App.getDifficulty();
    diffKey = App.getDifficultyKey();
    const recent = App.getRecentProblems();
    const { dividend, divisor } = Division.selectProblem(d.digits, d.remainder, recent);
    problem   = Division.computeSteps(dividend, divisor);
    stepIndex = 0;
    hintsUsed = 0;
    inputBuffer = '';
    startTime = Date.now();

    // UI setup
    const titleEl = document.getElementById('practice-title');
    if (titleEl) titleEl.textContent = testMode ? 'テスト' : 'れんしゅう';

    const problemEl = document.getElementById('practice-problem-label');
    if (problemEl) problemEl.textContent = `${dividend} ÷ ${divisor}`;

    const timerEl = document.getElementById('practice-timer');
    if (timerEl) timerEl.style.display = testMode ? '' : 'none';

    const hintBtn = document.getElementById('hint-btn');
    if (hintBtn) hintBtn.style.display = testMode ? 'none' : '';

    // Render grid
    const container = document.getElementById('practice-grid');
    GridRenderer.render(container, problem, { interactive: true, allVisible: false });

    if (testMode) startTimer();
    handleAutoSteps();
  }

  // ── Numpad input ──────────────────────────────────────────
  function numpadInput(digit) {
    if (!problem || stepIndex >= problem.steps.length) return;
    const step = problem.steps[stepIndex];

    // orosu is always automatic — should not reach here
    if (step.kind === 'orosu') { handleAutoSteps(); return; }

    const expectedStr = String(step.value);
    inputBuffer += String(digit);
    updateActiveCells();

    if (inputBuffer.length < expectedStr.length) return; // wait for more

    const entered = inputBuffer;
    inputBuffer = '';

    if (entered === expectedStr) {
      onCorrect(step);
    } else {
      onIncorrect(step);
    }
  }

  function numpadBackspace() {
    if (!inputBuffer.length) return;
    inputBuffer = inputBuffer.slice(0, -1);
    updateActiveCells();
  }

  // ── Hint (practice mode only) ─────────────────────────────
  function showHint() {
    if (testMode || !problem || stepIndex >= problem.steps.length) return;
    const step = problem.steps[stepIndex];
    if (step.kind === 'orosu') { handleAutoSteps(); return; }

    hintsUsed++;
    inputBuffer = '';
    const container = document.getElementById('practice-grid');
    const cells = GridRenderer.getCellsForStep(container, step, problem);

    if (hintsUsed <= 2) {
      // Show correct answer briefly
      cells.forEach(({ el, cell }) => {
        el.textContent = cell.value !== null ? cell.value : '';
        el.classList.add('hint-shown');
        el.classList.remove('active-input');
      });
      clearHintTimeout();
      hintTimeout = setTimeout(() => {
        cells.forEach(({ el }) => {
          el.classList.remove('hint-shown');
          el.textContent = '';
          el.classList.add('active-input');
        });
        updateActiveCells();
      }, 1500);
    } else {
      // Only flash the mnemonic pill — no value shown
      const pill = document.querySelector(`#practice-screen .mnemonic-pill[data-kind="${step.kind}"]`);
      if (pill) {
        pill.classList.add('active', 'hint-flash');
        setTimeout(() => pill.classList.remove('hint-flash'), 600);
      }
    }
  }

  // ── Correct answer ────────────────────────────────────────
  function onCorrect(step) {
    const container = document.getElementById('practice-grid');
    const cells = GridRenderer.getCellsForStep(container, step, problem);
    cells.forEach(({ el, cell }) => {
      el.textContent = cell.value !== null ? cell.value : '';
      el.classList.remove('input-target', 'active-input', 'incorrect', 'hint-shown');
      el.classList.add('correct');
    });

    // For intermediate zero diffs: briefly show green, then fade to ghost
    // to teach "0 のときは書きません"
    if (step.isZeroDiff) {
      setSpeech('0 のときは　書きません！　次の数字をおろすよ');
      setTimeout(() => {
        cells.forEach(({ el }) => {
          el.classList.remove('correct');
          // practice-ghost triggers the green→gray CSS transition
          el.classList.add('zero-diff', 'practice-ghost');
        });
      }, 600);
    }

    stepIndex++;
    inputBuffer = '';

    if (stepIndex >= problem.steps.length) { onComplete(); return; }
    // Slightly longer delay for zero-diff so student sees the message
    setTimeout(handleAutoSteps, step.isZeroDiff ? 900 : 350);
  }

  // ── Incorrect answer ──────────────────────────────────────
  function onIncorrect(step) {
    const container = document.getElementById('practice-grid');
    const cells = GridRenderer.getCellsForStep(container, step, problem);
    const expectedStr = String(step.value);
    const paddedBuf = inputBuffer.padStart ? inputBuffer : '';

    cells.forEach(({ el }, idx) => {
      el.textContent = paddedBuf[idx] || '?';
      el.classList.add('incorrect');
    });
    inputBuffer = '';

    setTimeout(() => {
      cells.forEach(({ el }) => {
        el.classList.remove('incorrect');
        el.textContent = '';
        el.classList.add('active-input');
      });
    }, 600);
  }

  // ── Handle auto steps (orosu) ────────────────────────────
  function handleAutoSteps() {
    if (!problem || stepIndex >= problem.steps.length) return;
    const step = problem.steps[stepIndex];

    if (step.kind === 'orosu') {
      revealOrosu(step);
      stepIndex++;
      setTimeout(() => {
        if (stepIndex >= problem.steps.length) onComplete();
        else handleAutoSteps();
      }, 500);
    } else {
      activateCurrentStep();
    }
  }

  // ── Reveal orosu digit automatically ─────────────────────
  function revealOrosu(step) {
    const container = document.getElementById('practice-grid');
    // Reveal the orosu_digit cell in the diff row
    const cells = GridRenderer.getCellsForStep(container, step, problem);
    cells.forEach(({ el, cell }) => {
      el.textContent = cell.value !== null ? cell.value : '';
      el.classList.remove('input-target');
      el.classList.add('orosu-reveal');
      setTimeout(() => el.classList.remove('orosu-reveal'), 600);
    });
    setSpeech(Division.stepExplanation(step, problem.divisor));
    setMnemonic('orosu');
  }

  // ── Activate current step ─────────────────────────────────
  function activateCurrentStep() {
    if (!problem || stepIndex >= problem.steps.length) return;
    const step = problem.steps[stepIndex];

    setMnemonic(step.kind);
    setSpeech(Division.stepExplanation(step, problem.divisor));

    const container = document.getElementById('practice-grid');
    container.querySelectorAll('.active-input').forEach(el => el.classList.remove('active-input'));

    const cells = GridRenderer.getCellsForStep(container, step, problem);
    cells.forEach(({ el }) => el.classList.add('active-input'));
  }

  // ── Update cell display during multi-digit entry ──────────
  function updateActiveCells() {
    const container = document.getElementById('practice-grid');
    if (!problem || stepIndex >= problem.steps.length) return;
    const step = problem.steps[stepIndex];
    const cells = GridRenderer.getCellsForStep(container, step, problem);
    const buf = inputBuffer;

    // Left-align: first character goes to first cell
    cells.forEach(({ el }, idx) => {
      el.textContent = idx < buf.length ? buf[idx] : '';
    });
  }

  // ── Completion ────────────────────────────────────────────
  function onComplete() {
    stopTimer();
    const elapsedMs = Date.now() - startTime;
    const container = document.getElementById('practice-grid');
    container.querySelectorAll('.active-input').forEach(el => el.classList.remove('active-input'));

    setTimeout(() => {
      App.navigate('result', { problem, hintsUsed, elapsedMs, testMode, diffKey });
    }, 500);
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

  function stopTimer() { clearInterval(timerInterval); timerInterval = null; }

  // ── Helpers ───────────────────────────────────────────────
  function setMnemonic(kind) {
    document.querySelectorAll('#practice-screen .mnemonic-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.kind === kind);
    });
  }

  function setSpeech(text) {
    const el = document.getElementById('practice-instruction');
    if (el) el.textContent = text;
  }

  function clearHintTimeout() {
    if (hintTimeout) { clearTimeout(hintTimeout); hintTimeout = null; }
  }

  return {
    init, numpadInput, numpadBackspace, showHint,
    get wasTestMode() { return _wasTestMode; },
  };

})();
