/**
 * ============================================================================
 * DETEKSI EKSEPSI DAN REKONVENSI DARI JAWABAN / DUPLIK TERGUGAT (butir 4, 6 Okt 2026)
 * ============================================================================
 *
 * Diminta pengguna: "tambahkan fitur penanda di agenda deteksi rekonvensi dan
 * eksepsi dengan membaca isi dari jawaban dan duplik tergugat/termohon".
 *
 * Sumbernya dokumen e-Court yang diunggah pihak Tergugat/Termohon (jenis
 * Jawaban atau Duplik) dan sudah ditarik ALETA Bot ke arsipnya. SIPP sendiri
 * tidak menyimpan isi jawaban; tabel perkara_rekonvensi-nya ada tetapi hampir
 * tidak pernah diisi (10 baris sejak 2015 di satker, 0 pada 2026).
 *
 * ============================================================================
 * MENYEBUT BUKAN MENGAJUKAN
 * ============================================================================
 *
 * Kata "eksepsi" muncul juga pada jawaban yang TIDAK berisi eksepsi:
 * "Tergugat tidak mengajukan eksepsi", "tanggapan atas eksepsi Penggugat"
 * (eksepsi milik pihak lain, dalam duplik), "Dalam Eksepsi: nihil". Karena itu
 * tiap kemunculan dinilai, dan hasilnya tiga, bukan dua:
 *
 *   "ada"    diajukan - judul bagian "DALAM EKSEPSI"/"DALAM REKONVENSI",
 *            petitum "Mengabulkan eksepsi Tergugat", sebutan pihak
 *            "Penggugat Rekonvensi", "gugatan balik", "mengajukan eksepsi";
 *   "tidak"  disangkal tegas - "tidak mengajukan eksepsi", "tanpa
 *            rekonvensi", "Dalam Eksepsi: nihil" - dan tidak ada bukti kuat
 *            sebaliknya;
 *   ""       tidak disebut sama sekali.
 *
 * Bukti dibagi dua tingkat. KUAT (petitum, sebutan pihak rekonvensi,
 * "mengajukan ...", eksepsi bernama: kompetensi, obscuur libel, error in
 * persona, ...) mengalahkan penyangkalan; SEDANG (judul bagian, judul dokumen,
 * kata yang berdiri sendiri) kalah oleh penyangkalan, sebab "DALAM EKSEPSI"
 * yang diikuti "Tergugat tidak mengajukan eksepsi" adalah bentuk yang lazim.
 *
 * Teks yang TIDAK TERBACA (pindaian tanpa OCR, berkas rusak) tidak dinilai di
 * sini sama sekali - pemanggil mencatatnya "tidak terbaca", dan layar diam.
 * Tidak terbaca BUKAN "tidak ada".
 *
 * Pengenalnya diukur atas 23 dokumen jawaban/duplik Tergugat sungguhan di
 * arsip satker (6 Okt 2026) - lihat src/test/deteksi-eksepsi-rekonvensi.test.ts.
 */

/** Naikkan bila aturan berubah: bot lalu membaca ulang dokumen yang dinilai versi lama. */
export const VERSI_DETEKSI_JAWABAN = 1;

export type KeadaanTemuan = "ada" | "tidak" | "";

export type Temuan = {
  keadaan: KeadaanTemuan;
  /** Kalimat pemicunya (dipangkas), untuk title penanda. Kosong bila keadaan "". */
  kalimat: string;
  /** "kuat" | "sedang" | "negasi" | "" - tingkat bukti yang menentukan. */
  tingkat: "kuat" | "sedang" | "negasi" | "";
};

export type HasilDeteksiJawaban = { eksepsi: Temuan; rekonvensi: Temuan };

const KOSONG: Temuan = { keadaan: "", kalimat: "", tingkat: "" };

// ---------------------------------------------------------------------------
// Kata kunci beserta salah eja yang SUNGGUH ada di arsip: "rekonpensi",
// "rekonpesi", "rekopensi", "Rekonvesi" (satu dokumen memuat keempatnya).
// ---------------------------------------------------------------------------
const EKSEPSI = String.raw`(?:eksepsi|eksepsie|ekseptie|exc?eptie|exeptie|exceptio)`;
const REKON = String.raw`(?:reko?n?[vpf]e?n?s[iy]|reconventi[eo])`;
const KATA = { eksepsi: EKSEPSI, rekonvensi: `(?:${REKON}|gugat(?:an)?\\s+balik)` } as const;

type Jenis = keyof typeof KATA;

/** Teks mentah -> satu jalur mengalir (untuk kalimat) dan baris (untuk judul bagian). */
export function rapikanTeks(teks: string): { alir: string; baris: string[] } {
  const bersih = String(teks ?? "")
    .replace(/­/g, "")
    .replace(/[   \t]/g, " ")
    .replace(/\r\n?/g, "\n");
  const baris = bersih
    .split("\n")
    .map((b) => b.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  // Kata yang dipenggal di ujung baris PDF ("rekon-\nvensi") disambung.
  const alir = baris.join("\n").replace(/(\p{L})-\n(\p{Ll})/gu, "$1$2").replace(/\n/g, " ");
  return { alir, baris };
}

/** Kalimat yang memuat posisi `i` di `alir`, dipangkas supaya muat di title. */
function kalimatDi(alir: string, mulai: number, akhir: number): string {
  const kiri = Math.max(
    alir.lastIndexOf(". ", mulai),
    alir.lastIndexOf("; ", mulai),
    alir.lastIndexOf("! ", mulai),
    alir.lastIndexOf("? ", mulai)
  );
  const cariKanan = [". ", "; ", "! ", "? "]
    .map((t) => alir.indexOf(t, akhir))
    .filter((x) => x >= 0);
  const kanan = cariKanan.length ? Math.min(...cariKanan) + 1 : alir.length;
  let a = kiri >= 0 ? kiri + 2 : 0;
  let b = kanan;
  // Paling banyak ~110 huruf di kiri dan kanan kata pemicunya.
  if (mulai - a > 110) a = alir.indexOf(" ", mulai - 110) + 1 || mulai - 110;
  if (b - akhir > 110) b = alir.lastIndexOf(" ", akhir + 110) > akhir ? alir.lastIndexOf(" ", akhir + 110) : akhir + 110;
  const isi = alir.slice(a, b).replace(/[-–—_]{3,}/g, " ").replace(/\s+/g, " ").trim();
  return `${a > 0 && !/[.;!?]\s$/.test(alir.slice(Math.max(0, a - 2), a)) ? "…" : ""}${isi}${b < alir.length && !/[.;!?]$/.test(isi) ? "…" : ""}`;
}

// ---------------------------------------------------------------------------
// PENYANGKALAN
// ---------------------------------------------------------------------------
//
// Penyangkal + (kata bantu) + kata kerja pengajuan + (pengisi) + kata kunci,
// dan daftar yang menyambung ("tidak mengajukan eksepsi maupun gugatan
// rekonvensi" menyangkal keduanya). Sengaja SEMPIT: "dalil yang tidak berdasar
// sebagaimana dalam eksepsi" bukan penyangkalan eksepsi.
const PENYANGKAL = String.raw`(?:tidak|tanpa|belum|tak)`;
const BANTU = String.raw`(?:(?:akan|pernah|perlu|hendak|bermaksud|mau|ingin|juga|lagi)\s+)*`;
const AJU = String.raw`(?:mengajukan|ajukan|diajukan|memajukan|menyampaikan|disampaikan|menggunakan\s+hak(?:nya)?(?:\s+untuk\s+mengajukan)?|ada(?:nya)?|terdapat|membuat|berisi|memuat)`;
const ISI = String.raw`(?:(?:suatu|sebuah|apapun|apa\s+pun|pula|gugatan|bantahan\s+berupa|jawaban\s+berupa|hal)\s+)*`;
const KUNCI_APAPUN = `(?:${EKSEPSI}|${REKON}|gugat(?:an)?\\s+balik)`;
const SAMBUNG = String.raw`(?:\s*(?:,|dan|maupun|atau|serta|ataupun|dan\/atau)\s*(?:(?:gugatan|suatu)\s+)*${KUNCI_APAPUN})*`;

function polaNegasi(): RegExp[] {
  return [
    new RegExp(`\\b${PENYANGKAL}\\s+${BANTU}(?:${AJU}\\s+)?${ISI}${KUNCI_APAPUN}${SAMBUNG}`, "giu"),
    // "Dalam Eksepsi : nihil / tidak ada / -"
    new RegExp(`${KUNCI_APAPUN}\\s*[:\\-–—]\\s*(?:nihil|tidak\\s+ada|kosong|-)(?=\\s|[.;,]|$)`, "giu"),
  ];
}

// ---------------------------------------------------------------------------
// BUKTI KUAT DAN SEDANG
// ---------------------------------------------------------------------------
const PIHAK_SENDIRI = String.raw`(?:tergugat|termohon|para\s+tergugat|para\s+termohon)`;
const PIHAK = String.raw`(?:penggugat|tergugat|pemohon|termohon|pelawan|terlawan)`;

const KUAT: Record<Jenis, RegExp[]> = {
  eksepsi: [
    // Petitum dan permohonan.
    new RegExp(`\\b(?:mengabulkan|menerima)\\s+(?:seluruh\\s+)?${EKSEPSI}\\s+${PIHAK_SENDIRI}`, "iu"),
    // "mengajukan Eksepsi dan Jawaban", "mengajukan eksepsi sebagai berikut".
    new RegExp(`\\b(?:mengajukan|menyampaikan|memajukan)\\s+(?:\\S+\\s+){0,2}?${EKSEPSI}\\b`, "iu"),
    // Eksepsi milik Tergugat sendiri, dalam duplik: "tanggapan atas eksepsi Tergugat".
    new RegExp(`\\b${EKSEPSI}\\s+(?:dari\\s+)?${PIHAK_SENDIRI}\\b`, "iu"),
    // Eksepsi bernama.
    new RegExp(
      `\\b${EKSEPSI}\\s+(?:tentang\\s+|mengenai\\s+)?(?:kompetensi|kewenangan|obs?cuu?r|kabur|error\\s+in\\s+persona|diskualifikasi|plurium|nebis|ne\\s+bis|gugatan\\s+(?:kabur|prematur|kurang)|prematur|daluwarsa|kadaluwarsa|kurang\\s+pihak|salah\\s+pihak|litis)`,
      "iu"
    ),
  ],
  // Urutannya urutan KALIMAT yang ditampilkan: yang paling menerangkan dulu.
  rekonvensi: [
    new RegExp(`\\bmengabulkan\\s+(?:seluruh\\s+)?gugatan\\s+(?:penggugat\\s+)?${REKON}`, "iu"),
    new RegExp(`\\b(?:mengajukan|menyampaikan|memajukan)\\s+(?:\\S+\\s+){0,3}?(?:${REKON}|gugat(?:an)?\\s+balik)\\b`, "iu"),
    // "gugatan balik", "gugatan rekonvensi".
    new RegExp(`\\bgugat(?:an)?\\s+(?:balik|${REKON})\\b`, "iu"),
    // Sebutan pihak: "Penggugat Rekonvensi", "Tergugat dalam Rekonvensi",
    // "Konvensi/Penggugat Rekonvensi".
    new RegExp(`\\b${PIHAK}\\s+(?:dalam\\s+)?${REKON}\\b`, "iu"),
  ],
};

/** Judul bagian pada barisnya sendiri: "DALAM EKSEPSI", "A. Dalam Eksepsi", "II. DALAM REKONVENSI;". */
function polaJudulBagian(jenis: Jenis): RegExp {
  const kata = jenis === "eksepsi" ? EKSEPSI : REKON;
  return new RegExp(
    `^(?:[A-Z]|[IVX]{1,4}|\\d{1,2})?[.)]?\\s*(?:dalam|tentang|pada|bagian)?\\s*(?:pokok\\s+perkara\\s+)?${kata}\\s*[:;.]?$`,
    "iu"
  );
}

/** Kemunculan kata kunci yang berpemilik pihak LAIN ("eksepsi Penggugat") - bukan bukti. */
function milikPihakLain(alir: string, akhir: number): boolean {
  return /^\s+(?:dari\s+)?(?:penggugat|pemohon)\b(?!\s+(?:dalam\s+)?(?:rekon|recon))/iu.test(alir.slice(akhir, akhir + 40));
}

type Rentang = [number, number];

function dalam(r: Rentang[], i: number) {
  return r.some(([a, b]) => i >= a && i < b);
}

function nilaiSatu(jenis: Jenis, alir: string, baris: string[], judul: string, negasi: Rentang[]): Temuan {
  const kataRe = new RegExp(KATA[jenis], "giu");

  // 1. KUAT - di luar rentang penyangkalan.
  for (const pola of KUAT[jenis]) {
    const g = new RegExp(pola.source, "giu");
    for (const m of alir.matchAll(g)) {
      const i = m.index ?? 0;
      // Kata kuncinya sendiri harus di luar rentang penyangkalan.
      kataRe.lastIndex = i;
      const k = kataRe.exec(alir);
      const posKata = k && k.index < i + m[0].length ? k.index : i;
      if (dalam(negasi, posKata)) continue;
      return { keadaan: "ada", kalimat: kalimatDi(alir, i, i + m[0].length), tingkat: "kuat" };
    }
  }

  // 2. PENYANGKALAN yang menyebut jenis ini.
  for (const [a, b] of negasi) {
    if (new RegExp(KATA[jenis], "iu").test(alir.slice(a, b))) {
      return { keadaan: "tidak", kalimat: kalimatDi(alir, a, b), tingkat: "negasi" };
    }
  }

  // 3. SEDANG - judul bagian, judul dokumen, kata yang berdiri sendiri (bukan milik Penggugat).
  const judulBagian = polaJudulBagian(jenis);
  const bagian = baris.find((b) => judulBagian.test(b));
  if (bagian) return { keadaan: "ada", kalimat: bagian, tingkat: "sedang" };
  if (judul && new RegExp(KATA[jenis], "iu").test(judul)) {
    return { keadaan: "ada", kalimat: `judul dokumen: ${judul}`, tingkat: "sedang" };
  }
  for (const m of alir.matchAll(new RegExp(`\\b${KATA[jenis]}\\b`, "giu"))) {
    const i = m.index ?? 0;
    if (dalam(negasi, i) || milikPihakLain(alir, i + m[0].length)) continue;
    return { keadaan: "ada", kalimat: kalimatDi(alir, i, i + m[0].length), tingkat: "sedang" };
  }
  return KOSONG;
}

/**
 * Menilai satu dokumen jawaban/duplik Tergugat. `judul` = judul dokumen
 * e-Court (ikut dinilai sebagai bukti sedang). Teks kosong tetap boleh
 * dinilai atas judulnya saja; pemanggil yang membedakan "tidak terbaca".
 */
export function deteksiEksepsiRekonvensi(teks: string, judul = ""): HasilDeteksiJawaban {
  const { alir, baris } = rapikanTeks(teks);
  const negasi: Rentang[] = [];
  for (const pola of polaNegasi()) {
    for (const m of alir.matchAll(pola)) negasi.push([m.index ?? 0, (m.index ?? 0) + m[0].length]);
  }
  const j = String(judul ?? "").replace(/\s+/g, " ").trim();
  return {
    eksepsi: nilaiSatu("eksepsi", alir, baris, j, negasi),
    rekonvensi: nilaiSatu("rekonvensi", alir, baris, j, negasi),
  };
}

/**
 * Teks cukup terbaca untuk dinilai? Pindaian yang lolos tanpa OCR menghasilkan
 * beberapa huruf sisa ("  \n  ", nomor halaman) - itu TIDAK TERBACA, bukan
 * jawaban yang tidak menyebut eksepsi.
 */
export function teksTerbaca(teks: string): boolean {
  const huruf = String(teks ?? "").match(/\p{L}/gu);
  return (huruf?.length ?? 0) >= 200;
}
