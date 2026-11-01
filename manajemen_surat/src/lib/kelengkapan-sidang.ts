/**
 * ============================================================================
 * KELENGKAPAN HARI SIDANG (N1, 1 Nov 2026) - ATURAN MURNI
 * ============================================================================
 *
 * Tiap pagi hari kerja, perkara yang bersidang HARI INI dan hari kerja BERIKUTNYA dinilai: sudah lengkapkah bahannya,
 * dan siapa yang perlu bergerak. Berkas ini tidak menyentuh jaringan maupun basis data; fakta datang dari bot
 * (aleta_bot/services/kelengkapanSidangService.js) dan pemakainya (agen, lonceng, WhatsApp, lencana Jadwal Sidang)
 * semua membaca keluaran fungsi yang SAMA - satu sumber aturan.
 *
 * TIDAK ADA ATURAN HUKUM BARU DI SINI. Keabsahan panggilan (tenggang, retur, jalur biasa/tercatat/elektronik) sudah
 * dinilai mesin panggilan bot yang juga memberi penanda panggilan di Jadwal Sidang; di sini hasilnya hanya
 * DITERJEMAHKAN menjadi kalimat dan penanggung jawab. Jenis agenda dan hitungan saksi memakai agen-h1-bas.
 *
 * TIGA TINGKAT (lencana hijau/kuning/merah):
 *   siap        tidak ada butir
 *   perhatian   ada yang perlu dilengkapi, sidang tetap dapat berjalan
 *   tidak-siap  ada yang membuat sidang tidak sah / tertunda bila dibiarkan (panggilan belum ada atau tidak patut,
 *               surat kembali, mediator belum ada, dokumen e-Court yang dituntut agenda hari ini belum masuk)
 *
 * Butir berjenis "info" hanya tampil di rincian dan TIDAK membunyikan lonceng atau telepon siapa pun: pelajaran
 * penjaga tenggat - peringatan yang sering keliru berhenti dibaca.
 */
import { jenisAgendaH1, JENIS_AGENDA_TEKS, saksiH1, type JenisAgendaH1 } from "@/lib/agen-h1-bas";
import { sebutTanggalPanjang } from "@/lib/hari-libur";
import { sebutanPihakPerkara } from "@/lib/sebutan-pihak";

const teks = (x: unknown) => String(x ?? "").trim();
const angka = (x: unknown) => (Number.isFinite(Number(x)) ? Number(x) : 0);

// ============================================================================
// BENTUK
// ============================================================================

export type PeranKelengkapan = "pp" | "jurusita" | "hakim" | "kasir";
export type KunciButir = "relaas" | "bas" | "saksi" | "ecourt" | "panjar" | "mediasi" | "kuasa";
export type TingkatButir = "merah" | "kuning" | "info";
export type TingkatSidang = "siap" | "perhatian" | "tidak-siap";

export const NAMA_PERAN: Record<PeranKelengkapan, string> = { pp: "Panitera Pengganti", jurusita: "Jurusita", hakim: "Majelis Hakim", kasir: "Kasir" };

export type ButirKelengkapan = {
  kunci: KunciButir;
  tingkat: TingkatButir;
  /** Judul pendek (satu baris pesan). */
  judul: string;
  /** Rincian satu-dua kalimat untuk title/ikon (i). */
  uraian: string;
  /** Siapa yang bertanggung jawab; pesan hanya dikirim ke yang namanya tercantum pada peran itu di perkaranya. */
  peran: PeranKelengkapan[];
};

/** Fakta satu sidang dari bot (lihat kelengkapanSidangService.ringkasSidang + tambahannya). Semua ruas boleh kosong. */
export type FaktaSidangKelengkapan = {
  sidangId?: string;
  perkaraId?: string;
  nomorPerkara?: string;
  jenisPerkara?: string;
  alurPerkaraId?: number | null;
  tanggalSidang?: string;
  jamSidang?: string;
  urutanSidang?: number;
  agenda?: string;
  sidangIkrarTalak?: boolean;
  lewatEcourt?: boolean;
  majelisNama?: string;
  paniteraNama?: string;
  jurusitaNama?: string;
  saksiPihak1?: number;
  saksiPihak2?: number;
  panggilan?: {
    wajibDipanggil?: number[];
    belumDipanggil?: number;
    sisiBelumDipanggil?: number[];
    retur?: number;
    returSebab?: string[];
    tenggangMepet?: boolean;
    tenggangTersempit?: {
      sisi?: number;
      dinilai?: boolean;
      patut?: boolean | null;
      selisih?: number | null;
      ambang?: number | null;
      alasan?: string;
      jalur?: string;
      hariKerja?: boolean;
      ambangTerima?: number | null;
      terimaHariKerja?: boolean;
    } | null;
    sisaHariKeSidang?: number | null;
  } | null;
  mediasi?: { ditunjuk?: string; dimulai?: string; hasil?: string; keputusan?: string; laporan?: string; mediator?: string } | null;
  mediasiTerbaca?: boolean;
  basLalu?: { terbaca?: boolean; tanggal?: string; agenda?: string; ada?: boolean; hasilTercatat?: boolean; jatuhTempo?: boolean } | null;
  basTerbaca?: boolean;
  kuasa?: { terbaca?: boolean; jumlah?: number; tanpaRegister?: Array<{ pihakKe?: number; nama?: string }> } | null;
  ecourt?: { keadaan?: string; menunggu?: number; dokumen?: number; jenisDituntut?: string[]; sidangLalu?: string } | null;
  panjar?: { terbaca?: boolean; prodeo?: boolean; saldo?: number; kurang?: number; panggilTerakhir?: number } | null;
};

export type BahanNilai = {
  /** YYYY-MM-DD menurut jam pengadilan. */
  hariIni: string;
  /** Jumlah saksi yang sudah punya tanya jawab di ABT (null = tidak terbaca / tidak ditanyakan). */
  saksiBertanyaJawab?: number | null;
};

export type PenilaianSidang = {
  perkaraId: string;
  sidangId: string;
  nomorPerkara: string;
  tanggalSidang: string;
  jamSidang: string;
  urutanSidang: number;
  agenda: string;
  jenisAgenda: JenisAgendaH1;
  majelisNama: string;
  paniteraNama: string;
  jurusitaNama: string;
  tingkat: TingkatSidang;
  butir: ButirKelengkapan[];
};

// ============================================================================
// KALIMAT
// ============================================================================

const rupiah = (n: number) => `Rp${Math.round(n).toLocaleString("id-ID")}`;

function sisiTeks(f: FaktaSidangKelengkapan, sisi: number): string {
  const s = sebutanPihakPerkara({ alurPerkaraId: f.alurPerkaraId ?? null, jenisPerkaraNama: f.jenisPerkara, nomorPerkara: f.nomorPerkara });
  return sisi === 1 ? s.satu : sisi === 2 ? s.dua : "salah satu pihak";
}

/** Sebab penilaian tenggang dari mesin panggilan bot -> kalimat (kode alasan tidak pernah tampil). */
export function kalimatSebabTenggang(t: NonNullable<NonNullable<FaktaSidangKelengkapan["panggilan"]>["tenggangTersempit"]>): string {
  const selisih = t.selisih === null || t.selisih === undefined ? null : angka(t.selisih);
  const ambang = t.ambang === null || t.ambang === undefined ? null : angka(t.ambang);
  const ambangTerima = t.ambangTerima === null || t.ambangTerima === undefined ? ambang : angka(t.ambangTerima);
  const satuanKirim = t.hariKerja ? "hari kerja" : "hari";
  const satuanTerima = t.terimaHariKerja ? "hari kerja" : "hari";
  switch (teks(t.alasan)) {
    case "dikirim_setelah_hari_sidang":
      return "dikirim setelah hari sidang";
    case "diterima_setelah_hari_sidang":
      return "diterima setelah hari sidang";
    case "tenggang_kurang_dari_ambang":
      return selisih !== null && ambang !== null ? `dikirim ${selisih} ${satuanKirim} sebelum sidang (paling sedikit ${ambang})` : "dikirim kurang dari tenggang";
    case "diterima_kurang_dari_ambang":
      return selisih !== null && ambangTerima !== null ? `diterima ${selisih} ${satuanTerima} sebelum sidang (paling sedikit ${ambangTerima})` : "diterima kurang dari tenggang";
    case "belum_diterima":
      return "surat belum diterima pihak";
    case "penerimaan_belum_terbukti":
      return "bukti penerimaan surat belum ada";
    case "belum_dipanggil_sidang_sudah_dekat":
      return "belum dipanggil sedangkan sidang sudah dekat";
    default:
      return "tidak memenuhi tenggang";
  }
}

function labelHari(tanggal: string, hariIni: string): string {
  if (tanggal === hariIni) return "hari ini";
  return sebutTanggalPanjang(tanggal);
}

// ============================================================================
// PENILAIAN
// ============================================================================

/** Agenda laporan/hasil mediasi (pola yang sama dengan court-calendar-sinkron / bot). */
const POLA_LAPORAN_MEDIASI = /(laporan|hasil)\s+(hasil\s+)?medias/i;

function butirRelaas(f: FaktaSidangKelengkapan, bahan: BahanNilai): ButirKelengkapan[] {
  const p = f.panggilan;
  if (!p) return [];
  const hasil: ButirKelengkapan[] = [];
  const peran: PeranKelengkapan[] = ["jurusita"];
  const belum = (p.sisiBelumDipanggil ?? []).map(Number);
  const wajib = (p.wajibDipanggil ?? []).map(Number);
  if (angka(p.belumDipanggil) > 0) {
    const pihak = (belum.length ? belum : wajib).map((s) => sisiTeks(f, s));
    hasil.push({
      kunci: "relaas",
      tingkat: "merah",
      judul: `Relaas panggilan ${[...new Set(pihak)].join(" dan ") || "pihak"} belum ada`,
      uraian: `Belum ada relaas panggilan untuk ${[...new Set(pihak)].join(" dan ") || "pihak yang wajib dipanggil"} pada sidang ${labelHari(teks(f.tanggalSidang), bahan.hariIni)}. Sidang tidak dapat berjalan sah tanpa panggilan yang patut.`,
      peran: [...peran, "pp"],
    });
  }
  if (angka(p.retur) > 0) {
    const sebab = (p.returSebab ?? []).map(teks).filter(Boolean);
    hasil.push({
      kunci: "relaas",
      tingkat: "merah",
      judul: `Surat panggilan kembali (retur)${sebab.length ? `: ${sebab[0]}` : ""}`,
      uraian: `${angka(p.retur)} surat panggilan kembali ke pengadilan${sebab.length ? ` - ${sebab.join("; ")}` : ""}. Perlu ditindaklanjuti (panggilan ulang atau lewat lurah/kepala desa) sebelum sidang.`,
      peran: [...peran, "pp"],
    });
  }
  const t = p.tenggangTersempit;
  if (t && t.dinilai) {
    if (t.patut === false) {
      const sebab = kalimatSebabTenggang(t);
      hasil.push({
        kunci: "relaas",
        tingkat: "merah",
        judul: `Panggilan ${sisiTeks(f, angka(t.sisi))} belum patut: ${sebab}`,
        uraian: `Panggilan ${sisiTeks(f, angka(t.sisi))}: ${sebab}. Tenggang dihitung menurut jalur panggilannya (SEMA 1/2023 untuk surat tercatat, Pasal 718 RBg untuk jurusita, ketentuan e-Court untuk panggilan elektronik).`,
        peran: [...peran, "hakim"],
      });
    } else if (t.patut === null && angka(p.retur) === 0) {
      // Surat yang kembali (retur) sudah dilaporkan merah di atas; "belum diterima" untuk relaas yang sama hanya menggandakan.

      hasil.push({
        kunci: "relaas",
        tingkat: "kuning",
        judul: `Panggilan ${sisiTeks(f, angka(t.sisi))}: ${kalimatSebabTenggang(t)}`,
        uraian: `Tenggang panggilan ${sisiTeks(f, angka(t.sisi))} sudah cukup, tetapi ${kalimatSebabTenggang(t)}. Telusuri pengirimannya.`,
        peran,
      });
    }
  }
  // Mepet tanpa satu pun butir di atas (mis. sidang dekat, relaas ada tetapi tenggangnya tipis): kuning.
  if (p.tenggangMepet && hasil.length === 0) {
    hasil.push({
      kunci: "relaas",
      tingkat: "kuning",
      judul: "Tenggang panggilan mepet",
      uraian: "Tenggang panggilan ke sidang ini tinggal sedikit. Pastikan relaas sudah masuk dan patut.",
      peran,
    });
  }
  return hasil;
}

function butirBas(f: FaktaSidangKelengkapan): ButirKelengkapan[] {
  const b = f.basLalu;
  if (!b || b.terbaca === false || !b.tanggal || !b.jatuhTempo || b.ada) return [];
  return [
    {
      kunci: "bas",
      tingkat: "kuning",
      judul: `BAS sidang ${sebutTanggalPanjang(b.tanggal)} belum diunggah`,
      uraian: `Berita Acara Sidang ${sebutTanggalPanjang(b.tanggal)}${teks(b.agenda) ? ` (${teks(b.agenda)})` : ""} belum diunggah ke e-Doc SIPP.`,
      peran: ["pp"],
    },
  ];
}

function butirSaksi(f: FaktaSidangKelengkapan, jenis: JenisAgendaH1, bahan: BahanNilai): ButirKelengkapan[] {
  if (jenis !== "pembuktian") return [];
  const s = saksiH1({ saksiPihak1: f.saksiPihak1, saksiPihak2: f.saksiPihak2 }, []);
  const terdaftar = s.terdaftarP + s.terdaftarT;
  if (!terdaftar) {
    return [
      {
        kunci: "saksi",
        tingkat: "kuning",
        judul: "Saksi belum tercatat di SIPP",
        uraian: "Sidang pembuktian, tetapi belum ada saksi yang tercatat di SIPP. Catat saksi yang diajukan agar tanya jawabnya dapat disusun.",
        peran: ["pp"],
      },
    ];
  }
  if (bahan.saksiBertanyaJawab === null || bahan.saksiBertanyaJawab === undefined) return [];
  const kurang = terdaftar - angka(bahan.saksiBertanyaJawab);
  if (kurang <= 0) return [];
  return [
    {
      kunci: "saksi",
      tingkat: "kuning",
      judul: `${kurang} saksi belum punya tanya jawab`,
      uraian: `${terdaftar} saksi tercatat, ${kurang} belum punya tanya jawab di blangko; tersusun sendiri saat penyunting tanya jawab saksi dibuka.`,
      peran: ["pp"],
    },
  ];
}

function butirEcourt(f: FaktaSidangKelengkapan, bahan: BahanNilai): ButirKelengkapan[] {
  const e = f.ecourt;
  if (!e) return [];
  const hariIni = teks(f.tanggalSidang) === bahan.hariIni;
  const dituntut = (e.jenisDituntut ?? []).map(teks).filter(Boolean);
  if (e.keadaan === "belum-upload") {
    const apa = dituntut.length ? dituntut.join("/") : "dokumen yang dituntut agenda";
    return [
      {
        kunci: "ecourt",
        tingkat: hariIni ? "merah" : "kuning",
        judul: `Dokumen e-Court belum masuk: ${apa}`,
        uraian: `Agenda sidang menuntut ${apa}, tetapi sejak sidang${teks(e.sidangLalu) ? ` ${sebutTanggalPanjang(teks(e.sidangLalu))}` : " sebelumnya"} belum ada dokumen yang diunggah di e-Court.`,
        peran: ["pp", "hakim"],
      },
    ];
  }
  if (e.keadaan === "belum" && angka(e.menunggu) > 0) {
    return [
      {
        kunci: "ecourt",
        tingkat: "kuning",
        judul: `${angka(e.menunggu)} dokumen e-Court menunggu verifikasi majelis`,
        uraian: `${angka(e.menunggu)} dokumen persidangan di e-Court belum diverifikasi majelis.`,
        peran: ["hakim"],
      },
    ];
  }
  return [];
}

function butirPanjar(f: FaktaSidangKelengkapan, jenis: JenisAgendaH1): ButirKelengkapan[] {
  const j = f.panjar;
  if (!j || j.terbaca === false || j.prodeo) return [];
  if (jenis === "putusan" || jenis === "ikrar") return [];
  const saldo = angka(j.saldo);
  const kurang = angka(j.kurang);
  if (kurang > 0 || saldo < 0) {
    const jumlah = kurang > 0 ? kurang : -saldo;
    return [
      {
        kunci: "panjar",
        tingkat: "kuning",
        judul: `Panjar kurang ${rupiah(jumlah)}`,
        uraian: `Saldo panjar ${rupiah(saldo)} tidak cukup untuk biaya yang sudah diusulkan; Kasir menawarkan Tambahan Panjar ${rupiah(jumlah)}. Pastikan pihak sudah membayarnya.`,
        peran: ["kasir"],
      },
    ];
  }
  // Menipis: ada sisa, tetapi kurang dari satu panggilan (biaya panggilan terbesar yang pernah dijurnal perkara ini),
  // sedangkan masih ada pihak yang wajib dipanggil. Sisa PERSIS nol tidak diperingatkan: pada data satker, saldo nol
  // lazim pada perkara yang panggilannya sudah dibayar semua, sehingga peringatan itu hampir selalu keliru.
  const wajib = (f.panggilan?.wajibDipanggil ?? []).length;
  const panggil = angka(j.panggilTerakhir);
  if (saldo > 0 && panggil > 0 && saldo < panggil && wajib > 0) {
    return [
      {
        kunci: "panjar",
        tingkat: "info",
        judul: `Sisa panjar ${rupiah(saldo)} kurang dari satu panggilan`,
        uraian: `Sisa panjar ${rupiah(saldo)}, biaya panggilan terakhir ${rupiah(panggil)}. Bila sidang ditunda dan pihak harus dipanggil lagi, perlu tambahan panjar.`,
        peran: ["kasir"],
      },
    ];
  }
  return [];
}

function butirMediasi(f: FaktaSidangKelengkapan, jenis: JenisAgendaH1): ButirKelengkapan[] {
  if (jenis !== "mediasi" || f.mediasiTerbaca === false) return [];
  const m = f.mediasi;
  const laporan = POLA_LAPORAN_MEDIASI.test(teks(f.agenda));
  if (laporan) {
    if (m && (teks(m.laporan) || teks(m.hasil) || teks(m.keputusan))) return [];
    return [
      {
        kunci: "mediasi",
        tingkat: "kuning",
        judul: "Laporan hasil mediasi belum masuk",
        uraian: "Sidang mendengarkan hasil mediasi, tetapi laporan/hasil mediasi belum tercatat di SIPP.",
        peran: ["hakim", "pp"],
      },
    ];
  }
  if (m && teks(m.mediator)) return [];
  return [
    {
      kunci: "mediasi",
      tingkat: "merah",
      judul: "Mediator belum ditunjuk",
      uraian: "Agenda sidang mediasi, tetapi belum ada mediator yang ditunjuk di SIPP.",
      peran: ["hakim"],
    },
  ];
}

function butirKuasa(f: FaktaSidangKelengkapan): ButirKelengkapan[] {
  const k = f.kuasa;
  if (!k || k.terbaca === false) return [];
  const tanpa = (k.tanpaRegister ?? []).filter((x) => teks(x.nama));
  if (!tanpa.length) return [];
  const nama = tanpa.slice(0, 2).map((x) => teks(x.nama));
  const lain = tanpa.length - nama.length;
  const sebut = `${nama.join(", ")}${lain > 0 ? ` dan ${lain} lainnya` : ""}`;
  return [
    {
      kunci: "kuasa",
      tingkat: "kuning",
      judul: `Surat kuasa ${sebut} belum terdaftar`,
      uraian: `Kuasa ${sebut} tercatat di SIPP tanpa nomor dan tanggal register surat kuasa.`,
      peran: ["pp"],
    },
  ];
}

const URUT_TINGKAT: Record<TingkatButir, number> = { merah: 0, kuning: 1, info: 2 };

/** Menilai satu sidang. Tidak ada sidang ikrar/putus yang dikecualikan di sini: pemanggil sudah menyaring sidangnya. */
export function nilaiSidang(f: FaktaSidangKelengkapan, bahan: BahanNilai): PenilaianSidang {
  const jenis = jenisAgendaH1({ agenda: f.agenda, sidangIkrarTalak: f.sidangIkrarTalak });
  const butir = [
    ...butirRelaas(f, bahan),
    ...butirEcourt(f, bahan),
    ...butirMediasi(f, jenis),
    ...butirBas(f),
    ...butirSaksi(f, jenis, bahan),
    ...butirKuasa(f),
    ...butirPanjar(f, jenis),
  ].sort((a, b) => URUT_TINGKAT[a.tingkat] - URUT_TINGKAT[b.tingkat]);
  const tingkat: TingkatSidang = butir.some((b) => b.tingkat === "merah") ? "tidak-siap" : butir.some((b) => b.tingkat === "kuning") ? "perhatian" : "siap";
  return {
    perkaraId: teks(f.perkaraId),
    sidangId: teks(f.sidangId),
    nomorPerkara: teks(f.nomorPerkara),
    tanggalSidang: teks(f.tanggalSidang).slice(0, 10),
    jamSidang: teks(f.jamSidang),
    urutanSidang: angka(f.urutanSidang),
    agenda: teks(f.agenda),
    jenisAgenda: jenis,
    majelisNama: teks(f.majelisNama),
    paniteraNama: teks(f.paniteraNama),
    jurusitaNama: teks(f.jurusitaNama),
    tingkat,
    butir,
  };
}

// ============================================================================
// LENCANA JADWAL SIDANG
// ============================================================================

export type RingkasKesiapan = { perkaraId: string; tanggalSidang: string; tingkat: TingkatSidang; teks: string; jumlah: number; keterangan: string };

/** Butir yang dihitung di lencana: tanpa "info". */
const butirAktif = (p: PenilaianSidang) => p.butir.filter((b) => b.tingkat !== "info");

export function teksLencanaKesiapan(tingkat: TingkatSidang, jumlah: number): string {
  if (tingkat === "siap") return "Siap sidang";
  return tingkat === "tidak-siap" ? `Belum siap (${jumlah})` : `Perlu dilengkapi (${jumlah})`;
}

/** Keterangan panjang untuk title / ikon (i): satu butir per baris, yang merah dahulu. */
export function keteranganKesiapan(p: PenilaianSidang): string {
  if (!p.butir.length) return `Bahan sidang ${sebutTanggalPanjang(p.tanggalSidang)} (${JENIS_AGENDA_TEKS[p.jenisAgenda]}) sudah lengkap menurut pemeriksaan pagi.`;
  return p.butir.map((b) => `${b.tingkat === "merah" ? "[!] " : b.tingkat === "info" ? "(catatan) " : ""}${b.uraian}`).join("\n");
}

export function ringkasKesiapan(p: PenilaianSidang): RingkasKesiapan {
  const jumlah = butirAktif(p).length;
  return { perkaraId: p.perkaraId, tanggalSidang: p.tanggalSidang, tingkat: p.tingkat, teks: teksLencanaKesiapan(p.tingkat, jumlah), jumlah, keterangan: keteranganKesiapan(p) };
}

// ============================================================================
// SIAPA MELIHAT BUTIR APA
// ============================================================================

/**
 * Butir panjar memuat angka keuangan perkara: hanya Kasir, pimpinan, kepaniteraan (panitera, panmud, PP) dan admin yang
 * melihatnya. Butir lain tampil bagi semua yang melihat Jadwal Sidang. Tingkat sidang dihitung ulang atas butir yang tampak,
 * supaya lencana seorang juru sita tidak merah karena panjar yang tidak boleh dibacanya.
 */
const GOLONGAN_LIHAT_PANJAR = new Set(["kasir", "pimpinan", "panitera", "panmud", "pp", "admin", "super-admin"]);

export function saringUntukGolongan(p: PenilaianSidang, golongan: readonly string[]): PenilaianSidang {
  const boleh = golongan.some((g) => GOLONGAN_LIHAT_PANJAR.has(String(g).toLowerCase()));
  if (boleh) return p;
  const butir = p.butir.filter((b) => b.kunci !== "panjar");
  if (butir.length === p.butir.length) return p;
  const tingkat: TingkatSidang = butir.some((b) => b.tingkat === "merah") ? "tidak-siap" : butir.some((b) => b.tingkat === "kuning") ? "perhatian" : "siap";
  return { ...p, butir, tingkat };
}

// ============================================================================
// PENANGGUNG JAWAB, PESAN, LONCENG
// ============================================================================

export type IdentitasPetugas = {
  id: string;
  nama: string;
  nomorWa: string;
  /** Golongan menurut matriks peran: "hakim", "pp", "jurusita", "kasir", ... */
  golongan: readonly string[];
};

export type BarisUntukPetugas = { penilaian: PenilaianSidang; butir: ButirKelengkapan[]; sebagai: PeranKelengkapan[] };

/**
 * Perkara-perkara (beserta butirnya) yang menjadi tanggung jawab seorang petugas. Peran yang melekat pada PERKARA
 * (PP, jurusita, hakim) hanya berlaku bila namanya tercantum di ruas itu; Kasir (peran satker) menerima butir kasir
 * seluruh satker. Butir "info" tidak pernah dikirim. `cocokNama` disuntikkan (namaAdaDi) supaya berkas ini murni.
 */
export function butirUntukPetugas(daftar: readonly PenilaianSidang[], orang: Pick<IdentitasPetugas, "nama" | "golongan">, cocokNama: (nama: string, teksDaftar: string) => boolean): BarisUntukPetugas[] {
  const gol = new Set(orang.golongan.map((g) => String(g).toLowerCase()));
  const nama = teks(orang.nama);
  const hasil: BarisUntukPetugas[] = [];
  for (const p of daftar) {
    const peranOrang = new Set<PeranKelengkapan>();
    if (nama && p.paniteraNama && cocokNama(nama, p.paniteraNama)) peranOrang.add("pp");
    if (nama && p.jurusitaNama && cocokNama(nama, p.jurusitaNama)) peranOrang.add("jurusita");
    if (nama && p.majelisNama && cocokNama(nama, p.majelisNama)) peranOrang.add("hakim");
    if (gol.has("kasir")) peranOrang.add("kasir");
    if (peranOrang.size === 0) continue;
    const butir = p.butir.filter((b) => b.tingkat !== "info" && b.peran.some((r) => peranOrang.has(r)));
    if (butir.length) hasil.push({ penilaian: p, butir, sebagai: [...peranOrang] });
  }
  return hasil.sort((a, b) => a.penilaian.tanggalSidang.localeCompare(b.penilaian.tanggalSidang) || a.penilaian.jamSidang.localeCompare(b.penilaian.jamSidang) || a.penilaian.nomorPerkara.localeCompare(b.penilaian.nomorPerkara, "id", { numeric: true }));
}

export const BATAS_PESAN_KELENGKAPAN = 3200;

/**
 * Satu pesan WhatsApp per petugas per hari: perkara hari ini dahulu, lalu besok; satu baris per butir; yang merah ditandai.
 * Dipotong di batas baris (kalimat penutup menunjuk layar Jadwal Sidang). Kosong bila tidak ada baris.
 */
export function susunPesanKelengkapan(o: { nama: string; hariIni: string; baris: readonly BarisUntukPetugas[]; satker?: string }): string {
  if (!o.baris.length) return "";
  const kepala = [`KESIAPAN SIDANG${o.satker ? ` - ${o.satker}` : ""}`, `Untuk: ${o.nama}`, ""];
  const tanggal = [...new Set(o.baris.map((b) => b.penilaian.tanggalSidang))].sort();
  const badan: string[] = [];
  let merah = 0;
  let kuning = 0;
  for (const t of tanggal) {
    badan.push(t === o.hariIni ? `HARI INI (${sebutTanggalPanjang(t)})` : `${sebutTanggalPanjang(t)}`);
    for (const b of o.baris.filter((x) => x.penilaian.tanggalSidang === t)) {
      const jam = teks(b.penilaian.jamSidang).slice(0, 5);
      badan.push(`- ${b.penilaian.nomorPerkara.replace(/\/PA\.[A-Za-z]+$/, "")}${jam ? ` (${jam})` : ""}${b.penilaian.agenda ? ` - ${b.penilaian.agenda}` : ""}`);
      for (const x of b.butir) {
        if (x.tingkat === "merah") merah += 1;
        else kuning += 1;
        badan.push(`   ${x.tingkat === "merah" ? "[!]" : "[ ]"} ${x.judul}`);
      }
    }
    badan.push("");
  }
  const ringkas = `${merah ? `${merah} butir belum siap` : ""}${merah && kuning ? ", " : ""}${kuning ? `${kuning} perlu dilengkapi` : ""}.`;
  const penutup = ["Rincian ada di layar Jadwal Sidang (lencana Kesiapan sidang)."];
  let pesan = [...kepala, ringkas, "", ...badan, ...penutup].join("\n");
  if (pesan.length > BATAS_PESAN_KELENGKAPAN) {
    const potong = pesan.slice(0, BATAS_PESAN_KELENGKAPAN - 80);
    const akhir = potong.lastIndexOf("\n");
    pesan = `${potong.slice(0, akhir > 0 ? akhir : potong.length)}\n...selengkapnya di layar Jadwal Sidang.`;
  }
  return pesan;
}

export type RingkasanLoncengKelengkapan = { id: string; judul: string; uraian: string; penting: boolean };

/**
 * Satu butir lonceng per hari per akun. `penilaian` sudah disaring pemanggil (milik orang itu, atau semua untuk admin).
 * Tanpa butir bernilai (hanya info/siap) = tidak ada lonceng: hari bersih tidak membunyikan apa pun.
 */
export function ringkasLoncengKelengkapan(penilaian: readonly PenilaianSidang[], tanggal: string, semua: boolean): RingkasanLoncengKelengkapan | null {
  const aktif = penilaian.filter((p) => p.tingkat !== "siap");
  if (!aktif.length) return null;
  const merah = aktif.filter((p) => p.tingkat === "tidak-siap");
  const kuning = aktif.filter((p) => p.tingkat === "perhatian");
  const bagian: string[] = [];
  if (merah.length) bagian.push(`${merah.length} perkara belum siap`);
  if (kuning.length) bagian.push(`${kuning.length} perlu dilengkapi`);
  const contoh = [...new Set((merah.length ? merah : kuning).map((p) => p.nomorPerkara.replace(/\/PA\.[A-Za-z]+$/, "")))].slice(0, 3).join(", ");
  const banyak = new Set(aktif.map((p) => p.nomorPerkara)).size;
  return {
    id: `kelengkapan:${tanggal}:${semua ? "semua" : "saya"}`,
    judul: `Kesiapan sidang ${semua ? "satker" : "Anda"}: ${bagian.join(", ")}`,
    uraian: `${contoh}${banyak > 3 ? ", dan lainnya" : ""}. Rincian di Jadwal Sidang.`,
    penting: merah.length > 0,
  };
}

// ============================================================================
// HARI YANG DIPERIKSA
// ============================================================================

/** Tanggal yang diperiksa pagi `hariIni`: hari ini dan hari kerja berikutnya (`berikut` dari agen-h1-bas.hariKerjaBerikut). */
export function tanggalPeriksa(hariIni: string, berikut: string): string[] {
  return [...new Set([hariIni, berikut].filter((t) => /^\d{4}-\d{2}-\d{2}$/.test(t)))].sort();
}
