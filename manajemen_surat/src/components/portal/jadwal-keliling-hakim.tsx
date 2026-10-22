"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, Gavel, MapPin, PauseCircle, Printer, Undo2, UserRound, Users, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { PemilihTanggalSidang } from "@/components/ui/pemilih-tanggal-sidang";
import { TanyaJamKerja, type PilihJamKerja } from "@/components/portal/pilihan-jam-kerja";
import { AGENDA_LAZIM, ALASAN_LAZIM, usulanAgendaBerikut } from "@/components/portal/hasil-sidang";
import { apiPath } from "@/lib/base-path";
import { keadaanRuangMenurutAntrian, type AntrianSidangRingkas } from "@/lib/antrian-hasil-sidang";
import { bacaKontakPihak } from "@/lib/jadwal-sidang-kontak";
import {
  calonHakim,
  daftarPanitera,
  kunciTawarKeliling,
  majelisTampil,
  mayoritasLuarGedung,
  perkaraPanitera,
  perluTawarKeliling,
  type BarisJadwalMin,
  type HakimCalon,
  type PilihanHakimSidang,
} from "@/lib/jadwal-keliling-hakim";
import type { KehadiranOrang } from "@/lib/kehadiran-rinci";
import type { RencanaKalender, RiwayatTundaMin } from "@/lib/bawaan-tunda";
import type { Ruangan } from "@/lib/ruangan-sidang";
import { bawaanRuangSidang, muatanRuangSidang } from "@/lib/ruang-sidang-blangko";
import {
  barisLengkap,
  bawaanCentang,
  hasilDariJawaban,
  muatanMassal,
  ringkasHasilMassal,
  terapkanTanggalSemua,
  usulanBarisMassal,
  type HasilBarisMassal,
  type IsianBarisMassal,
  type JalanMassal,
  type KeadaanMassal,
} from "@/lib/tunda-putus-massal";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * JADWAL SIDANG: SIDANG KELILING, HAKIM PER PERKARA, MEJA PANITERA SIDANG
 * ============================================================================
 *
 * Permintaan hakim 22 Okt 2026. Tiga bagian, semuanya hanya di ALETA kecuali
 * tunda/putus massal (yang memakai penulis SIPP yang sudah ada):
 *
 *   SaklarSidangKeliling   bilah alat atas; pop-up sekali per tanggal per
 *                          pengguna bila mayoritas sidang di luar gedung.
 *   PemilihHakimBaris      di sel majelis tiap baris: satu hakim yang
 *                          menyidangkan (semua hakim aktif; majelis = saran).
 *   MejaPaniteraSidang     panel per panitera sidang: pilih hakim untuk semua
 *                          perkaranya, tunda massal, keterangan putus massal.
 *                          SENGAJA terpisah dari Layar antrian (menu itu untuk
 *                          televisi ruang tunggu dan operator).
 */

async function bukaBungkus<T>(balasan: Response): Promise<T> {
  const isi = (await balasan.json().catch(() => ({}))) as { data?: T; error?: { message?: string }; message?: string };
  if (!balasan.ok) {
    const pesan = isi?.error?.message || isi?.message || `Permintaan ditolak (${balasan.status}).`;
    throw new Error(pesan);
  }
  return (isi?.data ?? ({} as T)) as T;
}

export type KelilingHariLayar = { tanggal: string; aktif: boolean; diputuskan: boolean; diubahNama: string; diubahPada: string };

export type HasilSimpanHakim = {
  perkaraId: string;
  nomorPerkara: string;
  ok: boolean;
  sebab: string;
  konseptor: "diisi" | "sama" | "perlu-konfirmasi" | "tidak-diubah";
  konseptorLama?: string;
};

export type IsianHakimLayar = {
  perkaraId: string;
  nomorPerkara: string;
  sidangId: string;
  hakimId: string;
  hakimNama: string;
  hakimKode: string;
  anggotaMajelis: boolean;
  paniteraNama: string;
};

export type KelilingHakim = ReturnType<typeof useKelilingHakim>;

const KOSONG: Record<string, PilihanHakimSidang> = {};

/** Keadaan saklar keliling + pilihan hakim satu tanggal. nyala=false: tidak memuat apa pun. */
export function useKelilingHakim({ tanggal, nyala }: { tanggal: string; nyala: boolean }) {
  const [keliling, setKeliling] = useState<KelilingHariLayar | null>(null);
  const [bolehKeliling, setBolehKeliling] = useState(false);
  // Pilihan disimpan bersama tanggalnya: pindah tanggal tidak boleh sempat
  // menampilkan hakim tanggal sebelumnya.
  const [pilihanData, setPilihan] = useState<{ tanggal: string; peta: Record<string, PilihanHakimSidang> }>({ tanggal: "", peta: {} });
  const [calon, setCalon] = useState<HakimCalon[]>([]);
  const [alasanCalon, setAlasanCalon] = useState("");
  const [bolehHakim, setBolehHakim] = useState(false);
  const [galat, setGalat] = useState("");
  const [muatKe, setMuatKe] = useState(0);

  useEffect(() => {
    if (!nyala || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return;
    let batal = false;
    void (async () => {
      try {
        const [k, h] = await Promise.all([
          fetch(apiPath(`/api/aleta-ecourt/sidang/keliling?tanggal=${tanggal}`), { cache: "no-store" }).then((r) =>
            bukaBungkus<{ keliling?: KelilingHariLayar; bolehUbah?: boolean }>(r)
          ),
          fetch(apiPath(`/api/aleta-ecourt/sidang/hakim-sidang?tanggal=${tanggal}`), { cache: "no-store" }).then((r) =>
            bukaBungkus<{ pilihan?: Record<string, PilihanHakimSidang>; calon?: HakimCalon[]; alasanCalon?: string; bolehUbah?: boolean }>(r)
          ),
        ]);
        if (batal) return;
        setKeliling(k.keliling ?? null);
        setBolehKeliling(Boolean(k.bolehUbah));
        setPilihan({ tanggal, peta: h.pilihan ?? {} });
        setCalon(Array.isArray(h.calon) ? h.calon : []);
        setAlasanCalon(String(h.alasanCalon ?? ""));
        setBolehHakim(Boolean(h.bolehUbah));
        setGalat("");
      } catch (e) {
        if (!batal) setGalat(e instanceof Error ? e.message : "Pengaturan sidang hari ini belum terbaca.");
      }
    })();
    return () => {
      batal = true;
    };
  }, [tanggal, nyala, muatKe]);

  const muatUlang = useCallback(() => setMuatKe((n) => n + 1), []);

  const ubahKeliling = useCallback(
    async (aktif: boolean) => {
      const r = await fetch(apiPath("/api/aleta-ecourt/sidang/keliling"), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tanggal, aktif }),
      });
      const isi = await bukaBungkus<{ keliling?: KelilingHariLayar }>(r);
      if (isi.keliling) setKeliling(isi.keliling);
      return isi.keliling ?? null;
    },
    [tanggal]
  );

  const simpanHakim = useCallback(
    async (isian: IsianHakimLayar[], timpaKonseptor = false): Promise<HasilSimpanHakim[]> => {
      const r = await fetch(apiPath("/api/aleta-ecourt/sidang/hakim-sidang"), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tanggal, pilihan: isian, timpaKonseptor }),
      });
      const isi = await bukaBungkus<{ hasil?: HasilSimpanHakim[] }>(r);
      muatUlang();
      return Array.isArray(isi.hasil) ? isi.hasil : [];
    },
    [tanggal, muatUlang]
  );

  const batalHakim = useCallback(
    async (perkaraIds: string[]) => {
      const r = await fetch(apiPath("/api/aleta-ecourt/sidang/hakim-sidang"), {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tanggal, perkaraIds }),
      });
      const isi = await bukaBungkus<{ hasil?: Array<{ perkaraId: string; konseptor: string; sebab: string }> }>(r);
      muatUlang();
      return Array.isArray(isi.hasil) ? isi.hasil : [];
    },
    [tanggal, muatUlang]
  );

  const berlaku = nyala && keliling?.tanggal === tanggal;
  const pilihan = nyala && pilihanData.tanggal === tanggal ? pilihanData.peta : KOSONG;
  return {
    tanggal,
    keliling: berlaku ? keliling : null,
    bolehKeliling,
    pilihan,
    calon,
    alasanCalon,
    bolehHakim: berlaku && bolehHakim,
    galat,
    muatUlang,
    ubahKeliling,
    simpanHakim,
    batalHakim,
  };
}

function bacaSimpanan(kunci: string): boolean {
  try {
    return window.localStorage.getItem(kunci) === "1";
  } catch {
    return false;
  }
}

function tulisSimpanan(kunci: string) {
  try {
    window.localStorage.setItem(kunci, "1");
  } catch {
    /* penyimpanan peramban tertutup: pop-up mungkin muncul lagi - tidak merusak apa pun */
  }
}

/** Saklar Sidang keliling (bilah alat atas) + pop-up tawaran sekali per tanggal per pengguna. */
export function SaklarSidangKeliling({
  kh,
  daftar,
  penggunaId,
  ringkas = false,
}: {
  kh: KelilingHakim;
  daftar: ReadonlyArray<Pick<BarisJadwalMin, "ruangan" | "sidangKeliling">>;
  penggunaId: string;
  /** Tinggi pas di dalam pita ruang sidang (bar ruang). */
  ringkas?: boolean;
}) {
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const kunci = kunciTawarKeliling(penggunaId, kh.tanggal);
  // Sekali per tanggal per pengguna: dibaca dari penyimpanan peramban saat
  // menggambar; jawaban di layar ini dicatat juga di state supaya langsung hilang.
  const [dijawab, setDijawab] = useState<Record<string, boolean>>({});
  const ditawarkan = dijawab[kunci] ?? (typeof window === "undefined" ? true : bacaSimpanan(kunci));

  const aktif = Boolean(kh.keliling?.aktif);
  const tawar =
    Boolean(kh.keliling) &&
    perluTawarKeliling({
      satuTanggal: true,
      sudahDiputuskan: Boolean(kh.keliling?.diputuskan),
      bolehUbah: kh.bolehKeliling,
      sudahDitawarkan: ditawarkan,
      daftar,
    });
  const hitung = mayoritasLuarGedung(daftar);

  const ubah = async (nilai: boolean) => {
    setSibuk(true);
    setGalat("");
    try {
      await kh.ubahKeliling(nilai);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Belum tersimpan.");
    } finally {
      setSibuk(false);
    }
  };

  const tutupTawaran = (aktifkan: boolean) => {
    tulisSimpanan(kunci);
    setDijawab((d) => ({ ...d, [kunci]: true }));
    if (aktifkan) void ubah(true);
  };

  if (!kh.keliling) return null;

  return (
    <>
      <label
        data-saklar-keliling=""
        className={cn(
          "inline-flex items-center gap-2 rounded-md border text-sm",
          ringkas ? "h-7 px-2 text-xs" : "h-8 px-2.5",
          aktif ? "border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-400/60 dark:bg-emerald-500/10 dark:text-emerald-100" : "text-foreground"
        )}
        title={
          aktif
            ? `Sidang keliling menyala untuk tanggal ini${kh.keliling.diubahNama ? ` (oleh ${kh.keliling.diubahNama})` : ""}. Tunda otomatis berjalan pukul 14.00.`
            : kh.bolehKeliling
              ? "Nyalakan bila hari ini sidang keliling: tunda otomatis berjalan pukul 14.00."
              : "Sidang keliling - hanya Hakim, Ketua/Wakil, Panitera, dan Panitera Pengganti yang dapat mengubahnya."
        }
      >
        <MapPin className="h-4 w-4" aria-hidden="true" />
        <span className="whitespace-nowrap">Sidang keliling</span>
        <Switch
          checked={aktif}
          disabled={!kh.bolehKeliling || sibuk}
          onCheckedChange={(v) => void ubah(Boolean(v))}
          aria-label="Sidang keliling"
        />
      </label>
      {galat ? <span className="text-xs text-red-700 dark:text-red-300">{galat}</span> : null}

      {tawar ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Aktifkan Sidang keliling">
          <div className="w-full max-w-md rounded-lg border bg-card p-5 text-card-foreground shadow-xl" data-tawaran-keliling="">
            <div className="flex items-start gap-3">
              <span className="rounded-full bg-emerald-100 p-2 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                <MapPin className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-base font-semibold">Hari ini sebagian besar sidang di luar gedung.</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {hitung.luar} dari {hitung.jumlah} perkara bersidang di luar ruang sidang gedung. Aktifkan Sidang keliling? Tunda otomatis lalu
                  berjalan pukul 14.00.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => tutupTawaran(false)}>
                Tidak
              </Button>
              <Button autoFocus onClick={() => tutupTawaran(true)}>
                Aktifkan
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function useTutupLuar(terbuka: boolean, tutup: () => void) {
  const wadah = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!terbuka) return;
    const luar = (e: MouseEvent | TouchEvent) => {
      if (wadah.current && e.target instanceof Node && !wadah.current.contains(e.target)) tutup();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") tutup();
    };
    document.addEventListener("mousedown", luar);
    document.addEventListener("touchstart", luar);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", luar);
      document.removeEventListener("touchstart", luar);
      document.removeEventListener("keydown", esc);
    };
  }, [terbuka, tutup]);
  return wadah;
}

function DaftarCalon({
  calon,
  majelis,
  terpilih,
  onPilih,
}: {
  calon: readonly HakimCalon[];
  majelis: string | readonly string[];
  terpilih?: string;
  onPilih: (h: HakimCalon & { saran: boolean }) => void;
}) {
  const daftar = useMemo(() => calonHakim(majelis, calon), [majelis, calon]);
  const saran = daftar.filter((h) => h.saran);
  const lain = daftar.filter((h) => !h.saran);
  const tombol = (h: HakimCalon & { saran: boolean }) => (
    <button
      key={`${h.id}|${h.nama}`}
      type="button"
      onClick={() => onPilih(h)}
      className={cn(
        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition hover:bg-muted",
        terpilih === h.nama && "bg-primary/10 font-semibold"
      )}
    >
      {h.kode ? <span className="rounded bg-muted px-1 font-mono text-[11px]">{h.kode}</span> : null}
      <span className="min-w-0 break-words">{h.nama}</span>
    </button>
  );
  if (daftar.length === 0) return <p className="px-2 py-1.5 text-sm text-muted-foreground">Daftar hakim belum terbaca dari SIPP.</p>;
  return (
    <div className="max-h-72 overflow-auto">
      {saran.length ? (
        <>
          <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Majelis perkara ini</p>
          {saran.map(tombol)}
        </>
      ) : null}
      {lain.length ? (
        <>
          <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Hakim lain</p>
          {lain.map(tombol)}
        </>
      ) : null}
    </div>
  );
}

function KonfirmasiKonseptor({
  hasil,
  sibuk,
  onTimpa,
  onBiarkan,
}: {
  hasil: HasilSimpanHakim[];
  sibuk: boolean;
  onTimpa: () => void;
  onBiarkan: () => void;
}) {
  const perlu = hasil.filter((h) => h.konseptor === "perlu-konfirmasi");
  if (perlu.length === 0) return null;
  return (
    <div role="alertdialog" className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
      <p>
        Hakim tersimpan. Konseptor {perlu.length === 1 ? `perkara ${perlu[0].nomorPerkara}` : `${perlu.length} perkara`} sudah ditunjuk
        {perlu.length === 1 && perlu[0].konseptorLama ? ` (${perlu[0].konseptorLama})` : ""} - ganti dengan hakim ini?
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" disabled={sibuk} onClick={onTimpa}>
          Ganti konseptor
        </Button>
        <Button size="sm" variant="outline" disabled={sibuk} onClick={onBiarkan}>
          Biarkan
        </Button>
      </div>
    </div>
  );
}

/** Nama yang tampil di sel majelis + penanda hakim yang menyidangkan. Kode majelis tetap di tempatnya. */
export function NamaHakimMenyidangkan({
  baris,
  pilihan,
}: {
  baris: Pick<BarisJadwalMin, "majelisKode" | "majelisNama" | "perkaraId">;
  pilihan: Readonly<Record<string, PilihanHakimSidang>>;
}) {
  const t = majelisTampil(baris, pilihan);
  if (!t.diganti) return null;
  return (
    <span data-hakim-menyidangkan="" className="inline-flex items-center gap-1 font-medium text-foreground" title={`Disidangkan ${t.nama}. Majelis: ${t.asli || "-"}`}>
      <UserRound className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
      {t.nama}
    </span>
  );
}

/** Pemilih SATU hakim yang menyidangkan perkara ini pada tanggal ini (di sel majelis). */
export function PemilihHakimBaris({ baris, kh }: { baris: BarisJadwalMin; kh: KelilingHakim }) {
  const [buka, setBuka] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [hasil, setHasil] = useState<HasilSimpanHakim[]>([]);
  const [isianTerakhir, setIsianTerakhir] = useState<IsianHakimLayar | null>(null);
  const [galat, setGalat] = useState("");
  const tutup = useCallback(() => setBuka(false), []);
  const wadah = useTutupLuar(buka, tutup);
  const kini = kh.pilihan[String(baris.perkaraId)];
  if (!kh.keliling || (!kh.bolehHakim && !kini)) return null;

  const simpan = async (isian: IsianHakimLayar, timpa = false) => {
    setSibuk(true);
    setGalat("");
    try {
      const h = await kh.simpanHakim([isian], timpa);
      setIsianTerakhir(isian);
      setHasil(timpa ? [] : h);
      const gagal = h.find((x) => !x.ok);
      if (gagal) setGalat(gagal.sebab);
      setBuka(false);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Belum tersimpan.");
    } finally {
      setSibuk(false);
    }
  };

  return (
    <span ref={wadah} className="relative inline-flex flex-wrap items-center gap-1 align-middle" data-pemilih-hakim="">
      {kh.bolehHakim ? (
        <button
          type="button"
          disabled={sibuk}
          onClick={() => setBuka((b) => !b)}
          aria-expanded={buka}
          title={kini ? `Ganti hakim yang menyidangkan ${baris.nomorPerkara}` : `Pilih satu hakim yang menyidangkan ${baris.nomorPerkara} hari ini`}
          className="inline-flex items-center gap-0.5 rounded border border-primary/40 px-1.5 py-0.5 text-[11px] font-semibold text-primary transition hover:bg-primary/10"
        >
          <Gavel className="h-3 w-3" aria-hidden="true" />
          {kini ? "ganti hakim" : "pilih hakim"}
          <ChevronDown className="h-3 w-3" aria-hidden="true" />
        </button>
      ) : null}
      {kini && kh.bolehHakim ? (
        <button
          type="button"
          disabled={sibuk}
          onClick={async () => {
            setSibuk(true);
            try {
              await kh.batalHakim([String(baris.perkaraId)]);
              setHasil([]);
            } catch (e) {
              setGalat(e instanceof Error ? e.message : "Belum dibatalkan.");
            } finally {
              setSibuk(false);
            }
          }}
          title="Kembali ke majelis (konseptor sementara dikembalikan seperti sebelumnya)"
          aria-label={`Batalkan hakim yang menyidangkan ${baris.nomorPerkara}`}
          className="inline-flex items-center rounded border px-1 py-0.5 text-[11px] text-muted-foreground transition hover:bg-muted"
        >
          <Undo2 className="h-3 w-3" aria-hidden="true" />
        </button>
      ) : null}
      {buka ? (
        <div className="absolute left-0 top-full z-40 mt-1 w-72 max-w-[85vw] rounded-md border bg-card p-1.5 text-card-foreground shadow-lg">
          {kh.alasanCalon ? <p className="px-2 py-1 text-xs text-amber-700 dark:text-amber-300">{kh.alasanCalon}</p> : null}
          <DaftarCalon
            calon={kh.calon}
            majelis={baris.majelisNama}
            terpilih={kini?.hakimNama}
            onPilih={(h) =>
              void simpan({
                perkaraId: String(baris.perkaraId),
                nomorPerkara: baris.nomorPerkara,
                sidangId: String(baris.sidangId),
                hakimId: String(h.id || ""),
                hakimNama: h.nama,
                hakimKode: h.kode,
                anggotaMajelis: h.saran,
                paniteraNama: baris.paniteraNama,
              })
            }
          />
        </div>
      ) : null}
      {galat ? <span className="w-full text-[11px] text-red-700 dark:text-red-300">{galat}</span> : null}
      {hasil.length ? (
        <span className="block w-full">
          <KonfirmasiKonseptor
            hasil={hasil}
            sibuk={sibuk}
            onTimpa={() => isianTerakhir && void simpan(isianTerakhir, true)}
            onBiarkan={() => setHasil([])}
          />
        </span>
      ) : null}
    </span>
  );
}

// ─── Meja panitera sidang ───────────────────────────────────────────────────

export type BarisMeja = BarisJadwalMin & {
  sidangIkrarTalak?: boolean;
  jenisPerkara?: string;
  pihak?: { penggugat: string[]; tergugat: string[] };
};

type StatusPutusan = { id: number; nama: string };

type BahanBaris = {
  keadaan: KeadaanMassal;
  ruang: Record<string, Record<string, number | boolean>>;
};

type AlatMeja = "hakim" | "tunda" | "putus";

const SEBUT_HADIR: Array<{ nilai: number; label: string }> = [
  { nilai: 4, label: "Tidak hadir" },
  { nilai: 2, label: "Pihak pertama" },
  { nilai: 3, label: "Pihak kedua" },
  { nilai: 1, label: "Semua hadir" },
];

async function bacaKalender(perkaraId: number | string): Promise<RencanaKalender[] | null> {
  try {
    const r = await fetch(apiPath(`/api/aleta-ecourt/sidang/kalender?perkaraId=${encodeURIComponent(String(perkaraId))}`), { cache: "no-store" });
    const isi = await bukaBungkus<{ available?: boolean; ok?: boolean; kalender?: unknown }>(r);
    if (isi.available === false || isi.ok === false || !Array.isArray(isi.kalender)) return null;
    return (isi.kalender as RencanaKalender[]).filter((x) => x && typeof x.tanggal === "string");
  } catch {
    return null;
  }
}

/** Membaca keadaan satu sidang dan menyusun usulan - sama dengan menu tunda | putus di baris. */
async function muatBaris(sidangId: string): Promise<{ bahan: BahanBaris; isian: IsianBarisMassal } | { galat: string }> {
  try {
    const r = await fetch(apiPath(`/api/aleta-ecourt/sidang-tunda?jadwalId=${encodeURIComponent(sidangId)}`), { cache: "no-store" });
    const isi = await bukaBungkus<{
      ok?: boolean;
      alasan?: string;
      keadaan?: KeadaanMassal;
      riwayat?: Omit<RiwayatTundaMin, "kalender" | "kontak"> | null;
      ruangan?: Ruangan[];
      antrian?: AntrianSidangRingkas;
      kehadiranRinci?: KehadiranOrang[] | null;
    }>(r);
    if (!isi.ok || !isi.keadaan) return { galat: isi.alasan || "Jadwal sidang tidak ditemukan." };
    const [kalender, kontak] = isi.riwayat
      ? await Promise.all([bacaKalender(isi.keadaan.perkaraId), bacaKontakPihak(isi.keadaan.perkaraId)])
      : [null, null];
    const riwayat = isi.riwayat ? { ...isi.riwayat, kalender, kontak } : null;
    const usul = usulanBarisMassal({ keadaan: isi.keadaan, riwayat, antrian: isi.antrian, kehadiranRinci: isi.kehadiranRinci }, usulanAgendaBerikut);
    const daftar = Array.isArray(isi.ruangan) ? isi.ruangan : [];
    const ruangPilih = bawaanRuangSidang(keadaanRuangMenurutAntrian(isi.keadaan, isi.antrian), daftar);
    return {
      bahan: {
        keadaan: isi.keadaan,
        ruang: { tunda: muatanRuangSidang(ruangPilih, "tunda"), putus: muatanRuangSidang(ruangPilih, "putus") },
      },
      isian: {
        alasan: usul.alasan,
        agenda: usul.agenda,
        tanggal: usul.tanggal,
        jam: usul.jam,
        dihadiri: usul.dihadiri,
        statusId: "",
        verstek: false,
        peringatan: usul.peringatan,
        ikrar: usul.ikrar,
      },
    };
  } catch (e) {
    return { galat: e instanceof Error ? e.message : "Jadwal sidang tidak dapat dibaca." };
  }
}

/**
 * MEJA PANITERA SIDANG - panel di atas tabel, dibuka dari bilah alat.
 * Pilih panitera sidang -> perkaranya terpilih -> Pilih hakim | Tunda |
 * Keterangan putus -> satu klik simpan -> laporan per perkara -> tertutup
 * sendiri bila semuanya tersimpan.
 */
export function MejaPaniteraSidang({
  daftar,
  kh,
  sudahHasil,
  bolehTundaPutus,
  paniteraAwal = "",
  onSelesai,
  onTutup,
}: {
  daftar: readonly BarisMeja[];
  kh: KelilingHakim;
  sudahHasil: (b: BarisMeja) => boolean;
  bolehTundaPutus: boolean;
  paniteraAwal?: string;
  onSelesai: () => void;
  onTutup: () => void;
}) {
  const pp = useMemo(() => daftarPanitera(daftar), [daftar]);
  const [panitera, setPanitera] = useState(() => paniteraAwal || (pp.length === 1 ? pp[0].nama : ""));
  const alatAda: AlatMeja[] = [...(kh.bolehHakim ? (["hakim"] as const) : []), ...(bolehTundaPutus ? (["tunda", "putus"] as const) : [])];
  const [alat, setAlat] = useState<AlatMeja>(alatAda[0] ?? "hakim");
  const perkara = useMemo(() => (panitera ? perkaraPanitera(daftar, panitera) : []), [daftar, panitera]);

  // Centang bawaan disusun ulang tiap panitera, alat, atau daftar yang sudah
  // diberi hasil berubah (mis. sesudah menyimpan: yang baru ditunda tidak
  // boleh tetap tercentang). Pilih hakim: SEMUA perkara PP itu langsung
  // terpilih (permintaan hakim); tunda/putus: yang belum diberi hasil.
  const kunciCentang = `${panitera}|${alat}|${perkara.map((b) => `${b.sidangId}:${sudahHasil(b) ? 1 : 0}`).join(",")}`;
  const [centangData, setCentangData] = useState<{ kunci: string; set: Set<string> } | null>(null);
  const centang =
    centangData && centangData.kunci === kunciCentang
      ? centangData.set
      : alat === "hakim"
        ? new Set(perkara.map((b) => String(b.sidangId)))
        : bawaanCentang(perkara, sudahHasil, alat);
  const setCentang = (ubah: Set<string> | ((lama: Set<string>) => Set<string>)) =>
    setCentangData({ kunci: kunciCentang, set: typeof ubah === "function" ? ubah(centang) : ubah });

  const [bahan, setBahan] = useState<Record<string, BahanBaris>>({});
  const [isian, setIsian] = useState<Record<string, IsianBarisMassal>>({});
  const [galatMuat, setGalatMuat] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<StatusPutusan[]>([]);
  const [hakimPilih, setHakimPilih] = useState<(HakimCalon & { saran: boolean }) | null>(null);
  const [bukaCalon, setBukaCalon] = useState(false);
  const [tanggalSemua, setTanggalSemua] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [laporan, setLaporan] = useState<HasilBarisMassal[] | null>(null);
  const [hasilHakim, setHasilHakim] = useState<HasilSimpanHakim[]>([]);
  const [isianHakimTerakhir, setIsianHakimTerakhir] = useState<IsianHakimLayar[]>([]);
  const [tanyaJam, setTanyaJam] = useState<{ pesan: string; lanjut: (p: PilihJamKerja) => void } | null>(null);
  const sedangKirim = useRef(false);

  // Isian tunda/putus dimuat SEKALI per sidang (usulan sama dengan menu baris),
  // tiga sekaligus. Yang sudah diminta dicatat di ref supaya pemuatan ulang
  // jadwal sesudah menyimpan tidak membaca ulang semuanya.
  const diminta = useRef(new Set<string>());
  const hidup = useRef(true);
  useEffect(() => {
    hidup.current = true;
    return () => {
      hidup.current = false;
    };
  }, []);
  useEffect(() => {
    if (alat === "hakim") return;
    const antre = perkara.map((b) => String(b.sidangId)).filter((id) => !diminta.current.has(id));
    if (antre.length === 0) return;
    for (const id of antre) diminta.current.add(id);
    const kerja = async () => {
      while (antre.length && hidup.current) {
        const id = antre.shift()!;
        const h = await muatBaris(id);
        if (!hidup.current) return;
        if ("galat" in h) setGalatMuat((g) => ({ ...g, [id]: h.galat }));
        else {
          setBahan((b) => ({ ...b, [id]: h.bahan }));
          setIsian((s) => ({ ...s, [id]: s[id] ?? h.isian }));
        }
      }
    };
    void Promise.all([kerja(), kerja(), kerja()]);
  }, [alat, perkara]);
  const memuat = alat !== "hakim" && perkara.some((b) => !bahan[String(b.sidangId)] && !galatMuat[String(b.sidangId)]);

  useEffect(() => {
    if (alat !== "putus" || status.length) return;
    void (async () => {
      try {
        const r = await fetch(apiPath("/api/aleta-ecourt/sidang-putus"), { cache: "no-store" });
        const isi = await bukaBungkus<{ ok: boolean; daftar?: StatusPutusan[] }>(r);
        if (isi.ok && Array.isArray(isi.daftar)) setStatus(isi.daftar);
      } catch {
        /* daftar status tidak terbaca: pilihannya kosong, tombol simpan tertahan */
      }
    })();
  }, [alat, status.length]);

  // Bawaan Dikabulkan (yang paling sering) untuk baris yang belum memilih.
  const statusBawaan = useMemo(() => String(status.find((s) => /dikabulkan/i.test(s.nama))?.id ?? ""), [status]);
  const isianBaris = (id: string): IsianBarisMassal | undefined => {
    const s = isian[id];
    if (!s) return undefined;
    return alat === "putus" && !s.statusId && statusBawaan ? { ...s, statusId: statusBawaan } : s;
  };
  const ubahIsian = (id: string, ubah: Partial<IsianBarisMassal>) =>
    setIsian((s) => (s[id] ? { ...s, [id]: { ...s[id], ...ubah, ...(ubah.tanggal ? { peringatan: "" } : {}) } } : s));

  const terpilih = perkara.filter((b) => centang.has(String(b.sidangId)));

  const tutupRef = useRef(onTutup);
  useEffect(() => {
    tutupRef.current = onTutup;
  }, [onTutup]);
  const menungguKonseptor = hasilHakim.some((h) => h.konseptor === "perlu-konfirmasi");
  useEffect(() => {
    if (!laporan || menungguKonseptor) return;
    const r = ringkasHasilMassal(laporan);
    if (!r.semuaBerhasil) return;
    const t = setTimeout(() => tutupRef.current(), 1800);
    return () => clearTimeout(t);
  }, [laporan, menungguKonseptor]);

  const simpanTundaPutus = async (jamKerja?: PilihJamKerja, mulaiDari = 0, hasilAwal: HasilBarisMassal[] = []) => {
    if (alat === "hakim" || (sedangKirim.current && jamKerja === undefined)) return;
    sedangKirim.current = true;
    setSibuk(true);
    const jalan: JalanMassal = alat;
    const hasil: HasilBarisMassal[] = [...hasilAwal];
    try {
      for (let i = mulaiDari; i < terpilih.length; i += 1) {
        const b = terpilih[i];
        const id = String(b.sidangId);
        const data = bahan[id];
        const s = isianBaris(id);
        if (!data || !s) {
          hasil.push({ sidangId: id, nomorPerkara: b.nomorPerkara, keadaan: "gagal", sebab: galatMuat[id] || "Keadaan sidang belum terbaca." });
          continue;
        }
        const cek = barisLengkap(jalan, s);
        if (!cek.lengkap) {
          hasil.push({ sidangId: id, nomorPerkara: b.nomorPerkara, keadaan: "dilewati", sebab: cek.sebab });
          continue;
        }
        const alamat = jalan === "tunda" ? "/api/aleta-ecourt/sidang-tunda" : "/api/aleta-ecourt/sidang-putus";
        try {
          const r = await fetch(apiPath(alamat), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              ...muatanMassal(jalan, data.keadaan, s, data.ruang[jalan]),
              tanyaJamKerja: true,
              ...(jamKerja ? { jamKerja } : {}),
            }),
          });
          const isi = await bukaBungkus<{ ok?: boolean; alasan?: string; pesan?: string; diantrekan?: boolean; kering?: boolean; perluPilihan?: boolean; kode?: string }>(r);
          if (isi.perluPilihan || isi.kode === "di_luar_jam_kerja") {
            // Ditanyakan SEKALI untuk seluruh sisa daftar, lalu dilanjutkan dari perkara ini.
            setTanyaJam({
              pesan: isi.pesan || isi.alasan || "",
              lanjut: (p) => {
                setTanyaJam(null);
                void simpanTundaPutus(p, i, hasil);
              },
            });
            return;
          }
          hasil.push(hasilDariJawaban(id, b.nomorPerkara, isi));
        } catch (e) {
          hasil.push({ sidangId: id, nomorPerkara: b.nomorPerkara, keadaan: "gagal", sebab: e instanceof Error ? e.message : "Permintaan gagal." });
        }
      }
      setLaporan(hasil);
      onSelesai();
    } finally {
      sedangKirim.current = false;
      setSibuk(false);
    }
  };

  const simpanHakimMassal = async (timpa = false) => {
    const isianHakim: IsianHakimLayar[] = timpa
      ? isianHakimTerakhir.filter((x) => hasilHakim.some((h) => h.perkaraId === x.perkaraId && h.konseptor === "perlu-konfirmasi"))
      : hakimPilih
        ? terpilih.map((b) => ({
            perkaraId: String(b.perkaraId),
            nomorPerkara: b.nomorPerkara,
            sidangId: String(b.sidangId),
            hakimId: String(hakimPilih.id || ""),
            hakimNama: hakimPilih.nama,
            hakimKode: hakimPilih.kode,
            anggotaMajelis: calonHakim(b.majelisNama, [hakimPilih])[0]?.saran ?? false,
            paniteraNama: b.paniteraNama,
          }))
        : [];
    if (isianHakim.length === 0) return;
    setSibuk(true);
    try {
      const h = await kh.simpanHakim(isianHakim, timpa);
      if (!timpa) setIsianHakimTerakhir(isianHakim);
      setHasilHakim(timpa ? [] : h);
      const lap: HasilBarisMassal[] = h.map((x) => ({
        sidangId: isianHakim.find((i) => i.perkaraId === x.perkaraId)?.sidangId ?? x.perkaraId,
        nomorPerkara: x.nomorPerkara,
        keadaan: x.ok ? "berhasil" : "gagal",
        sebab: x.ok ? (x.konseptor === "perlu-konfirmasi" ? x.sebab : x.konseptor === "diisi" ? "Konseptor sementara diisi." : "") : x.sebab,
      }));
      // Konseptor yang menunggu jawaban menahan panel tetap terbuka (menungguKonseptor).
      setLaporan(lap);
    } catch (e) {
      setLaporan([{ sidangId: "", nomorPerkara: "", keadaan: "gagal", sebab: e instanceof Error ? e.message : "Belum tersimpan." }]);
    } finally {
      setSibuk(false);
    }
  };

  const batalHakimMassal = async () => {
    const ids = terpilih.map((b) => String(b.perkaraId)).filter((id) => kh.pilihan[id]);
    if (!ids.length) return;
    setSibuk(true);
    try {
      await kh.batalHakim(ids);
      setLaporan(terpilih.filter((b) => ids.includes(String(b.perkaraId))).map((b) => ({ sidangId: String(b.sidangId), nomorPerkara: b.nomorPerkara, keadaan: "berhasil", sebab: "Kembali ke majelis." })));
    } catch (e) {
      setLaporan([{ sidangId: "", nomorPerkara: "", keadaan: "gagal", sebab: e instanceof Error ? e.message : "Belum dibatalkan." }]);
    } finally {
      setSibuk(false);
    }
  };

  const ringkas = laporan ? ringkasHasilMassal(laporan) : null;
  const hakimTerpilihMajelis = useMemo(() => terpilih.map((b) => b.majelisNama), [terpilih]);
  const SEBUT_ALAT: Record<AlatMeja, string> = { hakim: "Pilih hakim", tunda: "Tunda massal", putus: "Keterangan putus massal" };

  return (
    <section
      data-meja-panitera=""
      aria-label="Meja panitera sidang"
      className="rounded-lg border border-primary/30 bg-card p-3 text-card-foreground shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Users className="h-4 w-4 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-semibold">Per panitera sidang</h3>
        <span className="text-xs text-muted-foreground">Pilih panitera sidang - perkaranya langsung terpilih.</span>
        <button
          type="button"
          onClick={onTutup}
          className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md border text-muted-foreground transition hover:bg-muted"
          aria-label="Tutup meja panitera sidang"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Panitera sidang">
        {pp.length === 0 ? <span className="text-sm text-muted-foreground">Tidak ada panitera sidang tercatat pada jadwal ini.</span> : null}
        {pp.map((p) => (
          <Button
            key={p.nama}
            size="sm"
            variant={panitera === p.nama ? "default" : "outline"}
            role="radio"
            aria-checked={panitera === p.nama}
            data-pp={p.nama}
            onClick={() => {
              setPanitera(p.nama);
              setLaporan(null);
            }}
          >
            {p.nama}
            <span className="ml-1.5 rounded bg-muted px-1 text-xs font-semibold text-foreground">{p.jumlah}</span>
          </Button>
        ))}
      </div>

      {panitera ? (
        <>
          <div className="mt-3 flex flex-wrap gap-1 border-b" role="tablist">
            {alatAda.map((a) => (
              <button
                key={a}
                type="button"
                role="tab"
                aria-selected={alat === a}
                data-alat-meja={a}
                onClick={() => {
                  setAlat(a);
                  setLaporan(null);
                }}
                className={cn(
                  "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-1.5 text-sm transition",
                  alat === a ? "border-primary font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {a === "hakim" ? <Gavel className="h-4 w-4" /> : a === "tunda" ? <PauseCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                {SEBUT_ALAT[a]}
              </button>
            ))}
          </div>

          {/* Bilah aksi - ikut jumlah yang dicentang. */}
          <div className="mt-2 flex flex-wrap items-center gap-2" data-bilah-aksi-meja="">
            <span className="text-sm">
              <strong>{terpilih.length}</strong> dari {perkara.length} perkara dipilih
            </span>
            <button type="button" className="text-xs text-primary underline-offset-2 hover:underline" onClick={() => setCentang(new Set(perkara.map((b) => String(b.sidangId))))}>
              semua
            </button>
            <button type="button" className="text-xs text-primary underline-offset-2 hover:underline" onClick={() => setCentang(new Set())}>
              kosongkan
            </button>

            {alat === "hakim" ? (
              <div className="relative flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setBukaCalon((b) => !b)} aria-expanded={bukaCalon} data-pilih-hakim-pp="">
                  <Gavel className="mr-1.5 h-4 w-4" />
                  {hakimPilih ? hakimPilih.nama : "Pilih hakimnya"}
                  <ChevronDown className="ml-1 h-3.5 w-3.5" />
                </Button>
                {bukaCalon ? (
                  <div className="absolute left-0 top-full z-40 mt-1 w-80 max-w-[85vw] rounded-md border bg-card p-1.5 text-card-foreground shadow-lg">
                    <DaftarCalon
                      calon={kh.calon}
                      majelis={hakimTerpilihMajelis}
                      terpilih={hakimPilih?.nama}
                      onPilih={(h) => {
                        setHakimPilih(h);
                        setBukaCalon(false);
                      }}
                    />
                  </div>
                ) : null}
                <Button size="sm" disabled={sibuk || !hakimPilih || terpilih.length === 0} onClick={() => void simpanHakimMassal(false)} data-simpan-meja="">
                  Simpan hakim
                </Button>
                <Button size="sm" variant="ghost" disabled={sibuk || !terpilih.some((b) => kh.pilihan[String(b.perkaraId)])} onClick={() => void batalHakimMassal()}>
                  <Undo2 className="mr-1.5 h-4 w-4" />
                  Kembali ke majelis
                </Button>
              </div>
            ) : (
              <>
                {alat === "tunda" ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Satu tanggal untuk semua:</span>
                    <PemilihTanggalSidang value={tanggalSemua} onChange={setTanggalSemua} sebutan="Tanggal sidang berikutnya" kelasBungkus="w-40" />
                    <Button size="sm" variant="outline" disabled={!tanggalSemua} onClick={() => setIsian((s) => terapkanTanggalSemua(s, new Set([...centang].filter((id) => s[id])), tanggalSemua))}>
                      Terapkan
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Status untuk semua:</span>
                    <NativeSelect
                      className="h-8 w-56 text-sm"
                      value=""
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) return;
                        setIsian((s) => {
                          const h = { ...s };
                          for (const id of centang) if (h[id]) h[id] = { ...h[id], statusId: v };
                          return h;
                        });
                      }}
                    >
                      <option value="">Pilih…</option>
                      {status.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.nama}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                )}
                <Button
                  size="sm"
                  className="ml-auto"
                  disabled={sibuk || memuat || terpilih.length === 0}
                  onClick={() => void simpanTundaPutus()}
                  data-simpan-meja=""
                >
                  {sibuk ? "Menyimpan…" : memuat ? "Membaca sidang…" : alat === "tunda" ? `Tunda ${terpilih.length} perkara` : `Simpan keterangan putus (${terpilih.length})`}
                </Button>
              </>
            )}
          </div>

          {tanyaJam ? (
            <div className="mt-2">
              <TanyaJamKerja pesan={tanyaJam.pesan} sibuk={false} bawaan="sekarang" onPilih={tanyaJam.lanjut} />
            </div>
          ) : null}

          {hasilHakim.length ? (
            <KonfirmasiKonseptor hasil={hasilHakim} sibuk={sibuk} onTimpa={() => void simpanHakimMassal(true)} onBiarkan={() => setHasilHakim([])} />
          ) : null}

          {laporan && ringkas ? (
            <div
              role="status"
              data-laporan-meja=""
              className={cn(
                "mt-2 rounded-md border p-2 text-sm",
                ringkas.semuaBerhasil
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100"
                  : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
              )}
            >
              <p className="font-semibold">{ringkas.kalimat}</p>
              {laporan.some((h) => h.keadaan !== "berhasil" || h.sebab) ? (
                <ul className="mt-1 space-y-0.5">
                  {laporan
                    .filter((h) => h.keadaan !== "berhasil" || h.sebab)
                    .map((h, i) => (
                      <li key={`${h.sidangId}|${i}`}>
                        <span className="font-medium">{h.nomorPerkara || "Semua"}</span>
                        {" - "}
                        {h.keadaan === "gagal" ? "gagal: " : h.keadaan === "dilewati" ? "dilewati: " : ""}
                        {h.sebab}
                      </li>
                    ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="mt-2 overflow-x-auto">
            <table className="block w-full text-sm md:table md:min-w-[36rem]">
              <thead className="hidden md:table-header-group">
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="w-8 py-1.5" />
                  <th className="py-1.5 pr-2">Perkara</th>
                  <th className="py-1.5 pr-2">{alat === "hakim" ? "Majelis / hakim" : "Kehadiran"}</th>
                  {alat === "tunda" ? (
                    <>
                      <th className="py-1.5 pr-2">Alasan tunda</th>
                      <th className="py-1.5 pr-2">Sidang berikutnya</th>
                      <th className="py-1.5 pr-2">Agenda</th>
                    </>
                  ) : alat === "putus" ? (
                    <>
                      <th className="py-1.5 pr-2">Status putusan</th>
                      <th className="py-1.5 pr-2">Verstek</th>
                    </>
                  ) : null}
                </tr>
              </thead>
              <tbody className="block md:table-row-group">
                {perkara.map((b) => {
                  const id = String(b.sidangId);
                  const s = isianBaris(id);
                  const selesai = sudahHasil(b);
                  const ikrarPutus = alat === "putus" && b.sidangIkrarTalak;
                  const p = kh.pilihan[String(b.perkaraId)];
                  return (
                    <tr key={id} className={cn("mb-2 block rounded-md border p-2 align-top md:mb-0 md:table-row md:rounded-none md:border-0 md:border-b md:p-0 md:last:border-0", selesai && alat !== "hakim" && "opacity-60")} data-baris-meja={b.nomorPerkara}>
                      <td className="inline-block py-1.5 align-top md:table-cell">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          aria-label={`Pilih ${b.nomorPerkara}`}
                          checked={centang.has(id)}
                          disabled={Boolean(ikrarPutus)}
                          onChange={(e) =>
                            setCentang((c) => {
                              const n = new Set(c);
                              if (e.target.checked) n.add(id);
                              else n.delete(id);
                              return n;
                            })
                          }
                        />
                      </td>
                      <td className="inline-block py-1 pl-2 pr-2 align-top md:table-cell md:py-1.5 md:pl-0">
                        <div className="whitespace-nowrap font-medium">{b.nomorPerkara}</div>
                        <div className="text-xs text-muted-foreground">
                          {b.jamSidang || ""} {b.agenda ? `· ${b.agenda}` : ""}
                          {selesai ? " · sudah diberi hasil" : ""}
                        </div>
                        {galatMuat[id] && alat !== "hakim" ? <div className="text-xs text-red-700 dark:text-red-300">{galatMuat[id]}</div> : null}
                      </td>
                      <td className="block py-1 pr-2 md:table-cell md:py-1.5">
                        {alat === "hakim" ? (
                          <div className="text-xs">
                            <span className="rounded bg-muted px-1 font-mono">{b.majelisKode || "—"}</span>{" "}
                            {p ? <span className="font-semibold">{p.hakimNama}</span> : <span className="text-muted-foreground">{b.majelisNama || "—"}</span>}
                          </div>
                        ) : s ? (
                          <NativeSelect className="h-8 w-full text-sm md:w-36" value={String(s.dihadiri)} onChange={(e) => ubahIsian(id, { dihadiri: Number(e.target.value) })} aria-label={`Kehadiran ${b.nomorPerkara}`}>
                            {SEBUT_HADIR.map((h) => (
                              <option key={h.nilai} value={h.nilai}>
                                {h.label}
                              </option>
                            ))}
                          </NativeSelect>
                        ) : (
                          <span className="text-xs text-muted-foreground">{galatMuat[id] ? "—" : "membaca…"}</span>
                        )}
                      </td>
                      {alat === "tunda" && s ? (
                        <>
                          <td className="block py-1 pr-2 md:table-cell md:py-1.5">
                            <Input list="meja-alasan" className="h-8 w-full text-sm md:min-w-[12rem]" value={s.alasan} onChange={(e) => ubahIsian(id, { alasan: e.target.value })} aria-label={`Alasan tunda ${b.nomorPerkara}`} />
                          </td>
                          <td className="block py-1 pr-2 md:table-cell md:py-1.5">
                            <div className="flex flex-wrap items-center gap-1">
                              <PemilihTanggalSidang value={s.tanggal} onChange={(v) => ubahIsian(id, { tanggal: v })} sebutan={`Sidang berikutnya ${b.nomorPerkara}`} kelasBungkus="w-36" />
                              <Input type="time" className="h-8 w-24 text-sm" value={s.jam} onChange={(e) => ubahIsian(id, { jam: e.target.value })} aria-label={`Jam sidang berikutnya ${b.nomorPerkara}`} />
                            </div>
                            {s.peringatan ? <div className="mt-0.5 max-w-xs text-xs text-red-700 dark:text-red-300">{s.peringatan}</div> : null}
                          </td>
                          <td className="block py-1 pr-2 md:table-cell md:py-1.5">
                            <Input list="meja-agenda" className="h-8 w-full text-sm md:min-w-[10rem]" value={s.agenda} onChange={(e) => ubahIsian(id, { agenda: e.target.value })} aria-label={`Agenda ${b.nomorPerkara}`} />
                          </td>
                        </>
                      ) : alat === "putus" && s ? (
                        ikrarPutus ? (
                          <td className="block py-1 pr-2 text-xs text-muted-foreground md:table-cell md:py-1.5" colSpan={2}>
                            Sidang ikrar talak dicatat dari tombol putus di barisnya (form ikrar dan e-Doc ikut).
                          </td>
                        ) : (
                          <>
                            <td className="block py-1 pr-2 md:table-cell md:py-1.5">
                              <NativeSelect className="h-8 w-full text-sm md:w-56" value={s.statusId} onChange={(e) => ubahIsian(id, { statusId: e.target.value })} aria-label={`Status putusan ${b.nomorPerkara}`}>
                                <option value="">Pilih…</option>
                                {status.map((st) => (
                                  <option key={st.id} value={st.id}>
                                    {st.nama}
                                  </option>
                                ))}
                              </NativeSelect>
                            </td>
                            <td className="block py-1 pr-2 md:table-cell md:py-1.5">
                              <input type="checkbox" className="h-4 w-4" checked={s.verstek} onChange={(e) => ubahIsian(id, { verstek: e.target.checked })} aria-label={`Verstek ${b.nomorPerkara}`} />
                            </td>
                          </>
                        )
                      ) : alat !== "hakim" ? (
                        <td className="hidden md:table-cell" colSpan={alat === "tunda" ? 3 : 2} />
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <datalist id="meja-alasan">
              {ALASAN_LAZIM.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
            <datalist id="meja-agenda">
              {AGENDA_LAZIM.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </div>
        </>
      ) : null}
    </section>
  );
}

/** Pilihan cetak saat ada hakim per perkara: per hakim (halaman terpisah) atau gabungan. */
export function PilihanCetak({
  jumlahBagian,
  onPerHakim,
  onGabungan,
  onTutup,
}: {
  jumlahBagian: number;
  onPerHakim: () => void;
  onGabungan: () => void;
  onTutup: () => void;
}) {
  const wadah = useTutupLuar(true, onTutup);
  return (
    <div ref={wadah} data-pilihan-cetak="" className="absolute left-0 top-full z-40 mt-1 w-72 rounded-md border bg-card p-1.5 text-card-foreground shadow-lg">
      <button type="button" autoFocus onClick={onPerHakim} className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left transition hover:bg-muted">
        <Printer className="mt-0.5 h-4 w-4" aria-hidden="true" />
        <span>
          <span className="block text-sm font-medium">Cetak per hakim</span>
          <span className="block text-[11px] text-muted-foreground">{jumlahBagian} bagian, tiap hakim halaman sendiri</span>
        </span>
      </button>
      <button type="button" onClick={onGabungan} className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left transition hover:bg-muted">
        <Printer className="mt-0.5 h-4 w-4" aria-hidden="true" />
        <span>
          <span className="block text-sm font-medium">Cetak gabungan</span>
          <span className="block text-[11px] text-muted-foreground">Satu daftar, nama hakim yang menyidangkan tetap tampil</span>
        </span>
      </button>
    </div>
  );
}
