'use strict';

// ============================================================
// Tutorial — animated step-by-step demonstration
// ============================================================

const Tutorial = (() => {

  let problem      = null;
  let stepIndex    = 0;
  let autoTimer    = null;
  let isAutoplay   = false;

  const AUTO_INTERVAL = 2000;

  // ── Public: init ──────────────────────────────────────────
  function init(params = {}) {
    stopAutoplay();
    stepIndex = 0;

    const d = App.getDifficulty();
    const recent = App.getRecentProblems();
    const { dividend, divisor } = Division.selectProblem(d.digits, d.remainder, recent);
    problem = Division.computeSteps(dividend, divisor);

    const dispEl = document.getElementById('tutorial-problem-display');
    if (dispEl) dispEl.textContent = `${dividend} ÷ ${divisor}`;

    const container = document.getElementById('tutorial-grid');
    GridRenderer.render(container, problem, { interactive: false, allVisible: false });

    setMnemonic(null);
    setSpeech('「つぎへ」を押して手順を見てみよう！');
    document.getElementById('tutorial-answer').style.display = 'none';
    updateCounter();
    updateNavButtons();
  }

  // ── Public: nextStep ─────────────────────────────────────
  function nextStep() {
    if (!problem) return;
    if (stepIndex >= problem.steps.length) {
      // Restart
      init();
      return;
    }
    revealStep(problem.steps[stepIndex], true);
    stepIndex++;
    updateCounter();
    updateNavButtons();
    if (stepIndex >= problem.steps.length) showAnswer();
  }

  // ── Public: prevStep ─────────────────────────────────────
  function prevStep() {
    if (!problem || stepIndex <= 0) return;
    stepIndex--;

    const container = document.getElementById('tutorial-grid');
    GridRenderer.render(container, problem, { interactive: false, allVisible: false });
    document.getElementById('tutorial-answer').style.display = 'none';

    for (let i = 0; i < stepIndex; i++) {
      revealStep(problem.steps[i], false);
    }

    const last = stepIndex > 0 ? problem.steps[stepIndex - 1] : null;
    setMnemonic(last ? last.kind : null);
    setSpeech(last ? Division.stepExplanation(last, problem.divisor) : '「つぎへ」を押して手順を見てみよう！');
    updateCounter();
    updateNavButtons();
  }

  // ── Public: toggleAutoplay ───────────────────────────────
  function toggleAutoplay() {
    isAutoplay ? stopAutoplay() : startAutoplay();
  }

  function startAutoplay() {
    isAutoplay = true;
    const btn = document.getElementById('tutorial-autoplay-btn');
    if (btn) { btn.textContent = '⏸ ていし'; btn.classList.add('playing'); }
    autoTimer = setInterval(() => {
      if (stepIndex >= problem.steps.length) { stopAutoplay(); return; }
      nextStep();
    }, AUTO_INTERVAL);
  }

  function stopAutoplay() {
    isAutoplay = false;
    clearInterval(autoTimer);
    autoTimer = null;
    const btn = document.getElementById('tutorial-autoplay-btn');
    if (btn) { btn.textContent = '▶ じどう'; btn.classList.remove('playing'); }
  }

  // ── Internal ─────────────────────────────────────────────

  function revealStep(step, animate) {
    setMnemonic(step.kind);
    setSpeech(Division.stepExplanation(step, problem.divisor));

    const container = document.getElementById('tutorial-grid');
    const cells = GridRenderer.getCellsForStep(container, step, problem);

    cells.forEach(({ el, cell }) => {
      if (cell.value !== null) el.textContent = cell.value;
      if (animate) {
        el.classList.remove('step-reveal');
        void el.offsetWidth;
        el.classList.add('step-reveal');
        setTimeout(() => el.classList.remove('step-reveal'), 600);
      }
    });
  }

  function showAnswer() {
    const ansEl = document.getElementById('tutorial-answer');
    const valEl = document.getElementById('tutorial-answer-val');
    if (!ansEl || !valEl || !problem) return;
    const r = problem.remainder > 0 ? ` あまり ${problem.remainder}` : '';
    valEl.textContent = `${problem.quotient}${r}`;
    ansEl.style.display = '';
    updateNavButtons();
  }

  function setMnemonic(kind) {
    document.querySelectorAll('#tutorial-screen .mnemonic-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.kind === kind);
    });
  }

  function setSpeech(text) {
    const el = document.getElementById('tutorial-speech');
    if (el) el.textContent = text;
  }

  function updateCounter() {
    const el = document.getElementById('tutorial-step-counter');
    if (el && problem) el.textContent = `ステップ ${stepIndex} / ${problem.steps.length}`;
  }

  function updateNavButtons() {
    const prevBtn = document.getElementById('tutorial-prev-btn');
    const nextBtn = document.getElementById('tutorial-next-btn');
    if (prevBtn) prevBtn.disabled = stepIndex <= 0;
    const done = stepIndex >= (problem ? problem.steps.length : 0);
    if (nextBtn) nextBtn.textContent = done ? '▶ もう一度' : 'つぎへ ▶';
  }

  return { init, nextStep, prevStep, toggleAutoplay };

})();
