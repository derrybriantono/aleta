import { expect, test, type Page } from "@playwright/test";

/**
 * ============================================================================
 * LIMA LAYAR YANG PERNAH RUSAK DIAM-DIAM
 * ============================================================================
 *
 * Seluruh rute portal menjawab lewat ok(), yang membungkus muatannya:
 *
 *     { ok: true, data: { ada: true, ... } }
 *
 * Lima layar membaca ruas isinya langsung dari BUNGKUS itu. Akibatnya `ada`
 * selalu undefined, tiap layar jatuh ke cabang gagalnya, dan gagalnya terjadi
 * SETIAP KALI - pada tiap perkara, apa pun isinya - tanpa satu pun galat
 * muncul di mana pun.
 *
 * ============================================================================
 * KENAPA UJI JSDOM TIDAK MENANGKAPNYA, DAN UJI INI MENANGKAP
 * ============================================================================
 *
 * Dua dari lima layar itu PUNYA uji render sendiri, dan keduanya hijau selama
 * cacatnya hidup. Pemalsu fetch di dalamnya memulangkan muatan TELANJANG -
 * bentuk yang tidak pernah dikeluarkan peladen - sehingga uji dan kode sepakat
 * atas dunia yang tidak ada.
 *
 * Uji ini memalsukan JAWABAN HTTP, bukan fungsi fetch. Bungkusnya karena itu
 * ikut dipalsukan apa adanya, dan satu-satunya cara lolos adalah benar-benar
 * membukanya. Pemalsu yang keliru tidak dapat membuat uji ini hijau.
 *
 * ============================================================================
 * YANG DIPERIKSA: KALIMAT GAGALNYA TIDAK BOLEH MUNCUL
 * ============================================================================
 *
 * Bukan isi yang tergambar, melainkan KETIADAAN kalimat gagal masing-masing
 * layar. Itu disengaja: bentuk muatan tiap rute panjang dan berubah-ubah, dan
 * uji yang mengunci seluruh bentuknya akan gagal tiap kali ada ruas baru -
 * gagal atas perubahan yang benar. Yang tidak boleh berubah cuma satu: layar
 * yang menerima jawaban BERHASIL tidak boleh berkata gagal.
 */

/** Akun semaian - sama dengan yang dipakai portal-smoke. */
async function masuk(page: Page) {
  await page.goto("/login");
  await page.getByTestId("login-identifier").fill("ketua");
  await page.getByTestId("login-password").fill("ketua123");
  await page.getByTestId("login-submit").click();
  await expect(page).toHaveURL(/\/portal/);
}

/** Menjawab satu rute dengan bungkus { ok, data } yang sebenarnya. */
async function jawabTerbungkus(page: Page, pola: string, muatan: unknown) {
  await page.route(pola, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: muatan }),
    });
  });
}

test.describe("layar membaca isi jawaban, bukan bungkusnya", () => {
  test("Ruang Perkara menemukan perkara yang dijawab peladen", async ({ page }) => {
    await masuk(page);

    await jawabTerbungkus(page, "**/api/aleta-ecourt/berkas-perkara**", {
      ada: true,
      berkas: {
        perkaraId: "10510",
        nomorPerkara: "510/Pdt.G/2026/PA.Dgl",
        jenisPerkara: "Cerai Gugat",
      },
    });

    await page.goto("/perkara");

    const kotak = page.getByPlaceholder(/nomor perkara/i).first();
    await kotak.fill("510/Pdt.G/2026/PA.Dgl");
    await kotak.press("Enter");

    // Dengan cacatnya, pencarian ini SELALU berakhir begini - sekalipun
    // perkaranya ada dan peladen menjawab dengan benar.
    await expect(page.getByText("Perkara tidak ditemukan.")).toHaveCount(0);
    await expect(page.getByText("510/Pdt.G/2026/PA.Dgl").first()).toBeVisible();
  });

  test("Isian Kelas B menampilkan isian yang dijawab peladen", async ({ page }) => {
    await masuk(page);

    await jawabTerbungkus(page, "**/api/aleta-ecourt/isian**", {
      ada: true,
      kelompok: [
        {
          kode: "pernikahan",
          nama: "Keterangan pernikahan (isbat nikah)",
          urutan: 1,
          jumlahTerisi: 1,
          butir: [
            {
              noVar: "1001",
              nama: "Mas kawin",
              kelompok: "pernikahan",
              nilai: "seperangkat alat shalat",
              diisiOleh: "panitera",
              diisiAt: "2026-09-07T02:00:00.000Z",
              jumlahPakai: 221,
            },
          ],
        },
      ],
      ringkas: { jumlah: 1, terisi: 1, kosong: 0, kalimat: "1 dari 1 isian sudah terisi." },
    });

    await jawabTerbungkus(page, "**/api/aleta-ecourt/berkas-perkara**", {
      ada: true,
      berkas: { perkaraId: "10510", nomorPerkara: "510/Pdt.G/2026/PA.Dgl" },
    });

    await page.goto("/perkara");
    const kotak = page.getByPlaceholder(/nomor perkara/i).first();
    await kotak.fill("510/Pdt.G/2026/PA.Dgl");
    await kotak.press("Enter");

    // Kalimat ini muncul pada perkara MANA PUN selama cacatnya hidup.
    await expect(page.getByText("Isian tidak terbaca.")).toHaveCount(0);
  });

  test("Rujukan Pasal menemukan pasal yang dijawab pustaka", async ({ page }) => {
    await masuk(page);

    await jawabTerbungkus(page, "**/api/aleta-ecourt/pustaka/peraturan**", {
      ada: true,
      bagian: {
        jangkar: "uu-1-1974-pasal-39",
        judul: "Pasal 39",
        isi: "Perceraian hanya dapat dilakukan di depan sidang Pengadilan.",
        peraturan: "UU 1 Tahun 1974",
      },
    });

    await jawabTerbungkus(page, "**/api/aleta-ecourt/berkas-perkara**", {
      ada: true,
      berkas: { perkaraId: "10510", nomorPerkara: "510/Pdt.G/2026/PA.Dgl" },
    });

    await page.goto("/perkara");
    const kotak = page.getByPlaceholder(/nomor perkara/i).first();
    await kotak.fill("510/Pdt.G/2026/PA.Dgl");
    await kotak.press("Enter");

    // Selama cacatnya hidup, TIAP rujukan pasal berbunyi begini - dan draf
    // yang mengutipnya karena itu terbaca tidak dapat ditandatangani.
    await expect(page.getByText(/belum ada di pustaka hukum/)).toHaveCount(0);
  });

  test("Blangko Mandiri menampilkan statistik yang dijawab peladen", async ({ page }) => {
    await masuk(page);

    await jawabTerbungkus(page, "**/api/aleta-ecourt/kamus**", {
      statistik: { jumlahVariabel: 812, jumlahKelasA: 300, jumlahKelasB: 512 },
    });
    await jawabTerbungkus(page, "**/api/aleta-ecourt/korpus**", {
      statistik: { jumlahBerkas: 812, jumlahBlok: 4120 },
      pergeseran: [],
    });
    await jawabTerbungkus(page, "**/api/aleta-ecourt/blangko-aleta**", { blangko: [] });

    await page.goto("/admin/blangko-mandiri");

    // Dengan cacatnya, SELURUH layar ini kosong - statistik kamus, statistik
    // korpus, dan daftar blangkonya sekaligus - sebab ketiganya membaca
    // bungkus lewat satu pembantu yang sama.
    await expect(page.getByText("812").first()).toBeVisible();
  });

  test("Status Perkara tidak jatuh saat menyusun perintah putusan", async ({ page }) => {
    await masuk(page);

    await jawabTerbungkus(page, "**/api/aleta-ecourt/status-perkara**", {
      available: true,
      status: {
        nomorPerkara: "510/Pdt.G/2026/PA.Dgl",
        perkaraId: "10510",
        tahapan: [],
      },
    });

    const galatPeramban: string[] = [];
    page.on("pageerror", (galat) => galatPeramban.push(String(galat.message || galat)));

    await page.goto("/aleta-ecourt");

    // Cacatnya bukan tampilan yang keliru melainkan layar yang JATUH: satu
    // ruas dibaca dari bungkus, undefined, lalu dipakai - dan seluruh
    // halaman berhenti tergambar.
    expect(galatPeramban, galatPeramban.join(" | ")).toEqual([]);
  });
});
