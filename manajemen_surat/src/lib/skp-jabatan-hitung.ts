import { persen, selisihHari, tanggalWita } from "@/lib/eviden-skp-katalog";
import {
  KALIMAT_USULAN_SKP,
  PERILAKU_KERJA_SKP,
  SKP_JABATAN_2026,
  type ArahSelisihSkp,
  type DefIndikatorSkp,
  type DefRhkSkp,
} from "@/lib/skp-jabatan-katalog";
import type {
  BuktiIsianSkp,
  DataSkpJabatan,
  FaktaAkunSkp,
  IndikatorSkp,
  IsianManualSkp,
  JabatanSkp,
  JenisSkp,
  KejadianSkp,
  LembarSkp,
  PegawaiSkp,
  PeriodeSkpJabatan,
  RhkSkp,
  SumberSkp,
  TargetSkpJabatan,
} from "@/lib/skp-jabatan-tipe";

/**
 * ============================================================================
 * ATURAN HITUNG SKP JABATAN - SATU-SATUNYA TEMPAT ANGKA DIHITUNG
 * ============================================================================
 *
 * Bot mengirim FAKTA per kejadian (DataSkpJabatan). Berkas ini menghitung
 * realisasi tiap indikator dari fakta itu, dari isian manual, atau dari
 * gabungan keduanya. Aturan yang tidak boleh dilanggar:
 *
 *   - Penyebut nol -> realisasi null, tampil "—" (bukan 0%).
 *   - Nilai yang TIDAK TERBACA (bagian SIPP gagal dibaca, fakta tidak
 *     dikirim, tanggal acuan kosong) TIDAK PERNAH menjadi 0. Kejadian yang
 *     tak dapat dinilai dikeluarkan dari penyebut dan disebut di dasar hitung.
 *   - Daftar kejadian yang TERBACA dan kosong adalah nol sungguhan (0 relaas).
 *   - Isian berstatus "draf" tidak dihitung; hanya "diajukan"/"disetujui".
 */

// ─── Angka dan teks ─────────────────────────────────────────────────────────

/** "106.016.000" untuk bilangan bulat; "7,5" untuk pecahan (satu desimal). */
export function angkaSkp(n: number): string {
  const bulat = Number.isInteger(n);
  const teks = bulat ? String(n) : String(Math.round(n * 10) / 10).replace(".", ",");
  const [depan, belakang] = teks.split(",");
  const titik = depan.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return belakang !== undefined ? `${titik},${belakang}` : titik;
}

export function rupiahSkp(n: number): string {
  return `Rp${angkaSkp(Math.round(n))}`;
}

const TANDA_KOSONG = "—";

// ─── Fakta ──────────────────────────────────────────────────────────────────

type FaktaGabung = {
  /** Bot mengirim fakta dengan kunci ini (untuk satu akun atau lebih). */
  ada: boolean;
  /** Ada setidaknya satu akun yang terbaca. */
  terbaca: boolean;
  kejadian: KejadianSkp[];
  galat: string[];
};

export function kumpulkanFaktaSkp(akun: readonly FaktaAkunSkp[], kunci: string): FaktaGabung {
  const hasil: FaktaGabung = { ada: false, terbaca: false, kejadian: [], galat: [] };
  for (const a of akun) {
    for (const f of a.fakta) {
      if (f.kunci !== kunci) continue;
      hasil.ada = true;
      if (f.terbaca) {
        hasil.terbaca = true;
        hasil.kejadian.push(...f.kejadian);
      } else if (f.galat) {
        hasil.galat.push(f.galat);
      }
    }
  }
  return hasil;
}

/** Selisih hari antara dua tanggal kejadian menurut arahnya; null bila salah satunya kosong. */
export function selisihKejadianSkp(k: KejadianSkp, arah: ArahSelisihSkp): number | null {
  return arah === "acuan-ke-tanggal" ? selisihHari(k.tanggalAcuan, k.tanggal) : selisihHari(k.tanggal, k.tanggalAcuan);
}

/**
 * Lulus/tidak sebuah kejadian bagi aturan persen-hari. null = tidak dapat
 * dinilai (tanggal acuan kosong, atau belum jatuh tempo pada batas keadaan).
 */
export function lulusHariSkp(
  k: KejadianSkp,
  aturan: { arah: ArahSelisihSkp; cocok: "maks" | "min"; batas: number },
  batasKeadaan: string
): boolean | null {
  const selisih = selisihKejadianSkp(k, aturan.arah);
  if (selisih !== null) return aturan.cocok === "maks" ? selisih <= aturan.batas : selisih >= aturan.batas;
  // Tanggal kejadian kosong tetapi acuannya ada: pekerjaan belum dilakukan.
  // Gagal hanya bila tenggatnya sudah lewat pada batas keadaan.
  if (aturan.cocok === "maks" && aturan.arah === "acuan-ke-tanggal" && !k.tanggal && k.tanggalAcuan) {
    const sejak = selisihHari(k.tanggalAcuan, batasKeadaan);
    return sejak !== null && sejak > aturan.batas ? false : null;
  }
  return null;
}

// ─── Hasil satu indikator ───────────────────────────────────────────────────

export type HasilIndikatorSkp = {
  indikator: IndikatorSkp;
  /** Daftar kejadian yang dipakai (untuk bukti dukung); kunci sumbernya. */
  sumberKunci: string | null;
  kejadian: KejadianSkp[];
  /** Isian manual yang dipakai (untuk bukti dukung). */
  isian: IsianManualSkp | null;
};

export type KonteksHitungSkp = {
  akun: readonly FaktaAkunSkp[];
  periode: PeriodeSkpJabatan;
  /** Batas keadaan: akhir periode, atau hari ini bila periode belum berakhir. */
  batas: string;
  /** Pegawai yang dihitung (untuk mencari isian). */
  userId: string;
  isian: readonly IsianManualSkp[];
  target: readonly TargetSkpJabatan[];
  jabatan: JabatanSkp;
};

function cariIsian(konteks: KonteksHitungSkp, kunciRhk: string, kunciIndikator: string): IsianManualSkp | null {
  const cocok = konteks.isian
    .filter(
      (i) =>
        i.userId === konteks.userId &&
        i.periode === konteks.periode.kunci &&
        i.tahun === konteks.periode.tahun &&
        i.kunciRhk === kunciRhk &&
        i.kunciIndikator === kunciIndikator &&
        i.status !== "draf" &&
        i.nilai !== null &&
        Number.isFinite(i.nilai)
    )
    .sort((a, b) => String(b.diperbaruiPada).localeCompare(String(a.diperbaruiPada)));
  return cocok[0] ?? null;
}

function cariTarget(konteks: KonteksHitungSkp, kunciRhk: string, kunciIndikator: string): TargetSkpJabatan | null {
  return (
    konteks.target.find(
      (t) =>
        t.jabatan === konteks.jabatan &&
        t.tahun === konteks.periode.tahun &&
        t.kunciRhk === kunciRhk &&
        t.kunciIndikator === kunciIndikator
    ) ?? null
  );
}

type Angka = {
  realisasi: number | null;
  realisasiTeks: string;
  pembilang: number | null;
  penyebut: number | null;
  dasar: string;
  catatan: string[];
};

const TIDAK_TERHITUNG = (dasar: string, catatan: string[] = []): Angka => ({
  realisasi: null,
  realisasiTeks: TANDA_KOSONG,
  pembilang: null,
  penyebut: null,
  dasar,
  catatan,
});

function bulat1(n: number): number {
  return Math.round(n * 10) / 10;
}

function kalimatTakDinilai(jumlah: number, alasan: string): string {
  return jumlah > 0 ? ` (${angkaSkp(jumlah)} ${alasan})` : "";
}

/** Menghitung satu indikator: SIPP, isian, atau gabungan. */
export function hitungIndikatorSkp(def: DefIndikatorSkp, kunciRhk: string, k: KonteksHitungSkp): HasilIndikatorSkp {
  const target = cariTarget(k, kunciRhk, def.kunci);
  const dasarTarget = {
    target: target ? target.targetNilai : def.targetNilai,
    targetTeks: target ? target.targetTeks : def.targetTeks,
    statusTarget: target ? target.status : ("usulan" as const),
  };
  const satuan = target?.satuan || def.satuan;
  const isian = cariIsian(k, kunciRhk, def.kunci);

  const bungkus = (a: Angka, sumber: SumberSkp, kunciSumber: string | null, kejadian: KejadianSkp[]): HasilIndikatorSkp => ({
    indikator: {
      kunci: def.kunci,
      aspek: def.aspek,
      teks: def.teks,
      satuan,
      target: dasarTarget.target,
      targetTeks: dasarTarget.targetTeks,
      realisasi: a.realisasi,
      realisasiTeks: a.realisasiTeks,
      pembilang: a.pembilang,
      penyebut: a.penyebut,
      sumber,
      dasar: a.dasar,
      catatan: a.catatan,
      statusTarget: dasarTarget.statusTarget,
    },
    sumberKunci: kunciSumber,
    kejadian,
    isian: sumber === "sipp" ? null : isian,
  });

  // Isian sebagai satu-satunya sumber (indikator tanpa SIPP) atau pengganti SIPP.
  const dariIsian = (catatanAwal: string[] = []): Angka => {
    if (!isian || isian.nilai === null) {
      return TIDAK_TERHITUNG(
        def.aturan.jenis === "isian"
          ? "Indikator ini tidak dicatat di SIPP; belum ada isian manual yang diajukan."
          : "Tidak terbaca dari SIPP dan belum ada isian manual; angkanya tidak dianggap 0.",
        [...catatanAwal, "isian"]
      );
    }
    const teks = isian.nilaiTeks.trim() || `${angkaSkp(isian.nilai)} ${satuan}`;
    return {
      realisasi: isian.nilai,
      realisasiTeks: teks,
      pembilang: null,
      penyebut: null,
      dasar: `Isian manual pegawai: ${teks}${isian.catatan.trim() ? ` - ${isian.catatan.trim()}` : ""}.`,
      catatan: [...catatanAwal, "isian"],
    };
  };

  const aturan = def.aturan;
  if (aturan.jenis === "isian") {
    const a = dariIsian();
    return bungkus(a, "isian", null, []);
  }

  // Kunci sumber: daftar milik indikator ini bila bot mengirimnya, selain itu `dari`.
  const sendiri = kumpulkanFaktaSkp(k.akun, def.kunci);
  const kunciSumber = sendiri.ada || !def.dari ? def.kunci : def.dari;
  const fakta = kunciSumber === def.kunci ? sendiri : kumpulkanFaktaSkp(k.akun, kunciSumber);

  const bacaGalat = (f: FaktaGabung, nama: string): string[] =>
    f.ada
      ? f.galat.length > 0
        ? f.galat
        : [`Bagian SIPP untuk ${nama} tidak terbaca.`]
      : [`SIPP tidak mengirim data untuk ${nama}.`];

  const tidakTerbaca = (f: FaktaGabung | FaktaGabung[]): HasilIndikatorSkp => {
    const daftar = Array.isArray(f) ? f : [f];
    const galat = daftar.flatMap((x) => bacaGalat(x, def.objek));
    const pengganti = isian ? dariIsian(galat) : TIDAK_TERHITUNG(
      "Tidak terbaca dari SIPP; angkanya tidak dianggap 0 dan perlu diisi manual.",
      galat
    );
    return bungkus(pengganti, isian ? "isian" : "sipp", null, []);
  };

  switch (aturan.jenis) {
    case "jumlah":
    case "jumlah-nilai": {
      if (!fakta.terbaca) return tidakTerbaca(fakta);
      const nilai = aturan.jenis === "jumlah-nilai";
      let jumlah: number;
      let dasar: string;
      let tanpaNilai = 0;
      if (nilai) {
        const bernilai = fakta.kejadian.filter((x) => x.nilai !== null && Number.isFinite(x.nilai));
        tanpaNilai = fakta.kejadian.length - bernilai.length;
        jumlah = bernilai.reduce((t, x) => t + (x.nilai as number), 0);
        dasar = `${rupiahSkp(jumlah)} dari ${angkaSkp(bernilai.length)} ${def.objek} tercatat di SIPP${kalimatTakDinilai(
          tanpaNilai,
          "tanpa nilai tidak dijumlahkan"
        )}.`;
      } else {
        jumlah = fakta.kejadian.length;
        dasar = `${angkaSkp(jumlah)} ${def.objek} tercatat di SIPP pada periode.`;
      }
      const catatan = ["dari SIPP"];
      let sumber: SumberSkp = "sipp";
      let akhir = jumlah;
      if (isian && isian.nilai !== null) {
        akhir = jumlah + isian.nilai;
        sumber = "gabungan";
        dasar = `${dasar.replace(/\.$/, "")} ditambah isian manual ${nilai ? rupiahSkp(isian.nilai) : angkaSkp(isian.nilai)} (jumlah ${nilai ? rupiahSkp(akhir) : angkaSkp(akhir)}).`;
        catatan.push("isian");
      }
      return bungkus(
        {
          realisasi: akhir,
          realisasiTeks: nilai ? rupiahSkp(akhir) : `${angkaSkp(akhir)} ${satuan}`,
          pembilang: akhir,
          penyebut: null,
          dasar,
          catatan,
        },
        sumber,
        kunciSumber,
        fakta.kejadian
      );
    }

    case "persen-hari": {
      if (!fakta.terbaca) return tidakTerbaca(fakta);
      let lulus = 0;
      let dinilai = 0;
      let belumDinilai = 0;
      for (const x of fakta.kejadian) {
        const hasil = lulusHariSkp(x, aturan, k.batas);
        if (hasil === null) belumDinilai += 1;
        else {
          dinilai += 1;
          if (hasil) lulus += 1;
        }
      }
      const catatan = ["dari SIPP"];
      if (dinilai === 0) {
        const dasar =
          fakta.kejadian.length === 0
            ? `Tidak ada ${def.objek} pada periode; persentase tidak dapat dihitung.`
            : `Dari ${angkaSkp(fakta.kejadian.length)} ${def.objek}, tidak satu pun dapat dinilai (tanggal tidak lengkap atau belum jatuh tempo); persentase tidak dapat dihitung.`;
        return bungkus(TIDAK_TERHITUNG(dasar, catatan), "sipp", kunciSumber, fakta.kejadian);
      }
      return bungkus(
        {
          realisasi: bulat1((lulus / dinilai) * 100),
          realisasiTeks: persen(lulus, dinilai),
          pembilang: lulus,
          penyebut: dinilai,
          dasar: `${angkaSkp(lulus)} dari ${angkaSkp(dinilai)} ${def.objek} ${aturan.syarat}${kalimatTakDinilai(
            belumDinilai,
            "tidak dihitung karena tanggalnya tidak lengkap atau belum jatuh tempo"
          )}.`,
          catatan,
        },
        "sipp",
        kunciSumber,
        fakta.kejadian
      );
    }

    case "rata-hari": {
      if (!fakta.terbaca) return tidakTerbaca(fakta);
      const hari = fakta.kejadian
        .map((x) => selisihKejadianSkp(x, aturan.arah))
        .filter((x): x is number => x !== null && Number.isFinite(x));
      const tanpa = fakta.kejadian.length - hari.length;
      if (hari.length === 0) {
        return bungkus(
          TIDAK_TERHITUNG(
            fakta.kejadian.length === 0
              ? `Tidak ada ${def.objek} pada periode; rata-rata tidak dapat dihitung.`
              : `Tanggal ${def.objek} tidak lengkap; rata-rata tidak dapat dihitung.`,
            ["dari SIPP"]
          ),
          "sipp",
          kunciSumber,
          fakta.kejadian
        );
      }
      const rata = bulat1(hari.reduce((t, x) => t + x, 0) / hari.length);
      return bungkus(
        {
          realisasi: rata,
          realisasiTeks: `${angkaSkp(rata)} Hari`,
          pembilang: null,
          penyebut: hari.length,
          dasar: `Rata-rata ${angkaSkp(rata)} hari dari ${angkaSkp(hari.length)} ${def.objek}${kalimatTakDinilai(
            tanpa,
            "tidak dihitung karena tanggalnya tidak lengkap"
          )}.`,
          catatan: ["dari SIPP"],
        },
        "sipp",
        kunciSumber,
        fakta.kejadian
      );
    }

    case "rasio": {
      const a = kumpulkanFaktaSkp(k.akun, aturan.pembilang);
      const b = kumpulkanFaktaSkp(k.akun, aturan.penyebut);
      if (!a.terbaca || !b.terbaca) return tidakTerbaca([a, b].filter((x) => !x.terbaca));
      if (b.kejadian.length === 0) {
        return bungkus(
          TIDAK_TERHITUNG(`Tidak ada ${def.objek} pada periode; persentase tidak dapat dihitung.`, ["dari SIPP"]),
          "sipp",
          aturan.penyebut,
          b.kejadian
        );
      }
      const sebagian = Math.min(a.kejadian.length, b.kejadian.length);
      return bungkus(
        {
          realisasi: bulat1((sebagian / b.kejadian.length) * 100),
          realisasiTeks: persen(sebagian, b.kejadian.length),
          pembilang: sebagian,
          penyebut: b.kejadian.length,
          dasar: `${angkaSkp(sebagian)} dari ${angkaSkp(b.kejadian.length)} ${def.objek} ${aturan.syarat}.`,
          catatan: ["dari SIPP"],
        },
        "sipp",
        aturan.penyebut,
        b.kejadian
      );
    }
  }
}

// ─── Lembar SKP ─────────────────────────────────────────────────────────────

/** Rincian satu RHK untuk bukti dukung: hasil indikator beserta daftar kejadiannya. */
export type RincianRhkSkp = {
  rhk: RhkSkp;
  judulRekap: string;
  tambahan: boolean;
  hasil: HasilIndikatorSkp[];
};

export type HasilSkpJabatan = {
  lembar: LembarSkp;
  /** Satu entri per RHK (utama dahulu, lalu tambahan), berurutan seperti lembar. */
  rincian: RincianRhkSkp[];
};

export type MasukanLembarSkp = {
  jenis: Exclude<JenisSkp, "hakim">;
  periode: PeriodeSkpJabatan;
  pegawai: PegawaiSkp;
  pejabatPenilai: LembarSkp["pejabatPenilai"];
  /** Jawaban bot; null = bot tidak terjangkau (semua indikator SIPP "—"). */
  data: DataSkpJabatan | null;
  /** Hanya akun SIPP ini (huruf besar-kecil diabaikan); kosong = semua akun di data. */
  usernameSipp?: readonly string[];
  isian?: readonly IsianManualSkp[];
  target?: readonly TargetSkpJabatan[];
  /** Blok tambahan jabatan rangkap ("tugas PP"); bawaan menyala. */
  sertakanTambahan?: boolean;
  /** Cap waktu ISO; bawaan: data.dihitungPada atau sekarang. */
  dihitungPada?: string;
};

/** Jabatan yang RHK-nya dipakai jenis tertentu: pimpinan -> Ketua/Wakil menurut jabatan pegawai. */
export function jabatanKatalogSkp(jenis: Exclude<JenisSkp, "hakim">, pegawai: PegawaiSkp): JabatanSkp {
  if (jenis !== "pimpinan") return jenis;
  return pegawai.jabatanUtama === "wakil-ketua" ? "wakil-ketua" : "ketua";
}

function rhkDariDef(def: DefRhkSkp, hasil: HasilIndikatorSkp[], tambahan: boolean): RhkSkp {
  return { kunci: def.kunci, teks: def.teks, tambahan, indikator: hasil.map((h) => h.indikator) };
}

function hitungRhk(
  def: DefRhkSkp,
  jabatan: JabatanSkp,
  k: KonteksHitungSkp,
  tambahan: boolean
): RincianRhkSkp {
  const konteks = { ...k, jabatan };
  const hasil = def.indikator.map((i) => hitungIndikatorSkp(i, def.kunci, konteks));
  return { rhk: rhkDariDef(def, hasil, tambahan), judulRekap: def.judulRekap, tambahan, hasil };
}

/**
 * Menghitung Lembar SKP satu pegawai untuk satu periode. Tidak membaca SIPP,
 * tidak membaca basis data: semua masukan datang dari pemanggil.
 */
export function hitungLembarSkp(m: MasukanLembarSkp): HasilSkpJabatan {
  const dihitungPada = m.dihitungPada ?? m.data?.dihitungPada ?? new Date().toISOString();
  const hariIni = tanggalWita(dihitungPada) ?? m.periode.selesai;
  const batas = hariIni < m.periode.selesai ? hariIni : m.periode.selesai;

  const dipilih = new Set((m.usernameSipp ?? []).map((u) => u.trim().toLowerCase()).filter(Boolean));
  const akun = (m.data?.akun ?? []).filter((a) => dipilih.size === 0 || dipilih.has(a.username.toLowerCase()));

  const jabatanUtama = jabatanKatalogSkp(m.jenis, m.pegawai);
  const dasarKonteks: KonteksHitungSkp = {
    akun,
    periode: m.periode,
    batas,
    userId: m.pegawai.userId,
    isian: m.isian ?? [],
    target: m.target ?? [],
    jabatan: jabatanUtama,
  };

  const rincian: RincianRhkSkp[] = SKP_JABATAN_2026[jabatanUtama].map((d) =>
    hitungRhk(d, jabatanUtama, dasarKonteks, false)
  );

  // Blok tambahan: RHK jabatan rangkap lain (mis. Panitera yang juga PP).
  const tambahan: RincianRhkSkp[] = [];
  if (m.sertakanTambahan !== false) {
    for (const j of m.pegawai.jabatanTambahan) {
      if (j === jabatanUtama) continue;
      for (const d of SKP_JABATAN_2026[j]) tambahan.push(hitungRhk(d, j, dasarKonteks, true));
    }
  }

  const catatan: string[] = [KALIMAT_USULAN_SKP];
  if (m.data === null) catatan.push("Data SIPP tidak terjangkau saat dokumen disusun; semua indikator dari SIPP tampil \"—\".");
  else if (akun.length === 0) {
    catatan.push(
      "Pegawai ini belum ditautkan ke akun SIPP yang aktif pada periode ini; indikator dari SIPP tampil \"—\" dan perlu diisi manual dengan bukti."
    );
  }
  if (m.data) catatan.push(...m.data.catatan.filter(Boolean));
  catatan.push(
    "Penyebut nol dan data yang tidak terbaca ditulis \"—\"; keduanya tidak pernah dihitung sebagai 0.",
    "Perilaku kerja dan predikat kinerja periodik diisi manual oleh pejabat penilai."
  );
  const draf = (m.isian ?? []).filter(
    (i) => i.userId === m.pegawai.userId && i.periode === m.periode.kunci && i.tahun === m.periode.tahun && i.status === "draf"
  ).length;
  if (draf > 0) catatan.push(`${angkaSkp(draf)} isian manual masih berstatus draf dan belum dihitung.`);

  const lembar: LembarSkp = {
    jenis: m.jenis,
    periode: m.periode,
    pegawai: m.pegawai,
    pejabatPenilai: m.pejabatPenilai,
    rhk: rincian.map((r) => r.rhk),
    perilakuKerja: [...PERILAKU_KERJA_SKP],
    blokTambahan: tambahan.map((r) => r.rhk),
    catatan,
    galat: m.data ? [...m.data.galat] : [],
    dihitungPada,
  };
  return { lembar, rincian: [...rincian, ...tambahan] };
}

/** Bukti isian manual yang dipakai sebuah RHK (judul, rujukan, tanggal). */
export function buktiIsianRhk(r: RincianRhkSkp): BuktiIsianSkp[] {
  return r.hasil.flatMap((h) => h.isian?.bukti ?? []);
}
