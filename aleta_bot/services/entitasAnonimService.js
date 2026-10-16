"use strict";

/**
 * ============================================================================
 * DATA PRIBADI SATU PERKARA UNTUK ANONIMISASI MANDIRI (16 Okt 2026, F4.3)
 * ============================================================================
 *
 * Portal menyamarkan putusan sendiri (manajemen_surat/src/lib/anonimisasi-
 * putusan.ts) tanpa rute main/anonim ABT. Bahannya dari SIPP, BACA SAJA:
 *
 *   pihak 1-4   perkara_pihak1..4 + pihak  nama, alamat, NIK, telepon, email,
 *               tempat/tanggal lahir, pekerjaan, nama ayah/ibu, desa/kecamatan,
 *               kabupaten (nama wilayah dari ref_*_new - kolom pihak memuat KODE)
 *   saksi       perkara_pihak5 (+ pihak bila tertaut)
 *   anak        perkara_anak_pihak
 *   pelindung   perkara_hakim_pn, perkara_panitera_pn, perkara_jurusita,
 *               perkara_mediator, perkara_pengacara - nama yang TIDAK PERNAH
 *               disamarkan (majelis, PP, juru sita, mediator, kuasa/advokat)
 *
 * Nilainya UTUH (NIK, telepon tidak disamarkan) karena dipakai untuk mencari
 * kemunculannya di naskah. Karena itu rute ini hanya dipanggil portal dari
 * sisi server, dan portal tidak meneruskan nilai mentah itu ke peramban -
 * yang dikirim ke peramban hanya naskah yang SUDAH disamarkan.
 *
 * Tiap bagian gagal-terbuka: bagian yang tidak terbaca dicatat di
 * `tidakTerbaca`, bukan dijadikan daftar kosong diam-diam - penyamar
 * menyebutnya di pratinjau.
 */

const db = require("../db_config");
const { sebutanPihakPerkara } = require("./sebutanPihakService");

function kueri(sql, nilai = []) {
  return new Promise((selesai, gagal) => {
    db.query(sql, nilai, (galat, hasil) => (galat ? gagal(galat) : selesai(Array.isArray(hasil) ? hasil : [])));
  });
}

function bersih(nilai) {
  return String(nilai === null || nilai === undefined ? "" : nilai).replace(/\s+/g, " ").trim();
}

/** "YYYY-MM-DD" dari Date/teks SIPP; "" untuk kosong dan tanggal nol. */
function tanggalIso(nilai) {
  if (!nilai) return "";
  let teks = "";
  if (nilai instanceof Date) {
    if (Number.isNaN(nilai.getTime())) return "";
    teks = `${nilai.getFullYear()}-${String(nilai.getMonth() + 1).padStart(2, "0")}-${String(nilai.getDate()).padStart(2, "0")}`;
  } else {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(nilai).trim());
    if (m) teks = `${m[1]}-${m[2]}-${m[3]}`;
  }
  return teks > "1900-01-01" ? teks : "";
}

const NOMOR_PERKARA = /^\d{1,5}\/[A-Za-z]{1,10}(?:\.[A-Za-z]{1,4}){0,2}\/\d{4}\/[A-Za-z]{2,4}\.[A-Za-z]{2,6}\.?$/;

async function aman(nama, kerja, tidakTerbaca) {
  try {
    return await kerja();
  } catch (e) {
    tidakTerbaca.push(nama);
    return [];
  }
}

const KOLOM_ORANG = `
  b.nomor_indentitas AS nik, b.tempat_lahir AS tempatLahir, b.tanggal_lahir AS tanggalLahir,
  b.pekerjaan AS pekerjaan, b.telepon AS telepon, b.email AS email,
  b.nama_ayah AS namaAyah, b.nama_ibu AS namaIbu, b.rtrw AS rtrw,
  kl.kelurahan_nama AS kelurahan, kc.kecamatan_nama AS kecamatan, kb.kabupaten_nama AS kabupaten`;
const GABUNG_WILAYAH = `
  LEFT JOIN ref_kelurahan_new kl ON kl.kelurahan_kode = b.kelurahan
  LEFT JOIN ref_kecamatan_new kc ON kc.kecamatan_kode = b.kecamatan
  LEFT JOIN ref_kabupaten_new kb ON kb.kabupaten_kode = b.kabupaten`;

function orang(b) {
  return {
    nama: bersih(b.nama),
    alamat: bersih(b.alamat),
    rtrw: bersih(b.rtrw),
    nik: bersih(b.nik).replace(/\s+/g, ""),
    telepon: bersih(b.telepon),
    email: bersih(b.email),
    tempatLahir: bersih(b.tempatLahir),
    tanggalLahir: tanggalIso(b.tanggalLahir),
    pekerjaan: bersih(b.pekerjaan),
    namaAyah: bersih(b.namaAyah),
    namaIbu: bersih(b.namaIbu),
    kelurahan: bersih(b.kelurahan),
    kecamatan: bersih(b.kecamatan),
    kabupaten: bersih(b.kabupaten),
  };
}

/**
 * @param {string} nomorPerkara nomor perkara lengkap
 */
async function entitasAnonim(nomorPerkara) {
  const nomor = bersih(nomorPerkara).replace(/\.$/, "");
  if (!NOMOR_PERKARA.test(nomor)) return { ok: false, alasan: "nomor_perkara_tidak_sah" };
  let perkara;
  try {
    perkara = (
      await kueri(
        `SELECT perkara_id, nomor_perkara, alur_perkara_id, jenis_perkara_id, jenis_perkara_nama
           FROM perkara WHERE nomor_perkara IN (?, ?) LIMIT 1`,
        [nomor, `${nomor}.`]
      )
    )[0];
  } catch (e) {
    return { ok: false, alasan: "gagal_membaca_sipp", pesan: String((e && e.message) || e).slice(0, 200) };
  }
  if (!perkara) return { ok: false, alasan: "perkara_tidak_ditemukan" };
  const id = perkara.perkara_id;
  const tidakTerbaca = [];

  const cabang = [1, 2, 3, 4]
    .map((ke) => `SELECT perkara_id, pihak_id, nama, alamat, ${ke} AS pihak_ke, urutan FROM perkara_pihak${ke} WHERE perkara_id = ?`)
    .join(" UNION ALL ");

  const [pihak, saksi, anak, hakim, panitera, jurusita, mediator, kuasa] = await Promise.all([
    aman(
      "pihak",
      () =>
        kueri(
          `SELECT a.pihak_ke AS pihakKe, a.urutan AS urutan, COALESCE(b.nama, a.nama) AS nama,
                  COALESCE(b.alamat, a.alamat) AS alamat, ${KOLOM_ORANG}
             FROM (${cabang}) a
             LEFT JOIN pihak b ON b.id = a.pihak_id ${GABUNG_WILAYAH}
            ORDER BY a.pihak_ke, a.urutan`,
          [id, id, id, id]
        ),
      tidakTerbaca
    ),
    aman(
      "saksi",
      () =>
        kueri(
          `SELECT p5.urutan AS urutan, p5.saksi_pihak_ke AS saksiPihakKe, COALESCE(b.nama, p5.nama) AS nama,
                  COALESCE(b.alamat, p5.alamat) AS alamat, ${KOLOM_ORANG}
             FROM perkara_pihak5 p5
             LEFT JOIN pihak b ON b.id = p5.pihak_id ${GABUNG_WILAYAH}
            WHERE p5.perkara_id = ? ORDER BY p5.urutan`,
          [id]
        ),
      tidakTerbaca
    ),
    aman(
      "anak",
      () =>
        kueri(
          `SELECT nama_anak AS nama, nik, tempat_lahir AS tempatLahir, tanggal_lahir AS tanggalLahir, anak_ke AS anakKe
             FROM perkara_anak_pihak WHERE perkara_id = ? AND nama_anak IS NOT NULL AND nama_anak <> ''
            ORDER BY anak_ke, id`,
          [id]
        ),
      tidakTerbaca
    ),
    aman("majelis", () => kueri(`SELECT hakim_nama AS nama FROM perkara_hakim_pn WHERE perkara_id = ?`, [id]), tidakTerbaca),
    aman("panitera", () => kueri(`SELECT panitera_nama AS nama FROM perkara_panitera_pn WHERE perkara_id = ?`, [id]), tidakTerbaca),
    aman("juru sita", () => kueri(`SELECT jurusita_nama AS nama FROM perkara_jurusita WHERE perkara_id = ?`, [id]), tidakTerbaca),
    aman("mediator", () => kueri(`SELECT nama_mediator AS nama FROM perkara_mediator WHERE perkara_id = ?`, [id]), tidakTerbaca),
    aman("kuasa", () => kueri(`SELECT nama FROM perkara_pengacara WHERE perkara_id = ?`, [id]), tidakTerbaca),
  ]);

  const sebutan = sebutanPihakPerkara({
    alurPerkaraId: perkara.alur_perkara_id,
    jenisPerkaraId: perkara.jenis_perkara_id,
    jenisPerkaraNama: perkara.jenis_perkara_nama,
    nomorPerkara: perkara.nomor_perkara,
  });
  const lindungi = [];
  const tambahLindung = (peran, baris) => {
    for (const b of baris) {
      const nama = bersih(b.nama);
      if (nama && !lindungi.some((x) => x.nama.toLowerCase() === nama.toLowerCase())) lindungi.push({ peran, nama });
    }
  };
  tambahLindung("hakim", hakim);
  tambahLindung("panitera", panitera);
  tambahLindung("juru sita", jurusita);
  tambahLindung("mediator", mediator);
  tambahLindung("kuasa", kuasa);

  return {
    ok: true,
    perkara: { nomor: bersih(perkara.nomor_perkara).replace(/\.$/, ""), jenis: bersih(perkara.jenis_perkara_nama) },
    sebutan: { satu: sebutan.satu, dua: sebutan.dua },
    pihak: pihak
      .map((b) => ({ ...orang(b), pihakKe: Number(b.pihakKe) || 0, urutan: Number(b.urutan) || 0 }))
      .filter((x) => x.nama),
    saksi: saksi
      .map((b) => ({ ...orang(b), urutan: Number(b.urutan) || 0, saksiPihakKe: Number(b.saksiPihakKe) || 0 }))
      .filter((x) => x.nama),
    anak: anak
      .map((b) => ({
        nama: bersih(b.nama),
        nik: bersih(b.nik).replace(/\s+/g, ""),
        tempatLahir: bersih(b.tempatLahir),
        tanggalLahir: tanggalIso(b.tanggalLahir),
        urutan: Number(b.anakKe) || 0,
      }))
      .filter((x) => x.nama),
    lindungi,
    tidakTerbaca,
  };
}

module.exports = { entitasAnonim, tanggalIso };
