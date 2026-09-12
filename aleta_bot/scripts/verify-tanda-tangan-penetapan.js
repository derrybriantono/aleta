"use strict";

/**
 * ============================================================================
 * TANDA TANGAN DAN DOKUMEN PENETAPAN - YANG DIJAGA
 * ============================================================================
 *
 * Satu keputusan di sini lebih berat daripada seluruh keputusan lain di
 * ekstensi ini:
 *
 *     TANDA TANGAN YANG BELUM DISAHKAN TIDAK PERNAH DAPAT DIPAKAI.
 *
 * Pengukiran gambar dari berkas .doc kasar - ia menyapu bita mencari tanda
 * berkas PNG dan JPEG, dan urutan gambar di dalam wadah OLE2 tidak harus sama
 * dengan urutan nama di dalam teksnya. Tanda tangan yang terpasang pada nama
 * yang keliru adalah tanda tangan palsu pada penetapan pengadilan, dan tidak
 * ada satu galat pun yang akan berbunyi.
 *
 * Tiga penjaga menahannya: yang belum disahkan tidak pernah dipulangkan, yang
 * belum dinamai tidak dapat disahkan, dan mengganti nama MEMBATALKAN
 * pengesahannya.
 *
 * Berjalan tanpa jaringan dan tanpa basis data - kedua kolam diganti penadah.
 */

let lulus = 0;
let gagal = 0;

function periksa(nama, benar, tambahan = "") {
  if (benar) {
    lulus += 1;
    console.log(`  OK    ${nama}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${nama}${tambahan ? ` - ${tambahan}` : ""}`);
  }
}

// ---------------------------------------------------------------- penadah
const baris = [];
let idBerikut = 1;

const jalurBotDb = require.resolve("../bot_db_config");
require("../bot_db_config");
require.cache[jalurBotDb].exports = {
  query: (sql, params, selesai) => {
    const teks = String(sql).replace(/\s+/g, " ").trim();

    if (/^CREATE TABLE/i.test(teks)) return selesai(null, []);

    if (/^INSERT INTO aleta_bot_tanda_tangan/i.test(teks)) {
      baris.push({
        id: idBerikut,
        sidik: params[0],
        jenis_berkas: params[1],
        ukuran: params[2],
        isi: params[3],
        nama_pejabat: "",
        jabatan: "",
        disahkan: 0,
        disahkan_oleh: "",
        disahkan_pada: null,
        asal: params[4],
      });
      idBerikut += 1;
      return selesai(null, { insertId: idBerikut - 1 });
    }

    if (/^SELECT id FROM aleta_bot_tanda_tangan WHERE sidik/i.test(teks)) {
      return selesai(null, baris.filter((b) => b.sidik === params[0]).map((b) => ({ id: b.id })));
    }
    if (/^SELECT nama_pejabat, disahkan FROM/i.test(teks) || /^SELECT nama_pejabat FROM/i.test(teks)) {
      return selesai(null, baris.filter((b) => b.id === Number(params[0])));
    }
    if (/^SELECT jenis_berkas, isi FROM/i.test(teks)) {
      return selesai(null, baris.filter((b) => b.id === Number(params[0])));
    }
    if (/^SELECT id, nama_pejabat, jenis_berkas, isi FROM .* disahkan = 1/i.test(teks)) {
      return selesai(null, baris.filter((b) => b.disahkan === 1));
    }
    if (/^SELECT id, sidik, nama_pejabat/i.test(teks)) {
      const hanyaSah = /disahkan = 1/.test(teks);
      return selesai(null, hanyaSah ? baris.filter((b) => b.disahkan === 1) : baris);
    }

    if (/^UPDATE aleta_bot_tanda_tangan SET nama_pejabat = \?, jabatan = \?, disahkan = 0/i.test(teks)) {
      const b = baris.find((x) => x.id === Number(params[2]));
      if (b) {
        b.nama_pejabat = params[0];
        b.jabatan = params[1];
        b.disahkan = 0;
        b.disahkan_oleh = "";
        b.disahkan_pada = null;
      }
      return selesai(null, {});
    }
    if (/^UPDATE aleta_bot_tanda_tangan SET nama_pejabat = \?, jabatan = \? WHERE/i.test(teks)) {
      const b = baris.find((x) => x.id === Number(params[2]));
      if (b) {
        b.nama_pejabat = params[0];
        b.jabatan = params[1];
      }
      return selesai(null, {});
    }
    if (/^UPDATE aleta_bot_tanda_tangan SET disahkan = 1/i.test(teks)) {
      const b = baris.find((x) => x.id === Number(params[2]));
      if (b) {
        b.disahkan = 1;
        b.disahkan_oleh = params[0];
        b.disahkan_pada = params[1];
      }
      return selesai(null, {});
    }
    if (/^DELETE FROM aleta_bot_tanda_tangan/i.test(teks)) {
      const i = baris.findIndex((x) => x.id === Number(params[0]));
      if (i >= 0) baris.splice(i, 1);
      return selesai(null, {});
    }
    return selesai(null, []);
  },
};

const jalurSippDb = require.resolve("../db_config");
require("../db_config");
require.cache[jalurSippDb].exports = { query: (sql, params, selesai) => selesai(null, []) };

const ttd = require("../services/tandaTanganService");
const dokumen = require("../services/dokumenPenetapanService");

/** PNG terkecil yang sah, dipanjangkan supaya lolos batas ukuran. */
function pngPalsu(isian) {
  const kepala = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ekor = Buffer.from("IEND\xae\x42\x60\x82", "latin1");
  return Buffer.concat([kepala, Buffer.alloc(6000, isian), ekor]);
}

(async () => {
  console.log("tanda tangan dan dokumen penetapan");

  // ======================================================================
  // 1. Pengukiran gambar
  // ======================================================================
  {
    const doc = Buffer.concat([Buffer.alloc(100, 7), pngPalsu(1), Buffer.alloc(50, 9), pngPalsu(2)]);
    const gambar = ttd.ukirGambar(doc);
    periksa("dua gambar terukir dari wadah", gambar.length === 2, String(gambar.length));
    periksa("jenisnya dikenali", gambar.every((g) => g.jenis === "png"));

    // Yang terlalu kecil hampir pasti ikon, bukan tanda tangan.
    const kecil = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(20, 3),
      Buffer.from("IEND\xae\x42\x60\x82", "latin1"),
    ]);
    periksa("gambar mungil dilewati", ttd.ukirGambar(kecil).length === 0);
  }

  // ======================================================================
  // 2. Impor - seluruhnya BELUM DISAHKAN
  // ======================================================================
  {
    baris.length = 0;
    idBerikut = 1;
    const doc = Buffer.concat([pngPalsu(11), pngPalsu(22), pngPalsu(11)]);
    const hasil = await ttd.impor(doc, { asal: "uji.doc", oleh: "UJI" });
    periksa("gambar kembar tidak masuk dua kali", hasil.masuk === 2 && hasil.dilewati === 1, `${hasil.masuk}/${hasil.dilewati}`);
    periksa("seluruhnya masuk belum disahkan", baris.every((b) => b.disahkan === 0));
    periksa("seluruhnya masuk tanpa nama", baris.every((b) => !b.nama_pejabat));
  }

  // ======================================================================
  // 3. YANG PALING PENTING - belum disahkan tidak pernah dipulangkan
  // ======================================================================
  {
    const b = baris[0];
    await ttd.namai(b.id, { namaPejabat: "Abdul Salam, S.H.I., M.H.", jabatan: "Ketua" });
    periksa("dinamai tetapi belum disahkan", b.nama_pejabat !== "" && b.disahkan === 0);

    const belum = await ttd.untukPejabat("Abdul Salam, S.H.I., M.H.");
    periksa("yang belum disahkan TIDAK dipulangkan", belum === null);

    const tanpaNama = await ttd.sahkan(baris[1].id, { oleh: "UJI" });
    periksa("yang belum dinamai tidak dapat disahkan", tanpaNama.ok === false && tanpaNama.alasan === "belum_dinamai");

    const tanpaPengesah = await ttd.sahkan(b.id, { oleh: "" });
    periksa("pengesah harus dikenali", tanpaPengesah.ok === false && tanpaPengesah.alasan === "pengesah_tidak_dikenali");

    await ttd.sahkan(b.id, { oleh: "SUPER ADMIN DERRY" });
    const sudah = await ttd.untukPejabat("Abdul Salam, S.H.I., M.H.");
    periksa("sesudah disahkan barulah dipulangkan", Boolean(sudah) && sudah.id === b.id);
    periksa("pengesahnya tercatat", b.disahkan_oleh === "SUPER ADMIN DERRY");

    // Nama dicocokkan sesudah dibakukan - SIPP, ABT, dan berkas .doc
    // menuliskan gelar dengan tiga cara yang berbeda.
    const lainCara = await ttd.untukPejabat("ABDUL SALAM S.H.I M.H");
    periksa("nama dicocokkan sesudah dibakukan", Boolean(lainCara) && lainCara.id === b.id);
  }

  // ======================================================================
  // 4. Mengganti nama MEMBATALKAN pengesahan
  // ======================================================================
  {
    const b = baris[0];
    const hasil = await ttd.namai(b.id, { namaPejabat: "Orang Lain, S.H." });
    periksa("pengesahannya dibatalkan", hasil.pengesahanDibatalkan === true && b.disahkan === 0);
    periksa("dan pengesah lamanya ikut dihapus", b.disahkan_oleh === "");
    periksa(
      "sesudah itu tidak dapat dipakai lagi",
      (await ttd.untukPejabat("Orang Lain, S.H.")) === null
    );

    // Menamai ulang dengan nama yang SAMA tidak membatalkan apa pun.
    await ttd.sahkan(b.id, { oleh: "SUPER ADMIN DERRY" });
    const lagi = await ttd.namai(b.id, { namaPejabat: "Orang Lain, S.H.", jabatan: "Hakim" });
    periksa("menamai ulang dengan nama yang sama tidak membatalkan", lagi.pengesahanDibatalkan === false && b.disahkan === 1);
    periksa("dan catatan pengesahnya tidak hilang", b.disahkan_oleh === "SUPER ADMIN DERRY");
  }

  // ======================================================================
  // 5. Membubuhkan ke blangko ABT yang SUNGGUHAN
  // ======================================================================
  {
    const fs = require("node:fs");
    const jalurBlangko = "D:/Download File/173_Pdt.P_2025_PA.Dgl - @PMH.rtf";
    if (!fs.existsSync(jalurBlangko)) {
      console.log("  (blangko contoh tidak ada di mesin ini - bagian ini dilewati)");
    } else {
      const rtf = fs.readFileSync(jalurBlangko, "latin1");

      const ada = dokumen.sisipkanTandaTangan(rtf, {
        isi: pngPalsu(5),
        jenis: "png",
        namaPejabat: "Abdul Salam, S.H.I., M.H.",
      });
      periksa("tanda tangan dibubuhkan pada blangko sungguhan", ada.ok === true, ada.alasan || "");
      periksa("berkasnya bertambah panjang", ada.ok && ada.rtf.length > rtf.length);
      periksa("kelompok gambar RTF tertulis", ada.ok && ada.rtf.includes("\\pict\\pngblip"));

      // Nama yang TIDAK ada di blangko ditolak - membubuhkannya di tempat lain
      // menghasilkan penetapan yang tanda tangannya melayang entah di mana.
      const asing = dokumen.sisipkanTandaTangan(rtf, {
        isi: pngPalsu(5),
        jenis: "png",
        namaPejabat: "Nama Yang Tidak Pernah Ada, S.H.",
      });
      periksa(
        "nama yang tidak ada di blangko DITOLAK",
        asing.ok === false && asing.alasan === "nama_pejabat_tidak_ada_di_blangko"
      );

      // Nama di dalam RTF terpotong kendali gaya; pencarian untai biasa tidak
      // akan pernah menemukannya.
      periksa(
        "nama ketemu walau terpotong kendali RTF",
        dokumen.cariPosisiNama(rtf, ttd.bakuNama("Abdul Salam, S.H.I., M.H.")) > 0
      );
    }
  }

  // ======================================================================
  // 6. Bentuk baris SIPP
  // ======================================================================
  {
    periksa(
      "penomoran jenis dokumen sama dengan yang dipakai SIPP",
      dokumen.JENIS_DOKUMEN_ID.pmh === 1 &&
        dokumen.JENIS_DOKUMEN_ID.ppp === 2 &&
        dokumen.JENIS_DOKUMEN_ID.pjs === 3 &&
        dokumen.JENIS_DOKUMEN_ID.phs === 4
    );
    periksa(
      "perkara_penetapan_id menunjuk tabel yang berbeda tiap jenis",
      dokumen.TABEL_PENETAPAN.pmh === "perkara_hakim_pn" &&
        dokumen.TABEL_PENETAPAN.ppp === "perkara_panitera_pn" &&
        dokumen.TABEL_PENETAPAN.pjs === "perkara_jurusita" &&
        dokumen.TABEL_PENETAPAN.phs === "perkara_penetapan_hari_sidang"
    );
    periksa(
      "nomor perkara dibersihkan seperti SIPP menuliskannya",
      dokumen.nomorBersih("225/Pdt.P/2026/PA.Dgl") === "225_PdtP_2026_PADgl",
      dokumen.nomorBersih("225/Pdt.P/2026/PA.Dgl")
    );
    const jalur = dokumen.jalurDokumen("225/Pdt.P/2026/PA.Dgl", "pmh", new Date(2026, 8, 12));
    periksa(
      "jalur berkasnya sebentuk dengan yang sudah ada",
      /^resources\/file\/doc\/2026\/09\/225_PdtP_2026_PADgl\/225_PdtP_2026_PADgl_Dokumen_PMH_\d+\.pdf$/.test(jalur),
      jalur
    );
  }

  // ======================================================================
  // 7. Alamat blangko tidak pernah ditebak
  // ======================================================================
  {
    const atur = dokumen.pengaturanBlangko({});
    periksa("bawaannya mati sampai disetel", atur.aktif === false);
    periksa("dan alamatnya kosong, bukan tebakan", !atur.pmh && !atur.ppp && !atur.pjs && !atur.phs);

    const mati = await dokumen.ambilBlangko("pmh", "1/Pdt.G/2026/PA.Dgl");
    periksa("blangko tidak diambil selagi mati", mati.ok === false && mati.alasan === "blangko_belum_dinyalakan");

    const hasil = await dokumen.terbitkan({
      perkaraId: 1,
      nomorPerkara: "1/Pdt.G/2026/PA.Dgl",
      jenis: "pmh",
      namaPenandatangan: "Siapa Saja",
    });
    periksa("menerbitkan berhenti di langkah blangko", hasil.ok === false && hasil.langkah === "blangko");
  }

  console.log("");
  console.log(`lulus ${lulus}, gagal ${gagal}`);
  process.exit(gagal > 0 ? 1 : 0);
})().catch((galat) => {
  console.error("GALAT:", String(galat.stack || galat.message || galat).slice(0, 600));
  process.exit(1);
});
