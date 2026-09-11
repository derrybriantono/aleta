import { expect, test } from "@playwright/test";

// Semaian basis data dalam memori memakan belasan detik pada permintaan
// pertama; tenggat bawaan tiga puluh detik habis sebelum ujinya mulai.
test.setTimeout(180_000);

/*
 * Dua pernyataan dibuang dari berkas ini karena memaku teks yang sudah tidak
 * ada di mana pun pada aplikasinya:
 *
 *   "Status WhatsApp Gateway" - kartu di dasbor berjudul "Ringkasan WhatsApp";
 *   "Preview Audit Trail"     - tidak ada di satu komponen pun.
 *
 * Keduanya membuat uji ini merah sejak entah kapan. Yang menyedihkan bukan
 * pakunya yang usang, melainkan bahwa tidak ada yang tahu: berkas e2e ini
 * berhenti dijalankan orang - lihat catatan pada playwright.config.ts tentang
 * cetakan basis data yang tertinggal - dan uji yang tidak pernah dijalankan
 * tidak pernah berbunyi.
 */
test("credential login and role-based app hub work end-to-end", async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("login-identifier").fill("ketua");
  await page.getByTestId("login-password").fill("ketua123");
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/portal/, { timeout: 60_000 });
  await expect(page.getByTestId("hub-module-manajemen-surat")).toBeVisible();
  await expect(page.getByTestId("hub-module-e-keuangan")).toHaveCount(0);
  await page.getByTestId("hub-module-manajemen-surat").click();

  // /dashboard mengalihkan ke /manajemen-surat, jadi alamat yang berhenti di
  // bilah alamat adalah yang terakhir - bukan yang ditekan.
  await expect(page).toHaveURL(/\/(dashboard|manajemen-surat)/, { timeout: 20_000 });
  await expect(page.getByTestId("sidebar-module-dashboard").last()).toBeVisible();
  await expect(page.getByText("Ringkasan WhatsApp")).toHaveCount(0);

  await page.getByTestId("user-menu").click();
  await page.getByTestId("logout-button").click();

  await page.getByTestId("login-identifier").fill("superadmin");
  await page.getByTestId("login-password").fill("super123");
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/portal/, { timeout: 60_000 });
  await expect(page.getByTestId("hub-module-manajemen-surat")).toBeVisible();
  await expect(page.getByTestId("hub-module-e-keuangan")).toBeVisible();
  await expect(page.getByTestId("hub-module-manajemen-aset")).toBeVisible();
  await page.getByTestId("hub-module-manajemen-surat").click();

  await expect(page).toHaveURL(/\/(dashboard|manajemen-surat)/, { timeout: 20_000 });
  await expect(page.getByText("Ringkasan WhatsApp")).toBeVisible({ timeout: 20_000 });
});
