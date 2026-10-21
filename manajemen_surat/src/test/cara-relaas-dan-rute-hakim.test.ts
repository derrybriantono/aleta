// @vitest-environment node

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * ============================================================================
 * DUA CACAT YANG SAMA-SAMA GAGAL DALAM DIAM
 * ============================================================================
 *
 * B5 - CARA PENYAMPAIAN RELAAS. ALETA membaca ket_temu milik SIPP sebagai
 * boolean: `ketTemu === "Y"`. Padahal kolom itu menyimpan CARA penyampaiannya,
 * dan SIPP memakai sembilan sandi. Terukur pada 14.495 baris relaas satker:
 *
 *     Y  5.084  Bertemu                      benar
 *     E  3.532  Panggilan Elektronik         SALAH -> "tidak bertemu"
 *     S  3.104  Diterima orang serumah       SALAH -> "tidak bertemu"
 *     T  2.667  Tidak Bertemu                benar
 *     R     45  Radiogram                    SALAH
 *     W     21  Pengumuman website/papan     SALAH
 *     N     14  Tidak Dapat Dilaksanakan     benar
 *     P      6  Pengumuman Bupati/email      SALAH
 *     M      3  Radiogram RRI                SALAH
 *
 *     6.725 dari 14.495 = 46,4% salah dilabeli.
 *
 * Yang paling merugikan bukan E melainkan S: "diterima orang serumah" adalah
 * penyampaian yang SAH menurut HIR - relaasnya patut dan sidangnya boleh
 * berjalan. Menyebutnya "tidak bertemu" membuat yang membacanya menunda sidang
 * yang sebenarnya sudah boleh jalan. Itu kerugian pada perkara orang.
 *
 * A3 - DAFTAR HAKIM PADA KONSEPTOR SEMENTARA tidak pernah terisi. Rutenya
 * membaca `pegawai.hakim` lewat cast, padahal gatewayFetch memulangkan
 * pembungkus { ok, data }. Nilainya SELALU undefined.
 *
 * Keduanya gagal dalam diam - tidak ada galat, tidak ada kalimat di layar -
 * dan itu yang membuat keduanya bertahan berbulan.
 */

const akar = path.resolve(process.cwd(), "..");
const baca = (jalur: string) =>
  readFileSync(path.join(akar, jalur), "utf8").replace(/\r\n/g, "\n");

const layanan = baca("aleta_bot/services/sippJadwalSidangService.js");
const sidang = baca("manajemen_surat/src/components/portal/aleta-ecourt-sidang.tsx");
const status = baca("manajemen_surat/src/components/portal/aleta-ecourt-status-perkara.tsx");
const gerbang = baca("manajemen_surat/src/server/modules/aleta-bot/whatsapp-gateway-client.ts");
const ruteHakim = baca("manajemen_surat/src/app/api/aleta-ecourt/hakim/route.ts");

describe("B5 - sembilan sandi ket_temu, bukan ya/tidak", () => {
  it("kesembilan sandi yang ada di data punya artinya", () => {
    // Bukan sekadar "ada tabelnya": kesembilan sandi inilah yang SUNGGUH ada
    // di SIPP satker. Yang hilang dari tabel akan jatuh ke "tidak dikenali",
    // dan itu kemunduran diam-diam bagi sandi yang tadinya terbaca.
    const i = layanan.indexOf("const SANDI_CARA_RELAAS = {");
    expect(i, "tabel sandinya tidak ketemu").toBeGreaterThan(-1);
    const blok = layanan.slice(i, layanan.indexOf("\n};", i));
    for (const sandi of ["Y", "T", "E", "N", "S", "R", "M", "W", "P"]) {
      expect(blok, `sandi ${sandi} hilang dari tabel`).toContain(`${sandi}: {`);
    }
  });

  it("yang SAMPAI dibedakan dari yang BERTEMU LANGSUNG", () => {
    // Inti perbaikannya. Panggilan elektronik sampai tanpa pertemuan
    // langsung, dan itu sah.
    const i = layanan.indexOf("const SANDI_CARA_RELAAS = {");
    const blok = layanan.slice(i, layanan.indexOf("\n};", i));
    const barisSandi = (s: string) => {
      const j = blok.indexOf(`${s}: {`);
      return blok.slice(j, blok.indexOf("\n", j));
    };
    expect(barisSandi("E"), "panggilan elektronik harus terhitung sampai").toContain("sampai: true");
    expect(barisSandi("T")).toContain("sampai: false");
    expect(barisSandi("N")).toContain("sampai: false");
  });

  it("SURAT TERCATAT tidak dinyatakan sampai oleh sandinya sendiri", () => {
    // Pada 22 September 2026 sandi 'S' saya artikan "Diterima orang serumah"
    // dan saya tandai sampai:true. Keduanya salah:
    //
    //   - Artinya SURAT TERCATAT (POS), menurut komentar kolom ket_temu pada
    //     skema SIPP - satu-satunya definisi resmi yang ada. Kalimat "tinggal
    //     serumah" yang saya baca kemarin ada di TEKS BEBAS ket_hasil_relaas,
    //     yang menerangkan apa yang terjadi, bukan cara panggilannya.
    //   - Surat yang DIKIRIM belum tentu SAMPAI. Yang menentukan status
    //     posnya, bukan sandinya; menuliskan true di sini menyatakan
    //     panggilan patut atas dasar yang belum diperiksa.
    const i = layanan.indexOf("const SANDI_CARA_RELAAS = {");
    const blok = layanan.slice(i, layanan.indexOf("\n};", i));
    const barisS = blok.slice(blok.indexOf("S: {"), blok.indexOf("\n", blok.indexOf("S: {")));
    expect(barisS).toContain("Surat tercatat");
    expect(barisS, "surat tercatat tidak boleh dinyatakan sampai oleh sandinya").toContain(
      "sampai: null"
    );
    expect(barisS, "arti lama yang keliru kembali").not.toContain("serumah");
  });

  it("arti tiap sandi sama dengan komentar kolom SIPP", () => {
    // Komentar kolom perkara_pelaksanaan_relaas.ket_temu:
    //   'Y / T, E=Elektonik, S=surat tercatat, W=Web/Papan Pengumuman
    //    Pengadilan, P=papan pengumuman pemda, M=media massa
    //    cetak/elektornik, R=radio'
    // Dua di antaranya pernah saya tebak dari teks bebasnya dan keduanya
    // meleset - penjaga ini mengunci artinya ke sumbernya.
    const i = layanan.indexOf("const SANDI_CARA_RELAAS = {");
    const blok = layanan.slice(i, layanan.indexOf("\n};", i));
    const barisSandi = (s: string) => {
      const j = blok.indexOf(`${s}: {`);
      return blok.slice(j, blok.indexOf("\n", j));
    };
    expect(barisSandi("E").toLowerCase()).toContain("elektronik");
    expect(barisSandi("S").toLowerCase()).toContain("surat tercatat");
    expect(barisSandi("R").toLowerCase()).toContain("radio");
    expect(barisSandi("M").toLowerCase()).toContain("media massa");
    expect(barisSandi("W").toLowerCase()).toContain("pengumuman");
    expect(barisSandi("P").toLowerCase()).toContain("pemda");
    // Arti lama 'M' yang keliru tidak boleh kembali.
    expect(barisSandi("M"), "M bukan radiogram RRI").not.toContain("Radiogram RRI");
  });

  it("sandi yang artinya DITEBAK ditandai, bukan disamakan dengan yang pasti", () => {
    // Y/T/E/N dibaca dari daftar pilihan SIPP sendiri. S/R/W/P/M tidak ada di
    // sana - artinya dibaca dari isi ket_hasil_relaas. Menyamakan keduanya
    // berarti menyatakan pasti atas dasar yang tidak pasti.
    const i = layanan.indexOf("const SANDI_CARA_RELAAS = {");
    const blok = layanan.slice(i, layanan.indexOf("\n};", i));
    const barisSandi = (s: string) => {
      const j = blok.indexOf(`${s}: {`);
      return blok.slice(j, blok.indexOf("\n", j));
    };
    for (const s of ["Y", "T", "E", "N"]) {
      expect(barisSandi(s), `${s} datang dari SIPP, seharusnya terbaca:true`).toContain(
        "terbaca: true"
      );
    }
    // S, R, W, P, dan M dulu ditandai terbaca:false karena saya kira artinya
    // hanya dugaan dari teks bebas. Ternyata kelimanya TERTULIS di komentar
    // kolom ket_temu - sumber yang sama resminya dengan dropdown SIPP. Jadi
    // kelimanya kini terbaca:true, dan yang tersisa terbaca:false hanya sandi
    // yang sungguh tidak dikenali.
    for (const s of ["S", "R", "W", "P", "M"]) {
      expect(barisSandi(s), `${s} tertulis di komentar kolom SIPP, seharusnya terbaca:true`).toContain(
        "terbaca: true"
      );
    }
  });

  it("sandi asing tidak ditebak ke salah satu sisi", () => {
    // Menebaknya "sampai" menyatakan panggilan patut atas dasar yang tidak
    // diketahui; menebaknya "gagal" mengulang cacat yang sedang diperbaiki.
    const i = layanan.indexOf("function caraRelaas(");
    const blok = layanan.slice(i, layanan.indexOf("\n}", i));
    expect(blok).toContain("sampai: null");
  });

  it("bertemu TIDAK dibuang - artinya masih tepat", () => {
    // Empat tempat di portal memakainya, dan "bertemu langsung" tetap keadaan
    // yang nyata. Yang ditambahkan keterangan di sebelahnya.
    // 21 Okt 2026: panggilan elektronik (E) dianggap bertemu.
    expect(layanan).toContain('bertemu: ["Y", "E"].includes(cleanText(row.ketTemu).toUpperCase())');
    expect(layanan).toContain("caraRelaas: caraRelaas(row.ketTemu)");
  });

  it("kedua layar memakainya, bukan hanya satu", () => {
    // Dua layar menampilkan relaas. Memperbaiki satu saja membuat keduanya
    // berselisih untuk perkara yang sama - dan yang membacanya tidak tahu
    // mana yang benar.
    expect(sidang, "layar jadwal sidang belum memakai caraRelaas").toContain("caraRelaas?.cara");
    expect(status, "layar status perkara belum memakai caraRelaas").toContain("caraRelaas?.cara");
  });

  it("warnanya mengikuti SAMPAI, bukan mengikuti bertemu langsung", () => {
    for (const [nama, isi] of [
      ["sidang", sidang],
      ["status", status],
    ] as const) {
      expect(isi, `${nama}: warnanya tidak mengikuti sampai`).toContain(
        "caraRelaas.sampai === true"
      );
    }
  });

  it("yang artinya ditebak dikatakan pada title, bukan didiamkan", () => {
    for (const isi of [sidang, status]) {
      expect(isi).toContain("tidak ada di daftar pilihan SIPP");
    }
  });

  it("angkanya TERTULIS supaya tabelnya tidak dipangkas saat merapikan", () => {
    const i = layanan.indexOf("SEMBILAN SANDI");
    expect(i).toBeGreaterThan(-1);
    const catatan = layanan.slice(i, i + 2000);
    expect(catatan).toContain("3.532");
    expect(catatan).toContain("3.104");
    expect(catatan).toContain("46,4%");
  });
});

describe("A3 - daftar hakim pada konseptor sementara", () => {
  it("pembungkus gerbang DIBUKA, bukan dibaca langsung", () => {
    expect(ruteHakim).toContain("if (!pegawai.ok)");
    expect(ruteHakim).toContain("pegawai.data?.hakim");
  });

  it("TIDAK ADA cast sama sekali di rute itu", () => {
    // Cast itulah yang membungkam tsc dan meloloskan cacatnya. GatewayResult
    // tidak punya ruas `hakim`; tanpa cast, pemeriksanya menolak di tempat.
    expect(ruteHakim).not.toContain(" as {");
    expect(ruteHakim).not.toContain("as unknown");
  });

  it("gagalnya bot dikatakan, bukan dijawab daftar kosong tanpa sebab", () => {
    // Versi lama memulangkan { ada: true, hakim: [], alasan: "" } - tidak ada
    // satu pun tanda bahwa ada yang rusak.
    const i = ruteHakim.indexOf("if (!pegawai.ok)");
    const blok = ruteHakim.slice(i, i + 320);
    expect(blok).toContain("alasan: pegawai.error");
  });

  it("bentuk pegawai penunjukan DISEBUTKAN di klien gerbang", () => {
    // Record<string, unknown> tampak aman, dan justru itu yang memaksa
    // pemanggilnya menebak - lalu menuliskan tebakannya sebagai cast.
    expect(gerbang).toContain("export type PegawaiPenunjukan");
    expect(gerbang).toContain("hakim?: PegawaiPenunjukan[]");
    const i = gerbang.indexOf("export async function gatewayPegawaiPenunjukan()");
    const blok = gerbang.slice(i, gerbang.indexOf("\n}\n", i));
    expect(blok, "tipenya masih longgar").not.toContain("Record<string, unknown>");
  });
});
