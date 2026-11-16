// Проверка данных src/data/*.json: структура и связи (адрес корпуса → координаты).
const { test, expect } = require('@playwright/test');
const fs = require('fs'), path = require('path');
const load = (n) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', n + '.json'), 'utf8'));
const hasSrc = fs.existsSync(path.join(__dirname, '..', 'src', 'data'));

test.describe('данные', () => {
  test.skip(!hasSrc, 'нет src/data (проверка собранного сайта)');
  test('подразделения: код, название, уникальные коды', () => {
    const units = load('units');
    expect(units.length).toBeGreaterThan(5);
    for (const u of units) { expect(typeof u.code).toBe('string'); expect(u.name === null || typeof u.name === 'string').toBe(true); }
    expect(new Set(units.map(u => u.code)).size).toBe(units.length);
  });
  test('у каждого известного адреса есть координаты', () => {
    const b = load('buildings'), c = load('coords');
    for (const [code, v] of Object.entries(b)) if (v) expect(c[v.address], `${code}: ${v.address}`).toBeTruthy();
  });
});
