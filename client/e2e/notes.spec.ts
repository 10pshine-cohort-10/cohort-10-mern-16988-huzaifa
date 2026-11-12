import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
test('register, write rich text, edit, cancel, search, delete, and sign out', async ({
  page,
}) => {
  const failures: string[] = [];
  page.on('pageerror', (error) => failures.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Your name').fill('Alex Morgan');
  await page
    .getByLabel('Email address')
    .fill('alex-' + Date.now() + '@example.test');
  await page
    .getByLabel('Password', { exact: true })
    .fill('a quiet place for ideas 2026');
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Your notes' })).toBeVisible();
  await page.getByRole('button', { name: 'New note' }).click();
  await page.getByLabel('Note title').fill('A thought worth keeping');
  await page.getByRole('button', { name: 'Bold', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Note content' })
    .fill('Start small. Keep showing up.');
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await page.getByRole('heading', { name: 'A thought worth keeping' }).click();
  await expect(page.locator('.rich-editor strong')).toHaveText(
    'Start small. Keep showing up.',
  );
  await page.getByLabel('Note title').fill('A revised thought');
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'A revised thought' }),
  ).toBeVisible();
  await page.getByRole('heading', { name: 'A revised thought' }).click();
  await page.getByLabel('Note title').fill('Unsaved title');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'A revised thought' }),
  ).toBeVisible();
  await page.getByRole('searchbox').fill('not found');
  await expect(page.getByText('No matching notes')).toBeVisible();
  await page.getByRole('button', { name: 'Clear search' }).click();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'A revised thought' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Delete A revised thought', exact: true })
    .click();
  await page.getByRole('button', { name: 'Delete note', exact: true }).click();
  await expect(
    page.getByText('A little space for your next idea'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(
    page.getByRole('button', { name: 'Sign in', exact: true }),
  ).toBeVisible();
  expect(failures).toEqual([]);
});

test('capture the running application with synthetic notes', async ({
  page,
}) => {
  await mkdir('docs/screenshots', { recursive: true });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'docs/screenshots/login.png', fullPage: true });
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Your name').fill('Alex Morgan');
  await page
    .getByLabel('Email address')
    .fill('screenshots-' + Date.now() + '@example.test');
  await page
    .getByLabel('Password', { exact: true })
    .fill('a quiet place for ideas 2026');
  await page
    .getByRole('button', { name: 'Create account', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Your notes' })).toBeVisible();
  const examples = [
    {
      title: 'A few ideas for a slower morning',
      content:
        '<h2>Start with a little space.</h2><p>A glass of water, an open window, and ten minutes without a screen. Some days, that is enough.</p><ul><li>Make coffee before checking messages</li><li>Write down one thing to look forward to</li></ul>',
    },
    {
      title: 'The weekend list',
      content:
        '<p>Visit the little bookshop on the corner. Find a new walking route. Try that pasta recipe, and leave a little room for doing nothing.</p>',
    },
    {
      title: 'Things I want to learn',
      content:
        '<p>How to grow herbs on the windowsill. How to take better photographs. How to ask a good question and really listen to the answer.</p>',
    },
    {
      title: 'Notes from the reading chair',
      content:
        '<p>You do not need to see the whole staircase to take the first step. A useful reminder to begin before everything feels ready.</p>',
    },
    {
      title: 'A small project, a fresh page',
      content:
        '<p>Keep the first version simple. Build something useful, get feedback, and make it a little better. Progress lives in the small details.</p>',
    },
    {
      title: 'A recipe to come back to',
      content:
        '<p>Roasted tomatoes, fresh basil, and a good pinch of salt. Save a cup of pasta water. Finish with olive oil and plenty of black pepper.</p>',
    },
  ];
  for (const note of examples) {
    const response = await page.request.post('/api/notes', {
      headers: { Origin: 'http://localhost:4179' },
      data: note,
    });
    expect(response.ok()).toBeTruthy();
  }
  await page.reload();
  await expect(
    page.getByRole('heading', { name: examples[0].title }),
  ).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: 'docs/screenshots/dashboard.png',
    fullPage: true,
  });
  await page.getByRole('heading', { name: examples[0].title }).click();
  await expect(
    page.getByRole('textbox', { name: 'Note content' }),
  ).toBeVisible();
  await page.screenshot({
    path: 'docs/screenshots/editor.png',
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: 'docs/screenshots/mobile.png',
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
