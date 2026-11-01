"use strict";

/**
 * ============================================================================
 * KETERANGAN SAKSI - PERBAIKAN SESUDAH TINJAUAN 1 NOV 2026 (docs/arahan/tinjau-saksi-1nov.md)
 * ============================================================================
 *
 * Langkah PENUTUP susunan 'saksi-sdg' (jalur cerai Blangko Derry dan panel "Susun saksi" ABT), dijalankan rute sesudah
 * susunKeteranganSaksiSdg + isiJawabanSaksiService.lengkapi. Berkas ini MURNI (tanpa basis data/jaringan) dan hanya mengubah
 * hasil susunan - tidak menulis ke SIPP/ABT.
 *
 * Keputusan pengguna 1 Nov (keputusan-sementara-31okt.md butir 61-67) yang dikerjakan di sini:
 *   61  draf tetap terisi otomatis (percepatan); butir yang berasal dari GUGATAN/POSITA, dari JAWABAN/DUPLIK pihak lawan, atau
 *       klaim pengetahuan LANGSUNG yang disusun otomatis (melihat/mendengar sendiri, bentuk pertengkaran, upaya keluarga) diberi
 *       TANDA PERINGATAN (j.usulan.peringatan) - hanya untuk panel, tidak pernah masuk naskah;
 *   62  saksi Tergugat/Termohon perkara cerai (BAS Pembuktian T): bawaan = keterangan sesuai JAWABAN & DUPLIK pihak itu (dasar
 *       "jawaban"); pilihan "ikut gugatan" memakai susunan saksi Penggugat apa adanya;
 *   63  dua pengetahuan baru untuk blangko Tolak/NO: "tidak-tahu-apa" (tidak tahu perselisihan maupun pisahnya) dan
 *       "sebaliknya" (keterangan berkebalikan dengan dalil gugatan);
 *   67  bunyi posita yang salah ketik dirapikan TANPA mengubah makna bila masuk ke mulut saksi (keterangan saksi bukan teks
 *       pihak - keputusan 55 tetap berlaku untuk salinan dokumen pihak, bukan untuk ini).
 * Temuan tinjauan yang dibetulkan: A3 alamat Tergugat sekarang = kediaman bersama, B4 bentuk pertengkaran tanpa penanda
 * cerita/ragu, C1 saksi 1 dan 2 sama persis, C2 "Ya," pada pertanyaan terbuka, C3 kata ganda, C4 huruf besar di tengah
 * kalimat, 12b "Tidak, "/"Sudah, " di depan jawaban (tercetak "Bahwa tidak, ..." di putusan).
 */

const teks = (x) => String(x == null ? "" : x);
const RE_TITIK = /\.{3,}|…/;
const adaTitik = (t) => RE_TITIK.test(teks(t));
const norm = (t) =>
  teks(t)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const bersihPosita = (p) =>
  teks(p)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Huruf pertama besar, akhir titik koma (bentuk jawaban saksi). */
function kalimat(t) {
  let s = teks(t).replace(/\s+/g, " ").trim().replace(/[\s;,.]+$/, "");
  if (!s) return "";
  s = s.charAt(0).toUpperCase() + s.slice(1);
  return `${s};`;
}
const kecilAwal = (t, sebutan) => {
  const s = teks(t);
  const kata = (s.match(/^[A-Za-z]+/) || [""])[0];
  if (!kata || sebutan.includes(kata) || /^[A-Z]{2,}$/.test(kata)) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
};

// ─── Tanda peringatan (keputusan 61) ──────────────────────────────────────────

const PERINGATAN = Object.freeze({
  gugatan: "Bunyi ini diambil dari gugatan/posita, bukan dari ucapan saksi. Sesuaikan dengan keterangan saksi di persidangan.",
  jawaban: "Bunyi ini disusun dari jawaban/duplik pihak, bukan dari ucapan saksi. Sesuaikan dengan keterangan saksi di persidangan.",
  pengetahuan: "Pengetahuan langsung saksi (melihat/mendengar sendiri, bentuk pertengkaran, upaya keluarga) disusun otomatis. Pastikan saksi sungguh menerangkannya.",
});
/** Klaim pengetahuan langsung yang hanya dapat datang dari saksi sendiri. */
const RE_PENGETAHUAN =
  /\b(?:melihat\s+(?:dan\s+mendengar\s+)?sendiri|mendengar\s+sendiri|menyaksikan(?:nya)?\s+(?:sendiri|langsung)|saya\s+lihat\s+sendiri|mata\s+kepala|dirukunkan|didamaikan|dinasihati|menasihati|adu\s+mulut|kata-kata\s+kasar|berulang\s+kali)\b/i;
const RE_PENGETAHUAN_NEGATIF = /\btidak\s+pernah\b|\bbelum\s+pernah\b|\btidak\s+(?:tahu|mengetahui)\b|\bdari\s+cerita\b|\bmenurut\s+cerita\b/i;
const MODUS_LANGSUNG = new Set(["sama", "sebagian", "mendengar"]);

function tandai(j, jenis, opsi) {
  const o = opsi || {};
  if (!PERINGATAN[jenis]) return;
  if (!j.usulan || typeof j.usulan !== "object") j.usulan = { teks: j.jawab, yakin: o.yakin || "cukup", sumber: o.sumber || "", ket: o.ket || "" };
  if (o.sumber) j.usulan.sumber = o.sumber;
  if (o.ket) j.usulan.ket = o.ket;
  if (o.yakin) j.usulan.yakin = o.yakin;
  // Satu tanda per butir; "jawaban" dan "gugatan" (sumber bunyi) didahulukan dari "pengetahuan".
  const lama = j.usulan.peringatan;
  if (!lama || (lama === "pengetahuan" && jenis !== "pengetahuan")) j.usulan.peringatan = jenis;
}

// ─── Perapian ejaan bunyi posita (keputusan 67) ──────────────────────────────

/** Kata kerja yang sering ditulis terpisah dari awalan di- pada posita satker ("di sampaikan"). */
const DASAR_DI = [
  "sampaikan", "nasehati", "nasihati", "pukul", "tinggal", "tinggalkan", "usir", "ajak", "beri", "berikan", "tampar", "aniaya", "marahi", "maki", "hina",
  "ceraikan", "talak", "jemput", "antar", "bawa", "suruh", "larang", "minta", "rukunkan", "damaikan", "panggil", "kirim", "nafkahi", "lakukan", "katakan",
  "ucapkan", "ketahui", "sebutkan", "jelaskan", "terima", "tolak", "nikahi", "kawini", "ancam", "paksa", "tuduh", "fitnah", "cemburui", "abaikan", "telantarkan",
  "terlantarkan", "pulangkan", "kembalikan", "lihat", "dengar", "temui", "datangi", "hubungi", "telepon", "tegur",
];
const RE_DI_PISAH = new RegExp(`\\b([Dd])i\\s+(${DASAR_DI.join("|")})\\b`, "g");
/** Kata depan "di"/"ke" yang ditulis menempel pada tempat ("dirumah" -> "di rumah"). */
const TEMPAT = ["rumah", "sana", "sini", "mana", "kampung", "desa", "kota", "luar", "dalam", "atas", "bawah", "depan", "belakang", "samping", "tempat", "kantor", "pasar", "kebun", "laut"];
const RE_DEPAN_MENEMPEL = new RegExp(`\\b([DdKk])([ie])(${TEMPAT.join("|")})\\b`, "g");
const SINGKATAN = [
  [/\byg\b/gi, "yang"],
  [/\btdk\b/gi, "tidak"],
  [/\bdgn\b/gi, "dengan"],
  [/\bkrn\b/gi, "karena"],
  [/\bsdh\b/gi, "sudah"],
  [/\bblm\b/gi, "belum"],
  [/\butk\b/gi, "untuk"],
  [/\bjg\b/gi, "juga"],
  [/\bsy\b/gi, "saya"],
  [/\bnasehat/gi, "nasihat"],
  [/\bmenasehati\b/gi, "menasihati"],
  [/\bsekedar\b/gi, "sekadar"],
  [/\brumahtangga\b/gi, "rumah tangga"],
  [/\bperduli\b/gi, "peduli"],
  [/\bmerubah\b/gi, "mengubah"],
  [/\bijin\b/gi, "izin"],
  [/\bjaman\b/gi, "zaman"],
  [/\bsilahkan\b/gi, "silakan"],
  [/\bapapun\b/gi, "apa pun"],
  [/\bdimana\b/gi, "di mana"],
  [/\bkemana\b/gi, "ke mana"],
  [/\bdari pada\b/gi, "daripada"],
  [/\bkarna\b/gi, "karena"],
];
/**
 * Perapian ejaan yang TIDAK mengubah makna: awalan di- yang terpisah, kata depan yang menempel, singkatan baku, ejaan
 * kata baku (nasehat -> nasihat), spasi ganda dan spasi sebelum tanda baca, kata yang terulang tanpa sengaja. Isi, urutan,
 * nama, angka, dan tanggal tidak disentuh. Idempoten.
 */
function rapikanEjaan(t) {
  let s = teks(t);
  if (!s.trim()) return s;
  s = s.replace(RE_DI_PISAH, (_, d, kata) => `${d}i${kata.toLowerCase()}`);
  s = s.replace(RE_DEPAN_MENEMPEL, (m, a, b, tempat) => (a.toLowerCase() === "d" && b !== "i") || (a.toLowerCase() === "k" && b !== "e") ? m : `${a}${b} ${tempat}`);
  for (const [re, ganti] of SINGKATAN) s = s.replace(re, (m) => (m.charAt(0) === m.charAt(0).toUpperCase() && m.charAt(0) !== m.charAt(0).toLowerCase() ? ganti.charAt(0).toUpperCase() + ganti.slice(1) : ganti));
  s = hapusKataGanda(s);
  return s.replace(/\s{2,}/g, " ").replace(/\s+([,;.:])/g, "$1").replace(/([,;])(?=[A-Za-z])/g, "$1 ");
}

/**
 * Kata yang terulang tanpa sengaja ("saya saya", "itu itu", "para pemohon Pemohon"). Bila salah satunya berhuruf besar (sebutan
 * pihak/nama), yang berhuruf besar yang dipakai. Kata ulang bertanda hubung ("anak-anak") tidak tersentuh.
 */
function hapusKataGanda(t) {
  return teks(t).replace(/\b([A-Za-z]{2,})(\s+)\1\b/gi, (m, a, sp, off, s) => {
    const b = m.slice(a.length + sp.length);
    // "saya saya" / "Pemohon Pemohon": satu kata; yang besar (bila ada) dipertahankan
    return /^[A-Z]/.test(b) ? b : a;
  });
}

// ─── Kerapian kalimat (C2, C4, 12b) ───────────────────────────────────────────

const RE_TANYA_TERBUKA = /^\s*(?:apa(?!kah)\b|bagaimana|di\s*mana|ke\s*mana|siapa|kapan|mengapa|kenapa|berapa|sejak\s+kapan|sebutkan|jelaskan|dengan\s+siapa|dari\s+mana|oleh\s+siapa)/i;
const AWAL_TEMPLAT_BESAR = ["Puncaknya", "Penyebabnya", "Awalnya", "Sejak", "Setelah", "Sekarang", "Yang", "Selama", "Antara", "Pertengkaran", "Perselisihan"];
const RE_BESAR_TENGAH = new RegExp(`((?:\\bsaya|\\bbahwa|,)\\s+)(${AWAL_TEMPLAT_BESAR.join("|")})\\b`, "g");

function rapikanKalimat(jawab, tanya) {
  let s = teks(jawab);
  if (!s.trim()) return s;
  // C2: "Ya," di depan jawaban pertanyaan terbuka
  if (RE_TANYA_TERBUKA.test(teks(tanya))) s = s.replace(/^\s*(?:ya|iya|benar|betul)\s*,\s*/i, "");
  // 12b: "Tidak, " / "Sudah, " / "Belum, " di depan kalimat utuh -> putusan tidak lagi berbunyi "Bahwa tidak, ..."
  const m = /^\s*(tidak|sudah|belum|pernah|tidak pernah)\s*,\s*(.+)$/i.exec(s);
  if (m) {
    const sisa = m[2];
    const kata = sisa.split(/\s+/);
    if (kata.length >= 4 && !/^(?:karena|sebab|tetapi|namun|dan|yang|hanya|cuma|pernah|sekali)\b/i.test(sisa)) s = sisa;
  }
  // C4: huruf besar templat di tengah kalimat ("cerita yang sampai kepada saya Puncaknya ...")
  s = s.replace(RE_BESAR_TENGAH, (_, depan, kata) => `${depan}${kata.charAt(0).toLowerCase()}${kata.slice(1)}`);
  s = hapusKataGanda(s);
  s = s.replace(/^\s*([a-z])/, (x, h) => x.replace(h, h.toUpperCase()));
  return s;
}

// ─── Kelompok pertanyaan cerai ───────────────────────────────────────────────

const K = Object.freeze({
  identitas: /\bkenal\b|\bmaksud\b|hubungan\s+(?:antara|saudara)|suami\s+is?teri|menikah\s+(?:pada|di)|kapan\s+.*menikah|tinggal\s+bersama\s+setelah|setelah\s+menikah|dikaruniai|\banak\b|masih\s+ada\s+(?:yang|keterangan|hal)|disampaikan\s+kepada|menghalangi|halangan|pekerjaan|agama/i,
  kehidupan: /(?:keadaan|kehidupan|kondisi)\s+rumah\s+tangga|bagaimana\s+rumah\s+tangga/i,
  caraTahu: /bagaimana\s+.*\b(?:mengetahui|tahu)\b|dari\s+mana\s+.*\b(?:tahu|mengetahui)\b/i,
  bentuk: /\bbentuk\b.*(?:selisih|tengkar)|(?:selisih|tengkar).*\bseperti\s+apa\b/i,
  lihat: /(?:melihat|mendengar|menyaksikan)\b.*(?:tengkar|selisih|cekcok|ribut)|berapa\s+kali/i,
  puncak: /\bpuncak\b/i,
  penyebab: /penyebab|\bsebab\b|apa\s+(?:yang\s+)?(?:sebenarnya\s+)?(?:menjadi\s+)?masalah|persoalan/i,
  sering: /(?:sering|terus-menerus|terus\s+menerus).*(?:selisih|tengkar)|(?:selisih|tengkar).*(?:sering|terus-menerus|sejak\s+kapan)/i,
  serumah: /masih\s+(?:tinggal\s+)?(?:serumah|bersama|satu\s+rumah)|sejak\s+kapan\s+(?:ber)?pisah|berapa\s+lama\s+(?:ber)?pisah/i,
  pergi: /siapa\s+yang\s+(?:meninggalkan|pergi|keluar)/i,
  komunikasi: /berkomunikasi|saling\s+mengunjungi|ada\s+komunikasi|menjalin\s+komunikasi/i,
  nafkah: /nafkah/i,
  kabar: /memberi\s+kabar|menemui/i,
  keberadaanT: /(?:di\s*mana|keberadaan)\b.*\btinggal\s+sekarang|keberadaan\s+(?:tergugat|termohon)|di\s*mana\s+(?:tergugat|termohon)\s+(?:tinggal|berada)/i,
  upaya: /upaya|dirukunkan|didamaikan|dinasihati|menasihati/i,
  sanggup: /sanggup|masih\s+(?:bisa|dapat)\s+(?:dirukunkan|rukun)|harapan\s+(?:untuk\s+)?rukun/i,
  inginRukun: /mempertahankan|ingin\s+(?:rukun|kembali)|bersedia\s+rukun/i,
});
function kelompokCerai(tanya) {
  const q = teks(tanya);
  if (K.caraTahu.test(q)) return "caraTahu";
  if (K.keberadaanT.test(q)) return "keberadaanT";
  if (K.puncak.test(q)) return "puncak";
  if (K.bentuk.test(q)) return "bentuk";
  if (K.lihat.test(q)) return "lihat";
  if (K.penyebab.test(q) && !/nafkah/i.test(q)) return "penyebab";
  if (K.sering.test(q)) return "sering";
  if (K.kehidupan.test(q)) return "kehidupan";
  if (K.pergi.test(q)) return "pergi";
  if (K.serumah.test(q)) return "serumah";
  if (K.komunikasi.test(q)) return "komunikasi";
  if (K.nafkah.test(q)) return "nafkah";
  if (K.kabar.test(q)) return "kabar";
  if (K.inginRukun.test(q)) return "inginRukun";
  if (K.sanggup.test(q)) return "sanggup";
  if (K.upaya.test(q)) return "upaya";
  if (K.identitas.test(q)) return "identitas";
  return "";
}

// ─── Pengetahuan baru untuk arah Tolak/NO (keputusan 63) ─────────────────────

const MODUS_ARAH = Object.freeze(["tidak-tahu-apa", "sebaliknya"]);
/** Subjek dan objek "apakah X masih memberi nafkah kepada Y" dari bunyi pertanyaan. */
function pihakNafkah(tanya, P, T) {
  const m = /apakah\s+(\S+)\s+(?:masih\s+)?(?:memberi(?:kan)?|menanggung)\s+nafkah\s+(?:kepada\s+)?(\S+?)[?,.\s]/i.exec(`${teks(tanya)} `);
  if (m) return [m[1], m[2]];
  return [T, P];
}

/**
 * Jawaban satu butir untuk pengetahuan "tidak-tahu-apa" / "sebaliknya". null = butir ini tidak disentuh (identitas, pernikahan,
 * anak, penutup, dan hal yang tidak bergantung pada pengetahuan saksi tentang perselisihan).
 */
function jawabArah(o) {
  const { tanya, modus, P, T } = o;
  const kel = kelompokCerai(tanya);
  if (!kel || kel === "identitas") return null;
  const tta = modus === "tidak-tahu-apa";
  const [pemberi, penerima] = pihakNafkah(tanya, P, T);
  const peta = tta
    ? {
        kehidupan: `Saya tidak mengetahui keadaan rumah tangga ${P} dan ${T} secara rinci`,
        sering: `Saya tidak mengetahui adanya perselisihan dan pertengkaran antara ${P} dan ${T}`,
        penyebab: "Saya tidak mengetahui apa yang menjadi penyebabnya",
        bentuk: "Saya tidak mengetahui bentuk perselisihan mereka",
        lihat: `Saya tidak pernah melihat maupun mendengar sendiri ${P} dan ${T} bertengkar`,
        caraTahu: "Saya tidak mengetahui hal itu",
        puncak: "Saya tidak mengetahui adanya kejadian yang menjadi puncak perselisihan mereka",
        serumah: `Saya tidak mengetahui apakah ${P} dan ${T} sudah berpisah tempat tinggal`,
        pergi: "Saya tidak mengetahui siapa yang meninggalkan tempat tinggal bersama",
        komunikasi: "Saya tidak mengetahui hal itu",
        nafkah: `Saya tidak mengetahui apakah ${pemberi} masih memberi nafkah kepada ${penerima}`,
        kabar: "Saya tidak mengetahui hal itu",
        keberadaanT: `Saya tidak mengetahui di mana ${T} tinggal sekarang`,
        upaya: "Saya tidak mengetahui apakah sudah ada upaya dari keluarga untuk merukunkan mereka",
        sanggup: "Saya tidak mengetahui persoalan rumah tangga mereka, sehingga tidak dapat menerangkannya",
        inginRukun: "Saya tidak mengetahui hal itu",
      }
    : {
        kehidupan: `Setahu saya rumah tangga ${P} dan ${T} berjalan baik dan rukun, saya tidak pernah mengetahui ada masalah yang berarti`,
        sering: `Setahu saya antara ${P} dan ${T} tidak sering terjadi perselisihan dan pertengkaran`,
        penyebab: `Setahu saya hal yang disebutkan ${P} itu tidak benar, ${T} tidak berbuat seperti itu`,
        bentuk: "Setahu saya tidak ada pertengkaran di antara mereka, kalaupun ada hanya selisih paham biasa dalam rumah tangga",
        lihat: `Saya tidak pernah melihat maupun mendengar ${P} dan ${T} bertengkar, setahu saya mereka hidup rukun`,
        caraTahu: "Saya mengetahuinya karena sering bertemu dengan mereka",
        puncak: "Setahu saya tidak ada kejadian yang menjadi puncak pertengkaran mereka",
        serumah: `Setahu saya ${P} dan ${T} masih tinggal bersama`,
        pergi: "Setahu saya tidak ada yang pergi meninggalkan tempat tinggal bersama",
        komunikasi: `Setahu saya ${P} dan ${T} masih berkomunikasi dengan baik`,
        nafkah: `Setahu saya ${pemberi} masih memberi nafkah kepada ${penerima}`,
        kabar: `Setahu saya ${T} masih memberi kabar kepada ${P}`,
        keberadaanT: null,
        upaya: "Setahu saya keluarga belum pernah merukunkan mereka karena rumah tangga mereka tidak bermasalah",
        sanggup: "Saya masih sanggup dan yakin mereka masih dapat rukun kembali",
        inginRukun: "Setahu saya keduanya masih ingin mempertahankan rumah tangga mereka",
      };
  // Saksi berikutnya dengan pengetahuan yang sama: bunyi lain yang setara maknanya (dua saksi tidak berbunyi sama persis).
  const ganti = Number(o.ke) % 2 === 1;
  const lain = !ganti
    ? null
    : tta
      ? {
          kehidupan: `Keadaan rumah tangga ${P} dan ${T} tidak saya ketahui dengan jelas`,
          sering: `Setahu saya tidak ada perselisihan di antara ${P} dan ${T}, setidaknya saya tidak pernah mengetahuinya`,
          penyebab: "Apa penyebabnya tidak saya ketahui",
          bentuk: "Bentuk perselisihan itu tidak saya ketahui",
          lihat: `Saya belum pernah menyaksikan ataupun mendengar ${P} dan ${T} bertengkar`,
          caraTahu: "Hal itu tidak saya ketahui",
          puncak: "Saya tidak tahu adanya kejadian yang menjadi puncaknya",
          serumah: `Apakah ${P} dan ${T} sudah tidak serumah, saya tidak mengetahuinya`,
          pergi: "Siapa yang meninggalkan tempat tinggal bersama tidak saya ketahui",
          komunikasi: "Hal itu tidak saya ketahui",
          nafkah: `Soal nafkah dari ${pemberi} kepada ${penerima} saya tidak mengetahuinya`,
          kabar: "Hal itu tidak saya ketahui",
          keberadaanT: `Tempat tinggal ${T} sekarang tidak saya ketahui`,
          upaya: "Ada tidaknya upaya keluarga merukunkan mereka tidak saya ketahui",
          sanggup: "Persoalan rumah tangga mereka tidak saya ketahui, jadi saya tidak dapat menerangkannya",
          inginRukun: "Hal itu tidak saya ketahui",
        }
      : {
          kehidupan: `Sepengetahuan saya rumah tangga ${P} dan ${T} rukun-rukun saja dan tidak ada masalah yang berarti`,
          sering: `Sepengetahuan saya ${P} dan ${T} jarang berselisih, apalagi bertengkar terus-menerus`,
          penyebab: `Sepengetahuan saya ${T} tidak berbuat seperti yang disebutkan ${P}`,
          bentuk: "Sepengetahuan saya tidak ada pertengkaran di antara mereka selain selisih paham biasa",
          lihat: `Saya belum pernah menyaksikan ${P} dan ${T} bertengkar, sepengetahuan saya mereka hidup rukun`,
          caraTahu: "Saya mengetahuinya karena sering bergaul dengan mereka",
          puncak: "Sepengetahuan saya tidak ada kejadian yang menjadi puncak pertengkaran",
          serumah: `Sepengetahuan saya ${P} dan ${T} masih tinggal bersama`,
          pergi: "Sepengetahuan saya tidak ada yang meninggalkan tempat tinggal bersama",
          komunikasi: `Sepengetahuan saya ${P} dan ${T} masih saling berkomunikasi`,
          nafkah: `Sepengetahuan saya ${pemberi} masih memberikan nafkah kepada ${penerima}`,
          kabar: `Sepengetahuan saya ${T} masih berkabar dengan ${P}`,
          keberadaanT: null,
          upaya: "Sepengetahuan saya keluarga belum pernah merukunkan mereka karena rumah tangga mereka baik-baik saja",
          sanggup: "Saya masih sanggup dan yakin mereka dapat rukun kembali",
          inginRukun: "Sepengetahuan saya keduanya masih ingin mempertahankan rumah tangganya",
        };
  const t = lain && lain[kel] !== undefined ? lain[kel] : peta[kel];
  return t ? kalimat(t) : null;
}

// ─── T11 butir 2: pengetahuan "tahu berselisih, tidak tahu sebab" pada butir yang bergantung pada sebab ───────

/** Butir huruf A (kebiasaan buruk) dan D (kekerasan) yang rincinya hanya diketahui saksi yang tahu SEBAB perselisihan. */
const RE_BERGANTUNG_SEBAB = /kebiasaan|kekerasan|bekas\s+luka|kejadian\s+itu|dinasihati\s+agar\s+berhenti/i;

/**
 * Jawaban butir yang bergantung pada sebab untuk saksi yang tahu keduanya berselisih tetapi tidak tahu sebabnya
 * (modus "tidak-tahu"). null = butir ini bukan butir yang bergantung pada sebab. Dua kelompok bunyi (saksi 1 dan 2) dan tiap
 * kelompok bergantian menurut nomor butir - dua saksi tidak pernah berbunyi sama persis pada butir yang sama.
 */
function jawabTidakTahuSebab(o) {
  const { tanya, kel, T, ke, n } = o;
  const q = teks(tanya);
  const penyebab = kel === "penyebab";
  if (!penyebab && !RE_BERGANTUNG_SEBAB.test(q)) return null;
  const hal = /kebiasaan|dinasihati/i.test(q) ? `kebiasaan buruk ${T}` : /kekerasan|bekas\s+luka|kejadian\s+itu/i.test(q) ? "kekerasan tersebut" : "";
  const daftar =
    Number(ke) % 2 === 1
      ? [
          `Apa penyebabnya tidak saya ketahui${hal ? `, begitu pula soal ${hal}` : ""}`,
          `Saya hanya tahu mereka berselisih, tetapi penyebabnya tidak saya ketahui${hal ? `, termasuk soal ${hal}` : ""}`,
          `Penyebab perselisihan mereka tidak saya ketahui${hal ? `, begitu pula ${hal}` : ""}`,
        ]
      : [
          hal ? `Saya tidak mengetahui penyebabnya, jadi soal ${hal} saya tidak tahu` : "Saya tidak mengetahui penyebabnya",
          `Penyebab perselisihan mereka tidak saya ketahui${hal ? `, sehingga soal ${hal} tidak dapat saya terangkan` : ""}`,
          `Saya tidak mengetahui apa penyebabnya${hal ? `, termasuk soal ${hal}` : ""}`,
        ];
  return kalimat(daftar[Number(n) % daftar.length]);
}

// ─── Saksi Tergugat/Termohon dari jawaban & duplik (keputusan 62) ────────────

/** Bantahan dalam naskah jawaban/duplik (bentuk sama dengan keadaan.bantahan katalog cerai-*-tergugat). */
function bacaBantahan(naskah, P, T, opsi) {
  const t = bersihPosita(naskah);
  const bantahan = new Set();
  // T11/3: jawaban LISAN di BAS biasanya lebih pendek daripada surat jawaban e-Court, ambangnya lebih rendah.
  const ambang = opsi && opsi.lisan ? 20 : 40;
  const out = { bantahan, sebab: "", ada: t.length >= ambang, membenarkan: false };
  if (!out.ada) return out;
  const kal = t.split(/(?<=[.;!?])\s+|\s+(?=\d{1,2}\s*[.)]\s+[A-Z])/).map((x) => x.trim()).filter(Boolean);
  const reP = new RegExp(`\\b${P}\\b`, "i");
  for (const k of kal) {
    const tidakBenar = /tidak\s+benar|tidaklah\s+benar|keliru|mengada-ada|tidak\s+sesuai\s+(?:fakta|kenyataan)|membantah|menolak\s+dalil/i.test(k);
    if (/(?:tidak\s+(?:pernah\s+)?(?:ada\s+)?(?:terjadi\s+)?(?:per)?(?:tengkar|selisih|cekcok)|tidak\s+(?:sering|terus-menerus)\s+(?:ber)?(?:tengkar|selisih))/i.test(k) || (tidakBenar && /(?:tengkar|selisih|cekcok)/i.test(k)))
      bantahan.add("tidak-ada-pertengkaran");
    if (/masih\s+(?:ingin|mau|sayang|mencintai|berharap)|mempertahankan\s+rumah\s+tangga|ingin\s+rukun|bersedia\s+rukun|tidak\s+(?:ingin|mau|bersedia)\s+(?:ber)?cerai|keberatan\s+(?:untuk\s+)?(?:ber)?cerai|menolak\s+(?:untuk\s+)?(?:ber)?cerai/i.test(k)) bantahan.add("masih-ingin-rukun");
    if (reP.test(k) && /(?:pergi|meninggalkan|keluar\s+dari)\s+(?:rumah|tempat\s+tinggal|kediaman)/i.test(k) && /(?:tanpa\s+(?:sebab|alasan|izin|pamit)|sendiri|begitu\s+saja|atas\s+kemauan)/i.test(k)) bantahan.add("pengaju-pergi-tanpa-sebab");
    if (/(?:selalu|tetap|masih|rutin)\s+(?:memberi(?:kan)?|mengirim(?:kan)?)\s+nafkah|nafkah\s+(?:selalu|tetap|masih)\s+(?:diberikan|dikirim)/i.test(k) || (tidakBenar && /nafkah/i.test(k))) bantahan.add("nafkah-diberikan");
    if (!out.sebab && /(?:yang\s+benar|sebenarnya|justru|faktanya|yang\s+sesungguhnya)/i.test(k)) {
      const m = /(?:karena|disebabkan\s+(?:oleh|karena)?|sebabnya|akibat)\s+(.{8,220}?)(?:[.;]|$)/i.exec(k);
      if (m) {
        out.sebab = m[1].replace(/[\s,]+$/, "");
        bantahan.add("sebab-lain");
      }
    }
    if (/(?:benar|mengakui|membenarkan)\s+(?:bahwa\s+)?(?:antara\s+)?.{0,40}(?:sering\s+)?(?:ber)?(?:tengkar|selisih|cekcok)/i.test(k) && !tidakBenar) out.membenarkan = true;
  }
  return out;
}

/** Jawaban satu butir saksi Tergugat/Termohon menurut bantahan (null = biarkan titik-titik untuk petugas). */
function jawabSaksiT(kel, b, P, T, ct) {
  const ada = (x) => b.bantahan.has(x);
  switch (kel) {
    case "kehidupan":
      if (ada("tidak-ada-pertengkaran")) return `Setahu saya rumah tangga ${P} dan ${T} berjalan biasa saja dan tidak ada pertengkaran yang terus-menerus`;
      if (b.membenarkan) return `Rumah tangga ${P} dan ${T} memang pernah ada perselisihan`;
      return null;
    case "sering":
      if (ada("tidak-ada-pertengkaran")) return `Setahu saya antara ${P} dan ${T} tidak sering terjadi perselisihan dan pertengkaran`;
      if (b.membenarkan) return `Setahu saya antara ${P} dan ${T} memang pernah terjadi perselisihan`;
      return null;
    case "penyebab":
      if (b.sebab) return `Menurut yang saya ketahui, masalahnya karena ${b.sebab}`;
      return null;
    case "lihat":
      if (ada("tidak-ada-pertengkaran")) return `Saya tidak pernah melihat maupun mendengar ${P} dan ${T} bertengkar hebat`;
      return null;
    case "pergi":
    case "serumah":
      if (ada("pengaju-pergi-tanpa-sebab")) return `Yang meninggalkan tempat tinggal bersama adalah ${P} tanpa sebab yang jelas`;
      return null;
    case "nafkah":
      if (!ct && ada("nafkah-diberikan")) return `Setahu saya ${T} masih memberikan nafkah kepada ${P}`;
      return null;
    case "inginRukun":
      if (ada("masih-ingin-rukun")) return `Setahu saya ${T} masih ingin mempertahankan rumah tangganya dan bersedia rukun kembali dengan ${P}`;
      return null;
    case "sanggup":
      if (ada("masih-ingin-rukun")) return `Saya masih berharap ${P} dan ${T} dapat rukun kembali`;
      return null;
    default:
      return null;
  }
}
/** Kelompok yang pada saksi Tergugat TIDAK boleh berbunyi dalil gugatan (dikembalikan ke kalimat set bila tidak terisi). */
const KELOMPOK_DALIL = new Set(["kehidupan", "sering", "penyebab", "lihat", "bentuk", "puncak", "pergi", "serumah", "nafkah", "upaya", "sanggup", "inginRukun", "caraTahu", "komunikasi", "kabar"]);

// ─── Alamat Tergugat sekarang (A3) ───────────────────────────────────────────

/**
 * Dua alamat SIPP dianggap sama (kediaman bersama) bila kata-katanya hampir sama (selisih huruf besar/kecil, "Kabupaten", spasi ganda).
 * Alamat yang jelas berbeda desa/kecamatan = tempat tinggal lain.
 */
const KATA_ALAMAT_ABAI = new Set(["kabupaten", "kab", "kota", "provinsi", "jalan", "jl", "dusun", "desa", "kelurahan", "kecamatan", "kec", "no", "nomor", "rt", "rw"]);
function samaAlamat(a, b) {
  const kata = (t) => new Set(norm(t).split(" ").filter((k) => k && !KATA_ALAMAT_ABAI.has(k)));
  const x = kata(a);
  const y = kata(b);
  if (!x.size || !y.size) return norm(a) === norm(b);
  let irisan = 0;
  for (const k of x) if (y.has(k)) irisan += 1;
  return irisan / Math.min(x.size, y.size) >= 0.85 && irisan / Math.max(x.size, y.size) >= 0.7;
}


const RE_TAK_DIKETAHUI = /tidak\s+(?:lagi\s+)?(?:diketahui|jelas)\s+(?:lagi\s+)?(?:keberadaannya|alamatnya|tempat\s+tinggalnya|di\s*mana)|\bghaib\b|\bgaib\b|tidak\s+diketahui\s+(?:alamat|keberadaan)/i;
function alamatTergugat(o) {
  const { posita, alamatPihak, T, P } = o;
  const aT = teks(alamatPihak && alamatPihak.pelaku).replace(/\s+/g, " ").trim();
  const aP = teks(alamatPihak && alamatPihak.lawan).replace(/\s+/g, " ").trim();
  if (aT && RE_TAK_DIKETAHUI.test(aT)) return { teks: kalimat(`Sekarang ${T} tidak diketahui keberadaannya`), sumber: "data SIPP", peringatan: "" };
  const p = bersihPosita(posita);
  const reT = new RegExp(`\\b${T}\\b[^.;]{0,120}?${RE_TAK_DIKETAHUI.source}`, "i");
  if (reT.test(p) || new RegExp(`(?:keberadaan|alamat)\\s+${T}[^.;]{0,40}tidak\\s+diketahui`, "i").test(p)) return { teks: kalimat(`Sekarang ${T} tidak diketahui keberadaannya`), sumber: "gugatan", peringatan: "gugatan" };
  // Alamat SIPP Tergugat yang SAMA dengan alamat Penggugat = alamat kediaman bersama di surat gugatan, bukan tempat tinggal sekarang.
  if (aT && !samaAlamat(aT, aP) && !/data_tidak_ada/i.test(aT)) return { teks: kalimat(`Sekarang ${T} tinggal di ${aT}`), sumber: "data SIPP", peringatan: "" };
  // "alamat Tergugat saat ini berada di Kota Makassar" / "Tergugat sekarang tinggal di ..." (posita 627/Pdt.G/2026)
  const kini =
    new RegExp(`alamat\\s+${T}\\s+(?:saat\\s+ini|sekarang|kini)\\s+(?:berada\\s+|adalah\\s+)?di\\s+([A-Z][^.;]{2,90})`).exec(p) ||
    new RegExp(`\\b${T}\\s+(?:saat\\s+ini|sekarang|kini)\\s+(?:tinggal|berada|bertempat\\s+tinggal|berdomisili)\\s+di\\s+([A-Z][^.;]{2,90})`).exec(p);
  if (kini && !new RegExp(`\\b${P}\\b`).test(kini[1])) {
    const tempat = kini[1].replace(/\s+(?:dan|namun|tetapi|sehingga)\s.*$/i, "").replace(/[\s,]+$/, "");
    return { teks: kalimat(`Sekarang ${T} tinggal di ${tempat}`), sumber: "gugatan", peringatan: "gugatan" };
  }
  const m = new RegExp(`\\b${T}\\b[^.;]{0,80}?(?:pergi|pulang|merantau|berangkat|kembali|pamit)\\s+ke\\s+((?:rumah\\s+orang\\s+tua(?:nya)?\\s+(?:di\\s+)?)?[A-Z][A-Za-z]+(?:\\s+[A-Z][A-Za-z]+){0,3})`).exec(p);
  if (m && !new RegExp(`\\b${P}\\b`).test(m[1])) return { teks: kalimat(`Setahu saya ${T} pergi ke ${m[1]} dan sampai sekarang tidak kembali`), sumber: "gugatan", peringatan: "gugatan" };
  return null;
}

// ─── Ragam antar saksi (C1) ──────────────────────────────────────────────────

const SINONIM = [
  [/\bsudah\b/, "telah"],
  [/\btelah\b/, "sudah"],
  [/\btempat tinggal bersama\b/, "kediaman bersama"],
  [/\bkediaman bersama\b/, "tempat tinggal bersama"],
  [/\btidak pernah lagi\b/, "tidak lagi pernah"],
  [/\bnamun\b/, "tetapi"],
  [/\btetapi\b/, "namun"],
  [/\bmenemui\b/, "datang menemui"],
  [/\bberkomunikasi\b/, "saling berkomunikasi"],
  [/\bmengajukan gugatan cerai\b/, "menggugat cerai"],
  [/\bmengajukan permohonan cerai talak\b/, "memohon izin menjatuhkan talak"],
  [/\bsuami isteri yang sah\b/, "pasangan suami isteri yang sah"],
  [/\btidak sanggup lagi\b/, "sudah tidak sanggup"],
  [/\bpernah melihat dan mendengar sendiri\b/, "pernah menyaksikan dan mendengar sendiri"],
  [/\bbeberapa kali\b/, "lebih dari satu kali"],
  [/^Setahu saya\b/, "Sepengetahuan saya"],
  [/^Sepengetahuan saya\b/, "Setahu saya"],
  [/\bsering terjadi\b/, "kerap terjadi"],
  [/\bberpisah tempat tinggal\b/, "pisah tempat tinggal"],
  [/(?<!pergi )\bmeninggalkan\b/, "pergi meninggalkan"],
];
const PEMBUKA = ["Setahu saya, ", "Yang saya ketahui, ", "Sepengetahuan saya, "];
/** Varian kalimat yang setara maknanya untuk saksi berikutnya; null bila tidak ada yang wajar. */
function variasi(jawab, n, sebutan) {
  const s = teks(jawab);
  for (let i = 0; i < SINONIM.length; i += 1) {
    const [re, ganti] = SINONIM[(i + n) % SINONIM.length];
    if (re.test(s)) {
      const v = s.replace(re, ganti);
      if (v !== s) return v;
    }
  }
  if (/^(?:setahu|yang saya ketahui|sepengetahuan|saya\b|tidak\b|belum\b|sudah\b|cukup)/i.test(s)) return null;
  return PEMBUKA[n % PEMBUKA.length] + kecilAwal(s, sebutan);
}

// ─── Keadaan pisah (tinjauan bagian E) ───────────────────────────────────────

/** "1 tahun 7 bulan" / "2 bulan" / "3 tahun" -> jumlah bulan; null bila tidak terbaca. */
function bulanDari(t) {
  const s = teks(t).toLowerCase();
  const th = /(\d+)\s*(?:\(\s*\w+\s*\)\s*)?tahun/.exec(s);
  const bl = /(\d+)\s*(?:\(\s*\w+\s*\)\s*)?bulan/.exec(s);
  if (!th && !bl) return null;
  return (th ? Number(th[1]) * 12 : 0) + (bl ? Number(bl[1]) : 0);
}
/**
 * Keadaan tempat tinggal menurut posita: masih serumah, atau lama pisah (bulan) - dibaca dengan mesin fakta posita yang sama
 * dengan susunan saksi (faktaDariPosita; lama pisah dihitung sampai tanggal sidang bila posita hanya menyebut sejak kapan).
 * @returns {{serumah: boolean, bulan: number|null}}
 */
function keadaanPisah(posita, T, P, tanggalSidang) {
  const p = bersihPosita(posita);
  let f = null;
  try {
    f = require("./abtUsulanService").faktaDariPosita(p, T, P, { tanggalSidang: teks(tanggalSidang) });
  } catch (_galat) {
    f = null;
  }
  const serumah = /masih\s+(?:tinggal\s+)?(?:serumah|satu\s+rumah|bersama\s+dalam\s+satu\s+rumah|tinggal\s+bersama)/i.test(p) && !(f && f.adaPisah);
  const bulan = f && f.adaPisah ? bulanDari(f.lamaPisah) : null;
  return { serumah, bulan };
}

// ─── Penutup ──────────────────────────────────────────────────────────────────

/**
 * @param {object} hasil  hasil susunKeteranganSaksiSdg (sesudah lengkapi) - DIUBAH di tempat
 * @param {object} k
 *   templat [{tanya, jawab}] (bunyi set sebelum diisi), posita, pelaku (= #0047# Tergugat/Termohon), lawan (= #0046#),
 *   jenisPerkara, saksi [{pihak, modus, dasar?}], alamatPihak {lawan, pelaku}, naskahT {jawaban, duplik}
 * @returns {object} hasil
 */
function perbaiki(hasil, k) {
  if (!hasil || hasil.ok === false || !Array.isArray(hasil.saksi)) return hasil;
  const o = k && typeof k === "object" ? k : {};
  const P = teks(o.lawan).trim() || "Penggugat";
  const T = teks(o.pelaku).trim() || "Tergugat";
  const sebutan = [P, T, "Penggugat", "Tergugat", "Pemohon", "Termohon"];
  const jenis = teks(o.jenisPerkara);
  const cerai = jenis === "346" || jenis === "347" || /cerai/i.test(jenis);
  const ct = jenis === "346" || /talak/i.test(jenis) || T === "Termohon";
  const posita = bersihPosita(o.posita);
  const adaPosita = posita.length >= 20;
  const templat = Array.isArray(o.templat) ? o.templat : [];
  const naskahT = o.naskahT && typeof o.naskahT === "object" ? [teks(o.naskahT.jawaban), teks(o.naskahT.duplik)].join("\n") : "";
  // T11/3: urutan sumber naskah Tergugat - (a) jawaban/duplik e-Court atau isian 12020/12024, (b) jawaban/duplik LISAN di BAS
  // (asal "lisan" dari ekstensi), (c) tidak ada: butir tetap titik-titik + catatan di panel.
  const asalNaskah = o.naskahT && typeof o.naskahT === "object" && o.naskahT.asal && typeof o.naskahT.asal === "object" ? o.naskahT.asal : {};
  const hanyaLisan = ["jawaban", "duplik"].every((k) => !teks(o.naskahT && o.naskahT[k]).trim() || asalNaskah[k] === "lisan");
  const bantahan = bacaBantahan(naskahT, P, T, { lisan: hanyaLisan });
  const sumberJawaban = bantahan.ada && hanyaLisan ? `jawaban lisan ${T} (BAS)` : `jawaban ${T}`;
  const ringkas = { gugatan: 0, jawaban: 0, pengetahuan: 0, ejaan: 0, arah: 0, alamat: 0, ragam: 0, saksiT: 0, sebab: 0 };

  hasil.saksi.forEach((s, idx) => {
    const masuk = (Array.isArray(o.saksi) && o.saksi[idx]) || {};
    const modus = teks(masuk.modus || s.modus);
    const pihakT = (s.pihak || masuk.pihak) === "T";
    const dasarJawaban = cerai && pihakT && teks(masuk.dasar) !== "gugatan";
    if (dasarJawaban) ringkas.saksiT += 1;
    (s.jawaban || []).forEach((j, n) => {
      if (!j || typeof j !== "object") return;
      const tanya = teks(j.tanya || (templat[n] && templat[n].tanya));
      const asli = teks(templat[n] && (templat[n].jawab || templat[n].jawaban));
      const kel = cerai ? kelompokCerai(tanya) : "";
      // 62: saksi Tergugat/Termohon - bunyi dalil gugatan tidak dipakai; isi dari jawaban & duplik.
      if (dasarJawaban && KELOMPOK_DALIL.has(kel)) {
        const isi = jawabSaksiT(kel, bantahan, P, T, ct);
        if (isi) {
          j.jawab = kalimat(isi);
          delete j.pilihan;
          j.usulan = { teks: j.jawab, yakin: "ragu", sumber: sumberJawaban, ket: hanyaLisan ? `Disusun dari jawaban/duplik LISAN ${T} yang tercatat di BAS; periksa dengan keterangan saksi.` : `Disusun dari jawaban/duplik ${T}; periksa dengan keterangan saksi.`, peringatan: "jawaban" };
          ringkas.jawaban += 1;
        } else {
          j.jawab = rapikanKalimat(asli || "...", tanya);
          delete j.usulan;
          delete j.saran;
        }
        return;
      }
      // 63: pengetahuan untuk arah Tolak/NO
      if (cerai && MODUS_ARAH.includes(modus)) {
        // U1/6: butir huruf A (kebiasaan buruk) dan D (kekerasan) yang bergantung pada sebab - pola sama dengan T11 jawabTidakTahuSebab.
        const isi = require("./saksiU1").jawabArahSebab({ tanya, modus, P, T, ke: idx, n }) || jawabArah({ tanya, modus, P, T, ke: idx });
        if (isi) {
          j.jawab = isi;
          delete j.pilihan;
          delete j.saran;
          j.usulan = { teks: isi, yakin: "ragu", sumber: "pilihan pengetahuan saksi", ket: modus === "sebaliknya" ? `Keterangan berkebalikan dengan dalil ${P} (pilihan pengetahuan saksi); sesuaikan dengan keterangan saksi.` : "Saksi tidak mengetahui hal ini (pilihan pengetahuan saksi); sesuaikan dengan keterangan saksi." };
          ringkas.arah += 1;
          return;
        }
      }
      // T11/2: modus "tidak-tahu" (tahu berselisih, tidak tahu sebab) - butir yang bergantung pada sebab (huruf A, D, dan butir
      // penyebab) berbunyi konsisten "tidak mengetahui penyebabnya", bukan titik-titik atau bunyi gugatan. Butir lain tidak disentuh.
      if (cerai && modus === "tidak-tahu" && (adaTitik(j.jawab) || (j.usulan && /gugatan|posita/i.test(teks(j.usulan.sumber))))) {
        const isi = jawabTidakTahuSebab({ tanya, kel, T, ke: idx, n });
        if (isi) {
          j.jawab = isi;
          delete j.pilihan;
          delete j.saran;
          j.usulan = { teks: isi, yakin: "cukup", sumber: "pilihan pengetahuan saksi", ket: "Saksi tahu keduanya berselisih tetapi tidak tahu sebabnya (pilihan pengetahuan saksi); sesuaikan dengan keterangan saksi." };
          ringkas.sebab += 1;
          return;
        }
      }
      // A3: alamat Tergugat/Termohon sekarang - bukan kediaman bersama
      if (cerai && kel === "keberadaanT" && !MODUS_ARAH.includes(modus)) {
        const kediaman = /tinggal\s+di\s+(?:rumah\s+orang\s+tua|rumah\s+kediaman\s+bersama|kediaman\s+bersama|tempat\s+tinggal\s+bersama)/i.test(teks(j.jawab));
        if (kediaman || /\s\/\s/.test(teks(j.jawab))) {
          const al = alamatTergugat({ posita, alamatPihak: o.alamatPihak, T, P });
          if (al) {
            j.jawab = al.teks;
            delete j.pilihan;
            j.usulan = { teks: al.teks, yakin: al.sumber === "data SIPP" ? "cukup" : "ragu", sumber: al.sumber, ket: al.sumber === "data SIPP" ? `Alamat ${T} menurut data SIPP.` : `Dibaca dari gugatan; periksa dengan keterangan saksi.` };
            if (al.peringatan) j.usulan.peringatan = al.peringatan;
          } else {
            // Datanya tidak ada: kembali ke bunyi set ("tinggal di ... / tidak diketahui keberadaannya") sebagai dua pilihan.
            j.jawab = asli || `Sekarang ${T} tinggal di ...;`;
            delete j.usulan;
            if (/\s\/\s/.test(j.jawab)) j.pilihan = [`Sekarang ${T} tinggal di ...;`, `Sekarang ${T} tidak diketahui keberadaannya;`];
          }
          ringkas.alamat += 1;
        }
      }
      // B4: bentuk pertengkaran bagi saksi yang tidak menyaksikan sendiri
      if (cerai && kel === "bentuk" && /^(?:dari-cerita|tidak-melihat|ragu|tahu-pisah)$/.test(modus) && !RE_PENGETAHUAN_NEGATIF.test(teks(j.jawab))) {
        const isi = kecilAwal(teks(j.jawab).replace(/[;.\s]+$/, ""), sebutan);
        const sumber = teks(masuk.sumberNama) || P;
        j.jawab =
          modus === "tahu-pisah"
            ? "Saya tidak mengetahui bentuk pertengkaran mereka karena saya tidak pernah mengetahui mereka bertengkar;"
            : modus === "ragu"
              ? kalimat(`Seingat saya ${isi}, tetapi saya kurang yakin`)
              : modus === "dari-cerita"
                ? kalimat(`Menurut cerita ${sumber}, ${isi}`)
                : kalimat(`Saya tidak menyaksikannya sendiri, menurut cerita yang saya dengar ${isi}`);
        if (j.usulan) j.usulan.teks = j.jawab;
      }
      // B4/C7: saksi yang tidak menyaksikan sendiri tidak pernah berkata "saya melihat/menyaksikan sendiri" (butir huruf
      // KDRT/kebiasaan pihak, butir set yang bukan pertanyaan perselisihan).
      if (cerai && /^(?:dari-cerita|tidak-melihat|ragu|tahu-pisah)$/.test(modus) && /\bsaya\s+(?:pernah\s+)?(?:melihat|menyaksikan)(?:nya)?\s+sendiri\b|\b(?:saya\s+)?lihat\s+sendiri\b/i.test(teks(j.jawab)) && !RE_PENGETAHUAN_NEGATIF.test(teks(j.jawab))) {
        const sumber = modus === "dari-cerita" ? teks(masuk.sumberNama) || P : "orang lain";
        j.jawab =
          modus === "tahu-pisah"
            ? "Saya tidak mengetahui hal itu;"
            : modus === "ragu"
              ? "Saya kurang ingat apakah saya melihatnya sendiri;"
              : kalimat(`Saya tidak melihatnya sendiri, saya mengetahuinya dari cerita ${sumber}`);
        delete j.pilihan;
        if (j.usulan) j.usulan.teks = j.jawab;
      }
      // Kontradiktoir: "pernah mendengar Tergugat membantah atau membenarkan ...?" tidak dijawab dengan kalimat menyaksikan pertengkaran.
      if (cerai && /membantah|membenarkan/i.test(tanya) && !/membantah|membenarkan|mengakui|menyangkal/i.test(teks(j.jawab))) {
        j.jawab = asli || "...";
        delete j.usulan;
        delete j.saran;
      }
      // 61: tanda peringatan
      const u = j.usulan && typeof j.usulan === "object" ? j.usulan : null;
      const dariGugatan = adaPosita && ((u && /gugatan|posita/i.test(teks(u.sumber))) || j.saran === true);
      if (u && !adaPosita && /gugatan/i.test(teks(u.sumber))) {
        // Tanpa posita, titik-titik yang hilang diganti kalimat umum (mis. "beberapa kali") - bukan dari gugatan.
        u.sumber = "kalimat contoh";
        u.ket = "Titik-titik diganti kalimat umum, bukan dari data perkara. Sesuaikan dengan keterangan saksi.";
      }
      if (dariGugatan) {
        const sebelum = teks(j.jawab);
        const rapi = rapikanEjaan(sebelum);
        if (rapi !== sebelum) {
          j.jawab = rapi;
          ringkas.ejaan += 1;
        }
        tandai(j, "gugatan", { sumber: (u && u.sumber) || "gugatan", ket: (u && u.ket) || "Disusun dari gugatan perkara ini; periksa dengan keterangan saksi." });
        ringkas.gugatan += 1;
      }
      if (cerai && !pihakT && MODUS_LANGSUNG.has(modus || "sama") && RE_PENGETAHUAN.test(teks(j.jawab)) && !RE_PENGETAHUAN_NEGATIF.test(teks(j.jawab)) && !j.belumTerisi) {
        tandai(j, "pengetahuan", { sumber: (j.usulan && j.usulan.sumber) || "kalimat contoh", ket: (j.usulan && j.usulan.ket) || PERINGATAN.pengetahuan });
        ringkas.pengetahuan += 1;
      }
      // C2/C3/C4/12b
      if (!j.belumTerisi) {
        const r = rapikanKalimat(j.jawab, tanya);
        if (r !== j.jawab) j.jawab = r;
      }
      if (j.usulan) j.usulan.teks = j.jawab;
    });
  });

  // C1: saksi berikutnya (pihak yang sama) tidak berbunyi sama persis dengan saksi sebelumnya
  const dipakai = new Map();
  hasil.saksi.forEach((s, idx) => {
    (s.jawaban || []).forEach((j, n) => {
      if (!j || j.belumTerisi || adaTitik(j.jawab)) return;
      const kunci = `${s.pihak || "P"}|${n}`;
      const lalu = dipakai.get(kunci) || new Set();
      const a = norm(j.jawab);
      if (lalu.has(a) && !/^(?:sudah cukup|cukup|tidak ada)/i.test(teks(j.jawab))) {
        const v = variasi(j.jawab, idx + n, sebutan);
        if (v && !lalu.has(norm(v))) {
          j.jawab = v;
          if (j.usulan) j.usulan.teks = v;
          ringkas.ragam += 1;
        }
      }
      lalu.add(norm(j.jawab));
      dipakai.set(kunci, lalu);
    });
  });

  // Keputusan pengguna 1 Nov (lanjutan): upaya damai keluarga = PILIHAN "sudah" / "belum", tinggal dipilih di panel (bawaan "sudah",
  // juga pada arah Tolak/NO "tidak tahu"; "keterangan sebaliknya" bawaan "belum" karena saksinya menerangkan rumah tangga baik).
  if (cerai) {
    hasil.saksi.forEach((s, idx) => {
      const masuk = (Array.isArray(o.saksi) && o.saksi[idx]) || {};
      if ((s.pihak || masuk.pihak) === "T") return;
      const modus = teks(masuk.modus || s.modus);
      (s.jawaban || []).forEach((j) => {
        if (!j || j.belumTerisi || !/upaya/i.test(teks(j.tanya)) || !/rukun|damai/i.test(teks(j.tanya))) return;
        const kini = teks(j.jawab);
        const genap = idx % 2 === 0;
        const dariData = !MODUS_ARAH.includes(modus) && /dirukunkan|didamaikan|merukunkan|mendamaikan|dinasihati/i.test(kini) && !/belum|tidak (?:tahu|mengetahui)/i.test(kini) && !adaTitik(kini);
        const sudah = dariData ? kini : kalimat(genap ? `Keluarga sudah berupaya merukunkan ${P} dan ${T}, tetapi tidak berhasil` : `Pihak keluarga pernah mencoba merukunkan ${P} dan ${T}, namun tidak berhasil`);
        const belum =
          modus === "sebaliknya" && kini && !adaTitik(kini)
            ? kini
            : kalimat(genap ? `Setahu saya keluarga belum pernah berupaya merukunkan ${P} dan ${T}` : `Sepengetahuan saya belum ada upaya keluarga untuk merukunkan ${P} dan ${T}`);
        const bawaan = modus === "sebaliknya" ? "belum" : "sudah";
        j.pilihanJawab = [
          { kunci: "sudah", label: "Sudah ada upaya keluarga", jawab: sudah },
          { kunci: "belum", label: "Belum ada upaya keluarga", jawab: belum },
        ];
        j.jawab = bawaan === "sudah" ? sudah : belum;
        delete j.pilihan;
        if (j.usulan) j.usulan.teks = j.jawab;
        else j.usulan = { teks: j.jawab, yakin: "cukup", sumber: "pilihan upaya keluarga", ket: "Pilih sudah/belum menurut keterangan saksi." };
      });
    });
  }

  // U1 (1 Nov, lanjutan audit kekurangan saksi): hubungan saksi, kesaksian murni, huruf A/B/H dari posita - lihat saksiU1.js.
  if (cerai) {
    try {
      ringkas.u1 = require("./saksiU1").terapkan(hasil, { ...o, P, T, cerai, ct, templat, bantahan, naskahTeks: naskahT, sumberJawaban, hanyaLisan });
    } catch (galatU1) {
      hasil.u1Gagal = String((galatU1 && galatU1.message) || galatU1).slice(0, 200);
    }
  }

  const polos = (x) => (x ? (x.jawaban || []).map(({ no, tanya, jawab }) => ({ no, tanya, jawab })) : []);
  hasil.saksi1 = polos(hasil.saksi[0]);
  hasil.saksi2 = polos(hasil.saksi[1]);
  // titik-titik yang belum diisi (bunyi set yang sama) bukan kalimat kembar - petugas mengisinya dari keterangan masing-masing saksi
  hasil.identik = hasil.saksi1.filter((b, i) => hasil.saksi2[i] && b.jawab === hasil.saksi2[i].jawab && !/^(sudah|cukup|tidak ada)/i.test(b.jawab) && !adaTitik(b.jawab)).length;
  hasil.perbaikan1Nov = ringkas;
  // Tinjauan bagian E (1 Nov): keadaan pisah dari posita -> set tambahan yang dipasang draf sendiri + peringatan pembuktian.
  if (cerai && adaPosita) {
    const kp = keadaanPisah(posita, T, P, o.tanggalSidang);
    const saran = [];
    const peringatan = [];
    if (kp.serumah) {
      saran.push("tambah-serumah");
      peringatan.push(`Menurut gugatan ${P} dan ${T} masih tinggal serumah; syarat pisah tempat tinggal 6 bulan (SEMA 1/2022 jo. SEMA 3/2023) belum terpenuhi kecuali ada kekerasan dalam rumah tangga.`);
    } else if (kp.bulan !== null && kp.bulan < 6) {
      saran.push("tambah-pisah-kurang");
      peringatan.push(`Menurut gugatan ${P} dan ${T} baru berpisah sekitar ${kp.bulan} bulan (kurang dari 6 bulan, SEMA 1/2022 jo. SEMA 3/2023); periksa ada tidaknya kekerasan dalam rumah tangga.`);
    }
    if (saran.length) hasil.saranSet = saran;
    if (peringatan.length) hasil.peringatanPembuktian = peringatan;
  }
  if (ringkas.saksiT && !bantahan.ada) {
    hasil.catatan = `${teks(hasil.catatan)} Jawaban ${T} belum ada (jawaban dan duplik e-Court maupun jawaban lisan di BAS tidak terbaca) - isi dari keterangan saksi atau pilih 'Ikut membenarkan gugatan ${P}'. Butir keterangan saksi ${T} dibiarkan bertitik-titik.`.trim();
    hasil.jawabanTBelumAda = true;
  }
  return hasil;
}

module.exports = { samaAlamat, jawabTidakTahuSebab, perbaiki, keadaanPisah, bulanDari, rapikanEjaan, hapusKataGanda, rapikanKalimat, jawabArah, bacaBantahan, jawabSaksiT, alamatTergugat, kelompokCerai, variasi, PERINGATAN, MODUS_ARAH };
