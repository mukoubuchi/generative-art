/**
 * The Ulam spiral: the counting numbers wound counter-clockwise into a square coil, one
 * per grid cell, with 1 at the centre — and then nothing drawn except the primes.
 *
 * Nothing about the layout knows anything about primality, which is what makes the
 * picture surprising: the primes still refuse to look like noise, crowding onto long
 * diagonals. A diagonal of this grid carries the values of a quadratic polynomial —
 * walking one ring further out adds eight more cells to the lap, so along any diagonal
 * the increments grow by a constant 8, which is the signature of a quadratic — and some
 * quadratics are simply rich in primes. The picture is that fact, drawn.
 */

/**
 * Grid positions of 1..count, in spiral order, x rightward and y upward: 1 sits at the
 * origin, 2 one step right, and the walk turns left whenever it can — right 1, up 1,
 * left 2, down 2, right 3, and so on, each pair of legs one step longer.
 */
export function spiralPositions(count) {
  const positions = [];
  let x = 0;
  let y = 0;
  const legs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  let leg = 0;
  let stride = 1;
  positions.push([x, y]);
  while (positions.length < count) {
    for (let pair = 0; pair < 2 && positions.length < count; pair += 1) {
      const [dx, dy] = legs[leg % 4];
      for (let step = 0; step < stride && positions.length < count; step += 1) {
        x += dx;
        y += dy;
        positions.push([x, y]);
      }
      leg += 1;
    }
    stride += 1;
  }
  return positions;
}

/** Primality for every value up to and including limit, by the sieve of Eratosthenes. */
export function sieve(limit) {
  const prime = new Uint8Array(limit + 1).fill(1);
  prime[0] = 0;
  if (limit >= 1) {
    prime[1] = 0;
  }
  for (let candidate = 2; candidate * candidate <= limit; candidate += 1) {
    if (prime[candidate]) {
      for (let multiple = candidate * candidate; multiple <= limit; multiple += candidate) {
        prime[multiple] = 0;
      }
    }
  }
  return prime;
}

/**
 * The spiral's cells as drawable dots: every n from 1 to count with its grid position
 * and whether it is prime. One array, in spiral order, so a page can reveal the numbers
 * the way the spiral lays them down.
 */
export function spiralCells(count) {
  const positions = spiralPositions(count);
  const prime = sieve(count);
  return positions.map(([x, y], index) => ({
    value: index + 1,
    x,
    y,
    prime: prime[index + 1] === 1
  }));
}
