"use strict";

/**
 * ============================================================================
 * RIWAYAT PERBUATAN ALETA - YANG DIJAGA DI SINI
 * ============================================================================
 *
 * Riwayat ini penggantinya penanda "[ALETA] diisikan operator <nama>" yang
 * dulu dititipkan pada kolom description sys_audittrail. Penggantinya harus
 * lebih baik daripada yang digantikan, bukan sekadar berpindah tempat:
 *
 *   1. Ia menulis ke basis data ALETA, TIDAK PERNAH ke basis data SIPP.
 *   2. Percobaan yang GAGAL ikut tercatat - itu yang tidak pernah dapat
 *      dilakukan sys_audittrail, dan justru yang dicari ketika petugas
 *      bertanya kenapa penetapannya tidak jadi.
 *   3. Gagal menulis jejak TIDAK boleh menggagalkan penetapannya. Penetapan
 *      sudah tertulis di SIPP ketika jejaknya dicatat; melempar galat dari
 *      sana berarti melaporkan gagal atas pekerjaan yang berhasil, dan
 *      petugas akan menekannya sekali lagi.
 *   4. Uji kering tidak termasuk "yang dilakukan ALETA" kecuali diminta
 *      tegas - ia tidak mengubah apa pun di SIPP.
 *
 * Berjalan tanpa jaringan dan tanpa basis data: kolamnya dipalsukan.
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

// ---------------------------------------------------------------- kolam palsu
const jalurDb = require.resolve("../bot_db_config");
require("../bot_db_config");

const kueriTercatat = [];
let jawabanBerikut = [];
let lemparBerikut = null;

require.cache[jalurDb].exports = {
  query: (sql, params, selesai) => {
    kueriTercatat.push({ sql: String(sql).replace(/\s+/g, " ").trim(), params });
    if (lemparBerikut) {
      const galat = lemparBerikut;
      lemparBerikut = null;
      selesai(galat);
      return;
    }
    selesai(null, jawabanBerikut);
  },
};

const jejak = require("../services/jejakAletaService");

(async () => {
  console.log("riwayat perbuatan ALETA");

  // ------------------------------------------------------------ tabelnya
  {
    kueriTercatat.length = 0;
    await jejak.pastikanTabel();
    const buat = kueriTercatat.find((x) => /CREATE TABLE IF NOT EXISTS/i.test(x.sql));
    periksa("tabelnya dibuat saat pertama dipakai", Boolean(buat));
    periksa(
      "namanya berawalan aleta_bot_, sepola dengan tabel internal lainnya",
      Boolean(buat) && /aleta_bot_jejak_penetapan/.test(buat.sql),
      buat ? buat.sql.slice(0, 80) : ""
    );

    // Basis data SIPP dibaca lewat db_config; jejak ini HANYA boleh menyentuh
    // bot_db_config. Salah satu sambungan saja sudah cukup untuk menulis tabel
    // ALETA ke dalam basis data SIPP - dan itu persis yang hendak dihindari.
    const sumber = require("node:fs").readFileSync(
      require.resolve("../services/jejakAletaService"),
      "utf8"
    );
    periksa("menyambung ke bot_db_config, bukan ke db_config SIPP", sumber.includes('require("../bot_db_config")'));
    periksa("tidak menyebut db_config SIPP sama sekali", !/require\("\.\.\/db_config"\)/.test(sumber));
    // Dicari pada KEDUDUKAN SQL-nya, bukan pada katanya. Kata "perkara" muncul
    // juga di kalimat log, dan penjaga yang berbunyi atas kalimat log akan
    // dimatikan orang - lalu berhenti menjaga apa pun.
    const tanpaCatatan = sumber.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    periksa(
      "tidak menyentuh satu pun tabel SIPP",
      !/\b(FROM|INTO|UPDATE|JOIN)\s+(perkara\w*|sys_audittrail|hakim_pn|panitera_pn|jurusita)\b/i.test(
        tanpaCatatan
      )
    );
  }

  // ------------------------------------------------------- mencatat berhasil
  {
    kueriTercatat.length = 0;
    const hasil = await jejak.catat({
      aksi: "tulis",
      jenis: "pmh",
      perkaraId: 10113,
      nomorPerkara: "561/Pdt.G/2026/PA.Dgl",
      tanggalPenetapan: "2026-09-12",
      akunSipp: "sudarmin",
      namaPejabat: "Sudarmin H.I.M. Tang, S.H.I., M.H.",
      operator: "SUPER ADMIN DERRY",
      ip: "127.0.0.1",
      berhasil: true,
      kering: false,
      langkah: [
        { tabel: "perkara_penetapan", aksi: "INSERT", keterangan: "penetapan majelis" },
        { tabel: "perkara_hakim_pn", aksi: "INSERT", keterangan: "ketua" },
        { tabel: "perkara_hakim_pn", aksi: "INSERT", keterangan: "anggota 1" },
        { tabel: "sys_audittrail", aksi: "INSERT", keterangan: "catatan audit" },
      ],
    });
    periksa("satu perbuatan tercatat", hasil === true);

    const sisip = kueriTercatat.find((x) => /^INSERT INTO/i.test(x.sql));
    periksa("ditulis dengan INSERT berparameter", Boolean(sisip) && sisip.sql.includes("VALUES (?,?,?"));

    const nilai = sisip ? sisip.params : [];
    periksa("nomor perkaranya ikut", nilai.includes("561/Pdt.G/2026/PA.Dgl"));
    periksa("akun SIPP dan operator ALETA tercatat berdampingan", nilai.includes("sudarmin") && nilai.includes("SUPER ADMIN DERRY"));
    // Dua orang yang belum tentu sama: yang tercatat di sys_audittrail akun
    // SIPP-nya, yang menekan tombolnya operator ALETA. Riwayat yang hanya
    // menyimpan salah satunya tidak dapat menjawab pertanyaan siapa pun.
    periksa("nama pejabatnya ikut, bukan hanya nama akunnya", nilai.some((x) => String(x).startsWith("Sudarmin H.I.M. Tang")));
    periksa("jumlah langkahnya dihitung dari rencananya", nilai.includes(4), String(nilai));

    // Tabel yang disentuh dihitung dari rencananya, bukan ditulis tangan -
    // daftar yang ditulis tangan akan tertinggal begitu satu langkah ditambah.
    const daftarTabel = nilai.find((x) => typeof x === "string" && x.includes("perkara_penetapan, perkara_hakim_pn"));
    periksa("tabel yang disentuh disebut tanpa kembar", Boolean(daftarTabel), String(daftarTabel));
    periksa(
      "sys_audittrail ikut disebut - itu pun disentuh",
      Boolean(daftarTabel) && daftarTabel.includes("sys_audittrail")
    );
  }

  // ---------------------------------------------------------- yang DITOLAK
  {
    kueriTercatat.length = 0;
    await jejak.catat({
      aksi: "tulis",
      jenis: "phs",
      perkaraId: 10113,
      berhasil: false,
      alasan: "pmh_belum_ada",
      langkah: [],
    });
    const sisip = kueriTercatat.find((x) => /^INSERT INTO/i.test(x.sql));
    periksa("percobaan yang ditolak ikut tercatat", Boolean(sisip));
    periksa("sebabnya tersimpan apa adanya", Boolean(sisip) && sisip.params.includes("pmh_belum_ada"));
    periksa("berhasil ditandai 0, bukan dikosongkan", Boolean(sisip) && sisip.params.includes(0));
  }

  // ------------------------------------- gagal menulis jejak tidak melempar
  {
    lemparBerikut = new Error("ER_NO_SUCH_TABLE: meja jejaknya hilang");
    const hasil = await jejak.catat({ aksi: "tulis", jenis: "pmh", perkaraId: 1, langkah: [] });
    periksa("kegagalan ditelan, bukan dilempar", hasil === false);

    // Percobaan berikutnya harus membangun tabelnya lagi - satu kegagalan
    // sesaat tidak boleh membuat seluruh riwayat kosong sampai bot dinyalakan
    // ulang.
    // Gagal membangun TABELNYA diuji atas salinan layanan yang masih segar.
    // Pada salinan yang tabelnya sudah pernah berhasil dibangun, janji
    // pembangunannya memang tidak diulang lagi - dan memang tidak perlu.
    delete require.cache[require.resolve("../services/jejakAletaService")];
    const jejakBaru = require("../services/jejakAletaService");
    lemparBerikut = new Error("ER_ACCESS_DENIED: tidak boleh membuat tabel");
    await jejakBaru.catat({ aksi: "tulis", jenis: "pmh", perkaraId: 1, langkah: [] });

    kueriTercatat.length = 0;
    const hasilKedua = await jejakBaru.catat({ aksi: "tulis", jenis: "pmh", perkaraId: 1, langkah: [] });
    periksa(
      "tabelnya dibangun ulang sesudah gagal sekali",
      kueriTercatat.some((x) => /CREATE TABLE IF NOT EXISTS/i.test(x.sql))
    );
    periksa("dan percobaan berikutnya berhasil", hasilKedua === true);
  }

  // -------------------------------------------------------------- membaca
  {
    jawabanBerikut = [
      {
        id: 7,
        waktu: new Date("2026-09-12T11:53:09"),
        aksi: "tulis",
        jenis: "pmh",
        perkara_id: 10113,
        nomor_perkara: "561/Pdt.G/2026/PA.Dgl",
        tanggal_penetapan: "2026-09-12",
        akun_sipp: "sudarmin",
        nama_pejabat: "Sudarmin H.I.M. Tang, S.H.I., M.H.",
        operator: "SUPER ADMIN DERRY",
        ip: "127.0.0.1",
        berhasil: 1,
        kering: 0,
        alasan: "",
        jumlah_langkah: 7,
        tabel_disentuh: "perkara_penetapan, perkara_hakim_pn, sys_audittrail",
      },
    ];

    kueriTercatat.length = 0;
    const hasil = await jejak.riwayat({ nomorPerkara: "561/Pdt.G/2026/PA.Dgl", batas: 30 });
    periksa("riwayat terbaca", hasil.ok === true && hasil.jumlah === 1);

    const baca = kueriTercatat.find((x) => /^SELECT/i.test(x.sql));
    periksa("nomor perkaranya jadi parameter, bukan disambung ke SQL", Boolean(baca) && baca.params.includes("561/Pdt.G/2026/PA.Dgl"));
    periksa("uji kering disaring keluar sebagai bawaan", Boolean(baca) && /kering = 0/.test(baca.sql));

    const satu = hasil.baris[0];
    periksa("tabelnya dipulangkan sebagai daftar, bukan satu untai", Array.isArray(satu.tabel) && satu.tabel.length === 3, JSON.stringify(satu.tabel));
    periksa("berhasil dipulangkan sebagai benar/salah", satu.berhasil === true);
    periksa("akun SIPP dan operator terpisah", satu.akunSipp === "sudarmin" && satu.operator === "SUPER ADMIN DERRY");
    periksa("nama pejabatnya terbaca utuh", satu.namaPejabat.startsWith("Sudarmin H.I.M. Tang"), satu.namaPejabat);
  }

  // --------------------------------------------------------- batas bacaan
  {
    jawabanBerikut = [];
    kueriTercatat.length = 0;
    await jejak.riwayat({ batas: 99999 });
    const baca = kueriTercatat.find((x) => /^SELECT/i.test(x.sql));
    periksa("batas bacaan dijepit, permintaan sejuta baris ditolak", Boolean(baca) && /LIMIT 200\b/.test(baca.sql), baca ? baca.sql.slice(-40) : "");

    kueriTercatat.length = 0;
    await jejak.riwayat({ termasukKering: true });
    const baca2 = kueriTercatat.find((x) => /^SELECT/i.test(x.sql));
    periksa("uji kering ikut bila diminta tegas", Boolean(baca2) && !/kering = 0/.test(baca2.sql));
  }

  console.log("");
  console.log(`lulus ${lulus}, gagal ${gagal}`);
  process.exit(gagal > 0 ? 1 : 0);
})().catch((galat) => {
  console.error("GALAT:", String(galat.stack || galat.message || galat).slice(0, 600));
  process.exit(1);
});
