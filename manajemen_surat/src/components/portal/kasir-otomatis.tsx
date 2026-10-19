"use client";

/**
 * ============================================================================
 * KASIR HARIAN - MASSAL, REKAP, PENGINGAT (1.189.x butir 2, 4, 5)
 * ============================================================================
 *
 * Tombol "Kasir harian" di deretan alat Jadwal Sidang (saklar Tampilan
 * "tombol-kasir-harian"), di sebelah tombol Kasir per perkara yang tetap ada.
 *
 *   Massal hari ini  perkara yang bergerak pada tanggal itu, usulan jurnal
 *                    tiap perkara menurut KEADAANNYA (mesin yang sama dengan
 *                    Kasir per perkara). Pratinjau, lalu simpan berurutan
 *                    dengan jeda manusia; satu perkara gagal tidak
 *                    menghentikan yang lain; laporan per perkara. Perkara yang
 *                    perlu diperiksa tangan (resi kosong, tarif belum
 *                    diketahui, keyakinan sedang) TIDAK dicentang bawaan -
 *                    tombol Sunting membuka Kasir per perkara.
 *   Rekap            harian terbuka; mingguan s.d. tahunan diciutkan, dibaca
 *                    saat dibuka. Pilihan tanggal. Unduh PDF.
 *   Pengingat        sisa panjar, jurnal hari putusan, panjar kurang, setor
 *                    PNBP (dicatat di ALETA, bukan SIPP).
 *
 * Penulisan ke SIPP lewat rute Kasir 1.186 (satu baris jurnal = satu
 * transaksi, atas akun SIPP petugas yang masuk, jejak di aleta_*).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarClock, FileDown, ListChecks, X } from "lucide-react";

import { DialogKasir } from "@/components/portal/kasir-jurnal";
import { KabarDiantrekan, TanyaJamKerja, type PilihJamKerja } from "@/components/portal/pilihan-jam-kerja";
import { Button } from "@/components/ui/button";
import { usePortal } from "@/lib/app-state";
import { apiPath } from "@/lib/base-path";
import { bolehKasir, pengawasKasir, rupiah } from "@/lib/kasir-jurnal";
import {
  JUDUL_PENGINGAT,
  LABEL_PERIODE,
  PERIODE_REKAP,
  SEBAB_HARIAN,
  barisMassal,
  centangBawaanMassal,
  jalankanMassal,
  jedaAntarPerkara,
  rupiahPenuh,
  tanggalPanjang,
  type DaftarHarian,
  type HasilMassal,
  type JawabanPengingat,
  type PeriodeRekap,
  type RekapKasir,
} from "@/lib/kasir-otomatis";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import { cn } from "@/lib/utils";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";

const ALAMAT_KASIR = "/api/aleta-ecourt/sidang/kasir";

async function bacaJson(jawaban: Response): Promise<Record<string, unknown>> {
  const isi = (await jawaban.json().catch(() => ({}))) as Record<string, unknown>;
  if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, `HTTP ${jawaban.status}`));
  return ((isi && (isi.data as Record<string, unknown>)) ?? isi) as Record<string, unknown>;
}

const kelasMedan =
  "h-8 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

type Akun = { ok: boolean; username?: string; milik?: string[]; pesan?: string; alasan?: string };

// ─── Massal ──────────────────────────────────────────────────────────────────

export function BagianMassal({ onSunting }: { onSunting: (perkaraId: string) => void }) {
  const [tanggal, setTanggal] = useState(() => waktuPengadilan().tanggal);
  const [data, setData] = useState<(DaftarHarian & { akun?: Akun }) | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState("");
  const [centang, setCentang] = useState<Record<number, boolean>>({});
  const [akunPilihan, setAkunPilihan] = useState("");
  const [laporan, setLaporan] = useState<Record<number, HasilMassal>>({});
  const [sedang, setSedang] = useState(false);
  const [yakin, setYakin] = useState(false);
  // Di luar jam kerja (keputusan 104): kalimat pertanyaan Antrekan / Tulis sekarang.
  const [tanyaJam, setTanyaJam] = useState<string | null>(null);
  const [diantrekan, setDiantrekan] = useState("");
  const henti = useRef(false);

  const muat = useCallback(async (t: string) => {
    setMemuat(true);
    setGalat("");
    setLaporan({});
    try {
      const isi = await bacaJson(await fetch(apiPath(`${ALAMAT_KASIR}/harian?tanggal=${encodeURIComponent(t)}`), { cache: "no-store" }));
      if (isi.available === false || isi.ok === false) {
        setGalat(String(isi.alasan || "Daftar perkara hari itu tidak terbaca."));
        setData(null);
        return;
      }
      const d = isi as unknown as DaftarHarian & { akun?: Akun };
      setData(d);
      setCentang(Object.fromEntries(d.perkara.map((p) => [p.perkaraId, centangBawaanMassal(p)])));
      if (d.akun?.ok && d.akun.username) setAkunPilihan(d.akun.username);
      else if (d.akun?.milik?.length) setAkunPilihan((x) => x || String(d.akun?.milik?.[0] || ""));
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Daftar perkara hari itu tidak terbaca.");
    } finally {
      setMemuat(false);
    }
  }, []);

  const tanggalAwal = useRef(tanggal);
  useEffect(() => {
    // Dibaca sekali saat dibuka; tanggal lain lewat tombol Baca.
    const jam = setTimeout(() => void muat(tanggalAwal.current), 0);
    return () => clearTimeout(jam);
  }, [muat]);

  const akun = data?.akun;
  const akunSiap = Boolean(akun && (akun.ok || (akun.alasan === "akun_sipp_ganda" && akunPilihan)));
  const dipilih = (data?.perkara ?? []).filter((p) => centang[p.perkaraId] && barisMassal(p).length > 0);

  async function jalankan(kering: boolean, pilihJam?: PilihJamKerja) {
    if (!data || sedang || !dipilih.length) return;
    setSedang(true);
    henti.current = false;
    setLaporan({});
    setTanyaJam(null);
    setDiantrekan("");
    let perluTanya = "";
    try {
      await jalankanMassal(
        dipilih,
        async (p) => {
          const isi = await bacaJson(
            await fetch(apiPath(ALAMAT_KASIR), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                perkaraId: String(p.perkaraId),
                akunSipp: akun?.ok ? akun.username : akunPilihan,
                baris: barisMassal(p),
                kering,
                massal: true,
                // Di luar jam kerja bot bertanya dulu; pilihan petugas berlaku untuk semua perkara.
                ...(kering ? {} : { tanyaJamKerja: true, ...(pilihJam ? { jamKerja: pilihJam } : {}) }),
              }),
            })
          );
          if (isi.perluPilihan === true || isi.kode === "di_luar_jam_kerja") {
            perluTanya = String(isi.pesan || isi.alasan || "Sekarang di luar jam kerja.");
            henti.current = true;
            return { ok: false, tersimpan: 0, pesan: "menunggu pilihan jam kerja" };
          }
          if (isi.diantrekan === true) {
            setDiantrekan(String(isi.pesan || isi.kalimat || ""));
            return { ok: true, tersimpan: 0, pesan: String(isi.kalimat || isi.pesan || "diantrekan - dikerjakan pada jam kerja berikutnya") };
          }
          const ringkas = (isi.ringkas ?? {}) as { tersimpan?: number; gagal?: number; sebagian?: number; sudahAda?: number };
          const ditolak = Array.isArray(isi.ditolak) ? isi.ditolak.length : 0;
          if (kering) {
            const n = Array.isArray(isi.rencana) ? isi.rencana.length : 0;
            return { ok: isi.ok !== false, tersimpan: 0, pesan: n ? `pratinjau: ${n} baris akan ditulis${ditolak ? `, ${ditolak} ditolak` : ""}` : String(isi.pesan || isi.alasan || "tidak ada baris yang perlu ditulis") };
          }
          const bagian = [
            ringkas.tersimpan ? `${ringkas.tersimpan} baris tersimpan` : "",
            ringkas.sudahAda ? `${ringkas.sudahAda} sudah ada` : "",
            ringkas.sebagian ? `${ringkas.sebagian} sebagian` : "",
            ditolak ? `${ditolak} ditolak` : "",
            ringkas.gagal ? `${ringkas.gagal} gagal` : "",
          ].filter(Boolean);
          return { ok: isi.ok === true, tersimpan: Number(ringkas.tersimpan) || 0, pesan: bagian.join(", ") || String(isi.pesan || isi.alasan || "tidak ada yang tersimpan") };
        },
        {
          jeda: kering ? undefined : () => jedaAntarPerkara(),
          berhenti: () => henti.current,
          kabar: (h) => setLaporan((x) => ({ ...x, [h.perkaraId]: h })),
        }
      );
    } finally {
      setSedang(false);
      if (perluTanya) {
        // Belum ada yang ditulis: laporan sementara dibuang, petugas memilih dulu.
        setLaporan({});
        setTanyaJam(perluTanya);
      }
    }
  }

  const tekanSimpan = () => {
    if (!yakin) {
      setYakin(true);
      setTimeout(() => setYakin(false), 8000);
      return;
    }
    setYakin(false);
    void jalankan(false);
  };

  const hasil = Object.values(laporan);
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" aria-label="Tanggal" className={kelasMedan} value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
        <Button size="sm" variant="outline" disabled={memuat || sedang} onClick={() => void muat(tanggal)}>
          Baca
        </Button>
        {data ? (
          <span className="text-xs text-muted-foreground">
            {data.jumlahCalon} perkara bergerak {tanggalPanjang(data.tanggal)}: {data.perkara.length} perlu dijurnal, {data.lengkap.length} sudah lengkap
            {data.gagal.length ? `, ${data.gagal.length} tidak terbaca` : ""}
            {data.terpotong ? " (daftar terpotong)" : ""}
          </span>
        ) : null}
      </div>
      {akun ? (
        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          {akun.ok ? (
            <span>
              Ditulis di SIPP atas akun SIPP Anda: <b>{akun.username}</b>.
            </span>
          ) : akun.alasan === "akun_sipp_ganda" ? (
            <label className="flex flex-wrap items-center gap-2">
              <span>Akun SIPP yang dipakai:</span>
              <select className={kelasMedan} value={akunPilihan} onChange={(e) => setAkunPilihan(e.target.value)}>
                {(akun.milik ?? []).map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="text-amber-700 dark:text-amber-300">{akun.pesan || "Akun SIPP Anda belum tertaut - usulan dapat dilihat, tetapi tidak dapat disimpan."}</span>
          )}
        </div>
      ) : null}
      {memuat ? <div className="min-h-[1.25rem]" aria-busy="true" /> : null}
      {galat ? <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{galat}</p> : null}
      {data && !memuat ? (
        <ul className="grid gap-2">
          {data.perkara.length === 0 ? <li className="text-sm text-muted-foreground">Tidak ada perkara yang perlu dijurnal pada tanggal ini.</li> : null}
          {data.perkara.map((p) => {
            const l = laporan[p.perkaraId];
            return (
              <li key={p.perkaraId} className={cn("rounded-md border px-3 py-2", !centang[p.perkaraId] && "opacity-80")}>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={Boolean(centang[p.perkaraId])}
                      disabled={sedang}
                      onChange={(e) => setCentang((x) => ({ ...x, [p.perkaraId]: e.target.checked }))}
                    />
                    <b>{p.nomorPerkara}</b>
                  </label>
                  <span className="text-xs text-muted-foreground">{p.jenisPerkara}</span>
                  <span className="rounded border border-sky-500/40 bg-sky-500/10 px-1.5 text-xs text-sky-700 dark:text-sky-300">{p.keadaan.nama}</span>
                  <span className="text-xs text-muted-foreground">{p.sebab.map((s) => SEBAB_HARIAN[s] ?? s).join(", ")}</span>
                  {p.perluPeriksa ? <span className="rounded border border-amber-500/40 px-1.5 text-xs text-amber-700 dark:text-amber-300">perlu diperiksa</span> : null}
                  {l ? (
                    <span
                      className={cn(
                        "rounded border px-1.5 text-xs",
                        l.keadaan === "tersimpan" ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300" : l.keadaan === "dilewati" ? "border-border text-muted-foreground" : "border-rose-500/40 text-rose-700 dark:text-rose-300"
                      )}
                    >
                      {l.pesan || l.keadaan}
                    </span>
                  ) : null}
                  <Button size="sm" variant="ghost" className="ml-auto h-7 text-xs" disabled={sedang} onClick={() => onSunting(String(p.perkaraId))}>
                    Sunting
                  </Button>
                </div>
                <div className="aleta-tabel-gulir">
                <table className="mt-1 w-full text-xs">
                  <tbody>
                    {p.usulan.map((u) => (
                      <tr key={u.kunci} className="border-t">
                        <td className="whitespace-nowrap py-0.5 pr-2">{tanggalPanjang(u.tanggal)}</td>
                        <td className="py-0.5 pr-2">{u.uraian}</td>
                        <td className="whitespace-nowrap py-0.5 pr-2 text-right">{u.jumlah === null ? "jumlah belum diketahui" : rupiah(u.jumlah)}</td>
                        <td className="py-0.5 text-muted-foreground">{u.dasar}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                {p.catatan.length ? <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">{p.catatan.join(" ")}</p> : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {tanyaJam !== null ? <TanyaJamKerja pesan={tanyaJam} sibuk={sedang} onPilih={(p) => void jalankan(false, p)} /> : null}
      {diantrekan ? <KabarDiantrekan pesan={diantrekan} /> : null}
      {hasil.length ? (
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          Laporan: {hasil.filter((h) => h.keadaan === "tersimpan").length} perkara berhasil, {hasil.filter((h) => h.keadaan === "sebagian").length} sebagian,{" "}
          {hasil.filter((h) => h.keadaan === "gagal").length} gagal, {hasil.filter((h) => h.keadaan === "dilewati").length} dihentikan.
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
        <span className="mr-auto text-xs text-muted-foreground">
          {dipilih.length} perkara dicentang - disimpan satu per satu dengan jeda; satu yang gagal tidak menghentikan yang lain.
        </span>
        {sedang ? (
          <Button size="sm" variant="outline" onClick={() => (henti.current = true)}>
            Hentikan
          </Button>
        ) : null}
        <Button size="sm" variant="outline" disabled={sedang || !dipilih.length || !akunSiap} onClick={() => void jalankan(true)}>
          Pratinjau (uji coba)
        </Button>
        <Button size="sm" variant={yakin ? "destructive" : "default"} disabled={sedang || !dipilih.length || !akunSiap} onClick={tekanSimpan}>
          {yakin ? `Tekan sekali lagi: simpan ${dipilih.length} perkara ke SIPP` : `Simpan ke SIPP (${dipilih.length} perkara)`}
        </Button>
      </div>
    </div>
  );
}

// ─── Rekap ───────────────────────────────────────────────────────────────────

function IsiRekap({ periode, tanggal }: { periode: PeriodeRekap; tanggal: string }) {
  const [rekap, setRekap] = useState<RekapKasir | null>(null);
  const [galat, setGalat] = useState("");
  const [unduh, setUnduh] = useState(false);
  // Dipasang ulang (key) tiap periode/tanggal berganti - keadaan awalnya kosong.
  useEffect(() => {
    let hidup = true;
    void (async () => {
      try {
        const isi = await bacaJson(await fetch(apiPath(`${ALAMAT_KASIR}/rekap?periode=${periode}&tanggal=${encodeURIComponent(tanggal)}`), { cache: "no-store" }));
        if (!hidup) return;
        if (isi.ok === false || isi.available === false) setGalat(String(isi.alasan || "Rekap tidak terbaca."));
        else setRekap(isi.rekap as RekapKasir);
      } catch (e) {
        if (hidup) setGalat(e instanceof Error ? e.message : "Rekap tidak terbaca.");
      }
    })();
    return () => {
      hidup = false;
    };
  }, [periode, tanggal]);

  async function unduhPdf() {
    setUnduh(true);
    try {
      const jawaban = await fetch(apiPath(`${ALAMAT_KASIR}/rekap/pdf?periode=${periode}&tanggal=${encodeURIComponent(tanggal)}`), { cache: "no-store" });
      if (!String(jawaban.headers.get("content-type") || "").includes("application/pdf")) {
        const isi = await bacaJson(jawaban);
        setGalat(String(isi.alasan || "PDF rekap tidak terbentuk."));
        return;
      }
      const berkas = await jawaban.blob();
      const tautan = document.createElement("a");
      tautan.href = URL.createObjectURL(berkas);
      tautan.download = `Rekap kasir ${periode} ${rekap?.dari ?? tanggal}.pdf`;
      tautan.click();
      setTimeout(() => URL.revokeObjectURL(tautan.href), 5000);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "PDF rekap tidak terbentuk.");
    } finally {
      setUnduh(false);
    }
  }

  if (galat) return <p className="text-sm text-rose-700 dark:text-rose-300">{galat}</p>;
  if (!rekap) return <div className="min-h-[1.25rem]" aria-busy="true" />;
  return (
    <div className="grid gap-2 text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-muted-foreground">{rekap.label}</span>
        <span>
          Keluar <b>{rupiahPenuh(rekap.totalKeluar)}</b>
        </span>
        <span>
          Masuk <b>{rupiahPenuh(rekap.totalMasuk)}</b>
        </span>
        <span>
          PNBP <b>{rupiahPenuh(rekap.totalPnbp)}</b> (tercatat disetor {rupiahPenuh(rekap.pnbpDisetor)})
        </span>
        <span>
          Sisa dikembalikan <b>{rupiahPenuh(rekap.sisaDikembalikan)}</b>
        </span>
        <Button size="sm" variant="outline" className="ml-auto h-7 text-xs" disabled={unduh} onClick={() => void unduhPdf()}>
          <FileDown className="mr-1 h-3.5 w-3.5" />
          {unduh ? "Menyusun PDF…" : "Unduh PDF"}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[520px] text-xs">
          <thead className="bg-muted/60 text-left">
            <tr>
              <th className="px-2 py-1">Jenis biaya</th>
              <th className="px-2 py-1 text-right">Transaksi</th>
              <th className="px-2 py-1 text-right">Perkara</th>
              <th className="px-2 py-1 text-right">Jumlah</th>
              <th className="px-2 py-1 text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {rekap.pengeluaran.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-2 py-1.5 text-muted-foreground">
                  Tidak ada pengeluaran pada periode ini.
                </td>
              </tr>
            ) : null}
            {rekap.pengeluaran.map((j) => (
              <tr key={j.jenisBiayaId} className="border-t">
                <td className="px-2 py-1">{j.nama}</td>
                <td className="px-2 py-1 text-right">{j.baris}</td>
                <td className="px-2 py-1 text-right">{j.perkara}</td>
                <td className="whitespace-nowrap px-2 py-1 text-right">{rupiahPenuh(j.jumlah)}</td>
                <td className="px-2 py-1 text-right">{j.persen}%</td>
              </tr>
            ))}
            <tr className="border-t font-semibold">
              <td className="px-2 py-1">Total pengeluaran</td>
              <td className="px-2 py-1 text-right">{rekap.jumlahBarisKeluar}</td>
              <td />
              <td className="whitespace-nowrap px-2 py-1 text-right">{rupiahPenuh(rekap.totalKeluar)}</td>
              <td className="px-2 py-1 text-right">100%</td>
            </tr>
          </tbody>
        </table>
      </div>
      <details className="rounded-md border px-2 py-1">
        <summary className="cursor-pointer text-xs font-medium">Per perkara ({rekap.perPerkara.length})</summary>
        <div className="aleta-tabel-gulir">
        <table className="mt-1 w-full text-xs">
          <tbody>
            {rekap.perPerkara.map((p) => (
              <tr key={p.perkaraId} className="border-t">
                <td className="py-0.5 pr-2">{p.nomorPerkara}</td>
                <td className="py-0.5 pr-2 text-muted-foreground">{p.jenisPerkara}</td>
                <td className="whitespace-nowrap py-0.5 pr-2 text-right">masuk {rupiahPenuh(p.masuk)}</td>
                <td className="whitespace-nowrap py-0.5 text-right">keluar {rupiahPenuh(p.keluar)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </details>
    </div>
  );
}

function BagianRekap() {
  const [tanggal, setTanggal] = useState(() => waktuPengadilan().tanggal);
  const [terbuka, setTerbuka] = useState<Record<string, boolean>>({ harian: true });
  return (
    <div className="grid gap-2">
      <label className="flex flex-wrap items-center gap-2 text-sm">
        <span>Tanggal acuan</span>
        <input type="date" aria-label="Tanggal acuan rekap" className={kelasMedan} value={tanggal} onChange={(e) => e.target.value && setTanggal(e.target.value)} />
        <span className="text-xs text-muted-foreground">Tiap periode memuat tanggal ini (minggu Senin-Minggu).</span>
      </label>
      {PERIODE_REKAP.map((p) => (
        <details
          key={p}
          className="rounded-md border px-3 py-2"
          open={Boolean(terbuka[p])}
          onToggle={(e) => {
            const buka = (e.currentTarget as HTMLDetailsElement).open;
            setTerbuka((x) => (x[p] === buka ? x : { ...x, [p]: buka }));
          }}
        >
          <summary className="cursor-pointer text-sm font-semibold">{LABEL_PERIODE[p]}</summary>
          {terbuka[p] ? (
            <div className="mt-2">
              <IsiRekap key={`${p}|${tanggal}`} periode={p} tanggal={tanggal} />
            </div>
          ) : null}
        </details>
      ))}
    </div>
  );
}

// ─── Pengingat ───────────────────────────────────────────────────────────────

export function BagianPengingatKasir({ onSunting, hanyaBaca = false }: { onSunting?: (perkaraId: string) => void; hanyaBaca?: boolean }) {
  const [data, setData] = useState<JawabanPengingat | null>(null);
  const [galat, setGalat] = useState("");
  const [pilihSetor, setPilihSetor] = useState<Record<string, boolean>>({});
  const [ntpn, setNtpn] = useState("");
  const [kabar, setKabar] = useState("");
  const [sedang, setSedang] = useState(false);

  const muat = useCallback(async (segar = false) => {
    setGalat("");
    try {
      const isi = await bacaJson(await fetch(apiPath(`${ALAMAT_KASIR}/pengingat${segar ? "?segar=1" : ""}`), { cache: "no-store" }));
      if (isi.ok === false || isi.available === false) setGalat(String(isi.alasan || "Pengingat kasir tidak terbaca."));
      else setData(isi as unknown as JawabanPengingat);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Pengingat kasir tidak terbaca.");
    }
  }, []);

  useEffect(() => {
    const jam = setTimeout(() => void muat(), 0);
    return () => clearTimeout(jam);
  }, [muat]);

  async function tandaiSetor() {
    const tanggal = Object.keys(pilihSetor).filter((t) => pilihSetor[t]);
    if (!tanggal.length) return;
    setSedang(true);
    setKabar("");
    try {
      const isi = await bacaJson(
        await fetch(apiPath(`${ALAMAT_KASIR}/pengingat`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tanggal, ntpn }),
        })
      );
      if (isi.ok === false || isi.available === false) setKabar(String(isi.alasan || "Setoran tidak tercatat."));
      else {
        setKabar(`${tanggal.length} hari PNBP dicatat sudah disetor (di ALETA - SIPP tidak diubah).`);
        setPilihSetor({});
        setNtpn("");
        await muat(true);
      }
    } catch (e) {
      setKabar(e instanceof Error ? e.message : "Setoran tidak tercatat.");
    } finally {
      setSedang(false);
    }
  }

  if (galat) return <p className="text-sm text-rose-700 dark:text-rose-300">{galat}</p>;
  if (!data) return <div className="min-h-[1.25rem]" aria-busy="true" />;
  const kelompok = (["sisa-panjar", "belum-dijurnal", "panjar-kurang", "pnbp-belum-setor"] as const).map((j) => ({ jenis: j, butir: data.butir.filter((b) => b.jenis === j) }));
  return (
    <div className="grid gap-3 text-sm">
      {hanyaBaca ? <p className="text-xs text-muted-foreground">Hanya pengingat: jurnal dan setoran PNBP dikerjakan kasir atau petugas keuangan.</p> : null}
      {data.butir.length === 0 ? <p className="text-muted-foreground">Tidak ada tugas kasir yang tertinggal.</p> : null}
      {kelompok
        .filter((k) => k.butir.length)
        .map((k) => (
          <section key={k.jenis} className="rounded-md border px-3 py-2">
            <h4 className="mb-1 font-semibold">
              {JUDUL_PENGINGAT[k.jenis]} <span className="font-normal text-muted-foreground">({k.butir.length})</span>
            </h4>
            <ul className="grid gap-1 text-xs">
              {k.butir.map((b) => (
                <li key={`${b.jenis}-${b.perkaraId}-${b.tanggal ?? ""}`} className="flex flex-wrap items-center gap-2">
                  {b.jenis === "pnbp-belum-setor" && !hanyaBaca ? (
                    <input
                      type="checkbox"
                      aria-label={`Pilih PNBP ${b.tanggal}`}
                      checked={Boolean(b.tanggal && pilihSetor[b.tanggal])}
                      onChange={(e) => b.tanggal && setPilihSetor((x) => ({ ...x, [b.tanggal as string]: e.target.checked }))}
                    />
                  ) : null}
                  <span className={cn("whitespace-nowrap", b.tenggat < data.hariIni && "font-semibold text-rose-700 dark:text-rose-300")}>tenggat {tanggalPanjang(b.tenggat)}</span>
                  {b.nomorPerkara ? <b>{b.nomorPerkara}</b> : null}
                  <span className="text-muted-foreground">{b.keterangan}</span>
                  {b.perkaraId && onSunting && !hanyaBaca ? (
                    <Button size="sm" variant="ghost" className="ml-auto h-6 text-xs" onClick={() => onSunting(String(b.perkaraId))}>
                      Buka jurnal
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
            {k.jenis === "pnbp-belum-setor" && !hanyaBaca ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input type="text" aria-label="NTPN" placeholder="NTPN (boleh kosong)" className={cn(kelasMedan, "w-56")} value={ntpn} onChange={(e) => setNtpn(e.target.value)} />
                <Button size="sm" variant="outline" disabled={sedang || !Object.values(pilihSetor).some(Boolean)} onClick={() => void tandaiSetor()}>
                  Tandai sudah disetor
                </Button>
                {kabar ? <span className="text-xs text-muted-foreground">{kabar}</span> : null}
              </div>
            ) : null}
          </section>
        ))}
    </div>
  );
}

// ─── Dialog & tombol ─────────────────────────────────────────────────────────

type TabKasir = "massal" | "rekap" | "pengingat";

function DialogKasirHarian({ onTutup, tabAwal, hanyaBaca = false }: { onTutup: () => void; tabAwal: TabKasir; hanyaBaca?: boolean }) {
  const [tab, setTab] = useState<TabKasir>(hanyaBaca && tabAwal === "massal" ? "pengingat" : tabAwal);
  const [sunting, setSunting] = useState("");
  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !sunting) onTutup();
    };
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, [onTutup, sunting]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <>
    <div className="fixed inset-0 z-[65] flex items-start justify-center overflow-y-auto bg-black/40 p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="Kasir harian" onClick={onTutup}>
      <div className="my-4 w-full max-w-5xl rounded-lg border bg-card p-4 text-card-foreground shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold">Kasir harian</h3>
            <p className="text-sm text-muted-foreground">Jurnal otomatis per keadaan perkara untuk satu hari, rekap pengeluaran, dan pengingat tugas kasir.</p>
          </div>
          <Button size="sm" variant="ghost" onClick={onTutup} aria-label="Tutup">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="mb-3 flex gap-1 border-b" role="tablist">
          {(
            [
              ["massal", "Massal hari ini"],
              ["rekap", "Rekap"],
              ["pengingat", "Pengingat"],
            ] as Array<[TabKasir, string]>
          )
            .filter(([k]) => !(hanyaBaca && k === "massal"))
            .map(([k, judul]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              className={cn("-mb-px border-b-2 px-3 py-1.5 text-sm", tab === k ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}
              onClick={() => setTab(k)}
            >
              {judul}
            </button>
          ))}
        </div>
        {tab === "massal" && !hanyaBaca ? <BagianMassal onSunting={setSunting} /> : null}
        {tab === "rekap" ? <BagianRekap /> : null}
        {tab === "pengingat" ? <BagianPengingatKasir onSunting={hanyaBaca ? undefined : setSunting} hanyaBaca={hanyaBaca} /> : null}
      </div>
    </div>
    {/* Di luar latar dialog ini: klik di dialog Kasir tidak menutup Kasir harian. */}
    {sunting ? <DialogKasir daftar={[]} awal={sunting} onTutup={() => setSunting("")} /> : null}
    </>,
    document.body
  );
}

/** Tombol "Kasir harian" di deretan alat Jadwal Sidang. Jangkar #kasir membukanya langsung (tab Pengingat). */
export function TombolKasirHarian() {
  const { currentUser } = usePortal();
  const [buka, setBuka] = useState<TabKasir | "">("");
  const tutup = useCallback(() => setBuka(""), []);
  const boleh = bolehKasir(currentUser);
  // Panitera/panitera muda: membaca saja (rekap dan pengingat), tanpa massal/jurnal/setoran.
  const hanyaBaca = pengawasKasir(currentUser);
  useEffect(() => {
    if (!boleh) return;
    const jam = setTimeout(() => {
      try {
        if (String(window.location.hash || "").toLowerCase() === "#kasir") setBuka("pengingat");
      } catch {
        /* tanpa jangkar */
      }
    }, 0);
    return () => clearTimeout(jam);
  }, [boleh]);
  if (!boleh) return null;
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setBuka("massal")} title="Kasir harian: jurnal otomatis massal satu hari, rekap pengeluaran (PDF), dan pengingat tugas kasir">
        <CalendarClock className="mr-1.5 h-4 w-4" />
        Kasir harian
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setBuka("pengingat")} title="Pengingat tugas kasir" aria-label="Pengingat tugas kasir">
        <ListChecks className="h-4 w-4" />
      </Button>
      {buka ? <DialogKasirHarian tabAwal={buka} onTutup={tutup} hanyaBaca={hanyaBaca} /> : null}
    </>
  );
}
