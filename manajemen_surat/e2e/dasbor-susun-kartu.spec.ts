import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Menyusun kartu dasbor dengan menahan lalu menggeser.
 *
 * ============================================================================
 * KENAPA INI HARUS UJI PERAMBAN, BUKAN UJI KOMPONEN
 * ============================================================================
 *
 * Seluruh perhitungan seretan bersandar pada getBoundingClientRect: kartu
 * ditukar menurut kotak yang benar-benar terukur di layar. jsdom tidak
 * menghitung tata letak sama sekali - setiap kotak berukuran nol di sana -
 * sehingga uji komponen akan lulus tanpa pernah menyentuh satu pun bagian yang
 * menentukan apakah fiturnya bekerja.
 *
 * Yang diperiksa di sini persis tiga hal yang akan dikeluhkan pengguna bila
 * rusak: kartunya benar-benar berpindah, susunannya masih ada setelah halaman
 * dimuat ulang, dan menekan kartu tanpa menggeser tetap membuka tautannya.
 */

// Masuk lewat basis data dalam memori menyemai seluruh tabel pada permintaan
// pertama, dan itu memakan belasan detik. Tenggat bawaan tiga puluh detik
// habis sebelum ujinya sempat menyentuh dasbor.
test.setTimeout(240_000);

const AKUN = { nama: "ketua", sandi: "ketua123" };

async function masuk(page: Page) {
  await page.goto("/login");
  await page.getByTestId("login-identifier").fill(AKUN.nama);
  await page.getByTestId("login-password").fill(AKUN.sandi);
  await page.getByTestId("login-submit").click();
  // Tenggat panjang dengan sengaja: basis data dalam memori menyemai dirinya
  // pada permintaan pertama, dan itu memakan belasan detik pada mesin kantor.
  await expect(page).toHaveURL(/\/portal/, { timeout: 120_000 });

  // Dimasuki lewat hub, bukan page.goto: portal menyiapkan keadaannya sendiri
  // sesudah masuk, dan menuju alamat dasbor lebih cepat daripada itu membuat
  // halamannya berhenti pada layar "Menyiapkan portal..." - bukan kegagalan
  // dasbornya, melainkan uji yang mendahului aplikasinya.
  // Tiap uji berangkat dari susunan bawaan. Singgahan peramban sudah bersih
  // sendiri - Playwright memberi tiap uji konteks baru - tetapi basis data
  // dalam memori hidup sepanjang satu jalan uji, sehingga susunan yang
  // disimpan uji sebelumnya akan terbawa. Dihapus SEBELUM dasbor terpasang,
  // supaya penata tidak sempat membacanya.
  await page.evaluate(async () => {
    await fetch("/api/dasbor/tata-letak?halaman=manajemen-surat", { method: "DELETE" });
  });

  await page.getByTestId("hub-module-manajemen-surat").click();
  await expect(page.getByTestId("mail-dashboard-summary-grid")).toBeVisible({ timeout: 20_000 });
  // Kotak kartu diukur sekali saat seretan dimulai; tata letak yang masih
  // bergeser sesudah itu membuat ukurannya meleset. Diberi waktu mengendap.
  await page.waitForTimeout(800);
}

/** Urutan kunci kartu menurut yang benar-benar tergambar. */
async function urutanKartu(wadah: Locator) {
  return wadah.locator("[data-kunci-geser]").evaluateAll((node) =>
    node.map((n) => (n as HTMLElement).dataset.kunciGeser ?? "")
  );
}

/**
 * Menahan lalu menggeser satu kartu ke tempat kartu lain.
 *
 * Digerakkan bertahap, bukan satu lompatan: mesin seretnya memutuskan tujuan
 * dari kotak terdekat pada tiap gerakan, dan satu lompatan tunggal tidak
 * mewakili cara tangan bergerak.
 */
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
  // Jeda kecil supaya pointerdown benar-benar terproses sebelum gerakan
  // pertama - tanpa itu, gerakan yang memulai seretan bisa tiba lebih dulu.
  await page.waitForTimeout(60);
  for (let langkah = 1; langkah <= 12; langkah += 1) {
    await page.mouse.move(
      mulaiX + ((akhirX - mulaiX) * langkah) / 12,
      mulaiY + ((akhirY - mulaiY) * langkah) / 12
    );
    await page.waitForTimeout(16);
  }
  // Gerakan terakhir diberi waktu terbaca sebelum dilepas.
  await page.waitForTimeout(120);
  await page.mouse.up();
  // Animasi jatuh 180 md, lalu urutan DOM ditetapkan.
  await page.waitForTimeout(500);
}

test.describe("susunan kartu dasbor", () => {
  test("kartu ringkasan dapat digeser, dan susunannya bertahan setelah dimuat ulang", async ({ page }) => {
    await masuk(page);

    const wadah = page.getByTestId("mail-dashboard-summary-grid");
    const sebelum = await urutanKartu(wadah);
    expect(sebelum.length).toBeGreaterThanOrEqual(4);

    // Kartu pertama digeser ke tempat kartu ketiga.
    await seret(
      page,
      page.getByTestId(`kartu-geser-${sebelum[0]}`),
      page.getByTestId(`kartu-geser-${sebelum[2]}`)
    );

    const sesudah = await urutanKartu(wadah);
    expect(sesudah, "urutannya harus berubah setelah digeser").not.toEqual(sebelum);
    expect(sesudah[2]).toBe(sebelum[0]);
    // Tidak ada kartu yang hilang atau kembar.
    expect([...sesudah].sort()).toEqual([...sebelum].sort());

    // Tersimpan: dimuat ulang harus memulihkan susunan yang sama.
    await page.reload();
    await expect(page.getByTestId("mail-dashboard-summary-grid")).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(async () => urutanKartu(page.getByTestId("mail-dashboard-summary-grid")), { timeout: 5_000 })
      .toEqual(sesudah);
  });

  test("menekan kartu tanpa menggeser tetap membuka tautannya", async ({ page }) => {
    await masuk(page);

    // Yang paling mudah rusak pada fitur seperti ini: kartu berubah menjadi
    // pegangan geser dan berhenti menjadi tautan. Gejalanya tidak berbunyi -
    // hanya kartu yang tidak melakukan apa-apa ketika diklik.
    const wadah = page.getByTestId("mail-dashboard-summary-grid");
    const urutan = await urutanKartu(wadah);
    await page.getByTestId(`kartu-geser-${urutan[0]}`).locator("a").first().click();

    await expect(page).not.toHaveURL(/\/manajemen-surat$/);
  });

  test("tombol kembalikan susunan hanya muncul setelah disusun, dan benar-benar mengembalikan", async ({ page }) => {
    await masuk(page);

    const tombol = page.getByRole("button", { name: /Kembalikan susunan bawaan/i });
    await expect(tombol).toHaveCount(0);

    const wadah = page.getByTestId("mail-dashboard-summary-grid");
    const bawaan = await urutanKartu(wadah);
    await seret(
      page,
      page.getByTestId(`kartu-geser-${bawaan[0]}`),
      page.getByTestId(`kartu-geser-${bawaan[1]}`)
    );
    await expect(tombol).toBeVisible();

    await tombol.click();
    await expect.poll(async () => urutanKartu(wadah), { timeout: 5_000 }).toEqual(bawaan);
    await expect(tombol).toHaveCount(0);
  });

  test("panel besar punya zonanya sendiri dan tidak bercampur dengan kartu ringkasan", async ({ page }) => {
    await masuk(page);

    const ringkasan = await urutanKartu(page.getByTestId("mail-dashboard-summary-grid"));
    const panel = await urutanKartu(page.getByTestId("mail-dashboard-panel-grid"));

    // Zona terpisah: satu kartu angka tidak boleh dapat mendarat di kolom panel
    // lalu meregang setinggi layar.
    for (const kunci of panel) {
      expect(ringkasan, `${kunci} bocor ke zona ringkasan`).not.toContain(kunci);
    }
    expect(panel.length).toBeGreaterThanOrEqual(1);
  });
});
