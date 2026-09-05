"use client";

/**
 * Penyandingan SIPP dengan arsip e-Court ALETA.
 *
 * ============================================================================
 * MELENGKAPI DAFTAR ARSIP, BUKAN MENGGANTIKANNYA
 * ============================================================================
 *
 * Daftar arsip di bawah panel ini menjawab "apa yang SUDAH ada". Panel ini
 * menjawab pertanyaan yang tidak dapat dijawab arsip sendirian: "apa yang
 * SEHARUSNYA ada tetapi belum". Jawabannya hanya dapat datang dari SIPP -
 * dialah register perkaranya.
 *
 * ============================================================================
 * DIMULAI LALU DITINGGAL, BUKAN DITUNGGU
 * ============================================================================
 *
 * Sinkronisasi menyapu ribuan perkara dan berjalan berjam-jam. Karena itu
 * tombolnya hanya MEMULAI; kemajuannya dibaca dari ringkasan yang berdetak.
 * Halaman boleh ditutup, PuTTY boleh ditutup - pekerjaannya berjalan di dalam
 * bot, bukan di dalam peramban.
 *
 * Selama ada jalan yang berdetak, layar ini menyegarkan dirinya sendiri. Begitu
 * berhenti, penyegarannya ikut berhenti - halaman yang menembak permintaan
 * setiap beberapa detik tanpa ada yang berubah hanya membebani server.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import { formatDateTime } from "@/lib/format";

type Jalan = {
  id: string;
  dimulaiPada: string;
  selesaiPada: string;
  detakPada: string;
  keadaan: string;
  sumber: string;
  target: number;
  diperiksa: number;
  kurang: number;
  gagal: number;
  pesan: string;
};

type Ringkasan = {
  perkara: { lengkap?: number; kurang?: number; belum_diperiksa?: number };
  totalPerkara: number;
  totalKurang: number;
  sedangBerjalan: Jalan | null;
  riwayat: Jalan[];
};

type PerkaraKurang = {
  nomorPerkara: string;
  jenisPerkara: string;
  tanggalDaftar: string;
  keadaan: string;
  jumlahKurang: number;
  belumTerunduh: number;
  sippTerbaca: boolean;
  alasanTidakTerbaca: string;
  disinkronPada: string;
  rincianKurang: Array<{ jenis: string; jumlah: number; keterangan: string }>;
};

type KunciUrut = "nomorPerkara" | "jenisPerkara" | "jumlahKurang" | "disinkronPada";

/**
 * Kepala kolom yang dapat diklik untuk mengurut.
 *
 * Panah hanya muncul pada kolom yang SEDANG dipakai mengurut. Panah pada
 * setiap kolom membuat yang aktif tidak lagi menonjol, dan itu justru
 * menghilangkan keterangan yang ingin diberikan.
 */
function KepalaUrut({
  kunci,
  label,
  urut,
  setUrut,
  kanan = false,
}: {
  kunci: KunciUrut;
  label: string;
  urut: { kunci: KunciUrut; naik: boolean };
  setUrut: (nilai: { kunci: KunciUrut; naik: boolean }) => void;
  kanan?: boolean;
}) {
  const aktif = urut.kunci === kunci;
  return (
    <th className={`px-3 py-2 font-medium ${kanan ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => setUrut({ kunci, naik: aktif ? !urut.naik : false })}
        className="inline-flex items-center gap-1 uppercase hover:text-foreground"
        title={`Urutkan menurut ${label.toLowerCase()}`}
      >
        {label}
        {aktif ? <span aria-hidden>{urut.naik ? "\u2191" : "\u2193"}</span> : null}
      </button>
    </th>
  );
}

/** Satu perkara yang putusannya belum terbit utuh di e-Court. */
type PutusanBermasalah = {
  nomorPerkara: string;
  adaBaris: boolean;
  dokumenAda: boolean;
  paniteraTte: boolean;
  nomorPutusan: string;
  diunggahOleh: string;
  tanggalUnggahTeks: string;
  paniteraNama: string;
  diperiksaPada: string;
};

/**
 * Apa yang harus dikerjakan pada satu perkara, dan siapa yang mengerjakannya.
 *
 * Tiga kekurangan berjenjang: yang lebih awal menutupi yang sesudahnya.
 * Dokumen yang belum ada tidak boleh dilaporkan sebagai "belum TTE" - yang
 * ditagih akan menjadi orang yang salah.
 */
function tindakanPutusan(baris: PutusanBermasalah) {
  if (!baris.adaBaris) {
    return {
      label: "Menu Putusan E-Court Error",
      nada: "danger" as const,
      kerja: "Baris putusan tidak terbentuk di e-Court. Perlu dibuka di e-Court dan dilaporkan bila tetap tidak muncul.",
    };
  }
  if (!baris.dokumenAda) {
    return {
      label: "Salinan belum diunggah",
      nada: "warning" as const,
      kerja: "Unggah dokumen salinan putusan di menu Putusan e-Court.",
    };
  }
  return {
    label: "Belum TTE oleh Panitera",
    nada: "warning" as const,
    kerja: "Menunggu Panitera menandatangani salinan putusan secara elektronik.",
  };
}

/** Selang penyegaran selama ada sinkronisasi berjalan. */
const SELANG_SEGAR_MS = 5000;

const SEBUTAN_SUMBER: Record<string, string> = {
  portal: "dari portal",
  putty: "dari PuTTY",
};

function Angka({ nilai, label, nada }: { nilai: number | string; label: string; nada?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className={`text-2xl font-semibold tabular-nums ${nada || ""}`}>{nilai}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export function AletaEcourtKendaliSipp({ onBukaPerkara }: { onBukaPerkara?: (nomor: string) => void } = {}) {
  const [ringkasan, setRingkasan] = useState<Ringkasan | null>(null);
  const [kurang, setKurang] = useState<PerkaraKurang[]>([]);
  const [pesan, setPesan] = useState("");
  const [kabar, setKabar] = useState("");
  const [memuat, setMemuat] = useState(true);
  const [memulai, setMemulai] = useState(false);
  // Daftar kerja putusan e-Court. Dideklarasikan bersama state lain di sini,
  // sebelum muat() yang mengisinya.
  const [putusan, setPutusan] = useState<PutusanBermasalah[]>([]);
  const [dibuka, setDibuka] = useState("");

  const [sejak, setSejak] = useState("");
  const [sampai, setSampai] = useState("");
  const [maks, setMaks] = useState("");
  const [hanyaEcourt, setHanyaEcourt] = useState(false);

  // Dipakai penyegar berkala supaya tidak menembak permintaan baru sebelum
  // yang sebelumnya selesai - jaringan lambat akan menumpuknya tanpa ini.
  const sedangMuat = useRef(false);

  const muat = useCallback(async () => {
    if (sedangMuat.current) return;
    sedangMuat.current = true;
    try {
      const [jawabRingkas, jawabKurang, jawabPutusan] = await Promise.all([
        fetch(apiPath("/api/aleta-ecourt/kendali-berkas"), { cache: "no-store" }),
        fetch(apiPath("/api/aleta-ecourt/kendali-berkas?bagian=kurang&batas=200"), { cache: "no-store" }),
        fetch(apiPath("/api/aleta-ecourt/kendali-berkas?bagian=putusan&batas=200"), {
          cache: "no-store",
        }),
      ]);

      const isiRingkas = await jawabRingkas.json();
      if (!jawabRingkas.ok) throw new Error(pesanGalatPortal(isiRingkas, "Ringkasan kendali berkas gagal dimuat."));

      const data = isiRingkas?.data ?? isiRingkas;
      if (data?.available === false) {
        setPesan(String(data.message || "ALETA Bot belum dapat dihubungi."));
        setRingkasan(null);
      } else {
        setPesan("");
        setRingkasan(data?.ringkasan ?? null);
      }

      const isiKurang = await jawabKurang.json();
      if (jawabKurang.ok) {
        const dataKurang = isiKurang?.data ?? isiKurang;
        setKurang(Array.isArray(dataKurang?.perkara) ? dataKurang.perkara : []);
      }

      // Gagal-terbuka: daftar putusan keterangan pelengkap. Pemasangan yang
      // belum pernah menarik e-Court belum punya tabelnya, dan kendali berkas
      // tidak boleh ikut gagal karenanya.
      const isiPutusan = await jawabPutusan.json();
      if (jawabPutusan.ok) {
        const dataPutusan = isiPutusan?.data ?? isiPutusan;
        setPutusan(Array.isArray(dataPutusan?.perkara) ? dataPutusan.perkara : []);
      }
    } catch (galat) {
      setPesan(galat instanceof Error ? galat.message : String(galat));
    } finally {
      sedangMuat.current = false;
      setMemuat(false);
    }
  }, []);

  // Pemuatan pertama dilepas ke antrean tugas, mengikuti pola layar lain:
  // memanggil setState langsung di dalam efek melanggar aturan hook React.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void muat();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [muat]);

  // Menyegarkan sendiri HANYA selama ada yang berjalan.
  const berjalan = Boolean(ringkasan?.sedangBerjalan);
  useEffect(() => {
    if (!berjalan) return;
    const timer = window.setInterval(() => void muat(), SELANG_SEGAR_MS);
    return () => window.clearInterval(timer);
  }, [berjalan, muat]);

  const mulai = useCallback(async () => {
    setMemulai(true);
    setKabar("");
    setPesan("");
    try {
      const jawab = await fetch(apiPath("/api/aleta-ecourt/kendali-berkas"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sejak,
          sampai,
          maks: Number(maks) || 0,
          hanyaEcourt,
        }),
      });
      const isi = await jawab.json();
      if (!jawab.ok) throw new Error(pesanGalatPortal(isi, "Sinkronisasi gagal dimulai."));

      const data = isi?.data ?? isi;
      if (data?.available === false) {
        setPesan(String(data.message || "ALETA Bot belum dapat dihubungi."));
      } else {
        setKabar(String(data?.message || "Sinkronisasi dimulai."));
        await muat();
      }
    } catch (galat) {
      setPesan(galat instanceof Error ? galat.message : String(galat));
    } finally {
      setMemulai(false);
    }
  }, [sejak, sampai, maks, hanyaEcourt, muat]);

  const jalan = ringkasan?.sedangBerjalan ?? null;
  const persen =
    jalan && jalan.target > 0 ? Math.min(100, Math.round((jalan.diperiksa / jalan.target) * 100)) : 0;

  // Urutan bawaan mengikuti kueri: paling banyak kekurangannya di atas. Itu
  // jawaban untuk "mana yang paling gawat", tetapi bukan untuk "apakah perkara
  // 419 ada di daftar" - dan pertanyaan kedua sama seringnya ditanya.
  const [urut, setUrut] = useState<{ kunci: KunciUrut; naik: boolean }>({
    kunci: "jumlahKurang",
    naik: false,
  });

  const kurangTampil = [...kurang].sort((a, b) => {
    const arah = urut.naik ? 1 : -1;
    if (urut.kunci === "jumlahKurang") {
      return (a.jumlahKurang - b.jumlahKurang) * arah;
    }
    return String(a[urut.kunci] || "").localeCompare(String(b[urut.kunci] || "")) * arah;
  });
  // Jumlah SEBENARNYA perkara yang belum lengkap - dari ringkasan, bukan dari
  // panjang daftar yang sudah dipotong. Keduanya kerap berbeda jauh.
  const totalPerluTindak =
    (ringkasan?.perkara.kurang ?? 0) + (ringkasan?.perkara.belum_diperiksa ?? 0);
  const terpotong = totalPerluTindak > kurang.length && kurang.length > 0;
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Penyandingan dengan SIPP</CardTitle>
          <CardDescription>
            Membaca SIPP untuk mengetahui berkas apa yang seharusnya ada pada tiap perkara, lalu
            membandingkannya dengan arsip e-Court di bawah. Tidak membuka satu pun halaman e-Court,
            jadi tidak memerlukan sesi login.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" disabled={memuat} onClick={() => void muat()}>
          Segarkan
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {pesan ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {pesan}
          </p>
        ) : null}
        {kabar ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {kabar}
          </p>
        ) : null}

        {/* --- Angka ringkas --- */}
        {ringkasan ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Angka nilai={ringkasan.totalPerkara} label="Perkara terpantau" />
            <Angka
              nilai={ringkasan.perkara.lengkap ?? 0}
              label="Berkasnya lengkap"
              nada="text-emerald-600"
            />
            <Angka
              nilai={ringkasan.perkara.kurang ?? 0}
              label="Kurang berkas"
              nada={(ringkasan.perkara.kurang ?? 0) > 0 ? "text-rose-600" : undefined}
            />
            <Angka
              nilai={ringkasan.perkara.belum_diperiksa ?? 0}
              label="Belum diperiksa"
              nada={(ringkasan.perkara.belum_diperiksa ?? 0) > 0 ? "text-amber-600" : undefined}
            />
          </div>
        ) : null}

        {/* --- Jalan yang sedang berlangsung --- */}
        {jalan ? (
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-sky-900">
                Sinkronisasi berjalan {SEBUTAN_SUMBER[jalan.sumber] || jalan.sumber}
              </span>
              <span className="text-xs tabular-nums text-sky-800">
                {jalan.diperiksa} / {jalan.target} perkara ({persen}%)
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-sky-200">
              <div className="h-full rounded-full bg-sky-600 transition-all" style={{ width: `${persen}%` }} />
            </div>
            <p className="mt-2 text-xs text-sky-800">
              Detak terakhir {formatDateTime(jalan.detakPada)}. Halaman ini boleh ditutup - pekerjaannya
              berjalan di dalam bot.
            </p>
          </div>
        ) : null}

        {/* --- Memulai sinkronisasi --- */}
        <div className="rounded-lg border bg-muted/20 p-3">
          <h4 className="mb-2 text-sm font-semibold">Jalankan penyandingan</h4>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs">
              <span className="mb-1 block text-muted-foreground">Terdaftar sejak</span>
              <Input
                type="date"
                value={sejak}
                onChange={(e) => setSejak(e.target.value)}
                className="h-9 w-40"
              />
            </label>
            <label className="text-xs">
              <span className="mb-1 block text-muted-foreground">Sampai</span>
              <Input
                type="date"
                value={sampai}
                onChange={(e) => setSampai(e.target.value)}
                className="h-9 w-40"
              />
            </label>
            <label className="text-xs">
              <span className="mb-1 block text-muted-foreground">Batas perkara</span>
              <Input
                type="number"
                min={0}
                placeholder="seluruhnya"
                value={maks}
                onChange={(e) => setMaks(e.target.value)}
                className="h-9 w-32"
              />
            </label>
            <label className="flex h-9 items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={hanyaEcourt}
                onChange={(e) => setHanyaEcourt(e.target.checked)}
              />
              <span>Hanya perkara e-Court</span>
            </label>
            <Button size="sm" disabled={memulai || berjalan} onClick={() => void mulai()}>
              {berjalan ? "Sedang berjalan" : memulai ? "Memulai..." : "Mulai penyandingan"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Hanya Super Admin dan Admin yang boleh memulai. Dapat juga dijalankan dari server dengan{" "}
            <code className="rounded bg-muted px-1">bash aleta-kendali-berkas.sh</code> - prosesnya tetap
            berjalan setelah PuTTY ditutup, dan kemajuannya tetap terlihat di sini.
          </p>
        </div>

        {/* --- Perkara yang kurang --- */}
        <div>
          {/* ==============================================================
              JUMLAH YANG DISEBUT HARUS JUMLAH SEBENARNYA
              ==============================================================

              Daftarnya dipotong seratus baris. Sebelumnya judul ini menyebut
              panjang daftar yang SUDAH terpotong, sehingga tiga ratus perkara
              yang perlu ditindaklanjuti terbaca sebagai seratus - dan pekerjaan
              yang tidak terlihat tidak pernah dikerjakan.

              Yang disebut kini angka dari ringkasan, dan bila daftarnya memang
              terpotong hal itu dikatakan. */}
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-sm font-semibold">
              Perkara yang perlu ditindaklanjuti
              {totalPerluTindak > 0 ? ` (${totalPerluTindak})` : ""}
            </h4>
            {terpotong ? (
              <span className="text-xs text-amber-700 dark:text-amber-400">
                menampilkan {kurang.length} teratas menurut banyaknya kekurangan
              </span>
            ) : null}
          </div>

          {kurang.length === 0 ? (
            <p className="rounded-md border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
              {memuat
                ? "Memuat..."
                : ringkasan && ringkasan.totalPerkara === 0
                  ? "Belum pernah disandingkan. Jalankan penyandingan di atas."
                  : "Tidak ada perkara yang kurang berkas."}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <KepalaUrut kunci="nomorPerkara" label="Nomor perkara" urut={urut} setUrut={setUrut} />
                    <KepalaUrut kunci="jenisPerkara" label="Jenis" urut={urut} setUrut={setUrut} />
                    <KepalaUrut
                      kunci="jumlahKurang"
                      label="Kurang"
                      urut={urut}
                      setUrut={setUrut}
                      kanan
                    />
                    <th className="px-3 py-2 text-left font-medium">Keadaan</th>
                    <KepalaUrut
                      kunci="disinkronPada"
                      label="Disandingkan"
                      urut={urut}
                      setUrut={setUrut}
                      kanan
                    />
                  </tr>
                </thead>
                <tbody>
                  {kurangTampil.map((baris) => (
                    <tr
                      key={baris.nomorPerkara}
                      className="cursor-pointer border-t hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                      // Baris tabel tidak dapat dijangkau papan ketik dengan
                      // sendirinya. Tanpa dua baris di bawah, rincian
                      // kekurangan hanya terbuka bagi yang memakai tetikus.
                      tabIndex={0}
                      role="button"
                      aria-expanded={dibuka === baris.nomorPerkara}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setDibuka(dibuka === baris.nomorPerkara ? "" : baris.nomorPerkara);
                        }
                      }}
                      onClick={() => setDibuka(dibuka === baris.nomorPerkara ? "" : baris.nomorPerkara)}
                    >
                      <td className="px-3 py-2 font-medium">
                        {baris.nomorPerkara}
                        {dibuka === baris.nomorPerkara ? (
                          <ul className="mt-1.5 space-y-0.5 text-xs font-normal text-muted-foreground">
                            {baris.sippTerbaca ? (
                              baris.rincianKurang.map((x) => (
                                <li key={x.jenis}>• {x.keterangan}</li>
                              ))
                            ) : (
                              <li className="text-amber-700">• {baris.alasanTidakTerbaca}</li>
                            )}
                            {onBukaPerkara ? (
                              <li className="pt-1">
                                <button
                                  type="button"
                                  className="text-primary underline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onBukaPerkara(baris.nomorPerkara);
                                  }}
                                >
                                  Buka status perkara →
                                </button>
                              </li>
                            ) : null}
                          </ul>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{baris.jenisPerkara || "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {baris.sippTerbaca ? baris.jumlahKurang : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {!baris.sippTerbaca ? (
                          <Badge variant="warning">SIPP belum terbaca</Badge>
                        ) : baris.belumTerunduh > 0 ? (
                          <Badge variant="danger">berkas belum ditarik</Badge>
                        ) : (
                          <Badge variant="muted">kurang di SIPP</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                        {baris.disinkronPada ? formatDateTime(baris.disinkronPada) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Batasnya disebutkan, bukan disembunyikan. */}
          <p className="mt-2 text-xs text-muted-foreground">
            Perkara yang SIPP-nya belum terbaca sengaja TIDAK dinyatakan lengkap - ia tetap muncul di
            sini supaya tidak hilang dari daftar kerja.
          </p>
        </div>

        {/* ==============================================================
            DAFTAR KERJA PUTUSAN e-COURT
            ==============================================================

            Perkara yang sudah diputus tetapi salinannya belum terbit utuh di
            e-Court. Dipisahkan dari "kurang berkas" karena tindak lanjutnya
            memang berbeda: yang satu menarik berkas, yang lain mengunggah
            dan menandatangani salinan putusan.

            ALETA TIDAK mengunggah maupun menandatangani sendiri. Tanda tangan
            elektronik Panitera adalah perbuatan hukum yang melekat pada orang
            dan sertifikatnya - ia harus dilakukan Panitera sendiri, dengan
            akunnya sendiri, di e-Court. Yang dikerjakan layar ini menjadikan
            pekerjaan itu TERLIHAT dan tidak terlewat. */}
        {putusan.length > 0 ? (
          <div>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="text-sm font-semibold">
                Putusan yang belum terbit di e-Court ({putusan.length})
              </h4>
              <span className="text-xs text-muted-foreground">
                TTE dilakukan Panitera sendiri di e-Court
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Nomor perkara</th>
                    <th className="px-3 py-2 text-left font-medium">Keadaan</th>
                    <th className="px-3 py-2 text-left font-medium">Yang perlu dikerjakan</th>
                    <th className="px-3 py-2 text-left font-medium">Diupload oleh</th>
                  </tr>
                </thead>
                <tbody>
                  {putusan.map((baris) => {
                    const tindakan = tindakanPutusan(baris);
                    return (
                      <tr key={baris.nomorPerkara} className="border-t align-top">
                        <td className="px-3 py-2 font-medium">
                          {onBukaPerkara ? (
                            <button
                              type="button"
                              className="text-primary underline underline-offset-2"
                              onClick={() => onBukaPerkara(baris.nomorPerkara)}
                            >
                              {baris.nomorPerkara}
                            </button>
                          ) : (
                            baris.nomorPerkara
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={tindakan.nada}>{tindakan.label}</Badge>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {tindakan.kerja}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {baris.diunggahOleh || "\u2014"}
                          {baris.tanggalUnggahTeks ? (
                            <div>{baris.tanggalUnggahTeks}</div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              Keadaan ini menurut penarikan e-Court terakhir. Yang sudah dikerjakan sesudahnya
              baru terbaca setelah penarikan berikutnya.
            </p>
          </div>
        ) : null}

        {/* --- Riwayat --- */}
        {ringkasan && ringkasan.riwayat.length > 0 ? (
          <details className="rounded-lg border bg-muted/20 p-3">
            <summary className="cursor-pointer text-sm font-semibold">Riwayat penyandingan</summary>
            <ul className="mt-2 space-y-1 text-xs">
              {ringkasan.riwayat.map((x) => (
                <li key={x.id} className="flex flex-wrap items-baseline justify-between gap-2">
                  <span>
                    {formatDateTime(x.dimulaiPada)} · {SEBUTAN_SUMBER[x.sumber] || x.sumber}
                  </span>
                  <span className="text-muted-foreground">
                    {x.keadaan} · {x.diperiksa}/{x.target} perkara · {x.kurang} kurang
                    {x.gagal > 0 ? ` · ${x.gagal} tidak terbaca` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}
