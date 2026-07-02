import { test, expect } from '@playwright/test';

test('landing page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/FineSuggest/i);
});

test('unauthenticated /chat redirects to /login', async ({ page }) => {
  await page.goto('/chat');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('button', { name: /đăng nhập với google/i })).toBeVisible();
});
