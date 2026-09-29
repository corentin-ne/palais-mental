import assert from 'node:assert/strict';
import { test } from 'node:test';

import { averageColor } from '../lib/coverColor';

const px = (...rgba: number[][]) => rgba.flat();

test('saturated pixels outweigh a white border', () => {
  const data = px(...Array(8).fill([255, 255, 255, 255]), ...Array(2).fill([200, 30, 30, 255]));
  const hex = averageColor(data)!;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  assert.ok(r > g + 40 && r > b + 40, hex);
});

test('lightness is kept in a readable band', () => {
  const white = averageColor(px([255, 255, 255, 255]))!;
  const black = averageColor(px([0, 0, 0, 255]))!;
  assert.notEqual(white, '#ffffff');
  assert.notEqual(black, '#000000');
  assert.equal(averageColor(px([10, 10, 10, 0])), undefined); // fully transparent
});
