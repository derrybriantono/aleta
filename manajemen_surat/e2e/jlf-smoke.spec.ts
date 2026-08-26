import { expect, test } from "@playwright/test";

test("JLF portal, role visibility, and protected routes smoke", async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("login-username").fill("superadmin");
  await page.getByTestId("login-password").fill("super123");
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/portal/);
  await expect(page.getByTestId("hub-module-judicia-legal-form")).toBeVisible();
  await page.getByTestId("hub-module-judicia-legal-form").click();

  await expect(page).toHaveURL(/\/judicia\/legal-form/);
  await expect(page.getByRole("heading", { name: "ALETA Judicia (Legal Form)" })).toBeVisible();
  await expect(page.getByText("Dashboard Operasional")).toBeVisible();
  await expect(page.getByText("Kartu Fitur JLF")).toBeVisible();

  await page.goto("/judicia/legal-form/anonymizer");
  await expect(page.getByRole("heading", { name: "Anonimisasi Dokumen" })).toBeVisible();

  await page.goto("/judicia/legal-form/audit");
  await expect(page.getByRole("heading", { name: "Audit Trail JLF" })).toBeVisible();

  await page.goto("/admin/judicia-legal-form");
  await expect(page.getByRole("heading", { name: "ALETA Judicia (Legal Form)" })).toBeVisible();
  await expect(page.getByText("Tab Pengaturan JLF")).toBeVisible();
});

test("regular JLF user does not see admin settings entry", async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("login-username").fill("ketua");
  await page.getByTestId("login-password").fill("ketua123");
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/portal/);
  await expect(page.getByTestId("hub-module-judicia-legal-form")).toBeVisible();
  await page.getByTestId("hub-module-judicia-legal-form").click();

  await expect(page).toHaveURL(/\/judicia\/legal-form/);
  await expect(page.getByRole("heading", { name: "ALETA Judicia (Legal Form)" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Pengaturan JLF" })).toHaveCount(0);

  await page.goto("/admin/judicia-legal-form");
  await expect(page.getByText("Anda tidak memiliki akses")).toBeVisible();
});
