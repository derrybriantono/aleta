/**
 * ============================================================================
 * KAPASITAS PENYIMPANAN - PERHITUNGAN MURNI (30 Oktober 2026)
 * ============================================================================
 *
 * Tanpa berkas, jaringan, atau basis data: hanya angka masuk -> baris dan
 * warna keluar, supaya uji memeriksa PERILAKUNYA (batas ambang, kapan
 * pembersihan boleh jalan, apa yang disarankan) bukan pembacaan berkas.
 *
 * Mengapa ada modul ini: /home server (200 GB) memuat data Docker dan database
 * portal, dan penuh berulang kali (100% 28 Agu, 95% 2 Okt, 100% 20 Okt) oleh
 * sisa pembuatan pembaruan (cache build). Angka ruangnya hanya terlihat dari
 * server induk, jadi ditulis skrip cron di sana (scripts/kapasitas/
 * aleta-kapasitas-cron.sh) ke folder bersama; portal hanya MEMBACA laporan itu
 * dan menulis dua berkas kecil untuknya (setelan dan pemicu periksa).
 * Container tidak pernah diberi akses soket Docker.
 */

export type Warna = "hijau" | "kuning" | "merah" | "kelabu";

export type SetelanKapasitas = {
  /** Persen terpakai mulai kuning. */
  ambangKuning: number;
  /** Persen terpakai mulai merah; pembersihan otomatis (bila menyala) hanya di atas ini. */
  ambangMerah: number;
  /** MATI bawaan: tiap pembersihan butuh izin. Menyalakannya = izin tetap Super Admin. */
  pembersihanOtomatis: boolean;
  /** Cache build yang lebih tua dari ini (jam) yang boleh dibuang. */
  umurCacheJam: number;
};

export const SETELAN_BAWAAN: SetelanKapasitas = Object.freeze({
  ambangKuning: 80,
  ambangMerah: 90,
  pembersihanOtomatis: false,
  umurCacheJam: 72,
});

export const BATAS_SETELAN = Object.freeze({
  ambangKuning: { min: 50, maks: 95 },
  ambangMerah: { min: 60, maks: 99 },
  umurCacheJam: { min: 24, maks: 720 },
});

/** Perintah yang dijalankan cron host - SATU-satunya, dan hanya bila syaratnya terpenuhi. */
export function perintahPembersihan(umurJam: number) {
  return `docker builder prune --filter until=${Math.trunc(umurJam)}h -f`;
}

const TB = 1024 ** 4;

export function formatUkuran(byte: number | null | undefined): string {
  if (byte === null || byte === undefined || !Number.isFinite(byte)) return "-";
  const satuan = ["B", "KB", "MB", "GB", "TB"];
  let v = Math.max(0, byte);
  let i = 0;
  while (v >= 1024 && i < satuan.length - 1) {
    v /= 1024;
    i += 1;
  }
  const digit = v >= 100 || i === 0 ? 0 : 1;
  return `${v.toLocaleString("id-ID", { maximumFractionDigits: digit, minimumFractionDigits: digit })} ${satuan[i]}`;
}

function angka(x: unknown): number | null {
  if (x === null || x === undefined || x === "") return null;
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function teks(x: unknown, maks = 200): string {
  return typeof x === "string" ? x.replace(/[\u0000-\u001f]/g, "").slice(0, maks) : "";
}

// ---------------------------------------------------------------------------
// Setelan
// ---------------------------------------------------------------------------

function bulatDalam(x: unknown, min: number, maks: number): number | null {
  if (typeof x !== "number" || !Number.isInteger(x)) return null;
  return x >= min && x <= maks ? x : null;
}

export type HasilPeriksaSetelan = { ok: true; setelan: SetelanKapasitas } | { ok: false; pesan: string };

/**
 * Menggabung perubahan (sebagian) ke setelan yang ada, dengan pemeriksaan yang
 * MENOLAK nilai buruk (bukan membetulkannya diam-diam): ambang di luar rentang,
 * merah tidak di atas kuning, atau saklar yang bukan benar/salah.
 */
export function periksaSetelan(masukan: unknown, dasar: SetelanKapasitas = SETELAN_BAWAAN): HasilPeriksaSetelan {
  const m = (masukan && typeof masukan === "object" && !Array.isArray(masukan) ? masukan : {}) as Record<string, unknown>;
  const hasil: SetelanKapasitas = { ...dasar };

  if (m.ambangKuning !== undefined) {
    const v = bulatDalam(m.ambangKuning, BATAS_SETELAN.ambangKuning.min, BATAS_SETELAN.ambangKuning.maks);
    if (v === null) return { ok: false, pesan: `Batas kuning harus bilangan bulat ${BATAS_SETELAN.ambangKuning.min}-${BATAS_SETELAN.ambangKuning.maks} persen.` };
    hasil.ambangKuning = v;
  }
  if (m.ambangMerah !== undefined) {
    const v = bulatDalam(m.ambangMerah, BATAS_SETELAN.ambangMerah.min, BATAS_SETELAN.ambangMerah.maks);
    if (v === null) return { ok: false, pesan: `Batas merah harus bilangan bulat ${BATAS_SETELAN.ambangMerah.min}-${BATAS_SETELAN.ambangMerah.maks} persen.` };
    hasil.ambangMerah = v;
  }
  if (m.umurCacheJam !== undefined) {
    const v = bulatDalam(m.umurCacheJam, BATAS_SETELAN.umurCacheJam.min, BATAS_SETELAN.umurCacheJam.maks);
    if (v === null) return { ok: false, pesan: `Umur sisa pembuatan yang dibersihkan harus ${BATAS_SETELAN.umurCacheJam.min}-${BATAS_SETELAN.umurCacheJam.maks} jam.` };
    hasil.umurCacheJam = v;
  }
  if (m.pembersihanOtomatis !== undefined) {
    if (typeof m.pembersihanOtomatis !== "boolean") return { ok: false, pesan: "Saklar pembersihan otomatis harus benar atau salah." };
    hasil.pembersihanOtomatis = m.pembersihanOtomatis;
  }
  if (hasil.ambangMerah <= hasil.ambangKuning) return { ok: false, pesan: "Batas merah harus lebih tinggi daripada batas kuning." };
  return { ok: true, setelan: hasil };
}

/** Setelan tersimpan (JSON bebas) -> setelan sah; yang rusak jatuh ke bawaan, tidak pernah ke nilai berbahaya. */
export function setelanDariTersimpan(mentah: unknown): SetelanKapasitas {
  const h = periksaSetelan(mentah, SETELAN_BAWAAN);
  return h.ok ? h.setelan : { ...SETELAN_BAWAAN };
}

// ---------------------------------------------------------------------------
// Persen dan warna
// ---------------------------------------------------------------------------

export function hitungPersen(terpakai: number | null | undefined, total: number | null | undefined): number | null {
  if (terpakai === null || terpakai === undefined || total === null || total === undefined) return null;
  if (!Number.isFinite(terpakai) || !Number.isFinite(total) || !(total > 0) || terpakai < 0) return null;
  return Math.round((terpakai / total) * 1000) / 10;
}

/** Tepat di batas sudah berwarna: 80,0 kuning, 90,0 merah (sama dengan skrip cron: >=). */
export function warnaKapasitas(persen: number | null | undefined, s: Pick<SetelanKapasitas, "ambangKuning" | "ambangMerah">): Warna {
  if (persen === null || persen === undefined || !Number.isFinite(persen)) return "kelabu";
  if (persen >= s.ambangMerah) return "merah";
  if (persen >= s.ambangKuning) return "kuning";
  return "hijau";
}

const URUTAN: Record<Warna, number> = { kelabu: 0, hijau: 1, kuning: 2, merah: 3 };
export function warnaTerburuk(daftar: Warna[]): Warna {
  let t: Warna = "kelabu";
  for (const w of daftar) if (URUTAN[w] > URUTAN[t]) t = w;
  return t;
}

/**
 * Apakah pembersihan otomatis BOLEH berjalan sekarang? Hanya bila saklar
 * menyala (izin tetap Super Admin) DAN partisi data Docker sudah di atas
 * ambang merah. Di bawahnya tidak ada yang dibersihkan, apa pun saklarnya.
 */
export function bolehBersihkanOtomatis(s: SetelanKapasitas, persenPartisiDocker: number | null | undefined): boolean {
  if (!s.pembersihanOtomatis) return false;
  if (persenPartisiDocker === null || persenPartisiDocker === undefined || !Number.isFinite(persenPartisiDocker)) return false;
  return persenPartisiDocker >= s.ambangMerah;
}

// ---------------------------------------------------------------------------
// Laporan dari host
// ---------------------------------------------------------------------------

export type JalurHost = {
  kunci: string;
  nama: string;
  jalur: string;
  titik: string;
  perangkat: string;
  totalByte: number | null;
  terpakaiByte: number | null;
  sisaByte: number | null;
  ukuranByte: number | null;
};
export type PartisiHost = { perangkat: string; titik: string; totalByte: number; terpakaiByte: number; sisaByte: number };
export type DockerHost = {
  citraByte: number | null;
  kontainerByte: number | null;
  volumeByte: number | null;
  cacheBuildByte: number | null;
  cacheBuildBisaDibersihkanByte: number | null;
};
export type LaporanHost = {
  dibuat: string;
  intervalMenit: number;
  dockerRoot: string;
  postgresDir: string;
  jalur: JalurHost[];
  partisi: PartisiHost[];
  docker: DockerHost | null;
  pembersihanTerakhir: string | null;
};

/** Laporan mentah -> bentuk tepercaya; null bila bukan laporan sama sekali. Isi aneh dibuang, tidak diperbaiki. */
export function bersihkanLaporan(mentah: unknown): LaporanHost | null {
  if (!mentah || typeof mentah !== "object") return null;
  const m = mentah as Record<string, unknown>;
  const dibuat = teks(m.dibuat, 40);
  if (!dibuat || Number.isNaN(new Date(dibuat).getTime())) return null;
  if (!Array.isArray(m.jalur)) return null;

  const jalur: JalurHost[] = [];
  for (const j of m.jalur.slice(0, 20)) {
    if (!j || typeof j !== "object") continue;
    const r = j as Record<string, unknown>;
    const kunci = teks(r.kunci, 40);
    if (!kunci) continue;
    jalur.push({
      kunci,
      nama: teks(r.nama, 80) || kunci,
      jalur: teks(r.jalur, 200),
      titik: teks(r.titik, 120),
      perangkat: teks(r.perangkat, 120),
      totalByte: angka(r.totalByte),
      terpakaiByte: angka(r.terpakaiByte),
      sisaByte: angka(r.sisaByte),
      ukuranByte: angka(r.ukuranByte),
    });
  }
  const partisi: PartisiHost[] = [];
  for (const p of Array.isArray(m.partisi) ? m.partisi.slice(0, 40) : []) {
    if (!p || typeof p !== "object") continue;
    const r = p as Record<string, unknown>;
    const total = angka(r.totalByte);
    const terpakai = angka(r.terpakaiByte);
    const sisa = angka(r.sisaByte);
    if (total === null || terpakai === null || sisa === null) continue;
    partisi.push({ perangkat: teks(r.perangkat, 120), titik: teks(r.titik, 120), totalByte: total, terpakaiByte: terpakai, sisaByte: sisa });
  }
  let docker: DockerHost | null = null;
  if (m.docker && typeof m.docker === "object") {
    const d = m.docker as Record<string, unknown>;
    docker = {
      citraByte: angka(d.citraByte),
      kontainerByte: angka(d.kontainerByte),
      volumeByte: angka(d.volumeByte),
      cacheBuildByte: angka(d.cacheBuildByte),
      cacheBuildBisaDibersihkanByte: angka(d.cacheBuildBisaDibersihkanByte),
    };
  }
  const pb = m.pembersihan && typeof m.pembersihan === "object" ? (m.pembersihan as Record<string, unknown>) : {};
  const interval = angka(m.intervalMenit);
  return {
    dibuat,
    intervalMenit: interval && interval > 0 ? interval : 10,
    dockerRoot: teks(m.dockerRoot),
    postgresDir: teks(m.postgresDir),
    jalur,
    partisi,
    docker,
    pembersihanTerakhir: teks(pb.terakhir, 40) || null,
  };
}

export type RiwayatPembersihan = {
  pada: string;
  sebabPersen: number | null;
  ambangMerah: number | null;
  umurJam: number | null;
  dibebaskanByte: number | null;
  kode: number | null;
  perintah: string;
};

/** Berkas JSON-baris cron -> daftar; baris rusak dilewati. Terbaru di akhir berkas -> terbaru di depan hasil. */
export function uraiRiwayatPembersihan(isi: string, maks = 20): RiwayatPembersihan[] {
  const hasil: RiwayatPembersihan[] = [];
  for (const baris of String(isi || "").split(/\r?\n/)) {
    const t = baris.trim();
    if (!t || t[0] !== "{") continue;
    try {
      const r = JSON.parse(t) as Record<string, unknown>;
      const pada = teks(r.pada, 40);
      if (!pada || Number.isNaN(new Date(pada).getTime())) continue;
      hasil.push({
        pada,
        sebabPersen: angka(r.sebabPersen),
        ambangMerah: angka(r.ambangMerah),
        umurJam: angka(r.umurJam),
        dibebaskanByte: angka(r.dibebaskanByte),
        kode: angka(r.kode),
        perintah: teks(r.perintah, 120),
      });
    } catch {
      // baris setengah tertulis: dilewati
    }
  }
  return hasil.slice(-maks).reverse();
}

// ---------------------------------------------------------------------------
// Penyusunan baris untuk layar
// ---------------------------------------------------------------------------

export type BarisKapasitas = {
  kunci: string;
  nama: string;
  /** partisi = berwarna menurut ambang; bagian = porsi dari sebuah partisi (netral). */
  jenis: "partisi" | "bagian";
  jalur: string | null;
  titik: string | null;
  terpakaiByte: number | null;
  totalByte: number | null;
  sisaByte: number | null;
  persen: number | null;
  warna: Warna;
  keterangan: string;
};

export type PetunjukPindah = {
  totalFisikByte: number | null;
  /** true = total partisi >= 1 TB; null = tidak diketahui. */
  cukup1Tb: boolean | null;
  kekuranganUntuk1TbByte: number | null;
  partisiTerbesar: { titik: string; sisaByte: number } | null;
  perluPindah: boolean;
  pesan: string[];
  perintah: string[];
};

export type RingkasanKapasitas = {
  warna: Warna;
  persenTertinggi: number | null;
  titikTertinggi: string | null;
  pesan: string;
};

export type SumberKapasitas = "host" | "bot" | "tidak-ada";

export type HasilKapasitas = {
  sumber: SumberKapasitas;
  diukurPada: string | null;
  umurMenit: number | null;
  /** Laporan host lebih tua dari 3x interval: cron berhenti atau belum dipasang. */
  basi: boolean;
  baris: BarisKapasitas[];
  ringkasan: RingkasanKapasitas;
  petunjuk: PetunjukPindah;
  /** Bagian data yang sedang di partisi data Docker sekarang (untuk peringatan "satu partisi"). */
  satuPartisiDenganDocker: string[];
};

export type PartisiBot = { titik: string; totalByte: number; terpakaiByte: number; sisaByte?: number };

function sama(a: { perangkat: string; titik: string } | undefined, b: { perangkat: string; titik: string } | undefined) {
  return Boolean(a && b && a.titik === b.titik && a.perangkat === b.perangkat);
}

const PERINTAH_PINDAH = [
  "bash /var/www/html/aleta/scripts/kapasitas/pindah-data-docker.sh --periksa",
  "bash /var/www/html/aleta/scripts/kapasitas/pindah-data-docker.sh --jalankan /aleta-docker",
];

export const PERINTAH_PASANG_CRON =
  "echo '* * * * * root /var/www/html/aleta/scripts/kapasitas/aleta-kapasitas-cron.sh >> /var/log/aleta-kapasitas.log 2>&1' > /etc/cron.d/aleta-kapasitas";

/**
 * Saran pindah dan jawaban jujur soal 1 TB. Total fisik dijumlahkan dari
 * partisi bersistem berkas yang dilihat server; bila kurang dari 1 TB, 1 TB
 * untuk ALETA TIDAK mungkin tanpa disk tambahan - yang mungkin hanya memakai
 * partisi terbesar yang sekarang menganggur.
 */
export function susunPetunjuk(partisi: Array<{ perangkat?: string; titik: string; totalByte: number; terpakaiByte: number; sisaByte?: number }>, titikDocker: string | null): PetunjukPindah {
  if (!partisi.length) {
    return {
      totalFisikByte: null,
      cukup1Tb: null,
      kekuranganUntuk1TbByte: null,
      partisiTerbesar: null,
      perluPindah: false,
      pesan: ["Total ruang server belum terbaca. Pasang pemantau di server (lihat langkah di bawah) agar ruang tiap partisi terukur."],
      perintah: [...PERINTAH_PINDAH],
    };
  }
  const unik = new Map<string, (typeof partisi)[number]>();
  for (const p of partisi) unik.set(p.perangkat || p.titik, p);
  const daftar = [...unik.values()].filter((p) => !/^\/boot/.test(p.titik));
  const total = daftar.reduce((a, p) => a + p.totalByte, 0);
  const sisaDari = (p: (typeof daftar)[number]) => (p.sisaByte !== undefined ? p.sisaByte : Math.max(0, p.totalByte - p.terpakaiByte));
  const terbesar = [...daftar].sort((a, b) => sisaDari(b) - sisaDari(a))[0];
  const docker = daftar.find((p) => p.titik === titikDocker);
  const cukup = total >= TB;
  const kurang = cukup ? 0 : TB - total;

  const pesan: string[] = [];
  pesan.push(
    cukup
      ? `Total semua partisi server ${formatUkuran(total)}: cukup untuk 1 TB, asalkan ruangnya berupa SATU partisi yang dipakai ALETA.`
      : `Total semua partisi server hanya ${formatUkuran(total)}. 1 TB untuk ALETA TIDAK mungkin tanpa disk tambahan (kurang sekitar ${formatUkuran(kurang)}).`
  );
  const perluPindah = Boolean(docker && terbesar && terbesar.titik !== docker.titik && sisaDari(terbesar) > sisaDari(docker) * 2);
  if (perluPindah && docker && terbesar) {
    pesan.push(
      `Data Docker dan database sekarang di partisi ${docker.titik} (bebas ${formatUkuran(sisaDari(docker))}); partisi ${terbesar.titik} masih bebas ${formatUkuran(sisaDari(terbesar))}. Memindahkan data ke ${terbesar.titik} adalah jalan keluar yang tersedia sekarang.`
    );
  } else if (docker && terbesar && terbesar.titik === docker.titik) {
    pesan.push(`Data Docker sudah berada di partisi dengan ruang bebas terbesar (${docker.titik}, bebas ${formatUkuran(sisaDari(docker))}).`);
  }
  if (!cukup) {
    pesan.push("Untuk menambah ruang di atas itu: pasang disk baru, partisi dan format oleh pengelola server, lalu pasang di server (mis. /aleta-docker) dan pindahkan datanya dengan skrip yang sama. Skrip tidak pernah memformat apa pun.");
  }
  return {
    totalFisikByte: total,
    cukup1Tb: cukup,
    kekuranganUntuk1TbByte: kurang,
    partisiTerbesar: terbesar ? { titik: terbesar.titik, sisaByte: sisaDari(terbesar) } : null,
    perluPindah,
    pesan,
    perintah: [...PERINTAH_PINDAH],
  };
}

function ringkasanDari(baris: BarisKapasitas[], s: SetelanKapasitas, sumber: SumberKapasitas): RingkasanKapasitas {
  const partisi = baris.filter((b) => b.jenis === "partisi" && b.persen !== null);
  if (!partisi.length) {
    return {
      warna: "kelabu",
      persenTertinggi: null,
      titikTertinggi: null,
      pesan: sumber === "tidak-ada" ? "Ruang penyimpanan belum terukur. Pasang pemantau di server (lihat langkah di bawah)." : "Ruang penyimpanan belum terbaca.",
    };
  }
  const tertinggi = [...partisi].sort((a, b) => (b.persen ?? 0) - (a.persen ?? 0))[0];
  const warna = warnaTerburuk(partisi.map((b) => b.warna));
  const p = tertinggi.persen as number;
  const nama = tertinggi.titik ? `partisi ${tertinggi.titik}` : tertinggi.nama;
  const pesan =
    warna === "merah"
      ? `${nama[0].toUpperCase()}${nama.slice(1)} terisi ${p.toLocaleString("id-ID")}% (batas merah ${s.ambangMerah}%). Segera lapangkan atau pindahkan data.`
      : warna === "kuning"
        ? `${nama[0].toUpperCase()}${nama.slice(1)} terisi ${p.toLocaleString("id-ID")}% (batas kuning ${s.ambangKuning}%). Rencanakan pembersihan atau pemindahan data.`
        : `Ruang penyimpanan wajar (tertinggi ${p.toLocaleString("id-ID")}% di ${nama}).`;
  return { warna, persenTertinggi: p, titikTertinggi: tertinggi.titik || null, pesan };
}

/**
 * Laporan host (utama) atau, bila belum ada, partisi dari bot (cadangan) -> baris layar.
 * `kini` dan interval menentukan apakah laporan dianggap basi.
 */
export function susunKapasitas(masukan: { laporan: LaporanHost | null; partisiBot: PartisiBot[] | null; setelan: SetelanKapasitas; kini: Date }): HasilKapasitas {
  const { laporan, partisiBot, setelan: s, kini } = masukan;

  if (laporan) {
    const umurMenit = Math.max(0, Math.round((kini.getTime() - new Date(laporan.dibuat).getTime()) / 60000));
    const basi = umurMenit > laporan.intervalMenit * 3 + 2;
    const cari = (k: string) => laporan.jalur.find((j) => j.kunci === k);
    const docker = cari("docker");
    const data = cari("aleta-data");
    const pg = cari("postgres");

    const baris: BarisKapasitas[] = [];
    const partisiBaris = (kunci: string, nama: string, j: JalurHost | undefined, catatan: string): BarisKapasitas => {
      const persen = hitungPersen(j?.terpakaiByte, j?.totalByte);
      return {
        kunci,
        nama,
        jenis: "partisi",
        jalur: j?.jalur || null,
        titik: j?.titik || null,
        terpakaiByte: j?.terpakaiByte ?? null,
        totalByte: j?.totalByte ?? null,
        sisaByte: j?.sisaByte ?? null,
        persen,
        warna: warnaKapasitas(persen, s),
        keterangan: j ? catatan : "Belum terukur.",
      };
    };
    baris.push(partisiBaris("partisi-docker", "Partisi data Docker", docker, `Memuat data Docker (${docker?.jalur ?? "-"}).`));
    baris.push(
      partisiBaris(
        "partisi-aleta",
        "Partisi data ALETA",
        data,
        sama(data, docker) ? "Satu partisi dengan data Docker." : `Memuat unggahan, arsip, dan cadangan (${data?.jalur ?? "-"}).`
      )
    );
    if (pg && !sama(pg, docker) && !sama(pg, data)) {
      baris.push(partisiBaris("partisi-postgres", "Partisi database", pg, `Memuat database portal (${pg.jalur}).`));
    }

    const totalDocker = docker?.totalByte ?? null;
    const bagian = (kunci: string, nama: string, j: JalurHost | undefined, byte: number | null, totalPartisi: number | null, catatan: string): BarisKapasitas => ({
      kunci,
      nama,
      jenis: "bagian",
      jalur: j?.jalur || null,
      titik: j?.titik || null,
      terpakaiByte: byte,
      totalByte: totalPartisi,
      sisaByte: null,
      persen: hitungPersen(byte, totalPartisi),
      warna: "kelabu",
      keterangan: byte === null ? "Belum terukur." : catatan,
    });
    baris.push(bagian("postgres", "Database portal", pg, pg?.ukuranByte ?? null, pg?.totalByte ?? null, pg ? `Di partisi ${pg.titik}.` : ""));
    if (laporan.docker) {
      baris.push(
        bagian("citra", "Citra dan kontainer Docker", docker, laporan.docker.citraByte, totalDocker, "Versi aplikasi yang terpasang dan versi lama yang masih disimpan.")
      );
      const bisa = laporan.docker.cacheBuildBisaDibersihkanByte;
      baris.push(
        bagian(
          "cache-build",
          "Sisa pembuatan pembaruan (cache build)",
          docker,
          laporan.docker.cacheBuildByte,
          totalDocker,
          bisa !== null ? `Yang dapat dibersihkan ${formatUkuran(bisa)}. Biang penuhnya partisi sebelumnya.` : "Biang penuhnya partisi sebelumnya."
        )
      );
    }
    const ec = cari("ecourt");
    baris.push(bagian("ecourt", "Arsip e-Court", ec, ec?.ukuranByte ?? null, ec?.totalByte ?? null, ec ? `Di partisi ${ec.titik}.` : ""));
    const ug = cari("unggahan");
    baris.push(bagian("unggahan", "Unggahan dan PDF", ug, ug?.ukuranByte ?? null, ug?.totalByte ?? null, ug ? `Di partisi ${ug.titik}.` : ""));
    const cd = cari("cadangan");
    baris.push(bagian("cadangan", "Cadangan", cd, cd?.ukuranByte ?? null, cd?.totalByte ?? null, cd ? `Di partisi ${cd.titik}.` : ""));

    const satu: string[] = [];
    if (docker) {
      if (pg && sama(pg, docker)) satu.push("Database portal");
      if (data && sama(data, docker)) satu.push("Data ALETA");
    }
    // Warna keseluruhan: hanya baris partisi (porsi bukan ambang). Laporan basi tidak dipercaya sebagai hijau.
    const ringkasan = ringkasanDari(baris, s, "host");
    if (basi) {
      ringkasan.warna = ringkasan.warna === "merah" ? "merah" : "kelabu";
      ringkasan.pesan = `Pemantau di server berhenti ${umurMenit} menit lalu (seharusnya tiap ${laporan.intervalMenit} menit). Angka di bawah mungkin sudah lama.`;
    }
    return {
      sumber: "host",
      diukurPada: laporan.dibuat,
      umurMenit,
      basi,
      baris,
      ringkasan,
      petunjuk: susunPetunjuk(laporan.partisi, docker?.titik ?? null),
      satuPartisiDenganDocker: satu,
    };
  }

  if (partisiBot && partisiBot.length) {
    const baris: BarisKapasitas[] = partisiBot
      .filter((p) => !/^\/boot/.test(p.titik))
      .map((p) => {
        const persen = hitungPersen(p.terpakaiByte, p.totalByte);
        return {
          kunci: `partisi:${p.titik}`,
          nama: `Partisi ${p.titik}`,
          jenis: "partisi" as const,
          jalur: null,
          titik: p.titik,
          terpakaiByte: p.terpakaiByte,
          totalByte: p.totalByte,
          sisaByte: p.sisaByte ?? Math.max(0, p.totalByte - p.terpakaiByte),
          persen,
          warna: warnaKapasitas(persen, s),
          keterangan: "Dibaca dari ALETA Bot. Pasang pemantau di server untuk rincian data Docker, database, dan sisa pembuatan.",
        };
      });
    return {
      sumber: "bot",
      diukurPada: null,
      umurMenit: null,
      basi: false,
      baris,
      ringkasan: ringkasanDari(baris, s, "bot"),
      petunjuk: susunPetunjuk(partisiBot, null),
      satuPartisiDenganDocker: [],
    };
  }

  return {
    sumber: "tidak-ada",
    diukurPada: null,
    umurMenit: null,
    basi: false,
    baris: [],
    ringkasan: ringkasanDari([], s, "tidak-ada"),
    petunjuk: susunPetunjuk([], null),
    satuPartisiDenganDocker: [],
  };
}

