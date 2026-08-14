/**
 * The number words the READMEs write their counts in, so a count can be read back out
 * of prose and held against the thing it claims to count. Shared by the tests that do
 * that, because a second copy of this list would be one more thing to go stale — which
 * is the very failure these tests exist to catch.
 *
 * Not named *.test.mjs, so the runner does not treat it as a suite of its own.
 */
export const NUMBER_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen",
  "eighteen", "nineteen", "twenty", "twenty-one", "twenty-two", "twenty-three",
  "twenty-four", "twenty-five", "twenty-six", "twenty-seven", "twenty-eight",
  "twenty-nine", "thirty", "thirty-one", "thirty-two", "thirty-three",
  "thirty-four", "thirty-five", "thirty-six", "thirty-seven", "thirty-eight",
  "thirty-nine", "forty", "forty-one", "forty-two", "forty-three", "forty-four",
  "forty-five", "forty-six", "forty-seven", "forty-eight", "forty-nine", "fifty"
];
