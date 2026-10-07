// @vitest-environment node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * MESIN CETAK RELAAS MASSAL DI latar.js - DIJALANKAN, BUKAN DIBACA TEKSNYA
 * ============================================================================
 *
 * Mesin ini hidup di pekerja latar MV3: Chrome mematikannya kira-kira tiap
 * tiga puluh detik menganggur, dan seluruh variabel modulnya ikut hilang.
 * Penyisir teks tidak dapat membuktikan apa pun tentang itu - di repo ini ia
 * sudah tiga kali hijau di atas kode yang melempar.
 *
 * Karena itu latar.js dimuat SUNGGUHAN ke node:vm, di atas:
 *   - jam maya (Date dan setTimeout/setInterval milik pekerja), sehingga jeda
 *     antar permintaan berjalan seketika tetapi tetap TERUKUR;
 *   - chrome.storage.session/local tiruan yang MENYERIALKAN isinya (seperti
 *     Chrome), dibagi antar pekerja - itulah satu-satunya yang selamat;
 *   - chrome.downloads tiruan dengan riwayat unduhan (search) dan pendengar
 *     onDeterminingFilename latar.js sendiri;
 *   - ABT dan portal palsu yang bentuk halamannya disalin dari view ABT asli.
 *
 * "Membunuh" pekerja = konteks vm-nya dibuang: seluruh panggilan chrome.* dan
 * fetch miliknya tidak pernah selesai, timernya tidak pernah berbunyi. Pekerja
 * baru dibuat dari berkas yang sama di atas penyimpanan yang sama - persis
 * yang dilakukan Chrome.
 */

import {
  ASAL,
  ABT,
  KATALOG,
  BERKAS,
  Dunia,
  nyalakan,
  jalankan,
  minta,
  abtPalsu,
  dokumen,
  ENAM,
  pesanMulai,
  cetakUntuk,
  namaRelatif,
  simpangan,
} from "./dunia-latar";
import type { Unduhan } from "./dunia-latar";

// ===========================================================================
// (a) KEMAJUAN TAHAN PEKERJA MATI
// ===========================================================================

describe("(a) putaran enam dokumen bertahan dari pekerja yang mati TIGA kali", () => {
  /**
   * Relaas hanya RTF (6 Okt 2026) - tidak ada PDF. Tiga kematian di titik
   * yang menuntut jawaban berbeda:
   *   #2  mati saat CETAK di ABT - belum ada berkas apa pun: diulang
   *   #4  mati sesudah unduhan RTF LAHIR, sebelum pekerja sempat mencatatnya -
   *       hanya riwayat unduhan (chrome.downloads.search) yang tahu; TIDAK
   *       dicetak ulang
   *   #5  mati saat CETAK lagi - diulang
   */
  async function putaranDenganKematian() {
    const titikMati = new Set(["cetak-102", "unduh-104.rtf", "cetak-105"]);
    const dunia = new Dunia(
      abtPalsu({
        bunuhSaat: (p) => {
          if (!p.alamat.includes("/abt/preview?")) return false;
          const c = new URL(p.alamat).searchParams.get("c");
          if (c === "102" && titikMati.delete("cetak-102")) return true;
          if (c === "105" && titikMati.delete("cetak-105")) return true;
          return false;
        },
      })
    );
    dunia.kaitUnduh = (relatif) => {
      if (relatif.includes("104-Pdt") && relatif.endsWith(".rtf") && titikMati.delete("unduh-104.rtf")) return "bunuh";
      return undefined;
    };

    let pekerja = nyalakan(dunia);
    const mulai = await minta(dunia, pekerja, pesanMulai(ENAM));
    expect(mulai.ok, JSON.stringify(mulai)).toBe(true);
    expect(mulai.pekerjaan.butir).toHaveLength(6);

    const pekerjaDipakai = [pekerja.saya];
    for (let putaran = 0; putaran < 10; putaran += 1) {
      const matiSebelum = dunia.kematian;
      await jalankan(dunia, () => Boolean(dunia.putaran()?.selesai) || dunia.kematian > matiSebelum);
      if (dunia.putaran()?.selesai) break;
      // Chrome membangunkan pekerja baru dari berkas yang sama.
      pekerja = nyalakan(dunia);
      pekerjaDipakai.push(pekerja.saya);
    }
    return { dunia, pekerjaDipakai };
  }

  it("tidak ada dokumen yang tercetak dua kali dan tidak ada yang hilang", async () => {
    const { dunia, pekerjaDipakai } = await putaranDenganKematian();
    expect(dunia.kematian).toBe(3);
    expect(pekerjaDipakai).toHaveLength(4);

    const p = dunia.putaran();
    expect(p.selesai).toBe(true);
    expect(p.butir.map((b: any) => b.keadaan)).toEqual(Array(6).fill("selesai"));
    expect(p.pemulihan).toBe(3);

    // Tepat SATU berkas per dokumen - RTF saja, tanpa PDF - dan tidak satu pun " (1)".
    const nama = dunia.unduhan.map(namaRelatif);
    expect(nama.filter((n) => / \(\d+\)\.(rtf|pdf)$/.test(n)), nama.join("\n")).toEqual([]);
    expect(nama.filter((n) => /\.pdf$/i.test(n)), nama.join("\n")).toEqual([]);
    expect(new Set(nama).size).toBe(nama.length);
    for (const d of ENAM) {
      const cocok = nama.filter((n) => n.includes(`/${d.perkaraId}-Pdt`) && n.endsWith(".rtf"));
      expect(cocok, `${d.perkaraId}.rtf: ${cocok.join(", ")}`).toHaveLength(1);
    }
    // Rute PDF ALETA tidak pernah disentuh.
    expect(dunia.permintaan.filter((x) => x.alamat.includes("/abt/pdf"))).toEqual([]);
  });

  it("butir yang sedang dikerjakan saat mati dipulihkan lewat chrome.downloads.search", async () => {
    const { dunia } = await putaranDenganKematian();
    const p = dunia.putaran();
    const butir = (id: string) => p.butir.find((b: any) => b.perkaraId === id);

    // #4: RTF lahir tepat sebelum pekerja mati - riwayat unduhanlah buktinya.
    expect(butir("104").sebab).toContain("riwayat unduhan");
    expect(butir("104").unduhan.rtf).toMatch(/104-Pdt.*\.rtf$/);
    expect(butir("104").unduhan.pdf).toBeUndefined();
    expect(cetakUntuk(dunia, "104")).toHaveLength(1); // TIDAK dicetak ulang dari ABT
    expect(p.catatan.join("\n")).toMatch(/104.*selesai, dari riwayat unduhan/);

    // #2 dan #5: mati saat CETAK - diulang.
    expect(butir("102").percobaan).toBe(2);
    expect(butir("105").percobaan).toBe(2);
    expect(cetakUntuk(dunia, "102")).toHaveLength(2);
    expect(cetakUntuk(dunia, "105")).toHaveLength(2);

    // Pencarian riwayat memang dijalankan untuk ketiga butir yang tertinggal "sedang".
    const dicari = dunia.pencarian.map((k) => String(k.filenameRegex));
    for (const id of ["102", "104", "105"]) {
      expect(dicari.some((r) => r.includes(`${id}-Pdt`)), `pencarian untuk ${id}: ${dicari.join(" | ")}`).toBe(true);
    }
    // Dan dibatasi sejak butir itu PERTAMA KALI dimulai - bukan seluruh riwayat.
    expect(dunia.pencarian.every((k) => typeof k.startedAfter === "string")).toBe(true);
  });

  it("berkas turun ke folder tanggal / juru sita, bernama nomor perkara", async () => {
    const { dunia } = await putaranDenganKematian();
    const nama = dunia.unduhan.map(namaRelatif).sort();
    expect(nama).toContain("ALETA relaas 2026-09-25/Andi Juru Sita, S.H/101-Pdt.G-2026-PA.Dgl - dokumen 1.rtf");
    expect(nama).toContain("ALETA relaas 2026-09-25/Budi Santoso/103-Pdt.G-2026-PA.Dgl - dokumen 3.rtf");
    expect(nama).toContain("ALETA relaas 2026-09-25/Juru sita tidak tercatat/105-Pdt.G-2026-PA.Dgl - dokumen 5.rtf");
    // Tidak ada pekerja yang menulis galat ke konsol dalam putaran yang sehat.
    expect(dunia.galatKonsol.filter((g) => g[0] === "error")).toEqual([]);
  });
});

// ===========================================================================
// (b) JARAK RAMAH PELADEN ABT - 1-2,5 DETIK ANTAR DOKUMEN, TANPA JEDA PANJANG
// ===========================================================================
//
// Keputusan orkestrator 25 September 2026: jeda antar dokumen TIDAK lagi
// meniru pola kerja manusia (dulu rata-rata ±49 dtk dengan jeda panjang
// sesekali) - untuk beban peladen ABT (PHP 5.6), bukan penyamaran.
//
// DISESUAIKAN 7 Oktober 2026 (permintaan pengguna "buat cetak relaas lebih
// prosesnya cepat"), bukan dilonggarkan tanpa alasan:
//   - antar dokumen 2-5 dtk -> 1-2,5 dtk, dihitung sejak JAWABAN ABT
//     TERAKHIR dokumen sebelumnya: halaman berat per dokumen turun dari tiga
//     menjadi dua (daftar sidang dilewati bila halaman "buka" sudah memuat
//     tautan CETAK - cetak-relaas-cepat.test.ts membuktikan alamat CETAK dan
//     berkasnya identik), jadi beban per menit tidak naik berarti dan ABT
//     tetap diam sedikitnya satu detik di antara dua dokumen;
//   - langkah DI DALAM satu dokumen tanpa jeda: permintaannya berurutan
//     (yang berikut baru dikirim sesudah jawaban sebelumnya diterima), jadi
//     jeda di sana tidak mengurangi beban, hanya menambah tunggu;
//   - antar halaman kelompok saat memanen blangko 0,5-1,5 -> 0,25-0,75 dtk
//     (panen jarang: token disimpan tujuh hari).
// Uji ini TETAP menjaga batasnya: tidak pernah di bawah 1 dtk, tidak ada jeda
// panjang, tersebar.

describe("(b) jarak ramah server ABT", () => {
  const dunia = new Dunia(abtPalsu());
  const k = nyalakan(dunia).konteks;

  it("4000 jeda antar dokumen: SELALU di dalam 1-2,5 dtk, tidak ada jeda panjang, tersebar di seluruh rentang", () => {
    const x = Array.from({ length: 4000 }, () => k.relaasJedaDokumen() as number);
    expect(Math.min(...x)).toBeGreaterThanOrEqual(1000);
    expect(Math.max(...x)).toBeLessThanOrEqual(2500);
    expect(x.every((v) => Number.isInteger(v))).toBe(true);
    // Tersebar - bukan satu angka tetap: keenam lajur seperempat detik terisi.
    const lajur = new Set(x.filter((v) => v < 2500).map((v) => Math.floor((v - 1000) / 250)));
    expect([...lajur].sort()).toEqual([0, 1, 2, 3, 4, 5]);
    // Rata-rata yang DIUMUMKAN ke halaman (perkiraan waktu) sesuai sampelnya.
    // const tingkat atas bukan properti global - dibaca lewat konteksnya.
    const diumumkan = vm.runInContext("RELAAS_JEDA_RATA_MS", k) as number;
    expect(diumumkan).toBe(1750);
    expect(Math.abs(simpangan(x).rata - diumumkan)).toBeLessThan(60);
  });

  it("ujung rentangnya tepat, dengan sumber acak yang tetap", () => {
    expect(k.relaasJedaDokumen(() => 0)).toBe(1000);
    expect(k.relaasJedaDokumen(() => 0.5)).toBe(1750);
    expect(k.relaasJedaDokumen(() => 0.9999999)).toBe(2500);
    expect(k.relaasJedaLangkah(() => 0)).toBe(250);
    expect(k.relaasJedaLangkah(() => 0.9999999)).toBe(750);
  });

  it("antar halaman panen: 0,25-0,75 dtk", () => {
    const x = Array.from({ length: 2000 }, () => k.relaasJedaLangkah() as number);
    expect(Math.min(...x)).toBeGreaterThanOrEqual(250);
    expect(Math.max(...x)).toBeLessThanOrEqual(750);
  });

  it("dalam putaran sungguhan: jarak antar CETAK = jeda 1-2,5 dtk, tanpa jeda langkah, tidak ada yang panjang", async () => {
    const d = new Dunia(abtPalsu());
    const pekerja = nyalakan(d);
    await minta(d, pekerja, pesanMulai(ENAM));
    await jalankan(d, () => Boolean(d.putaran()?.selesai));
    const cetak = d.permintaan.filter((p) => p.alamat.includes("/abt/preview?")).map((p) => p.pada);
    expect(cetak).toHaveLength(6);
    const jarak = cetak.slice(1).map((t, i) => t - cetak[i]);
    // ABT palsu menjawab seketika, jadi hanya jeda antar dokumen yang mengisi
    // jaraknya - langkah di dalam satu dokumen tidak berjeda.
    expect(Math.min(...jarak)).toBeGreaterThanOrEqual(1000);
    expect(Math.max(...jarak)).toBeLessThanOrEqual(2500);
    // Sesudah dokumen terakhir tidak ada jeda yang ditunggu.
    expect(d.putaran().selesaiPada - cetak[cetak.length - 1]).toBeLessThan(1000);

    const panen = d.permintaan.filter((p) => p.alamat.includes("/abt/main/beranda")).map((p) => p.pada);
    expect(panen.length).toBeGreaterThanOrEqual(2);
    expect(panen[1] - panen[0]).toBeGreaterThanOrEqual(250);
    expect(panen[1] - panen[0]).toBeLessThanOrEqual(750);

    // Tiap dokumen menempuh tombol ABT: buka (POST cari - HAK AKSES diperiksa
    // ABT di sini) -> CETAK. Daftar sidang dilewati: halaman "buka" sudah
    // memuat tautan CETAK-nya (jalan lewat daftar sidang tetap ada bila tidak -
    // lihat cetak-relaas-cepat.test.ts).
    const langkah = d.permintaan
      .filter((p) => p.alamat.includes(`c=${ENAM[1].perkaraId}`) || p.badan.includes(`c=${ENAM[1].perkaraId}`))
      .map((p) => `${p.metode} ${new URL(p.alamat).pathname}${new URL(p.alamat).searchParams.get("d") ? " d" : ""}`);
    expect(langkah).toEqual(["POST /aps_badilag/abt/main/cari", "GET /aps_badilag/abt/preview d"]);
  });
});

// ===========================================================================
// (c) TIDAK ADA GALAT YANG DITELAN
// ===========================================================================

describe("(c) setiap kegagalan terbaca beserta sebabnya", () => {
  it("ABT menjawab halaman masuk saat panen: relaas-mulai ditolak dengan perluMasuk", async () => {
    const dunia = new Dunia(abtPalsu({ masuk: () => false }));
    const pekerja = nyalakan(dunia);
    const j = await minta(dunia, pekerja, pesanMulai(ENAM.slice(0, 2)));
    expect(j.ok).toBe(false);
    expect(j.perluMasuk).toBe(true);
    expect(j.sebab).toMatch(/Masuk ke ABT/);
    expect(dunia.putaran()).toBeNull();
  });

  it("sesi ABT habis di tengah putaran: tertahan perluMasuk 'abt', lalu Lanjutkan menuntaskannya", async () => {
    let sudahMasuk = true;
    const dunia = new Dunia(abtPalsu({ masuk: () => sudahMasuk }));
    const pekerja = nyalakan(dunia);
    expect((await minta(dunia, pekerja, pesanMulai(ENAM.slice(0, 3)))).ok).toBe(true);
    await jalankan(dunia, () => dunia.putaran()?.butir[0].keadaan === "selesai");
    sudahMasuk = false;
    await jalankan(dunia, () => Boolean(dunia.putaran()?.tertahan));
    const p = dunia.putaran();
    expect(p.tertahan.perluMasuk).toBe("abt");
    expect(p.tertahan.sebab).toMatch(/masuk ke ABT/i);
    expect(p.butir[1].keadaan).toBe("menunggu");
    expect(p.butir[1].percobaan).toBe(0); // sesi habis bukan kesalahan dokumennya

    sudahMasuk = true;
    expect((await minta(dunia, pekerja, { jenis: "relaas-lanjut" })).ok).toBe(true);
    await jalankan(dunia, () => Boolean(dunia.putaran()?.selesai));
    expect(dunia.putaran().butir.map((b: any) => b.keadaan)).toEqual(["selesai", "selesai", "selesai"]);
  });

  it("ABT 500 pada CETAK: diulang TERBATAS (3 percobaan), lalu gagal beserta kodenya; dokumen lain jalan terus", async () => {
    const dunia = new Dunia(abtPalsu({ cetak500: (id) => id === "101" }));
    const pekerja = nyalakan(dunia);
    await minta(dunia, pekerja, pesanMulai(ENAM.slice(0, 2)));
    await jalankan(dunia, () => Boolean(dunia.putaran()?.selesai));
    const [gagal, lain] = dunia.putaran().butir;
    expect(gagal.keadaan).toBe("gagal");
    expect(gagal.percobaan).toBe(3);
    expect(gagal.sebab).toMatch(/3 percobaan/);
    expect(gagal.sebab).toMatch(/500/);
    expect(cetakUntuk(dunia, "101")).toHaveLength(3);
    expect(lain.keadaan).toBe("selesai");
    expect(dunia.putaran().catatan.join("\n")).toMatch(/diulang sesudah percobaan ke-1/);
  });

  it("ABT menolak hak akses: gagal dengan KALIMAT ABT sendiri, tidak diulang, CETAK tidak pernah diminta", async () => {
    const dunia = new Dunia(
      abtPalsu({ tolakAkses: (id) => (id === "102" ? "User Budi<br>Tidak Ada Akses dengan Perkara Nomor 102/Pdt.G/2026/PA.Dgl" : null) })
    );
    const pekerja = nyalakan(dunia);
    await minta(dunia, pekerja, pesanMulai(ENAM.slice(0, 2)));
    await jalankan(dunia, () => Boolean(dunia.putaran()?.selesai));
    const b = dunia.putaran().butir[1];
    expect(b.keadaan).toBe("gagal");
    expect(b.percobaan).toBe(1);
    expect(b.sebab).toBe("ABT menolak membuka blangko ini: User Budi - Tidak Ada Akses dengan Perkara Nomor 102/Pdt.G/2026/PA.Dgl");
    expect(cetakUntuk(dunia, "102")).toHaveLength(0);
  });

  it("blangko yang tidak ada di ABT: dilewati di depan beserta sebabnya, sisanya tetap dicetak", async () => {
    const tanpaIkrar = KATALOG.filter((n) => n !== BERKAS("ikrar-talak"));
    const dunia = new Dunia(abtPalsu({ berkasAda: tanpaIkrar }));
    const pekerja = nyalakan(dunia);
    const j = await minta(dunia, pekerja, pesanMulai(ENAM.slice(0, 4)));
    expect(j.ok).toBe(true);
    expect(j.pekerjaan.butir.map((b: any) => b.perkaraId)).toEqual(["101", "102", "103"]);
    expect(j.pekerjaan.dilewati).toHaveLength(1);
    expect(j.pekerjaan.dilewati[0].sebab).toContain(`blangko "${BERKAS("ikrar-talak")}" tidak ditemukan`);
    await jalankan(dunia, () => Boolean(dunia.putaran()?.selesai));
    expect(dunia.putaran().butir.every((b: any) => b.keadaan === "selesai")).toBe(true);
  });

  it("kelompok blangko yang menjawab 500 disebut, bukan disamarkan menjadi 'tidak ditemukan'", async () => {
    const dunia = new Dunia(abtPalsu({ kelompok500: true }));
    const pekerja = nyalakan(dunia);
    const j = await minta(dunia, pekerja, pesanMulai(ENAM.slice(0, 1)));
    expect(j.ok).toBe(true);
    expect(j.pekerjaan.dilewati[0].sebab).toContain('"Relaas dan PBT" (ABT menjawab 500)');
  });

  // Permintaan pengguna 6 Okt 2026: "untuk cetak relaas dan BAS jangan pdf,
  // cukup rtf/word saja". Penjaga ini MENJALANKAN latar.js: rute PDF ALETA
  // yang menjawab apa pun (bahkan 200 dengan PDF) tidak pernah dipanggil.
  it("RTF SAJA: rute PDF ALETA tidak pernah dipanggil, yang turun hanya .rtf - walau kiriman lama meminta PDF", async () => {
    let pdfDipanggil = 0;
    const dunia = new Dunia(
      abtPalsu({
        pdf: () => {
          pdfDipanggil += 1;
          return null;
        },
      })
    );
    const pekerja = nyalakan(dunia);
    // Ruas lama dari portal/ekstensi versi sebelumnya - diabaikan.
    await minta(dunia, pekerja, pesanMulai(ENAM.slice(0, 2), { unduhRtf: "bila-pdf-gagal", rtfBilaPdfGagal: true }));
    await jalankan(dunia, () => Boolean(dunia.putaran()?.selesai));
    const p = dunia.putaran();
    expect(p.butir.map((b: any) => b.keadaan)).toEqual(["selesai", "selesai"]);
    expect(pdfDipanggil).toBe(0);
    expect(dunia.permintaan.filter((x) => x.alamat.includes("/abt/pdf"))).toEqual([]);
    expect(dunia.unduhan.map(namaRelatif)).toEqual([
      "ALETA relaas 2026-09-25/Andi Juru Sita, S.H/101-Pdt.G-2026-PA.Dgl - dokumen 1.rtf",
      "ALETA relaas 2026-09-25/Andi Juru Sita, S.H/102-Pdt.G-2026-PA.Dgl - dokumen 2.rtf",
    ]);
    expect(p.butir.every((b: any) => b.unduhan.pdf === undefined && b.tanpaPdf === undefined)).toBe(true);
    expect(p.opsi).toEqual({ bentuk: "rtf" });
    expect(p.butir[0].hasil).toBe("101-Pdt.G-2026-PA.Dgl - dokumen 1.rtf");
  });

  it("penjaga teks: latar.js dan jembatan aleta.js tidak lagi memuat rute PDF ataupun pilihan bentuk relaas", () => {
    const akar = path.resolve(__dirname, "../../../ekstensi-sipp");
    const latar = readFileSync(path.join(akar, "latar.js"), "utf8");
    const jembatan = readFileSync(path.join(akar, "aleta.js"), "utf8");
    expect(latar).not.toMatch(/aleta-bot\/abt\/pdf/);
    expect(latar).not.toMatch(/data:application\/pdf/);
    expect(latar).not.toMatch(/relaasCaraRtf|bila-pdf-gagal/);
    expect(jembatan).not.toMatch(/JEMBATAN_CARA_RTF|pekerjaan\.unduhRtf|pekerjaan\.rtfBilaPdfGagal/);
  });

  it("penjaga teks: BAS (massal & unduh naskah) tetap RTF - tidak ada konversi PDF di jalurnya", () => {
    const akar = path.resolve(__dirname, "../../..");
    const basmassal = readFileSync(path.join(akar, "ekstensi-sipp/basmassal.js"), "utf8");
    const rute = readFileSync(path.join(akar, "manajemen_surat/src/app/api/aleta-ecourt/bas/naskah/route.ts"), "utf8");
    for (const [nama, isi] of [["basmassal.js", basmassal], ["bas/naskah/route.ts", rute]] as const) {
      expect(isi, nama).not.toMatch(/abt\/pdf|rtfKePdf|dokumenKePdf|application\/pdf|naskah\/konversi/);
    }
    expect(rute).toContain('"Content-Type": "application/rtf"');
  });

  it("unduhan yang diblokir peramban: gagal dengan sebab peramban, tidak dikira tersimpan", async () => {
    const dunia = new Dunia(abtPalsu());
    dunia.kaitUnduh = (relatif) => (relatif.endsWith(".rtf") ? "blokir" : undefined);
    const pekerja = nyalakan(dunia);
    await minta(dunia, pekerja, pesanMulai(ENAM.slice(0, 1)));
    await jalankan(dunia, () => Boolean(dunia.putaran()?.selesai));
    const b = dunia.putaran().butir[0];
    expect(b.keadaan).toBe("gagal");
    expect(b.sebab).toContain("FILE_BLOCKED");
  });

  it("pesan yang asalnya tidak cocok dengan tab pengirimnya ditolak sebelum ABT disentuh", async () => {
    const dunia = new Dunia(abtPalsu());
    const pekerja = nyalakan(dunia);
    const palsu = { url: "http://192.168.10.99/aleta/", origin: "http://192.168.10.99" };
    const j = await minta(dunia, pekerja, pesanMulai(ENAM.slice(0, 1)), palsu);
    expect(j.ok).toBe(false);
    expect(j.sebab).toContain("ditolak");
    const lintas = await minta(dunia, pekerja, {
      ...pesanMulai(ENAM.slice(0, 1)),
      pekerjaan: { ...pesanMulai(ENAM.slice(0, 1)).pekerjaan, asalAbt: "http://jahat.example/aps_badilag" },
    });
    expect(lintas.ok).toBe(false);
    expect(lintas.sebab).toContain("tidak seasal");
    expect(dunia.permintaan).toHaveLength(0);
  });
});

// ===========================================================================
// Nama berkas, alamat, dan halaman ABT
// ===========================================================================

describe("nama berkas unduhan dan alamat ABT", () => {
  const k = nyalakan(new Dunia(abtPalsu())).konteks;

  it("nama ganda di satu folder juru sita dibedakan ' - 2', bukan ' (1)' milik Chrome", () => {
    const sama = { ...ENAM[2], kunci: "pemberitahuan-putusan:103:0:2" };
    const p = k.relaasBuatPekerjaan({
      tanggal: "2026-09-25",
      asal: ASAL,
      asalAbt: `${ASAL}/aps_badilag`,
      dokumen: [ENAM[2], sama],
    });
    expect(p.butir.map((b: any) => b.nama)).toEqual([
      "103-Pdt.G-2026-PA.Dgl - dokumen 3",
      "103-Pdt.G-2026-PA.Dgl - dokumen 3 - 2",
    ]);
    // Pola riwayat unduhan satu dokumen tidak menangkap berkas dokumen lainnya.
    const pola = new RegExp(k.relaasPolaUnduhan(k.relaasJalurBerkas(p, p.butir[0])));
    expect(pola.test("D:\\Unduhan\\ALETA relaas 2026-09-25\\Budi Santoso\\103-Pdt.G-2026-PA.Dgl - dokumen 3 (1).rtf")).toBe(true);
    expect(pola.test("D:\\Unduhan\\ALETA relaas 2026-09-25\\Budi Santoso\\103-Pdt.G-2026-PA.Dgl - dokumen 3 - 2.rtf")).toBe(false);
    // PDF tidak lagi dibuat, jadi tidak pernah dijadikan bukti tersimpan.
    expect(pola.test("D:\\Unduhan\\ALETA relaas 2026-09-25\\Budi Santoso\\103-Pdt.G-2026-PA.Dgl - dokumen 3.pdf")).toBe(false);
  });

  it("nama dirapikan untuk Windows: tanpa aksara terlarang, tanpa titik/spasi di ujung", () => {
    expect(k.relaasRapikanNama('12/Pdt.G/2026 "A:B" <x>|?*. ')).toBe("12_Pdt.G_2026 _A_B_ _x_");
    expect(k.relaasRapikanNama("..tersembunyi")).toBe("tersembunyi");
    expect(k.relaasNamaJurusita({ nama: "Andi" })).toBe("Andi");
    expect(k.relaasNamaJurusita("tidak tercatat")).toBe("Juru sita tidak tercatat");
  });

  it("asalAbt kontrak K3 (…/aps_badilag) menjadi pengendali …/aps_badilag/abt", () => {
    expect(k.relaasDasarAbt("http://192.168.10.10/aps_badilag")).toBe("http://192.168.10.10/aps_badilag/abt");
    expect(k.relaasDasarAbt("http://192.168.10.10/aps_badilag/abt/")).toBe("http://192.168.10.10/aps_badilag/abt");
    expect(k.relaasDasarAbt("javascript:alert(1)")).toBe("");
  });

  it("alamat CETAK susunan sendiri berbentuk persis view.php: c, e kosong, b, a, d - token mentah", () => {
    const t = { a: "3Iwt~nRPV.F8-", b: "QHWP9~vC6.Q-" };
    expect(k.relaasAlamatPratinjau(`${ASAL}/aps_badilag`, t, "10120", 3)).toBe(
      `${ASAL}/aps_badilag/abt/preview?c=10120&e=&b=QHWP9~vC6.Q-&a=3Iwt~nRPV.F8-&d=3`
    );
    expect(k.relaasAlamatPratinjau(`${ASAL}/aps_badilag`, t, "10120", 0)).toBe(
      `${ASAL}/aps_badilag/abt/preview?c=10120&e=&b=QHWP9~vC6.Q-&a=3Iwt~nRPV.F8-&d=`
    );
    expect(k.relaasAlamatPratinjau(`${ASAL}/aps_badilag`, t, "0", 1)).toBe("");
  });

  it("tautan CETAK dari halaman view dipakai hanya bila menunjuk perkara dan sidang yang diminta", () => {
    const html = `<a href="${ASAL}/aps_badilag/abt/preview?c=77&e=&b=B~1&a=A~2&d=2"><img></a>`;
    expect(k.relaasCetakDariTinjau(html, `${ASAL}/aps_badilag`, "77", 2)).toBe(`${ASAL}/aps_badilag/abt/preview?c=77&e=&b=B~1&a=A~2&d=2`);
    expect(k.relaasCetakDariTinjau(html, `${ASAL}/aps_badilag`, "78", 2)).toBe("");
    expect(k.relaasCetakDariTinjau(html, `${ASAL}/aps_badilag`, "77", 3)).toBe("");
    const lain = `<a href="http://lain.example/aps_badilag/abt/preview?c=77&e=&b=B&a=A&d=2">`;
    expect(k.relaasCetakDariTinjau(lain, `${ASAL}/aps_badilag`, "77", 2)).toBe("");
  });
});

// ===========================================================================
// ABT SETEMPAT YANG ASLI - view asli, enkripsi asli, folder blangko asli
// ===========================================================================

const PHP56 = "D:/sipp-server/php56/php.exe";
const ABT_SETEMPAT = "D:/Satker Asal/Website PA Bungku/xampp/htdocs/aps_badilag";
const PERENDER = "D:/aleta-dev/kerja/relaas-massal/render-beranda-abt.php";
const PERENDER_CETAK = "D:/aleta-dev/kerja/relaas-antrian/render-tautan-cetak.php";
const adaAbtSetempat = [PHP56, ABT_SETEMPAT, PERENDER, PERENDER_CETAK].every((j) => existsSync(j));

describe.skipIf(!adaAbtSetempat)("panen token atas ABT setempat yang ASLI (tanpa masuk)", () => {
  const k = nyalakan(new Dunia(abtPalsu())).konteks;
  const php = (...arg: string[]) => execFileSync(PHP56, arg, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });

  it("seluruh blangko relaas katalog terpanen: dari 'Relaas dan PBT', ikrar dari 'Relaas Ikrar Talak' (menu 25)", () => {
    const beranda = php(PERENDER, "beranda");
    const kelompok = k.relaasUrutkanKelompok(k.relaasUraiKelompok(beranda));
    expect(kelompok[0].kelompok).toBe("Relaas dan PBT");
    expect(kelompok[0].alamat).toMatch(/^\/aps_badilag\/abt\/main\/beranda\?a=[A-Za-z0-9.~-]+&c=$/);

    // Sejak 26 Sep 2026 blangko ikrar dipindah ke folder menu ABT 25
    // (_ikrar_talak/2 Relaas Ikrar Talak): di menu Relaas perkara bertahap
    // ikrar (proses 290+) selalu ditolak ABT. Pemanen mencari menurut NAMA
    // berkas di seluruh kelompok, jadi keduanya harus ketemu.
    const ikrarKelompok = kelompok.find((x: { kelompok: string }) => x.kelompok === "Relaas Ikrar Talak");
    expect(ikrarKelompok, "kelompok Relaas Ikrar Talak tampil di beranda ABT").toBeTruthy();
    const berkasDua = [
      ...k.relaasUraiBerkas(php(PERENDER, "kelompok", kelompok[0].a)),
      ...k.relaasUraiBerkas(php(PERENDER, "kelompok", ikrarKelompok.a)),
    ];
    const { token, hilang } = k.relaasPetakanToken(KATALOG, berkasDua);
    expect(hilang).toEqual([]);
    // 6 Okt 2026: blangko per pihak (0./1./2. P dan T) - seluruh katalog terpanen, bukan lagi enam.
    expect(Object.keys(token)).toHaveLength(KATALOG.length);
    // Token ikrar mengurai (pustaka enkripsi ABT sendiri) ke folder menu 25.
    const dirIkrar = php(PERENDER, "urai", token[BERKAS("ikrar-talak")].a);
    expect(dirIkrar.replace(/\\/g, "/")).toMatch(/_ikrar_talak\/2 Relaas Ikrar Talak$/);
    // Tiap token mengurai (pustaka enkripsi ABT sendiri) ke berkas yang ADA di disk.
    for (const [nama, t] of Object.entries<any>(token)) {
      const dir = php(PERENDER, "urai", t.a);
      const berkas = php(PERENDER, "urai", t.b);
      expect(`${berkas}.rtf`).toBe(nama);
      const jalur = path.join(ABT_SETEMPAT, dir, `${berkas}.rtf`);
      expect(existsSync(jalur), jalur).toBe(true);
      // preview.php menggemakan templat ini setelah variabelnya diganti -
      // bita pertamanya bita pertama jawaban CETAK.
      expect(readFileSync(jalur).subarray(0, 5).toString("latin1")).toBe("{\\rtf");
    }
  });

  it("alamat CETAK susunan latar.js SAMA PERSIS dengan ekspresi view.php yang dievaluasi PHP", () => {
    const halaman = php(PERENDER, "kelompok", k.relaasUrutkanKelompok(k.relaasUraiKelompok(php(PERENDER, "beranda")))[0].a);
    const t = k.relaasPetakanToken([BERKAS("sidang-ditunda")], k.relaasUraiBerkas(halaman)).token[BERKAS("sidang-ditunda")];
    for (const [perkara, d] of [
      ["10120", "3"],
      ["9001", ""],
    ]) {
      const dariAbt = php(PERENDER_CETAK, perkara, t.b, t.a, d).trim();
      // view.php merender jalur relatif; peramban memintanya pada asal halaman.
      expect(dariAbt.startsWith("/aps_badilag/abt/preview?")).toBe(true);
      expect(k.relaasAlamatPratinjau(`${ASAL}/aps_badilag`, t, perkara, d ? Number(d) : null)).toBe(`${ASAL}${dariAbt}`);
    }
  });
});

describe("tombol Hentikan", () => {
  it("putaran yang hidup berhenti sesudah dokumen yang sedang dikerjakan; sisanya dilewati beserta sebab", async () => {
    const dunia = new Dunia(abtPalsu());
    const pekerja = nyalakan(dunia);
    await minta(dunia, pekerja, pesanMulai(ENAM.slice(0, 3)));
    await jalankan(dunia, () => dunia.putaran()?.butir[0].keadaan === "selesai");
    const j = await minta(dunia, pekerja, { jenis: "relaas-henti" });
    expect(j.ok).toBe(true);
    await jalankan(dunia, () => Boolean(dunia.putaran()?.selesai));
    const p = dunia.putaran();
    expect(p.dihentikan).toBe(true);
    expect(p.butir.map((b: any) => b.keadaan)).toEqual(["selesai", "dilewati", "dilewati"]);
    expect(p.butir[1].sebab).toBe("dihentikan petugas sebelum dikerjakan");
    expect(cetakUntuk(dunia, "102")).toHaveLength(0);
    expect(cetakUntuk(dunia, "103")).toHaveLength(0);
  });

  it("putaran tertahan (sesi ABT) yang dihentikan: butirnya dilewati sebelum dikerjakan", async () => {
    let sudahMasuk = true;
    const dunia = new Dunia(abtPalsu({ masuk: () => sudahMasuk }));
    const pekerja = nyalakan(dunia);
    await minta(dunia, pekerja, pesanMulai(ENAM.slice(0, 2)));
    await jalankan(dunia, () => dunia.putaran()?.butir[0].keadaan === "selesai");
    sudahMasuk = false;
    await jalankan(dunia, () => Boolean(dunia.putaran()?.tertahan));
    expect(dunia.putaran().tertahan.perluMasuk).toBe("abt");
    const j = await minta(dunia, pekerja, { jenis: "relaas-henti" });
    expect(j.ok).toBe(true);
    const b = dunia.putaran().butir[1];
    expect(b.keadaan).toBe("dilewati");
    expect(b.sebab).toBe("dihentikan petugas sebelum dikerjakan");
    expect(dunia.unduhan).toHaveLength(1);
  });

  it("butir yang RTF-nya sudah tersimpan lalu dihentikan menyebut berkas itu", () => {
    const k = nyalakan(new Dunia(abtPalsu())).konteks;
    const p = { butir: [{ keadaan: "sedang", unduhan: { rtf: "101-Pdt.G-2026-PA.Dgl - dokumen 1.rtf" } }] };
    k.tutupDenganHenti(p);
    expect(p.butir[0]).toMatchObject({
      keadaan: "dilewati",
      sebab: "dihentikan petugas di tengah dokumen ini - yang sudah tersimpan: 101-Pdt.G-2026-PA.Dgl - dokumen 1.rtf",
    });
  });
});

// ===========================================================================
// TELAAH 25 SEPTEMBER 2026 - cacat yang terbukti, masing-masing dijalankan
// ===========================================================================

describe("telaah: penolakan ABT yang berlaku untuk SELURUH blangko", () => {
  it("penolakan tanpa nomor perkara dikenali menyeluruh; yang menyebut perkara tetap per dokumen", () => {
    const k = nyalakan(new Dunia(abtPalsu())).konteks;
    expect(k.relaasTolakanMenyeluruh("USER JURUSITA - TIDAK ADA AKSES MENGGUNAKAN BLANGKO INI")).toBe(true);
    expect(k.relaasTolakanMenyeluruh("User Budi - Tidak Ada Akses dengan Perkara Nomor 102/Pdt.G/2026/PA.Dgl")).toBe(false);
    expect(
      k.relaasTolakanMenyeluruh("NOMOR PERKARA 5/Pdt.G/2026/PA.Dgl - TIDAK DAPAT MENGGUNAKAN BLANGKO INI - (Proses Saat Ini Minutasi)")
    ).toBe(false);
    expect(k.relaasTolakanMenyeluruh("NOMOR PERKARA TIDAK DITEMUKAN")).toBe(false);
    expect(k.relaasTolakanMenyeluruh("")).toBe(false);
  });

  it("33 dokumen, ABT menolak akunnya: putaran TERTAHAN sesudah SATU POST cari, lalu Lanjutkan menuntaskannya", async () => {
    let tolak = true;
    const dunia = new Dunia(abtPalsu({ tolakSemua: () => (tolak ? "JURUSITA" : null) }));
    const pekerja = nyalakan(dunia);
    const tigaPuluhTiga = Array.from({ length: 33 }, (_, i) => dokumen(i + 1, "sidang-ditunda", 3, "Andi Juru Sita, S.H."));
    expect((await minta(dunia, pekerja, pesanMulai(tigaPuluhTiga))).ok).toBe(true);
    await jalankan(dunia, () => Boolean(dunia.putaran()?.tertahan));

    const cari = () => dunia.permintaan.filter((p) => p.metode === "POST" && p.alamat.endsWith("/abt/main/cari"));
    expect(cari()).toHaveLength(1);
    const p = dunia.putaran();
    expect(p.selesai).toBe(false);
    expect(p.tertahan.perluMasuk).toBe("abt-akses");
    // Kalimat ABT dikutip apa adanya, dan tempat membereskannya disebut.
    expect(p.tertahan.sebab).toContain('"USER JURUSITA - TIDAK ADA AKSES MENGGUNAKAN BLANGKO INI"');
    expect(p.tertahan.sebab).toContain("bukan di ALETA");
    // Tidak ada dokumen yang dihitung gagal, tidak ada percobaan yang terpakai.
    expect(p.butir.every((b: any) => b.keadaan === "menunggu" && b.percobaan === 0)).toBe(true);
    expect(dunia.permintaan.some((q) => q.alamat.includes("/abt/preview?"))).toBe(false);

    // Hak aksesnya dibetulkan di ABT, lalu Lanjutkan: seluruhnya tercetak.
    tolak = false;
    expect((await minta(dunia, pekerja, { jenis: "relaas-lanjut" })).ok).toBe(true);
    await jalankan(dunia, () => Boolean(dunia.putaran()?.selesai));
    expect(dunia.putaran().butir.every((b: any) => b.keadaan === "selesai")).toBe(true);
    expect(cari()).toHaveLength(34);
  }, 60_000);
});

describe("telaah: dua relaas-mulai yang tumpang-tindih", () => {
  it("yang kedua datang selagi yang pertama memanen: DITOLAK 'menyiapkan', beranda ABT dibuka SEKALI, tidak ada pekerjaan yang hilang diam-diam", async () => {
    const dunia = new Dunia(abtPalsu());
    const pekerja = nyalakan(dunia);
    const tab1 = ENAM.slice(0, 3); // 101-103
    const tab2 = ENAM.slice(3, 5); // 104-105
    const j1 = pekerja.kirim({ sumber: "aleta-panel", ...pesanMulai(tab1) });
    // Tab kedua mengirim SELAGI tab pertama memanen token dari ABT.
    await jalankan(dunia, () => dunia.permintaan.some((p) => p.alamat.includes("/abt/main/beranda")));
    expect(j1.selesai()).toBe(false);
    const keadaan = pekerja.kirim({ sumber: "aleta-panel", jenis: "relaas-keadaan" });
    const j2 = pekerja.kirim({ sumber: "aleta-panel", ...pesanMulai(tab2) });
    await jalankan(dunia, () => j1.selesai() && j2.selesai() && keadaan.selesai());

    expect(j1.nilai().ok).toBe(true);
    expect(j2.nilai().ok).toBe(false);
    expect(j2.nilai().menyiapkan).toBe(true);
    expect(j2.nilai().sebab).toContain("sedang disiapkan");
    expect(keadaan.nilai().menyiapkan).toBe(true);
    const berandaAkar = dunia.permintaan.filter((p) => {
      const u = new URL(p.alamat);
      return u.pathname === "/aps_badilag/abt/main/beranda" && !u.searchParams.get("a");
    });
    expect(berandaAkar).toHaveLength(1);

    await jalankan(dunia, () => Boolean(dunia.putaran()?.selesai));
    expect(dunia.putaran().butir.map((b: any) => b.perkaraId)).toEqual(["101", "102", "103"]);
    // Sesudah persiapannya selesai penanda dilepas: tab kedua dapat memulai.
    const lagi = await minta(dunia, pekerja, pesanMulai(tab2));
    expect(lagi.ok, JSON.stringify(lagi)).toBe(true);
    expect(lagi.pekerjaan.butir.map((b: any) => b.perkaraId)).toEqual(["104", "105"]);
    expect((await minta(dunia, pekerja, { jenis: "relaas-keadaan" })).menyiapkan).toBe(false);
  }, 60_000);

  it("dua pekerjaan dalam milidetik yang sama tidak berbagi id (penanda henti mencocokkan id)", () => {
    const k = nyalakan(new Dunia(abtPalsu())).konteks;
    const bahan = { tanggal: "2026-09-25", asal: ASAL, asalAbt: `${ASAL}/aps_badilag`, dokumen: ENAM.slice(0, 1) };
    const a = k.relaasBuatPekerjaan(bahan, 1_758_760_000_000);
    const b = k.relaasBuatPekerjaan(bahan, 1_758_760_000_000);
    expect(a.id).not.toBe(b.id);
    expect(a.id.startsWith("relaas-1758760000000-")).toBe(true);
  });
});

describe("6 Okt 2026: relaas RTF saja - ruas lama rtfBilaPdfGagal/unduhRtf tidak berarti apa-apa", () => {
  it("rtfBilaPdfGagal:false (dulu 'jangan pernah RTF') tetap menghasilkan RTF, bukan nihil atau PDF", async () => {
    const dunia = new Dunia(abtPalsu());
    const pekerja = nyalakan(dunia);
    await minta(dunia, pekerja, pesanMulai(ENAM.slice(0, 1), { rtfBilaPdfGagal: false, unduhRtf: "tidak" }));
    await jalankan(dunia, () => Boolean(dunia.putaran()?.selesai));
    expect(dunia.unduhan.map(namaRelatif)).toEqual([
      "ALETA relaas 2026-09-25/Andi Juru Sita, S.H/101-Pdt.G-2026-PA.Dgl - dokumen 1.rtf",
    ]);
    expect(dunia.putaran().butir[0].keadaan).toBe("selesai");
    expect(typeof nyalakan(new Dunia(abtPalsu())).konteks.relaasCaraRtf).toBe("undefined");
  });
});

describe("telaah: relaas-panen serentak dan paksa", () => {
  it("lima panen paksa serentak: beranda ABT dibuka SEKALI; paksa berikutnya baru dituruti sesudah 60 detik", async () => {
    const dunia = new Dunia(abtPalsu());
    const pekerja = nyalakan(dunia);
    const pesan = {
      sumber: "aleta-panel",
      jenis: "relaas-panen",
      asal: ASAL,
      asalAbt: `${ASAL}/aps_badilag`,
      berkas: [BERKAS("sidang-pertama"), BERKAS("pemberitahuan-putusan")],
      paksa: true,
    };
    const berandaAkar = () =>
      dunia.permintaan.filter((p) => {
        const u = new URL(p.alamat);
        return u.pathname === "/aps_badilag/abt/main/beranda" && !u.searchParams.get("a");
      }).length;
    const lima = Array.from({ length: 5 }, () => pekerja.kirim(pesan));
    await jalankan(dunia, () => lima.every((j) => j.selesai()));
    const jawab = lima.map((j) => j.nilai());
    expect(jawab.every((x) => x.ok)).toBe(true);
    expect(berandaAkar()).toBe(1);
    expect(jawab.filter((x) => x.paksaDiabaikan).length).toBe(4);
    // Token TIDAK pernah sampai ke halaman - hanya nama blangko yang ada.
    for (const x of jawab) {
      expect(JSON.stringify(x)).not.toContain("DIR");
      expect([...x.ada].sort()).toEqual([BERKAS("sidang-pertama"), BERKAS("pemberitahuan-putusan")].sort());
    }

    dunia.jam += 61_000;
    const lagi = await minta(dunia, pekerja, pesan);
    expect(lagi.ok).toBe(true);
    expect(lagi.paksaDiabaikan).toBe("");
    expect(berandaAkar()).toBe(2);
  }, 60_000);
});

// ===========================================================================
// TOMBOL PERBARUI / MUAT ULANG SELAGI PUTARAN BERJALAN
// ===========================================================================

describe("telaah: tombol Perbarui / Muat ulang selagi putaran cetak belum selesai", () => {
  it("DITAHAN dengan peringatan (storage.session dikosongkan saat dimuat ulang); putarannya tetap tuntas", async () => {
    const dunia = new Dunia(abtPalsu());
    dunia.pembaruan = { status: "update_available", version: "9.9.9" };
    const pekerja = nyalakan(dunia);
    expect((await minta(dunia, pekerja, pesanMulai(ENAM))).ok).toBe(true);

    const perbarui = await minta(dunia, pekerja, { jenis: "perbarui" });
    expect(perbarui.ok).toBe(false);
    expect(perbarui.keadaan).toBe("putaran-relaas-berjalan");
    expect(perbarui.versiBaru).toBe("9.9.9");
    expect(perbarui.pesan).toMatch(/Putaran cetak relaas tanggal 2026-09-25 sedang berjalan: \d+ dari 6 dokumen selesai/);
    expect(perbarui.pesan).toContain("MENGHAPUS putaran itu");
    expect(perbarui.pesan).toContain("sekali lagi");

    const muatUlang = await minta(dunia, pekerja, { jenis: "muat-ulang" });
    expect(muatUlang.keadaan).toBe("putaran-relaas-berjalan");

    await jalankan(dunia, () => Boolean(dunia.putaran()?.selesai));
    expect(dunia.putaran().butir.every((b: any) => b.keadaan === "selesai")).toBe(true);
    expect(dunia.dimuatUlang).toBe(0);

    // Sesudah selesai tidak ada yang hilang - tidak ditahan lagi.
    const sesudah = await minta(dunia, pekerja, { jenis: "perbarui" });
    expect(sesudah.keadaan).toBe("dipasang");
    await jalankan(dunia, () => dunia.dimuatUlang > 0);
    expect(dunia.dimuatUlang).toBe(1);
  }, 60_000);

  it("tekanan KEDUA (paksa) memuat ulang walau putaran berjalan - pilihan petugas, bukan ALETA", async () => {
    const dunia = new Dunia(abtPalsu());
    const pekerja = nyalakan(dunia);
    expect((await minta(dunia, pekerja, pesanMulai(ENAM))).ok).toBe(true);
    const paksa = await minta(dunia, pekerja, { jenis: "muat-ulang", paksa: true });
    expect(paksa.ok).toBe(true);
    expect(paksa.keadaan).toBe("dimuat_ulang");
    await jalankan(dunia, () => dunia.dimuatUlang > 0);
    expect(dunia.dimuatUlang).toBe(1);
  }, 60_000);

  it("putaran yang masih DISIAPKAN (memanen blangko) juga menahan", async () => {
    const dunia = new Dunia(abtPalsu());
    const pekerja = nyalakan(dunia);
    const mulai = pekerja.kirim({ sumber: "aleta-panel", ...pesanMulai(ENAM) });
    await jalankan(dunia, () => dunia.permintaan.some((p) => p.alamat.includes("/abt/main/beranda")));
    expect(mulai.selesai()).toBe(false);
    const tahan = pekerja.kirim({ sumber: "aleta-panel", jenis: "muat-ulang" });
    await jalankan(dunia, () => tahan.selesai());
    expect(tahan.nilai().keadaan).toBe("putaran-relaas-berjalan");
    expect(tahan.nilai().pesan).toContain("sedang disiapkan");
    await jalankan(dunia, () => mulai.selesai());
    expect(dunia.dimuatUlang).toBe(0);
  }, 60_000);
});

describe("6 Okt 2026 malam: blangko ikrar diambil dari kelompok Relaas Ikrar Talak", () => {
  // Berkas [JS] 4 kini ada di folder derry (menu 900/981, proses 80-220) DAN di
  // folder menu 25 (proses 290-600). Perkara ikrar berproses 290+, jadi token
  // dari folder derry selalu ditolak ABT - urutan kelompok tidak boleh menentukan.
  const k = nyalakan(new Dunia(abtPalsu())).konteks;
  const IKRAR = "[JS] 4. Relaas Panggilan Ikrar Talak P dan T.rtf";
  const derry = { blangko: "Relaas Panggilan Sidang dan Pemberitahuan Putusan", berkas: IKRAR.replace(/\.rtf$/, ""), a: "aDerry", b: "bDerry" };
  const menu25 = { blangko: "Relaas Ikrar Talak", berkas: IKRAR.replace(/\.rtf$/, ""), a: "aIkrar", b: "bIkrar" };

  it("kelompok ikrar menang di urutan mana pun", () => {
    expect(k.relaasPetakanToken([IKRAR], [derry, menu25]).token[IKRAR].a).toBe("aIkrar");
    expect(k.relaasPetakanToken([IKRAR], [menu25, derry]).token[IKRAR].a).toBe("aIkrar");
  });

  it("tanpa kelompok ikrar, folder derry tetap dipakai (cadangan)", () => {
    expect(k.relaasPetakanToken([IKRAR], [derry]).token[IKRAR].a).toBe("aDerry");
  });

  it("blangko bukan ikrar tetap: yang pertama cocok menang", () => {
    const n = "[JS] 3.a. Permohonan Bantuan Panggilan Delegasi.rtf";
    const x = { ...derry, berkas: n.replace(/\.rtf$/, "") };
    const y = { ...menu25, berkas: n.replace(/\.rtf$/, "") };
    expect(k.relaasPetakanToken([n], [x, y]).token[n].a).toBe("aDerry");
  });
});
