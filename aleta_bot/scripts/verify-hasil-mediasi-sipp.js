"use strict";

/**
 * Uji kering hasil mediasi ke SIPP (28 Okt 2026) atas salinan SIPP lokal -
 * HANYA SELECT. Setiap UPDATE/INSERT/DELETE ditolak sebelum sampai ke MySQL.
 *
 *   node scripts/verify-hasil-mediasi-sipp.js <mediasiId> [hasil T|D|S|Y1|Y2] [db sipp_donggala]
 *
 * Bila perkara_mediasi sudah berisi hasil, isian yang sama dengan SIPP dikirim
 * dulu (harus "tanpa perubahan"), lalu hasil pilihan argumen kedua.
 */
const mysql = require("mysql");
const layanan = require("../services/hasilMediasiTulisService");
const { pilihPaniteraSidang } = require("../services/sidangHasilService");

const mediasiId = Number(process.argv[2] || 0);
const hasilUji = String(process.argv[3] || "T").toUpperCase();
const sambung = mysql.createConnection({ host: "127.0.0.1", user: "root", database: process.argv[4] || "sipp_donggala" });

const kueri = (sql, params = []) =>
  new Promise((selesai, gagal) => {
    if (!/^\s*SELECT/i.test(sql)) return gagal(new Error(`DITOLAK (baca saja): ${sql.slice(0, 60)}`));
    sambung.query(sql, params, (g, r) => (g ? gagal(g) : selesai(r)));
  });

(async () => {
  const l = layanan.buatLayanan({
    kueri,
    transaksi: async () => {
      throw new Error("transaksi dilarang dalam uji kering");
    },
    waktu: async () => {
      const r = await kueri("SELECT DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS t");
      return r[0].t;
    },
    paniteraSidang: async (perkaraId, tanggal) => {
      const baris = await kueri(
        `SELECT c.panitera_id, c.panitera_nama, c.tanggal_penetapan, d.username, d.fullname, d.block
           FROM perkara_panitera_pn c LEFT JOIN v_users d ON d.panitera_id = c.panitera_id
          WHERE c.aktif = 'Y' AND c.perkara_id = ?`,
        [perkaraId]
      );
      return pilihPaniteraSidang(baris, tanggal);
    },
  });
  const k = await l.keadaanHasil({ mediasiId });
  console.log("KEADAAN", JSON.stringify({ ...k, sipp: { ...k.sipp, isiKesepakatan: `(${(k.sipp && k.sipp.isiKesepakatan || "").length} huruf)` } }, null, 1));
  if (!k.ok) return;
  if (k.sipp.hasil) {
    const r0 = await l.susunRencanaHasil({
      mediasiId,
      operator: "uji",
      hasil: k.sipp.hasil,
      tanggalLaporan: k.sipp.laporan,
      tanggalKesepakatan: k.sipp.kesepakatan,
      isiKesepakatan: k.sipp.isiKesepakatan,
      keterangan: k.sipp.keterangan,
    });
    console.log("ISIAN SAMA ->", r0.ok, r0.alasan || "", r0.tanpaPerubahan ? "TANPA PERUBAHAN" : `langkah ${r0.langkah && r0.langkah.length}`);
  }
  const r = await l.susunRencanaHasil({
    mediasiId,
    operator: "uji",
    hasil: hasilUji,
    tanggalLaporan: k.tanggalHasil,
    tanggalKesepakatan: k.tanggalHasil,
    isiKesepakatan: "<p>Para pihak sepakat untuk kembali rukun dan membina rumah tangga dengan baik.</p>",
    keterangan: "Uji kering",
    kehadiran: "1",
    ip: "192.168.9.41",
  });
  if (!r.ok) return console.log("RENCANA DITOLAK", r.alasan, r.pesan);
  console.log("ATAS NAMA", r.atasNama, "SAAT", r.saat);
  console.log("TAHAPAN SESUDAH", r.tahapanSesudah, "DIHAPUS", r.riwayatDihapus, "BARU", r.riwayatBaru);
  console.log("PERINGATAN", r.peringatan);
  for (const x of r.langkah) console.log(`- ${x.tabel} ${x.aksi}: ${x.keterangan}`);
  console.log("AUDIT", r.langkah[1].params.slice(0, 7), "\n", r.langkah[1].params[7]);
  const jalan = await l.jalankanRencanaHasil(r, {});
  console.log("JALAN (kering)", jalan.ok, jalan.kering, jalan.jumlahLangkah);
})()
  .catch((g) => console.error("GALAT", g.message))
  .finally(() => sambung.end());
