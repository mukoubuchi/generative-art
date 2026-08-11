import assert from "node:assert/strict";
import test from "node:test";
import { sieve, spiralCells, spiralPositions } from "../artworks/ulam-spiral/spiral.js";

/**
 * Two ingredients, each pinned against numbers that are already known: the walk against
 * the spiral's classical coordinates — the odd squares marching down one diagonal are its
 * standard fingerprint — and the sieve against published prime counts. The one structural
 * fact the artwork depends on, that a diagonal carries a quadratic, is asserted as the
 * constant second difference of 8 rather than trusted to the drawing.
 */
test("the walk lays the first ring where the textbook puts it", () => {
  const positions = spiralPositions(10);
  const expected = [
    [0, 0], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1], [2, -1]
  ];
  assert.deepEqual(positions, expected);
});

test("the squares land on their diagonals", () => {
  const positions = spiralPositions(2000);
  for (let k = 1; (2 * k + 1) ** 2 <= 2000; k += 1) {
    // Odd squares close each ring at the lower-right corner; even squares sit opposite.
    assert.deepEqual(positions[(2 * k + 1) ** 2 - 1], [k, -k]);
    assert.deepEqual(positions[(2 * k) ** 2 - 1], [1 - k, k]);
  }
});

test("a ring never leaves its ring", () => {
  const positions = spiralPositions(841); // 29 * 29, fourteen rings
  for (const [index, [x, y]] of positions.entries()) {
    const ring = Math.ceil((Math.sqrt(index + 1) - 1) / 2);
    assert.ok(Math.max(Math.abs(x), Math.abs(y)) === ring || index === 0,
      `${index + 1} strays outside ring ${ring}`);
  }
});

test("a diagonal carries a quadratic: second differences of 8", () => {
  const positions = spiralPositions(20000);
  const byCell = new Map(positions.map(([x, y], index) => [`${x},${y}`, index + 1]));
  for (const [directionX, directionY] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) {
    const values = [];
    for (let k = 0; k <= 6; k += 1) {
      values.push(byCell.get(`${k * directionX},${k * directionY}`));
    }
    for (let k = 0; k <= 4; k += 1) {
      const secondDifference = values[k + 2] - 2 * values[k + 1] + values[k];
      assert.equal(secondDifference, 8,
        `the ${directionX},${directionY} diagonal is not quadratic at step ${k}`);
    }
  }
});

test("the sieve agrees with the published prime counts", () => {
  const prime = sieve(10000);
  assert.equal(prime[0], 0);
  assert.equal(prime[1], 0);
  assert.equal(prime[2], 1);
  assert.equal(prime[9973], 1, "9973 is the largest prime below ten thousand");
  assert.equal(prime[9991], 0, "9991 is 97 times 103");
  let below100 = 0;
  let below10000 = 0;
  for (let value = 2; value <= 10000; value += 1) {
    below10000 += prime[value];
    if (value < 100) {
      below100 += prime[value];
    }
  }
  assert.equal(below100, 25);
  assert.equal(below10000, 1229);
});

test("the cells carry the walk and the sieve together, in spiral order", () => {
  const cells = spiralCells(50);
  assert.equal(cells.length, 50);
  assert.deepEqual(cells[0], { value: 1, x: 0, y: 0, prime: false });
  assert.deepEqual(cells[1], { value: 2, x: 1, y: 0, prime: true });
  const primes = cells.filter((cell) => cell.prime).map((cell) => cell.value);
  assert.deepEqual(primes, [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47]);
});
