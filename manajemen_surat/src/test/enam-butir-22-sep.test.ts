// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { sebabBerbauMediasi, sidangBerbauMediasi } from "@/lib/mediasi-sidang";
import { sebabMinutasiTertahan } from "@/lib/sebab-minutasi-tertahan";

/**
 * ============================================================================
 * ENAM PERMINTAAN 22 SEPTEMBER 2026
 * ============================================================================
 *
 *   2. Tombol Mediator di samping Tunda/Putus, hanya pada sidang bermediasi
 *   3. "perkara_id belum disebut." pada unggah putusan
 *   4. Saklar meminimalkan keterangan panjang di panel ekstensi
 *   5. Berkas jawab-menjawab e-Court yang tidak pernah terlihat
 *   6. Sebab minutasi menyebut sidang keberapa dan agendanya
 *
 * Butir 1 punya berkasnya sendiri: putusan-status-lain.test.ts.
 */

const akar = path.resolve(process.cwd(), "..");
const baca = (jalur: string) =>
  readFileSync(path.join(akar, jalur), "utf8").replace(/\r\n/g, "\n");

const layar = baca("manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx");
const ruteUnggah = baca(
  "manajemen_surat/src/app/api/aleta-ecourt/putusan/unggah-sipp/route.ts"
);
const konten = baca("ekstensi-sipp/konten.js");
const alat = baca("ekstensi-sipp/panel-alat.js");
const gaya = baca("ekstensi-sipp/panel.css");
const konteksBot = baca("aleta_bot/services/sippKonteksService.js");

// ===========================================================================
// BUTIR 2 - MEDIATOR
// ===========================================================================

describe("butir 2 - tombol Mediator", () => {
  /**
   * Tulisan yang BENAR-BENAR ADA di perkara_jadwal_sidang satker, beserta
   * jumlahnya. Ejaannya bebas dan banyak salah ketik; pola berbatas kata
   * membuang sebagian darinya, dan yang terbuang itu tidak berbunyi apa pun -
   * tombolnya sekadar tidak muncul.
   */
  const SUNGGUHAN = [
    "Proses Mediasi",
    "Mediasi para pihak",
    "Mediasi",
    "proses mediasi",
    "peroses mediasi",
    "Upaya Mediasi",
    "Mediasi Lanjutan",
    "Perdamaian/Mediasi",
    "Pembacaan Hasil Mediasi",
    "Laporan hasil mediasi",
    "Peoses Mediasi",
    "Proses Mediasin",
  ];

  it("kedua belas tulisan yang sungguh ada dikenali", () => {
    for (const teks of SUNGGUHAN) {
      expect(sidangBerbauMediasi(teks, ""), `agenda "${teks}" tidak dikenali`).toBe(true);
      expect(sidangBerbauMediasi("", teks), `alasan tunda "${teks}" tidak dikenali`).toBe(true);
    }
  });

  it("AGENDA ikut dibaca, bukan alasan tunda saja", () => {
    // Diukur: 841 baris menyebut mediasi pada alasan_ditunda, 619 pada agenda,
    // 1.407 pada salah satunya. Membaca alasan tundanya saja melewatkan 566
    // baris - lebih dari sepertiga - dan yang terlewat justru sidang yang
    // agendanya memang mediasi.
    expect(sidangBerbauMediasi("Proses Mediasi", "")).toBe(true);
    expect(layar).toContain("sidangBerbauMediasi(baris.agenda, baris.alasanDitunda)");
  });

  it("bendera ditunda TIDAK disyaratkan", () => {
    // 28 baris beragenda "Mediasi" dan 21 baris "proses mediasi" berbendera
    // 'T'. Mensyaratkan tundanya membuat tombolnya tidak pernah muncul di sana.
    const i = layar.indexOf("sidangBerbauMediasi(baris.agenda, baris.alasanDitunda)");
    const blok = layar.slice(Math.max(0, i - 200), i + 200);
    expect(blok).not.toContain("baris.ditunda &&");
  });

  it("yang TIDAK berhubungan mediasi tetap diam", () => {
    for (const teks of ["Pembacaan Putusan", "Panggil Tergugat", "0", "", "Jawaban Tergugat"]) {
      expect(sidangBerbauMediasi(teks, ""), `"${teks}" seharusnya diam`).toBe(false);
    }
  });

  it("sebabnya dapat disebut - supaya tombol yang muncul tiba-tiba terjelaskan", () => {
    expect(sebabBerbauMediasi("Proses Mediasi", "")).toContain('agenda "Proses Mediasi"');
    expect(sebabBerbauMediasi("", "Laporan Hasil Mediasi")).toContain("alasan tunda");
    expect(sebabBerbauMediasi("Pembacaan Putusan", "")).toBe("");
  });

  it("tidak menjanjikan yang belum ada - penunjukan mediator masih di SIPP", () => {
    // Diperiksa di seluruh repositori: tidak ada satu pun jalur yang menulis
    // penetapan mediator ke SIPP. Tombol yang berpura-pura dapat menunjuknya
    // membuat petugas berhenti mengerjakannya di SIPP.
    const i = layar.indexOf("function TombolMediator(");
    expect(i, "komponennya tidak ada").toBeGreaterThan(-1);
    const blok = layar.slice(i, layar.indexOf("function NomorSidang(", i));
    expect(blok).toContain("masih ditulis di SIPP");
    expect(blok).toContain("belum ada jalur yang menuliskannya");
  });

  it("memakai bg-card, bukan bg-popover", () => {
    // Token popover tidak ada pada tema ini; menu yang memakainya tembus
    // pandang dan tulisan di baliknya ikut terbaca.
    const i = layar.indexOf("function TombolMediator(");
    const blok = layar.slice(i, layar.indexOf("function NomorSidang(", i));
    expect(blok).toContain("bg-card");
    // Yang diperiksa PEMAKAIANNYA, bukan penyebutannya: catatan di atas
    // kodenya memang menyebut bg-popover untuk menerangkan mengapa ia tidak
    // dipakai, dan penjaga yang melarang katanya melarang keterangannya juga.
    expect(blok, "bg-popover dipakai pada className").not.toMatch(
      /className=(?:"|\{cn\()[^>]*bg-popover/
    );
  });
});

// ===========================================================================
// BUTIR 3 - perkara_id
// ===========================================================================

describe("butir 3 - unggah putusan yang selalu ditolak", () => {
  it("perkaraId kosong TIDAK lagi langsung ditolak", () => {
    // perkaraIdDariHalaman() membaca input[name="perkara_id"] di dalam
    // #frm_putusan, dan medan itu TIDAK PERNAH ADA di halaman perkara agama:
    // SIPP mengenali perkara pada borang putusan lewat `enc`. Jadi rute ini
    // menolak SETIAP unggahan dari halaman itu, tanpa kecuali.
    expect(ruteUnggah, "penolakan lama masih ada").not.toContain(
      'if (!perkaraId) return ok({ ok: false, sebab: "perkara_id belum disebut." });'
    );
    expect(ruteUnggah).toContain("getGatewayStatusPerkara(nomorPerkara)");
  });

  it("nomor perkara diperiksa LEBIH DULU", () => {
    const iNomor = ruteUnggah.indexOf('sebab: "Nomor perkara belum disebut."');
    const iTanya = ruteUnggah.indexOf("getGatewayStatusPerkara(nomorPerkara)");
    expect(iNomor).toBeGreaterThan(-1);
    expect(iTanya).toBeGreaterThan(iNomor);
  });

  it("bot mati DIBEDAKAN dari perkara yang tidak ada", () => {
    // Menyamakannya mengirim petugas memeriksa nomor perkaranya - yang sudah
    // benar - sementara yang perlu diperiksa sambungan botnya.
    expect(ruteUnggah).toContain("if (!status.ok)");
    expect(ruteUnggah).toContain("ALETA Bot belum dapat dihubungi");
    expect(ruteUnggah).toContain("tidak ditemukan di SIPP");
  });

  it("ekstensi menolak yang bukan PDF SEBELUM mengirim", () => {
    // Bot menolak apa pun yang empat bita pertamanya bukan "%PDF". Atribut
    // accept pada pemilih berkas hanya SARAN - yang memilih "All files" tetap
    // dapat memilih .rtf, dan itulah yang terjadi.
    expect(konten).toContain("bukanPdf");
    expect(konten).toContain("bukan PDF");
    expect(konten).toContain("Simpan naskahnya sebagai PDF lebih dulu");
  });

  it("komentar perkaraIdDariHalaman menyebut kenyataannya", () => {
    // Andaian lama - "borang Putusan Akhir harus membawanya" - yang membuat
    // cacat ini bertahan berbulan-bulan tanpa ada yang mencurigainya.
    const i = konten.indexOf("function perkaraIdDariHalaman()");
    const blok = konten.slice(Math.max(0, i - 2200), i);
    expect(blok).toContain("SELALU KOSONG");
    expect(blok).toContain("`enc`");
    expect(blok, "andaian lama masih tertulis").not.toContain(
      "Borang Putusan Akhir harus membawanya"
    );
  });
});

// ===========================================================================
// BUTIR 4 - PANEL RINGKAS
// ===========================================================================

describe("butir 4 - saklar meminimalkan keterangan", () => {
  it("pilihannya tersimpan dan berlaku di seluruh tab", () => {
    expect(alat).toContain('const ALAT_RINGKAS_KUNCI = "panelRingkas"');
    expect(alat).toContain("chrome.storage.onChanged.addListener");
    expect(alat).toContain("alatDengarkanRingkas()");
    expect(alat).toContain("void alatMuatRingkas()");
  });

  it("bawaannya MATI", () => {
    // Yang belum pernah menyalakannya tidak boleh kehilangan keterangan yang
    // tidak pernah ia minta dihilangkan.
    expect(alat).toContain("let alatRingkasNyalaKini = false;");
    const i = alat.indexOf("async function alatMuatRingkas()");
    const blok = alat.slice(i, alat.indexOf("function alatDengarkanRingkas()", i));
    expect(blok).toContain("terbaca = false;");
  });

  it("SELURUH tombolnya disegarkan, bukan yang ditekan saja", () => {
    // Satu halaman dapat memuat lebih dari satu panel; tombol yang tidak ikut
    // disegarkan menunjukkan keadaan yang berlawanan dengan yang berlaku.
    expect(alat).toContain("function alatSegarkanTombolRingkas()");
    expect(alat).toContain('document.querySelectorAll(".aleta-kaki-ringkas")');
  });

  it("tombolnya di SEBELUM pintasan, supaya tidak terdorong ke kanan", () => {
    // .aleta-kaki-pintasan memegang margin-right otomatis yang mendorong ikon
    // segarkan dan nomor versi ke kanan. Tombol sesudahnya ikut ke sana.
    const i = alat.indexOf("function alatBarisPintasan(daftar)");
    const blok = alat.slice(i, alat.indexOf("return bungkus;", i));
    const iTombol = blok.indexOf("alatTombolRingkas()");
    const iPintasan = blok.indexOf("bungkus.appendChild(pintasan)");
    expect(iTombol).toBeGreaterThan(-1);
    expect(iPintasan).toBeGreaterThan(iTombol);

    // Panel SIPP menyusun kakinya sendiri - urutannya harus sama di sana.
    const j = konten.indexOf("const bungkusKiri =");
    expect(j, "kaki panel SIPP belum dipasangi").toBeGreaterThan(-1);
    const blokSipp = konten.slice(j, j + 400);
    expect(blokSipp.indexOf("alatTombolRingkas()")).toBeLessThan(
      blokSipp.indexOf("bungkusKiri.appendChild(pintasan)")
    );
  });

  it("pembungkusnya display:contents - dorongan margin tidak berpindah", () => {
    expect(gaya).toContain(".aleta-kaki-baris .aleta-kaki-kiri {");
    const i = gaya.indexOf(".aleta-kaki-baris .aleta-kaki-kiri {");
    expect(gaya.slice(i, i + 120)).toContain("display: contents");
  });

  it("TIDAK menyembunyikan .aleta-tetap-sebab telanjang", () => {
    // Kelas itu bermuka dua: separuh pemakaiannya kotak kabar yang lahir
    // kosong lalu diisi pesan galat. Menyembunyikannya membuat panel DIAM
    // ketika sesuatu gagal - penetapan yang tidak tersimpan akan tampak
    // seperti tidak terjadi apa-apa.
    expect(gaya).not.toMatch(/data-aleta-ringkas="ya"\]\s+\.aleta-tetap-sebab\s*[,{]/);
    expect(gaya).toContain('html[data-aleta-ringkas="ya"] .aleta-remeh');
  });

  it("tiap pemilihnya dijangkar pada kelas .aleta-", () => {
    // Penandanya dipasang di documentElement halaman SIPP/ABT - halaman milik
    // aplikasi lain. Pemilih yang tidak berjangkar dapat menyembunyikan
    // elemen SIPP.
    const i = gaya.indexOf('html[data-aleta-ringkas="ya"]');
    // Sampai KURUNG BUKANYA, bukan sampai kurung tutup: yang diperiksa daftar
    // pemilihnya, dan isi aturannya akan menempel pada pemilih terakhir.
    const blok = gaya.slice(i, gaya.indexOf("{", i));
    for (const pemilih of blok.split(",")) {
      const bersih = pemilih.trim();
      if (!bersih) continue;
      expect(bersih, `pemilih tanpa jangkar: ${bersih}`).toMatch(/\.aleta-[a-z-]+\s*$/);
    }
  });

  it("kotak kabar TIDAK ikut ditandai remeh", () => {
    // Percobaan otomatis pertama menandai seluruh teks harfiah dan menelan
    // kotak kabar bersamanya. Kelima ini yang paling mudah kembali tertandai.
    for (const baris of [
      'const kabar = buatElemen("span", "aleta-tetap-sebab", "")',
      'const kabar = buatElemen("div", "aleta-tetap-sebab", "")',
      'Memeriksa formulir di halaman ini',
      'Pilih berkas gugatan untuk dibaca.',
    ]) {
      const i = konten.indexOf(baris);
      if (i < 0) continue;
      const awalBaris = konten.lastIndexOf("\n", i) + 1;
      const isiBaris = konten.slice(awalBaris, konten.indexOf("\n", i));
      expect(isiBaris, `kotak kabar ikut ditandai: ${baris}`).not.toContain("aleta-remeh");
    }
  });

  it("kalimat yang disebut pengguna MEMANG ditandai", () => {
    const i = konten.indexOf("Putusan akhir dan anonimisasinya diunggah sekaligus");
    expect(i).toBeGreaterThan(-1);
    const blok = konten.slice(Math.max(0, i - 260), i);
    expect(blok).toContain("aleta-tetap-sebab aleta-remeh");
  });
});

// ===========================================================================
// BUTIR 5 - BERKAS JAWAB-MENJAWAB
// ===========================================================================

describe("butir 5 - berkas jawab-menjawab yang tidak pernah terlihat", () => {
  it("adaPdf/adaWord dibaca dari TABEL BERKAS, bukan kolom cermin", () => {
    // Kolom cermin berkas_pdf/berkas_word terisi pada 23 dan 8 dari 394
    // dokumen, sementara aleta_bot_ecourt_files mencatat 400 berkas. Tombol
    // unduhnya digantungkan pada angka itu - jadi berkas jawab-menjawab
    // tampak tidak pernah ada, padahal sudah lama terunduh.
    const i = konteksBot.indexOf("async function dokumenPerkara(");
    expect(i).toBeGreaterThan(-1);
    const blok = konteksBot.slice(i, konteksBot.indexOf("\n}", i));
    expect(blok).toContain("FROM aleta_bot_ecourt_files");
    expect(blok).toContain('adaBerkas.has(`${row.document_key}|pdf`)');
    expect(blok).toContain('adaBerkas.has(`${row.document_key}|word`)');
  });

  it("keberadaan berkasnya di cakram DIBUKTIKAN, bukan diandaikan", () => {
    // Yang dijanjikan tombol harus benar-benar dapat diunduh.
    const i = konteksBot.indexOf("async function dokumenPerkara(");
    const blok = konteksBot.slice(i, konteksBot.indexOf("\n}", i));
    expect(blok).toContain("describeEcourtDocument(jalur)");
    expect(blok).toContain("berkasHilang");
  });

  it("tercatat-tetapi-hilang dibedakan dari tidak pernah ada", () => {
    // Tindakannya berbeda: yang satu menyuruh memeriksa arsipnya, yang lain
    // menyuruh pihak mengunggah. Arsip e-Court pernah lenyap seluruhnya di
    // sini karena volume Docker belum di-mount.
    expect(konten).toContain("tercatat ada, berkasnya hilang dari arsip");
    expect(konten).toContain("berkas belum tersimpan");
  });

  it("dokumen dipisah: jawab-menjawab lebih dulu, pendaftaran sesudahnya", () => {
    const i = konten.indexOf('const pendaftaran = (konteks.dokumen || [])');
    expect(i).toBeGreaterThan(-1);
    const blok = konten.slice(i, i + 900);
    expect(blok).toContain('statusVerifikasi === "tidak_perlu"');
    expect(blok.indexOf("Berkas jawab-menjawab")).toBeLessThan(
      blok.indexOf("Berkas pendaftaran")
    );
  });

  it("kepala kelompok hanya digambar bila KEDUANYA ada", () => {
    // Satu judul di atas satu-satunya kelompok tidak menerangkan apa pun.
    const i = konten.indexOf("const berurut = [");
    const blok = konten.slice(i, i + 1400);
    expect(blok).toContain("pendaftaran.length > 0 && persidangan.length > 0");
  });

  it("memakai kelas tulisan biasa, bukan kepala kelompok yang dapat diklik", () => {
    // .aleta-kelompok-judul adalah tombol selebar panel yang melipat isinya;
    // memakainya di sini menjanjikan lipatan yang tidak ada.
    expect(konten).toContain('"aleta-sub-judul"');
    expect(gaya).toContain(".aleta-sub-judul {");
  });

  it("agenda rekonvensi didahulukan atas agenda konvensinya", () => {
    // Daftar dibaca berurutan. "Duplik Rekonvensi" juga cocok /\bduplik\b/,
    // jadi berkas konvensi dan rekonvensi tertukar bila urutannya terbalik -
    // dan tertukarnya tidak berbunyi: kotaknya tetap terisi.
    const i = konten.indexOf("const TAHAPAN_BERKAS = [");
    const blok = konten.slice(i, konten.indexOf("];", i));
    for (const pasang of [
      ["duplik\\s+rekonvensi", "\\bduplik\\b"],
      ["jawaban\\s+rekonvensi", "\\bjawaban\\b"],
      ["kesimpulan\\s+rekonvensi", "\\bkesimpulan\\b"],
    ]) {
      expect(blok.indexOf(pasang[0]), `${pasang[0]} hilang`).toBeGreaterThan(-1);
      expect(blok.indexOf(pasang[0])).toBeLessThan(blok.indexOf(pasang[1]));
    }
  });

  it("saklar sisipan yang mati sejak awal DISEBUTKAN", () => {
    // ALETA sudah lama dapat menempelkan berkasnya ke baris Jadwal Sidang di
    // samping Unggah BAS - tetapi saklarnya mati dan tidak ada yang
    // menyebutkannya. Fitur yang tidak diketahui sama dengan fitur yang
    // tidak ada.
    expect(konten).toContain("persidangan.length > 0 && !saklar.sisipJadwal");
    expect(konten).toContain("Sisipkan berkas ke Jadwal Sidang");
  });
});

// ===========================================================================
// BUTIR 6 - SEBAB MINUTASI
// ===========================================================================

describe("butir 6 - sebab minutasi menyebut sidang mana", () => {
  const dasar = {
    sudahPutus: true,
    tanggalPutusan: "2026-06-10",
    tanggalMinutasi: "",
    adaBerkasPutusan: true,
    adaBerkasAnonim: true,
  };

  it("menyebut sidang keberapa dan agendanya", () => {
    const hasil = sebabMinutasiTertahan({
      ...dasar,
      jadwal: [
        { adaBas: true, tanggalSidang: "2026-03-03", agenda: "Sidang Pertama", urutanSidang: 1 },
        { adaBas: false, tanggalSidang: "2026-05-05", agenda: "Kesimpulan", urutanSidang: 4 },
      ],
    });
    const bas = hasil.find((x) => x.kunci === "bas");
    expect(bas, "butir bas tidak ada").toBeTruthy();
    expect(bas?.rincian).toHaveLength(1);
    expect(bas?.rincian?.[0].label).toBe("Sidang ke-4");
    expect(bas?.rincian?.[0].catatan).toContain("Kesimpulan");
    expect(bas?.rincian?.[0].catatan).toContain("5 Mei 2026");
  });

  it("yang SUDAH punya BAS tidak ikut disebut", () => {
    const hasil = sebabMinutasiTertahan({
      ...dasar,
      jadwal: [
        { adaBas: true, tanggalSidang: "2026-03-03", agenda: "Sidang Pertama", urutanSidang: 1 },
        { adaBas: false, tanggalSidang: "2026-05-05", agenda: "Kesimpulan", urutanSidang: 4 },
      ],
    });
    const rincian = hasil.find((x) => x.kunci === "bas")?.rincian ?? [];
    expect(rincian.map((x) => x.label)).not.toContain("Sidang ke-1");
  });

  it("urutan 0 TIDAK menjadi 'sidang ke-0'", () => {
    // Bot menulis Number(row.urutan) || 0 dan kolomnya kosong pada sebagian
    // baris lama. Nol bukan nomor - yang menulisnya menyuruh orang mencari
    // sesuatu yang tidak ada di SIPP.
    const hasil = sebabMinutasiTertahan({
      ...dasar,
      jadwal: [{ adaBas: false, tanggalSidang: "2026-05-05", agenda: "Kesimpulan", urutanSidang: 0 }],
    });
    const r = hasil.find((x) => x.kunci === "bas")?.rincian?.[0];
    expect(r?.label).not.toContain("ke-0");
    expect(r?.label).toBe("Sidang 5 Mei 2026");
  });

  it("agenda kosong tidak meninggalkan tanda hubung menggantung", () => {
    const hasil = sebabMinutasiTertahan({
      ...dasar,
      jadwal: [{ adaBas: false, tanggalSidang: "2026-05-05", agenda: "", urutanSidang: 2 }],
    });
    const r = hasil.find((x) => x.kunci === "bas")?.rincian?.[0];
    expect(r?.catatan).toContain("tanpa agenda");
    expect(r?.catatan?.trim().endsWith("—")).toBe(false);
  });

  it("cap waktu penuh tidak memunculkan jam 00:00:00", () => {
    // SIPP mengirim "2026-06-10" pada satu tempat dan "2026-06-10 09:00:00"
    // pada tempat lain.
    const hasil = sebabMinutasiTertahan({
      ...dasar,
      jadwal: [
        { adaBas: false, tanggalSidang: "2026-05-05 09:00:00", agenda: "Kesimpulan", urutanSidang: 2 },
      ],
    });
    const r = hasil.find((x) => x.kunci === "bas")?.rincian?.[0];
    expect(r?.catatan).toContain("5 Mei 2026");
    expect(r?.catatan).not.toContain("00:00");
  });

  it("sidang SESUDAH putusan tidak ikut disebut namanya", () => {
    // Penyaringan yang sama yang membuat tuduhan BAS-nya benar - terukur 0
    // lawan 7 pada perkara putus 2026.
    const hasil = sebabMinutasiTertahan({
      ...dasar,
      jadwal: [
        { adaBas: true, tanggalSidang: "2026-05-05", agenda: "Kesimpulan", urutanSidang: 4 },
        { adaBas: false, tanggalSidang: "2026-12-01", agenda: "Ikrar Talak", urutanSidang: 5 },
      ],
    });
    expect(hasil.find((x) => x.kunci === "bas")).toBeUndefined();
  });

  it("kalimat lamanya TIDAK berubah - lima penjaga mengikatnya", () => {
    const hasil = sebabMinutasiTertahan({
      ...dasar,
      jadwal: [{ adaBas: false, tanggalSidang: "2026-05-05", agenda: "Kesimpulan", urutanSidang: 1 }],
    });
    expect(hasil.find((x) => x.kunci === "bas")?.pesan).toContain("belum ada sama sekali");
    expect(hasil.find((x) => x.kunci === "bas")?.pesan).toContain("1 sidang");
  });

  it("relaas ikut sebagai PELENGKAP, dan menyebut pihaknya", () => {
    // Yang terbaca ada tidaknya PINDAIAN relaas, bukan sah tidaknya
    // panggilannya. Menahan minutasi atas dasar itu berarti menahannya atas
    // hal yang tidak diukur.
    const hasil = sebabMinutasiTertahan({
      ...dasar,
      jadwal: [{ adaBas: true, tanggalSidang: "2026-05-05", agenda: "Kesimpulan", urutanSidang: 1 }],
      relaas: [
        { adaDokumen: true, namaPihak: "Penggugat", tanggalRelaas: "2026-04-01" },
        { adaDokumen: false, namaPihak: "Tergugat", tanggalRelaas: "2026-04-02" },
      ],
    });
    const relaas = hasil.find((x) => x.kunci === "relaas");
    expect(relaas?.tingkat).toBe("pelengkap");
    expect(relaas?.pesan).toContain("1 dari 2");
    expect(relaas?.rincian?.[0].label).toBe("Tergugat");
  });

  it("relaas yang TIDAK dikirim tidak menghasilkan tuduhan apa pun", () => {
    // Daftar yang tidak dikirim berbeda artinya dari daftar kosong. Menuduh
    // "relaas kurang" atas data yang tidak dikirim persis kesalahan yang
    // dihindari seluruh berkas ini.
    const hasil = sebabMinutasiTertahan({
      ...dasar,
      jadwal: [{ adaBas: true, tanggalSidang: "2026-05-05", agenda: "Kesimpulan", urutanSidang: 1 }],
    });
    expect(hasil.find((x) => x.kunci === "relaas")).toBeUndefined();
  });

  it("naskah putusan menyebut tanggal putusannya", () => {
    // SIPP menyimpan naskah menurut tanggal putusannya, bukan menurut nomor
    // perkaranya - jadi itulah yang dibutuhkan yang mencari berkasnya.
    const hasil = sebabMinutasiTertahan({
      ...dasar,
      adaBerkasPutusan: false,
      jadwal: [{ adaBas: true, tanggalSidang: "2026-05-05", agenda: "Kesimpulan", urutanSidang: 1 }],
    });
    const naskah = hasil.find((x) => x.kunci === "naskah-putusan");
    expect(naskah?.rincian?.[0].catatan).toBe("10 Jun 2026");
  });

  it("layarnya menggambar rincian sebagai sub-daftar", () => {
    // Sub-daftar, bukan sambungan kalimat: "2 dari 5" adalah angka yang
    // dibaca sekilas, dan membenamkan lima nama sidang ke dalam kalimatnya
    // menghapus angka itu dari pandangan.
    expect(layar).toContain("(x.rincian ?? []).length > 0");
    expect(layar).toContain("relaas: sipp.relaas ?? []");
  });
});
