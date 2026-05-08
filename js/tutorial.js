'use strict';

// ============================================================
// Tutorial — animated step-by-step demonstration
// ============================================================

const Tutorial = (() => {

  let problem = null;
  let stepIndex = 0;
  let autoplayTimer = null;
  let isAutoplaying = false;

  const AUTOPLAY_INTERVAL = 2000; // ms per step

  // ── Public: init ──────────────────────────────────────────
  function init(params = {}) {
    stopAutoplay();
    stepIndex = 0;

    const level = params.level !== undefined ? params.level : App.getCurrentLevel();
    const recent = App.getRecentProblems();
    const { dividend, divisor } = Division.selectProblem(level, recent);
    problem = Division.computeSteps(dividend, divisor);

    // Problem display in header
    const disp = document.getElementById('tutorial-problem-display');
    if (disp) disp.textContent = `${dividend} ÷ ${divisor}`;

    // Render grid (all hidden except given cells)
    const container = document.getElementById('tutorial-grid');
    GridRenderer.render(container, problem, { interactive: false, allVisible: false });

    // Reset mnemonic, speech, answer, counter
    setMnemonic(null);
    setSpeech('「つぎへ」ボタンを押して手順を見てみよう！');
    document.getElementById('tutorial-answer').style.display = 'none';
    updateCounter();
    updateNavButtons();
  }

  // ── Public: nextStep ─────────────────────────────────────
  function nextStep() {
    if (!problem) return;
    const steps = problem.steps;
    if (stepIndex >= steps.length) {
      showAnswer();
      return;
    }
    revealStep(steps[stepIndex]);
    stepIndex++;
    updateCounter();
    updateNavButtons();
    if (stepIndex >= steps.length) showAnswer();
  }

  // ── Public: prevStep ─────────────────────────────────────
  function prevStep() {
    if (!problem || stepIndex <= 0) return;
    // Re-render from scratch and replay up to stepIndex-1
    stepIndex = Math.max(0, stepIndex - 1);
    const container = document.getElementById('tutorial-grid');
    GridRenderer.render(container, problem, { interactive: false, allVisible: false });
    document.getElementById('tutorial-answer').style.display = 'none';

    for (let i = 0; i < stepIndex; i++) {
      revealStep(problem.steps[i], /* animate */ false);
    }
    const lastStep = stepIndex > 0 ? problem.steps[stepIndex - 1] : null;
    setMnemonic(lastStep ? lastStep.kind : null);
    setSpeech(lastStep ? Division.stepExplanation(lastStep, problem.divisor) : '「つぎへ」ボタンを押して手順を見てみよう！');
    updateCounter();
    updateNavButtons();
  }

  // ── Public: toggleAutoplay ───────────────────────────────
  function toggleAutoplay() {
    if (isAutoplaying) {
      stopAutoplay();
    } else {
      startAutoplay();
    }
  }

  function startAutoplay() {
    isAutoplaying = true;
    const btn = document.getElementById('tutorial-autoplay-btn');
    if (btn) btn.textContent = '⏸ ていし';
    autoplayTimer = setInterval(() => {
      if (stepIndex >= problem.steps.length) {
        stopAutoplay();
        showAnswer();
        return;
      }
      nextStep();
    }, AUTOPLAY_INTERVAL);
  }

  function stopAutoplay() {
    isAutoplaying = false;
    clearInterval(autoplayTimer);
    autoplayTimer = null;
    const btn = document.getElementById('tutorial-autoplay-btn');
    if (btn) btn.textContent = '▶ じどう';
  }

  // ── Internal helpers ─────────────────────────────────────

  function revealStep(step, animate = true) {
    const container = document.getElementById('tutorial-grid');
    setMnemonic(step.kind);
    setSpeech(Division.stepExplanation(step, problem.divisor));

    if (step.kind === 'orosu') {
      // Highlight the digit being brought down in the dividend row
      animateOrosu(container, step, animate);
      return;
    }

    // Find and reveal cells for this step
    const cells = GridRenderer.getCellsForStep(container, step, problem);
    cells.forEach(({ el, cell }) => {
      if (cell.value !== null) {
        el.textContent = cell.value;
      }
      if (animate) {
        el.classList.remove('step-reveal', 'step-highlight');
        void el.offsetWidth; // reflow
        el.classList.add('step-reveal');
        setTimeout(() => el.classList.remove('step-reveal'), 600);
      }
    });
  }

  function animateOrosu(container, step, animate) {
    // Highlight the source dividend digit
    const { grid } = problem;
    const rows = grid.length;
    const cols = grid[0].length;

    // Find the dividend cell at digitPos
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c].kind === 'dividend' && c - 1 === step.digitPos) {
          const srcEl = container.querySelector(`[data-row="${r}"][data-col="${c}"]`);
          if (srcEl && animate) {
            srcEl.classList.add('step-highlight');
            setTimeout(() => srcEl.classList.remove('step-highlight'), 800);
          }
        }
      }
    }
  }

  function showAnswer() {
    const ansEl = document.getElementById('tutorial-answer');
    const valEl = document.getElementById('tutorial-answer-val');
    if (!ansEl || !valEl) return;
    const { quotient, remainder } = problem;
    valEl.textContent = remainder > 0
      ? `${quotient} あまり ${remainder}`
      : `${quotient}`;
    ansEl.style.display = '';
    updateNavButtons();
  }

  function setMnemonic(kind) {
    document.querySelectorAll('.mnemonic-pill').forEach(pill => {
      pill.classList.toggle('active', pill.dataset.kind === kind);
    });
  }

  function setSpeech(text) {
    const el = document.getElementById('tutorial-speech');
    if (el) el.textContent = text;
  }

  function updateCounter() {
    const el = document.getElementById('tutorial-step-counter');
    if (!el || !problem) return;
    el.textContent = `ステップ ${stepIndex} / ${problem.steps.length}`;
  }

  function updateNavButtons() {
    const prevBtn = document.getElementById('tutorial-prev-btn');
    const nextBtn = document.getElementById('tutorial-next-btn');
    if (prevBtn) prevBtn.disabled = stepIndex <= 0;
    if (nextBtn) nextBtn.textContent = stepIndex >= (problem ? problem.steps.length : 0)
      ? 'もう一度'
      : 'つぎへ ▶';
    if (nextBtn && stepIndex >= (problem ? problem.steps.length : 0)) {
      nextBtn.onclick = () => init({ level: App.getCurrentLevel() });
    } else if (nextBtn) {
      nextBtn.onclick = nextStep;
    }
  }

  return { init, nextStep, prevStep, toggleAutoplay };

})();
