"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { apiPath } from "@/lib/base-path";
import type { PengaturanKtpEfektif, PengaturanKtpTersimpan } from "@/lib/ktp-pihak-pengaturan";
import {
  TEKS_PEMICU_KTP,
  teksCocokKtp,
  teksSebabKtp,
  teksSumberBacaKtp,
  teksYakinKtp,
  type HasilPihakRiwayat,
  type PerkaraKtpRingkas,
  type RingkasanKtpPihak,
  type RiwayatPerkaraKtp,
} from "@/lib/ktp-pihak-tampil";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/* === 12OKT-E: Penarikan tanggal KTP pihak - pengaturan & histori (butir 11) === */

/**
 * ============================================================================
 * PENARIKAN TANGGAL KTP PIHAK - PENGATURAN DAN HISTORI
 * ============================================================================
 *
 * Pengaturan Integrasi e-Court (Admin/Super Admin): menyalakan atau mematikan penyapu
 * latar yang membaca berkas KTP e-Court, berapa berkas tiap putaran, dan jedanya.
 * Yang disimpan di sini MENANG atas env dan berlaku tanpa restart.
 *
 * Histori: apa saja yang sudah ditarik per nomor perkara - berkas, waktu dibaca, hasil
 * per pihak, sebab gagal, percobaan ke-n, siapa yang memicu. NIK tidak pernah tampil.
 * Tidak ada yang ditulis ke SIPP/ABT/e-Court.
 */

type Penyapu = {
  menyala: boolean;
  sedangMembaca: boolean;
  terakhir: {
    pemicu: string;
    mulaiPada: string;
    selesaiPada: string;
    dibaca: number;
    terbaca: number;
    terkirim: boolean;
    antrianTerjangkau: boolean;
  } | null;
  putaranBerikutnyaPada: string | null;
};

type Halaman = {
  available: boolean;
  tersimpan: PengaturanKtpTersimpan | null;
  efektif: PengaturanKtpEfektif;
  bawaanServer: PengaturanKtpEfektif;
  batas: { perPutaran: { min: number; maks: number }; jedaDetik: { min: number; maks: number } };
  penyapu: Penyapu;
  ringkasan: RingkasanKtpPihak | null;
  pesanRingkasan: string;
};

export function waktuLokalKtp(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  try {
    return d.toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

/** "120 detik" -> "2 menit"; angka bukan kelipatan tetap detik. */
export function jedaTeks(detik: number): string {
  if (!Number.isFinite(detik) || detik <= 0) return "-";
  if (detik % 3600 === 0) return `${detik / 3600} jam`;
  if (detik % 60 === 0) return `${detik / 60} menit`;
  return `${detik} detik`;
}

const SUMBER_TEKS: Record<string, string> = {
  layar: "diatur dari layar ini",
  env: "dari pengaturan server (env)",
  bawaan: "bawaan ALETA",
};

function Angka({ nilai, label, nada = "netral" }: { nilai: number; label: string; nada?: "netral" | "perhatian" }) {
  return (
    <div className={`rounded-lg border p-3 ${nada === "perhatian" ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40" : "border-border bg-card"}`}>
      <p className="text-xl font-semibold tabular-nums">{nilai}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function HasilPihak({ hasil }: { hasil: HasilPihakRiwayat[] }) {
  if (hasil.length === 0) return <span className="text-muted-foreground">tidak ada KTP terbaca</span>;
  return (
    <ul className="space-y-0.5">
      {hasil.map((h, i) => (
        <li key={`${h.peran}-${i}`} className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="font-medium">{h.peran || "tak bertuan"}</span>
          {h.tanggalKtp ? <span className="tabular-nums">{h.tanggalKtp}</span> : <span className="text-muted-foreground">tanpa tanggal</span>}
          {h.yakin ? <Badge variant={h.yakin === "ragu" ? "warning" : "success"}>{teksYakinKtp(h.yakin)}</Badge> : null}
          {h.cocok ? <span className="text-muted-foreground">{teksCocokKtp(h.cocok)}</span> : null}
          {h.sebab ? <span className="text-amber-700 dark:text-amber-300">{teksSebabKtp(h.sebab)}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function RincianPerkara({
  riwayat,
  sibuk,
  onBacaUlang,
}: {
  riwayat: RiwayatPerkaraKtp;
  sibuk: boolean;
  onBacaUlang: () => void;
}) {
  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3 text-sm" data-bagian="rincian-ktp">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{riwayat.nomorPerkara}</p>
          <p className="text-xs text-muted-foreground">
            {riwayat.dokumenKtp} dokumen KTP di arsip e-Court · {riwayat.berkas.length} berkas sudah diproses · {riwayat.belumDibaca.length} belum dibaca
          </p>
        </div>
        <Button size="sm" variant="outline" disabled={sibuk} onClick={onBacaUlang}>
          {sibuk ? "Membaca…" : "Baca ulang perkara ini"}
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-xs">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-1 pr-2 font-medium">Berkas</th>
              <th className="py-1 pr-2 font-medium">Hasil</th>
              <th className="py-1 pr-2 font-medium">Dibaca</th>
              <th className="py-1 font-medium">Hasil per pihak</th>
            </tr>
          </thead>
          <tbody>
            {riwayat.berkas.map((b) => (
              <tr key={b.fileId} className="border-b align-top last:border-0">
                <td className="py-1.5 pr-2">
                  <span className="font-medium">{b.judul || "KTP"}</span>
                  <span className="ml-1 text-muted-foreground">{b.format}</span>
                </td>
                <td className="py-1.5 pr-2">
                  <Badge variant={b.status === "terbaca" ? "success" : "warning"}>
                    {b.status === "terbaca" ? "terbaca" : b.status === "bukan_ktp" ? "bukan KTP" : "tidak terbaca"}
                  </Badge>
                  {b.sebab ? <div className="mt-0.5 text-muted-foreground">{teksSebabKtp(b.sebab)}</div> : null}
                  {b.status !== "terbaca" ? <div className="text-muted-foreground">percobaan ke-{b.percobaan}</div> : null}
                </td>
                <td className="py-1.5 pr-2">
                  {waktuLokalKtp(b.dibacaPada)}
                  {b.sumberBaca ? <div className="text-muted-foreground">{teksSumberBacaKtp(b.sumberBaca)}</div> : null}
                </td>
                <td className="py-1.5">{b.status === "terbaca" ? <HasilPihak hasil={b.pihak} /> : <span className="text-muted-foreground">-</span>}</td>
              </tr>
            ))}
            {riwayat.belumDibaca.map((b) => (
              <tr key={`belum-${b.fileId}`} className="border-b align-top last:border-0">
                <td className="py-1.5 pr-2">
                  <span className="font-medium">{b.judul || "KTP"}</span>
                  <span className="ml-1 text-muted-foreground">{b.format}</span>
                </td>
                <td className="py-1.5 pr-2">
                  <Badge variant="muted">belum dibaca</Badge>
                </td>
                <td className="py-1.5 pr-2">-</td>
                <td className="py-1.5 text-muted-foreground">menunggu penyapu latar atau Baca ulang</td>
              </tr>
            ))}
            {riwayat.berkas.length === 0 && riwayat.belumDibaca.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-2 text-muted-foreground">
                  Tidak ada berkas KTP e-Court untuk perkara ini.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div>
        <p className="text-xs font-medium">Percobaan terdahulu ({riwayat.percobaan.length})</p>
        {riwayat.percobaan.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Belum ada percobaan yang tercatat. Percobaan dicatat sejak fitur ini dipasang; keadaan berkas di atas tetap lengkap.
          </p>
        ) : (
          <ul className="mt-1 space-y-1.5 text-xs">
            {riwayat.percobaan.map((p, i) => (
              <li key={`${p.fileId}-${p.waktu}-${i}`} className="rounded border bg-card p-2">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="tabular-nums">{waktuLokalKtp(p.waktu)}</span>
                  <Badge variant={p.status === "terbaca" ? "success" : "warning"}>{p.status === "terbaca" ? "terbaca" : "gagal"}</Badge>
                  <span className="text-muted-foreground">dipicu {TEKS_PEMICU_KTP[p.pemicu] ?? "tidak dicatat"}</span>
                  {p.sumberBaca ? <span className="text-muted-foreground">· {teksSumberBacaKtp(p.sumberBaca)}</span> : null}
                  {p.status !== "terbaca" ? <span className="text-muted-foreground">· percobaan ke-{p.percobaan}</span> : null}
                </div>
                {p.sebab ? <div className="text-amber-700 dark:text-amber-300">{teksSebabKtp(p.sebab)}</div> : null}
                {p.hasil.length > 0 ? (
                  <div className="mt-0.5">
                    <HasilPihak hasil={p.hasil} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function AletaEcourtKtpPihak() {
  const [halaman, setHalaman] = useState<Halaman | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [ditolak, setDitolak] = useState(false);
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);

  // Isian pengaturan (disalin dari halaman, diubah petugas, baru berlaku saat Simpan).
  const [aktif, setAktif] = useState(true);
  const [batas, setBatas] = useState(2);
  const [jeda, setJeda] = useState(120);

  // Histori.
  const [cari, setCari] = useState("");
  const [daftar, setDaftar] = useState<PerkaraKtpRingkas[] | null>(null);
  const [adaLagi, setAdaLagi] = useState(false);
  const [pesanDaftar, setPesanDaftar] = useState("");
  const [mencari, setMencari] = useState(false);
  const [terpilih, setTerpilih] = useState("");
  const [rincian, setRincian] = useState<RiwayatPerkaraKtp | null>(null);
  const [pesanRincian, setPesanRincian] = useState("");
  const [membacaUlang, setMembacaUlang] = useState(false);

  const isiDariHalaman = useCallback((h: Halaman) => {
    setHalaman(h);
    setAktif(h.efektif.aktif);
    setBatas(h.efektif.batas);
    setJeda(Math.round(h.efektif.jedaMs / 1000));
  }, []);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat("");
    try {
      const jawaban = await fetch(apiPath("/api/aleta-ecourt/ktp-pihak-pengaturan"), { cache: "no-store" });
      if (jawaban.status === 403) {
        setDitolak(true);
        return;
      }
      const isi = await jawaban.json();
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal membaca pengaturan penarikan KTP."));
      isiDariHalaman((isi?.data ?? isi) as Halaman);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal membaca pengaturan penarikan KTP.");
    } finally {
      setMemuat(false);
    }
  }, [isiDariHalaman]);

  const cariPerkara = useCallback(async (kata: string, mulai = 0) => {
    setMencari(true);
    setPesanDaftar("");
    try {
      const kueri = new URLSearchParams({ bagian: "riwayat", cari: kata, mulai: String(mulai) });
      const jawaban = await fetch(apiPath(`/api/aleta-ecourt/ktp-pihak-pengaturan?${kueri.toString()}`), { cache: "no-store" });
      const isi = await jawaban.json();
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal membaca histori."));
      const data = (isi?.data ?? isi) as { available: boolean; message: string; perkara: PerkaraKtpRingkas[]; adaLagi: boolean };
      if (!data.available) {
        setPesanDaftar(data.message || "ALETA Bot belum dapat dihubungi.");
        return;
      }
      setDaftar((lama) => (mulai > 0 && lama ? [...lama, ...data.perkara] : data.perkara));
      setAdaLagi(data.adaLagi);
    } catch (e) {
      setPesanDaftar(e instanceof Error ? e.message : "Gagal membaca histori.");
    } finally {
      setMencari(false);
    }
  }, []);

  const bukaPerkara = useCallback(async (nomor: string) => {
    setTerpilih(nomor);
    setRincian(null);
    setPesanRincian("");
    try {
      const jawaban = await fetch(apiPath(`/api/aleta-ecourt/ktp-pihak-pengaturan?${new URLSearchParams({ bagian: "perkara", nomor }).toString()}`), {
        cache: "no-store",
      });
      const isi = await jawaban.json();
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal membaca rincian perkara."));
      const data = (isi?.data ?? isi) as { available: boolean; message: string; riwayat: RiwayatPerkaraKtp | null };
      if (!data.available || !data.riwayat) setPesanRincian(data.message || "Rincian tidak tersedia.");
      else setRincian(data.riwayat);
    } catch (e) {
      setPesanRincian(e instanceof Error ? e.message : "Gagal membaca rincian perkara.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void muat();
      void cariPerkara("");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [muat, cariPerkara]);

  const simpan = useCallback(
    async (bawaan: boolean) => {
      setSibuk(true);
      setGalat("");
      setPesan("");
      try {
        const jawaban = await fetch(apiPath("/api/aleta-ecourt/ktp-pihak-pengaturan"), {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(bawaan ? { bawaan: true } : { aktif, batas, jedaDetik: jeda }),
        });
        const isi = await jawaban.json();
        if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal menyimpan."));
        isiDariHalaman((isi?.data ?? isi) as Halaman);
        setPesan(bawaan ? "Kembali ke bawaan server. Berlaku dalam 30 detik." : "Tersimpan. Berlaku dalam 30 detik, tanpa restart.");
      } catch (e) {
        setGalat(e instanceof Error ? e.message : "Gagal menyimpan.");
      } finally {
        setSibuk(false);
      }
    },
    [aktif, batas, jeda, isiDariHalaman]
  );

  const bacaUlang = useCallback(async () => {
    if (!terpilih) return;
    setMembacaUlang(true);
    setPesanRincian("");
    try {
      const jawaban = await fetch(apiPath("/api/aleta-ecourt/ktp-pihak-pengaturan"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ aksi: "baca-ulang", nomor: terpilih }),
      });
      const isi = await jawaban.json();
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal membaca ulang."));
      const data = (isi?.data ?? isi) as { available: boolean; message: string; dibaca: number; terbaca: number; sedangSibuk: boolean };
      const hasil = !data.available
        ? data.message || "ALETA Bot belum dapat dihubungi."
        : data.sedangSibuk
          ? "Putaran lain sedang berjalan; berkas sudah ditandai dan akan dibaca penyapu latar sebentar lagi."
          : `Selesai: ${data.dibaca} berkas dibaca, ${data.terbaca} terbaca.`;
      await bukaPerkara(terpilih); // memuat ulang rincian (dan mengosongkan pesan) - pesan hasil dipasang SESUDAHNYA
      setPesanRincian(hasil);
      void cariPerkara(cari);
      void muat();
    } catch (e) {
      setPesanRincian(e instanceof Error ? e.message : "Gagal membaca ulang.");
    } finally {
      setMembacaUlang(false);
    }
  }, [terpilih, bukaPerkara, cariPerkara, cari, muat]);

  // Bukan Admin/Super Admin: kartu tidak digambar sama sekali.
  if (ditolak) return null;

  const r = halaman?.ringkasan ?? null;
  const e = halaman?.efektif;
  const berubah =
    !!halaman &&
    (aktif !== halaman.efektif.aktif || batas !== halaman.efektif.batas || jeda !== Math.round(halaman.efektif.jedaMs / 1000));

  return (
    <Card id="ktp-pihak">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Penarikan tanggal KTP pihak
            {e ? <Badge variant={e.aktif ? "default" : "muted"}>{e.aktif ? "Penyapu latar aktif" : "Penyapu latar mati"}</Badge> : null}
          </CardTitle>
          <CardDescription>
            ALETA membaca berkas KTP yang diunggah pihak di e-Court (dibaca saja) untuk mengisi tanggal KTP di Status Perkara dan
            usulan variabel ABT. Di sini penyapu latar diatur dan hasilnya dapat ditelusuri per nomor perkara.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => void muat()}>
          Muat Ulang
        </Button>
      </CardHeader>

      <CardContent className="space-y-5">
        {galat ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{galat}</p>
        ) : null}
        {pesan ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{pesan}</p>
        ) : null}

        {memuat && !halaman ? <p className="text-sm text-muted-foreground">Memuat…</p> : null}

        {halaman ? (
          <>
            {r ? (
              <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
                <Angka nilai={r.perkara} label="Perkara berkas KTP" />
                <Angka nilai={r.berkas} label="Berkas KTP e-Court" />
                <Angka nilai={r.terbaca} label="Berkas terbaca" />
                <Angka nilai={r.belumDibaca} label="Belum dibaca" nada={r.belumDibaca > 0 ? "perhatian" : "netral"} />
                <Angka nilai={r.tidakTerbaca + r.bukanKtp} label="Tidak terbaca / bukan KTP" nada={r.tidakTerbaca > 0 ? "perhatian" : "netral"} />
                <Angka nilai={r.pihakBertanggal} label="Pihak bertanggal KTP" />
              </div>
            ) : (
              <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
                Angka ringkas tidak terbaca: {halaman.pesanRingkasan || "ALETA Bot belum dapat dihubungi."}
              </p>
            )}

            {/* ---- pengaturan ---- */}
            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-medium">Pengaturan penyapu latar</p>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={aktif} onCheckedChange={setAktif} aria-label="Penyapu latar tanggal KTP" />
                  <span>{aktif ? "Menyala" : "Mati"}</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Berkas per putaran</span>
                  <Input
                    type="number"
                    min={halaman.batas.perPutaran.min}
                    max={halaman.batas.perPutaran.maks}
                    value={batas}
                    onChange={(p) => setBatas(Number(p.target.value))}
                    className="w-20"
                    aria-label="Berkas per putaran"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Jeda antar putaran (detik)</span>
                  <Input
                    type="number"
                    min={halaman.batas.jedaDetik.min}
                    max={halaman.batas.jedaDetik.maks}
                    value={jeda}
                    onChange={(p) => setJeda(Number(p.target.value))}
                    className="w-24"
                    aria-label="Jeda antar putaran dalam detik"
                  />
                  <span className="text-xs text-muted-foreground">= {jedaTeks(jeda)}</span>
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" disabled={sibuk || !berubah} onClick={() => void simpan(false)}>
                  {sibuk ? "Menyimpan…" : "Simpan"}
                </Button>
                <Button size="sm" variant="outline" disabled={sibuk || !halaman.tersimpan} onClick={() => void simpan(true)}>
                  Pakai bawaan server
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Yang berlaku sekarang: {e?.aktif ? "menyala" : "mati"}, {e?.batas} berkas tiap putaran, jeda {jedaTeks(Math.round((e?.jedaMs ?? 0) / 1000))} (
                {SUMBER_TEKS[e?.sumber ?? "bawaan"]}
                {halaman.tersimpan?.diubahOleh ? ` oleh ${halaman.tersimpan.diubahOleh}, ${waktuLokalKtp(halaman.tersimpan.diubahPada ?? "")}` : ""}).
                Bawaan server: {halaman.bawaanServer.aktif ? "menyala" : "mati"}, {halaman.bawaanServer.batas} berkas, jeda{" "}
                {jedaTeks(Math.round(halaman.bawaanServer.jedaMs / 1000))} ({SUMBER_TEKS[halaman.bawaanServer.sumber]}). Pengaturan di sini menang atas env dan
                berlaku dalam 30 detik tanpa restart; yang sedang berjalan diselesaikan dulu.
              </p>
              <p className="text-xs text-muted-foreground">
                Penyapu di proses ini:{" "}
                {halaman.penyapu.sedangMembaca
                  ? "sedang membaca"
                  : halaman.penyapu.menyala
                    ? "siaga"
                    : "belum berdiri (portal baru dinyalakan atau mode uji)"}
                {halaman.penyapu.terakhir
                  ? `. Putaran terakhir ${waktuLokalKtp(halaman.penyapu.terakhir.selesaiPada)} (${TEKS_PEMICU_KTP[halaman.penyapu.terakhir.pemicu] ?? halaman.penyapu.terakhir.pemicu}): ${halaman.penyapu.terakhir.dibaca} berkas dibaca, ${halaman.penyapu.terakhir.terbaca} terbaca${halaman.penyapu.terakhir.antrianTerjangkau ? "" : " - ALETA Bot tidak terjangkau"}`
                  : ". Belum ada putaran sejak portal dinyalakan"}
                {halaman.penyapu.putaranBerikutnyaPada ? `. Berikutnya sekitar ${waktuLokalKtp(halaman.penyapu.putaranBerikutnyaPada)}` : ""}.
              </p>
            </div>

            {/* ---- histori ---- */}
            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-medium">Histori penarikan per nomor perkara</p>
              <form
                className="flex flex-wrap items-center gap-2"
                onSubmit={(p) => {
                  p.preventDefault();
                  setTerpilih("");
                  setRincian(null);
                  void cariPerkara(cari.trim());
                }}
              >
                <Input
                  value={cari}
                  onChange={(p) => setCari(p.target.value)}
                  placeholder="Nomor perkara, mis. 556 atau 556/Pdt.G/2026"
                  className="w-full max-w-sm"
                  aria-label="Cari nomor perkara"
                />
                <Button size="sm" type="submit" disabled={mencari}>
                  {mencari ? "Mencari…" : "Cari"}
                </Button>
              </form>
              {pesanDaftar ? <p className="text-xs text-amber-700 dark:text-amber-300">{pesanDaftar}</p> : null}
              {daftar && daftar.length === 0 && !pesanDaftar ? (
                <p className="text-xs text-muted-foreground">Belum ada perkara dengan berkas KTP yang diproses{cari.trim() ? " untuk pencarian ini" : ""}.</p>
              ) : null}
              {daftar && daftar.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[34rem] text-xs">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="py-1 pr-2 font-medium">Nomor perkara</th>
                        <th className="py-1 pr-2 font-medium">Berkas</th>
                        <th className="py-1 pr-2 font-medium">Pihak bertanggal</th>
                        <th className="py-1 pr-2 font-medium">Terakhir dibaca</th>
                        <th className="py-1 font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {daftar.map((p) => (
                        <tr key={p.nomorPerkara} className={`border-b align-top ${terpilih === p.nomorPerkara ? "bg-muted/40" : ""}`}>
                          <td className="py-1.5 pr-2 font-medium">{p.nomorPerkara}</td>
                          <td className="py-1.5 pr-2">
                            {p.terbaca} terbaca
                            {p.gagal > 0 ? <span className="text-amber-700 dark:text-amber-300">, {p.gagal} gagal</span> : null}
                          </td>
                          <td className="py-1.5 pr-2 tabular-nums">{p.pihakBertanggal}</td>
                          <td className="py-1.5 pr-2">{waktuLokalKtp(p.terakhirDibaca)}</td>
                          <td className="py-1.5 text-right">
                            <Button size="sm" variant="outline" onClick={() => void bukaPerkara(p.nomorPerkara)}>
                              Rincian
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {adaLagi ? (
                <Button size="sm" variant="outline" disabled={mencari} onClick={() => void cariPerkara(cari.trim(), daftar?.length ?? 0)}>
                  Tampilkan berikutnya
                </Button>
              ) : null}

              {terpilih ? (
                rincian ? (
                  <RincianPerkara riwayat={rincian} sibuk={membacaUlang} onBacaUlang={() => void bacaUlang()} />
                ) : (
                  <p className="text-xs text-muted-foreground">{pesanRincian || "Memuat rincian…"}</p>
                )
              ) : null}
              {terpilih && rincian && pesanRincian ? <p className="text-xs text-muted-foreground">{pesanRincian}</p> : null}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
/* === AKHIR 12OKT-E === */
