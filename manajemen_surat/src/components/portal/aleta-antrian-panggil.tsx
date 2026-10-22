"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PanelRuangPapanPanggil } from "@/components/portal/jadwal-sidang-2okt";
import { apiPath } from "@/lib/base-path";
import { selangPanggilan, warnaRuang } from "@/lib/antrian-tampilan";
import { hentikanUcapan, useSuaraPanggilan } from "@/lib/suara-panggilan";
import { usePengumumanSuara } from "@/lib/pengumuman-suara-layar";
import { cn } from "@/lib/utils";
import { KELAS_KODE_MAJELIS } from "@/lib/kode-majelis";
import { kalimatRingkas, ringkasKehadiran, susunKehadiran, type KehadiranOrang } from "@/lib/kehadiran-rinci"; /* F3.2 */
import { RingkasKehadiran } from "@/components/portal/kehadiran-rinci-sidang"; /* F3.2 */
import {
  hakimYangDipanggil,
  jabatanHakim,
  kalimatHakim,
  kalimatJuruSita,
  kalimatMediator,
  kalimatPanggilPihak,
  kalimatPanitera,
  kalimatPetugasMediasi,
  kalimatPetugasPersidangan,
  kalimatRohaniwan,
  kalimatSaksi,
  kalimatSaksiKetik,
  kalimatSemuaMajelis,
  kalimatSemuaSaksi,
  sisiSaksi,
  type HakimSidangPilihan,
  type OrangPanggil,
} from "@/lib/kalimat-panggilan"; /* W59: kalimat panggilan lengkap */

/**
 * ============================================================================
 * PAPAN PANGGIL - UNTUK PETUGAS DI RUANG SIDANG
 * ============================================================================
 *
 * Petugas yang memanggil sedang berdiri di depan pintu ruang sidang dengan
 * berkas di tangan. Ia tidak sedang membaca tabel, dan tidak akan menekan
 * tombol sebesar korek api.
 *
 * Maka SATU kartu besar menguasai layar - nomor berikutnya beserta tombolnya -
 * dan selebihnya mengalah. Yang sudah dipanggil turun menjadi baris tipis.
 *
 * ============================================================================
 * TIGA HAL YANG TIDAK DIMILIKI PAPAN PANGGIL BIASA
 * ============================================================================
 *
 * 1. HITUNGAN PANGGILAN. Tabel antrian hanya menyimpan satu jam panggil,
 *    sehingga ia tidak dapat menjawab "sudah dipanggil berapa kali". Padahal
 *    aturannya sudah dijanjikan kepada para pihak lewat WhatsApp: dipanggil
 *    tiga kali dan tidak hadir, perkaranya ditunda. Selama ini hitungan itu
 *    dijaga ingatan petugas yang kebetulan berjaga sejak pagi.
 *
 * 2. LAJU HARI INI - berapa menit rata-rata satu perkara, dihitung dari jarak
 *    NYATA antar panggilan hari ini. Petugas dapat menilai sendiri apakah hari
 *    ini tertinggal atau tidak.
 *
 * 3. SIAPA YANG SUDAH HADIR pada perkara berikutnya, terbaca SEBELUM memanggil
 *    - sehingga petugas tahu lebih dulu apakah pihak yang ditunggu memang
 *    sudah berada di ruang tunggu.
 */

type AntrianBaris = {
  nomor: number | null;
  keadaan: "menunggu" | "dipanggil" | "belum-ambil";
  jamPanggil: string;
  noRuang: number | null;
  majelisKode: string;
  waktuAmbil: string;
  online: boolean;
  /* F3.2: jam tiap sisi dan keadaan ruang - bahan ringkasan kehadiran. */
  pihak1?: string;
  pihak2?: string;
  saksi?: string;
  diRuang?: number | null;
  selesaiDisidang?: boolean;
};

type Kehadiran = {
  hadir: Array<KehadiranOrang & { sebutan: string; nama: string; jam: string }>;
  pertama: { sebutan: string } | null;
};

type Panggilan = {
  jumlah: number;
  batas: number;
  sudahBatas: boolean;
  panggilan: Array<{ urutan: number; jam: string; oleh: string }>;
};

type Jawaban = {
  available: boolean;
  message?: string;
  terbaca: boolean;
  alasan: string;
  tanggal: string[];
  peta: Record<string, AntrianBaris>;
  kehadiran?: Record<string, Kehadiran>;
  panggilan?: Record<string, Panggilan>;
};

/** Bahan kalimat panggilan satu perkara - dari rute sasaran (mode ringan). */
type SasaranPanggil = {
  nomorPerkara: string;
  jenisPerkara: string;
  orang: OrangPanggil[];
};

const SELANG_MS = 10000;
const SELANG_HAKIM_MS = 60000;
const UMUR_SASARAN_MS = 120000;
const KUNCI_NAMA_UMUM = "aleta.antrian.nama-petugas";

/** Tanggal setempat YYYY-MM-DD - hari sidang menurut jam petugas, bukan UTC. */
function tanggalLokal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Petugas yang tidak tercatat di SIPP: namanya diketik sekali, diingat di peramban ini. */
type NamaUmum = { rohaniwan: string; mediasi: string; persidangan: string };
const NAMA_UMUM_KOSONG: NamaUmum = { rohaniwan: "", mediasi: "", persidangan: "" };

function namaDari(sasaran: SasaranPanggil | null, golongan: string): string[] {
  return (sasaran?.orang ?? []).filter((o) => o.golongan === golongan).map((o) => o.nama);
}

/**
 * ============================================================================
 * PANGGILAN PETUGAS - PENGUMUMAN, BUKAN PERUBAHAN KEADAAN
 * ============================================================================
 *
 * Aplikasi antrian SIPP memanggil majelis, juru sita, rohaniwan, dan petugas
 * mediasi lewat pengeras suara. Panggilan itu TIDAK mengubah apa pun: nomor
 * antriannya tidak bergerak, dan tidak ada yang tercatat sebagai "sudah
 * dipanggil".
 *
 * ALETA menirunya persis begitu, dan itu disengaja. Kalau panggilan petugas
 * ikut menandai antrian, satu panggilan kepada rohaniwan akan menggeser nomor
 * yang sedang menunggu - dan pihak yang belum dipanggil terlewat tanpa jejak.
 *
 * Karena itu tombol-tombol ini hanya bersuara. Yang mengubah keadaan antrian
 * hanya satu: tombol Panggil pada kartu besar.
 *
 * Kalimatnya sengaja bersusun "siapa - dimohon - ke mana". Pengeras suara ruang
 * tunggu memantul, dan kata pertama yang terdengar harus sudah menjawab
 * "apakah ini untuk saya".
 */
type KonteksPetugas = { ruang: string; sasaran: SasaranPanggil | null; namaUmum: NamaUmum };

/**
 * Setiap panggilan menyebut NAMA, JABATAN, dan RUANG (kalimat-panggilan.ts).
 * Majelis hakim dipanggil per nama hakim di bagian tersendiri; yang di sini
 * panitera sidang dan petugas lain. Tombol-tombol ini tidak membaca apa pun
 * dari jaringan - bahannya sudah dimuat layar.
 */
const PANGGILAN_PETUGAS: Array<{ kunci: string; label: string; kalimat: (k: KonteksPetugas) => string }> = [
  {
    kunci: "majelis",
    label: "Semua majelis",
    kalimat: (k) =>
      kalimatSemuaMajelis(
        (k.sasaran?.orang ?? []).filter((o) => o.golongan === "majelis").map((o) => ({ nama: o.nama, peran: o.peran })),
        k.ruang
      ),
  },
  {
    kunci: "panitera",
    label: "Panitera sidang",
    kalimat: (k) => kalimatPanitera(namaDari(k.sasaran, "pp"), k.ruang),
  },
  {
    kunci: "jurusita",
    label: "Juru sita",
    kalimat: (k) => kalimatJuruSita(namaDari(k.sasaran, "js"), k.ruang),
  },
  {
    kunci: "rohaniwan",
    label: "Rohaniwan",
    kalimat: (k) => kalimatRohaniwan(k.namaUmum.rohaniwan, k.ruang),
  },
  {
    kunci: "mediasi",
    label: "Petugas mediasi",
    kalimat: (k) => kalimatPetugasMediasi(k.namaUmum.mediasi, k.ruang),
  },
  {
    kunci: "persidangan",
    label: "Petugas persidangan",
    kalimat: (k) => kalimatPetugasPersidangan(k.namaUmum.persidangan, k.ruang),
  },
  {
    // Mediator dipanggil ke RUANG MEDIASI, bukan ruang sidang.
    kunci: "mediator",
    label: "Mediator",
    kalimat: (k) => kalimatMediator(namaDari(k.sasaran, "mediator")),
  },
];

export function AletaAntrianPanggil() {
  const [data, setData] = useState<Jawaban | null>(null);
  const [ruang, setRuang] = useState(0);
  const [sibuk, setSibuk] = useState("");
  const [pesan, setPesan] = useState("");
  const [namaSaksi, setNamaSaksi] = useState("");
  const [namaUmum, setNamaUmum] = useState<NamaUmum>(NAMA_UMUM_KOSONG);
  const [muatanSasaran, setMuatanSasaran] = useState<{ id: string; data: SasaranPanggil | null }>({ id: "", data: null });
  const [kelilingAktif, setKelilingAktif] = useState(false);
  const [pilihanHakim, setPilihanHakim] = useState<Record<string, HakimSidangPilihan>>({});
  const cacheSasaran = useRef(new Map<string, { waktu: number; data: SasaranPanggil | null }>());

  /**
   * Suara mati sampai petugas menyalakannya sekali.
   *
   * Peramban memang menuntut sentuhan orang sebelum boleh bersuara, dan itu
   * kebetulan aturan yang bagus: layar yang tiba-tiba berbicara sendiri
   * sesudah dimuat ulang akan mengagetkan seisi ruangan.
   */
  const [suaraNyala, setSuaraNyala] = useState(false);
  const { daftar: daftarSuara, terpilih, pilih, bunyikan, didukung } = useSuaraPanggilan();
  // Panggilan petugas dari Jadwal Sidang/Mediasi lewat pengeras suara (butir 33).
  usePengumumanSuara({ nyala: suaraNyala, bunyikan });

  /**
   * Membaca antrian. TIDAK menyentuh keadaan layar - yang menulis hanya dua
   * pemakainya di bawah, dan masing-masing tahu kapan hasilnya masih layak.
   */
  const bacaAntrian = useCallback(async (): Promise<{ hasil: Jawaban | null; sebab: string }> => {
    try {
      const respons = await fetch(apiPath("/api/aleta-ecourt/antrian"), { cache: "no-store" });
      const isi = (await respons.json()) as { data?: Jawaban } | Jawaban;
      return { hasil: ("data" in isi && isi.data ? isi.data : isi) as Jawaban, sebab: "" };
    } catch (error) {
      return { hasil: null, sebab: error instanceof Error ? error.message : String(error) };
    }
  }, []);

  /** Penyegaran atas permintaan petugas - sesudah satu nomor dipanggil. */
  const ambil = useCallback(async () => {
    const { hasil, sebab } = await bacaAntrian();
    if (hasil) setData(hasil);
    else setPesan(sebab);
  }, [bacaAntrian]);

  // ==========================================================================
  // JAWABAN YANG TERLAMBAT TIDAK BOLEH DITULIS KE LAYAR YANG SUDAH PERGI
  // ==========================================================================
  //
  // Permintaan yang sedang di jalan tidak berhenti ketika layarnya dilepas.
  // Penanda hidup ini yang memutuskan hasilnya masih layak dipakai atau tidak
  // - keputusan yang tidak punya tempat selama penulisan keadaan tersembunyi
  // di dalam pengambilnya.
  useEffect(() => {
    let hidup = true;

    const segarkan = async () => {
      const { hasil, sebab } = await bacaAntrian();
      if (!hidup) return;
      if (hasil) setData(hasil);
      else setPesan(sebab);
    };

    void segarkan();
    const detak = setInterval(() => void segarkan(), SELANG_MS);
    return () => {
      hidup = false;
      clearInterval(detak);
    };
  }, [bacaAntrian]);

  /**
   * Nama dan sebutan orang pada satu perkara (hakim, panitera, juru sita,
   * mediator, para pihak, saksi). Dibaca dari rute sasaran mode ringan - baca
   * saja, tidak menulis apa pun - lalu diingat dua menit per perkara supaya
   * Panggil ulang tidak menunggu jaringan. Gagal baca = null: kalimat jatuh ke
   * bentuk lama (nomor antrian dan ruang), bukan diam.
   */
  const muatSasaran = useCallback(async (perkaraId: string): Promise<SasaranPanggil | null> => {
    const id = String(perkaraId || "");
    if (!id) return null;
    const ada = cacheSasaran.current.get(id);
    if (ada && Date.now() - ada.waktu < UMUR_SASARAN_MS && ada.data) return ada.data;
    try {
      const respons = await fetch(
        apiPath(
          `/api/aleta-ecourt/panggil/sasaran?perkaraId=${encodeURIComponent(id)}&tanggal=${tanggalLokal()}&ringan=1`
        ),
        { cache: "no-store" }
      );
      const isi = (await respons.json()) as { data?: Record<string, unknown> } & Record<string, unknown>;
      const j = (isi.data ?? isi) as {
        available?: boolean;
        perkara?: { nomorPerkara?: string; jenisPerkaraNama?: string };
        orang?: Array<Record<string, unknown>>;
      };
      if (!j || j.available === false || !Array.isArray(j.orang)) return null;
      const data: SasaranPanggil = {
        nomorPerkara: String(j.perkara?.nomorPerkara ?? ""),
        jenisPerkara: String(j.perkara?.jenisPerkaraNama ?? ""),
        orang: j.orang.map((o) => ({
          kunci: String(o.kunci ?? ""),
          nama: String(o.nama ?? ""),
          peran: String(o.peran ?? ""),
          golongan: String(o.golongan ?? ""),
        })),
      };
      cacheSasaran.current.set(id, { waktu: Date.now(), data });
      return data;
    } catch {
      return null;
    }
  }, []);

  // Nama petugas umum (rohaniwan dst.) - diingat di peramban ini saja.
  useEffect(() => {
    try {
      const mentah = window.localStorage.getItem(KUNCI_NAMA_UMUM);
      // Nama tersimpan hanya ada di peramban, tidak di server: harus dibaca sesudah komponen terpasang.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (mentah) setNamaUmum({ ...NAMA_UMUM_KOSONG, ...(JSON.parse(mentah) as Partial<NamaUmum>) });
    } catch {
      /* penyimpanan peramban dapat tertutup - isian tetap berfungsi tanpa ingatan */
    }
  }, []);

  const ubahNamaUmum = useCallback((kunci: keyof NamaUmum, nilai: string) => {
    setNamaUmum((lama) => {
      const baru = { ...lama, [kunci]: nilai };
      try {
        window.localStorage.setItem(KUNCI_NAMA_UMUM, JSON.stringify(baru));
      } catch {
        /* lihat di atas */
      }
      return baru;
    });
  }, []);

  // Sidang keliling: hakim yang dipilih untuk satu perkara menggantikan majelis
  // BILA saklar keliling hari ini menyala. Gagal baca = majelis seperti biasa.
  useEffect(() => {
    let hidup = true;
    const baca = async () => {
      const tanggal = tanggalLokal();
      try {
        const [k, h] = await Promise.all([
          fetch(apiPath(`/api/aleta-ecourt/sidang/keliling?tanggal=${tanggal}`), { cache: "no-store" }).then((r) => r.json()),
          fetch(apiPath(`/api/aleta-ecourt/sidang/hakim-sidang?tanggal=${tanggal}`), { cache: "no-store" }).then((r) => r.json()),
        ]);
        if (!hidup) return;
        const kd = (k?.data ?? k) as { keliling?: { aktif?: boolean } };
        const hd = (h?.data ?? h) as { pilihan?: Record<string, HakimSidangPilihan> };
        setKelilingAktif(Boolean(kd?.keliling?.aktif));
        setPilihanHakim(hd?.pilihan && typeof hd.pilihan === "object" ? hd.pilihan : {});
      } catch {
        /* tanpa keterangan keliling, majelis tetap dipanggil per nama */
      }
    };
    void baca();
    const detak = setInterval(() => void baca(), SELANG_HAKIM_MS);
    return () => {
      hidup = false;
      clearInterval(detak);
    };
  }, []);

  const baris = useMemo(() => {
    const semua = Object.entries(data?.peta || {}).map(([perkaraId, satu]) => ({
      perkaraId,
      ...satu,
      hadir: data?.kehadiran?.[perkaraId]?.hadir ?? [],
      panggilan: data?.panggilan?.[perkaraId] ?? null,
    }));

    const seruang = semua.filter((x) => (ruang > 0 ? Number(x.noRuang) === ruang : true));
    return {
      semua: seruang,
      menunggu: seruang
        .filter((x) => x.keadaan === "menunggu" && x.nomor !== null)
        .sort((a, b) => Number(a.nomor) - Number(b.nomor)),
      dipanggil: seruang
        .filter((x) => x.keadaan === "dipanggil" && x.nomor !== null)
        .sort((a, b) => Number(a.nomor) - Number(b.nomor)),
    };
  }, [data, ruang]);

  const laju = useMemo(() => selangPanggilan(baris.semua), [baris.semua]);

  const panggil = useCallback(
    async (satu: {
      perkaraId: string;
      nomor: number | null;
      noRuang: number | null;
      panggilan?: Panggilan | null;
    }) => {
      setSibuk(satu.perkaraId);
      setPesan("");
      try {
        // Nama dan sebutan para pihak dimuat BERSAMAAN dengan pencatatan panggilan.
        const [respons, sasaran] = await Promise.all([
          fetch(apiPath("/api/aleta-ecourt/antrian/panggil"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              perkaraId: satu.perkaraId,
              nomorAntrian: satu.nomor,
              noRuang: satu.noRuang,
            }),
          }),
          suaraNyala ? muatSasaran(satu.perkaraId) : Promise.resolve(null),
        ]);
        const isi = (await respons.json()) as { data?: Record<string, unknown> };
        const hasil = (isi.data ?? isi) as { ok?: boolean; alasan?: string; keterangan?: string; urutan?: number };
        const keterangan = hasil.ok === false ? hasil.alasan || "Panggilan gagal." : hasil.keterangan || "Dipanggil.";
        setPesan(keterangan);

        // Diucapkan hanya bila panggilannya BERHASIL tercatat. Suara yang
        // berbunyi atas panggilan yang gagal membuat petugas mengira nomornya
        // sudah bergerak, lalu meneruskan ke nomor berikutnya - dan yang
        // pertama tidak pernah benar-benar dipanggil.
        if (hasil.ok !== false && suaraNyala && satu.nomor !== null) {
          const kalimat = kalimatPanggilPihak({
            nomorAntrian: satu.nomor,
            noRuang: satu.noRuang,
            // Urutan dari catatan (sesudah panggilan ini dicatat); cadangannya hitungan lama + 1.
            panggilanKe: Number(hasil.urutan) || (satu.panggilan?.jumlah ?? 0) + 1,
            nomorPerkara: sasaran?.nomorPerkara,
            jenisPerkara: sasaran?.jenisPerkara,
            orang: sasaran?.orang,
          });
          bunyikan(kalimat);
          setPesan(`${keterangan} Diucapkan: ${kalimat}`);
        }

        await ambil();
      } catch (error) {
        setPesan(error instanceof Error ? error.message : String(error));
      } finally {
        setSibuk("");
      }
    },
    [ambil, suaraNyala, bunyikan, muatSasaran]
  );

  const berikutnya = baris.menunggu[0] || null;
  const warna = warnaRuang(berikutnya?.noRuang ?? (ruang || null));

  /**
   * Sebutan ruang yang diucapkan.
   *
   * Ruang yang belum ditetapkan TIDAK disebut "ruang nol". Kalimatnya berubah
   * menjadi tanpa ruang - lebih baik memanggil tanpa menyebut tempat daripada
   * mengirim orang ke ruang yang tidak ada.
   */
  const sebutanRuang = useMemo(() => {
    const nomor = berikutnya?.noRuang ?? (ruang || null);
    return nomor && nomor > 0 ? `Ruang Sidang ${nomor}` : "ruang sidang";
  }, [berikutnya, ruang]);

  /** Perkara pada kartu BERIKUTNYA - nama petugas dan para pihaknya dimuat lebih dulu. */
  const idBerikutnya = berikutnya?.perkaraId ?? "";
  useEffect(() => {
    let hidup = true;
    if (!idBerikutnya) return () => undefined;
    void muatSasaran(idBerikutnya).then((hasil) => {
      if (!hidup) return;
      setMuatanSasaran({ id: idBerikutnya, data: hasil });
    });
    return () => {
      hidup = false;
    };
  }, [idBerikutnya, muatSasaran]);
  // Muatan milik perkara lain (kartu sudah berganti) tidak dipakai.
  const sasaranBerikutnya = muatanSasaran.id === idBerikutnya ? muatanSasaran.data : null;

  /** Mengucapkan satu kalimat (atau beberapa, berurutan), bila suaranya sudah dinyalakan petugas. */
  const suarakan = useCallback(
    (kalimat: string | string[]) => {
      if (!suaraNyala) {
        setPesan("Suara masih mati. Nyalakan lebih dulu pada kendali suara di atas.");
        return;
      }
      const daftar = (Array.isArray(kalimat) ? kalimat : [kalimat]).filter(Boolean);
      for (const satu of daftar) bunyikan(satu);
      setPesan(`Diucapkan: ${daftar.join(" ")}`);
    },
    [suaraNyala, bunyikan]
  );

  const konteksPetugas: KonteksPetugas = { ruang: sebutanRuang, sasaran: sasaranBerikutnya, namaUmum };

  // Majelis perkara pada kartu: satu per nama hakim; sidang keliling dengan satu hakim pilihan
  // menggantikan majelis penuh.
  const hakimTombol = useMemo(() => {
    const majelis = (sasaranBerikutnya?.orang ?? [])
      .filter((o) => o.golongan === "majelis")
      .map((o) => ({ nama: o.nama, peran: o.peran }));
    return hakimYangDipanggil(majelis, pilihanHakim[idBerikutnya], kelilingAktif);
  }, [sasaranBerikutnya, pilihanHakim, idBerikutnya, kelilingAktif]);

  const saksiTercatat = useMemo(
    () =>
      (sasaranBerikutnya?.orang ?? [])
        .filter((o) => o.golongan === "saksi1" || o.golongan === "saksi2")
        .map((o) => ({ kunci: o.kunci || o.nama, nama: o.nama, peran: o.peran })),
    [sasaranBerikutnya]
  );

  const panggilSaksi = useCallback(() => {
    const nama = namaSaksi.trim();
    if (!nama) {
      setPesan("Nama saksi belum diisi.");
      return;
    }
    // Nama diucapkan apa adanya. Menyingkatnya - "saksi pertama" - membuat
    // orang yang dipanggil tidak yakin dirinya yang dimaksud, lalu bertanya
    // kepada petugas, yang justru menghabiskan waktu yang hendak dihemat.
    suarakan(kalimatSaksiKetik(nama, sebutanRuang));
  }, [namaSaksi, sebutanRuang, suarakan]);

  return (
    <div className="space-y-4">
      {/* ── kepala: ruang, jumlah menunggu, laju hari ini ─────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {[0, 1, 2, 3, 4].map((nomor) => (
            <button
              key={`r-${nomor}`}
              type="button"
              onClick={() => setRuang(nomor)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm transition",
                ruang === nomor
                  ? "border-primary bg-primary/10 font-medium"
                  : "border-border text-muted-foreground hover:border-primary/40"
              )}
            >
              {nomor === 0 ? "Semua ruang" : `Ruang ${nomor}`}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            <span className="font-mono text-lg tabular-nums text-foreground">
              {baris.menunggu.length}
            </span>{" "}
            menunggu
          </span>
          {laju !== null ? (
            <span title="Dihitung dari jarak nyata antar panggilan hari ini.">
              <span className="font-mono text-lg tabular-nums text-foreground">{laju}</span> menit
              rata-rata
            </span>
          ) : null}
        </div>
      </div>

      {/* ── peringatan yang memang perlu dibaca ───────────────────────────── */}
      {data && data.tanggal && data.tanggal.length > 1 ? (
        <Peringatan>
          Antrian memuat {data.tanggal.length} tanggal ({data.tanggal.join(", ")}). Nomor dihitung
          dari seluruh baris yang sudah diambil tanpa menyaring tanggal, sehingga nomor hari ini
          dapat melanjut dari sisa hari sebelumnya. Periksa aplikasi antrian.
        </Peringatan>
      ) : null}

      {data && data.terbaca === false ? (
        <Peringatan>{data.alasan || data.message || "Antrian belum dapat dibaca."}</Peringatan>
      ) : null}

      {/* ── kendali suara ─────────────────────────────────────────────────
          Peramban memuat daftar suaranya menyusul, jadi pilihannya bisa
          kosong sesaat sesudah halaman dibuka - lihat lib/suara-panggilan. */}
      {didukung ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/20 px-4 py-2.5 text-sm">
          <button
            type="button"
            onClick={() => {
              const nyala = !suaraNyala;
              setSuaraNyala(nyala);
              if (nyala) {
                // Diuji seketika. Petugas harus mendengar suaranya SEBELUM
                // ruang tunggu mendengarnya - termasuk mengetahui bahwa
                // pengeras suaranya memang tersambung.
                bunyikan("Pengeras suara ruang sidang siap.");
              } else {
                hentikanUcapan();
              }
            }}
            className={cn(
              "rounded-full border px-3.5 py-1.5 transition",
              suaraNyala
                ? "border-emerald-500 bg-emerald-500/10 font-medium text-emerald-700 dark:text-emerald-300"
                : "border-border text-muted-foreground hover:border-primary/40"
            )}
          >
            {suaraNyala ? "Suara menyala" : "Suara mati"}
          </button>

          <label className="flex items-center gap-2">
            <span className="text-muted-foreground">Suara</span>
            <select
              value={terpilih}
              onChange={(e) => pilih(e.target.value)}
              className="max-w-[18rem] rounded-lg border bg-card px-2 py-1.5 text-sm"
            >
              {daftarSuara.length === 0 ? (
                <option value="">Memuat daftar suara…</option>
              ) : null}
              {daftarSuara.map((s) => (
                <option key={s.uri} value={s.uri}>
                  {s.nama} · {s.bahasa}
                  {s.lokal ? "" : " (perlu jaringan)"}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => {
              // Sengaja tidak lewat suarakan(): mencoba suara harus bisa
              // dilakukan sebelum suaranya dinyalakan, sebab itulah cara
              // memilihnya.
              bunyikan("Nomor antrian satu, silakan menuju Ruang Sidang satu.");
            }}
            className="rounded-full border px-3.5 py-1.5 text-muted-foreground transition hover:border-primary/40"
          >
            Coba suara
          </button>

          {daftarSuara.length > 0 && !daftarSuara.some((s) => /^id\b/i.test(s.bahasa)) ? (
            <span className="text-amber-700 dark:text-amber-300">
              Perangkat ini belum punya suara bahasa Indonesia - angka akan terdengar janggal.
              Pasang paket suara Indonesia pada sistemnya.
            </span>
          ) : null}
        </div>
      ) : null}

      {pesan ? <div className="rounded-xl border bg-muted/30 px-4 py-2.5 text-sm">{pesan}</div> : null}

      {/* ── kartu utama: berikutnya, dengan tombol sebesar mungkin ────────── */}
      {berikutnya ? (
        <div className="rounded-3xl border-2 p-6" style={{ borderColor: warna.aksen }}>
          <div className="flex flex-wrap items-center gap-6">
            <div className="min-w-[7rem]">
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Berikutnya</p>
              <p
                className="font-mono text-7xl font-semibold leading-none tabular-nums"
                style={{ color: warna.aksen }}
              >
                {berikutnya.nomor}
              </p>
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-lg">
                {berikutnya.noRuang ? `Ruang Sidang ${berikutnya.noRuang}` : "Ruang belum ditetapkan"}
                {berikutnya.majelisKode ? (
                  <span className="text-muted-foreground">
                    {" "}
                    · Majelis <span className={cn(KELAS_KODE_MAJELIS, "text-foreground")}>{berikutnya.majelisKode}</span>
                  </span>
                ) : null}
              </p>

              {/* Siapa yang sudah hadir - terbaca SEBELUM memanggil. F3.2:
                  rinci per orang ("Penggugat hadir 08.47 · Tergugat belum ·
                  Saksi P 1"), dengan kolom mesin antrian sebagai cadangan. */}
              {ringkasKehadiran(susunKehadiran(berikutnya.hadir, berikutnya)).length > 0 ? (
                <RingkasKehadiran potongan={ringkasKehadiran(susunKehadiran(berikutnya.hadir, berikutnya))} ukuran="sedang" />
              ) : (
                <p className="text-sm text-muted-foreground">Belum ada keterangan kehadiran</p>
              )}

              {berikutnya.waktuAmbil ? (
                <p className="text-sm text-muted-foreground">
                  Mengambil nomor {berikutnya.waktuAmbil}
                  {berikutnya.online ? " lewat WhatsApp" : " di mesin antrian"}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              disabled={sibuk === berikutnya.perkaraId}
              onClick={() => void panggil(berikutnya)}
              className="rounded-2xl px-10 py-6 text-2xl font-semibold text-white transition disabled:opacity-60"
              style={{ backgroundColor: warna.aksen }}
            >
              {sibuk === berikutnya.perkaraId ? "Memanggil…" : "Panggil"}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed p-10 text-center text-muted-foreground">
          Tidak ada yang menunggu di pilihan ruang ini.
        </div>
      )}

      {/* ── panggilan petugas dan saksi ───────────────────────────────────
          Tombol-tombol ini HANYA bersuara - tidak satu pun mengubah antrian.
          Lihat catatan pada PANGGILAN_PETUGAS. Karena itu bentuknya sengaja
          berbeda dari tombol Panggil di atas: lebih kecil, tanpa warna aksen,
          dan berkumpul di bawah kartu. */}
      {didukung ? (
        <div className="rounded-2xl border bg-muted/10 p-4">
          <p className="mb-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Panggilan pengeras suara · tidak mengubah antrian
          </p>

          {/* Majelis hakim: satu tombol per nama hakim, ditambah Semua majelis. */}
          <p className="mb-1 text-xs text-muted-foreground">Majelis hakim</p>
          <div className="flex flex-wrap gap-2">
            {PANGGILAN_PETUGAS.filter((x) => x.kunci === "majelis").map((satu) => (
              <button
                key={satu.kunci}
                type="button"
                disabled={!suaraNyala}
                onClick={() => suarakan(satu.kalimat(konteksPetugas))}
                className="rounded-xl border px-3.5 py-2 text-sm transition hover:border-primary/40 disabled:opacity-50"
              >
                {satu.label}
              </button>
            ))}
            {hakimTombol.map((h) => (
              <button
                key={`hakim-${h.nama}`}
                type="button"
                disabled={!suaraNyala}
                onClick={() => suarakan(kalimatHakim(h.nama, h.peran, sebutanRuang))}
                title={h.pengganti ? "Hakim pengganti sidang keliling" : undefined}
                className="rounded-xl border px-3.5 py-2 text-sm transition hover:border-primary/40 disabled:opacity-50"
              >
                {h.nama}
                <span className="ml-1 text-xs text-muted-foreground">({jabatanHakim(h.peran)})</span>
              </button>
            ))}
            {hakimTombol.length === 0 ? (
              <span className="self-center text-xs text-muted-foreground">
                Nama hakim muncul bila ada perkara berikutnya.
              </span>
            ) : null}
          </div>

          {/* Panitera sidang dan petugas lain. */}
          <p className="mb-1 mt-3 text-xs text-muted-foreground">Panitera sidang dan petugas</p>
          <div className="flex flex-wrap gap-2">
            {PANGGILAN_PETUGAS.filter((x) => x.kunci !== "majelis").map((satu) => (
              <button
                key={satu.kunci}
                type="button"
                disabled={!suaraNyala}
                onClick={() => suarakan(satu.kalimat(konteksPetugas))}
                className="rounded-xl border px-3.5 py-2 text-sm transition hover:border-primary/40 disabled:opacity-50"
              >
                {satu.label}
              </button>
            ))}

            {/* Memanggil ulang nomor yang sedang di ruang sidang. Terjadi
                setiap hari: pihak yang dipanggil sedang di luar gedung, dan
                panggilan kedua tidak boleh menuntut penekanan tombol Panggil
                sekali lagi - itu akan menghitungnya sebagai panggilan baru. */}
            {berikutnya && berikutnya.nomor !== null ? (
              <button
                type="button"
                disabled={!suaraNyala}
                onClick={() =>
                  suarakan(
                    kalimatPanggilPihak({
                      nomorAntrian: berikutnya.nomor,
                      noRuang: berikutnya.noRuang,
                      // Mengulang TIDAK mencatat panggilan baru: hitungannya tetap.
                      panggilanKe: Math.max(1, berikutnya.panggilan?.jumlah ?? 0),
                      nomorPerkara: sasaranBerikutnya?.nomorPerkara,
                      jenisPerkara: sasaranBerikutnya?.jenisPerkara,
                      orang: sasaranBerikutnya?.orang,
                    })
                  )
                }
                className="rounded-xl border px-3.5 py-2 text-sm transition hover:border-primary/40 disabled:opacity-50"
              >
                Ulangi nomor {berikutnya.nomor}
              </button>
            ) : null}
          </div>

          {/* Petugas yang tidak tercatat di SIPP: nama diketik sekali, diingat di peramban ini. */}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-xs text-muted-foreground">Nama petugas (diingat di peramban ini):</span>
            {(
              [
                ["rohaniwan", "Nama rohaniwan"],
                ["mediasi", "Nama petugas mediasi"],
                ["persidangan", "Nama petugas persidangan"],
              ] as Array<[keyof NamaUmum, string]>
            ).map(([kunci, placeholder]) => (
              <input
                key={kunci}
                value={namaUmum[kunci]}
                onChange={(e) => ubahNamaUmum(kunci, e.target.value)}
                placeholder={placeholder}
                aria-label={placeholder}
                className="min-w-[10rem] flex-1 rounded-lg border bg-card px-2.5 py-1.5 text-sm"
              />
            ))}
          </div>

          {/* Saksi: satu per satu menurut nama, atau semuanya berurutan. */}
          {saksiTercatat.length > 0 ? (
            <div className="mt-3">
              <p className="mb-1 text-xs text-muted-foreground">Saksi perkara ini</p>
              <div className="flex flex-wrap gap-2">
                {saksiTercatat.map((saksi) => (
                  <button
                    key={`saksi-${saksi.kunci}`}
                    type="button"
                    disabled={!suaraNyala}
                    onClick={() => suarakan(kalimatSaksi(saksi, sebutanRuang))}
                    className="rounded-xl border px-3.5 py-2 text-sm transition hover:border-primary/40 disabled:opacity-50"
                  >
                    {saksi.nama}
                    <span className="ml-1 text-xs text-muted-foreground">(saksi {sisiSaksi(saksi.peran)})</span>
                  </button>
                ))}
                <button
                  type="button"
                  disabled={!suaraNyala}
                  onClick={() => suarakan(kalimatSemuaSaksi(saksiTercatat, sebutanRuang))}
                  className="rounded-xl border border-primary/40 px-3.5 py-2 text-sm transition hover:bg-muted disabled:opacity-50"
                >
                  Panggil semua saksi
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={namaSaksi}
              onChange={(e) => setNamaSaksi(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") panggilSaksi();
              }}
              placeholder="Nama saksi yang dipanggil"
              className="min-w-[16rem] flex-1 rounded-xl border bg-card px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={!suaraNyala}
              onClick={panggilSaksi}
              className="rounded-xl border px-3.5 py-2 text-sm transition hover:border-primary/40 disabled:opacity-50"
            >
              Panggil saksi
            </button>
            <button
              type="button"
              onClick={() => {
                hentikanUcapan();
                setPesan("Panggilan dihentikan.");
              }}
              className="rounded-xl border px-3.5 py-2 text-sm text-muted-foreground transition hover:border-primary/40"
            >
              Hentikan suara
            </button>
          </div>

          {!suaraNyala ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Nyalakan suara lebih dulu pada kendali di atas.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* ── antrean sesudahnya, sekilas ───────────────────────────────────── */}
      {baris.menunggu.length > 1 ? (
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">Sesudahnya</p>
          <div className="flex flex-wrap gap-2">
            {baris.menunggu.slice(1, 16).map((satu) => (
              <span
                key={satu.perkaraId}
                className="rounded-xl border px-3.5 py-2 font-mono text-lg tabular-nums"
                title={kalimatRingkas(ringkasKehadiran(susunKehadiran(satu.hadir, satu))) || satu.hadir.map((x) => x.sebutan).join(", ")}
              >
                {satu.nomor}
                {ruang === 0 && satu.noRuang ? (
                  <span className="ml-1 align-middle font-sans text-[0.65rem] text-muted-foreground">
                    R{satu.noRuang}
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* ── yang sudah dipanggil, beserta hitungannya ─────────────────────── */}
      {baris.dipanggil.length > 0 ? (
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Sudah dipanggil ({baris.dipanggil.length})
          </p>
          <div className="space-y-1">
            {baris.dipanggil
              .slice()
              .reverse()
              .map((satu) => {
                const w = warnaRuang(satu.noRuang);
                const batas = satu.panggilan?.sudahBatas;
                return (
                  <div
                    key={satu.perkaraId}
                    className={cn(
                      "flex flex-wrap items-center gap-3 rounded-xl border px-3.5 py-2 text-sm",
                      batas
                        ? "border-rose-300 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/30"
                        : ""
                    )}
                  >
                    <span
                      className="w-14 font-mono text-2xl font-medium tabular-nums"
                      style={{ color: w.aksen }}
                    >
                      {satu.nomor}
                    </span>

                    <span className="min-w-0 flex-1 text-muted-foreground">
                      {satu.noRuang ? `Ruang ${satu.noRuang}` : "Ruang —"}
                      {satu.jamPanggil ? ` · ${satu.jamPanggil}` : ""}
                      {/* F3.2: ringkasan rinci, cadangannya sebutan apa adanya. */}
                      {kalimatRingkas(ringkasKehadiran(susunKehadiran(satu.hadir, satu)))
                        ? ` · ${kalimatRingkas(ringkasKehadiran(susunKehadiran(satu.hadir, satu)))}`
                        : satu.hadir.length > 0
                          ? ` · ${satu.hadir.map((x) => x.sebutan).join(", ")}`
                          : ""}
                    </span>

                    {/* Hitungan panggilan - inilah yang menentukan apakah
                        perkara patut ditunda. */}
                    {satu.panggilan && satu.panggilan.jumlah > 0 ? (
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-medium",
                          batas ? "bg-rose-600 text-white" : "bg-muted text-muted-foreground"
                        )}
                        title={satu.panggilan.panggilan
                          .map((p) => `ke-${p.urutan} ${p.jam}${p.oleh ? ` oleh ${p.oleh}` : ""}`)
                          .join(" · ")}
                      >
                        {satu.panggilan.jumlah}/{satu.panggilan.batas} panggilan
                        {batas ? " · batas" : ""}
                      </span>
                    ) : null}

                    <button
                      type="button"
                      disabled={sibuk === satu.perkaraId}
                      onClick={() => void panggil(satu)}
                      className="rounded-lg border px-3 py-1.5 text-sm transition hover:bg-muted disabled:opacity-60"
                    >
                      {sibuk === satu.perkaraId ? "…" : "Panggil ulang"}
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      ) : null}

      {/* Ruang sidang (2 Okt 2026, butir 2-3): yang sedang berjalan / diskors di Papan panggil. */}
      <PanelRuangPapanPanggil />
    </div>
  );
}

function Peringatan({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      {children}
    </div>
  );
}
