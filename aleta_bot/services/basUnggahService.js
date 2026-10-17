"use strict";

/**
 * ============================================================================
 * MENGUNGGAH e-DOC BAS SATU SIDANG KE SIPP (F4.1, 17 OKT 2026)
 * ============================================================================
 *
 * Sama dengan tingkap "Kelola Dokumen Elektronik (E-Doc)" pada baris Jadwal
 * Sidang SIPP - dibaca dari kode SIPP sendiri, bukan ditebak:
 *
 *   controllers/fileupload_c.php  validatePost(), cabang from == "bas":
 *       enc  = perkara_id, enc1 = perkara_jadwal_sidang.id, urutan = urutan sidang
 *       $pengenal   = "bas_<urutan>" . "_" . strtotime(...)
 *       $direktori  = "resources/file/doc/<tahun daftar>/<bulan daftar>"   (tanggal_pendaftaran)
 *       $fileName   = <bagian4>_<bagian3>_<bagian2>_<bagian1>_<pengenal>, spasi -> "_",
 *                     titik dibuang, lalu "." + ekstensi ASLI berkasnya
 *   models/fileupload/fileupload_m.php  update_data(..., "bas"):
 *       UPDATE perkara_jadwal_sidang SET edoc_bas = <jalur> WHERE id = <id jadwal>
 *
 * Contoh nyata di server (17 Okt 2026, SELECT baca-saja):
 *   resources/file/doc/2026/08/PADgl_2026_PdtG_497_bas_7_1792096162.pdf
 *
 * YANG SENGAJA BERBEDA DARI SIPP - lebih hati-hati, tidak lebih berani:
 *   - e-Doc yang SUDAH ada TIDAK diganti kecuali pemanggil menyatakan `ganti`
 *     (cek dobel, sejalan dengan penjaga L1 di tingkap e-Doc SIPP). UPDATE-nya
 *     sendiri bersyarat "masih kosong" (mengganti: "masih berisi jalur lama yang
 *     dibaca"), jadi dua tab yang mengunggah sidang yang
 *     sama bersamaan tidak saling menimpa diam-diam.
 *   - Berkas lama TIDAK dihapus dari cakram saat diganti (SIPP meng-unlink-nya):
 *     menghapus berkas pengadilan bukan pekerjaan alat bantu. Keputusan 17 Okt
 *     butir 44: ia DIPINDAH ke folder terpisah "terhapus" di folder dokumen SIPP
 *     yang sama (<folder>/terhapus/<nama>_<waktu WITA>.<ext>) - tidak dibiarkan
 *     di tempatnya. Jalur lama & barunya hanya dicatat di jejak ALETA (butir 45:
 *     tidak ada keterangan ALETA di SIPP).
 *   - Sidang yang belum berlangsung ditolak: BAS sidang esok hari pasti keliru.
 *
 * Tanpa baris sys_audittrail: SIPP sendiri tidak menulis audit untuk unggah
 * e-Doc BAS (hanya putusan akhir yang diaudit, fileupload_m::update_data).
 * Pertanggungjawabannya di jejak ALETA (aleta_bot_jejak_penetapan): siapa,
 * akun SIPP, IP, tabel, jalur - termasuk unggahan yang GAGAL.
 *
 * Hak: lapis kedua di sini (periksaHakUnggahBas) - portal sudah menolak peran
 * lain (bolehBasMassal: PP, Panitera, Panmud, Analis, Admin, Super Admin).
 */

const fs = require("node:fs");
const path = require("node:path");
const { tanpaTandaAletaMetadata } = require("./metadataTanpaAletaService");
const penjagaTandaSipp = require("./penjagaTandaSipp");

const PERAN_BOLEH_UNGGAH_BAS = Object.freeze(["super-admin", "admin", "panitera", "panmud", "pp", "analis"]);
const PESAN_TOLAK_BAS =
  "Unggah BAS ke SIPP hanya untuk Panitera Pengganti, Panitera, Panitera Muda, Admin, dan Super Admin. Peran Anda tidak diberi hak ini.";
const PESAN_TOLAK_BAS_BUKAN_PP =
  "Perkara ini bukan perkara Anda sebagai Panitera Pengganti, jadi BAS-nya tidak dapat diunggah dari akun Anda.";
const FOLDER_DOC = "resources/file/doc";
const BENTUK_SAH = ["rtf", "pdf", "doc", "docx"];

/** { ok:true, peran } atau { ok:false, status:403, alasan, pesan }. Murni. */
function periksaHakUnggahBas(badan) {
  const peran = String((badan && badan.peranPenekan) || "").trim().toLowerCase();
  if (!peran) return { ok: false, status: 403, alasan: "peran_penekan_tidak_disebut", pesan: PESAN_TOLAK_BAS };
  if (!PERAN_BOLEH_UNGGAH_BAS.includes(peran)) return { ok: false, status: 403, alasan: "peran_tidak_boleh_unggah_bas", pesan: PESAN_TOLAK_BAS };
  // 17 Okt (audit A4): PP hanya BAS perkaranya sendiri. Portal mencocokkan namanya dengan PP aktif
  // perkara itu dan menyatakannya lewat milikPerkara; pemanggil yang lupa memeriksa tertahan di sini.
  // Panitera/panmud/analis/admin mengawasi semua perkara.
  if (peran === "pp" && !(badan && badan.milikPerkara === true)) {
    return { ok: false, status: 403, alasan: "pp_bukan_petugas_perkara", pesan: PESAN_TOLAK_BAS_BUKAN_PP };
  }
  return { ok: true, peran };
}

/**
 * Nama berkas menurut fileupload_c.php. "" bila nomornya tidak berbagian empat.
 *   ("601/Pdt.G/2026/PA.Dgl", 2, 1792096162, "rtf") -> "PADgl_2026_PdtG_601_bas_2_1792096162.rtf"
 * Murni.
 */
function namaBerkasBas(nomorPerkara, urutan, cap, ekstensi) {
  const bagian = String(nomorPerkara || "").split("/");
  if (bagian.length !== 4 || bagian.some((x) => !x.trim())) return "";
  const u = Number(urutan);
  if (!Number.isInteger(u) || u < 1) return "";
  const ext = BENTUK_SAH.includes(String(ekstensi)) ? String(ekstensi) : "";
  if (!ext) return "";
  const dasar = `${bagian[3]}_${bagian[2]}_${bagian[1]}_${bagian[0]}_bas_${u}_${Math.floor(Number(cap) || 0)}`
    .replace(/ /g, "_")
    .replace(/\./g, "");
  // 17 Okt 2026: nama berkas tanpa kata ALETA (nomor perkara dari SIPP tidak memuatnya).
  return penjagaTandaSipp.namaBerkasBersih(`${dasar}.${ext}`);
}

/**
 * Tempat berkas BAS lama yang DIGANTI (butir 44, 17 Okt 2026): folder "terhapus"
 * di folder dokumen yang sama, nama lama + waktu WITA (UTC+8) supaya penggantian
 * berulang tidak saling menimpa.
 *   ("resources/file/doc/2026/08/PADgl_2026_PdtG_497_bas_7_1792096162.pdf", 2026-10-17T01:02:03Z)
 *   -> "resources/file/doc/2026/08/terhapus/PADgl_2026_PdtG_497_bas_7_1792096162_20261017-090203.pdf"
 * "" bila jalurnya di luar resources/file/doc atau memuat "..". Murni.
 */
function jalurTerhapus(jalurLama, waktu) {
  const rel = String(jalurLama || "").replace(/\\/g, "/").trim();
  if (!rel.startsWith(`${FOLDER_DOC}/`) || rel.split("/").some((x) => x === ".." || x === "")) return "";
  const folder = path.posix.dirname(rel);
  const dasar = path.posix.basename(rel);
  const titik = dasar.lastIndexOf(".");
  const nama = titik > 0 ? dasar.slice(0, titik) : dasar;
  const ext = titik > 0 ? dasar.slice(titik) : "";
  const t = waktu instanceof Date && !Number.isNaN(waktu.getTime()) ? waktu : new Date();
  const w = new Date(t.getTime() + 8 * 3600 * 1000);
  const d = (n) => String(n).padStart(2, "0");
  const cap = `${w.getUTCFullYear()}${d(w.getUTCMonth() + 1)}${d(w.getUTCDate())}-${d(w.getUTCHours())}${d(w.getUTCMinutes())}${d(w.getUTCSeconds())}`;
  return `${folder}/terhapus/${nama}_${cap}${ext}`;
}

/** Jalur relatif (tahun/bulan dari tanggal PENDAFTARAN, seperti SIPP). "" bila tak sah. Murni. */
function jalurBas(nomorPerkara, tanggalDaftar, urutan, cap, ekstensi) {
  const nama = namaBerkasBas(nomorPerkara, urutan, cap, ekstensi);
  const m = /^(\d{4})-(\d{2})-\d{2}/.exec(String(tanggalDaftar || ""));
  if (!nama || !m || m[1] === "0000") return "";
  return `${FOLDER_DOC}/${m[1]}/${m[2]}/${nama}`;
}

function tglIso(x) {
  if (x instanceof Date) {
    const d = (n) => String(n).padStart(2, "0");
    return `${x.getFullYear()}-${d(x.getMonth() + 1)}-${d(x.getDate())}`;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(x || ""));
  return m && m[1] !== "0000" ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

function depsBawaan() {
  const sippDb = require("../db_config");
  const skema = require("./sippSkemaService");
  const dokumen = require("./dokumenPenetapanService");
  const abtCetak = require("./abtCetakService");
  return {
    kueri: (sql, params = []) =>
      new Promise((ok, gagal) => sippDb.query(sql, params, (g, h) => (g ? gagal(g) : ok(h)))),
    tabelAda: (t) => skema.tabelAda(t),
    kolomAda: (t, k) => skema.kolomAda(t, k),
    kenaliDokumen: (b) => abtCetak.kenaliDokumen(b),
    periksaAkar: () => dokumen.periksaAkarSipp(undefined, { relatif: FOLDER_DOC }),
    tulisBerkas: (penuh, isi) => {
      fs.mkdirSync(path.dirname(penuh), { recursive: true });
      // Butir 45 (17 Okt): metadata berkas tanpa tanda ALETA.
      fs.writeFileSync(penuh, tanpaTandaAletaMetadata(isi), { flag: "wx" });
    },
    /** Butir 44: berkas BAS lama ke folder "terhapus" (rename; lintas cakram = salin lalu hapus). */
    pindahBerkas: (dari, ke) => {
      if (!fs.existsSync(dari)) return false;
      fs.mkdirSync(path.dirname(ke), { recursive: true });
      try {
        fs.renameSync(dari, ke);
      } catch (e) {
        if (!e || e.code !== "EXDEV") throw e;
        fs.copyFileSync(dari, ke, fs.constants.COPYFILE_EXCL);
        fs.unlinkSync(dari);
      }
      return true;
    },
    sekarang: () => new Date(),
    hapusBerkas: (penuh) => {
      try {
        fs.unlinkSync(penuh);
      } catch {
        /* berkas yatim hanya berkas tak terpakai */
      }
    },
    samakanPemilik: (penuh, akar) => dokumen.samakanPemilikSipp(penuh, akar),
    akunSipp: (oleh) => require("./putusanUnggahService").akunSippPemicu(oleh),
    catatJejak: (j) => {
      if (process.env.VITEST) return Promise.resolve(false);
      try {
        return require("./jejakAletaService").catat(j);
      } catch {
        return Promise.resolve(false);
      }
    },
    capWaktu: () => Math.floor(Date.now() / 1000),
    hariIni: async () => {
      const b = await new Promise((ok) =>
        sippDb.query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS h", [], (g, h) => ok(g ? [] : h))
      );
      return tglIso(b && b[0] && b[0].h) || new Date().toISOString().slice(0, 10);
    },
  };
}

function buatLayanan(depsMasuk) {
  let cache = null;
  const deps = () => {
    if (!cache) cache = depsMasuk || depsBawaan();
    return cache;
  };

  /**
   * Pulang { ok:true, jalur, nama, urutan, diganti, jalurLama } atau
   * { ok:false, alasan, pesan, jalurLama? }. Tidak pernah melempar karena
   * masukan; galat basis data dilempar ke rute (500).
   */
  async function unggahBas({ perkaraId, sidangId, nomorPerkara, isi, olehUsername = "", operator = "", ip = "", ganti = false } = {}) {
    const d = deps();
    const pid = Number(perkaraId);
    const sid = Number(sidangId);
    if (!Number.isInteger(pid) || pid <= 0) return { ok: false, alasan: "perkara_tidak_sah", pesan: "Perkara belum dikenali." };
    if (!Number.isInteger(sid) || sid <= 0) return { ok: false, alasan: "sidang_tidak_sah", pesan: "Sidang belum dikenali." };
    const bita = Buffer.isBuffer(isi) ? isi : isi ? Buffer.from(isi) : null;
    if (!bita || bita.length === 0) return { ok: false, alasan: "berkas_kosong", pesan: "Berkas BAS kosong." };
    const bentuk = d.kenaliDokumen(bita);
    if (!BENTUK_SAH.includes(bentuk)) {
      return { ok: false, alasan: "bentuk_tidak_dikenali", pesan: "Isinya bukan RTF, PDF, DOC, maupun DOCX - dikenali dari kepala berkasnya." };
    }
    if (!(await d.tabelAda("perkara_jadwal_sidang")) || !(await d.kolomAda("perkara_jadwal_sidang", "edoc_bas"))) {
      return { ok: false, alasan: "kolom_edoc_bas_tidak_ada", pesan: "SIPP ini tidak punya kolom e-Doc BAS." };
    }

    const akun = await d.akunSipp(olehUsername);
    const jejakDasar = {
      aksi: "unggah",
      jenis: "edoc_bas",
      perkaraId: pid,
      nomorPerkara: String(nomorPerkara || ""),
      akunSipp: akun.username,
      operator: String(operator || "").slice(0, 120),
      ip: String(ip || ""),
      kering: false,
    };
    const gagal = async (alasan, pesan, ekstra = {}) => {
      await Promise.resolve(d.catatJejak({ ...jejakDasar, berhasil: false, alasan, langkah: [] })).catch(() => false);
      return { ok: false, alasan, pesan, ...ekstra };
    };

    const baris = await d.kueri(
      `SELECT js.id, js.urutan, DATE_FORMAT(js.tanggal_sidang, '%Y-%m-%d') AS tanggal, js.edoc_bas,
              p.nomor_perkara, DATE_FORMAT(p.tanggal_pendaftaran, '%Y-%m-%d') AS tanggal_daftar
         FROM perkara_jadwal_sidang js JOIN perkara p ON p.perkara_id = js.perkara_id
        WHERE js.id = ? AND js.perkara_id = ? LIMIT 1`,
      [sid, pid]
    );
    const r = Array.isArray(baris) ? baris[0] : null;
    if (!r) return gagal("sidang_tidak_ditemukan", "Sidang ini tidak ditemukan pada perkara tersebut di SIPP.");
    const nomorSipp = String(r.nomor_perkara || "").trim();
    jejakDasar.nomorPerkara = nomorSipp;
    if (nomorPerkara && String(nomorPerkara).trim() !== nomorSipp) {
      return gagal("nomor_tidak_cocok", `Nomor perkara tidak cocok: SIPP menyebut ${nomorSipp}.`);
    }
    const tanggal = tglIso(r.tanggal);
    const hariIni = await d.hariIni();
    if (!tanggal || tanggal > hariIni) {
      return gagal("sidang_belum_berlangsung", `Sidang ini (${tanggal || "tanpa tanggal"}) belum berlangsung - BAS-nya belum dapat diunggah.`);
    }
    const lama = String(r.edoc_bas || "").trim();
    if (lama && !ganti) {
      return { ok: false, alasan: "sudah_ada", pesan: `e-Doc BAS sidang ini sudah ada di SIPP (${lama.split("/").pop()}). Tidak diganti.`, jalurLama: lama.split("/").pop() };
    }

    // 17 Okt 2026 (penjaga batas): metadata berkas dibersihkan (sistem), ISI naskah
    // diperiksa - tidak diubah diam-diam; bila memuat kata ALETA di luar nama pihak
    // dari SIPP, unggahan DITAHAN sebelum berkas atau barisnya ditulis.
    const dariSipp = await penjagaTandaSipp.dataSippMemuatAleta(pid, d.kueri);
    const siap = penjagaTandaSipp.siapkanBerkasSipp(bita, { nama: `BAS sidang ke-${Number(r.urutan) || ""}`.trim(), dariSipp });
    if (!siap.ok) return gagal(siap.alasan, siap.pesan);

    const keadaanAkar = d.periksaAkar();
    if (!keadaanAkar.dapatDitulis) return gagal(keadaanAkar.alasan || "akar_tidak_dapat_ditulis", keadaanAkar.pesan || "Folder e-Doc SIPP tidak dapat ditulis.");

    const urutan = Number(r.urutan);
    const relatif = jalurBas(nomorSipp, r.tanggal_daftar, urutan, d.capWaktu(), bentuk);
    if (!relatif) return gagal("nomor_atau_tanggal_daftar_tidak_sah", "Nomor perkara atau tanggal pendaftaran di SIPP tidak berbentuk baku.");
    const penuh = path.join(keadaanAkar.akar, relatif);

    // Berkas DAHULU, baris sesudahnya - seperti SIPP (move_uploaded_file lalu update_data).
    try {
      d.tulisBerkas(penuh, siap.isi);
      d.samakanPemilik(penuh, keadaanAkar.akar);
    } catch (e) {
      return gagal("berkas_tidak_dapat_ditulis", String((e && e.message) || e).slice(0, 200));
    }

    // Bersyarat nilai LAMA, juga saat mengganti: e-Doc yang diganti orang lain di
    // antara bacaan dan tulisan tidak ditimpa diam-diam (berkasnya yatim, dan yang
    // dipindah ke "terhapus" justru berkas lama yang sudah tidak dipakai).
    const hasil = await d.kueri(
      lama
        ? "UPDATE perkara_jadwal_sidang SET edoc_bas = ? WHERE id = ? AND perkara_id = ? AND edoc_bas = ?"
        : "UPDATE perkara_jadwal_sidang SET edoc_bas = ? WHERE id = ? AND perkara_id = ? AND (edoc_bas IS NULL OR edoc_bas = '')",
      lama ? [relatif, sid, pid, String(r.edoc_bas)] : [relatif, sid, pid]
    );
    const terubah = Number((hasil && hasil.affectedRows) || 0);
    if (terubah < 1) {
      // Orang lain mengunggah di antara bacaan dan tulisan: berkas kita dibuang, miliknya dibiarkan.
      d.hapusBerkas(penuh);
      return gagal(
        "sudah_ada",
        lama
          ? "Sementara ALETA menyiapkan berkas, e-Doc BAS sidang ini sudah diganti orang lain di SIPP. Tidak diganti - muat ulang lalu ulangi."
          : "Sementara ALETA menyiapkan berkas, e-Doc BAS sidang ini sudah diisi orang lain di SIPP. Tidak diganti."
      );
    }

    // Butir 44 (17 Okt 2026): berkas lama TIDAK dibiarkan di tempatnya - dipindah ke
    // <folder>/terhapus/. SESUDAH baris diganti: bila penggantian gagal, berkas lama
    // tetap yang dipakai SIPP. Gagal memindah tidak membatalkan penggantian; sebabnya
    // dilaporkan ke petugas dan dicatat di jejak ALETA.
    let lamaDipindah = "";
    let peringatanLama = "";
    if (lama) {
      const tujuan = jalurTerhapus(lama, typeof d.sekarang === "function" ? d.sekarang() : new Date());
      if (!tujuan) peringatanLama = "Jalur berkas BAS lama tidak baku - berkasnya tidak dipindah.";
      else if (typeof d.pindahBerkas !== "function") peringatanLama = "Berkas BAS lama belum dapat dipindah.";
      else {
        try {
          const pindah = d.pindahBerkas(path.join(keadaanAkar.akar, lama), path.join(keadaanAkar.akar, tujuan));
          if (pindah === false) peringatanLama = "Berkas BAS lama tidak ditemukan di folder SIPP - tidak ada yang dipindah.";
          else {
            lamaDipindah = tujuan;
            try {
              d.samakanPemilik(path.join(keadaanAkar.akar, tujuan), keadaanAkar.akar);
            } catch {
              /* pemilik berkas hanya kerapian */
            }
          }
        } catch (e) {
          peringatanLama = `Berkas BAS lama belum dapat dipindah ke folder terhapus: ${String((e && e.message) || e).slice(0, 160)}`;
        }
      }
    }

    await Promise.resolve(
      d.catatJejak({
        ...jejakDasar,
        berhasil: true,
        tanggalPenetapan: tanggal,
        alasan: akun.terpetakan || !akun.username ? "" : "akun_sipp_tidak_terpetakan",
        langkah: [
          {
            tabel: "perkara_jadwal_sidang",
            aksi: "UPDATE",
            keterangan: `edoc_bas sidang ke-${urutan}: ${relatif}${
              lama ? ` (mengganti ${lama}; ${lamaDipindah ? `berkas lama dipindah ke ${lamaDipindah}` : `berkas lama TIDAK dipindah: ${peringatanLama}`})` : ""
            }`,
          },
        ],
      })
    ).catch(() => false);

    return {
      ok: true,
      jalur: relatif,
      nama: path.basename(relatif),
      urutan,
      bentuk,
      diganti: Boolean(lama),
      jalurLama: lama ? lama.split("/").pop() : "",
      lamaDipindah,
      peringatanLama,
    };
  }

  return { unggahBas };
}

const bawaan = buatLayanan();

module.exports = {
  PERAN_BOLEH_UNGGAH_BAS,
  PESAN_TOLAK_BAS,
  periksaHakUnggahBas,
  namaBerkasBas,
  jalurBas,
  jalurTerhapus,
  buatLayanan,
  unggahBas: (...a) => bawaan.unggahBas(...a),
};
