"use client";

/**
 * ============================================================================
 * TOMBOL "KASIR" DI DERETAN ALAT JADWAL SIDANG (6 Okt 2026)
 * ============================================================================
 *
 * Permintaan pengguna: "buatkan tombol baru kasir yaitu mode menginput pada
 * jurnal perkara (nanti keluar pop up) yaitu otomatis mengisi uraiannya serta
 * komponen tabel lainnya secara otomatis melihat tiap keadaan perkara".
 *
 *   pilih perkara   dari jadwal yang tampil, atau cari nomornya
 *   jurnal          Buku Jurnal Keuangan Perkara SIPP perkara itu (tanggal,
 *                   uraian, pihak, pemasukan, pengeluaran, sisa, keterangan),
 *                   digabung dengan usulan yang dicentang - sisa dihitung
 *                   seperti layar SIPP
 *   usulan          disusun bot (kasirJurnalService) dari keadaan perkara dan
 *                   kebiasaan kasir satker yang diukur; tiap baris dapat
 *                   disunting, dihapus, dan ditambah manual
 *   simpan          Pratinjau (kering, bawaan) lalu "Simpan ke SIPP" dua
 *                   tekanan; atas akun SIPP milik pengguna yang login
 *
 * Tampil hanya bagi kasir/bendahara/panitera/admin (bolehKasir); rute
 * memeriksa ulang.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, RotateCcw, Search, Wallet, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePortal } from "@/lib/app-state";
import { apiPath } from "@/lib/base-path";
import { keteranganAwam } from "@/lib/ringkasan-langkah-sipp";
import {
  bolehMengerjakanKasir,
  hitungSisaOtomatis,
  periksaBarisKasir,
  rupiah,
  saldoJurnal,
  susunTampilan,
  uraianTanpaResi,
  type BarisJurnal,
  type JenisBiayaKasir,
  type PihakKasir,
  type UsulanJurnal,
} from "@/lib/kasir-jurnal";
import type { KeadaanKasir } from "@/lib/kasir-otomatis";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import { cn } from "@/lib/utils";

const ALAMAT = "/api/aleta-ecourt/sidang/kasir";

async function bacaJson(jawaban: Response): Promise<Record<string, unknown>> {
  const isi = (await jawaban.json().catch(() => ({}))) as Record<string, unknown>;
  if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, `HTTP ${jawaban.status}`));
  return ((isi && (isi.data as Record<string, unknown>)) ?? isi) as Record<string, unknown>;
}

type PerkaraPilihan = { perkaraId: string; nomorPerkara: string; jenisPerkara?: string };

type DataKasir = {
  perkara: { perkaraId: number; nomorPerkara: string; jenisPerkaraId: number; jenisPerkaraNama: string; tanggalDaftar: string; proses: string; alurPerkaraId: number };
  hariIni: string;
  pembiayaan: number;
  jurnal: BarisJurnal[];
  saldo: number;
  pihak: PihakKasir[];
  jurusita: Array<{ jurusitaId: number; nama: string }>;
  jenisBiaya: JenisBiayaKasir[];
  usulan: UsulanJurnal[];
  catatan: string[];
  sebutan: { satu: string; dua: string };
  /** 1.189.x butir 1: keadaan perkara + biaya yang lazim padanya (bot keadaanPerkara). */
  keadaan?: KeadaanKasir;
  akun: { ok: boolean; username?: string; milik: string[]; pesan?: string; alasan?: string };
};

type Keadaan = "" | "tersimpan" | "belum-terbaca" | "sudah-ada" | "ditolak" | "gagal" | "sebagian" | "akan-dikirim";

const SEBUT_KEADAAN: Record<string, string> = {
  tersimpan: "tersimpan di SIPP",
  "belum-terbaca": "belum terbaca ulang",
  "sudah-ada": "sudah ada",
  ditolak: "ditolak",
  gagal: "gagal",
  sebagian: "sebagian",
  "akan-dikirim": "akan dikirim",
};

const WARNA_KEADAAN: Record<string, string> = {
  tersimpan: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  "akan-dikirim": "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  "sudah-ada": "border-border bg-muted text-muted-foreground",
  "belum-terbaca": "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  sebagian: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  ditolak: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  gagal: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

const WARNA_YAKIN: Record<string, string> = {
  tinggi: "border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
  sedang: "border-amber-500/40 text-amber-700 dark:text-amber-300",
  rendah: "border-rose-500/40 text-rose-700 dark:text-rose-300",
};

const kelasMedan =
  "h-8 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

type BarisSunting = UsulanJurnal & { keadaan: Keadaan; pesan: string };

function tanggalTeks(iso: string) {
  const [t, b, h] = String(iso || "").split("-");
  return t && b && h ? `${h}/${b}/${t}` : iso || "-";
}

export function DialogKasir({ daftar, onTutup, awal }: { daftar: PerkaraPilihan[]; onTutup: () => void; awal?: string }) {
  const pilihan = useMemo(() => {
    const lihat = new Set<string>();
    return daftar.filter((p) => /^\d+$/.test(String(p.perkaraId)) && !lihat.has(String(p.perkaraId)) && lihat.add(String(p.perkaraId)));
  }, [daftar]);
  const [perkaraId, setPerkaraId] = useState("");
  const [cari, setCari] = useState("");
  const [hasilCari, setHasilCari] = useState<PerkaraPilihan[] | null>(null);
  const [data, setData] = useState<DataKasir | null>(null);
  const [baris, setBaris] = useState<BarisSunting[]>([]);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState("");
  const [akunPilihan, setAkunPilihan] = useState("");
  const [sedang, setSedang] = useState(false);
  const [kabar, setKabar] = useState<{ teks: string; gagal: boolean } | null>(null);
  const [pratinjau, setPratinjau] = useState<Array<{ ke: number; pernyataan: Array<{ keterangan: string; sql: string; nilai: unknown[] }> }> | null>(null);
  const [yakin, setYakin] = useState(false);
  const penundaYakin = useRef<ReturnType<typeof setTimeout> | null>(null);
  const kunciUrut = useRef(0);

  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      if (e.key === "Escape") onTutup();
    };
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, [onTutup]);

  useEffect(
    () => () => {
      if (penundaYakin.current) clearTimeout(penundaYakin.current);
    },
    []
  );

  const lepasYakin = () => {
    if (penundaYakin.current) clearTimeout(penundaYakin.current);
    penundaYakin.current = null;
    setYakin(false);
  };

  const muat = useCallback(async (id: string) => {
    if (!/^\d+$/.test(id)) return;
    setMemuat(true);
    setGalat("");
    setKabar(null);
    setPratinjau(null);
    try {
      const isi = await bacaJson(await fetch(apiPath(`${ALAMAT}?perkaraId=${encodeURIComponent(id)}`), { cache: "no-store" }));
      if (isi.available === false || isi.ok === false) {
        setGalat(String(isi.alasan || "Jurnal keuangan perkara tidak terbaca."));
        setData(null);
        setBaris([]);
        return;
      }
      const d = isi as unknown as DataKasir;
      setData(d);
      setBaris((d.usulan || []).map((u) => ({ ...u, keadaan: "", pesan: "" })));
      if (d.akun?.ok && d.akun.username) setAkunPilihan(d.akun.username);
      else if (d.akun?.milik?.length) setAkunPilihan((x) => x || d.akun.milik[0]);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Jurnal keuangan perkara tidak terbaca.");
    } finally {
      setMemuat(false);
    }
  }, []);

  const pilihPerkara = (id: string) => {
    lepasYakin();
    setPerkaraId(id);
    void muat(id);
  };

  // 1.189.x butir 1: dibuka untuk satu perkara (dari Kasir harian / massal) -
  // usulannya langsung tersusun tanpa memilih lagi. Satu-satunya perkara di
  // jadwal pun langsung dibuka.
  const idAwal = useRef(awal && /^\d+$/.test(awal) ? awal : pilihan.length === 1 ? pilihan[0].perkaraId : "");
  useEffect(() => {
    const id = idAwal.current;
    if (!id) return;
    const jam = setTimeout(() => {
      setPerkaraId(id);
      void muat(id);
    }, 0);
    return () => clearTimeout(jam);
  }, [muat]);

  async function jalankanCari() {
    const teks = cari.trim();
    if (!teks) return;
    setHasilCari(null);
    try {
      const isi = await bacaJson(await fetch(apiPath(`${ALAMAT}?cari=${encodeURIComponent(teks)}`), { cache: "no-store" }));
      const daftarCari = (Array.isArray(isi.perkara) ? isi.perkara : []) as Array<{ perkaraId: number; nomorPerkara: string; jenisPerkara: string }>;
      setHasilCari(daftarCari.map((p) => ({ perkaraId: String(p.perkaraId), nomorPerkara: p.nomorPerkara, jenisPerkara: p.jenisPerkara })));
      if (daftarCari.length === 1) pilihPerkara(String(daftarCari[0].perkaraId));
    } catch (e) {
      setHasilCari([]);
      setGalat(e instanceof Error ? e.message : "Pencarian gagal.");
    }
  }

  // Sisa panjar dihitung ulang tiap kali baris berubah - seperti layar SIPP.
  const barisHitung = useMemo(() => {
    const salinan = baris.map((b) => ({ ...b }));
    hitungSisaOtomatis(salinan, data ? saldoJurnal(data.jurnal) : 0);
    return salinan;
  }, [baris, data]);

  const tampilan = useMemo(() => {
    if (!data) return [];
    const nama = (id: number) => data.jurusita.find((j) => j.jurusitaId === id)?.nama || `juru sita #${id}`;
    return susunTampilan(data.jurnal, barisHitung, data.pihak, nama);
  }, [data, barisHitung]);

  const ubah = (kunci: string, n: Partial<BarisSunting>) => {
    lepasYakin();
    setPratinjau(null);
    setBaris((daftarBaris) =>
      daftarBaris.map((b) => (b.kunci === kunci ? { ...b, ...n, keadaan: n.keadaan ?? (b.keadaan === "tersimpan" ? b.keadaan : ""), pesan: n.pesan ?? "" } : b))
    );
  };

  const pilihJenis = (kunci: string, jenisId: number) => {
    const j = data?.jenisBiaya.find((x) => x.id === jenisId);
    if (!j || !data) return;
    // Seperti blangko SIPP: memilih jenis biaya mengisi uraian dan jumlah bawaannya.
    const butuhJs = [4, 5, 6].includes(j.kategoriId);
    ubah(kunci, {
      jenisBiayaId: j.id,
      kategoriId: j.kategoriId,
      jenisTransaksi: j.jenisTransaksi,
      uraian: j.nama,
      jumlah: j.jumlahBawaan > 0 ? j.jumlahBawaan : null,
      jurusitaId: butuhJs ? data.jurusita[0]?.jurusitaId || 0 : 0,
      sisaOtomatis: false,
    });
  };

  const tambahManual = () => {
    if (!data) return;
    lepasYakin();
    setPratinjau(null);
    kunciUrut.current += 1;
    const pembayar = data.pihak.find((p) => p.ke === 1);
    setBaris((x) => [
      ...x,
      {
        kunci: `m${kunciUrut.current}`,
        jenisBiayaId: 0,
        kategoriId: 0,
        jenisTransaksi: -1,
        pihakKe: pembayar?.ke || 1,
        pihakId: pembayar?.pihakId || 0,
        uraian: "",
        jumlah: null,
        tanggal: data.hariIni,
        keterangan: "",
        jurusitaId: 0,
        peristiwa: "Baris manual",
        dasar: "ditambahkan petugas",
        yakin: "tinggi",
        pilih: true,
        perluResi: false,
        sisaOtomatis: false,
        manual: true,
        keadaan: "",
        pesan: "",
      },
    ]);
  };

  const bahanPeriksa = data
    ? { hariIni: data.hariIni, tanggalDaftar: data.perkara.tanggalDaftar, bebasAkhirPekan: data.perkara.jenisPerkaraId === 746 }
    : { hariIni: "", tanggalDaftar: "" };
  const terpilih = barisHitung.filter((b) => b.pilih && b.keadaan !== "tersimpan" && !(b.sisaOtomatis && !(Number(b.jumlah) > 0)));
  const salahIsian = terpilih.map((b) => periksaBarisKasir(b, bahanPeriksa)).filter(Boolean).length;
  const tanpaResi = terpilih.filter((b) => uraianTanpaResi(b.uraian)).length;
  const akunSiap = Boolean(data?.akun && (data.akun.ok || (data.akun.alasan === "akun_sipp_ganda" && akunPilihan)));

  async function kirim(kering: boolean) {
    if (!data || sedang || !terpilih.length) return;
    setSedang(true);
    setKabar({ teks: kering ? "Menyusun pratinjau…" : `Menyimpan ${terpilih.length} baris ke jurnal SIPP…`, gagal: false });
    const kunciKirim = terpilih.map((b) => b.kunci);
    try {
      const isi = await bacaJson(
        await fetch(apiPath(ALAMAT), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            perkaraId: String(data.perkara.perkaraId),
            akunSipp: data.akun.ok ? data.akun.username : akunPilihan,
            baris: terpilih.map((b) => ({
              tanggal: b.tanggal,
              jenisBiayaId: b.jenisBiayaId,
              pihakKe: b.pihakKe,
              pihakId: b.pihakId,
              uraian: b.uraian,
              jumlah: b.jumlah,
              keterangan: b.keterangan,
              jurusitaId: b.jurusitaId,
            })),
            kering,
          }),
        })
      );
      if (isi.available === false || (isi.ok === false && !Array.isArray(isi.hasil) && !Array.isArray(isi.rencana))) {
        setKabar({ teks: String(isi.pesan || isi.alasan || "Tidak ada yang dikirim ke SIPP."), gagal: true });
        return;
      }
      const tandai = (ke: number, keadaan: Keadaan, pesan: string) => {
        const kunci = kunciKirim[ke];
        setBaris((x) => x.map((b) => (b.kunci === kunci ? { ...b, keadaan, pesan, pilih: keadaan === "tersimpan" || keadaan === "sudah-ada" ? false : b.pilih } : b)));
      };
      for (const h of (Array.isArray(isi.ditolak) ? isi.ditolak : []) as Array<{ ke: number; pesan: string }>) tandai(h.ke, "ditolak", h.pesan);
      for (const h of (Array.isArray(isi.dilewati) ? isi.dilewati : []) as Array<{ ke: number; pesan: string }>) tandai(h.ke, "sudah-ada", h.pesan);

      if (kering) {
        const rincian = (Array.isArray(isi.rencana) ? isi.rencana : []) as Array<{ ke: number; pernyataan: Array<{ keterangan: string; sql: string; nilai: unknown[] }> }>;
        for (const r of rincian) tandai(r.ke, "akan-dikirim", "");
        setPratinjau(rincian);
        const akun = String((isi.akunSipp as { username?: string })?.username || "");
        setKabar({
          teks: rincian.length
            ? `Pratinjau: ${rincian.length} baris jurnal akan ditulis ke jurnal keuangan perkara di SIPP atas akun SIPP ${akun}. Belum ada yang disimpan.`
            : "Pratinjau: tidak ada baris yang perlu ditulis.",
          gagal: false,
        });
        return;
      }
      for (const h of (Array.isArray(isi.hasil) ? isi.hasil : []) as Array<{ ke: number; keadaan: string; pesan: string }>) {
        tandai(h.ke, (h.keadaan as Keadaan) || "gagal", h.pesan);
      }
      const sesudah = Array.isArray(isi.jurnalSesudah) ? (isi.jurnalSesudah as BarisJurnal[]) : null;
      if (sesudah) setData((d) => (d ? { ...d, jurnal: sesudah } : d));
      setPratinjau(null);
      const r = (isi.ringkas ?? {}) as { tersimpan?: number; belumTerbaca?: number; sudahAda?: number; sebagian?: number; gagal?: number };
      const ditolak = Array.isArray(isi.ditolak) ? isi.ditolak.length : 0;
      const bagian = [
        r.tersimpan ? `${r.tersimpan} baris tersimpan dan terbaca ulang di jurnal SIPP` : "",
        r.belumTerbaca ? `${r.belumTerbaca} belum terbaca ulang` : "",
        r.sudahAda ? `${r.sudahAda} sudah ada` : "",
        r.sebagian ? `${r.sebagian} tertulis sebagian` : "",
        ditolak ? `${ditolak} ditolak` : "",
        r.gagal ? `${r.gagal} gagal` : "",
      ].filter(Boolean);
      setKabar({ teks: `${bagian.join("; ") || String(isi.alasan || "Tidak ada yang tersimpan")}.`, gagal: isi.ok !== true });
    } catch (e) {
      setKabar({ teks: e instanceof Error ? e.message : "Gagal menghubungi ALETA.", gagal: true });
    } finally {
      setSedang(false);
    }
  }

  const tekanSimpan = () => {
    if (!yakin) {
      // Dua tekanan: yang pertama hanya menyebut akibatnya.
      setYakin(true);
      penundaYakin.current = setTimeout(() => setYakin(false), 8000);
      return;
    }
    lepasYakin();
    void kirim(false);
  };

  const sebutPihak = (p: PihakKasir) => {
    const s = data?.sebutan ?? { satu: "Pihak I", dua: "Pihak II" };
    const kedudukan = p.ke === 1 ? s.satu : p.ke === 2 ? s.dua : p.ke === 3 ? "Intervensi" : `Turut ${s.dua}`;
    return `${kedudukan}: ${p.nama}`;
  };

  // Lewat portal ke document.body: induk ber-transform di Jadwal Sidang membuat
  // "fixed" ikut induknya, dan pop-up muncul di puncak halaman (6 Okt 2026).
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Kasir - jurnal keuangan perkara"
      onClick={onTutup}
    >
      <div className="my-4 w-full max-w-5xl rounded-lg border bg-card p-4 text-card-foreground shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold">Kasir - Buku Jurnal Keuangan Perkara</h3>
            <p className="text-sm text-muted-foreground">
              {data
                ? `${data.perkara.nomorPerkara} · ${data.perkara.jenisPerkaraNama}${data.perkara.tanggalDaftar ? ` · didaftar ${tanggalTeks(data.perkara.tanggalDaftar)}` : ""}${data.perkara.proses ? ` · ${data.perkara.proses}` : ""}`
                : "Pilih perkara dari jadwal yang tampil atau cari nomornya."}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onTutup} aria-label="Tutup">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Pemilih perkara */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select
            aria-label="Perkara dari jadwal yang tampil"
            className={cn(kelasMedan, "max-w-full sm:w-80")}
            value={pilihan.some((p) => p.perkaraId === perkaraId) ? perkaraId : ""}
            onChange={(e) => e.target.value && pilihPerkara(e.target.value)}
          >
            <option value="">{pilihan.length ? `Perkara di jadwal (${pilihan.length})` : "Tidak ada perkara di jadwal"}</option>
            {pilihan.map((p) => (
              <option key={p.perkaraId} value={p.perkaraId}>
                {p.nomorPerkara}
                {p.jenisPerkara ? ` · ${p.jenisPerkara}` : ""}
              </option>
            ))}
          </select>
          <form
            className="flex items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              void jalankanCari();
            }}
          >
            <input
              type="text"
              aria-label="Cari nomor perkara"
              placeholder="Cari nomor, mis. 580/Pdt.G/2026"
              className={cn(kelasMedan, "w-56")}
              value={cari}
              onChange={(e) => setCari(e.target.value)}
            />
            <Button type="submit" size="sm" variant="outline" disabled={!cari.trim()}>
              <Search className="mr-1 h-3.5 w-3.5" />
              Cari
            </Button>
          </form>
          {data ? (
            <Button size="sm" variant="outline" className="ml-auto" disabled={memuat || sedang} onClick={() => void muat(String(data.perkara.perkaraId))}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Susun ulang
            </Button>
          ) : null}
        </div>
        {hasilCari ? (
          <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
            {hasilCari.length === 0 ? <span className="text-muted-foreground">Tidak ada perkara yang cocok.</span> : null}
            {hasilCari.map((p) => (
              <button
                key={p.perkaraId}
                type="button"
                className={cn("rounded border px-2 py-1 hover:bg-muted", p.perkaraId === perkaraId && "border-primary text-primary")}
                onClick={() => pilihPerkara(p.perkaraId)}
              >
                {p.nomorPerkara}
                {p.jenisPerkara ? ` · ${p.jenisPerkara}` : ""}
              </button>
            ))}
          </div>
        ) : null}

        {memuat ? <div className="min-h-[1.25rem]" aria-busy="true" /> : null}
        {galat ? <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{galat}</p> : null}

        {data && !memuat ? (
          <div className="grid gap-4">
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              {data.akun.ok ? (
                <span>
                  Ditulis di SIPP atas akun SIPP Anda: <b>{data.akun.username}</b>.
                </span>
              ) : data.akun.alasan === "akun_sipp_ganda" ? (
                <label className="flex flex-wrap items-center gap-2">
                  <span>Akun SIPP yang dipakai:</span>
                  <select className={kelasMedan} value={akunPilihan} onChange={(e) => setAkunPilihan(e.target.value)}>
                    {data.akun.milik.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <span className="text-amber-700 dark:text-amber-300">
                  {data.akun.pesan || "Akun SIPP Anda belum tertaut - jurnal dapat dilihat, tetapi tidak dapat disimpan."}
                </span>
              )}
            </div>

            {/* Jurnal (lama + usulan tercentang) */}
            <section>
              <h4 className="mb-1.5 text-sm font-semibold">
                Jurnal {data.perkara.alurPerkaraId === 16 ? "permohonan" : "gugatan"} tingkat pertama
                <span className="ml-2 font-normal text-muted-foreground">
                  ({data.jurnal.length} baris di SIPP{terpilih.length ? `, ${terpilih.length} usulan` : ""})
                </span>
              </h4>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[760px] text-xs">
                  <thead className="bg-muted/60 text-left">
                    <tr>
                      <th className="px-2 py-1.5">Tanggal</th>
                      <th className="px-2 py-1.5">Uraian</th>
                      <th className="px-2 py-1.5">Pihak</th>
                      <th className="px-2 py-1.5 text-right">Pemasukan</th>
                      <th className="px-2 py-1.5 text-right">Pengeluaran</th>
                      <th className="px-2 py-1.5 text-right">Sisa</th>
                      <th className="px-2 py-1.5">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tampilan.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-2 py-2 text-muted-foreground">
                          Belum ada baris jurnal.
                        </td>
                      </tr>
                    ) : null}
                    {tampilan.map((b) => (
                      <tr key={b.kunci} className={cn("border-t", b.baru && "bg-sky-500/10")}>
                        <td className="whitespace-nowrap px-2 py-1">{tanggalTeks(b.tanggal)}</td>
                        <td className="px-2 py-1">
                          {b.uraian}
                          {b.baru ? <span className="ml-1 rounded border border-sky-500/40 px-1 text-[10px] text-sky-700 dark:text-sky-300">usulan</span> : null}
                        </td>
                        <td className="px-2 py-1">{b.pihak}</td>
                        <td className="whitespace-nowrap px-2 py-1 text-right">{b.pemasukan ? rupiah(b.pemasukan) : ""}</td>
                        <td className="whitespace-nowrap px-2 py-1 text-right">{b.pengeluaran ? rupiah(b.pengeluaran) : ""}</td>
                        <td className={cn("whitespace-nowrap px-2 py-1 text-right", b.sisa < 0 && "font-semibold text-rose-700 dark:text-rose-300")}>{rupiah(b.sisa)}</td>
                        <td className="px-2 py-1">{b.keterangan}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Usulan */}
            <section>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold">Usulan ALETA - yang belum ada di jurnal</h4>
                {data.keadaan ? (
                  <span className="mr-auto text-xs" title={data.keadaan.lazim.length ? `Lazim pada keadaan ini: ${data.keadaan.lazim.join(", ")}` : undefined}>
                    <span className="rounded border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 text-sky-700 dark:text-sky-300">Keadaan: {data.keadaan.nama}</span>
                    {data.keadaan.lazim.length ? <span className="ml-2 text-muted-foreground">lazim: {data.keadaan.lazim.join(", ")}</span> : null}
                  </span>
                ) : null}
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={sedang} onClick={tambahManual}>
                  <Plus className="mr-1 h-3 w-3" />
                  Tambah baris manual
                </Button>
              </div>
              {data.catatan.map((c) => (
                <p key={c} className="mb-1 text-xs text-amber-700 dark:text-amber-300">
                  {c}
                </p>
              ))}
              {barisHitung.length === 0 ? (
                <p className="text-sm text-muted-foreground">Jurnal sudah sesuai keadaan perkara - tidak ada yang perlu ditambah. Tekan Tambah baris manual bila perlu.</p>
              ) : (
                <ul className="grid gap-1.5">
                  {barisHitung.map((b, i) => {
                    const kunci = sedang || b.keadaan === "tersimpan";
                    const salah = b.pilih && b.keadaan !== "tersimpan" && !(b.sisaOtomatis && !(Number(b.jumlah) > 0)) ? periksaBarisKasir(b, bahanPeriksa) : "";
                    const jenisPilih = data.jenisBiaya.find((j) => j.id === b.jenisBiayaId);
                    return (
                      <li key={b.kunci} className={cn("rounded-md border px-2 py-1.5", !b.pilih && "opacity-70")}>
                        <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                          <label className="inline-flex items-center gap-1">
                            <input type="checkbox" checked={b.pilih} disabled={kunci} onChange={(e) => ubah(b.kunci, { pilih: e.target.checked })} />
                            <span className="font-medium">{i + 1}</span>
                          </label>
                          <span className="font-medium">{b.peristiwa}</span>
                          <span className={cn("rounded border px-1", WARNA_YAKIN[b.yakin] ?? "border-border")}>yakin {b.yakin}</span>
                          {b.keadaan ? (
                            <span className={cn("rounded border px-1 py-0.5 leading-none", WARNA_KEADAAN[b.keadaan] ?? "border-border")}>{SEBUT_KEADAAN[b.keadaan] ?? b.keadaan}</span>
                          ) : null}
                          <span className="text-muted-foreground">{b.dasar}</span>
                          <button
                            type="button"
                            className="ml-auto text-muted-foreground hover:text-foreground disabled:opacity-50"
                            disabled={kunci}
                            title="Hapus baris ini dari usulan (tidak menyentuh SIPP)"
                            onClick={() => {
                              lepasYakin();
                              setPratinjau(null);
                              setBaris((x) => x.filter((y) => y.kunci !== b.kunci));
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="grid gap-1.5 sm:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)]">
                          <input
                            type="date"
                            aria-label="Tanggal transaksi"
                            className={kelasMedan}
                            value={b.tanggal}
                            disabled={kunci}
                            max={data.hariIni}
                            onChange={(e) => ubah(b.kunci, { tanggal: e.target.value })}
                          />
                          <select
                            aria-label="Jenis biaya"
                            className={kelasMedan}
                            value={b.jenisBiayaId || ""}
                            disabled={kunci}
                            onChange={(e) => pilihJenis(b.kunci, Number(e.target.value))}
                          >
                            <option value="">Pilih Jenis Biaya</option>
                            {data.jenisBiaya
                              .filter((j) => j.id !== 1)
                              .map((j) => (
                                <option key={j.id} value={j.id}>
                                  {j.kategori ? `${j.kategori} - ` : ""}
                                  {j.nama}
                                </option>
                              ))}
                          </select>
                          <select
                            aria-label="Pihak yang membayar"
                            className={kelasMedan}
                            value={b.pihakId ? `${b.pihakKe}|${b.pihakId}` : ""}
                            disabled={kunci}
                            onChange={(e) => {
                              const [ke, id] = e.target.value.split("|").map(Number);
                              ubah(b.kunci, { pihakKe: ke, pihakId: id });
                            }}
                          >
                            <option value="">Pilih Pihak</option>
                            {data.pihak.map((p) => (
                              <option key={`${p.ke}|${p.pihakId}`} value={`${p.ke}|${p.pihakId}`}>
                                {sebutPihak(p)}
                              </option>
                            ))}
                          </select>
                          <input
                            type="text"
                            aria-label="Uraian"
                            className={cn(kelasMedan, "sm:col-span-2", uraianTanpaResi(b.uraian) && b.pilih && "border-amber-500")}
                            placeholder="Uraian"
                            value={b.uraian}
                            disabled={kunci}
                            onChange={(e) => ubah(b.kunci, { uraian: e.target.value })}
                          />
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              aria-label="Jumlah"
                              min={0}
                              step={500}
                              className={cn(kelasMedan, "w-full text-right", b.pilih && !(Number(b.jumlah) > 0) && !b.sisaOtomatis && "border-rose-500")}
                              placeholder="Jumlah"
                              value={b.jumlah ?? ""}
                              disabled={kunci || b.sisaOtomatis}
                              onChange={(e) => ubah(b.kunci, { jumlah: e.target.value === "" ? null : Number(e.target.value) })}
                            />
                            {b.sisaOtomatis ? (
                              <button
                                type="button"
                                className="whitespace-nowrap text-[11px] text-primary hover:underline disabled:opacity-50"
                                disabled={kunci}
                                title="Jumlah sisa dihitung otomatis dari saldo; tekan untuk mengisinya sendiri"
                                onClick={() => ubah(b.kunci, { sisaOtomatis: false, jumlah: b.jumlah })}
                              >
                                otomatis
                              </button>
                            ) : null}
                          </div>
                          <input
                            type="text"
                            aria-label="Keterangan"
                            className={cn(kelasMedan, "sm:col-span-3")}
                            placeholder="Keterangan (boleh kosong)"
                            value={b.keterangan}
                            disabled={kunci}
                            onChange={(e) => ubah(b.kunci, { keterangan: e.target.value })}
                          />
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                          <span>{b.jenisTransaksi > 0 ? "pemasukan" : "pengeluaran"}</span>
                          {jenisPilih ? <span>{jenisPilih.kategori}</span> : null}
                          {b.jurusitaId ? (
                            <span>juru sita: {data.jurusita.find((j) => j.jurusitaId === b.jurusitaId)?.nama || `#${b.jurusitaId}`}</span>
                          ) : null}
                          {b.sisaOtomatis ? <span>sisa = saldo sesudah seluruh baris tercentang ({rupiah(b.jumlah)})</span> : null}
                        </div>
                        {uraianTanpaResi(b.uraian) && b.pilih ? (
                          <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">Nomor resi Pos belum ada - lengkapi uraian (mis. …/P2609190002831).</p>
                        ) : null}
                        {salah ? <p className="mt-0.5 text-xs text-rose-700 dark:text-rose-300">{salah}</p> : null}
                        {b.pesan ? <p className="mt-0.5 text-xs text-muted-foreground">{b.pesan}</p> : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {pratinjau && pratinjau.length ? (
              <details className="rounded-md border bg-muted/40 px-3 py-2 text-xs" open>
                <summary className="cursor-pointer text-sm font-medium">Pratinjau yang akan ditulis ke SIPP ({pratinjau.length} baris jurnal)</summary>
                <p className="mt-1 text-muted-foreground">
                  Sama dengan blangko Tambah jurnal di SIPP; biaya panggilan atau pemberitahuan juga dicatat atas juru sita. Nomor dan jam
                  ditetapkan saat menyimpan, sesudah jeda.
                </p>
                <ol className="mt-1 grid list-decimal gap-1 pl-5">
                  {pratinjau.map((p) => (
                    <li key={p.ke}>
                      {p.pernyataan
                        .map((x) => keteranganAwam(x.keterangan))
                        .filter((k) => k !== "")
                        .map((k, j) => (
                          <div key={j} className="mb-0.5">
                            {k}
                          </div>
                        ))}
                    </li>
                  ))}
                </ol>
              </details>
            ) : null}

            {kabar ? (
              <p className={cn("rounded-md border px-3 py-2 text-sm", kabar.gagal ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300" : "bg-muted/40")}>
                {kabar.teks}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
              <span className="mr-auto text-xs text-muted-foreground">
                {terpilih.length ? `${terpilih.length} baris dicentang${tanpaResi ? `, ${tanpaResi} belum bernomor resi` : ""}` : "Centang usulan atau tambah baris manual."}
              </span>
              <Button size="sm" variant="outline" disabled={sedang || !terpilih.length || !akunSiap} onClick={() => void kirim(true)}>
                Pratinjau (uji coba)
              </Button>
              <Button
                size="sm"
                variant={yakin ? "destructive" : "default"}
                disabled={sedang || !terpilih.length || !akunSiap || salahIsian > 0}
                onClick={tekanSimpan}
                title={salahIsian ? "Perbaiki baris yang ditandai merah lebih dulu" : undefined}
              >
                {yakin ? `Tekan sekali lagi: simpan ${terpilih.length} baris ke SIPP` : `Simpan ke SIPP${terpilih.length ? ` (${terpilih.length})` : ""}`}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

/** Tombol "Kasir" di deretan alat Jadwal Sidang. */
export function TombolKasirJurnal({ daftar }: { daftar: PerkaraPilihan[] }) {
  const { currentUser } = usePortal();
  const [buka, setBuka] = useState(false);
  const tutup = useCallback(() => setBuka(false), []);
  if (!bolehMengerjakanKasir(currentUser)) return null;
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setBuka(true)}
        title="Kasir: isi Buku Jurnal Keuangan Perkara SIPP - uraian, pihak, jumlah, dan tanggal disusun otomatis dari keadaan perkara"
      >
        <Wallet className="mr-1.5 h-4 w-4" />
        Kasir
      </Button>
      {buka ? <DialogKasir daftar={daftar} onTutup={tutup} /> : null}
    </>
  );
}
