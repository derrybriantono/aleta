"use strict";

/**
 * ============================================================================
 * ISIAN POPUP BLANGKO DERRY YANG DATANYA ADA DI SIPP (daftar cek Z1, 18 Okt 2026)
 * ============================================================================
 *
 * docs/isi-sipp-abt/DAFTAR-CEK.md menyisir 982 blangko Derry dan mencatat isian popup yang belum punya pengisi
 * padahal SIPP menyimpan datanya secara terstruktur. Berkas ini mengisinya lewat kanal "Isi dari SIPP" yang sama
 * (dariSipp -> usulan): SELECT saja, tidak pernah menulis ke SIPP.
 *
 *   8705  Tanggal kesepakatan perdamaian        perkara_mediasi.tgl_kesepakatan_perdamaian (hasil Y1 = akta perdamaian)
 *   8704  Isi kesepakatan perdamaian            perkara_mediasi.isi_kesepakatan_perdamaian (HTML -> baris "<br>")
 *   8433  Alasan pencabutan perkara             hasil_mediasi Y2 = "Berhasil Dengan Pencabutan" (borang SIPP tab_mediasi_edit2)
 *   1183  Tgl. batas waktu ikrar talak          perkara_ikrar_talak.tanggal_sidang_pertama + 6 bulan  (RAGU: 8 dari 12 isian
 *                                               petugas persis sama; sisanya sidang ikrar pertama diundur)
 *   0303  Tgl. pengumuman itsbat                perkara.tanggal_pendaftaran (RAGU: 92% isian petugas jatuh 0-1 hari dari
 *                                               tanggal pendaftaran, tepatnya 45% hari-H dan 47% sehari sesudahnya)
 *   0185  Tgl. surat kuasa Tergugat             perkara_pengacara pihak 2 (RAGU: kolom itu sering tanggal register)
 *
 * Aturan:
 *   - hanya SELECT, tiap pembacaan dijaga (tabel/kolom yang tidak ada = isian itu dilewati);
 *   - nilai ditulis hanya bila datanya ada; "ragu" tidak pernah tercentang sendiri dan tidak menimpa isian petugas;
 *   - semua usulan membawa jagaIsianLama: hanya mengisi isian yang kosong atau berisi garis bawah "_".
 */

const KODE = Object.freeze({ tanggalKesepakatan: "8705", isiKesepakatan: "8704", alasanCabut: "8433", batasIkrar: "1183", pengumumanItsbat: "0303", suratKuasaTergugat: "0185" });
const BATAS_TEKS = 6000;

/** "YYYY-MM-DD" -> "DD/MM/YYYY" (bentuk tampil usulan tanggal); "" bila bukan tanggal sungguhan. */
function isoKeTampil(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  return m && m[1] !== "0000" && m[2] !== "00" && m[3] !== "00" ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** Tambah n bulan pada "YYYY-MM-DD" seperti DATE_ADD MySQL (hari dijepit ke akhir bulan). */
function tambahBulanIso(iso, n) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m || m[1] === "0000") return "";
  const total = Number(m[1]) * 12 + (Number(m[2]) - 1) + n;
  const tahun = Math.floor(total / 12);
  const bulan = (total % 12) + 1;
  const akhir = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate();
  const hari = Math.min(Number(m[3]), akhir);
  return `${String(tahun).padStart(4, "0")}-${String(bulan).padStart(2, "0")}-${String(hari).padStart(2, "0")}`;
}

const ENTITAS = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', ndash: "-", mdash: "-", hellip: "..." };
function dekodeEntitas(s) {
  return String(s)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Math.min(Number(n), 0x10ffff)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(Math.min(parseInt(h, 16), 0x10ffff)))
    .replace(/&([a-z]+);/gi, (m, nama) => (ENTITAS[nama.toLowerCase()] !== undefined ? ENTITAS[nama.toLowerCase()] : m));
}

/**
 * HTML editor SIPP (paragraf, <strong>, daftar <ol>/<ul>) -> baris teks polos yang disambung "<br>" - bentuk bawaan
 * variabel ABT sejenis (mis. 8704: "Pasal 1<br>Para Pihak ... <br>Pasal 2<br>..."). Daftar bernomor dinomori ulang.
 */
function htmlKeBaris(html) {
  const sumber = String(html == null ? "" : html).replace(/\r/g, "");
  if (!sumber.trim()) return "";
  const tumpuk = [];
  let hasil = "";
  const pola = /<\s*(\/?)\s*([a-z0-9]+)[^>]*>|([^<]+)/gi;
  let m;
  while ((m = pola.exec(sumber))) {
    if (m[3] !== undefined) {
      hasil += m[3].replace(/\s+/g, " ");
      continue;
    }
    const tutup = m[1] === "/";
    const tag = m[2].toLowerCase();
    if (tag === "br") hasil += "\n";
    else if (tag === "ol" || tag === "ul") {
      if (tutup) tumpuk.pop();
      else tumpuk.push({ jenis: tag, nomor: 0 });
      hasil += "\n";
    } else if (tag === "li") {
      if (tutup) hasil += "\n";
      else {
        const atas = tumpuk[tumpuk.length - 1];
        if (atas) {
          atas.nomor += 1;
          hasil += `\n${atas.jenis === "ol" ? `${atas.nomor}. ` : "- "}`;
        } else hasil += "\n";
      }
    } else if (["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "tr"].includes(tag)) hasil += "\n";
  }
  const baris = dekodeEntitas(hasil)
    .split("\n")
    .map((b) => b.replace(/ /g, " ").replace(/\s+/g, " ").trim())
    .filter((b) => b && b !== "-");
  return baris.join("<br>");
}

function butir(kode, nama, nilai, keyakinan, kalimat, catatan, kodePola) {
  return {
    kode,
    nama,
    nilai,
    keyakinan,
    bentrok: "",
    sumber: kalimat ? [{ saksi: 0, asal: "sipp", kalimat }] : [],
    catatan: catatan || "",
    dihitung: false,
    jagaIsianLama: true,
    kodePola,
  };
}

/** Kesepakatan perdamaian dari baris perkara_mediasi (hasil Y1 = berhasil dengan akta perdamaian). */
function usulanKesepakatan(m) {
  if (!m) return [];
  const hasil = String(m.hasil || "").toUpperCase();
  if (hasil !== "Y1") return [];
  const keluar = [];
  const tgl = isoKeTampil(m.tgl);
  if (tgl) {
    keluar.push(
      butir(KODE.tanggalKesepakatan, "Tanggal kesepakatan perdamaian", tgl, "pasti", `SIPP mediasi: kesepakatan perdamaian ${tgl}`, "", "sipp-mediasi-tgl-kesepakatan")
    );
  }
  const isi = htmlKeBaris(m.isi);
  if (isi) {
    if (isi.length > BATAS_TEKS) {
      keluar.push(
        butir(KODE.isiKesepakatan, "Isi kesepakatan perdamaian", "", "kosong", "", `Isi kesepakatan di SIPP terlalu panjang (${isi.length} huruf) untuk satu isian; salin dari SIPP.`, "sipp-mediasi-isi-panjang")
      );
    } else {
      keluar.push(
        butir(
          KODE.isiKesepakatan,
          "Isi kesepakatan perdamaian",
          isi,
          "cukup",
          `SIPP mediasi: ${isi.slice(0, 160)}`,
          "Disalin dari isian kesepakatan perdamaian di tab Mediasi SIPP; periksa bahwa yang tertulis memang kesepakatannya, bukan laporan mediator.",
          "sipp-mediasi-isi"
        )
      );
    }
  }
  return keluar;
}

/** Alasan pencabutan karena mediasi berhasil dengan pencabutan (hasil_mediasi Y2). */
function usulanAlasanCabut(m) {
  if (!m || String(m.hasil || "").toUpperCase() !== "Y2") return [];
  return [
    butir(
      KODE.alasanCabut,
      "Alasan pencabutan perkara",
      "mediasi berhasil dan para pihak telah berdamai",
      "cukup",
      "SIPP mediasi: hasil mediasi Berhasil Dengan Pencabutan (Y2)",
      "Hasil mediasi SIPP \"Berhasil Dengan Pencabutan\"; bila pencabutan terjadi karena sebab lain, ganti.",
      "sipp-mediasi-y2-cabut"
    ),
  ];
}

/** Batas waktu ikrar talak: 6 bulan sesudah sidang ikrar pertama (Pasal 70 ayat (6) UU 7/1989). */
function usulanBatasIkrar(ikrar) {
  const sp = String((ikrar && ikrar.sidangPertama) || "");
  const batas = tambahBulanIso(sp, 6);
  const tampil = isoKeTampil(batas);
  if (!tampil) return [];
  return [
    butir(
      KODE.batasIkrar,
      "Tgl. batas waktu ikrar talak",
      tampil,
      "ragu",
      `SIPP ikrar talak: sidang ikrar pertama ${isoKeTampil(sp)} + 6 bulan`,
      "Dihitung 6 bulan sesudah sidang ikrar pertama; bila sidang ikrar pertama diundur atau dipanggil ulang, hitung dari tanggal yang berlaku.",
      "sipp-ikrar-batas-6-bulan"
    ),
  ];
}

/** Pengumuman itsbat: biasanya pada tanggal pendaftaran atau sehari sesudahnya. */
function usulanPengumumanItsbat(perkara) {
  if (!perkara || Number(perkara.jenisPerkaraId) !== 360) return [];
  const tampil = isoKeTampil(perkara.tanggalDaftar);
  if (!tampil) return [];
  return [
    butir(
      KODE.pengumumanItsbat,
      "Tgl. pengumuman",
      tampil,
      "ragu",
      `SIPP: perkara didaftarkan ${tampil}`,
      "Pengumuman umumnya dilakukan pada tanggal pendaftaran atau sehari sesudahnya; isi sesuai tanggal juru sita mengumumkan.",
      "sipp-pendaftaran-pengumuman"
    ),
  ];
}

/** Tanggal surat kuasa Tergugat dari kuasa aktif pihak ke-2 di SIPP. */
function usulanKuasaTergugat(kuasa) {
  const p = (Array.isArray(kuasa) ? kuasa : []).find((x) => isoKeTampil(x && x.tanggalKuasa));
  if (!p) return [];
  const tampil = isoKeTampil(p.tanggalKuasa);
  return [
    butir(
      KODE.suratKuasaTergugat,
      "Tgl. surat kuasa Tergugat/Termohon",
      tampil,
      "ragu",
      `SIPP kuasa Tergugat: ${String(p.nama || "").trim()} tanggal ${tampil}${p.nomorKuasa ? ` (register ${String(p.nomorKuasa).trim()})` : ""}`,
      "Kolom tanggal kuasa SIPP kadang berisi tanggal register kepaniteraan, bukan tanggal surat kuasa; cocokkan dengan surat kuasanya.",
      "sipp-kuasa-tergugat-tgl"
    ),
  ];
}

const diam = (janji) => Promise.resolve(janji).catch(() => null);

/**
 * Semua usulan lanjutan satu perkara. `runQuery(sql, params)` = pembaca SIPP baca-saja milik abtUsulanService.
 * Kegagalan satu pembacaan tidak menggagalkan yang lain.
 */
async function usulanLanjutanSipp(perkaraId, runQuery) {
  const id = Number(perkaraId);
  if (!Number.isFinite(id) || id <= 0 || typeof runQuery !== "function") return [];
  const [perkara, mediasi, ikrar, kuasa] = await Promise.all([
    diam(
      runQuery(
        "SELECT p.jenis_perkara_id AS jenisPerkaraId, DATE_FORMAT(p.tanggal_pendaftaran, '%Y-%m-%d') AS tanggalDaftar FROM perkara p WHERE p.perkara_id = ? LIMIT 1",
        [id]
      )
    ),
    diam(
      runQuery(
        `SELECT m.hasil_mediasi AS hasil, DATE_FORMAT(m.tgl_kesepakatan_perdamaian, '%Y-%m-%d') AS tgl, m.isi_kesepakatan_perdamaian AS isi
           FROM perkara_mediasi m
          WHERE m.perkara_id = ?
          ORDER BY (m.hasil_mediasi IS NULL), m.mediasi_id DESC LIMIT 1`,
        [id]
      )
    ),
    diam(
      runQuery(
        "SELECT DATE_FORMAT(tanggal_sidang_pertama, '%Y-%m-%d') AS sidangPertama FROM perkara_ikrar_talak WHERE perkara_id = ? LIMIT 1",
        [id]
      )
    ),
    diam(
      runQuery(
        `SELECT nama, nomor_kuasa AS nomorKuasa, DATE_FORMAT(tanggal_kuasa, '%Y-%m-%d') AS tanggalKuasa
           FROM perkara_pengacara WHERE perkara_id = ? AND pihak_ke = 2 AND aktif = 'Y' ORDER BY urutan, id`,
        [id]
      )
    ),
  ]);
  const satu = (r) => (Array.isArray(r) && r[0]) || null;
  const jenis = satu(perkara);
  return [
    ...usulanKesepakatan(satu(mediasi)),
    ...usulanAlasanCabut(satu(mediasi)),
    ...usulanBatasIkrar(satu(ikrar)),
    ...usulanPengumumanItsbat(jenis),
    ...usulanKuasaTergugat(Array.isArray(kuasa) ? kuasa : []),
  ];
}

module.exports = {
  KODE,
  isoKeTampil,
  tambahBulanIso,
  htmlKeBaris,
  usulanKesepakatan,
  usulanAlasanCabut,
  usulanBatasIkrar,
  usulanPengumumanItsbat,
  usulanKuasaTergugat,
  usulanLanjutanSipp,
};
