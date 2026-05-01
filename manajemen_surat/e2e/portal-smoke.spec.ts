import { expect, test } from "@playwright/test";

test("credential login and role-based app hub work end-to-end", async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("login-username").fill("ketua");
  await page.getByTestId("login-password").fill("ketua123");
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/portal/);
  await expect(page.getByTestId("hub-module-manajemen-surat")).toBeVisible();
  await expect(page.getByTestId("hub-module-e-keuangan")).toHaveCount(0);
  await page.getByTestId("hub-module-manajemen-surat").click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByTestId("sidebar-module-dashboard").last()).toBeVisible();
  await expect(page.getByText("Status WhatsApp Gateway")).toHaveCount(0);
  await expect(page.getByText("Preview Audit Trail")).toHaveCount(0);

  await page.getByTestId("user-menu").click();
  await page.getByTestId("logout-button").click();

  await page.getByTestId("login-username").fill("superadmin");
  await page.getByTestId("login-password").fill("super123");
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/portal/);
  await expect(page.getByTestId("hub-module-manajemen-surat")).toBeVisible();
  await expect(page.getByTestId("hub-module-e-keuangan")).toBeVisible();
  await expect(page.getByTestId("hub-module-manajemen-aset")).toBeVisible();
  await page.getByTestId("hub-module-manajemen-surat").click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText("Status WhatsApp Gateway")).toBeVisible();
  await expect(page.getByText("Preview Audit Trail")).toBeVisible();
});
