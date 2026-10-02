"use strict";

/**
 * ============================================================================
 * EDOC PENETAPAN PMH / PPP / PJS / PHS - DARI ABT, BERTANDA TANGAN, BERCAP
 * (perbaikan 2 Okt 2026, butir 17, kontrak K6)
 * ============================================================================
 *
 * Yang dikerjakan: untuk satu perkara, mengambil dokumen penetapan dari ABT
 * (blangko Derry "Form Bantu PTSP"), membubuhkan TANDA TANGAN pejabat yang
 * namanya tertulis di dokumen itu (hanya gambar yang sudah DISAHKAN manusia,
 * tandaTanganService), menempelkan CAP di atas tanda tangan itu, mengubahnya
 * ke PDF, lalu mencatatkannya ke SIPP lewat jalur yang SUDAH ADA:
 * dokumenPenetapanService.simpanKeSipp (berkas di resources/file/doc + baris
 * perkara_dokumen_penetapan, yang dibaca ikon Cetak Dokumen tab Penetapan).
 * Boleh sebagian - jenis yang dokumennya tidak ada dilewati beserta sebabnya.
 *
 * ============================================================================
 * PETA BLANGKO - DIBACA DARI ABT SATKER (HANYA BACA, 2 Okt 2026)
 * ============================================================================
 *
 * aps_badilag.abt_menu id 991 "Form Bantu PTSP" (alias "Form PTSP"),
 * parent_direktori derry_briantono, direktori PTSP. Folder
 * _blangko_abt/derry_briantono/PTSP memuat empat berkas:
 *
 *   @ 0 - PMH - PHS.rtf    GABUNGAN, empat bagian berurutan:
 *                          1 PENETAPAN  ... MENETAPKAN ... memeriksa dan memutus  -> PMH
 *                          2 PENUNJUKAN ... MENUNJUK #0015# sebagai Panitera Sidang -> PPP
 *                          3 PENUNJUKAN ... MENUNJUK #0018# sebagai #6032#          -> PJS
 *                          4 PENETAPAN  ... dilangsungkan pada hari #0032#          -> PHS
 *   @ 1 - PMH.rtf          PMH saja
 *   @ 2 - PHS.rtf          PHS saja
 *   @PMH PHS - Lama.rtf    PMH + PHS bentuk lama
 *
 * PPP dan PJS HANYA ada di berkas gabungan. Karena itu dokumen ABT yang
 * memuat lebih dari satu bagian DIPISAH (pisahBagian) dan bagian yang dipakai
 * dikenali dari CIRI isinya - bukan dari urutannya saja: bagian yang tidak
 * cocok ciri jenisnya tidak pernah diunggah sebagai jenis itu.
 *
 * Alamat ABT per jenis tetap dari pengaturan blangkoPenetapan yang sudah ada
 * (dokumenPenetapanService.pengaturanBlangko) - ALETA tidak menebak alamat ABT.
 *
 * ============================================================================
 * TTE DAN PASSPHRASE
 * ============================================================================
 *
 * Tanda tangan yang dibubuhkan adalah GAMBAR tanda tangan pejabat yang sudah
 * disahkan, ditambah cap. TTE ELEKTRONIK (sertifikat) hanya dikerjakan bila
 * penyedia TTE disetel (ALETA_TTE_PENETAPAN_URL); passphrase diketik pengguna
 * tiap kali, diteruskan SEKALI ke penyedia, tidak disimpan, tidak dicatat, dan
 * disapu dari setiap pesan yang keluar. Passphrase yang dikirim padahal
 * penyedianya belum disetel DITOLAK (tte_belum_tersambung) - tidak diabaikan
 * diam-diam, sebab pengguna yang mengetik passphrase menyangka dokumennya
 * ber-TTE.
 *
 * ============================================================================
 * JEJAK JUJUR DI ALETA, TANPA TANDA ALETA DI SIPP (butir 14, K4)
 * ============================================================================
 *
 * perkara_dokumen_penetapan.diinput_oleh = akun SIPP petugas yang login.
 * Siapa + waktu + IP + "lewat ALETA" + cap/tanda tangan yang dipakai dicatat
 * di aleta_bot_jejak_penetapan (jejakAletaService, layar Riwayat ALETA).
 */

const tteBawaan = require("./tteProviderService");

const JENIS = ["pmh", "ppp", "pjs", "phs"];

/** Peta blangko PTSP Derry - lihat catatan kepala berkas. */
const PETA_PTSP = Object.freeze({
  sumber: "ABT",
  menu: { id: 991, nama: "Form Bantu PTSP", alias: "Form PTSP", kelompok: "derry_briantono", direktori: "PTSP" },
  berkasGabungan: "@ 0 - PMH - PHS.rtf",
  jenis: {
    pmh: {
      judul: "Penetapan Majelis Hakim (PMH)",
      kepala: "PENETAPAN",
      bagianGabungan: 1,
      berkasTunggal: "@ 1 - PMH.rtf",
      penandatangan: "ketua",
    },
    ppp: {
      judul: "Penunjukan Panitera Pengganti (PPP)",
      kepala: "PENUNJUKAN",
      bagianGabungan: 2,
      berkasTunggal: "",
      penandatangan: "panitera",
    },
    pjs: {
      judul: "Penunjukan Jurusita (PJS)",
      kepala: "PENUNJUKAN",
      bagianGabungan: 3,
      berkasTunggal: "",
      penandatangan: "panitera",
    },
    phs: {
      judul: "Penetapan Hari Sidang (PHS)",
      kepala: "PENETAPAN",
      bagianGabungan: 4,
      berkasTunggal: "@ 2 - PHS.rtf",
      penandatangan: "hakim",
    },
  },
});

/** Ciri isi tiap jenis - teks polos bagian itu (huruf kecil). */
const CIRI = {
  pmh: (t) => /menetapkan/.test(t) && /memeriksa\s+dan\s+memutus/.test(t) && !/dilangsungkan\s+pada\s+hari/.test(t),
  ppp: (t) =>
    /menunjuk/.test(t) &&
    (/panitera\s+sidang/.test(t) || (/panitera\s+pengganti/.test(t) && !/jurusita|juru\s+sita|#6032#/.test(t))),
  pjs: (t) => /menunjuk/.test(t) && (/jurusita|juru\s+sita|#6032#/.test(t)) && !/panitera\s+sidang/.test(t),
  phs: (t) => /dilangsungkan\s+pada\s+hari/.test(t),
};

// ===========================================================================
// MEMBACA RTF: TEKS POLOS PER BARIS DAN KEDALAMAN KELOMPOK
// ===========================================================================

/**
 * Menyapu RTF sekali: kedalaman kelompok, letak tiap \pard pada kedalaman 1,
 * awal tiap kelompok kedalaman-1, dan baris teks polos beserta letak huruf
 * pertamanya. Kelompok tujuan (\*, \pict, \fonttbl, dst.) tidak menyumbang
 * teks.
 */
function sapuRtf(rtf) {
  const s = String(rtf || "");
  const pardAtas = [];
  const kelompokAtas = []; // [awal, akhir) kelompok yang dibuka dari kedalaman 1
  const baris = [];
  let teks = "";
  let mulaiBaris = -1;
  let d = 0;
  const lewati = []; // kedalaman tempat kelompok tujuan dibuka
  const tutupBaris = () => {
    if (teks.trim()) baris.push({ teks: teks.replace(/\s+/g, " ").trim(), mulai: mulaiBaris });
    teks = "";
    mulaiBaris = -1;
  };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "{") {
      if (d === 1) kelompokAtas.push([i, -1]);
      d += 1;
      // Kelompok tujuan: {\* ...}, {\pict ...}, {\fonttbl ...} dsb.
      const sesudah = s.slice(i + 1, i + 16);
      if (/^\\(\*|pict|fonttbl|colortbl|stylesheet|info|header|footer|listtable|listoverridetable|shp|object|themedata|colorschememapping|latentstyles|datastore|xmlnstbl|rsidtbl|generator|pgdsctbl)/.test(sesudah)) {
        lewati.push(d);
      }
      continue;
    }
    if (c === "}") {
      if (lewati.length && lewati[lewati.length - 1] === d) lewati.pop();
      d -= 1;
      if (d === 1 && kelompokAtas.length && kelompokAtas[kelompokAtas.length - 1][1] < 0) {
        kelompokAtas[kelompokAtas.length - 1][1] = i + 1;
      }
      continue;
    }
    if (c === "\\") {
      const m = /^\\([a-zA-Z]+)(-?\d+)? ?/.exec(s.slice(i, i + 40));
      if (m) {
        if (m[1] === "pard" && d === 1) pardAtas.push(i);
        if (!lewati.length && (m[1] === "par" || m[1] === "line" || m[1] === "page" || m[1] === "sect" || m[1] === "row")) {
          tutupBaris();
        } else if (!lewati.length && m[1] === "tab") {
          teks += " ";
        }
        // \bin N: N bita mentah - dilompati.
        if (m[1] === "bin" && m[2]) i += Number(m[2]);
        i += m[0].length - 1;
        continue;
      }
      // \'hh - huruf berkode.
      const h = /^\\'([0-9a-fA-F]{2})/.exec(s.slice(i, i + 4));
      if (h) {
        if (!lewati.length) {
          if (mulaiBaris < 0) mulaiBaris = i;
          teks += String.fromCharCode(parseInt(h[1], 16));
        }
        i += 3;
        continue;
      }
      // \\ \{ \} dan simbol lain.
      if (!lewati.length && /[\\{}]/.test(s[i + 1] || "")) {
        if (mulaiBaris < 0) mulaiBaris = i;
        teks += s[i + 1];
      }
      i += 1;
      continue;
    }
    if (c === "\r" || c === "\n") continue;
    if (!lewati.length) {
      if (mulaiBaris < 0 && c.trim()) mulaiBaris = i;
      teks += c;
    }
  }
  tutupBaris();
  return { pardAtas, kelompokAtas, baris, kedalamanAkhir: d };
}

/** Teks polos seluruh RTF (huruf kecil) - untuk ciri. */
function teksPolos(rtf) {
  return sapuRtf(rtf)
    .baris.map((b) => b.teks)
    .join("\n")
    .toLowerCase();
}

/**
 * Batas potong yang aman (kedalaman 1) sebelum letak `posisi`: \pard
 * kedalaman-1 terakhir sebelum posisi itu, atau - bila posisi berada di
 * dalam kelompok kedalaman-1 yang dibuka sesudah \pard itu - awal kelompok
 * tersebut. Keduanya titik di mana kurung kurawal seimbang.
 */
function batasAman(sapuan, posisi, sesudah) {
  let calon = -1;
  for (const p of sapuan.pardAtas) {
    if (p < posisi && p > sesudah) calon = p;
  }
  for (const [awal, akhir] of sapuan.kelompokAtas) {
    if (awal < posisi && (akhir < 0 || akhir > posisi) && awal > sesudah) calon = Math.max(calon, awal);
  }
  return calon;
}

/**
 * Memisah RTF menjadi bagian-bagian menurut baris kepala PENETAPAN /
 * PENUNJUKAN. Tiap bagian menjadi RTF utuh: pembuka dokumen (tabel huruf,
 * warna, gaya, kop) + isi bagian itu + penutup "}".
 *
 * @returns {{ok: boolean, bagian?: Array<{rtf: string, kepala: string, teks: string}>, alasan?: string}}
 */
function pisahBagian(rtf) {
  const s = String(rtf || "");
  if (!s.startsWith("{\\rtf")) return { ok: false, alasan: "bukan_rtf" };
  const sapuan = sapuRtf(s);
  if (sapuan.kedalamanAkhir !== 0) return { ok: false, alasan: "kurung_rtf_tidak_seimbang" };
  const kepala = sapuan.baris.filter((b) => /^(PENETAPAN|PENUNJUKAN)$/.test(b.teks) && b.mulai > 0);
  if (kepala.length <= 1) {
    return { ok: true, bagian: [{ rtf: s, kepala: kepala[0] ? kepala[0].teks : "", teks: teksPolos(s) }] };
  }
  const batas = [];
  let sebelumnya = 0;
  for (const k of kepala) {
    const b = batasAman(sapuan, k.mulai, sebelumnya);
    if (b <= sebelumnya) return { ok: false, alasan: "bagian_tidak_terpisah" };
    batas.push(b);
    sebelumnya = b;
  }
  const akhirIsi = s.lastIndexOf("}");
  const pembuka = s.slice(0, batas[0]);
  const bagian = [];
  for (let i = 0; i < batas.length; i++) {
    const isi = s.slice(batas[i], i + 1 < batas.length ? batas[i + 1] : akhirIsi);
    const satu = (i === 0 ? s.slice(0, batas[1] || akhirIsi) : pembuka + isi) + "}";
    const cek = sapuRtf(satu);
    if (cek.kedalamanAkhir !== 0) return { ok: false, alasan: "bagian_tidak_seimbang" };
    bagian.push({ rtf: satu, kepala: kepala[i].teks, teks: teksPolos(satu) });
  }
  return { ok: true, bagian };
}

/**
 * Bagian untuk satu jenis - dikenali dari CIRI isinya. Dokumen satu bagian
 * pun diperiksa cirinya: dokumen PHS yang terambil dari alamat PMH ditolak.
 */
function ambilBagian(rtf, jenis) {
  const peta = PETA_PTSP.jenis[jenis];
  if (!peta) return { ok: false, alasan: "jenis_tidak_didukung" };
  const pisah = pisahBagian(rtf);
  if (!pisah.ok) return pisah;
  const cocok = pisah.bagian.filter((b) => (!b.kepala || b.kepala === peta.kepala) && CIRI[jenis](b.teks));
  if (cocok.length === 0) return { ok: false, alasan: `blangko_tidak_memuat_${jenis}`, jumlahBagian: pisah.bagian.length };
  if (cocok.length > 1) return { ok: false, alasan: `bagian_${jenis}_ganda`, jumlahBagian: pisah.bagian.length };
  return { ok: true, rtf: cocok[0].rtf, teks: cocok[0].teks, jumlahBagian: pisah.bagian.length };
}

// ===========================================================================
// TANDA TANGAN DAN CAP
// ===========================================================================

function heksGambar(isi) {
  return Buffer.from(isi).toString("hex");
}

function jenisGambar(isi, jenisDisebut) {
  const b = Buffer.from(isi || []);
  if (b.length > 3 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b.length > 2 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  return String(jenisDisebut || "").toLowerCase() === "jpg" ? "jpg" : "";
}

/**
 * Menempelkan CAP sebagai bentuk mengambang DI DEPAN tanda tangan.
 *
 * Disisipkan tepat sebelum kelompok gambar tanda tangan, di paragraf yang
 * sama: \shpwr3 (tanpa pembungkus teks), \shpfblwtxt0 (di depan teks),
 * digeser ke kiri dan ke atas supaya menumpang separuh tanda tangan - seperti
 * cap basah yang dibubuhkan di atas goresan tinta.
 */
function sisipkanCap(rtf, { isi, jenis, penandaTtd, lebarTwip = 1500, tinggiTwip = 1500 }) {
  const s = String(rtf || "");
  const bentuk = jenisGambar(isi, jenis);
  if (!bentuk) return { ok: false, alasan: "cap_bukan_png_jpg" };
  const letak = s.indexOf(penandaTtd);
  if (letak < 0) return { ok: false, alasan: "tanda_tangan_belum_terpasang" };
  const blip = bentuk === "jpg" ? "jpegblip" : "pngblip";
  const kiri = -Math.round(lebarTwip * 0.45);
  const atas = -Math.round(tinggiTwip * 0.35);
  const bentukCap =
    `{\\shp{\\*\\shpinst\\shpleft${kiri}\\shptop${atas}\\shpright${kiri + lebarTwip}\\shpbottom${atas + tinggiTwip}` +
    `\\shpfhdr0\\shpbxcolumn\\shpbxignore\\shpbypara\\shpbyignore\\shpwr3\\shpwrk0\\shpfblwtxt0\\shpz1\\shplockanchor` +
    `{\\sp{\\sn shapeType}{\\sv 75}}{\\sp{\\sn fBehindDocument}{\\sv 0}}{\\sp{\\sn fLayoutInCell}{\\sv 1}}` +
    `{\\sp{\\sn pib}{\\sv {\\pict\\${blip}\\picwgoal${lebarTwip}\\pichgoal${tinggiTwip} ${heksGambar(isi)}}}}}}`;
  return { ok: true, rtf: `${s.slice(0, letak)}${bentukCap}${s.slice(letak)}` };
}

/**
 * Pejabat penandatangan: tanda tangan SAH yang namanya tertulis di bagian
 * dokumen ini. Tanda tangan milik pengguna yang login didahulukan ("sesuai
 * user"); bila namanya tidak ada di dokumen, dicari di antara tanda tangan
 * sah lain - yang namanya muncul PALING AKHIR di dokumen (blok tanda tangan
 * ada di ujung). Tidak ada yang cocok = tidak dibubuhkan, sebabnya disebut.
 */
async function pilihTandaTangan({ teks, penggunaId, ttd }) {
  const baku = (n) => ttd.bakuNama(n);
  const polos = String(teks || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const milik = penggunaId ? await ttd.untukPengguna(penggunaId).catch(() => null) : null;
  if (milik && baku(milik.namaPejabat) && polos.includes(baku(milik.namaPejabat))) {
    return { ...milik, sumber: "pengguna" };
  }
  const daftar = await ttd.daftar({ hanyaSah: true }).catch(() => ({ baris: [] }));
  let terbaik = null;
  for (const b of (daftar && daftar.baris) || []) {
    const n = baku(b.namaPejabat);
    if (!n) continue;
    const di = polos.lastIndexOf(n);
    if (di >= 0 && (!terbaik || di > terbaik.di)) terbaik = { di, baris: b };
  }
  if (!terbaik) return null;
  const g = await ttd.gambar(terbaik.baris.id).catch(() => null);
  if (!g || !g.isi) return null;
  return { id: terbaik.baris.id, namaPejabat: terbaik.baris.namaPejabat, jenis: g.jenis, isi: g.isi, sumber: "nama_di_dokumen" };
}

// ===========================================================================
// LAYANAN
// ===========================================================================

function depsBawaan() {
  const sippDb = require("../db_config");
  return {
    kueriSipp: (sql, params = []) =>
      new Promise((ok, gagal) => sippDb.query(sql, params, (g, h) => (g ? gagal(g) : ok(h)))),
    dokumen: require("./dokumenPenetapanService"),
    ttd: require("./tandaTanganService"),
    cetak: require("./abtCetakService"),
    jejak: require("./jejakAletaService"),
    jeda: require("./jedaManusiaService"),
    tte: tteBawaan,
  };
}

function buatLayanan(depsMasuk) {
  let cache = null;
  const deps = () => {
    if (!cache) cache = depsMasuk || depsBawaan();
    return cache;
  };

  /**
   * Akun SIPP petugas yang login - yang tercatat sebagai diinput_oleh.
   *
   * olehUsername dari panel SIPP bisa berupa username atau NAMA LENGKAP
   * ("Selamat Datang <nama>"); keduanya dicocokkan ke sys_users. Bila panel
   * tidak mengirimnya, nama pengguna ALETA yang login dicocokkan ke fullname
   * SIPP (orang yang sama). Tidak ketemu = kosong -> menulis DITOLAK; tidak
   * pernah diganti nama orang lain.
   */
  async function akunSippPemicu({ olehUsername, namaPengguna }) {
    const cari = async (teks) => {
      const t = String(teks || "").trim();
      if (!t) return "";
      const b = await deps()
        .kueriSipp(
          "SELECT username FROM sys_users WHERE username = ? OR LOWER(fullname) = LOWER(?) ORDER BY username = ? DESC LIMIT 1",
          [t, t, t]
        )
        .catch(() => []);
      return Array.isArray(b) && b[0] ? String(b[0].username || "").trim() : "";
    };
    const dikirim = String(olehUsername || "").trim();
    if (dikirim) {
      const u = await cari(dikirim);
      return u ? { username: u, terpetakan: true } : { username: dikirim, terpetakan: false };
    }
    const dariNama = await cari(namaPengguna);
    return dariNama ? { username: dariNama, terpetakan: true } : { username: "", terpetakan: false };
  }

  async function kenaliPerkara({ perkaraId, nomorPerkara }) {
    const id = Number(perkaraId);
    if (Number.isInteger(id) && id > 0) {
      const b = await deps()
        .kueriSipp("SELECT perkara_id, nomor_perkara FROM perkara WHERE perkara_id = ? LIMIT 1", [id])
        .catch(() => []);
      if (Array.isArray(b) && b[0]) return { perkaraId: Number(b[0].perkara_id), nomorPerkara: String(b[0].nomor_perkara) };
    }
    const nomor = String(nomorPerkara || "").trim();
    if (!nomor) return null;
    const b = await deps()
      .kueriSipp("SELECT perkara_id, nomor_perkara FROM perkara WHERE nomor_perkara = ? LIMIT 1", [nomor])
      .catch(() => []);
    return Array.isArray(b) && b[0] ? { perkaraId: Number(b[0].perkara_id), nomorPerkara: String(b[0].nomor_perkara) } : null;
  }

  /**
   * Jenis mana yang TERSEDIA untuk perkara ini: alamat ABT-nya disetel,
   * penetapannya sudah ada di SIPP (baris petugas yang ditunjuk), dan apakah
   * dokumennya sudah pernah diunggah. Tidak menulis apa pun.
   */
  async function peta({ perkaraId, nomorPerkara } = {}) {
    const perkara = await kenaliPerkara({ perkaraId, nomorPerkara });
    if (!perkara) return { ok: false, alasan: "perkara_tidak_ditemukan" };
    const d = deps();
    const atur = d.dokumen.pengaturanBlangko();
    const sudah = await d
      .kueriSipp(
        "SELECT jenis_dokumen_id, MAX(diinput_tanggal) AS terakhir, COUNT(*) AS n FROM perkara_dokumen_penetapan WHERE perkara_id = ? GROUP BY jenis_dokumen_id",
        [perkara.perkaraId]
      )
      .catch(() => []);
    const petaSudah = new Map((Array.isArray(sudah) ? sudah : []).map((b) => [Number(b.jenis_dokumen_id), b]));
    const jenis = [];
    for (const k of JENIS) {
      const p = PETA_PTSP.jenis[k];
      const baris = await d
        .kueriSipp(`SELECT id FROM ${d.dokumen.TABEL_PENETAPAN[k]} WHERE perkara_id = ? ORDER BY id DESC LIMIT 1`, [
          perkara.perkaraId,
        ])
        .catch(() => []);
      const adaPenetapan = Array.isArray(baris) && baris.length > 0;
      const alamatDisetel = Boolean(atur.aktif && atur[k]);
      const s = petaSudah.get(d.dokumen.JENIS_DOKUMEN_ID[k]);
      const alasan = !atur.aktif
        ? "blangko_belum_dinyalakan"
        : !atur[k]
          ? `alamat_blangko_${k}_belum_disetel`
          : !adaPenetapan
            ? `penetapan_${k}_belum_ada_di_sipp`
            : "";
      jenis.push({
        jenis: k,
        judul: p.judul,
        tersedia: !alasan,
        alasan,
        alamatDisetel,
        adaPenetapan,
        sudahDiunggah: Boolean(s),
        jumlahDiunggah: s ? Number(s.n) || 0 : 0,
        terakhirDiunggah: s && s.terakhir ? String(s.terakhir instanceof Date ? s.terakhir.toISOString() : s.terakhir) : "",
        blangko: {
          sumber: PETA_PTSP.sumber,
          menu: `${PETA_PTSP.menu.kelompok}/${PETA_PTSP.menu.direktori} (${PETA_PTSP.menu.nama})`,
          berkas: p.berkasTunggal || PETA_PTSP.berkasGabungan,
          bagianGabungan: p.bagianGabungan,
        },
        penandatangan: p.penandatangan,
      });
    }
    return { ok: true, perkara, jenis, petaBlangko: PETA_PTSP, tteElektronik: Boolean(d.tte && d.tte.tersedia && d.tte.tersedia()) };
  }

  /**
   * Menyiapkan PDF satu jenis: RTF (dari ABT atau unggahan manual) -> bagian
   * yang cocok -> tanda tangan -> cap -> PDF -> (TTE bila diminta).
   */
  async function siapkanPdf({ jenis, rtf, penggunaId, cap, tte }) {
    const d = deps();
    const bagian = ambilBagian(rtf, jenis);
    if (!bagian.ok) return { ...bagian, langkah: "bagian" };

    const ttd = await pilihTandaTangan({ teks: bagian.teks, penggunaId, ttd: d.ttd });
    if (!ttd) return { ok: false, langkah: "tanda_tangan", alasan: "tanda_tangan_sah_tidak_ada_untuk_nama_di_dokumen" };
    const dibubuhi = d.dokumen.sisipkanTandaTangan(bagian.rtf, {
      isi: ttd.isi,
      jenis: ttd.jenis,
      namaPejabat: ttd.namaPejabat,
    });
    if (!dibubuhi.ok) return { ...dibubuhi, langkah: "tanda_tangan" };

    if (!cap || !cap.isi || !cap.isi.length) return { ok: false, langkah: "cap", alasan: "cap_belum_ada" };
    // Penanda letak tanda tangan: awal kelompok gambar yang baru disisipkan.
    const heks = heksGambar(ttd.isi).slice(0, 64);
    const awalTtd = dibubuhi.rtf.indexOf(heks);
    const pembukaPict = awalTtd >= 0 ? dibubuhi.rtf.lastIndexOf("{\\pict", awalTtd) : -1;
    if (pembukaPict < 0) return { ok: false, langkah: "cap", alasan: "tanda_tangan_belum_terpasang" };
    const bercap = sisipkanCap(dibubuhi.rtf, {
      isi: cap.isi,
      jenis: cap.jenis,
      penandaTtd: dibubuhi.rtf.slice(pembukaPict, pembukaPict + 40),
    });
    if (!bercap.ok) return { ...bercap, langkah: "cap" };

    const pdf = await d.cetak.rtfKePdf(Buffer.from(bercap.rtf, "latin1"));
    if (!pdf.ok) return { ok: false, langkah: "pdf", alasan: pdf.alasan || "pdf_gagal" };

    let akhir = pdf.pdf;
    let ber_tte = false;
    if (tte && tte.passphrase) {
      const t = await d.tte.tandatangani({ pdf: akhir, passphrase: tte.passphrase, nik: tte.nik, penggunaId });
      if (!t.ok) return { ok: false, langkah: "tte", alasan: t.alasan || "tte_gagal" };
      akhir = t.pdf;
      ber_tte = true;
    }
    return {
      ok: true,
      pdf: akhir,
      tandaTangan: { id: ttd.id, namaPejabat: ttd.namaPejabat, sumber: ttd.sumber },
      tte: ber_tte,
      jumlahBagian: bagian.jumlahBagian,
    };
  }

  /**
   * Mengunggah edoc penetapan - jenis[] dari ABT dan/atau manual[].
   *
   * @param {object} m
   *   perkaraId|nomorPerkara, jenis: string[], manual: [{jenis, isi(Buffer)}],
   *   cap: { [jenis]: {isi: Buffer, jenis, id, nama} }, penggunaId, operator,
   *   olehUsername (akun SIPP petugas yang login), ip,
   *   passphrase (opsional, TIDAK disimpan), nik, kering (bawaan true).
   */
  async function unggah(m = {}) {
    const d = deps();
    const passphrase = typeof m.passphrase === "string" ? m.passphrase : "";
    const sapu = (teks) => (passphrase ? String(teks || "").split(passphrase).join("***") : String(teks || ""));
    const kering = m.kering !== false;

    // TTE elektronik hanya bila penyedianya disetel. Tanpa itu passphrase
    // TIDAK dikirim ke mana pun (dibuang di sini) dan setiap hasil menyebut
    // tte:false - peta (tte.elektronik) sudah memberitahu sebelum tombol
    // ditekan, jadi ini bukan pengabaian diam-diam.
    const tteElektronik = Boolean(passphrase) && d.tte.tersedia();
    const perkara = await kenaliPerkara(m);
    if (!perkara) return { ok: false, alasan: "perkara_tidak_ditemukan" };
    // Pelaku di SIPP = petugas yang login (butir 14). Lihat akunSippPemicu.
    const akun = await akunSippPemicu({ olehUsername: m.olehUsername, namaPengguna: m.operator });
    const olehUsername = akun.username;
    if (!kering && !olehUsername) return { ok: false, alasan: "akun_sipp_tidak_terkirim" };

    const dariAbt = [...new Set((Array.isArray(m.jenis) ? m.jenis : []).map((x) => String(x).toLowerCase()))].filter((x) =>
      JENIS.includes(x)
    );
    const manual = (Array.isArray(m.manual) ? m.manual : [])
      .map((x) => ({ jenis: String((x && x.jenis) || "").toLowerCase(), isi: x && x.isi }))
      .filter((x) => JENIS.includes(x.jenis) && Buffer.isBuffer(x.isi) && x.isi.length > 0);
    if (!dariAbt.length && !manual.length) return { ok: false, alasan: "tidak_ada_jenis_dipilih" };

    const hasil = [];
    const kerjakan = [
      ...dariAbt.map((j) => ({ jenis: j, sumber: "abt" })),
      ...manual.map((x) => ({ jenis: x.jenis, sumber: "manual", isi: x.isi })),
    ];
    for (let i = 0; i < kerjakan.length; i++) {
      const k = kerjakan[i];
      const cap = (m.cap && m.cap[k.jenis]) || null;
      let satu;
      try {
        satu = await kerjakanSatu({ ...k, perkara, cap, olehUsername, penggunaId: m.penggunaId, passphrase, nik: m.nik, kering, tteElektronik });
      } catch (galat) {
        satu = { ok: false, alasan: `galat: ${sapu(galat && galat.message).slice(0, 160)}` };
      }
      satu.alasan = sapu(satu.alasan);
      hasil.push({ jenis: k.jenis, sumber: k.sumber, ...satu });

      await Promise.resolve(
        d.jejak.catat({
          aksi: "unggah",
          jenis: `edoc_${k.jenis}`,
          perkaraId: perkara.perkaraId,
          nomorPerkara: perkara.nomorPerkara,
          akunSipp: olehUsername,
          namaPejabat: (satu.tandaTangan && satu.tandaTangan.namaPejabat) || "",
          operator: String(m.operator || "").slice(0, 120),
          ip: String(m.ip || ""),
          berhasil: Boolean(satu.ok),
          kering,
          alasan: satu.ok ? "" : String(satu.alasan || "gagal"),
          langkah: satu.ok && !kering
            ? [
                { tabel: "perkara_dokumen_penetapan", aksi: "INSERT", keterangan: `${k.jenis.toUpperCase()} ${satu.jalur || ""}` },
                {
                  tabel: "",
                  aksi: "INFO",
                  keterangan:
                    `sumber ${k.sumber}; ttd ${(satu.tandaTangan && satu.tandaTangan.namaPejabat) || "-"}; ` +
                    `cap ${(cap && (cap.nama || cap.id)) || "-"}; tte ${satu.tte ? "ya" : "tidak"}`,
                },
              ]
            : [],
        })
      ).catch(() => false);

      // Jeda seperti manusia antar jenis (butir 14) - tidak pada mode kering.
      if (!kering && i + 1 < kerjakan.length) await d.jeda.jeda("simpan");
    }
    const berhasil = hasil.filter((x) => x.ok);
    return {
      ok: berhasil.length > 0,
      sebagian: berhasil.length > 0 && berhasil.length < hasil.length,
      // Passphrase tidak pernah ikut; yang dilaporkan hanya apakah TTE
      // elektronik dikerjakan.
      tte: { elektronik: tteElektronik, passphraseDibuang: Boolean(passphrase) && !tteElektronik },
      akunSipp: { username: olehUsername, terpetakan: akun.terpetakan },
      kering,
      perkara,
      hasil: hasil.map((x) => {
        const { pdf, ...sisa } = x;
        void pdf;
        return sisa;
      }),
    };
  }

  async function kerjakanSatu({ jenis, sumber, isi, perkara, cap, olehUsername, penggunaId, passphrase, nik, kering, tteElektronik }) {
    const d = deps();
    let rtf = "";
    let pdfManual = null;
    if (sumber === "abt") {
      const b = await d.dokumen.ambilBlangko(jenis, perkara.nomorPerkara);
      if (!b.ok) return { ok: false, langkah: "blangko", alasan: b.alasan };
      rtf = b.rtf;
    } else {
      const bentuk = d.cetak.kenaliDokumen(isi);
      if (bentuk === "rtf") rtf = isi.toString("latin1");
      else if (bentuk === "doc" || bentuk === "docx") {
        const r = await d.cetak.dokumenKeBentuk(isi, "rtf");
        if (!r.ok) return { ok: false, langkah: "konversi", alasan: r.kode || r.alasan || "konversi_gagal" };
        rtf = r.berkas.toString("latin1");
      } else if (bentuk === "pdf") {
        // PDF diunggah APA ADANYA: tanda tangan dan capnya harus sudah ada
        // di berkas itu. ALETA tidak menempel gambar ke PDF tanpa tahu letak
        // nama pejabatnya.
        pdfManual = isi;
      } else return { ok: false, langkah: "bentuk", alasan: "bentuk_tidak_dikenali" };
    }

    let siap;
    if (pdfManual) {
      siap = { ok: true, pdf: pdfManual, tandaTangan: null, tte: false, catatan: "pdf_apa_adanya_ttd_cap_dari_berkas" };
    } else {
      siap = await siapkanPdf({ jenis, rtf, penggunaId, cap, tte: tteElektronik ? { passphrase, nik } : null });
      if (!siap.ok) return siap;
    }

    if (kering) {
      return {
        ok: true,
        kering: true,
        ukuranPdf: siap.pdf.length,
        tandaTangan: siap.tandaTangan,
        cap: cap ? { id: cap.id || "", nama: cap.nama || "" } : null,
        tte: siap.tte,
        catatan: siap.catatan || "",
        jalurDirencanakan: d.dokumen.jalurDokumen(perkara.nomorPerkara, jenis),
      };
    }
    const simpan = await d.dokumen.simpanKeSipp({
      perkaraId: perkara.perkaraId,
      nomorPerkara: perkara.nomorPerkara,
      jenis,
      pdf: siap.pdf,
      olehUsername,
    });
    if (!simpan.ok) return { ...simpan, langkah: "simpan" };
    return {
      ok: true,
      jalur: simpan.jalur,
      ukuranPdf: siap.pdf.length,
      tandaTangan: siap.tandaTangan,
      cap: cap ? { id: cap.id || "", nama: cap.nama || "" } : null,
      tte: siap.tte,
      catatan: siap.catatan || "",
    };
  }

  return { peta, unggah, kenaliPerkara, siapkanPdf };
}

const bawaan = buatLayanan();

module.exports = {
  JENIS,
  PETA_PTSP,
  CIRI,
  sapuRtf,
  teksPolos,
  pisahBagian,
  ambilBagian,
  sisipkanCap,
  pilihTandaTangan,
  buatLayanan,
  peta: (...a) => bawaan.peta(...a),
  unggah: (...a) => bawaan.unggah(...a),
};
