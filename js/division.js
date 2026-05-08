'use strict';

// ============================================================
// Division Engine — computes all intermediate steps for
// Japanese long division (筆算の割り算) た・か・ひ・お
// ============================================================

const Division = (() => {

  // Problem bank — 4 levels
  const PROBLEMS = {
    1: [ // 2桁÷1桁 余りなし
      { dividend: 48, divisor: 4 },
      { dividend: 69, divisor: 3 },
      { dividend: 84, divisor: 4 },
      { dividend: 96, divisor: 3 },
      { dividend: 72, divisor: 6 },
      { dividend: 63, divisor: 3 },
      { dividend: 88, divisor: 8 },
      { dividend: 55, divisor: 5 },
      { dividend: 66, divisor: 6 },
      { dividend: 77, divisor: 7 },
    ],
    2: [ // 2桁÷1桁 余りあり
      { dividend: 47, divisor: 3 },
      { dividend: 75, divisor: 4 },
      { dividend: 53, divisor: 4 },
      { dividend: 67, divisor: 5 },
      { dividend: 79, divisor: 6 },
      { dividend: 83, divisor: 7 },
      { dividend: 59, divisor: 4 },
      { dividend: 71, divisor: 8 },
    ],
    3: [ // 3桁÷1桁 余りなし
      { dividend: 369, divisor: 3 },
      { dividend: 486, divisor: 6 },
      { dividend: 248, divisor: 4 },
      { dividend: 357, divisor: 7 },
      { dividend: 693, divisor: 9 },
      { dividend: 624, divisor: 8 },
      { dividend: 525, divisor: 5 },
      { dividend: 468, divisor: 4 },
    ],
    4: [ // 3桁÷1桁 余りあり
      { dividend: 487, divisor: 6 },
      { dividend: 256, divisor: 7 },
      { dividend: 379, divisor: 5 },
      { dividend: 283, divisor: 9 },
      { dividend: 517, divisor: 8 },
      { dividend: 643, divisor: 7 },
      { dividend: 391, divisor: 6 },
    ],
  };

  /**
   * Compute all た・か・ひ・お steps for a division problem.
   * Also builds the 2D grid layout used for rendering.
   *
   * @param {number} dividend
   * @param {number} divisor
   * @returns {object} problem result with steps[] and grid[][]
   */
  function computeSteps(dividend, divisor) {
    const dividendDigits = String(dividend).split('').map(Number);
    const n = dividendDigits.length; // number of dividend digits

    const steps = [];
    const quotientDigits = [];
    let running = 0;

    for (let i = 0; i < n; i++) {
      // おろす (bring down) — not on first iteration
      if (i > 0) {
        steps.push({
          kind: 'orosu',
          digitPos: i,
          digit: dividendDigits[i],
          runningBefore: running,
          runningAfter: running * 10 + dividendDigits[i],
        });
      }
      running = running * 10 + dividendDigits[i];

      // たてる (estimate quotient digit)
      const q = Math.floor(running / divisor);
      quotientDigits.push(q);
      steps.push({
        kind: 'tateru',
        digitPos: i,
        value: q,
        currentValue: running,
      });

      // かける (multiply)
      const product = q * divisor;
      steps.push({
        kind: 'kakeru',
        digitPos: i,
        value: product,
        quotientDigit: q,
        minuend: running,
      });

      // ひく (subtract)
      const diff = running - product;
      steps.push({
        kind: 'hiku',
        digitPos: i,
        value: diff,
        minuend: running,
        subtrahend: product,
      });

      running = diff;
    }

    const quotient = Number(quotientDigits.join(''));
    const remainder = running;

    // Build the 2D grid
    const grid = buildGrid(dividend, divisor, dividendDigits, quotientDigits, steps, remainder);

    return { dividend, divisor, quotient, remainder, steps, grid, dividendDigits, quotientDigits };
  }

  /**
   * Build 2D grid layout for the division tableau.
   * Grid rows (for 2-digit dividend with 2 rounds):
   *   row 0: quotient digits (given: false, filled by たてる steps)
   *   row 1: [divisor] [bracket-top bar] [dividend digits]
   *   row 2: [space]   [product 1]
   *   row 3: subtraction line
   *   row 4: [space]   [difference / remainder partial]
   *   row 5: [space]   [product 2]  (if 3+ digit)
   *   row 6: subtraction line
   *   row 7: [space]   [final remainder]
   *
   * For N dividend digits there are N rounds × 3 rows (product, line, diff)
   * plus 2 header rows = 2 + N*3 total rows.
   * Columns: 1 (divisor) + N (dividend digits) = N+1.
   *
   * Each cell: { kind, value, given, row, col, stepKind, digitPos, span }
   */
  function buildGrid(dividend, divisor, dividendDigits, quotientDigits, steps, remainder) {
    const n = dividendDigits.length;
    const cols = n + 1; // col 0 = divisor area, cols 1..n = digit columns
    const rows = 2 + n * 3; // header (2) + N rounds of (product, line, diff)

    // Initialize empty grid
    const grid = [];
    for (let r = 0; r < rows; r++) {
      grid.push([]);
      for (let c = 0; c < cols; c++) {
        grid[r].push({ kind: 'empty', value: null, given: false, row: r, col: c });
      }
    }

    // Row 0: quotient digits — columns 1..n, one per dividend digit
    for (let i = 0; i < n; i++) {
      grid[0][i + 1] = {
        kind: 'quotient',
        value: quotientDigits[i],
        given: false,
        row: 0, col: i + 1,
        stepKind: 'tateru',
        digitPos: i,
      };
    }

    // Row 1: divisor in col 0, dividend digits in cols 1..n
    grid[1][0] = { kind: 'divisor', value: divisor, given: true, row: 1, col: 0 };
    for (let i = 0; i < n; i++) {
      grid[1][i + 1] = { kind: 'dividend', value: dividendDigits[i], given: true, row: 1, col: i + 1 };
    }

    // Rounds: for each dividend digit position, fill product row, line, diff row
    for (let i = 0; i < n; i++) {
      const baseRow = 2 + i * 3;
      const product = quotientDigits[i] * divisor;
      const productStr = String(product);

      // Product row — right-aligned within columns 1..i+1
      // product occupies up to (i+1) columns, right-aligned
      const productDigits = productStr.split('').map(Number);
      const startCol = i + 2 - productDigits.length; // right-align to col i+1
      for (let d = 0; d < productDigits.length; d++) {
        const c = startCol + d;
        if (c >= 1 && c <= i + 1) {
          grid[baseRow][c] = {
            kind: 'product',
            value: productDigits[d],
            given: false,
            row: baseRow, col: c,
            stepKind: 'kakeru',
            digitPos: i,
            isLastDigit: d === productDigits.length - 1,
          };
        }
      }
      // Mark whole product span for the step
      grid[baseRow][i + 1].productFull = product;
      grid[baseRow][i + 1].productSpan = productDigits.length;

      // Subtraction line row
      grid[baseRow + 1][i + 1] = {
        kind: 'line',
        value: null,
        given: true,
        row: baseRow + 1, col: i + 1,
        span: i + 1, // span from col 1 to col i+1
      };

      // Difference row
      const diff = i < n - 1
        ? Math.floor(steps.find(s => s.kind === 'hiku' && s.digitPos === i).value)
        : remainder;
      const diffStr = String(diff);
      const diffDigits = diffStr === '0' ? [0] : diffStr.split('').map(Number);
      // Right-align diff within columns 1..i+1
      const diffStartCol = i + 2 - diffDigits.length;
      for (let d = 0; d < diffDigits.length; d++) {
        const c = diffStartCol + d;
        if (c >= 1 && c <= n) {
          grid[baseRow + 2][c] = {
            kind: i < n - 1 ? 'diff' : 'remainder',
            value: diffDigits[d],
            given: false,
            row: baseRow + 2, col: c,
            stepKind: 'hiku',
            digitPos: i,
          };
        }
      }
    }

    return grid;
  }

  /**
   * Select a problem for a given level, avoiding recent problems.
   */
  function selectProblem(level, recentKeys = []) {
    const pool = PROBLEMS[level] || PROBLEMS[1];
    const available = pool.filter(p => !recentKeys.includes(`${p.dividend}÷${p.divisor}`));
    const source = available.length > 0 ? available : pool;
    return source[Math.floor(Math.random() * source.length)];
  }

  /**
   * Generate human-readable explanation for each step kind.
   */
  function stepExplanation(step, divisor) {
    switch (step.kind) {
      case 'tateru':
        return `${step.currentValue} ÷ ${divisor} = ${step.value}　だから、${step.value} をたてるよ！`;
      case 'kakeru':
        return `${divisor} × ${step.quotientDigit} = ${step.value}　かけ算をしよう！`;
      case 'hiku':
        return `${step.minuend} − ${step.subtrahend} = ${step.value}　ひき算をしよう！`;
      case 'orosu':
        return `次の数字 ${step.digit} をおろすよ！`;
      default:
        return '';
    }
  }

  return { computeSteps, selectProblem, stepExplanation, PROBLEMS };
})();
