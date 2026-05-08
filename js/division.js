'use strict';

// ============================================================
// Division Engine — computes all intermediate steps for
// Japanese long division (筆算の割り算) た・か・ひ・お
// ============================================================

const Division = (() => {

  // Problem bank keyed by "${digits}-${remainder?1:0}"
  // 3-digit problems: first digit >= divisor (avoids 0 leading quotient)
  const PROBLEMS = {
    '2-0': [ // 2桁÷1桁 余りなし
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
      { dividend: 84, divisor: 7 },
      { dividend: 96, divisor: 8 },
    ],
    '2-1': [ // 2桁÷1桁 余りあり
      { dividend: 47, divisor: 3 },
      { dividend: 75, divisor: 4 },
      { dividend: 53, divisor: 4 },
      { dividend: 67, divisor: 5 },
      { dividend: 79, divisor: 6 },
      { dividend: 83, divisor: 7 },
      { dividend: 65, divisor: 3 },
      { dividend: 76, divisor: 5 },
      { dividend: 87, divisor: 6 },
      { dividend: 91, divisor: 4 },
    ],
    '3-0': [ // 3桁÷1桁 余りなし (first digit >= divisor)
      { dividend: 369, divisor: 3 },
      { dividend: 248, divisor: 2 },
      { dividend: 963, divisor: 3 },
      { dividend: 864, divisor: 4 },
      { dividend: 555, divisor: 5 },
      { dividend: 396, divisor: 3 },
      { dividend: 639, divisor: 3 },
      { dividend: 842, divisor: 2 },
      { dividend: 682, divisor: 2 },
      { dividend: 936, divisor: 3 },
    ],
    '3-1': [ // 3桁÷1桁 余りあり (first digit >= divisor)
      { dividend: 247, divisor: 2 },
      { dividend: 694, divisor: 3 },
      { dividend: 683, divisor: 2 },
      { dividend: 557, divisor: 5 },
      { dividend: 865, divisor: 4 },
      { dividend: 397, divisor: 3 },
      { dividend: 641, divisor: 3 },
      { dividend: 843, divisor: 2 },
      { dividend: 937, divisor: 3 },
    ],
  };

  /**
   * Compute all た・か・ひ・お steps.
   * Also builds the 2D grid layout for rendering.
   */
  function computeSteps(dividend, divisor) {
    const dividendDigits = String(dividend).split('').map(Number);
    const n = dividendDigits.length;

    const steps = [];
    const quotientDigits = [];
    let running = 0;

    for (let i = 0; i < n; i++) {
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

      const q = Math.floor(running / divisor);
      quotientDigits.push(q);
      steps.push({
        kind: 'tateru',
        digitPos: i,
        value: q,
        currentValue: running,
      });

      const product = q * divisor;
      steps.push({
        kind: 'kakeru',
        digitPos: i,
        value: product,
        quotientDigit: q,
        minuend: running,
      });

      const diff = running - product;
      // isZeroDiff: intermediate zero (diff=0 and not the last round)
      // Students should NOT write this 0 in the grid
      const isZeroDiff = diff === 0 && i < n - 1;
      steps.push({
        kind: 'hiku',
        digitPos: i,
        value: diff,
        minuend: running,
        subtrahend: product,
        isZeroDiff,
      });

      running = diff;
    }

    const quotient = Number(quotientDigits.join(''));
    const remainder = running;
    const grid = buildGrid(dividendDigits, divisor, quotientDigits, steps, remainder);

    return { dividend, divisor, quotient, remainder, steps, grid, dividendDigits, quotientDigits };
  }

  /**
   * Build the 2D grid for the division tableau.
   *
   * Layout per round i (0-indexed):
   *   baseRow = 2 + i*3
   *   baseRow+0: product digits (right-aligned to col i+1)
   *   baseRow+1: subtraction line (always spans cols 1..i+1)
   *   baseRow+2: diff digits + orosu digit (for rounds < last)
   *
   * Rows: 2 (header) + n*3 total
   * Cols: n+1 (col0=divisor, cols1..n=digit positions)
   *
   * KEY: diff row also contains the brought-down digit (orosu)
   * in the next column, matching standard Japanese textbook format.
   */
  function buildGrid(dividendDigits, divisor, quotientDigits, steps, remainder) {
    const n = dividendDigits.length;
    const cols = n + 1;
    const rows = 2 + n * 3;

    // Initialize with empty cells
    const grid = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => ({
        kind: 'empty', value: null, given: false, row: r, col: c,
      }))
    );

    // Row 0: quotient placeholders (revealed by たてる steps)
    for (let i = 0; i < n; i++) {
      grid[0][i + 1] = {
        kind: 'quotient', value: quotientDigits[i], given: false,
        row: 0, col: i + 1, stepKind: 'tateru', digitPos: i,
      };
    }

    // Row 1: divisor (col 0) + dividend digits (cols 1..n)
    grid[1][0] = { kind: 'divisor', value: divisor, given: true, row: 1, col: 0 };
    for (let i = 0; i < n; i++) {
      grid[1][i + 1] = {
        kind: 'dividend', value: dividendDigits[i], given: true, row: 1, col: i + 1,
      };
    }

    // Per-round rows
    for (let i = 0; i < n; i++) {
      const baseRow = 2 + i * 3;
      const product = quotientDigits[i] * divisor;
      const productStr = String(product);
      const productDigits = productStr.split('').map(Number);

      // Product row: right-aligned to col i+1
      const pStartCol = (i + 1) + 1 - productDigits.length; // = i+2-productDigits.length
      productDigits.forEach((d, k) => {
        const c = pStartCol + k;
        if (c >= 1 && c <= i + 1) {
          grid[baseRow][c] = {
            kind: 'product', value: d, given: false,
            row: baseRow, col: c, stepKind: 'kakeru', digitPos: i,
          };
        }
      });

      // Sign column (col 0): × for product rows, − for diff rows
      // Shown as muted operation markers, always visible (given: true)
      grid[baseRow][0] = {
        kind: 'sign_mul', value: '×', given: true, row: baseRow, col: 0,
      };
      grid[baseRow + 2][0] = {
        kind: 'sign_sub', value: '−', given: true, row: baseRow + 2, col: 0,
      };

      // Subtraction line: stored at col i+1, span = i+1 (rendered from col1)
      grid[baseRow + 1][i + 1] = {
        kind: 'line', value: null, given: true,
        row: baseRow + 1, col: i + 1, span: i + 1,
      };

      // Diff row: difference digits right-aligned to col i+1
      const hikuStep = steps.find(s => s.kind === 'hiku' && s.digitPos === i);
      const diff = hikuStep ? hikuStep.value : remainder;
      const isZeroDiff = hikuStep ? hikuStep.isZeroDiff : false;
      const diffStr = String(diff);
      const diffDigits = diffStr.split('').map(Number);
      const dStartCol = (i + 1) + 1 - diffDigits.length;
      diffDigits.forEach((d, k) => {
        const c = dStartCol + k;
        if (c >= 1 && c <= n) {
          grid[baseRow + 2][c] = {
            kind: i < n - 1 ? 'diff' : 'remainder',
            value: d, given: false,
            row: baseRow + 2, col: c,
            stepKind: 'hiku', digitPos: i,
            // isZeroDiff=true → show ghost (中間で0は書かない)
            isZeroDiff,
          };
        }
      });

      // Orosu digit: next dividend digit appears in the diff row (right of diff)
      // This matches the standard Japanese textbook format
      if (i < n - 1) {
        grid[baseRow + 2][i + 2] = {
          kind: 'orosu_digit',
          value: dividendDigits[i + 1],
          given: false,
          row: baseRow + 2, col: i + 2,
          stepKind: 'orosu',
          digitPos: i + 1,
        };
      }
    }

    return grid;
  }

  /**
   * Select a problem by difficulty settings, avoiding recent problems.
   * @param {number} digits - 2 or 3
   * @param {boolean} hasRemainder
   * @param {string[]} recentKeys - e.g. ["48÷4", "69÷3"]
   */
  function selectProblem(digits, hasRemainder, recentKeys = []) {
    const key = `${digits}-${hasRemainder ? 1 : 0}`;
    const pool = PROBLEMS[key] || PROBLEMS['2-0'];
    const available = pool.filter(p => !recentKeys.includes(`${p.dividend}÷${p.divisor}`));
    const source = available.length > 0 ? available : pool;
    return source[Math.floor(Math.random() * source.length)];
  }

  /**
   * Human-readable step explanations in Japanese.
   */
  function stepExplanation(step, divisor) {
    switch (step.kind) {
      case 'tateru':
        return `${step.currentValue} ÷ ${divisor} = ${step.value}　→　${step.value} を書こう！`;
      case 'kakeru':
        return `${divisor} × ${step.quotientDigit} = ${step.value}　→　かけ算をしよう！`;
      case 'hiku':
        if (step.isZeroDiff) {
          return `${step.minuend} − ${step.subtrahend} = 0　ぴったり！　0 はここに書きません`;
        }
        return `${step.minuend} − ${step.subtrahend} = ${step.value}　→　ひき算をしよう！`;
      case 'orosu':
        return `${step.digit} をおろして　${step.runningAfter} にしよう！`;
      default:
        return '';
    }
  }

  return { computeSteps, selectProblem, stepExplanation, PROBLEMS };
})();
