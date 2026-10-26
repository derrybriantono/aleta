"use strict";

/**
 * ============================================================================
 * PANEL ABT - BAGIAN BERSAMA (K11)
 * ============================================================================
 *
 * Fungsi dan konstanta yang dipakai panel blangko DAN panel beranda ABT, tetapi tidak oleh kode inti.
 * Dimuat lebih dulu (prasyarat abt-panel-blangko.js dan abt-panel-beranda.js).
 *
 * Potongan UTUH abt.js yang lama (K11, 26 Okt 2026): pernyataannya tidak diubah, hanya dipindahkan. Dimuat
 * modul-malas.js ke dunia terasing yang sama dengan abt.js lewat pekerja latar (chrome.scripting.executeScript),
 * sehingga semua const/let/function tingkat atas tetap satu lingkup bersama abt.js.
 */

const KUNCI_TEMA_PANEL = "temaPanel";
/* === AKHIR P5P6 === */
const ALETA_API_PDF = "/aleta/api/aleta-bot/abt/pdf";

/** Tautan cara lama - dipakai bila jalur ekstensi tidak tersedia. */
function unduhLewatTautan(blob, nama) {
  const alamat = URL.createObjectURL(blob);
  const tautan = document.createElement("a");
  tautan.href = alamat;
  tautan.download = nama;
  // Cadangan terakhir: jangan dialihkan lagi oleh unduh-universal.js.
  if (typeof alatTandaiTautanAsli === "function") alatTandaiTautanAsli(tautan);
  document.body.appendChild(tautan);
  tautan.click();
  tautan.remove();
  // Dilepas menyusul, bukan seketika: sebagian peramban membatalkan unduhan
  // yang alamat blob-nya sudah dicabut sebelum unduhannya benar-benar mulai.
  setTimeout(() => URL.revokeObjectURL(alamat), 30_000);
}

/** Blob menjadi data: URL, supaya dapat dikirim ke pekerja latar. */
function blobKeData(blob) {
  return new Promise((selesai, gagal) => {
    const pembaca = new FileReader();
    pembaca.onload = () => selesai(String(pembaca.result || ""));
    pembaca.onerror = () => gagal(pembaca.error || new Error("berkas tidak terbaca"));
    pembaca.readAsDataURL(blob);
  });
}

/**
 * Menyimpan satu blob sebagai unduhan.
 *
 * ============================================================================
 * DITERBITKAN EKSTENSI, BUKAN HALAMAN
 * ============================================================================
 *
 * Chrome memblokir unduhan yang berasal dari halaman http:// - "Chrome blocked
 * this download because the site isn't using a secure connection". SIPP dan
 * ABT berjalan di http://192.168.10.10, jadi seluruh putusan, anonimisasi, dan
 * PDF yang disusun panel jatuh ke sana: tercoret di riwayat unduhan, dan tiap
 * berkas harus dipaksa satu per satu.
 *
 * Alamat blob TIDAK menolong - ia mewarisi asal halamannya, jadi tetap http.
 * Yang menolong adalah menerbitkannya dari ekstensi; chrome-extension://
 * adalah asal yang tepercaya.
 *
 * Berkasnya sendiri tidak melintasi jaringan lagi: ia sudah ada di memori,
 * diambil lewat fetch yang sama yang dipakai panel untuk membacanya. Yang
 * berpindah hanya siapa yang menuliskannya ke cakram.
 *
 * Bila jalur itu gagal - izin belum diberikan sesudah pembaruan, pekerja latar
 * sedang tidur - ia jatuh ke cara lama. Unduhan yang tertahan peringatan masih
 * jauh lebih baik daripada unduhan yang tidak terjadi.
 */
async function unduhBlob(blob, nama) {
  try {
    const alamat = await blobKeData(blob);
    const jawab = await new Promise((selesai) => {
      try {
        chrome.runtime.sendMessage(
          { sumber: "aleta-panel", jenis: "unduh", nama, alamat },
          (hasil) => {
            void chrome.runtime.lastError;
            selesai(hasil);
          }
        );
      } catch {
        selesai(null);
      }
    });
    if (jawab && jawab.ok) return;
    alatCatat("massal-galat", `unduhan lewat ekstensi gagal: ${(jawab && jawab.pesan) || "tanpa jawaban"}`, "");
  } catch (galat) {
    alatCatat("massal-galat", `unduhan lewat ekstensi gagal: ${String((galat && galat.message) || galat)}`, "");
  }
  unduhLewatTautan(blob, nama);
}

/**
 * ============================================================================
 * NOMOR PERKARA - JENIS PERKARA - STATUS PUTUSAN
 * ============================================================================
 *
 * Bentuk yang diminta satker, dan bentuk yang dipakai seluruh jalur unduhan -
 * lewat panel maupun lewat pendengar unduhan di latar.js.
 *
 * Bentuk sebelumnya menyisipkan ringkasBlangkoAbt() di tempat jenis perkara.
 * Itu bukan jenis perkara melainkan potongan kepala halaman blangko, yang
 * berbunyi lain di tiap halaman dan hilang sama sekali ketika kepalanya tidak
 * terbaca. Jenis perkara kini datang dari daftar sidang - sumber yang sama
 * yang dipakai panel massal - dan dari keterangan perkara pada jalur satu
 * perkara.
 *
 * Penanda jenis berkas hanya ditempelkan bila BUKAN putusan utamanya: tanpa
 * itu berkas anonimisasi bernama persis sama dengan putusannya, dan yang
 * kedua menimpa yang pertama.
 */
function namaBerkas(nomorPerkara, akhiran, jenis) {
  const dasar = String(nomorPerkara || "putusan").replace(/[\\/:*?"<>|]+/g, "_");
  const bagian = [dasar, sebutJenisPerkara(nomorPerkara), sebutStatusPutusan(nomorPerkara)];
  if (jenis && jenis !== "putusan") bagian.push(jenis);
  return `${bagian.filter(Boolean).join(" - ")}.${akhiran}`
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ");
}

function base64DariBuffer(buffer) {
  const byte = new Uint8Array(buffer);
  let biner = "";
  // Dipotong-potong: String.fromCharCode dengan puluhan ribu argumen sekaligus
  // melampaui batas tumpukan pemanggilan pada berkas yang besar.
  const potongan = 0x8000;
  for (let i = 0; i < byte.length; i += potongan) {
    biner += String.fromCharCode.apply(null, byte.subarray(i, i + potongan));
  }
  return btoa(biner);
}
const ALETA_API_UNGGAH_NASKAH_ABT = "/aleta/api/aleta-ecourt/putusan/unggah-naskah";
const ALETA_API_UNGGAH_SIPP_ABT = "/aleta/api/aleta-ecourt/putusan/unggah-sipp";
/**
 * Harus LEBIH LAMA daripada batas gerbangnya (timeoutMs pada
 * gatewayUnggahPutusanSipp). Dahulu persis sama - tanpa selisih sama sekali -
 * sehingga keduanya menyerah pada saat yang sama, dan yang membatalkan lebih
 * dahulu meninggalkan berkas yang sudah tertulis tanpa barisnya.
 *
 * Urutannya harus menaik dari dalam ke luar (K6): bot 90 detik per konversi,
 * gerbang 120 detik, lalu ekstensi 150 detik. RTF yang kini dikirim apa adanya
 * diubah bot sendiri bila perlu - karena itu gerbangnya dinaikkan, dan batas
 * di sini harus tetap di luarnya.
 */
const BATAS_UNGGAH_MASSAL_MS = 150000;

/**
 * ============================================================================
 * HAK UNGGAH PUTUSAN DI PANEL ABT (keputusan 9 Okt 2026)
 * ============================================================================
 *
 * Aturannya satu, di panel-alat.js (alatBolehUnggahPutusan): Hakim (termasuk
 * Ketua/Wakil), Admin, Super Admin. Peladen menolak 403 di rute unggah-sipp,
 * unggah-naskah, dan isian-sipp; pemantau ambil menahan permintaannya. Di sini
 * hanya supaya bagian yang pasti ditolak tidak ditawarkan.
 */
function abtTolakUnggahPutusan() {
  try {
    return typeof alatBolehUnggahPutusan === "function" && alatBolehUnggahPutusan(penggunaAletaAbt) === false;
  } catch {
    return false;
  }
}

/**
 * Kotak terkunci beralasan. Panitera dan juru sita di Baru/UI Baru tidak
 * pernah punya menu unggah putusan di matriks perannya - bagi mereka cukup
 * tidak digambar; peran lain dan tampilan Lama melihat alasannya.
 */
function abtPasangKotakTerkunci(isi) {
  let golongan = "lain";
  try {
    golongan = typeof alatGolonganPeran === "function" ? alatGolonganPeran(penggunaAletaAbt && penggunaAletaAbt.peran) : "lain";
  } catch {
    golongan = "lain";
  }
  if (t6Aktif() && (golongan === "panitera" || golongan === "jurusita")) return null;
  if (typeof alatKotakTerkunciPutusan !== "function") return null;
  const kotak = alatKotakTerkunciPutusan("Unggah putusan perkara ini ke SIPP");
  if (isi) isi.appendChild(kotak);
  return kotak;
}

/** Anonimisasi dipakai hanya bila diunggah ke SIPP atau diunduh. */
function anonimDipakaiAbt(opsi) {
  const o = opsi || {};
  return Boolean(o.anonim) && (Boolean(o.unggah) || Boolean(o.unduh));
}

/**
 * ============================================================================
 * PERSIAPAN SATU PERKARA - SEMUA YANG TIDAK MENULIS KE SIPP
 * ============================================================================
 *
 *   RTF     GET  abt/preview                    selalu
 *   draf    POST /putusan/unggah-naskah         bila dicentang
 *   anonim  POST abt/main/anonim                bila diunggah ATAU diunduh
 *   PDF     POST /aleta-bot/abt/pdf             hanya bila diunduh
 *   unduh   berkas ke folder unduhan            bila dicentang
 *
 * Dipisah dari unggahannya supaya persiapan perkara berikutnya dapat
 * dikerjakan SELAMA jeda sesudah perkara ini - lihat jalankanMassalAbt.
 *
 * Yang tidak dibuat DISEBUT di ringkasan, bukan dilaporkan "ok".
 */
async function siapkanPerkaraAbt(butir, peta, opsi, lapor) {
  const o = opsi || {};
  const kabar = typeof lapor === "function" ? lapor : () => {};
  const dokumen = { rtf: "", draf: "", anonim: "", pdf: "", unduh: "", unggah: "" };
  const ringkas = [];
  const namaDasar = String(butir.nomor || "putusan").replace(/[\\/:*?"<>|]+/g, "_");
  const siap = { butir, dokumen, ringkas, namaDasar, isiRtf: null, isiAnonim: null, ok: false };

  // 1. RTF dari ABT
  try {
    const alamat = alatAlamatPreviewAbt(asalAbt(), peta, butir.perkaraId);
    if (!alamat) throw new Error("blangko belum dipetakan");
    kabar("mengambil RTF dari ABT…");
    const respons = await fetch(alamat, { credentials: "include", cache: "no-store" });
    if (!respons.ok) throw new Error(`ABT menjawab ${respons.status}`);
    const isiRtf = await respons.arrayBuffer();
    const awal = new TextDecoder("latin1").decode(new Uint8Array(isiRtf).subarray(0, 5));
    if (!awal.startsWith("{\\rtf")) {
      const sebab = a3SebabBukanAbt(new TextDecoder("latin1").decode(new Uint8Array(isiRtf).subarray(0, 6000)));
      throw new Error(sebab || "ABT tidak mengembalikan RTF - token blangko tidak sah atau sesi ABT habis");
    }
    siap.isiRtf = isiRtf;
    dokumen.rtf = "ok";
    ringkas.push("RTF ok");
    alatCatat("massal", `${butir.nomor}: RTF ${isiRtf.byteLength} bita`, "");
  } catch (galat) {
    dokumen.rtf = `gagal: ${String((galat && galat.message) || galat)}`;
    ringkas.push(dokumen.rtf.replace("gagal", "RTF gagal"));
    alatCatat("massal-galat", `${butir.nomor}: ${dokumen.rtf}`, "");
    return siap;
  }
  siap.ok = true;

  // 2. Draf ke ALETA
  if (o.draf) {
    try {
      kabar("menyimpan draf ke ALETA…");
      const badan = new FormData();
      badan.append("berkas", new Blob([siap.isiRtf], { type: "application/rtf" }), `${namaDasar}.rtf`);
      badan.append("nomorPerkara", butir.nomor);
      badan.append("perkaraId", butir.perkaraId);
      const respons = await alatAmbil(
        ALETA_API_UNGGAH_NASKAH_ABT,
        { method: "POST", body: badan, credentials: "include", batasMs: BATAS_UNGGAH_MASSAL_MS },
        "Mengirim naskah putusan"
      );
      if (!respons.ok) throw new Error(alatPesanGagal(null, respons.status, "Mengirim naskah putusan"));
      const luar = await respons.json();
      const jawab = luar && luar.data ? luar.data : luar;
      if (!jawab || !jawab.ok) throw new Error((jawab && jawab.sebab) || "draf ditolak");
      dokumen.draf = `v${jawab.versi}`;
      ringkas.push(`draf v${jawab.versi}`);
    } catch (galat) {
      dokumen.draf = `gagal: ${String((galat && galat.message) || galat)}`;
      ringkas.push(`draf ${dokumen.draf}`);
      alatCatat("massal-galat", `${butir.nomor}: draf ${dokumen.draf}`, "");
    }
  }

  // 3. Anonimisasi lewat ABT - hanya bila ada yang memakainya
  const pakaiAnonim = anonimDipakaiAbt(o);
  if (pakaiAnonim) {
    try {
      kabar("meminta ABT menganonimkan…");
      const borang = new FormData();
      borang.set("perkara_id", butir.perkaraId);
      borang.set("perkara_no", butir.nomor);
      borang.set("file_putusan", new Blob([siap.isiRtf], { type: "application/rtf" }), `${namaDasar}.rtf`);
      const respons = await fetch(`${asalAbt()}/main/anonim`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        body: borang,
      });
      if (!respons.ok) throw new Error(`ABT menjawab ${respons.status}`);
      const isi = await respons.arrayBuffer();
      const awal = new TextDecoder("latin1").decode(new Uint8Array(isi).subarray(0, 5));
      if (!awal.startsWith("{\\rtf")) {
        const teks = new TextDecoder().decode(isi);
        const pesan = teks.match(/Proses Anonim Gagal[^<]*/i);
        throw new Error(pesan ? pesan[0].slice(0, 120) : "ABT tidak mengembalikan RTF");
      }
      siap.isiAnonim = isi;
      dokumen.anonim = "ok";
      ringkas.push("anonim ok");
    } catch (galat) {
      const pesan = String((galat && galat.message) || galat);
      dokumen.anonim = `gagal: ${pesan}`;
      ringkas.push(`anonim gagal: ${pesan}`);
      alatCatat("massal-galat", `${butir.nomor}: anonim ${pesan}`, "");
    }
  }

  // 4. PDF - hanya untuk diunduh; SIPP menerima RTF apa adanya
  let pdfPutusan = null;
  const pakaiPdf = Boolean(o.pdf) && Boolean(o.unduh);
  if (pakaiPdf) {
    try {
      kabar("mengubah menjadi PDF…");
      pdfPutusan = await ubahKePdf(siap.isiRtf);
      dokumen.pdf = "ok";
      ringkas.push("PDF ok");
    } catch (galat) {
      dokumen.pdf = `gagal: ${String((galat && galat.message) || galat)}`;
      ringkas.push(`PDF ${dokumen.pdf}`);
      alatCatat("massal-galat", `${butir.nomor}: PDF ${dokumen.pdf}`, "");
    }
  }

  // 5. Unduh - hasil yang memang diminta
  if (o.unduh) {
    let n = 0;
    try {
      kabar("mengunduh berkas…");
      await unduhBlob(new Blob([siap.isiRtf], { type: "application/rtf" }), namaBerkas(butir.nomor, "rtf", "putusan"));
      n += 1;
      if (pdfPutusan) {
        await unduhBlob(pdfPutusan, namaBerkas(butir.nomor, "pdf", "putusan"));
        n += 1;
      }
      if (siap.isiAnonim) {
        await unduhBlob(new Blob([siap.isiAnonim], { type: "application/rtf" }), namaBerkas(butir.nomor, "rtf", "anonimisasi"));
        n += 1;
      }
      dokumen.unduh = `${n} berkas`;
      ringkas.push(`${n} berkas diunduh`);
    } catch (galat) {
      dokumen.unduh = `gagal sesudah ${n} berkas: ${String((galat && galat.message) || galat)}`;
      ringkas.push(`unduh ${dokumen.unduh}`);
      alatCatat("massal-galat", `${butir.nomor}: unduh ${dokumen.unduh}`, "");
    }
  }

  // Yang dicentang tetapi tidak dibuat karena tidak ada yang memakainya. PDF
  // hanya disebut bila tidak diunggah: bila diunggah, SIPP menerima RTF dan
  // PDF memang bagian dari unduhan saja.
  const tidakDibuat = [];
  if (o.pdf && !pakaiPdf && !o.unggah) tidakDibuat.push("PDF");
  if (o.anonim && !pakaiAnonim) tidakDibuat.push("anonim");
  if (tidakDibuat.length) ringkas.push(`${tidakDibuat.join(" & ")} tidak dibuat (tidak diunduh maupun diunggah)`);
  return siap;
}

/**
 * Tulisan ke SIPP untuk satu perkara: RTF putusan dan - bila dibuat - RTF
 * anonimisasinya, dalam SATU permintaan. Berkasnya RTF apa adanya: 87,7% e-Doc
 * satker berbentuk RTF, rute unggah-sipp memeriksa isinya, dan bot yang
 * mengubahnya bila perlu (keputusan 16). PDF buatan ekstensi tidak lagi
 * menjadi syarat - dahulu mematikan PDF membuat unggahannya dilewati.
 *
 * PENOLAKAN YANG MENYEBUT SLOT ANONIMISASI. Rute unggah-sipp memeriksa isi
 * tiap slot SEBELUM menulis apa pun, dan menolak SELURUH kiriman (409) bila
 * satu slot bermasalah - misalnya anonim ABT yang masih memuat nama pihak.
 * Penolakan itu tidak boleh ikut menahan putusan yang sah: bila slot yang
 * ditolak adalah anonimisasi, putusan dikirim ulang SENDIRIAN (kiriman yang
 * ditolak belum menulis apa pun, jadi tidak ada yang terulang), dan anonimnya
 * disebut TIDAK diunggah beserta sebab dari rute - perkaranya tetap tercatat
 * gagal supaya petugas menyamarkan dan mengunggah anonimnya sendiri.
 *
 * @returns {Promise<boolean>} true bila putusannya masuk
 */
async function unggahBerkasAbt(siap, olehUsername, lapor) {
  const kabar = typeof lapor === "function" ? lapor : () => {};
  const b = siap.butir;
  const denganAnonim = Boolean(siap.isiAnonim);
  const isinya = denganAnonim ? "putusan + anonimisasi" : "putusan";
  try {
    kabar(`mengunggah ${isinya} ke SIPP…`);
    let hasil = await kirimUnggahSippAbt(siap, olehUsername, denganAnonim);
    if (!hasil.ok && denganAnonim && hasil.tolak && hasil.tolak.slot === "anonimisasi") {
      const alasan = hasil.tolak.alasan ? ` (${String(hasil.tolak.alasan).replace(/_/g, " ")})` : "";
      siap.ringkas.push(`kiriman putusan + anonimisasi ditolak rute${alasan}: ${hasil.sebab}`);
      alatCatat("massal-galat", `${b.nomor}: anonimisasi ditolak rute${alasan}: ${hasil.sebab}`, "");
      kabar("anonimisasi ditolak - mengunggah putusan sendirian ke SIPP…");
      hasil = await kirimUnggahSippAbt(siap, olehUsername, false);
      if (!hasil.ok) throw new Error(hasil.sebab);
      siap.dokumen.unggah = `putusan ok; anonimisasi gagal: ditolak rute${alasan}`;
      siap.ringkas.push("SIPP ok (putusan, dikirim ulang tanpa anonimisasi)");
      siap.ringkas.push("anonimisasi gagal: TIDAK diunggah - samarkan lalu unggah sendiri");
      alatCatatTindakan({
        jenis: "unggah-sipp",
        penunjuk: b.nomor,
        label: `unggah putusan ${b.nomor}`,
        nilaiBaru: "(diunggah)",
        dapatPulih: false,
      });
      return true;
    }
    if (!hasil.ok) throw new Error(hasil.sebab);
    siap.dokumen.unggah = "ok";
    siap.ringkas.push(`SIPP ok (${isinya})`);
    const samar = kalimatSisaDisamarkan(hasil.jawab);
    if (samar) siap.ringkas.push(samar);
    alatCatatTindakan({
      jenis: "unggah-sipp",
      penunjuk: b.nomor,
      label: `unggah ${isinya} ${b.nomor}`,
      nilaiBaru: "(diunggah)",
      dapatPulih: false,
    });
    return true;
  } catch (galat) {
    siap.dokumen.unggah = `gagal: ${String((galat && galat.message) || galat)}`;
    siap.ringkas.push(`SIPP ${siap.dokumen.unggah}`);
    alatCatat("massal-galat", `${b.nomor}: unggah ${siap.dokumen.unggah}`, "");
    return false;
  }
}

/**
 * Satu kiriman ke rute unggah-sipp. Jawaban yang menolak dibaca KALIMATNYA
 * (data.sebab, lalu error.message) - bukan hanya angka statusnya - kecuali
 * 401/403, yang kalimat bakunya lebih berguna daripada badan halaman masuk.
 *
 * @returns {Promise<{ok: true, jawab: object} | {ok: false, sebab: string, tolak: object|null}>}
 *   tolak = badan data penolakan 409 rute ({alasan, slot, sebab, nama}) bila ada
 */
async function kirimUnggahSippAbt(siap, olehUsername, denganAnonim) {
  const b = siap.butir;
  const badan = new FormData();
  badan.append("perkaraId", b.perkaraId);
  badan.append("nomorPerkara", b.nomor);
  badan.append("olehUsername", olehUsername || "");
  badan.append("putusan", new Blob([siap.isiRtf], { type: "application/rtf" }), `${siap.namaDasar}.rtf`);
  if (denganAnonim) {
    badan.append("anonimisasi", new Blob([siap.isiAnonim], { type: "application/rtf" }), `${siap.namaDasar} - anonim.rtf`);
    // 16 Okt (F1.2): ABT hanya menyamarkan nama SIPP utuh persis hurufnya; nasab anak,
    // keterangan saksi, dan bukti lolos dan membuat anonimisasi ditolak penjaga di rute
    // (54% dari 251 pasangan nyata). Rute menyamarkan sisanya pada salinan anonimisasi
    // (putusan asli tidak diubah) - hanya bila anonimisasi itu memang sudah tersamar sebagian.
    badan.append("samarkanSisa", "1");
  }
  const respons = await alatAmbil(
    ALETA_API_UNGGAH_SIPP_ABT,
    { method: "POST", body: badan, credentials: "include", batasMs: BATAS_UNGGAH_MASSAL_MS },
    "Mengunggah putusan ke SIPP"
  );
  let luar = null;
  let galatBaca = null;
  try {
    luar = await respons.json();
  } catch (galat) {
    galatBaca = galat;
  }
  const jawab = luar && luar.data ? luar.data : luar;
  if (!respons.ok) {
    const bolehBaca = respons.status !== 401 && respons.status !== 403;
    const pesanGalat = luar && luar.error && typeof luar.error === "object" ? luar.error.message : luar && luar.error;
    const kalimat = bolehBaca ? (jawab && (jawab.sebab || jawab.pesan)) || pesanGalat || "" : "";
    const tolak = bolehBaca && jawab && typeof jawab === "object" && jawab.slot ? jawab : null;
    return {
      ok: false,
      sebab: kalimat ? String(kalimat) : alatPesanGagal(null, respons.status, "Mengunggah putusan ke SIPP"),
      tolak,
    };
  }
  if (!jawab) {
    return {
      ok: false,
      sebab: `Jawaban ALETA atas unggahan tidak terbaca: ${String((galatBaca && galatBaca.message) || "kosong")}.`,
      tolak: null,
    };
  }
  if (!jawab.ok) return { ok: false, sebab: String(jawab.sebab || jawab.pesan || jawab.alasan || "ditolak"), tolak: null };
  return { ok: true, jawab };
}

/** Ringkasan satu perkara: berhasil bila RTF ada dan tidak satu langkah pun gagal. */
function hasilPerkaraAbt(siap) {
  const ringkas = siap.ringkas.join(" · ");
  return { ok: Boolean(siap.ok) && !/gagal/.test(ringkas), ringkas, dokumen: siap.dokumen };
}

/** RTF -> PDF lewat bot ALETA. Pulang Blob PDF, atau melempar sebabnya. */
async function ubahKePdf(isiRtf) {
  const respons = await alatAmbil(
    ALETA_API_PDF,
    {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rtfBase64: base64DariBuffer(isiRtf) }),
      batasMs: BATAS_UNGGAH_MASSAL_MS,
    },
    "Membuat PDF"
  );
  if (!respons.ok) throw new Error(alatPesanGagal(null, respons.status, "Membuat PDF"));
  const luar = await respons.json();
  const isi = luar && luar.data ? luar.data : luar;
  if (!isi || !isi.available) throw new Error((isi && isi.message) || "pengubah PDF tidak tersedia");
  const biner = Uint8Array.from(atob(isi.pdfBase64), (c) => c.charCodeAt(0));
  return new Blob([biner], { type: "application/pdf" });
}

function t6Modern() {
  try {
    return typeof alatKulit === "function" && alatKulit() === "modern";
  } catch {
    return false;
  }
}

// ─── Perkakas kecil ──────────────────────────────────────────────────────────

/**
 * Setiap unsur buatan blok ini berkelas "aleta-t6". Dengan kelas itulah
 * pengamat perubahan mengenali tulisannya sendiri dan tidak bereaksi atasnya -
 * tanpa itu hiasan yang ditambahkan memicu hiasan berikutnya tanpa akhir.
 */
function t6El(tag, kelas, teks) {
  return buatElemen(tag, `aleta-t6${kelas ? ` ${kelas}` : ""}`, teks);
}

function t6Tombol(teks, judul, kelas) {
  const b = t6El("button", `aleta-t6-tombol${kelas ? ` ${kelas}` : ""}`, teks);
  b.type = "button";
  if (judul) b.title = judul;
  return b;
}

function t6Baku(teks) {
  return String(teks || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function t6CatatGalat(galat, ringkas) {
  try {
    if (typeof alatCatat === "function") alatCatat("galat", ringkas || "Tahap 6 panel ABT", String((galat && galat.message) || galat));
  } catch {
    /* panel lama tetap utuh */
  }
}

function soreEl(tag, kelas, teks) {
  return t6El(tag, `aleta-sore${kelas ? ` ${kelas}` : ""}`, teks);
}

function sorePesan(galat) {
  return String((galat && galat.message) || galat);
}

/**
 * Peran yang BERLAKU. Mode "ganti peran" Super Admin (K1), bila kelak ada di
 * panel-alat.js sebagai alatPeranAktif(), menang atas peran akun.
 */
function sorePeranAktif() {
  try {
    if (typeof alatPeranAktif === "function") {
      const p = alatPeranAktif();
      if (p) return String(p);
    }
  } catch {
    /* tanpa mode ganti peran */
  }
  return String((penggunaAletaAbt && penggunaAletaAbt.peran) || "");
}

function soreMenuPeran(halaman, peran, opsi) {
  try {
    return typeof alatMenuPeran === "function" ? alatMenuPeran("abt", halaman, peran, opsi) : null;
  } catch {
    return null;
  }
}

function soreGolongan(peran) {
  try {
    return typeof alatGolonganPeran === "function" ? alatGolonganPeran(peran) : "lain";
  } catch {
    return "lain";
  }
}

// ─── Penanda "ditangani" (K2) ────────────────────────────────────────────────

/** "Dra. Hj. MUNIFA, S.H." -> "munifa". */
function soreBakuNamaAkun(nama) {
  const depan = String(nama || "").split(",")[0];
  return depan
    .toLowerCase()
    .replace(/\b(drs|dra|dr|hj|h|ir|prof|kh)\.?(?=\s|$)/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function soreBakuTeks(teks) {
  return String(teks || "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Tampak / tidak: peran, ⋯, penjelasan teknis ─────────────────────────────

function soreTampakkan(el, tampak) {
  if (!el) return;
  if (tampak) {
    if (el.hasAttribute("data-sore-tampak")) el.removeAttribute("data-sore-tampak");
  } else if (el.getAttribute("data-sore-tampak") !== "tidak") {
    el.setAttribute("data-sore-tampak", "tidak");
  }
}

/**
 * Butir 3 / K5: penjelasan teknis diberi kelas aleta-teknis - saklar
 * "Sembunyikan penjelasan teknis" (panel-alat.js, blok W) yang menyembunyikan.
 * Pesan error, peringatan yang meminta tindakan, dan konfirmasi TIDAK
 * ditandai. Pita ringkas ⓘ Tahap 6 di depan unsur itu ikut ditandai, supaya
 * tidak tertinggal tanpa isi.
 */
function soreTandaiTeknis(panel) {
  if (!panel) return;
  const tandai = (el) => {
    if (!el || el.classList.contains("aleta-teknis")) return;
    if (el.classList.contains("aleta-abt-gagal") || el.classList.contains("aleta-t6-gagal")) return;
    el.classList.add("aleta-teknis");
    const depan = el.previousElementSibling;
    if (depan && (depan.classList.contains("aleta-t6-info-pita") || depan.classList.contains("aleta-info-lipat"))) depan.classList.add("aleta-teknis");
  };
  const isi = t6Anak(panel, "aleta-isi");
  if (isi) {
    for (const el of Array.from(isi.children).filter((c) => c.classList.contains("aleta-baris-ket"))) tandai(el);
    for (const el of Array.from(isi.querySelectorAll(".aleta-abt-petunjuk, .aleta-t6-lipat-takberlaku, .aleta-t6-info-sumber, .aleta-t6-rincian, .aleta-remeh"))) tandai(el);
    for (const el of Array.from(isi.querySelectorAll(".aleta-t6-sematan > .aleta-t6-lembut, .aleta-t6-wajib .aleta-t6-lembut, .aleta-t6-komentar-daftar > .aleta-t6-lembut"))) {
      if (/^(Belum ada variabel disematkan|Jenis perkara tidak terbaca|Belum ada variabel wajib|Membaca daftar variabel wajib|Hakim belum mengomentari)/.test(String(el.textContent || "").trim())) tandai(el);
    }
    for (const el of Array.from(isi.querySelectorAll(".aleta-sdg-hasil > .aleta-abt-catatan"))) {
      if (/^Seret ⠿/.test(String(el.textContent || "").trim())) tandai(el);
    }
  }
  for (const el of Array.from(panel.querySelectorAll(".aleta-kaki-pintasan"))) tandai(el);
}

// ─── Butir 1: bentuk lipat seragam (alatJadikanLipat milik agen W) ──────────

/**
 * alatJadikanLipat (panel-alat.js, K2) memberi rupa lipat DI TEMPAT - tanpa
 * membungkus - dan aman dipanggil berulang; kuncinya mengingat buka/tutup per
 * bagian (chrome.storage.local lipatTerbuka, milik agen W). Visibilitas per
 * peran tetap data-sore-tampak pada unsur yang sama.
 */
function a1JadikanLipat(el, kunci, opsi) {
  if (!el || typeof alatJadikanLipat !== "function") return;
  const o = opsi || {};
  try {
    // Perbaikan 2 Okt butir 19 + 7: bawaan buka/tutup dan tag peran (a2).
    alatJadikanLipat(el, { kunci, terbuka: o.terbuka !== false, ...(o.peran ? { peran: o.peran } : {}) });
    if (o.peran) a2TagPeran(el, kunci);
  } catch (galat) {
    t6CatatGalat(galat, "Lipat seragam (alatJadikanLipat) gagal");
  }
}

/*
 * ============================================================================
 * PERBAIKAN 2 OKT 2026 - PANEL ABT (AGEN A)
 * ============================================================================
 *
 * Sumber: pesan pengguna sesudah memakai 1.177.0 (tangkapan 133-135). Tampilan
 * berubah HANYA di UI Baru (t6Modern()); Lama dan Baru tetap seperti 1.177.0
 * (ekstensi-abt-tahap6 "SYARAT MUTLAK", ekstensi-abt-sederhana,
 * ekstensi-abt-1okt). Pengecualian: butir 14 (jeda sebelum menulis) global.
 *
 *   butir 5   ACCORDION MACET. Sebab sebenarnya: kepala "Susun keterangan
 *             saksi" dan "Isi dari SIPP & input ke ABT" dijadikan lipatan
 *             (alatJadikanLipat, asal "kartu") pada div yang HANYA memuat
 *             kepala + baris status. Isinya - penyunting saksi, kartu selisih,
 *             huruf alasan, usulan, Input ke ABT - digambar tombol lama ke
 *             wadah aleta-abt-daftar SESAUDARA di bawahnya (dan wadah usulan
 *             dipakai bergantian oleh keduanya). CSS lipatan menyembunyikan
 *             anak lipatan saja, jadi menutup hanya menyembunyikan status.
 *             Wadahnya tidak dipindah (Tahap 6 dan tombol lama memegangnya
 *             lewat rujukan dan isi.children); sebagai gantinya tiap wadah
 *             diberi pemilik (a2AnggotaBagian) dan diberi data-a2-terlipat
 *             selama pemiliknya tertutup - panel.css blok A2 menyembunyikannya.
 *             Diselaraskan pada peristiwa aleta-lipat-berubah (seketika), pada
 *             perubahan atribut data-terbuka (pemulihan ingatan asinkron), dan
 *             pada tiap penataan ulang (wadah usulan berganti pemilik).
 *   butir 6   Susun keterangan saksi: menu alatMenuPeran "susun-saksi" hanya
 *             golongan panitera (Panitera, Panitera Pengganti, Panitera
 *             Sidang) + Admin/Super Admin ("semua"); Tahap 6 menahan tombolnya
 *             (T6_PERAN_SDG). Yang tidak berhak mendapat kalimat yang benar
 *             ("hanya untuk panitera ...") bukan "tidak tersedia di blangko".
 *   butir 7   tag peran di kepala lipatan (opsi `peran`, agen W): Susun saksi
 *             = Panitera; Isi dari SIPP, Unggah putusan, Alasan = Hakim;
 *             Juru Sita = jurusita.
 *   butir 8   jawaban saksi yang BELUM TERDETEKSI ("...", "…", "_", #0000#):
 *             ringkasan jumlah di atas penyunting (+ "Ke berikutnya", "Hanya
 *             yang belum"), dan per baris: ✎ Sunting (memilih titik-titiknya),
 *             isian dari sumber yang ada (variabel blangko, saksi lain, usulan
 *             bacaan Isi dari SIPP, butir posita), dan "Diisi di sidang"
 *             (tanda pratinjau). Semuanya pratinjau sampai Simpan ditekan.
 *   butir 9   kartu "Dirapikan otomatis" (posita 5125, saksi 2021/2022) TIDAK
 *             tampil; tetap dikerjakan dan tetap tercentang, ikut tersimpan
 *             saat Input ke ABT. Dapat dilihat lewat ⋯ → Lihat yang dirapikan.
 *   butir 3   putusan massal: "Blangko utama" di atas daftar; per perkara
 *             tombol "Blangko berbeda…" (aletaMassalBarisBlangko agen R bila
 *             ada) membuka pilihan blangko perkara itu.
 *   butir 14  tulisan LANGSUNG ke ABT (simpanVariabel, simpanKeteranganSaksi,
 *             kirimTanyaJawab) didahului alatJedaManusia "simpan" (agen W) -
 *             GLOBAL (Lama, Baru, UI Baru). Tulisan lewat bot ALETA (posita
 *             SIPP, unggah putusan) diberi jeda oleh bot (agen E) - tidak
 *             digandakan di sini. Tidak ada penanda ALETA yang disisipkan ke
 *             isian ABT; tooltip sel ABT tidak lagi menyebut ALETA.
 *   butir 19  bawaan buka/tutup per peran: bagian utama terbuka, sekunder
 *             tertutup (lipatan dipasang sesudah menu peran diketahui).
 *             Ingatan buka/tutup orang (lipatTerbuka) tetap menang.
 *
 * Tidak ada kunci penyimpanan, rute, atau jalur tulis baru.
 */
/** Peran pemilik tiap bagian - tag di kepala lipatan (butir 7). */
const A2_PERAN_BAGIAN = Object.freeze({
  "abt:isi-input": "Hakim",
  "abt:susun-saksi": "Panitera",
  "abt:unggah-putusan": "Hakim",
  "abt:alasan": "Hakim",
  "abt:jurusita": "jurusita",
});

function a2El(tag, kelas, teks) {
  return t6El(tag, `aleta-a2${kelas ? ` ${kelas}` : ""}`, teks);
}

/** Tag peran di KIRI judul, tepat sesudah panah lipat - sama dengan panel-alat.js dan konten.js (butir 5, 2 Okt sore). */
function a2TagPeran(el, kunci) {
  const peran = A2_PERAN_BAGIAN[kunci];
  const p = el && el.__aletaLipat;
  const kepala = p && p.kepala;
  if (!peran || !kepala) return;
  let tag = kepala.querySelector(":scope > .aleta-lipat-peran");
  if (!tag) {
    tag = a2El("span", "aleta-lipat-peran aleta-a2-peran", peran === "jurusita" ? "Juru Sita" : peran);
    tag.title = `Bagian ini untuk: ${tag.textContent}`;
    kepala.appendChild(tag);
  }
  const judul = kepala.querySelector(":scope > .aleta-sore-kerja-judul, :scope > .aleta-abt-judul, :scope > .aleta-abt-nama");
  if (judul && tag.nextSibling !== judul) kepala.insertBefore(tag, judul);
}

(globalThis.__aletaModulSelesai || (globalThis.__aletaModulSelesai = new Set())).add("abt-panel-bersama.js"); // K11-SELESAI
