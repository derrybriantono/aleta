"use strict";

/**
 * Jadwal perkara yang bersidang.
 *
 * ============================================================================
 * MENJALANKAN KUERINYA, BUKAN MEMBACA TULISANNYA
 * ============================================================================
 *
 * db_config diganti tiruan sebelum layanannya dimuat, sehingga kueri yang
 * BENAR-BENAR ditembakkan dapat diperiksa - termasuk apa yang masuk sebagai
 * parameter dan apa yang menjadi teks kueri. Tidak ada database yang disentuh.
 */

const pathx = require("path");

let lulus = 0;
let gagal = 0;

function periksa(nama, benar) {
  if (benar) {
    lulus += 1;
    console.log(`  OK    ${nama}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${nama}`);
  }
}

// --- SIPP palsu -------------------------------------------------------------

let jawaban = {};
const kueri = [];

/**
 * Mencocokkan kueri ke jawaban palsu, dari yang PALING KHUSUS lebih dulu.
 *
 * Urutannya penting: kueri relaas ikut menyambung perkara_jurusita, sehingga
 * memeriksa perkara_jurusita lebih dulu akan menjawabnya dengan daftar
 * jurusita - dan pemeriksaan relaas gagal karena tiruannya, bukan karena
 * layanannya.
 */
function cocokkan(sql) {
  const teks = String(sql);
  if (teks.includes("FROM perkara_pelaksanaan_relaas")) return jawaban.relaas || [];
  // Kalender dan daftar sidang sama-sama dari perkara_jadwal_sidang -
  // yang membedakan hanya GROUP BY-nya.
  if (teks.includes("GROUP BY j.tanggal_sidang")) return jawaban.kalender || [];
  if (teks.includes("FROM perkara_jadwal_sidang")) return jawaban.sidang || [];
  if (teks.includes("FROM perkara p WHERE p.nomor_perkara")) return jawaban.perkara || [];
  // Petugas kini diambil BERKELOMPOK - satu kueri untuk seluruh daftar,
  // bukan subkueri per baris. Jawabannya berbentuk daftar ber-perkaraId.
  if (teks.includes("FROM perkara_hakim_pn")) return jawaban.majelisKelompok || jawaban.majelis || [];
  if (teks.includes("FROM perkara_panitera_pn")) return jawaban.paniteraKelompok || jawaban.panitera || [];
  if (teks.includes("FROM perkara_jurusita")) return jawaban.jurusitaKelompok || jawaban.jurusita || [];
  if (teks.includes("FROM perkara_putusan")) return jawaban.putusanKelompok || [];
  // Sisi pihak yang ada pada perkara - dibedakan dari daftar pihak biasa
  // lewat GROUP BY-nya, karena keduanya membaca tabel yang sama.
  if (teks.includes("GROUP BY vp.perkara_id, vp.pihak_ke")) return jawaban.sisiPihak || [];
  if (teks.includes("FROM v_pihak_perkara")) return jawaban.pihakKelompok || [];
  if (teks.includes("FROM perkara_efiling_id")) return jawaban.efiling || [];
  if (teks.includes("FROM perkara_keterangan_saksi")) return jawaban.saksi || [];
  if (teks.includes("FROM perkara_dokumen")) return jawaban.dokumen || [];
  return [];
}

const dbPath = require.resolve(pathx.resolve(__dirname, "..", "db_config.js"));
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    query(sql, params, callback) {
      kueri.push({ sql: String(sql), params: params || [] });
      callback(null, cocokkan(sql));
    },
  },
};

const layanan = require("../services/sippJadwalSidangService");

const NOMOR = "620/Pdt.G/2025/PA.Dgl";

function bersihkan() {
  kueri.length = 0;
}

async function jalan() {
  console.log("\n== Pencarian jadwal mencakup nama pihak ==");
  {
    bersihkan();
    jawaban = { sidang: [] };
    await layanan.daftarSidang({ dari: "2026-09-05", sampai: "2026-09-05", cari: "Dirman" });
    const sql = kueri[0] ? kueri[0].sql : "";

    // Yang berdiri di layar sentuh ruang tunggu membawa NAMANYA, bukan nomor
    // perkaranya. Selama pencarian jadwal hanya mencocokkan nomor perkara,
    // jenis, dan agenda, antrian mandiri tidak dapat dipakai sama sekali -
    // dan kegagalannya sunyi: yang muncul "tidak ada sidang yang cocok",
    // persis seperti kalau orangnya memang tidak bersidang hari itu.
    periksa("nama pihak ikut dicari", /v_pihak_perkara/.test(sql));
    periksa("nomor perkara tetap dicari", /nomor_perkara LIKE/.test(sql));
    periksa("agenda tetap dicari", /agenda LIKE/.test(sql));

    // EXISTS, bukan JOIN: perkara dengan lima pihak yang semuanya cocok tidak
    // boleh muncul lima kali di jadwal.
    periksa("memakai EXISTS, bukan JOIN pihak", /EXISTS \(SELECT 1 FROM v_pihak_perkara/.test(sql));

    const params = kueri[0] ? kueri[0].params : [];
    periksa(
      "kata carinya lewat parameter, empat kali",
      params.filter((x) => x === "%Dirman%").length === 4
    );
  }
  {
    bersihkan();
    const jahat = "%' OR '1'='1";
    await layanan.daftarSidang({ dari: "2026-09-05", sampai: "2026-09-05", cari: jahat });
    periksa(
      "kata cari jahat tidak pernah menjadi teks kueri",
      kueri.every((k) => !k.sql.includes("OR '1'='1"))
    );
  }

  console.log("\n== Rentang tanggal ==");
  {
    bersihkan();
    jawaban = { sidang: [] };
    const hasil = await layanan.daftarSidang({ dari: "2026-08-30", sampai: "2026-09-01" });
    periksa("tanggal sah diteruskan apa adanya", hasil.dari === "2026-08-30" && hasil.sampai === "2026-09-01");
    periksa("tanggal masuk sebagai parameter", kueri[0].params.includes("2026-08-30"));
  }
  {
    bersihkan();
    const hasil = await layanan.daftarSidang({});
    // Sifat yang dijaga: tanpa tanggal, yang ditampilkan hari ini - bukan
    // seluruh riwayat sidang pengadilan sejak berdiri.
    periksa("tanpa tanggal jatuh ke hari ini", /^\d{4}-\d{2}-\d{2}$/.test(hasil.dari) && hasil.dari === hasil.sampai);
  }
  {
    bersihkan();
    const jahat = "2026-08-30' OR '1'='1";
    const hasil = await layanan.daftarSidang({ dari: jahat, sampai: jahat });
    // Sifat yang dijaga: tanggal yang tidak berpola YYYY-MM-DD DITOLAK dan
    // diganti hari ini. Tanggal ikut menyusun rentang, dan meloloskannya
    // apa adanya membuka jalan yang tidak perlu ada.
    periksa("tanggal cacat ditolak, diganti hari ini", hasil.dari !== jahat);
    periksa(
      "teks jahat tidak pernah sampai ke kueri",
      kueri.every((k) => !k.sql.includes("OR '1'='1") && !JSON.stringify(k.params).includes("OR '1'='1"))
    );
  }

  console.log("\n== Satu sidang tetap satu baris ==");
  {
    bersihkan();
    jawaban = {
      sidang: [
        {
          sidangId: 11,
          perkaraId: 620,
          nomorPerkara: NOMOR,
          jenisPerkara: "Cerai Talak",
          tanggalSidang: "2026-08-30",
          jamSidang: "09:00:00",
          agenda: "Pembuktian",
          ruangan: "Sidang 1",
          ditunda: "T",
        },
      ],
      majelisKelompok: [{ perkaraId: 620, kode: "H1-H2-H3", nama: "Ahmad, Budi, Citra" }],
      paniteraKelompok: [{ perkaraId: 620, nama: "Dewi" }],
      jurusitaKelompok: [{ perkaraId: 620, nama: "Eko" }],
    };
    const hasil = await layanan.daftarSidang({ dari: "2026-08-30" });

    periksa("satu sidang menghasilkan satu baris", hasil.sidang.length === 1);
    periksa("kode majelis terbaca utuh", hasil.sidang[0].majelisKode === "H1-H2-H3");
    periksa("panitera sidang terbaca", hasil.sidang[0].paniteraNama === "Dewi");
    periksa("jurusita terbaca", hasil.sidang[0].jurusitaNama === "Eko");
    periksa("jam dipendekkan tanpa detik", hasil.sidang[0].jamSidang === "09:00");
    periksa("sidang tidak ditunda ditandai benar", hasil.sidang[0].ditunda === false);
  }
  {
    bersihkan();
    jawaban.sidang[0].ditunda = "Y";
    const hasil = await layanan.daftarSidang({ dari: "2026-08-30" });
    periksa("sidang ditunda dikenali", hasil.sidang[0].ditunda === true);
    jawaban.sidang[0].ditunda = "T";
  }

  console.log("\n== Rincian sidang ==");
  {
    bersihkan();
    jawaban = {
      perkara: [{ perkaraId: 620, jenisPerkara: "Cerai Talak" }],
      majelis: [
        { kode: "H1", nama: "Ahmad", jabatan: "Ketua Majelis", urutan: 1 },
        { kode: "H2", nama: "Budi", jabatan: "Anggota", urutan: 2 },
      ],
      panitera: [{ kode: "P1", nama: "Dewi" }],
      jurusita: [{ kode: "J1", nama: "Eko" }],
      saksi: [{ jumlahSaksi: 2, jumlahKeterangan: 14 }],
      relaas: [
        {
          id: 5,
          pihakId: 9,
          tanggalRelaas: "2026-08-25",
          ketTemu: "Y",
          noResiPos: "",
          docRelaas: "relaas/5.pdf",
          docResi: "",
          jurusitaNama: "Eko",
          namaPihak: "Fulan",
        },
      ],
      dokumen: [{ id: 3, namaDokumen: "Gugatan", namaFile: "gugatan.pdf", ukuranFile: 2048, keterangan: "" }],
    };

    const hasil = await layanan.rincianSidang(NOMOR, 11);

    periksa("rincian terbaca", hasil.ok === true);
    periksa("majelis berurut sesuai kedudukan", hasil.majelis[0].jabatan === "Ketua Majelis");
    periksa("panitera terbaca", hasil.panitera[0].nama === "Dewi");
    periksa("jurusita terbaca", hasil.jurusita[0].nama === "Eko");
    periksa("saksi dikenali ada", hasil.saksi.ada === true && hasil.saksi.jumlahSaksi === 2);
    periksa("relaas bertemu langsung dikenali", hasil.relaas[0].bertemu === true);
    periksa("berkas relaas ditandai ada", hasil.relaas[0].adaDokumen === true);
    // Sifat yang dijaga: kolom resi kosong TIDAK boleh terbaca sebagai ada -
    // tombol unduh yang muncul untuk berkas yang tidak ada hanya menghasilkan
    // kegagalan yang membingungkan.
    periksa("berkas resi kosong ditandai tidak ada", hasil.relaas[0].adaResi === false);
    periksa("dokumen SIPP terbaca", hasil.dokumenSipp[0].namaDokumen === "Gugatan");
    periksa(
      "nomor perkara dikirim sebagai parameter",
      kueri.some((k) => (k.params || []).includes(NOMOR))
    );
    periksa(
      "nomor perkara tidak pernah disambung ke teks kueri",
      kueri.every((k) => !k.sql.includes(NOMOR))
    );
  }
  {
    bersihkan();
    jawaban = { perkara: [{ perkaraId: 620, jenisPerkara: "Cerai Talak" }], saksi: [{ jumlahSaksi: 0, jumlahKeterangan: 0 }] };
    const hasil = await layanan.rincianSidang(NOMOR, 11);
    periksa("tanpa saksi ditandai belum ada", hasil.saksi.ada === false);
  }
  {
    bersihkan();
    jawaban = { perkara: [] };
    const hasil = await layanan.rincianSidang(NOMOR, 11);
    periksa("perkara tidak ada ditolak", hasil.ok === false && hasil.alasan === "perkara_tidak_ditemukan");
  }
  {
    bersihkan();
    const hasil = await layanan.rincianSidang("", 11);
    periksa("nomor kosong ditolak", hasil.ok === false);
    periksa("nomor kosong tidak menembak kueri", kueri.length === 0);
  }

  console.log("\n== Jalur berkas dicari di database ==");
  {
    bersihkan();
    jawaban = { dokumen: [{ lokasi: "upload/perkara", nama: "gugatan.pdf", judul: "Gugatan" }] };
    const hasil = await layanan.jalurDokumenSipp("dokumen", 3);
    periksa("jalur dokumen disusun dari lokasi dan nama", hasil.jalur === "upload/perkara/gugatan.pdf");
  }
  {
    bersihkan();
    // Sifat yang dijaga: jenis di luar daftar TIDAK dilayani. Tanpa ini,
    // jenis bebas akan berubah menjadi nama kolom atau tabel.
    periksa("jenis tak dikenal ditolak", (await layanan.jalurDokumenSipp("apa-saja", 3)) === null);
    periksa("nomor bukan angka ditolak", (await layanan.jalurDokumenSipp("dokumen", "3; DROP TABLE") ) === null);
    periksa("nomor nol ditolak", (await layanan.jalurDokumenSipp("dokumen", 0)) === null);
    periksa("tidak ada kueri untuk masukan cacat", kueri.length === 0);
  }
  {
    bersihkan();
    jawaban = { relaas: [{ berkas: "relaas/5.pdf" }] };
    const hasil = await layanan.jalurDokumenSipp("relaas", 5);
    periksa("jalur relaas terbaca", hasil.jalur === "relaas/5.pdf");
    periksa("kueri relaas memakai kolom doc_relaas", kueri[0].sql.includes("doc_relaas"));
    periksa("kueri relaas tidak menyentuh doc_resi", !kueri[0].sql.includes("doc_resi"));
  }
  {
    bersihkan();
    jawaban = { relaas: [{ berkas: "resi/5.pdf" }] };
    await layanan.jalurDokumenSipp("resi", 5);
    periksa("kueri resi memakai kolom doc_resi", kueri[0].sql.includes("doc_resi"));
    periksa("kueri resi tidak menyentuh doc_relaas", !kueri[0].sql.includes("doc_relaas"));
  }

  console.log("\n== Kalender sidang ==");
  {
    bersihkan();
    jawaban = { kalender: [{ tanggal: "2026-08-30", jumlah: 4, jumlahDitunda: 1 }] };
    const hasil = await layanan.rekapBulanSidang("2026-08");

    periksa("bulan sah diterima", hasil.bulan === "2026-08");
    // Sifat yang dijaga: rentangnya menutup SELURUH bulan. Salah hari terakhir
    // membuat sidang tanggal 31 hilang dari kalender tanpa ada yang tahu.
    periksa("rentang menutup seluruh bulan", hasil.awal === "2026-08-01" && hasil.akhir === "2026-08-31");
    periksa("hitungan per hari terbaca", hasil.hari[0].jumlah === 4);
    periksa("jumlah ditunda terbaca", hasil.hari[0].jumlahDitunda === 1);
    periksa("rentang masuk sebagai parameter", kueri[0].params.includes("2026-08-01"));
  }
  {
    bersihkan();
    // Februari 2028 kabisat: hari terakhirnya 29, bukan 28.
    const hasil = await layanan.rekapBulanSidang("2028-02");
    periksa("Februari kabisat berakhir tanggal 29", hasil.akhir === "2028-02-29");
  }
  {
    bersihkan();
    const hasil = await layanan.rekapBulanSidang("2027-02");
    periksa("Februari biasa berakhir tanggal 28", hasil.akhir === "2027-02-28");
  }
  {
    bersihkan();
    for (const cacat of ["2026-13", "2026-8", "abc", "", "2026-08-01"]) {
      const hasil = await layanan.rekapBulanSidang(cacat);
      periksa(`bulan cacat ditolak: ${cacat || "(kosong)"}`, hasil.bulan === "" && hasil.hari.length === 0);
    }
    // Sifat yang dijaga: masukan cacat tidak menyentuh SIPP sama sekali.
    periksa("bulan cacat tidak menembak kueri", kueri.length === 0);
  }

  console.log("\n== Jadwal seluruh sidang satu perkara ==");
  {
    bersihkan();
    jawaban = {
      sidang: [
        { sidangId: 1, tanggalSidang: "2026-07-01", jamSidang: "09:00:00", agenda: "Pembacaan gugatan", ruangan: "1", ditunda: "T", alasanDitunda: "" },
        { sidangId: 2, tanggalSidang: "2026-07-15", jamSidang: "10:00:00", agenda: "Mediasi", ruangan: "1", ditunda: "Y", alasanDitunda: "Pihak tidak hadir" },
      ],
    };
    const hasil = await layanan.jadwalPerkara(NOMOR);

    periksa("seluruh sidang perkara terbaca", hasil.length === 2);
    periksa("sidang ditunda dikenali", hasil[1].ditunda === true);
    periksa("alasan penundaan terbawa", hasil[1].alasanDitunda === "Pihak tidak hadir");
    periksa("nomor perkara sebagai parameter", kueri[0].params.includes(NOMOR));
  }
  {
    bersihkan();
    const hasil = await layanan.jadwalPerkara("");
    periksa("nomor kosong menghasilkan daftar kosong", hasil.length === 0);
    periksa("nomor kosong tidak menembak kueri", kueri.length === 0);
  }

    console.log("\n== Relaas tanpa nomor sidang: seluruh perkara ==");
  {
    bersihkan();
    jawaban = {
      perkara: [{ perkaraId: 620, jenisPerkara: "Cerai Talak" }],
      relaas: [
        { id: 1, sidangId: 11, tanggalSidang: "2026-08-01", tanggalRelaas: "2026-07-20" },
        { id: 2, sidangId: 12, tanggalSidang: "2026-08-15", tanggalRelaas: "2026-08-05" },
      ],
      saksi: [{ jumlahSaksi: 0, jumlahKeterangan: 0 }],
    };
    // Nomor sidang 0 - inilah yang dipakai layar status perkara.
    const hasil = await layanan.rincianSidang(NOMOR, 0);

    // Sifat yang dijaga: tanpa nomor sidang, relaas SELURUH perkara terbaca.
    // Sebelumnya keadaan ini dijawab daftar kosong, sehingga perkara yang
    // relaasnya lengkap terbaca seolah belum pernah dipanggil sama sekali.
    periksa("tanpa nomor sidang: relaas perkara terbaca", hasil.relaas.length === 2);
    periksa("nomor sidang tiap relaas dibawa", hasil.relaas[0].sidangId === "11");
    periksa("tanggal sidang tiap relaas dibawa", hasil.relaas[0].tanggalSidang === "2026-08-01");

    const kueriRelaas = kueri.find((k) => k.sql.includes("FROM perkara_pelaksanaan_relaas"));
    periksa("kueri relaas terbentuk", Boolean(kueriRelaas));
    // Sifat yang dijaga: tanpa nomor sidang, penyaring sidang TIDAK ikut -
    // dan hanya perkara_id yang masuk sebagai parameter.
    periksa(
      "tanpa nomor sidang: penyaring sidang tidak dipasang",
      kueriRelaas ? !kueriRelaas.sql.includes("r.sidang_id = ?") : false
    );
    periksa(
      "tanpa nomor sidang: satu parameter saja",
      kueriRelaas ? kueriRelaas.params.length === 1 : false
    );
  }
  {
    bersihkan();
    const hasil = await layanan.rincianSidang(NOMOR, 11);
    const kueriRelaas = kueri.find((k) => k.sql.includes("FROM perkara_pelaksanaan_relaas"));

    // Sifat yang dijaga: DENGAN nomor sidang, penyaringnya kembali dipasang -
    // layar jadwal hanya boleh melihat relaas sidang yang dibuka.
    periksa(
      "dengan nomor sidang: penyaring sidang dipasang",
      kueriRelaas ? kueriRelaas.sql.includes("r.sidang_id = ?") : false
    );
    periksa(
      "dengan nomor sidang: dua parameter",
      kueriRelaas ? kueriRelaas.params.length === 2 : false
    );
    periksa("nomor sidang masuk sebagai parameter", kueriRelaas ? kueriRelaas.params.includes(11) : false);
    periksa("rincian tetap terbaca", hasil.ok === true);
  }
console.log("\n== Panggilan: hanya sisi yang ada yang wajib dipanggil ==");
  {
    bersihkan();
    // Permohonan sidang pertama: hanya ada pemohon, dan relaasnya sudah ada.
    jawaban = {
      sidang: [{ sidangId: 21, perkaraId: 215, tanggalSidang: "2026-08-30" }],
      sisiPihak: [{ perkaraId: 215, pihakKe: 1 }],
      relaas: [{ sidangId: 21, pihakKe: 1, statusPos: 1, tanggalRelaas: "2026-08-20" }],
    };
    const hasil = await layanan.keadaanPanggilanSidang([{ sidangId: 21, perkaraId: 215 }]);

    // Sifat yang dijaga: termohon yang TIDAK ADA tidak boleh dituntut
    // panggilan. Tanpa ini hampir seluruh Pdt.P tertandai belum dipanggil,
    // dan peringatan yang selalu menyala berhenti dibaca.
    periksa(
      "permohonan berpihak tunggal: hanya sisi 1 yang wajib",
      JSON.stringify(hasil["21"].wajibDipanggil) === "[1]"
    );
    periksa("permohonan berpihak tunggal: tidak ada yang belum dipanggil", hasil["21"].belumDipanggil === 0);
    periksa("permohonan berpihak tunggal: ditandai aman", hasil["21"].aman === true);
  }
  {
    bersihkan();
    // Panggilan elektronik: relaasnya ada, tetapi kedudukan pihaknya tidak
    // terbaca karena sambungan ke v_pihak_perkara kosong.
    jawaban = {
      sidang: [{ sidangId: 21, perkaraId: 215, tanggalSidang: "2026-08-30" }],
      sisiPihak: [{ perkaraId: 215, pihakKe: 1 }],
      relaas: [{ sidangId: 21, pihakKe: null, statusPos: 1, tanggalRelaas: "2026-08-20" }],
    };
    const hasil = await layanan.keadaanPanggilanSidang([{ sidangId: 21, perkaraId: 215 }]);

    // Sifat yang dijaga: relaas yang JELAS ada - tanggalnya terisi - tidak
    // boleh diabaikan hanya karena kedudukan pihaknya tidak terbaca.
    periksa("relaas elektronik tanpa kedudukan tetap dihitung", hasil["21"].belumDipanggil === 0);
    periksa("asal relaas tanpa kedudukan disebutkan", hasil["21"].relaasTanpaKedudukan === 1);
    periksa(
      "sisi pihak yang ada ikut dilaporkan",
      JSON.stringify(hasil["21"].sisiPihakAda) === "[1]"
    );
  }
  {
    bersihkan();
    // Perkara gugatan dua pihak, sidang pertama, tanpa relaas sama sekali.
    jawaban = {
      sidang: [{ sidangId: 31, perkaraId: 620, tanggalSidang: "2026-08-30" }],
      sisiPihak: [
        { perkaraId: 620, pihakKe: 1 },
        { perkaraId: 620, pihakKe: 2 },
      ],
      relaas: [],
    };
    const hasil = await layanan.keadaanPanggilanSidang([{ sidangId: 31, perkaraId: 620 }]);

    // Sifat yang dijaga: pelonggaran di atas TIDAK boleh membungkam perkara
    // yang memang belum dipanggil.
    periksa("dua pihak tanpa relaas: keduanya belum dipanggil", hasil["31"].belumDipanggil === 2);
    periksa("dua pihak tanpa relaas: tidak ditandai aman", hasil["31"].aman === false);
  }
  {
    bersihkan();
    // Sidang lanjutan: pada sidang sebelumnya hanya penggugat yang hadir,
    // sehingga yang wajib dipanggil tinggal tergugat.
    jawaban = {
      sidang: [
        { sidangId: 41, perkaraId: 620, tanggalSidang: "2026-08-01", dihadiriOleh: 2 },
        { sidangId: 42, perkaraId: 620, tanggalSidang: "2026-08-30", dihadiriOleh: null },
      ],
      sisiPihak: [
        { perkaraId: 620, pihakKe: 1 },
        { perkaraId: 620, pihakKe: 2 },
      ],
      relaas: [],
    };
    const hasil = await layanan.keadaanPanggilanSidang([
      { sidangId: 41, perkaraId: 620 },
      { sidangId: 42, perkaraId: 620 },
    ]);

    // Sifat yang dijaga: yang HADIR sudah diberitahu di ruang sidang dan
    // tidak perlu dipanggil lagi - hanya yang tidak hadir yang dipanggil.
    periksa(
      "sidang lanjutan: hanya yang tidak hadir yang wajib dipanggil",
      JSON.stringify(hasil["42"].wajibDipanggil) === "[2]"
    );
    periksa("sidang lanjutan: satu sisi belum dipanggil", hasil["42"].belumDipanggil === 1);
    // Sifat yang dijaga: yang disebut bukan hanya BERAPA melainkan SISI MANA.
    // Juru sita yang membaca penandanya perlu tahu siapa yang harus dipanggil.
    periksa(
      "sisi yang belum dipanggil disebutkan, bukan hanya jumlahnya",
      JSON.stringify(hasil["42"].sisiBelumDipanggil) === "[2]"
    );
  }
  {
    bersihkan();
    // Daftar pihak tidak terbaca sama sekali.
    jawaban = {
      sidang: [{ sidangId: 51, perkaraId: 700, tanggalSidang: "2026-08-30" }],
      sisiPihak: [],
      relaas: [],
    };
    const hasil = await layanan.keadaanPanggilanSidang([{ sidangId: 51, perkaraId: 700 }]);

    // Sifat yang dijaga: bila daftar pihaknya sendiri tidak terbaca, yang
    // dipakai daftar menurut kehadiran apa adanya. Lebih baik memperingatkan
    // tanpa perlu daripada diam saat panggilan memang belum ada.
    periksa("daftar pihak tak terbaca: tetap memperingatkan", hasil["51"].belumDipanggil === 2);
  }

  console.log("\n== Jurusita relaas jatuh ke penugasan perkara ==");
  {
    bersihkan();
    jawaban = {
      perkara: [{ perkaraId: 620, jenisPerkara: "Cerai Talak" }],
      jurusita: [{ kode: "JS1", nama: "Eko" }],
      // Relaas elektronik: pelaksananya tidak tercatat pada barisnya.
      relaas: [{ id: 9, pihakId: 1, tanggalRelaas: "2026-08-20" }],
      saksi: [{ jumlahSaksi: 0, jumlahKeterangan: 0 }],
    };
    const hasil = await layanan.rincianSidang(NOMOR, 11);

    // Sifat yang dijaga: kolom jurusita tidak boleh bergaris padahal namanya
    // jelas terbaca dari penugasan perkara - TETAPI asalnya harus disebut,
    // karena yang ditugaskan belum tentu yang melaksanakan.
    periksa("jurusita kosong diisi dari penugasan perkara", hasil.relaas[0].jurusitaNama === "Eko");
    periksa("asal nama jurusita ditandai", hasil.relaas[0].jurusitaDariPenugasan === true);
  }
  {
    bersihkan();
    jawaban.relaas = [{ id: 9, pihakId: 1, tanggalRelaas: "2026-08-20", jurusitaPerkara: "Fajar" }];
    const hasil = await layanan.rincianSidang(NOMOR, 11);

    // Sifat yang dijaga: nama yang BENAR-BENAR tercatat pada relaas tidak
    // boleh tertimpa nama petugas yang ditugaskan pada perkara.
    periksa("nama pada relaas tidak tertimpa penugasan", hasil.relaas[0].jurusitaNama === "Fajar");
    periksa("nama asli tidak ditandai sebagai penugasan", !hasil.relaas[0].jurusitaDariPenugasan);
  }
  console.log("\n== SIPP hanya dibaca ==");
  {
    bersihkan();
    jawaban = {
      perkara: [{ perkaraId: 620, jenisPerkara: "Cerai Talak" }],
      saksi: [{ jumlahSaksi: 0, jumlahKeterangan: 0 }],
    };
    await layanan.daftarSidang({ dari: "2026-08-30" });
    await layanan.rincianSidang(NOMOR, 11);
    await layanan.jalurDokumenSipp("dokumen", 3);

    periksa("seluruh kueri berupa SELECT", kueri.every((k) => /^\s*SELECT\b/i.test(k.sql)));
    periksa(
      "tidak ada INSERT, UPDATE, atau DELETE",
      kueri.every((k) => !/\b(INSERT|UPDATE|DELETE|DROP|ALTER)\b/i.test(k.sql))
    );
  }

  console.log(`\nHasil: ${lulus} lulus, ${gagal} gagal\n`);
  process.exit(gagal === 0 ? 0 : 1);
}

jalan().catch((galat) => {
  console.error("Gagal dijalankan:", galat);
  process.exit(1);
});
