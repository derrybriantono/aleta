import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Menyusun portal dengan menahan lalu menggeser.
 *
 * ============================================================================
 * KENAPA INI HARUS UJI PERAMBAN
 * ============================================================================
 *
 * Seluruh perhitungan seretan bersandar pada getBoundingClientRect: kartu
 * ditukar menurut kotak yang benar-benar terukur di layar. jsdom tidak
 * menghitung tata letak sama sekali - tiap kotak berukuran nol di sana -
 * sehingga uji komponen akan lulus tanpa menyentuh satu pun bagian yang
 * menentukan apakah fiturnya bekerja.
 *
 * ============================================================================
 * DUA ZONA, DAN ITU YANG PALING MUDAH RUSAK
 * ============================================================================
 *
 * Portal punya kartu besar dan ubin aplikasi di dalam salah satu kartu itu.
 * Bila keduanya jatuh ke zona yang sama, sebuah ubin aplikasi dapat mendarat
 * di antara kartu besar lalu meregang selebar halaman. Uji terakhir di berkas
 * ini yang menjaganya.
 */
test.setTimeout(240_000);

const AKUN = { nama: "ketua", sandi: "ketua123" };

async function masuk(page: Page) {
  await page.goto("/login");
  await page.getByTestId("login-identifier").fill(AKUN.nama);
  await page.getByTestId("login-password").fill(AKUN.sandi);
  await page.getByTestId("login-submit").click();
  // Tenggat panjang dengan sengaja: basis data dalam memori menyemai dirinya
  // pada permintaan pertama, dan itu memakan belasan detik.
  await expect(page).toHaveURL(/\/portal/, { timeout: 120_000 });

  // Tiap uji berangkat dari susunan bawaan. Basis data dalam memori hidup
  // sepanjang satu jalan uji, sehingga susunan yang disimpan uji sebelumnya
  // akan terbawa bila tidak dihapus lebih dulu.
  await page.evaluate(async () => {
    await fetch("/api/dasbor/tata-letak?halaman=portal", { method: "DELETE" });
  });
  await page.reload();

  await expect(page.getByTestId("portal-card-grid")).toBeVisible({ timeout: 60_000 });
  // Kotak kartu diukur sekali saat seretan dimulai; tata letak yang masih
  // bergeser sesudah itu membuat ukurannya meleset.
  await page.waitForTimeout(800);
}

/** Urutan kunci menurut yang benar-benar tergambar. */
async function urutanKartu(wadah: Locator) {
  return wadah
    .locator("> [data-kunci-geser]")
    .evaluateAll((node) => node.map((n) => (n as HTMLElement).dataset.kunciGeser ?? ""));
}

/** Menahan lalu menggeser satu kartu ke tempat kartu lain. */
async function seret(page: Page, dari: Locator, ke: Locator) {
  const kotakAsal = await dari.boundingBox();
  const kotakTujuan = await ke.boundingBox();
  if (!kotakAsal || !kotakTujuan) throw new Error("kartu tidak tergambar");

  const mulaiX = kotakAsal.x + kotakAsal.width / 2;
  const mulaiY = kotakAsal.y + kotakAsal.height / 2;
  const akhirX = kotakTujuan.x + kotakTujuan.width / 2;
  const akhirY = kotakTujuan.y + kotakTujuan.height / 2;

  await page.mouse.move(mulaiX, mulaiY);
  await page.mouse.down();
  await page.waitForTimeout(60);
  for (let langkah = 1; langkah <= 12; langkah += 1) {
    await page.mouse.move(
      mulaiX + ((akhirX - mulaiX) * langkah) / 12,
      mulaiY + ((akhirY - mulaiY) * langkah) / 12
    );
    await page.waitForTimeout(16);
  }
  await page.waitForTimeout(120);
  await page.mouse.up();
  // Animasi jatuh 180 md, lalu urutan DOM ditetapkan.
  await page.waitForTimeout(500);
}

test.describe("susunan portal", () => {
  test("ubin aplikasi dapat digeser, dan susunannya bertahan setelah dimuat ulang", async ({ page }) => {
    await masuk(page);

    const wadah = page.getByTestId("portal-app-grid");
    await expect(wadah).toBeVisible({ timeout: 30_000 });
    const sebelum = await urutanKartu(wadah);
    expect(sebelum.length).toBeGreaterThanOrEqual(3);

    await seret(
      page,
      page.getByTestId(`kartu-geser-${sebelum[0]}`),
      page.getByTestId(`kartu-geser-${sebelum[2]}`)
    );

    const sesudah = await urutanKartu(wadah);
    expect(sesudah, "urutannya harus berubah setelah digeser").not.toEqual(sebelum);
    expect(sesudah[2]).toBe(sebelum[0]);
    // Tidak ada ubin yang hilang atau kembar.
    expect([...sesudah].sort()).toEqual([...sebelum].sort());

    await page.reload();
    await expect(page.getByTestId("portal-app-grid")).toBeVisible({ timeout: 60_000 });
    await expect
      .poll(async () => urutanKartu(page.getByTestId("portal-app-grid")), { timeout: 10_000 })
      .toEqual(sesudah);
  });

  test("menekan ubin tanpa menggeser tetap membuka aplikasinya", async ({ page }) => {
    await masuk(page);

    // Yang paling mudah rusak: ubin berubah menjadi pegangan geser dan berhenti
    // menjadi tautan. Gejalanya tidak berbunyi - hanya ubin yang tidak
    // melakukan apa-apa ketika diklik.
    await page.getByTestId("hub-module-manajemen-surat").click();
    await expect(page).toHaveURL(/\/manajemen-surat/, { timeout: 60_000 });
  });

  test("kartu besar dan ubin aplikasi berada di zona yang berbeda", async ({ page }) => {
    await masuk(page);

    const kartuBesar = await urutanKartu(page.getByTestId("portal-card-grid"));
    const ubin = await urutanKartu(page.getByTestId("portal-app-grid"));

    expect(kartuBesar.length).toBeGreaterThanOrEqual(1);
    expect(ubin.length).toBeGreaterThanOrEqual(1);
    for (const kunci of ubin) {
      expect(kartuBesar, `${kunci} bocor ke zona kartu besar`).not.toContain(kunci);
    }
  });
});
