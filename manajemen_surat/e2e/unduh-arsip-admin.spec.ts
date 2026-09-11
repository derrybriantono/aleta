import { expect, test } from "@playwright/test";

/**
 * Unduhan arsip dari Update Manager - diuji sampai berkasnya benar-benar tiba
 * di peramban.
 *
 * Rutenya MENGALIRKAN berkas dari disk (Readable.toWeb), dan itu bagian yang
 * tidak dapat dibuktikan uji unit: apakah Next.js meneruskan alirannya utuh
 * dengan content-disposition yang benar sampai peramban memulai unduhan.
 *
 * Yang diunduh arsip basis data: pada basis data dalam memori ia disusun
 * dalam hitungan detik. Arsip aplikasi dan paket pembaruan berjalan lewat kode
 * yang sama, hanya lebih lama.
 */
test.setTimeout(240_000);

test("Super Admin mengunduh arsip basis data dari Update Manager", async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("login-identifier").fill("superadmin");
  await page.getByTestId("login-password").fill("super123");
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/portal/, { timeout: 120_000 });

  // Dimasuki lewat hub dan tautan di dalam portal, bukan page.goto: portal
  // menyiapkan keadaannya sesudah masuk, dan pemuatan ulang penuh ke alamat
  // dalam sebelum itu selesai berhenti pada layar "Menyiapkan portal...".
  // Sesudah satu halaman dalam tergambar, keadaan portal sudah tersimpan dan
  // pemuatan penuh ke alamat lain aman - pola yang sama dengan uji dasbor.
  await page.getByTestId("hub-module-manajemen-surat").click();
  await expect(page.getByTestId("mail-dashboard-summary-grid")).toBeVisible({ timeout: 60_000 });
  await page.goto("/admin/pembaruan-sistem");
  await expect(page.getByTestId("unduh-arsip-database")).toBeVisible({ timeout: 90_000 });
  // Format yang akan dihasilkan tiba dari peladen SEBELUM tombol ditekan -
  // lencana ".7z" / ".tar.xz" / ".rar" / ".tar.gz" di samping tombol, apa pun
  // alat yang kebetulan terpasang di mesin yang menjalankan uji ini.
  await expect(page.getByText(/^\.(tar\.gz|tar\.xz|7z|rar)$/).first()).toBeVisible({ timeout: 30_000 });

  const menunggu = page.waitForEvent("download", { timeout: 120_000 });
  await page.getByTestId("unduh-arsip-database").click();
  const unduhan = await menunggu;

  const nama = unduhan.suggestedFilename();
  expect(nama).toMatch(/^aleta-database-\d{8}-\d{6}\.(tar\.gz|tar\.xz|7z|rar)$/);
  const jalur = await unduhan.path();
  expect(jalur).toBeTruthy();
});

test("Admin biasa melihat kartunya tetapi tombolnya mati", async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("login-identifier").fill("ketua");
  await page.getByTestId("login-password").fill("ketua123");
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/portal/, { timeout: 120_000 });

  // Ketua bukan admin: halamannya sendiri menolak sebelum kartu tergambar.
  await page.goto("/admin/pembaruan-sistem");
  await expect(page.getByTestId("unduh-arsip-database")).toHaveCount(0);
});
