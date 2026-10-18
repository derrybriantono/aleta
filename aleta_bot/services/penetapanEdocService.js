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
 * I9 17 Okt (paket ABT abt-penetap-phs-sita-derry): PPP dan PJS kini punya
 * berkas TUNGGAL sendiri - "@ 0a - PPP.rtf" dan "@ 0b - PJS.rtf" (satu bagian,
 * kotak "Ditandatangani secara elektronik oleh"); berkas gabungan "@ 0" tetap
 * ada dan menjadi CADANGAN bila berkas tunggal tidak ada di ABT satker. PHS
 * perkara bersita punya dua varian pilihan tangan: "@ 2a - PHS - Sita
 * Dikabulkan.rtf" dan "@ 2b - PHS - Sita Ditolak.rtf" (bawaan "@ 2" memuat
 * blok sita DITANGGUHKAN otomatis lewat #7061# bila petitum memohon sita).
 * Ciri PPP/PJS/PHS tetap cocok untuk semua berkas itu (diuji atas RTF paket).
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
 *
 * ============================================================================
 * PERBAIKAN 6 OKT 2026 (butir 17-20): TANDA TANGAN SESUAI NAMA, CAP DI ATASNYA
 * ============================================================================
 *
 * 1. RTF DARI EKSTENSI. Blangko ABT hanya dapat dicetak dengan sesi ABT
 *    petugas (abt/preview menuntut login), jadi ekstensi yang mencetaknya
 *    (latar.js "relaas-rtf", jalan yang sama dengan cetak relaas massal) lalu
 *    mengirim RTF-nya ke sini sebagai m.abt[]. Jalan lama (m.jenis[] +
 *    alamat blangkoPenetapan) tetap hidup.
 *
 * 2. GAMBAR BAWAAN BLANGKO DIGANTI. Blangko "@ 1 - PMH" Derry menanam gambar
 *    tanda tangan Ketua (selalu orang yang sama) dan cap sebagai bentuk
 *    mengambang di blok tanda tangan; "@ 2 - PHS" menanam tiga tanda tangan
 *    hakim. Dibiarkan, penetapan yang ditandatangani Wakil/Plh tetap memuat
 *    tanda tangan Ketua. Karena itu gambar di blok tanda tangan (sejak baris
 *    sebelum "Ditetapkan di") dibuang dulu - pengaturan gantiGambarBawaan.
 *
 * 3. NAMA PENANDA TANGAN DIBACA DARI BLOK TANDA TANGAN: baris sesudah label
 *    jabatannya ("Ketua," / "Wakil Ketua," / "Plh. Ketua," untuk PMH;
 *    "Ketua Majelis," / "Hakim," untuk PHS; "Panitera," untuk PPP/PJS) -
 *    BUKAN nama mana saja yang kebetulan muncul di dokumen (PMH memuat nama
 *    seluruh majelis). Tanda tangan sah yang namanya sama dibubuhkan; tidak
 *    ada = dokumen tetap disusun TANPA tanda tangan dan sebabnya dilaporkan
 *    (peringatan), tidak pernah diganti tanda tangan orang lain.
 *
 * 4. TANDA TANGAN DAN CAP sama-sama bentuk mengambang yang ditambatkan pada
 *    paragraf nama (tata letak tidak bergeser), cap DI ATAS tanda tangan
 *    (\shpz lebih tinggi dan ditulis sesudahnya), menumpang sisi kiri tanda
 *    tangan. Cap tanpa latar transparan (JPG/PNG tanpa alfa) ditaruh DI
 *    BELAKANG teks supaya tidak menutupi tanda tangan.
 */

const penjagaTandaSipp = require("./penjagaTandaSipp");
const tteBawaan = require("./tteProviderService");

const JENIS = ["pmh", "ppp", "pjs", "phs"];

/** 1 mm dalam twip (1440 twip = 25,4 mm). */
const TWIP_PER_MM = 1440 / 25.4;

/**
 * Siapa yang menandatangani, dikenali dari LABEL jabatannya di blok tanda
 * tangan. Label ABT Derry (variabel #7050# dan #4004#): "Ketua,", "Wakil
 * Ketua,", "Plh. Ketua,", "Ketua Majelis,", "Hakim,".
 */
const PENANDATANGAN = Object.freeze({
  ketua: {
    sebutan: "Ketua / Wakil Ketua / Plh. Ketua",
    label: /^(?:(?:plh|plt)\.?\s*)?(?:wakil\s+)?ketua(?:\s+pengadilan\s+agama[^,]*)?\s*,?$/i,
  },
  ketua_majelis: {
    sebutan: "Ketua Majelis / Hakim tunggal",
    label: /^(?:(?:hakim\s+)?ketua\s+majelis|hakim(?:\s+tunggal|\s+ketua(?:\s+majelis)?)?)\s*,?$/i,
  },
  panitera: {
    sebutan: "Panitera / Plh. Panitera",
    label: /^(?:(?:plh|plt)\.?\s*)?(?:wakil\s+)?panitera(?:\s+pengadilan\s+agama[^,]*)?\s*,?$/i,
  },
  otomatis: {
    sebutan: "Siapa pun yang tertulis di blok tanda tangan",
    label: /^[A-Za-z][^,]{1,60},$/,
  },
});

/**
 * Pengaturan bawaan per jenis (ditimpa pengaturan "Peta penetapan" di
 * Integrasi e-Court portal, yang dikirim portal per permintaan).
 * Ukuran dan geser dalam milimeter, relatif terhadap tanda tangan.
 */
const ATUR_BAWAAN = Object.freeze({
  pakaiTtd: true,
  pakaiCap: false,
  penandatangan: "otomatis",
  labelPenandatangan: "",
  gantiGambarBawaan: true,
  tahanBilaTanpaTtd: false,
  lebarTtdMm: 40,
  tinggiTtdMaksMm: 22,
  ttdGeserKananMm: 0,
  ttdTurunMm: 2,
  lebarCapMm: 30,
  capGeserKiriMm: 16,
  capGeserAtasMm: 6,
});

const ATUR_JENIS = Object.freeze({
  pmh: { pakaiCap: true, penandatangan: "ketua" },
  ppp: { pakaiCap: true, penandatangan: "panitera" },
  pjs: { pakaiCap: true, penandatangan: "panitera" },
  phs: { pakaiCap: false, penandatangan: "ketua_majelis" },
});

const BATAS_ANGKA = {
  lebarTtdMm: [10, 90],
  tinggiTtdMaksMm: [8, 60],
  ttdGeserKananMm: [-60, 60],
  ttdTurunMm: [-30, 30],
  lebarCapMm: [10, 60],
  capGeserKiriMm: [-60, 60],
  capGeserAtasMm: [-60, 60],
};

/** Pengaturan berlaku untuk satu jenis: bawaan <- bawaan jenis <- kiriman portal (disaring). */
function aturBerlaku(jenis, kiriman) {
  const hasil = { ...ATUR_BAWAAN, ...(ATUR_JENIS[jenis] || {}) };
  const k = kiriman && typeof kiriman === "object" ? kiriman : {};
  for (const kunci of ["pakaiTtd", "pakaiCap", "tahanBilaTanpaTtd"]) {
    if (typeof k[kunci] === "boolean") hasil[kunci] = k[kunci];
  }
  // MODE TANDA TANGAN ELEKTRONIK (keputusan pengguna 17 Okt 2026 butir 5):
  // blangko PTSP tetap memuat gambar cap/TTD statis (untuk cetak ABT biasa),
  // tetapi yang dicetak/diunggah LEWAT ALETA tidak pernah membawanya - yang
  // dipakai tanda tangan sah ALETA atau kotak "Ditandatangani secara
  // elektronik". Kiriman gantiGambarBawaan:false (pengaturan lama) diabaikan.
  hasil.gantiGambarBawaan = true;
  if (typeof k.penandatangan === "string" && PENANDATANGAN[k.penandatangan]) hasil.penandatangan = k.penandatangan;
  if (typeof k.labelPenandatangan === "string") hasil.labelPenandatangan = k.labelPenandatangan.trim().slice(0, 80);
  for (const [kunci, [bawah, atas]] of Object.entries(BATAS_ANGKA)) {
    const n = Number(k[kunci]);
    if (k[kunci] !== undefined && k[kunci] !== null && k[kunci] !== "" && Number.isFinite(n)) {
      hasil[kunci] = Math.min(atas, Math.max(bawah, n));
    }
  }
  return hasil;
}

/** Peta blangko PTSP Derry - lihat catatan kepala berkas. */
const PETA_PTSP = Object.freeze({
  sumber: "ABT",
  // direktori "99 PTSP" sejak paket ABT abt-ganti-nama-relaas-ptsp (16 Okt 2026; dulu "PTSP") - label saja, berkas dibaca lewat token ABT.
  menu: { id: 991, nama: "Form Bantu PTSP", alias: "Form PTSP", kelompok: "derry_briantono", direktori: "99 PTSP" },
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
      // I9 17 Okt: berkas tunggal; gabungan "@ 0" (bagian 2) = cadangan bila berkas tunggal tidak ada.
      berkasTunggal: "@ 0a - PPP.rtf",
      cadangan: "@ 0 - PMH - PHS.rtf",
      penandatangan: "panitera",
    },
    pjs: {
      judul: "Penunjukan Jurusita (PJS)",
      kepala: "PENUNJUKAN",
      bagianGabungan: 3,
      berkasTunggal: "@ 0b - PJS.rtf",
      cadangan: "@ 0 - PMH - PHS.rtf",
      penandatangan: "panitera",
    },
    phs: {
      judul: "Penetapan Hari Sidang (PHS)",
      kepala: "PENETAPAN",
      bagianGabungan: 4,
      berkasTunggal: "@ 2 - PHS.rtf",
      // I9 17 Okt: perkara bersita - penetapan sita langsung dikabulkan/ditolak (jalur tanpa putusan sela); pilihan tangan di panel.
      varian: {
        "sita-dikabulkan": "@ 2a - PHS - Sita Dikabulkan.rtf",
        "sita-ditolak": "@ 2b - PHS - Sita Ditolak.rtf",
      },
      // Q3 16 Okt: sama dengan ATUR_JENIS.phs dan peta penetapan portal (dulu "hakim" - bukan kunci PENANDATANGAN yang dikenal).
      penandatangan: "ketua_majelis",
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
 * Ukuran piksel gambar dari kepalanya (PNG IHDR, JPEG SOFn). null bila tidak
 * terbaca - pemanggil memakai perbandingan cadangan.
 */
function ukuranGambar(isi) {
  const b = Buffer.from(isi || []);
  if (jenisGambar(b) === "png" && b.length >= 24 && b.toString("latin1", 12, 16) === "IHDR") {
    const lebar = b.readUInt32BE(16);
    const tinggi = b.readUInt32BE(20);
    return lebar > 0 && tinggi > 0 ? { lebar, tinggi } : null;
  }
  if (jenisGambar(b) === "jpg") {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const penanda = b[i + 1];
      const panjang = b.readUInt16BE(i + 2);
      const sof = penanda >= 0xc0 && penanda <= 0xcf && penanda !== 0xc4 && penanda !== 0xc8 && penanda !== 0xcc;
      if (sof) {
        const tinggi = b.readUInt16BE(i + 5);
        const lebar = b.readUInt16BE(i + 7);
        return lebar > 0 && tinggi > 0 ? { lebar, tinggi } : null;
      }
      i += 2 + panjang;
    }
  }
  return null;
}

/** PNG dengan saluran alfa (jenis warna 4/6) atau potongan tRNS. JPG tidak pernah. */
function adaTransparansi(isi) {
  const b = Buffer.from(isi || []);
  if (jenisGambar(b) !== "png" || b.length < 26) return false;
  if (b[25] === 4 || b[25] === 6) return true;
  return b.indexOf(Buffer.from("tRNS", "latin1")) > 0;
}

/** Akhir kelompok RTF yang dibuka di `awal` (indeks "{"), -1 bila tidak seimbang. */
function akhirKelompok(rtf, awal) {
  let d = 0;
  for (let i = awal; i < rtf.length; i++) {
    const c = rtf[i];
    if (c === "\\") {
      // \bin N: N bita mentah dilompati; selebihnya kendali/simbol dua huruf.
      const m = /^\\bin(\d+) ?/.exec(rtf.slice(i, i + 16));
      if (m) {
        i += m[0].length - 1 + Number(m[1]);
        continue;
      }
      i += 1;
      continue;
    }
    if (c === "{") d += 1;
    else if (c === "}") {
      d -= 1;
      if (d === 0) return i;
    }
  }
  return -1;
}

/**
 * Awal blok tanda tangan: baris SEBELUM "Ditetapkan di" (gambar bawaan PHS
 * Derry tertambat di paragraf "- #7045#" tepat di atasnya), dimundurkan ke
 * akhir paragraf sebelumnya supaya bentuk yang ditulis di awal paragraf ikut.
 * Tanpa "Ditetapkan di": baris sebelum label penanda tangan.
 */
function awalBlokTtd(rtf, indeksLabel) {
  const baris = sapuRtf(rtf).baris;
  let i = -1;
  for (let k = baris.length - 1; k >= 0; k--) {
    if (/^ditetapkan\s+di\b/i.test(baris[k].teks)) {
      i = k;
      break;
    }
  }
  if (i < 0 && Number.isInteger(indeksLabel)) i = indeksLabel;
  if (i < 0) return -1;
  const acuan = baris[Math.max(0, i - 1)].mulai;
  const par = rtf.lastIndexOf("\\par", acuan);
  return par >= 0 ? par : acuan;
}

/** Teks kasar potongan RTF (kendali & kurung dibuang). */
function teksKasarRtf(s) {
  return String(s || "")
    .replace(/[0-9a-fA-F]{64,}/g, " ")
    .replace(/\\'[0-9a-fA-F]{2}/g, "")
    .replace(/\\[a-zA-Z]+-?\d* ?/g, " ")
    .replace(/[{}\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Bentuk kotak teks "Ditandatangani secara elektronik ..." (blangko PTSP @ 0, bagian PPP/PJS). */
function bentukKotakElektronik(isiBentuk) {
  return /\\shptxt/.test(isiBentuk) && /ditandatangani\s+secara\s+elektronik/i.test(teksKasarRtf(isiBentuk));
}

/** RTF memuat kotak tanda tangan elektronik? */
function adaKotakTtdElektronik(rtf) {
  const s = String(rtf || "");
  const re = /\{\\shp(?![a-z])/g;
  let m;
  while ((m = re.exec(s))) {
    const akhir = akhirKelompok(s, m.index);
    if (akhir < 0) break;
    if (bentukKotakElektronik(s.slice(m.index, akhir + 1))) return true;
    re.lastIndex = akhir + 1;
  }
  return false;
}

/**
 * Gambar bentuk yang berakhir di `akhir` langsung diikuti kotak elektronik:
 * logo satker di kotak TTD elektronik - bagian dari tanda tangan elektronik,
 * bukan gambar cap/TTD statis.
 */
function gambarKotakElektronik(rtf, akhir) {
  const potong = String(rtf || "").slice(akhir + 1, akhir + 9000);
  const i = potong.search(/\{\\shp(?![a-z])/);
  if (i < 0 || teksKasarRtf(potong.slice(0, i)).length > 200) return false;
  const k = akhirKelompok(potong, i);
  return bentukKotakElektronik(potong.slice(i, k < 0 ? potong.length : k + 1));
}

/**
 * Membuang gambar (bentuk bergambar, \shppict/\nonshppict, \pict lepas) di
 * blok tanda tangan. Bentuk TEKS (kotak "Ditandatangani secara elektronik"
 * pada blangko gabungan) tidak disentuh.
 */
function buangGambarBlokTtd(rtf, { dari } = {}) {
  let s = String(rtf || "");
  const mulai = Number.isInteger(dari) ? dari : awalBlokTtd(s);
  if (mulai < 0) return { rtf: s, dibuang: 0, uraian: [] };
  const uraian = [];
  let dibuang = 0;
  let i = mulai;
  while (i < s.length) {
    const j = s.indexOf("{", i);
    if (j < 0) break;
    const kepala = s.slice(j, j + 24);
    const bergambar = /^\{\\(?:shp\b|shp\s|\*\\shppict|nonshppict|pict\b)/.test(kepala) || /^\{\\shp[\\{ ]/.test(kepala);
    if (!bergambar) {
      i = j + 1;
      continue;
    }
    const akhir = akhirKelompok(s, j);
    if (akhir < 0) break;
    const isi = s.slice(j, akhir + 1);
    const bentuk = /^\{\\shp/.test(kepala);
    if (bentuk && !/\{\\sn\s*pib\}/.test(isi)) {
      // Bentuk tanpa gambar (kotak teks, garis) dibiarkan.
      i = akhir + 1;
      continue;
    }
    if (bentuk && gambarKotakElektronik(s, akhir)) {
      // Logo satker di kotak "Ditandatangani secara elektronik" dibiarkan (17 Okt 2026).
      i = akhir + 1;
      continue;
    }
    const nama = /\{\\sn\s*wzDescription\}\{\\sv\s*([^}]*)\}/.exec(isi) || /\{\\sn\s*wzName\}\{\\sv\s*([^}]*)\}/.exec(isi);
    if (nama && nama[1].trim()) uraian.push(nama[1].trim().slice(0, 60));
    s = s.slice(0, j) + s.slice(akhir + 1);
    dibuang += 1;
    i = j;
  }
  return { rtf: s, dibuang, uraian };
}

/**
 * Nama penanda tangan: baris sesudah LABEL jabatannya, di blok tanda tangan
 * (sesudah "Ditetapkan di" bila ada). Label yang dipakai: label tegas dari
 * pengaturan (labelPenandatangan) atau pola penandatangan. Yang terakhir
 * cocok menang - blok tanda tangan ada di ujung dokumen.
 *
 * @returns {{ok:true, label, nama, mulaiNama, indeksLabel} | {ok:false, alasan, labelTerbaca?}}
 */
function cariPenandaTangan(rtf, { penandatangan = "otomatis", labelPenandatangan = "" } = {}) {
  const baris = sapuRtf(rtf).baris;
  let awal = 0;
  for (let k = baris.length - 1; k >= 0; k--) {
    if (/^ditetapkan\s+di\b/i.test(baris[k].teks)) {
      awal = k;
      break;
    }
  }
  const tegas = String(labelPenandatangan || "").trim();
  const baku = (t) => String(t || "").toLowerCase().replace(/\s+/g, " ").replace(/[\s,]+$/, "").trim();
  const pola = (PENANDATANGAN[penandatangan] || PENANDATANGAN.otomatis).label;
  const cocok = (t) => (tegas ? baku(t) === baku(tegas) : pola.test(String(t).trim()));
  const labelTerbaca = [];
  let iLabel = -1;
  for (let k = baris.length - 1; k >= awal; k--) {
    const t = baris[k].teks;
    if (/,\s*$/.test(t) && t.length <= 70) labelTerbaca.unshift(t);
    if (iLabel < 0 && cocok(t) && k + 1 < baris.length) iLabel = k;
  }
  if (iLabel < 0) return { ok: false, alasan: "label_penanda_tangan_tidak_ditemukan", labelTerbaca: labelTerbaca.slice(-4) };
  const nama = baris[iLabel + 1];
  const teks = String(nama.teks || "").trim();
  // Variabel ABT yang tidak terisi (#0012#), kalimat galat ABT ("... MOHON
  // HUBUNGI ADMIN"), atau baris tanpa huruf bukan nama orang.
  if (!/[A-Za-z]{2}/.test(teks) || /#\d{4}#/.test(teks) || /hubungi\s+admin|perbaiki|belum\s+diinput/i.test(teks) || teks.length > 120) {
    return { ok: false, alasan: "nama_penanda_tangan_tidak_terbaca", label: baris[iLabel].teks, nama: teks.slice(0, 120) };
  }
  return { ok: true, label: baris[iLabel].teks, nama: teks, mulaiNama: nama.mulai, indeksLabel: iLabel };
}

/** Nama tanpa gelar di belakang koma dan tanpa gelar depan - untuk cocok kedua. */
function intiNama(nama, bakuNama) {
  const depan = String(nama || "").split(",")[0];
  const tanpaGelar = depan.replace(/^\s*(?:(?:prof|dr|drs|dra|ir|h|hj|kh|kgs|tgk)\.?\s+)+/i, "");
  return bakuNama(tanpaGelar);
}

/**
 * Tanda tangan SAH untuk satu nama. Cocok penuh (huruf-angka sama) dulu;
 * kalau tidak ada, cocok nama inti (tanpa gelar) asal tidak ada dua ORANG
 * berbeda yang cocok. Dua baris sah untuk orang yang sama: yang terbaru
 * disahkan. Tidak ada = null, dan pemanggil TIDAK mencari pengganti.
 */
function cocokkanTandaTangan(nama, daftar, bakuNama) {
  const semua = (Array.isArray(daftar) ? daftar : []).filter((b) => b && b.namaPejabat);
  const terbaru = (xs) =>
    xs.slice().sort((a, b) => String(b.disahkanPada || "").localeCompare(String(a.disahkanPada || "")) || Number(b.id) - Number(a.id))[0];
  const penuh = semua.filter((b) => bakuNama(b.namaPejabat) && bakuNama(b.namaPejabat) === bakuNama(nama));
  if (penuh.length) return { baris: terbaru(penuh), cara: "nama_lengkap" };
  const inti = intiNama(nama, bakuNama);
  if (inti.length < 5) return { baris: null, alasan: "nama_terlalu_pendek" };
  const sebagian = semua.filter((b) => intiNama(b.namaPejabat, bakuNama) === inti);
  if (!sebagian.length) return { baris: null, alasan: "tanda_tangan_tidak_ada_untuk_nama" };
  const orang = new Set(sebagian.map((b) => bakuNama(b.namaPejabat)));
  if (orang.size > 1) return { baris: null, alasan: "tanda_tangan_ganda_untuk_nama" };
  return { baris: terbaru(sebagian), cara: "nama_tanpa_gelar" };
}

/** Tata paragraf yang berlaku di `posisi`: rata, inden, dan lebar bidang tulis. */
function tataParagraf(rtf, posisi) {
  const s = String(rtf || "");
  const terakhir = (re, sampai, bawaan) => {
    const g = new RegExp(re.source, "g");
    let m;
    let nilai = bawaan;
    const potongan = s.slice(0, sampai);
    while ((m = g.exec(potongan))) nilai = m;
    return nilai;
  };
  const angka = (m, bawaan) => (m && m !== bawaan ? Number(m[1]) : bawaan);
  const pard = s.lastIndexOf("\\pard", posisi);
  const potong = pard >= 0 ? s.slice(pard, posisi) : s.slice(0, posisi);
  const ambil = (re) => {
    const g = new RegExp(re.source, "g");
    let m;
    let hasil = null;
    while ((m = g.exec(potong))) hasil = m;
    return hasil;
  };
  const rata = ambil(/\\q([lrcj])(?![a-z])/);
  const li = ambil(/\\li(-?\d+)(?![a-z\d])/);
  const fi = ambil(/\\fi(-?\d+)(?![a-z\d])/);
  const ri = ambil(/\\ri(-?\d+)(?![a-z\d])/);
  const kertas = angka(terakhir(/\\(?:paperw|pgwsxn)(\d+)/, posisi, null), 12240);
  const kiri = angka(terakhir(/\\(?:margl|marglsxn)(\d+)/, posisi, null), 1800);
  const kanan = angka(terakhir(/\\(?:margr|margrsxn)(\d+)/, posisi, null), 1800);
  // Baris pertama paragraf? (tanpa \line di antara awal paragraf dan nama)
  const awalPar = Math.max(s.lastIndexOf("\\par", posisi), pard);
  const antara = awalPar >= 0 ? s.slice(awalPar, posisi) : "";
  const barisPertama = !/\\line(?![a-z])/.test(antara.replace(/^\\pard?/, ""));
  return {
    rata: rata ? rata[1] : "l",
    li: li ? Number(li[1]) : 0,
    fi: fi ? Number(fi[1]) : 0,
    ri: ri ? Number(ri[1]) : 0,
    lebarBidang: Math.max(2000, kertas - kiri - kanan),
    barisPertama,
  };
}

/** Satu bentuk gambar mengambang, tertambat pada paragraf, relatif kolom. */
function bentukGambar({ isi, jenis, kiri, atas, lebar, tinggi, z, lid, depan, nama }) {
  const blip = jenis === "jpg" ? "jpegblip" : "pngblip";
  const u = ukuranGambar(isi) || { lebar: Math.round(lebar / 15), tinggi: Math.round(tinggi / 15) };
  const k = Math.round(kiri);
  const a = Math.round(atas);
  const l = Math.round(lebar);
  const t = Math.round(tinggi);
  return (
    `{\\shp{\\*\\shpinst\\shpleft${k}\\shptop${a}\\shpright${k + l}\\shpbottom${a + t}` +
    `\\shpfhdr0\\shpbxcolumn\\shpbxignore\\shpbypara\\shpbyignore\\shpwr3\\shpwrk0\\shpfblwtxt${depan ? 0 : 1}\\shpz${z}\\shplid${lid}` +
    `{\\sp{\\sn shapeType}{\\sv 75}}{\\sp{\\sn fFlipH}{\\sv 0}}{\\sp{\\sn fFlipV}{\\sv 0}}{\\sp{\\sn fLockAspectRatio}{\\sv 1}}` +
    `{\\sp{\\sn fAllowOverlap}{\\sv 1}}{\\sp{\\sn fBehindDocument}{\\sv ${depan ? 0 : 1}}}{\\sp{\\sn fLayoutInCell}{\\sv 1}}` +
    `{\\sp{\\sn fLine}{\\sv 0}}{\\sp{\\sn fFilled}{\\sv 0}}{\\sp{\\sn wzName}{\\sv ${nama}}}` +
    `{\\sp{\\sn pib}{\\sv {\\pict\\${blip}\\picw${u.lebar}\\pich${u.tinggi}\\picwgoal${l}\\pichgoal${t} ${heksGambar(isi)}}}}}}`
  );
}

/**
 * Membubuhkan tanda tangan dan/atau cap pada paragraf nama penanda tangan.
 *
 * Keduanya bentuk mengambang yang ditambatkan pada paragraf NAMA (sisipan di
 * depan huruf pertama nama): tanda tangan tepat di atas nama, cap menumpang
 * sisi kiri tanda tangan. Urutan tulis ttd lalu cap, \shpz cap lebih tinggi:
 * cap DI ATAS tanda tangan. Cap tanpa transparansi ditaruh di belakang teks.
 *
 * @returns {{ok, rtf, geometri, capDiBelakang}}
 */
function bubuhkanTtdCap(rtf, { mulaiNama, ttd, cap, atur }) {
  const s = String(rtf || "");
  if (!Number.isInteger(mulaiNama) || mulaiNama <= 0 || mulaiNama >= s.length) return { ok: false, alasan: "letak_nama_tidak_sah" };
  const a = { ...ATUR_BAWAAN, ...(atur || {}) };
  const mm = (n) => Number(n) * TWIP_PER_MM;
  const tata = tataParagraf(s, mulaiNama);

  // Ukuran tanda tangan: lebar dari pengaturan, tinggi menurut perbandingan
  // gambarnya, dibatasi tinggi maksimum (lebarnya ikut menyusut).
  let ttdL = mm(a.lebarTtdMm);
  let ttdT = ttdL / 2;
  if (ttd && ttd.isi) {
    const u = ukuranGambar(ttd.isi);
    if (u) ttdT = (ttdL * u.tinggi) / u.lebar;
    if (ttdT > mm(a.tinggiTtdMaksMm)) {
      ttdL = (ttdL * mm(a.tinggiTtdMaksMm)) / ttdT;
      ttdT = mm(a.tinggiTtdMaksMm);
    }
  }
  const x0 = tata.li + (tata.barisPertama ? tata.fi : 0);
  let ttdKiri;
  if (tata.rata === "c") ttdKiri = tata.li + (tata.lebarBidang - tata.li - tata.ri - ttdL) / 2;
  else if (tata.rata === "r") ttdKiri = tata.lebarBidang - tata.ri - ttdL;
  else ttdKiri = x0;
  ttdKiri += mm(a.ttdGeserKananMm);
  const ttdAtas = -ttdT + mm(a.ttdTurunMm);

  let sisipan = "";
  const geometri = { ttd: null, cap: null, tata };
  if (ttd && ttd.isi) {
    const jenisTtd = jenisGambar(ttd.isi, ttd.jenis);
    if (!jenisTtd) return { ok: false, alasan: "tanda_tangan_bukan_png_jpg" };
    sisipan += bentukGambar({ isi: ttd.isi, jenis: jenisTtd, kiri: ttdKiri, atas: ttdAtas, lebar: ttdL, tinggi: ttdT, z: 2001, lid: 2001, depan: true, nama: "Tanda tangan" });
    geometri.ttd = { kiri: Math.round(ttdKiri), atas: Math.round(ttdAtas), lebar: Math.round(ttdL), tinggi: Math.round(ttdT) };
  }
  let capDiBelakang = false;
  if (cap && cap.isi) {
    const jenisCap = jenisGambar(cap.isi, cap.jenis);
    if (!jenisCap) return { ok: false, alasan: "cap_bukan_png_jpg" };
    const capL = mm(a.lebarCapMm);
    const u = ukuranGambar(cap.isi);
    const capT = u ? (capL * u.tinggi) / u.lebar : capL;
    const pusatX = ttdKiri + ttdL / 2 - mm(a.capGeserKiriMm);
    const pusatY = ttdAtas + ttdT / 2 - mm(a.capGeserAtasMm);
    capDiBelakang = !adaTransparansi(cap.isi);
    sisipan += bentukGambar({
      isi: cap.isi,
      jenis: jenisCap,
      kiri: pusatX - capL / 2,
      atas: pusatY - capT / 2,
      lebar: capL,
      tinggi: capT,
      z: capDiBelakang ? 1999 : 2002,
      lid: 2002,
      depan: !capDiBelakang,
      nama: "Cap",
    });
    geometri.cap = { kiri: Math.round(pusatX - capL / 2), atas: Math.round(pusatY - capT / 2), lebar: Math.round(capL), tinggi: Math.round(capT) };
  }
  if (!sisipan) return { ok: true, rtf: s, geometri, capDiBelakang };
  return { ok: true, rtf: `${s.slice(0, mulaiNama)}${sisipan}${s.slice(mulaiNama)}`, geometri, capDiBelakang };
}

/**
 * Seluruh pembubuhan untuk satu RTF bagian: buang gambar bawaan blok tanda
 * tangan (bila diatur), baca nama penanda tangan, cocokkan tanda tangan sah,
 * bubuhkan ttd + cap. Tidak pernah gagal karena ttd/cap tidak ada - yang
 * tidak dapat dibubuhkan menjadi PERINGATAN.
 *
 * @param {object} p  { rtf, jenis, atur, cap:{isi,jenis,id,nama}|null, daftarTtd, ambilGambar(id), bakuNama }
 */
async function bubuhkanPenetapan({ rtf, jenis, atur, cap, daftarTtd, ambilGambar, bakuNama }) {
  const a = aturBerlaku(jenis, atur);
  const peringatan = [];
  let s = String(rtf || "");

  // Penanda tangan dibaca dulu (indeks label dipakai menentukan awal blok).
  let siapa = cariPenandaTangan(s, a);
  let gambarBawaan = { dibuang: 0, uraian: [] };
  if (a.gantiGambarBawaan) {
    const buang = buangGambarBlokTtd(s, { dari: awalBlokTtd(s, siapa.ok ? siapa.indeksLabel : undefined) });
    s = buang.rtf;
    gambarBawaan = { dibuang: buang.dibuang, uraian: buang.uraian };
    if (buang.dibuang) siapa = cariPenandaTangan(s, a);
  }
  const kotakElektronik = adaKotakTtdElektronik(s);
  if (!siapa.ok) {
    if (kotakElektronik && siapa.alasan === "label_penanda_tangan_tidak_ditemukan") {
      // Blok tanda tangan bagian ini ADALAH kotak "Ditandatangani secara
      // elektronik oleh: ..." (PPP/PJS di @ 0): tidak ada label untuk
      // ditempeli gambar tanda tangan, dan memang tidak perlu.
      peringatan.push({ kode: "kotak_ttd_elektronik" });
      return { ok: true, rtf: s, tandaTangan: null, penandaTangan: null, cap: null, peringatan, gambarBawaan, atur: a, modeTtd: "kotak_elektronik" };
    }
    peringatan.push({ kode: siapa.alasan, label: siapa.label || "", nama: siapa.nama || "", labelTerbaca: siapa.labelTerbaca || [] });
    return { ok: true, rtf: s, tandaTangan: null, penandaTangan: null, cap: null, peringatan, gambarBawaan, atur: a, modeTtd: kotakElektronik ? "kotak_elektronik" : "tanpa" };
  }

  let ttd = null;
  if (a.pakaiTtd) {
    const pilih = cocokkanTandaTangan(siapa.nama, daftarTtd, bakuNama);
    if (pilih.baris) {
      const g = await Promise.resolve(ambilGambar(pilih.baris.id)).catch(() => null);
      if (g && g.isi && g.isi.length) {
        ttd = { id: pilih.baris.id, namaPejabat: pilih.baris.namaPejabat, isi: g.isi, jenis: g.jenis, cara: pilih.cara };
      } else peringatan.push({ kode: "gambar_tanda_tangan_tidak_terbaca", nama: siapa.nama });
    } else {
      peringatan.push({ kode: pilih.alasan, nama: siapa.nama });
    }
  }

  let capDipakai = null;
  if (a.pakaiCap) {
    if (!cap || !cap.isi || !cap.isi.length) peringatan.push({ kode: "cap_belum_ada" });
    else if (a.pakaiTtd && !ttd) peringatan.push({ kode: "cap_dilewati_tanpa_tanda_tangan" });
    else capDipakai = cap;
  }

  const hasil = bubuhkanTtdCap(s, { mulaiNama: siapa.mulaiNama, ttd, cap: capDipakai, atur: a });
  if (!hasil.ok) return { ok: false, alasan: hasil.alasan, peringatan, gambarBawaan };
  if (hasil.capDiBelakang) peringatan.push({ kode: "cap_tanpa_latar_transparan_di_belakang" });
  return {
    ok: true,
    rtf: hasil.rtf,
    penandaTangan: { label: siapa.label, nama: siapa.nama },
    tandaTangan: ttd ? { id: ttd.id, namaPejabat: ttd.namaPejabat, sumber: ttd.cara } : null,
    cap: capDipakai ? { id: capDipakai.id || "", nama: capDipakai.nama || "", diBelakang: hasil.capDiBelakang } : null,
    geometri: hasil.geometri,
    peringatan,
    gambarBawaan,
    atur: a,
    modeTtd: ttd ? "tanda_tangan_aleta" : kotakElektronik ? "kotak_elektronik" : "tanpa",
  };
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
    // I9 17 Okt: sita perkara (petitum + SIPP) - hanya untuk menandai perkara bersita di peta().
    sita: (ids) => require("./sitaEksekusiPerkaraService").sitaEksekusiBanyakPerkara(ids),
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
          // I9 17 Okt: berkas cadangan (PPP/PJS: gabungan "@ 0") dan varian pilihan tangan (PHS sita).
          ...(p.cadangan ? { cadangan: p.cadangan } : {}),
          ...(p.varian ? { varian: p.varian } : {}),
        },
        penandatangan: p.penandatangan,
      });
    }
    // I9 17 Okt: perkara bersita (petitum memohon sita, pola sitaEksekusiPerkaraService) -> panel menawarkan pilihan PHS ditangguhkan/dikabulkan/ditolak.
    // null = tidak terbaca (tidak ditebak).
    let bersita = null;
    if (typeof d.sita === "function") {
      try {
        const hasilSita = await d.sita([perkara.perkaraId]);
        bersita = Boolean(hasilSita && hasilSita.sita && hasilSita.sita[String(perkara.perkaraId)]);
      } catch {
        bersita = null;
      }
    }
    return { ok: true, perkara: { ...perkara, bersita }, jenis, petaBlangko: PETA_PTSP, tteElektronik: Boolean(d.tte && d.tte.tersedia && d.tte.tersedia()) };
  }

  /**
   * Menyiapkan PDF satu jenis: RTF (dari ABT atau unggahan manual) -> bagian
   * yang cocok -> bubuhan (gambar bawaan diganti, tanda tangan sesuai nama,
   * cap di atasnya - lihat bubuhkanPenetapan) -> PDF -> (TTE bila diminta).
   *
   * Tanda tangan/cap yang tidak dapat dibubuhkan TIDAK menggagalkan - menjadi
   * peringatan. Kecuali tahanBilaTanpaTtd menyala: dokumen tanpa tanda tangan
   * ditahan (tidak dibuat PDF, tidak diunggah).
   */
  async function siapkanPdf({ jenis, rtf, penggunaId, cap, tte, atur }) {
    const d = deps();
    void penggunaId;
    const bagian = ambilBagian(rtf, jenis);
    if (!bagian.ok) return { ...bagian, langkah: "bagian" };

    const a = aturBerlaku(jenis, atur);
    const daftar = a.pakaiTtd ? await d.ttd.daftar({ hanyaSah: true }).catch(() => ({ baris: [] })) : { baris: [] };
    const bubuh = await bubuhkanPenetapan({
      rtf: bagian.rtf,
      jenis,
      atur: a,
      cap,
      daftarTtd: (daftar && daftar.baris) || [],
      ambilGambar: (id) => d.ttd.gambar(id),
      bakuNama: (n) => d.ttd.bakuNama(n),
    });
    if (!bubuh.ok) return { ok: false, langkah: "tanda_tangan", alasan: bubuh.alasan, peringatan: bubuh.peringatan || [] };
    if (a.pakaiTtd && !bubuh.tandaTangan && a.tahanBilaTanpaTtd) {
      return {
        ok: false,
        langkah: "tanda_tangan",
        alasan: "ditahan_tanpa_tanda_tangan",
        penandaTangan: bubuh.penandaTangan,
        peringatan: bubuh.peringatan,
        gambarBawaan: bubuh.gambarBawaan,
      };
    }

    const pdf = await d.cetak.rtfKePdf(Buffer.from(bubuh.rtf, "latin1"));
    if (!pdf.ok) return { ok: false, langkah: "pdf", alasan: pdf.alasan || "pdf_gagal", peringatan: bubuh.peringatan };

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
      rtf: bubuh.rtf,
      penandaTangan: bubuh.penandaTangan,
      tandaTangan: bubuh.tandaTangan,
      cap: bubuh.cap,
      peringatan: bubuh.peringatan,
      gambarBawaan: bubuh.gambarBawaan,
      tte: ber_tte,
      jumlahBagian: bagian.jumlahBagian,
    };
  }

  /**
   * Mengunggah edoc penetapan - abt[] (RTF ABT dari ekstensi), jenis[]
   * (diambil bot dari alamat blangkoPenetapan, jalan lama) dan/atau manual[].
   *
   * @param {object} m
   *   perkaraId|nomorPerkara, abt: [{jenis, isi(Buffer RTF), berkas}],
   *   jenis: string[], manual: [{jenis, isi(Buffer)}],
   *   cap: { [jenis]: {isi: Buffer, jenis, id, nama} },
   *   atur: { [jenis]: pengaturan peta penetapan (lihat ATUR_BAWAAN) },
   *   penggunaId, operator, olehUsername (akun SIPP petugas yang login), ip,
   *   passphrase (opsional, TIDAK disimpan), nik, otomatis, kering (bawaan true).
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
    const abtEkstensi = (Array.isArray(m.abt) ? m.abt : [])
      .map((x) => ({ jenis: String((x && x.jenis) || "").toLowerCase(), isi: x && x.isi, berkas: String((x && x.berkas) || "").slice(0, 160) }))
      .filter((x) => JENIS.includes(x.jenis) && Buffer.isBuffer(x.isi) && x.isi.length > 0);
    const manual = (Array.isArray(m.manual) ? m.manual : [])
      .map((x) => ({ jenis: String((x && x.jenis) || "").toLowerCase(), isi: x && x.isi }))
      .filter((x) => JENIS.includes(x.jenis) && Buffer.isBuffer(x.isi) && x.isi.length > 0);
    if (!dariAbt.length && !manual.length && !abtEkstensi.length) return { ok: false, alasan: "tidak_ada_jenis_dipilih" };

    const hasil = [];
    const kerjakan = [
      ...abtEkstensi.map((x) => ({ jenis: x.jenis, sumber: "abt", isi: x.isi, berkas: x.berkas })),
      ...dariAbt.filter((j) => !abtEkstensi.some((x) => x.jenis === j)).map((j) => ({ jenis: j, sumber: "abt" })),
      ...manual.map((x) => ({ jenis: x.jenis, sumber: "manual", isi: x.isi })),
    ];
    for (let i = 0; i < kerjakan.length; i++) {
      const k = kerjakan[i];
      const atur = aturBerlaku(k.jenis, m.atur && m.atur[k.jenis]);
      const cap = atur.pakaiCap ? (m.cap && m.cap[k.jenis]) || null : null;
      let satu;
      try {
        satu = await kerjakanSatu({ ...k, perkara, cap, atur, olehUsername, penggunaId: m.penggunaId, passphrase, nik: m.nik, kering, tteElektronik });
      } catch (galat) {
        satu = { ok: false, alasan: `galat: ${sapu(galat && galat.message).slice(0, 160)}` };
      }
      satu.alasan = sapu(satu.alasan);
      hasil.push({ jenis: k.jenis, sumber: k.sumber, ...(k.berkas ? { berkas: k.berkas } : {}), ...satu });

      const peringatan = (satu.peringatan || []).map((p) => p.kode).join(",");
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
                    `sumber ${k.sumber}${k.berkas ? ` (${k.berkas})` : ""}${m.otomatis ? " otomatis" : ""}; ` +
                    `ttd ${(satu.tandaTangan && satu.tandaTangan.namaPejabat) || "-"}; ` +
                    `cap ${(satu.cap && (satu.cap.nama || satu.cap.id)) || "-"}; tte ${satu.tte ? "ya" : "tidak"}` +
                    `${peringatan ? `; peringatan ${peringatan}` : ""}`,
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
        const { pdf, rtf, ...sisa } = x;
        void pdf;
        void rtf;
        return sisa;
      }),
    };
  }

  async function kerjakanSatu({ jenis, sumber, isi, perkara, cap, atur, olehUsername, penggunaId, passphrase, nik, kering, tteElektronik }) {
    const d = deps();
    let rtf = "";
    let pdfManual = null;
    if (sumber === "abt" && !isi) {
      const b = await d.dokumen.ambilBlangko(jenis, perkara.nomorPerkara);
      if (!b.ok) return { ok: false, langkah: "blangko", alasan: b.alasan };
      rtf = b.rtf;
    } else if (sumber === "abt") {
      // RTF ABT yang dicetak ekstensi dengan sesi ABT petugas: harus RTF.
      if (d.cetak.kenaliDokumen(isi) !== "rtf") return { ok: false, langkah: "blangko", alasan: "jawaban_abt_bukan_rtf" };
      rtf = isi.toString("latin1");
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

    // 17 Okt 2026 (penjaga batas): ISI naskah penetapan diperiksa sebelum dibuat PDF
    // dan sebelum dikirim ke SIPP; tidak diubah diam-diam - ditahan bila memuat kata
    // ALETA di luar nama pihak dari SIPP. (PDF unggahan manual diperiksa di simpanKeSipp.)
    if (rtf) {
      // 18 Okt 2026 (butir 18): grup tersembunyi penanda asal dibuang sebelum diperiksa dan dibuat PDF.
      rtf = penjagaTandaSipp.buangGrupTersembunyiRtf(rtf);
      const dariSipp = await penjagaTandaSipp.dataSippMemuatAleta(perkara.perkaraId, d.kueriSipp);
      const periksa = penjagaTandaSipp.periksaIsiBerkas(Buffer.from(rtf, "latin1"), { nama: `Penetapan ${String(jenis).toUpperCase()}`, dariSipp });
      if (!periksa.ok) return { ok: false, langkah: "isi", alasan: periksa.alasan, pesan: periksa.pesan };
    }

    let siap;
    if (pdfManual) {
      siap = { ok: true, pdf: pdfManual, tandaTangan: null, cap: null, peringatan: [], tte: false, catatan: "pdf_apa_adanya_ttd_cap_dari_berkas" };
    } else {
      siap = await siapkanPdf({ jenis, rtf, penggunaId, cap, atur, tte: tteElektronik ? { passphrase, nik } : null });
      if (!siap.ok) return siap;
    }

    const laporan = {
      penandaTangan: siap.penandaTangan || null,
      tandaTangan: siap.tandaTangan,
      cap: siap.cap ? { id: siap.cap.id || "", nama: siap.cap.nama || "", diBelakang: Boolean(siap.cap.diBelakang) } : null,
      peringatan: siap.peringatan || [],
      gambarBawaan: siap.gambarBawaan || { dibuang: 0, uraian: [] },
      tte: siap.tte,
      catatan: siap.catatan || "",
    };
    if (kering) {
      return {
        ok: true,
        kering: true,
        ukuranPdf: siap.pdf.length,
        ...laporan,
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
    if (!simpan.ok) return { ...simpan, langkah: "simpan", peringatan: laporan.peringatan };
    return {
      ok: true,
      jalur: simpan.jalur,
      ukuranPdf: siap.pdf.length,
      ...laporan,
    };
  }

  return { peta, unggah, kenaliPerkara, siapkanPdf };
}

const bawaan = buatLayanan();

module.exports = {
  JENIS,
  PETA_PTSP,
  PENANDATANGAN,
  ATUR_BAWAAN,
  ATUR_JENIS,
  CIRI,
  aturBerlaku,
  sapuRtf,
  teksPolos,
  pisahBagian,
  ambilBagian,
  ukuranGambar,
  adaTransparansi,
  awalBlokTtd,
  buangGambarBlokTtd,
  adaKotakTtdElektronik,
  cariPenandaTangan,
  cocokkanTandaTangan,
  tataParagraf,
  bubuhkanTtdCap,
  bubuhkanPenetapan,
  buatLayanan,
  peta: (...a) => bawaan.peta(...a),
  unggah: (...a) => bawaan.unggah(...a),
};
