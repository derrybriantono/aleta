/**
 * ============================================================================
 * SUSUNAN ISIAN SATU BLANGKO DERRY (TAHAP F "PERLU DIISI") - MURNI
 * ============================================================================
 *
 * Masukan: penanda #NNNN# yang ada di berkas RTF blangko (dibaca bot lewat
 * blangko.baca) dan katalog variabel ABT (abt_variabel: nama, data_type,
 * sql_query, default_data). Keluaran: isian TANGAN SUNGGUHAN blangko itu -
 * data_teks / data_tanggal / tanya_jawab - termasuk yang tidak tertulis
 * langsung di RTF tetapi dibaca variabel lain (mis. #4001# AMAR membaca #8503#
 * alasan perceraian lewat kueri), isian berpemicu (#11111# kuasa, #11112#
 * prodeo, #11116# alasan C, #11117# alasan H), label bahasa mudah, pilihan
 * dan saran, serta pasangan tanya jawab per saksi.
 *
 * Tidak ada jaringan di sini; rute yang memanggilnya menyediakan katalog dari
 * bot (abt.semuaVariabel) atau salinan kamus ALETA.
 */

export type Definisi = { kode: string; nama: string; jenis: string; sql: string; bawaan: string };
export type JenisIsian = "teks" | "tanggal" | "tj";
export type ButirIsian = {
  kode: string;
  /** Label bahasa mudah untuk layar; nama ABT tidak diubah (namaAsli). */
  nama: string;
  namaAsli: string;
  jenis: JenisIsian;
  /** Kode pemicu (11111 ...) bila isian hanya berlaku ketika pemicunya menyala; "" bila selalu. */
  pemicu: string;
  /** false = isian pilihan ("kosong = dari SIPP", penanda teknis) - tidak dihitung "perlu diisi". */
  wajib: boolean;
  /** Tertulis langsung di RTF (true) atau hanya dibaca variabel lain (false). */
  langsung: boolean;
  bawaan: string;
  pilihan: string[];
  saran: string;
  /** Variabel otomatis yang membaca isian ini - "ikut mengubah N bagian". */
  dipakaiOleh: string[];
  khusus: "" | "bukti";
  pihak: "" | "P" | "T";
  /**
   * Keadaan perkara yang membuat isian ini berlaku ("" = selalu). Kuasa/prodeo/alasan C-H dinilai lewat pemicu
   * ABT (#11111# dst.); ghaib dan e-Court dari data perkara SIPP di ekstensi; kuasa insidentil hanya bila
   * isiannya tertulis langsung di blangko atau sudah terisi.
   */
  keadaan: Keadaan;
  /** "penting" = masuk naskah/amar/pertimbangan; "tambahan" = berbawaan atau keterangan tambahan (pengingat cetak). */
  tingkat: "penting" | "tambahan";
  /** Pilihan bernilai (mis. 7139: "1"/"2") - layar menampilkan label, ABT menyimpan nilai. */
  opsi: Array<{ nilai: string; label: string }>;
  tj: null | { kunci: string; sebutan: string; peran: "tanyajawab" | "keterangan"; kodeSunting: string };
};
export type Keadaan = "" | "kuasaP" | "kuasaT" | "prodeo" | "alasanC" | "alasanH" | "ghaib" | "ecourt" | "insidentil";
export type Susunan = {
  penanda: string[];
  isian: ButirIsian[];
  pemicu: Array<{ kode: string; nama: string; keterangan: string }>;
  otomatis: Array<{ kode: string; nama: string; jenis: string; langsung: boolean }>;
  takDikenal: string[];
};

const MANUAL: Record<string, JenisIsian> = { data_teks: "teks", data_tanggal: "tanggal", tanya_jawab: "tj" };
const POLA_REF = /#(\d{4,5})#/g;
const POLA_NO_VAR = /no_var\s*(?:=|in\s*\()\s*['"]?(\d{4,5})/gi;
const POLA_PEMICU = /#(111\d\d)#/;

/** Urutan tampil isian perceraian (dari rancangan v12); yang tidak disebut mengikuti urutan di RTF. */
const URUTAN = [
  "8503", "5227", "0222", "7035", "0246", "9944", "1268", "0007", "1006", "1267", "7139", "8433", "7178", "8436", "8437", "8536", "0227",
  "0156", "8537", "8538", "0184", "0132", "8892", "0157", "0185", "0661", "0663", "8564", "0670", "0182", "8894", "8895", "8896", "9123", "0303",
];

export const PILIHAN_ALASAN = [
  "F · terus-menerus berselisih dan bertengkar",
  "A · zina, mabuk, judi dan F",
  "B · meninggalkan 2 tahun berturut-turut dan F",
  "C · dihukum penjara 5 tahun atau lebih",
  "D · kekejaman atau penganiayaan dan F",
  "H · murtad (beralih agama)",
];

/**
 * Label bahasa mudah + pilihan + saran. Nama di ABT tetap; ini hanya tampilan. {P}/{T} diganti sebutan pihak
 * perkara (Penggugat/Pemohon, Tergugat/Termohon). opsi = pilihan bernilai: layar menampilkan label, ABT menyimpan nilai.
 */
const RAMAH: Record<string, { nm: string; pil?: string[]; saran?: string; opsi?: Array<{ nilai: string; label: string }> }> = {
  "8503": { nm: "Alasan perceraian", pil: PILIHAN_ALASAN, saran: PILIHAN_ALASAN[0] },
  "5227": { nm: "Rincian alasan cerai (sesuai gugatan)" },
  "0222": { nm: "Awal perselisihan", pil: ["awal tahun 2024", "tahun 2023", "akhir tahun 2024"] },
  "7035": { nm: "Yang meninggalkan rumah bersama", pil: ["Tergugat", "Penggugat"] },
  "0246": { nm: "Pisah rumah sejak", pil: ["bulan Januari 2025", "awal tahun 2025", "akhir tahun 2024"] },
  "9944": { nm: "Lama pisah rumah" },
  "1268": {
    nm: "Upaya damai oleh keluarga",
    pil: ["pihak keluarga telah berusaha mendamaikan Penggugat dan Tergugat, namun tidak berhasil", "belum pernah didamaikan oleh pihak keluarga"],
  },
  "0007": { nm: "Anak dari pernikahan ini", saran: "belum dikaruniai anak" },
  "1006": { nm: "Tempat tinggal setelah menikah", saran: "di rumah orang tua Penggugat" },
  "1267": { nm: "Masih berkomunikasi atau tidak", pil: ["sudah tidak berkomunikasi", "masih berkomunikasi"] },
  "7139": {
    nm: "Beracara secara elektronik",
    opsi: [
      { nilai: "1", label: "Sepakat beracara secara elektronik" },
      { nilai: "2", label: "Tidak sepakat beracara secara elektronik" },
    ],
  },
  "8536": { nm: "Putusan pidana {T} (nomor, tanggal, lama hukuman)" },
  "0227": { nm: "Tanggal {T} berpindah agama" },
  "0156": { nm: "Nama kantor advokat {P}" },
  "8537": { nm: "Nama advokat {P}" },
  "8538": { nm: "Alamat kantor advokat {P}" },
  "8539": { nm: "Nomor register surat kuasa {P}" },
  "0132": { nm: "Tanggal register surat kuasa {P} di kepaniteraan" },
  "0184": { nm: "Tanggal surat kuasa {P}" },
  "8892": { nm: "Pengadilan Tinggi tempat advokat {P} disumpah", saran: "Pengadilan Tinggi Sulawesi Tengah" },
  "0157": { nm: "Nama kantor advokat {T}" },
  "0185": { nm: "Tanggal surat kuasa {T}" },
  "0661": { nm: "Nomor penetapan prodeo" },
  "0663": { nm: "Tanggal penetapan prodeo" },
  "8564": { nm: "Tanggal pengumuman panggilan ghaib pertama dan kedua", saran: "22 Januari 2026 dan 24 Februari 2026" },
  "0670": { nm: "Media pengumuman panggilan ghaib", saran: "siaran RRI Pro 1 Palu 90,8 FM" },
  "8436": { nm: "Kesimpulan {P}", saran: "tetap pada gugatan semula untuk bercerai dengan Tergugat" },
  "8437": { nm: "Kesimpulan {T}" },
  "8433": { nm: "Alasan pencabutan perkara" },
  "7178": { nm: "Alasan panggilan dianggap tidak patut" },
  "0182": { nm: "Tanggal izin kuasa insidentil" },
  "0183": { nm: "Tanggal izin kuasa insidentil {T}" },
  "8894": { nm: "Nama penerima kuasa insidentil" },
  "8895": { nm: "Hubungan penerima kuasa dengan {P}" },
  "8896": { nm: "Nomor izin Ketua Pengadilan" },
  "9120": { nm: "Panggilan ulang karena kuasa insidentil tidak sah" },
  "9123": { nm: "Sebab kuasa insidentil tidak sah (huruf a sampai d)" },
  "9125": { nm: "Keadaan kuasa insidentil tidak sah" },
  "0303": { nm: "Tanggal pengumuman" },
  "1214": { nm: "Alat bukti surat {P}" },
  "9911": { nm: "Alat bukti surat {T}" },
  "1154": { nm: "Nomor surat permintaan bantuan panggilan" },
  "1232": { nm: "Tanggal surat" },
  "5230": { nm: "Ongkos panggilan permintaan bantuan" },
  "8712": { nm: "Nomor dan tanggal surat teguran panitera" },
  "8713": { nm: "Batas waktu menambah panjar" },
  "8714": { nm: "Nomor dan tanggal laporan panjar tidak ditambah" },
  "8729": { nm: "Penilaian keterangan saksi dan fakta yang tidak terbukti" },
  "8899": { nm: "Pokok kesepakatan perdamaian sebagian" },
  "8901": { nm: "Amar kesepakatan perdamaian sebagian (satu butir per baris)" },
  "8902": { nm: "Isi pasal kesepakatan perdamaian sebagian" },
};

const PEMICU_TEKS: Record<string, string> = {
  "11111": "Penggugat/Pemohon memakai kuasa hukum (terbaca dari SIPP)",
  "11113": "Tergugat/Termohon memakai kuasa hukum (terbaca dari SIPP)",
  "11112": "perkara ini prodeo (terbaca dari SIPP)",
  "11116": "alasan perceraian huruf C dipilih",
  "11117": "alasan perceraian huruf H dipilih",
};

/** Keterangan keadaan untuk layar ("muncul karena ..." dan daftar isian yang disembunyikan). */
export const KEADAAN_TEKS: Record<Exclude<Keadaan, "">, string> = {
  kuasaP: "Penggugat/Pemohon memakai kuasa hukum",
  kuasaT: "Tergugat/Termohon memakai kuasa hukum",
  prodeo: "perkara ini prodeo",
  alasanC: "alasan perceraian huruf C dipilih",
  alasanH: "alasan perceraian huruf H dipilih",
  ghaib: "Tergugat/Termohon dipanggil secara ghaib",
  ecourt: "perkara ini terdaftar lewat e-Court",
  insidentil: "ada kuasa insidentil",
};

const BUKTI_KODE: Record<string, "P" | "T"> = { "1214": "P", "9911": "T" };

/** Pemicu ABT per keadaan - nilainya dihitung mesin variabel ABT untuk perkara itu. */
const PEMICU_KEADAAN: Record<string, Keadaan> = { "11111": "kuasaP", "11113": "kuasaT", "11112": "prodeo", "11116": "alasanC", "11117": "alasanH" };
const KEADAAN_PEMICU: Partial<Record<Keadaan, string>> = Object.fromEntries(Object.entries(PEMICU_KEADAAN).map(([k, v]) => [v, k]));

/**
 * Keadaan sebuah isian tangan dari namanya di katalog ABT. Nama ABT memang menuliskan syaratnya:
 * "Tgl. Surat Kuasa #0047# (Isi Apabila #0047# Pakai Kuasa)", "TANGGAL PENGUMUMAN PANGGILAN GHAIB ...",
 * "NO KUASA INSIDENTIL: ...", "SEPAKAT BERACARA SECARA ELEKTRONIK". Penanda #111xx# di nama didahulukan.
 */
export function keadaanIsian(namaPolos: string): Keadaan {
  const n = String(namaPolos || "");
  const pem = (n.match(POLA_PEMICU) || [])[1] || "";
  if (pem && PEMICU_KEADAAN[pem]) return PEMICU_KEADAAN[pem];
  if (/insidentil/i.test(n)) return "insidentil";
  if (/prodeo|pembebasan biaya/i.test(n)) return "prodeo";
  if (/ghaib|gaib/i.test(n)) return "ghaib";
  if (/beracara secara elektronik|e-?litigasi|e-?court/i.test(n)) return "ecourt";
  if (/\b(kuasa|advokat|pengacara)\b/i.test(n)) {
    const pihakT = /#0047#|tergugat|termohon/i.test(n);
    const pihakP = /#0046#|penggugat|pemohon/i.test(n);
    return pihakT && !pihakP ? "kuasaT" : "kuasaP";
  }
  return "";
}

/** Isian yang hanya keterangan tambahan (tidak masuk amar/pertimbangan) - pengingat cetak menyebutnya "tidak wajib". */
const TAMBAHAN = new Set(["8436", "8437"]);
const POLA_BAGIAN_PENTING = /amar|pertimbangan|duduk perkara|petitum|mengadili|menimbang|menetapkan/i;
const POLA_BERBAWAAN = /kosong\s*=|bila sipp tidak memuat|bila ada\b|jika ada\b|opsional/i;

export const SEBUTAN_BAWAAN = { P: "Penggugat/Pemohon", T: "Tergugat/Termohon", gugatan: "gugatan/permohonan" };

function polosHtml(s: string): string {
  return String(s || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Nama ABT -> bahasa mudah: tag dan #111xx# dibuang, sebutan pihak diganti, keterangan dalam kurung disingkat. */
const SINGKATAN = new Set(["SIPP", "ABT", "KTP", "KTP-EL", "NIK", "KK", "PNS", "PPPK", "TNI", "POLRI", "BUMN", "BUMD", "KUA", "RBG", "SEMA", "PERMA", "PA", "PN", "SK", "HP", "WA", "RT", "RW", "I", "II", "III", "IV"]);
/** Nama yang (hampir) seluruhnya huruf kapital -> huruf biasa; singkatan dan #NNNN# dibiarkan. */
function hurufBiasa(t: string): string {
  const huruf = t.replace(/#\d{4,5}#/g, "").replace(/[^A-Za-z]/g, "");
  if (huruf.length < 6) return t;
  const kapital = huruf.replace(/[^A-Z]/g, "").length;
  if (kapital / huruf.length < 0.7) return t;
  const hasil = t.replace(/[A-Za-z][A-Za-z-]*/g, (w) => (SINGKATAN.has(w.toUpperCase()) ? w.toUpperCase() : w.toLowerCase()));
  return hasil.charAt(0).toUpperCase() + hasil.slice(1);
}

export function rapikanNama(nama: string, sebutan: { P: string; T: string; gugatan?: string } = SEBUTAN_BAWAAN): string {
  let t = hurufBiasa(
    polosHtml(nama)
      .replace(/#111\d\d#/g, "")
      // Contoh, petunjuk bawaan dan syarat pengisian hanya memanjangkan label (syaratnya kini diterapkan sendiri).
      .replace(/\s*\((contoh|mis\.?|misal|kosong\s*=|isi apabila|isi bila|bawaan)[^)]*\)/gi, "")
      .replace(/\s+-\s+isian\b.*$/i, "")
      .replace(/,?\s*contoh\s*:.*$/i, "")
      .replace(/^no kuasa insidentil\s*:\s*/i, "")
  )
    .replace(/#0046#/g, sebutan.P)
    .replace(/#0047#/g, sebutan.T)
    .replace(/#0053#/g, sebutan.gugatan || SEBUTAN_BAWAAN.gugatan)
    .replace(/\s+/g, " ")
    .trim();
  // Petunjuk pengisian sesudah titik dua ("Awal Konflik : bulan _ / tahun _") dan keterangan panjang dalam
  // kurung hanya memanjangkan label.
  const sebelumTitikDua = t.split(/\s*:\s/)[0].trim();
  if (sebelumTitikDua.length >= 8 && sebelumTitikDua.length < t.length) t = sebelumTitikDua;
  if (t.length > 60) {
    const inti = t.split(/\s\(/)[0].trim();
    if (inti.length >= 8) t = inti;
  }
  if (t.length > 1 && t === t.toUpperCase() && /[A-Z]{3}/.test(t)) {
    t = t.charAt(0) + t.slice(1).toLowerCase();
  }
  return t.replace(/[\s:_-]+$/, "").trim();
}

/** Kode yang dirujuk sebuah definisi (lewat #NNNN# di kueri/bawaan dan no_var = 'NNNN' di kueri). */
export function rujukan(d: Definisi): string[] {
  const teks = `${d.sql || ""}\n${d.bawaan || ""}`;
  const out = new Set<string>();
  for (const m of teks.matchAll(POLA_REF)) if (m[1] !== d.kode) out.add(m[1]);
  for (const m of teks.matchAll(POLA_NO_VAR)) if (m[1] !== d.kode) out.add(m[1]);
  return [...out];
}

/**
 * Kunci pasangan tanya jawab: "TanyaJwb Saksi 1 P" dan "Keterangan Saksi 1 P" -> "saksi 1 p".
 * Yang berawalan "Keterangan" = daftar butir (dicetak di putusan); selainnya ("TanyaJwb ...", "Jawaban Lisan
 * Tergugat", "Replik Lisan ...") = penyunting tanya jawab ABT.
 */
export function kunciTanyaJawab(nama: string): { kunci: string; peran: "tanyajawab" | "keterangan"; sebutan: string } {
  const p = polosHtml(nama);
  const keterangan = /^keterangan\b/i.test(p);
  const sisa = p.replace(/^(tanya\s*jwb|tanya\s*jawab|keterangan)\s*/i, "").trim();
  const kunci = sisa.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return { kunci, peran: keterangan ? "keterangan" : "tanyajawab", sebutan: sebutSaksi(sisa) };
}

function sebutSaksi(sisa: string): string {
  const m = sisa.match(/^Saksi\s*(\d+)\s*([PT])\b/i);
  if (m) return `Saksi ${m[1]} ${m[2].toUpperCase() === "P" ? "Penggugat" : "Tergugat"}`;
  return sisa;
}

function pihakBuktiDari(k: string, namaPolos: string): "" | "P" | "T" {
  return BUKTI_KODE[k] || (/^alat-alat bukti/i.test(namaPolos) ? "P" : /pembuktian tergugat/i.test(namaPolos) ? "T" : "");
}

function urutanKode(b: ButirIsian, urutanRtf: Map<string, number>): number {
  if (b.khusus === "bukti") return 9000 + (b.pihak === "T" ? 1 : 0);
  if (b.jenis === "tj") return 9500 + (urutanRtf.get(b.kode) ?? 400);
  const u = URUTAN.indexOf(b.kode);
  if (u >= 0) return u;
  return 100 + (urutanRtf.get(b.kode) ?? 400) + (b.langsung ? 0 : 300);
}

/**
 * Menyusun isian tangan dari penanda RTF x katalog.
 *
 * @param penanda  kode #NNNN# yang ada di RTF, urutan kemunculan
 * @param katalog  definisi per kode (sebanyak mungkin; yang tidak ada dicatat takDikenal)
 */
export function susunIsian(
  penanda: string[],
  katalog: Map<string, Definisi>,
  sebutan: { P: string; T: string; gugatan?: string } = SEBUTAN_BAWAAN
): Susunan {
  const urutanRtf = new Map<string, number>();
  penanda.forEach((k, i) => {
    if (!urutanRtf.has(k)) urutanRtf.set(k, i);
  });
  const dipakaiOleh = new Map<string, Set<string>>();
  const dilihat = new Set<string>();
  const takDikenal: string[] = [];
  const otomatis: Susunan["otomatis"] = [];
  const manual: string[] = [];
  const tumpuk = [...new Set(penanda)];
  while (tumpuk.length) {
    const k = tumpuk.shift() as string;
    if (dilihat.has(k)) continue;
    dilihat.add(k);
    const d = katalog.get(k);
    if (!d) {
      if (!/^111\d\d$/.test(k)) takDikenal.push(k);
      continue;
    }
    if (MANUAL[d.jenis]) {
      manual.push(k);
      continue;
    }
    otomatis.push({ kode: k, nama: rapikanNama(d.nama, sebutan), jenis: d.jenis || "", langsung: urutanRtf.has(k) });
    for (const r of rujukan(d)) {
      if (!dipakaiOleh.has(r)) dipakaiOleh.set(r, new Set());
      dipakaiOleh.get(r)!.add(k);
      if (!dilihat.has(r)) tumpuk.push(r);
    }
  }

  // Penyunting tanya jawab: kode "TanyaJwb ..." untuk tiap kunci saksi/pihak (dicari di seluruh katalog).
  const penyunting = new Map<string, string>();
  for (const d of katalog.values()) {
    if (d.jenis !== "tanya_jawab") continue;
    const t = kunciTanyaJawab(d.nama);
    if (t.peran === "tanyajawab" && t.kunci && !penyunting.has(t.kunci)) penyunting.set(t.kunci, d.kode);
  }

  /** Dibaca (sampai 3 lapis) oleh bagian yang tertulis langsung di naskah atau bagian amar/pertimbangan/duduk perkara? */
  const pemakaiPenting = (kode: string): boolean => {
    let lapis = [kode];
    const lewat = new Set<string>([kode]);
    for (let i = 0; i < 3 && lapis.length; i++) {
      const berikut: string[] = [];
      for (const x of lapis) {
        for (const o of dipakaiOleh.get(x) || []) {
          if (lewat.has(o)) continue;
          lewat.add(o);
          if (urutanRtf.has(o) || POLA_BAGIAN_PENTING.test(katalog.get(o)?.nama || "")) return true;
          berikut.push(o);
        }
      }
      lapis = berikut;
    }
    return false;
  };
  const pemicuDipakai = new Map<string, string>();
  const isian: ButirIsian[] = [];
  const tjAda = new Set<string>();
  for (const k of manual) {
    const d = katalog.get(k) as Definisi;
    const jenis = MANUAL[d.jenis];
    const namaPolos = polosHtml(d.nama);
    const pem = (namaPolos.match(POLA_PEMICU) || [])[1] || "";
    if (pem) pemicuDipakai.set(pem, katalog.get(pem)?.nama || "");
    const teknis = /^penanda\b/i.test(namaPolos);
    const pilihanSipp = /kosong\s*=\s*dari\s*sipp/i.test(namaPolos) || /\(otomatis/i.test(namaPolos);
    // Keadaan dari nama: kuasa/prodeo/alasan C-H memakai pemicu ABT yang sama walau namanya tidak bertanda #111xx#.
    const keadaan = keadaanIsian(namaPolos);
    const pemKeadaan = KEADAAN_PEMICU[keadaan] || "";
    let pemicuAkhir = pem;
    if (!pemicuAkhir && pemKeadaan && katalog.has(pemKeadaan)) {
      pemicuAkhir = pemKeadaan;
      pemicuDipakai.set(pemKeadaan, katalog.get(pemKeadaan)?.nama || "");
    }
    const r = RAMAH[k];
    const isiSebutan = (x: string) => x.replace(/\{P\}/g, sebutan.P).replace(/\{T\}/g, sebutan.T);
    const bawaanLiteral = d.bawaan && !/#\d{4,5}#/.test(d.bawaan) ? d.bawaan.trim() : "";
    let tj: ButirIsian["tj"] = null;
    if (jenis === "tj") {
      const t = kunciTanyaJawab(d.nama);
      const kodeSunting = t.peran === "tanyajawab" ? k : penyunting.get(t.kunci) || "";
      // Satu tombol per saksi: pasangan Keterangan/TanyaJwb saksi yang sama tidak diulang.
      if (tjAda.has(t.kunci)) {
        continue;
      }
      tjAda.add(t.kunci);
      tj = { kunci: t.kunci, sebutan: t.sebutan, peran: t.peran, kodeSunting };
    }
    const pihakBukti = pihakBuktiDari(k, namaPolos);
    const pemakai = [...(dipakaiOleh.get(k) || [])];
    // Penting: tertulis langsung di naskah, atau dibaca bagian yang tertulis langsung / amar / pertimbangan / duduk
    // perkara. Tambahan: berbawaan ("kosong = ...", "bila SIPP tidak memuat") atau keterangan tambahan (kesimpulan).
    const tingkat: ButirIsian["tingkat"] =
      jenis === "tj" || pihakBukti
        ? "penting"
        : TAMBAHAN.has(k) || POLA_BERBAWAAN.test(namaPolos)
          ? "tambahan"
          : urutanRtf.has(k) || pemakaiPenting(k)
            ? "penting"
            : "tambahan";
    isian.push({
      kode: k,
      nama: r ? isiSebutan(r.nm) : rapikanNama(d.nama, sebutan),
      namaAsli: namaPolos,
      jenis,
      pemicu: pemicuAkhir,
      wajib: !teknis && !pilihanSipp,
      langsung: urutanRtf.has(k),
      bawaan: d.bawaan || "",
      pilihan: (r && r.pil) || [],
      saran: (r && r.saran) || bawaanLiteral,
      dipakaiOleh: pemakai.sort(),
      khusus: pihakBukti ? "bukti" : "",
      pihak: pihakBukti,
      tj,
      keadaan,
      tingkat,
      opsi: (r && r.opsi) || [],
    });
  }
  isian.sort((a, b) => urutanKode(a, urutanRtf) - urutanKode(b, urutanRtf) || a.kode.localeCompare(b.kode));

  const pemicu = [...pemicuDipakai.entries()].map(([kode, nama]) => ({
    kode,
    nama: rapikanNama(nama || `Penanda ${kode}`, sebutan),
    keterangan: PEMICU_TEKS[kode] || rapikanNama(nama || "", sebutan).toLowerCase() || `penanda ${kode} menyala`,
  }));
  pemicu.sort((a, b) => a.kode.localeCompare(b.kode));
  otomatis.sort((a, b) => Number(a.langsung) - Number(b.langsung) || (urutanRtf.get(a.kode) ?? 999) - (urutanRtf.get(b.kode) ?? 999));
  return { penanda: [...new Set(penanda)], isian, pemicu, otomatis, takDikenal };
}

/** Jenis dokumen sebuah folder Derry menurut namanya: put (hakim), bas (PP), rel (juru sita), ptsp. */
export function jenisFolderDerry(nama: string): "put" | "bas" | "rel" | "ptsp" | "" {
  const n = String(nama || "").trim();
  if (!n) return "";
  if (/^relaas/i.test(n)) return "rel";
  if (/^ptsp/i.test(n)) return "ptsp";
  if (/^(alur\s*\d|bas\b|-\s*bas)/i.test(n)) return "bas";
  return "put";
}

/** Sebutan pihak dari jenis/nomor perkara: Pdt.P dan cerai talak = Pemohon/Termohon. */
export function sebutanPihak(jenisPerkara: string, nomorPerkara: string): { P: string; T: string; gugatan: string } {
  const j = String(jenisPerkara || "").toLowerCase();
  const permohonan = /pdt\.p/i.test(String(nomorPerkara || "")) || /cerai talak|permohonan|itsbat|dispensasi|perwalian|asal usul|ahli waris|poligami|pengangkatan/.test(j);
  return permohonan ? { P: "Pemohon", T: "Termohon", gugatan: "permohonan" } : { P: "Penggugat", T: "Tergugat", gugatan: "gugatan" };
}

/** Folder Derry yang berkasnya paling cocok dengan daftar berkas satu kelompok ABT. */
export function folderPalingCocok(
  berkasKelompok: string[],
  folder: Array<{ nama: string; berkas: string[] }>
): { nama: string; cocok: number } | null {
  const bersih = (s: string) => String(s || "").replace(/\.(rtf|docx?|odt)$/i, "").trim().toLowerCase();
  const diminta = new Set(berkasKelompok.map(bersih).filter(Boolean));
  if (!diminta.size) return null;
  let terbaik: { nama: string; cocok: number } | null = null;
  for (const f of folder) {
    const ada = new Set(f.berkas.map(bersih));
    let cocok = 0;
    for (const b of diminta) if (ada.has(b)) cocok += 1;
    if (cocok > 0 && (!terbaik || cocok > terbaik.cocok)) terbaik = { nama: f.nama, cocok };
  }
  return terbaik;
}
