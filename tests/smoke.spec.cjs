// Смоук-тесты навигатора: грузится без ошибок, шторки, вкладки, поиск, вёрстка.
const { test, expect } = require('@playwright/test');

// Внешние запросы (Telegram SDK, API) режем: тест не зависит от сети.
async function open(page, path = 'app.html') {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  if (!process.env.BASE_URL) await page.route(/^https?:\/\/(?!localhost)/, r => r.abort());
  await page.goto(path);
  await page.waitForLoadState('load');
  return errors;
}

for (const path of ['app.html', 'beta.html', 'app-classic.html', 'index.html']) {
  test(`${path}: грузится без JS-ошибок`, async ({ page }) => {
    const errors = await open(page, path);
    await page.waitForTimeout(1200);
    expect(errors).toEqual([]);
  });
}

for (const width of [360, 320]) {
  test(`нет горизонтальной прокрутки при ширине ${width}`, async ({ page }) => {
    // Известная ошибка: на 320 px быстрые плитки (.b-q) вылезают на 33 px. Убрать test.fail после правки.
    test.fail(width === 320, 'плитки .b-q шире экрана на 320 px');
    await page.setViewportSize({ width, height: 640 });
    await open(page);
    await page.waitForTimeout(800);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('плитка открывает шторку, крестик закрывает', async ({ page }) => {
  await open(page);
  await page.locator('.b-q').first().click();
  const sheet = page.locator('.b-sheet-panel');
  await expect(sheet).toContainText(/Столов/);
  await page.locator('.b-close').click();
  await expect(page.locator('.b-sheet.open')).toHaveCount(0);
});

test('все быстрые плитки открывают непустую шторку', async ({ page }) => {
  await open(page);
  const n = await page.locator('.b-q').count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    await page.locator('.b-q').nth(i).click();
    // «Экскурсия» открывает общую шторку #plusSheet, остальные — шторку подразделения.
    const opened = page.locator('.b-sheet.open, #plusSheet.open');
    await expect(opened).toHaveCount(1);
    if (await page.locator('#plusSheet.open').count()) {
      await expect(page.locator('#plusSheet')).not.toBeEmpty();
      await page.locator('.plus-close').click();
    } else {
      await expect(page.locator('.b-sheet-panel')).not.toBeEmpty();
      await page.locator('.b-close').click();
    }
    await expect(opened).toHaveCount(0);
  }
});

test('вкладка «Свободно» открывает шторку и закрывается', async ({ page }) => {
  await open(page);
  await page.locator('.tab-item[data-tab=free]').click();
  await expect(page.locator('#plusSheet')).toHaveClass(/open/);
  await page.locator('.plus-close').click();
  await expect(page.locator('#plusSheet')).not.toHaveClass(/open/);
});

test('кнопка поиска ставит фокус в поле и показывает подсказки', async ({ page }) => {
  await open(page);
  await page.locator('.tabbar-round').click();
  await expect(page.locator('#searchInput')).toBeFocused();
  await page.locator('#searchInput').fill('столов');
  await expect(page.locator('.suggestions-overlay')).toBeVisible();
});

test('поиск находит столовую', async ({ page }) => {
  await open(page);
  await page.locator('.tabbar-round').click();
  await page.locator('#searchInput').fill('столов');
  await expect(page.locator('.suggestions-overlay')).not.toContainText('Ничего не найдено');
});

test('sw.js — валидный JS', async ({ request }) => {
  const r = await request.get('sw.js');
  expect(r.ok()).toBeTruthy();
  const code = await r.text();
  expect(() => new Function(code)).not.toThrow();
});
