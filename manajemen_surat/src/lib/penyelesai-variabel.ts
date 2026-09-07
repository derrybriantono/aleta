/**
 * Penyelesai bertingkat (Tahap 2 - Kemandirian Blangko).
 *
 * ============================================================================
 * VARIABEL MEMANGGIL VARIABEL
 * ============================================================================
 *
 * Kesulitan sesungguhnya bukan pada jumlah variabelnya, melainkan pada
 * persarangan. Nama dan kueri sebuah variabel boleh memuat variabel lain, dan
 * itu terjadi pada 178 dari 466 kueri ABT:
 *
 *   #0046#  -> "Penggugat"                          (dasar)
 *   #0100#  -> "Pekerjaan #0046#"                   (satu lapis)
 *   #2027#  -> case when "#1033#" like "%binti%" or "#0102#" like "%binti%"
 *   #5174#  -> case when "#0163#" like "%ruang%" then "#0163# #8008#" else "#0163#"
 *
 * Perakit yang mengganti penanda satu kali jalan tidak akan pernah cukup. Yang
 * dibutuhkan penyelesaian berlapis: yang dasar dahulu, baru yang bergantung
 * padanya - dengan PENDETEKSI LINGKARAN, supaya dua variabel yang saling
 * menunjuk berhenti dengan sebab yang jelas dan bukan berputar selamanya.
 *
 * ============================================================================
 * YANG TIDAK DAPAT DISELESAIKAN DIBIARKAN SEBAGAI PENANDA
 * ============================================================================
 *
 * Aturan yang sama dengan seluruh ALETA: penanda yang masih terlihat jauh
 * lebih baik daripada kalimat yang tampak benar tetapi keliru. Variabel yang
 * bergantung pada variabel yang gagal ikut gagal - ia TIDAK diselesaikan
 * dengan bagian yang kosong.
 */

/** Pola penanda ABT. */
const POLA_PENANDA = /#(\d{3,5})#/g;

export type DefinisiSelesai = {
  noVar: string;
  nama: string;
  jenis: string;
  sqlQuery: string;
  dataTabel: string;
  dataKolom: string;
  kelas: "A" | "B" | "C";
  bersarang: string[];
};

export type UrutanPenyelesaian = {
  /** Urutan aman: tiap variabel muncul sesudah seluruh yang disebutnya. */
  urutan: string[];
  /** Variabel yang terlibat lingkaran - tidak dapat diselesaikan sama sekali. */
  lingkaran: string[];
  /** Variabel yang disebut tetapi tidak ada definisinya di kamus. */
  takDikenal: string[];
};

/**
 * Menyusun urutan penyelesaian dengan algoritma Kahn.
 *
 * Variabel yang tersisa sesudah antreannya habis adalah yang terkurung dalam
 * lingkaran - dan ia disebutkan satu per satu, bukan dilaporkan sebagai
 * "gagal" tanpa keterangan. Yang menelusuri kelak harus tahu variabel mana.
 */
export function urutanPenyelesaian(kamus: Map<string, DefinisiSelesai>): UrutanPenyelesaian {
  const takDikenal = new Set<string>();
  const sisaDerajat = new Map<string, number>();
  const penunggu = new Map<string, string[]>();

  for (const [noVar, def] of kamus) {
    const gantung = def.bersarang.filter((x) => {
      if (kamus.has(x)) return true;
      takDikenal.add(x);
      return false;
    });
    sisaDerajat.set(noVar, gantung.length);
    for (const g of gantung) {
      const daftar = penunggu.get(g) ?? [];
      daftar.push(noVar);
      penunggu.set(g, daftar);
    }
  }

  // Diurutkan supaya hasilnya ajek dari satu jalan ke jalan berikutnya - urutan
  // yang berubah-ubah membuat selisih antar dua penyusunan mustahil dibaca.
  const antre = [...sisaDerajat.entries()]
    .filter(([, n]) => n === 0)
    .map(([k]) => k)
    .sort();

  const urutan: string[] = [];
  while (antre.length > 0) {
    const noVar = antre.shift() as string;
    urutan.push(noVar);
    for (const penunggunya of penunggu.get(noVar) ?? []) {
      const sisa = (sisaDerajat.get(penunggunya) ?? 0) - 1;
      sisaDerajat.set(penunggunya, sisa);
      if (sisa === 0) {
        antre.push(penunggunya);
        antre.sort();
      }
    }
  }

  const lingkaran = [...sisaDerajat.entries()]
    .filter(([noVar, n]) => n > 0 && !urutan.includes(noVar))
    .map(([k]) => k)
    .sort();

  return { urutan, lingkaran, takDikenal: [...takDikenal].sort() };
}

/**
 * Menyandikan sebuah nilai untuk disisipkan ke dalam petikan SQL.
 *
 * ABT membungkus penanda bersarang di dalam tanda kutip ganda - `"#0015#"` -
 * sehingga nilai yang memuat tanda kutip akan MEMBOBOL petikan itu dan sisa
 * kalimatnya terbaca sebagai SQL. Nilainya memang berasal dari SIPP dan bukan
 * dari pengguna, tetapi jarak antara "berasal dari basis data sendiri" dan
 * "aman disambung ke dalam kueri" adalah jarak yang tidak pernah pantas
 * ditempuh dengan anggapan.
 */
export function sandikanUntukSql(nilai: string): string {
  return String(nilai ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'")
    .replace(/[\0\n\r\x1a]/g, " ")
    .slice(0, 500);
}

export type HasilSisip = {
  teks: string;
  /** Penanda yang tidak ada nilainya - sebabnya penyelesaian ini belum utuh. */
  tersisa: string[];
};

/**
 * Menyisipkan nilai ke dalam teks atau kueri.
 *
 * `untukSql` menyalakan penyandian petikan. Untuk naskah biasa penyandian itu
 * justru merusak - naskah tidak boleh memuat tanda miring balik yang tidak
 * pernah diketik siapa pun.
 */
export function sisipkanPenanda(
  teks: string,
  nilai: Map<string, string>,
  opsi: { untukSql?: boolean } = {}
): HasilSisip {
  const tersisa = new Set<string>();
  const hasil = String(teks ?? "").replace(POLA_PENANDA, (utuh, noVar: string) => {
    const isi = nilai.get(noVar);
    if (isi === undefined) {
      tersisa.add(noVar);
      return utuh;
    }
    return opsi.untukSql ? sandikanUntukSql(isi) : isi;
  });
  return { teks: hasil, tersisa: [...tersisa].sort() };
}

/** Penanda yang disebut sebuah teks. */
export function penandaDalam(teks: string): string[] {
  return [...new Set([...String(teks ?? "").matchAll(POLA_PENANDA)].map((c) => c[1]))].sort();
}

// ============================================================================
// Fungsi tanggal dan angka - Kelas A yang tidak menyentuh basis data sama sekali
// ============================================================================

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const BULAN_HIJRIAH = [
  "", "Muharram", "Safar", "Rabiul Awwal", "Rabiul Akhir", "Jumadil Awwal",
  "Jumadil Akhir", "Rajab", "Syaban", "Ramadhan", "Syawal", "Zulkaidah", "Zulhijjah",
];

/**
 * Membaca tanggal sebagai UTC, bukan waktu setempat.
 *
 * SIPP mengirim tengah malam UTC. Ditafsirkan sebagai waktu setempat, tanggal
 * itu mundur sehari di mesin sebelah barat - dan tanggal sidang yang mundur
 * sehari pada naskah resmi adalah sidang yang tercatat pada hari yang salah.
 */
function bacaTanggal(nilai: unknown): Date | null {
  const t = String(nilai ?? "").trim();
  if (!t) return null;
  const hanyaTanggal = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (hanyaTanggal) {
    const d = new Date(Date.UTC(Number(hanyaTanggal[1]), Number(hanyaTanggal[2]) - 1, Number(hanyaTanggal[3])));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "02 September 2026". Kosong bila tanggalnya tidak terbaca - tidak ditebak. */
export function tanggalPanjang(nilai: unknown): string {
  const d = bacaTanggal(nilai);
  if (!d) return "";
  return `${String(d.getUTCDate()).padStart(2, "0")} ${BULAN[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "Rabu". Kosong bila tanggalnya tidak terbaca. */
export function namaHari(nilai: unknown): string {
  const d = bacaTanggal(nilai);
  if (!d) return "";
  return HARI[d.getUTCDay()];
}

/** Hari Julian dari tanggal Masehi - dasar pengalihan ke Hijriah. */
function hariJulian(tahun: number, bulan: number, tanggal: number): number {
  const a = Math.floor((14 - bulan) / 12);
  const y = tahun + 4800 - a;
  const m = bulan + 12 * a - 3;
  return (
    tanggal +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

/**
 * Tanggal Hijriah menurut penanggalan tabular.
 *
 * Dicocokkan dengan penetapan sungguhan PA Donggala, yang berbunyi
 * "hari Jumat tanggal 04 September 2026 Masehi bertepatan dengan tanggal
 * 21 Rabiul Awwal 1448 Hijriah" - dan algoritma ini menghasilkan tepat itu.
 *
 * Penanggalan tabular tidak sama dengan rukyat; yang dipakai naskah pengadilan
 * memang yang tabular, sebagaimana dipakai ABT.
 */
export function keHijriah(nilai: unknown): { tahun: number; bulan: number; tanggal: number } | null {
  const d = bacaTanggal(nilai);
  if (!d) return null;

  let l = hariJulian(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()) - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j =
    Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) +
    Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l =
    l -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29;
  const bulan = Math.floor((24 * l) / 709);
  const tanggal = l - Math.floor((709 * bulan) / 24);
  const tahun = 30 * n + j - 30;

  if (bulan < 1 || bulan > 12) return null;
  return { tahun, bulan, tanggal };
}

/** "21 Rabiul Awwal 1448". Kosong bila tanggalnya tidak terbaca. */
export function tanggalHijriah(nilai: unknown): string {
  const h = keHijriah(nilai);
  if (!h) return "";
  return `${String(h.tanggal).padStart(2, "0")} ${BULAN_HIJRIAH[h.bulan]} ${h.tahun}`;
}

/**
 * Menjalankan fungsi Kelas A yang tidak menyentuh basis data.
 *
 * Mengembalikan null bila jenisnya bukan fungsi murni - pemanggilnya lalu tahu
 * variabel itu menuntut basis data, bukan menganggapnya kosong.
 */
export function nilaiFungsi(jenis: string, masukan: string): string | null {
  switch (String(jenis || "").toLowerCase()) {
    case "data_tanggal":
      return tanggalPanjang(masukan);
    case "tanggal_hari":
      return namaHari(masukan);
    case "tanggal_hijriah":
      return tanggalHijriah(masukan);
    default:
      return null;
  }
}
