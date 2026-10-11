import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseCsv } from '../lib/csv';

test('parses quoted fields, doubled quotes and CRLF', () => {
  const rows = parseCsv('﻿Title,Note\r\n"Dune, Part Two","A ""great"" film"\r\n\r\nAlien,\n');
  assert.deepEqual(rows, [
    { Title: 'Dune, Part Two', Note: 'A "great" film' },
    { Title: 'Alien', Note: '' },
  ]);
});

test('empty input gives no rows', () => {
  assert.deepEqual(parseCsv(''), []);
});
