"use client";

/**
 * Kendali berkas e-Court.
 *
 * ============================================================================
 * SATU BARIS PER PERKARA, RINCIAN DIBUKA SAAT DIPILIH
 * ============================================================================
 *
 * Arsip memuat ribuan dokumen. Menampilkan seluruhnya sekaligus menghasilkan
 * halaman yang tidak dapat dibaca dan tidak menjawab pertanyaan siapa pun.
 *
 * Pertanyaan yang sebenarnya dihadapi petugas adalah "perkara mana yang
 * berkasnya belum lengkap" - dan itu dijawab dengan hitungan per perkara.
 * Daftar dokumennya baru berguna setelah satu perkara dipilih.
 */

import { Fragment, useCallback, useEffect, useState } from "react";

import { AletaEcourtKendaliSipp } from "@/components/portal/aleta-ecourt-kendali-sipp";
import { KepalaUrut, useUrutan, type ArahUrut } from "@/components/portal/tabel-kendali";
import { TombolUnduhZip } from "@/components/portal/tombol-unduh-zip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import { formatDateTime } from "@/lib/format";
import { tanggalHariPendek } from "@/lib/tanggal-indonesia";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";

/**
 * ============================================================================
 * CAP WAKTU SUNGGUHAN: TANGGAL DAN JAM DARI SATU ZONA YANG SAMA
 * ============================================================================
 *
 * "Terakhir dibaca" adalah cap waktu SUNGGUHAN - kolom datetime
 * aleta_bot_ecourt_documents.terakhir_terlihat - jadi jamnya memang harus
 * ditulis. Yang salah bentuk tanggalnya: formatDateTime menulis "7 Okt 2026",
 * sementara seluruh layar e-Court lain sudah memakai "Rab, 07-10-2026". Pada
 * satu portal yang sama panitera karena itu membaca dua bentuk tanggal.
 *
 * Tanggal DAN jamnya diambil dari zona pengadilan (WITA) sekaligus, bukan
 * tanggal dari teks ISO-nya dan jam dari zona mesin. Pasangan yang bercampur
 * zona berbohong tepat di sekitar tengah malam: cap waktu 2026-10-06T17:30:00Z
 * adalah 07-10-2026 pukul 01.30 WITA, dan menempelkan tanggal UTC pada jam WITA
 * akan menulis "Sel, 06-10-2026 01.30" - tanggal dan jam yang tidak pernah
 * berpasangan.
 *
 * waktuPengadilan memakai Intl berzona tetap, jadi jawabannya sama di peladen
 * (Docker, TZ=UTC) dan di peramban (WITA) - tidak ada hydration mismatch.
 *
 * Titik, bukan titik dua: "14.30" adalah bentuk jam Indonesia, dan sama dengan
 * yang sudah ditulis Intl id-ID di layar lain.
 */
export function capWaktuPengadilan(nilai: string | null | undefined, cadangan = "—"): string {
  if (!nilai) return cadangan;
  const saat = new Date(nilai);
  if (Number.isNaN(saat.getTime())) return cadangan;
  const { tanggal, jam } = waktuPengadilan(saat);
  return `${tanggalHariPendek(tanggal, cadangan)} ${jam.slice(0, 5).replace(":", ".")}`;
}

type BarisPerkara = {
  nomorPerkara: string;
  nomorRegister: string;
  dokumen: number;
  adaPdf: number;
  adaWord: number;
  /** adaPdf + adaWord, disusun peladen supaya dapat diurut di sana. */
  berkasAda: number;
  tanpaBerkas: number;
  /** Dokumen yang e-Court sendiri menjawab 404 - tidak dihitung "belum ada". */
  tidakTersedia: number;
  /** Berkas yang benar-benar terbaca di cakram, bukan sekadar tercatat. */
  adaPdfCakram: number;
  adaWordCakram: number;
  /** Tercatat pernah diunduh tetapi lenyap dari cakram - perlu ditarik ulang. */
  berkasHilang: number;
  menungguMajelis: number;
  sudahValid: number;
  berkasPendaftaran: number;
  dihapusRetensi: number;
  terakhirTerlihat: string | null;
};

/**
 * ============================================================================
 * KOLOM YANG PERTANYAANNYA SELALU "YANG PALING BANYAK"
 * ============================================================================
 *
 * "Belum ada" ditekan orang untuk satu pertanyaan saja: mana yang paling banyak
 * belum ada. Memulainya menaik menjawab pertanyaan yang tidak pernah ditanya -
 * perkara yang nol - dan menuntut tekanan kedua setiap kali.
 *
 * Daftarnya disimpan DI SINI, bukan di useUrutan, supaya tabel lain yang
 * memakai mesin urut yang sama (Antrian Sidang, Jadwal Mediasi) tidak berubah
 * satu langkah pun.
 */
const URUT_MULAI_TURUN = new Set(["dokumen", "berkasAda", "belumAda", "keadaan", "terakhir"]);

type BarisDokumen = {
  documentKey: string;
  judulDokumen: string;
  jenisDokumen: string;
  peranPengunggah: string;
  statusVerifikasi: string;
  tanggalSidang: string | null;
  agenda: string;
  adaPdf: boolean;
  adaWord: boolean;
  /**
   * Berkas yang TERCATAT pernah diunduh tetapi tidak ada lagi di disk.
   *
   * Bedanya dengan "belum tersimpan" menentukan tindakan: yang belum pernah
   * diunduh menunggu penarikan biasa, sedangkan yang hilang menuntut unduh
   * ulang. Tanpa pembedaan ini keduanya tampak sama dan tidak ada yang tahu
   * arsipnya perlu diisi ulang.
   */
  berkasHilang?: number;
  /** Berkasnya sengaja dihapus karena masa simpan - JANGAN ditarik ulang. */
  dihapusRetensi?: boolean;
  /**
   * Kapan e-Court menjawab 404 untuk dokumen ini; null berarti tidak pernah.
   *
   * Dibedakan dari "belum tersimpan" karena tindakannya berlawanan: yang ini
   * TIDAK perlu ditarik lagi - menariknya pasti gagal, dan mengulanginya tiap
   * putaran membuat perkaranya terhitung kurang selamanya.
   */
  tidakTersediaPada?: string | null;
  tidakTersediaSebab?: string;
  ukuranByte: number;
  diberitahukanPada: string | null;
};

const STATUS_TERBACA: Record<string, { teks: string; nada: "default" | "muted" | "warning" | "danger" }> = {
  belum: { teks: "Menunggu majelis", nada: "warning" },
  valid: { teks: "Sudah diverifikasi", nada: "default" },
  tidak_valid: { teks: "Tidak valid", nada: "danger" },
  // Berkas pendaftaran tidak mengenal verifikasi di e-Court sama sekali.
  tidak_perlu: { teks: "Berkas pendaftaran", nada: "muted" },
};

function ukuranTerbaca(byte: number): string {
  if (!byte) return "—";
  if (byte < 1024 * 1024) return `${Math.round(byte / 1024)} KB`;
  return `${(byte / (1024 * 1024)).toFixed(1)} MB`;
}

export function AletaEcourtArsipBerkas({
  onBukaPerkara,
}: { onBukaPerkara?: (nomor: string) => void } = {}) {
  const [perkara, setPerkara] = useState<BarisPerkara[]>([]);
  const [total, setTotal] = useState(0);
  const [pesan, setPesan] = useState("");
  const [memuat, setMemuat] = useState(true);

  const [cari, setCari] = useState("");
  const [kataCari, setKataCari] = useState("");
  const [belumLengkap, setBelumLengkap] = useState(false);

  /**
   * ========================================================================
   * YANG MENGURUT PELADEN, BUKAN PERAMBAN
   * ========================================================================
   *
   * Kepala kolom di sini hanya MENYIMPAN pilihan; tiap penekanan memuat ulang
   * dari bot. Sebabnya daftarnya dipotong - peladen menjawab paling banyak 500
   * baris - sedangkan arsipnya tumbuh tiap penarikan. Terukur di SIPP setempat
   * 24 Sep 2026: 10.120 perkara dalam 12 tahun, dan 799 perkara terdaftar
   * sepanjang 2026 saja. Mengurut di peramban berarti mengurut potongannya:
   * "belum ada terbanyak" akan menunjuk yang terbanyak DI ANTARA YANG TERBAWA,
   * bukan yang terbanyak di arsip - dan tidak ada yang tahu.
   *
   * Karena itu urutkan() dari tabel-kendali TIDAK dipakai di layar ini, dan itu
   * disengaja. Yang dipakai hanya penyimpan pilihannya.
   *
   * Bawaannya sama dengan sebelum kepala kolom ini ada: terakhir dibaca,
   * terbaru lebih dulu.
   */
  const { urutan: urutTabel, setUrutan: setUrutTabel } = useUrutan({
    kunci: "terakhir",
    arah: "turun",
  });

  /**
   * Menekan kepala kolom: arah pertamanya, arah lawannya, lalu kembali ke
   * bawaan.
   *
   * Ditulis di sini alih-alih memakai `tekan` bawaan useUrutan karena arah
   * PERTAMANYA berbeda per kolom - lihat URUT_MULAI_TURUN. Mengubah useUrutan
   * akan mengubah perilaku dua tabel lain yang memakainya.
   *
   * Tekanan ketiga penting: tanpa jalan kembali, satu klik yang tidak disengaja
   * mengunci tabelnya pada urutan itu. Di sini "kembali" berarti kembali ke
   * bawaan, bukan menjadi null - peladen tetap harus diberi satu urutan, dan
   * mengirim kosong berarti membiarkannya memilih diam-diam.
   */
  const tekanUrut = useCallback(
    (kunci: string) => {
      const awal: ArahUrut = URUT_MULAI_TURUN.has(kunci) ? "turun" : "naik";
      setUrutTabel((sekarang) => {
        if (!sekarang || sekarang.kunci !== kunci) return { kunci, arah: awal };
        if (sekarang.arah === awal) {
          return { kunci, arah: awal === "naik" ? "turun" : "naik" };
        }
        return { kunci: "terakhir", arah: "turun" };
      });
    },
    [setUrutTabel]
  );

  const [dibuka, setDibuka] = useState("");
  const [rincian, setRincian] = useState<BarisDokumen[]>([]);
  const [memuatRincian, setMemuatRincian] = useState(false);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const params = new URLSearchParams({
        cari: kataCari,
        belumLengkap: belumLengkap ? "1" : "0",
        urutkan: urutTabel?.kunci ?? "terakhir",
        arah: urutTabel?.arah ?? "turun",
        // Batas keras peladen memang 500. Meminta 100 seperti sebelumnya
        // membuat 222 perkara diwakili 100 baris tanpa satu kata pun, dan
        // pencarian "419" pada daftar yang sudah dipotong menjawab kosong untuk
        // perkara yang sebenarnya ada.
        batas: "500",
      });
      const respons = await fetch(apiPath(`/api/aleta-ecourt/arsip/perkara?${params.toString()}`), {
        cache: "no-store",
      });
      const hasil = await respons.json();
      const isi = hasil?.data ?? hasil;

      if (!isi?.available) {
        setPesan(isi?.message || "ALETA Bot belum dapat dihubungi.");
        setPerkara([]);
        setTotal(0);
      } else {
        setPesan("");
        setPerkara(isi.perkara ?? []);
        setTotal(isi.total ?? 0);
      }
    } catch (error) {
      setPesan(error instanceof Error ? error.message : "Gagal membaca arsip.");
      setPerkara([]);
    } finally {
      setMemuat(false);
    }
  }, [kataCari, belumLengkap, urutTabel]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void muat();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [muat]);

  const bukaRincian = useCallback(
    async (nomorPerkara: string) => {
      // Menekan baris yang sama menutupnya kembali.
      if (dibuka === nomorPerkara) {
        setDibuka("");
        setRincian([]);
        return;
      }

      setDibuka(nomorPerkara);
      setRincian([]);
      setMemuatRincian(true);
      try {
        const params = new URLSearchParams({ nomor: nomorPerkara });
        const respons = await fetch(apiPath(`/api/aleta-ecourt/arsip/perkara?${params.toString()}`), {
          cache: "no-store",
        });
        const hasil = await respons.json();
        const isi = hasil?.data ?? hasil;
        setRincian(isi?.available ? (isi.dokumen ?? []) : []);
      } catch {
        setRincian([]);
      } finally {
        setMemuatRincian(false);
      }
    },
    [dibuka]
  );

  return (
    // Dua pertanyaan berbeda, dua panel berurutan: apa yang SEHARUSNYA ada
    // menurut SIPP di atas, apa yang SUDAH ada di arsip di bawah.
    <div className="space-y-4">
      <AletaEcourtKendaliSipp onBukaPerkara={onBukaPerkara} />

      <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Kendali Berkas e-Court</CardTitle>
          <CardDescription>
            Perkara mana yang berkasnya sudah lengkap, dan mana yang belum. Tekan satu baris untuk
            melihat dokumennya.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" disabled={memuat} onClick={() => void muat()}>
          {memuat ? "Memuat…" : "Perbarui Data"}
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {pesan ? <p className="rounded border border-border bg-muted/40 p-3 text-sm">{pesan}</p> : null}

        <div className="flex flex-wrap items-center gap-3">
          <Input
            className="max-w-xs"
            placeholder="Cari nomor perkara atau register…"
            value={cari}
            onChange={(event) => setCari(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") setKataCari(cari.trim());
            }}
          />
          <Button variant="outline" size="sm" onClick={() => setKataCari(cari.trim())}>
            Cari
          </Button>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={belumLengkap}
              onChange={(event) => setBelumLengkap(event.target.checked)}
            />
            Hanya yang berkasnya belum lengkap
          </label>

          {/* Daftar "Urutkan" ditiadakan 25 Sep 2026, bukan disandingkan
              dengan kepala kolom. Tiap pilihannya sudah punya kolomnya sendiri
              di tabel, jadi tidak ada satu pun yang hilang - dan dua mekanisme
              untuk satu hal adalah persis yang diperingatkan tabel-kendali.tsx
              sendiri: penekan kepala kolom "Belum ada" akan melihat daftar itu
              tetap bertuliskan "Terakhir dibaca (terbaru)", dan tidak ada yang
              tahu mana yang sedang berlaku. */}
          <span className="ml-auto text-sm text-muted-foreground">
            {total} perkara{kataCari ? ` cocok "${kataCari}"` : ""}
            {/* Daftarnya dipotong di peladen. Menyebut 222 sambil menggambar
                100 baris - seperti sebelumnya - membuat 122 perkara tidak
                pernah terlihat, dan yang tidak terlihat tidak dikerjakan.
                Panel SIPP di atas sudah mengatakannya sejak lama. */}
            {total > perkara.length ? (
              <span className="ml-2 text-amber-700 dark:text-amber-400">
                menampilkan {perkara.length} teratas menurut urutan ini
              </span>
            ) : null}
          </span>
        </div>

        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                {/* Kunci di sini HARUS ada di KOLOM_URUT_ARSIP milik bot. Kunci
                    yang tidak dikenal dijatuhkan peladen ke "terakhir" diam-diam,
                    dan anak panah di kepala kolom tetap menunjuk kolom yang
                    sebenarnya tidak mengurut apa pun. Dijaga
                    src/test/arsip-berkas-urut.test.ts. */}
                <KepalaUrut
                  kunci="perkara"
                  urutan={urutTabel}
                  onTekan={tekanUrut}
                  judul="Urutkan menurut TAHUN lalu nomor urut - sebagai angka, bukan menurut hurufnya"
                >
                  Nomor Perkara
                </KepalaUrut>
                <KepalaUrut kunci="register" urutan={urutTabel} onTekan={tekanUrut}>
                  Register e-Court
                </KepalaUrut>
                <KepalaUrut kunci="dokumen" urutan={urutTabel} onTekan={tekanUrut} rata="kanan">
                  Dokumen
                </KepalaUrut>
                <KepalaUrut
                  kunci="berkasAda"
                  urutan={urutTabel}
                  onTekan={tekanUrut}
                  rata="kanan"
                  judul="Berkas PDF dan Word yang sudah tersimpan. Tekanan pertama menaruh yang terbanyak di atas."
                >
                  Berkas ada
                </KepalaUrut>
                <KepalaUrut
                  kunci="belumAda"
                  urutan={urutTabel}
                  onTekan={tekanUrut}
                  rata="kanan"
                  judul="Dokumen yang berkasnya belum tersimpan. Tekanan pertama menaruh yang paling banyak belum ada di atas - itulah yang perlu ditarik lebih dulu."
                >
                  Belum ada
                </KepalaUrut>
                <KepalaUrut
                  kunci="keadaan"
                  urutan={urutTabel}
                  onTekan={tekanUrut}
                  judul="Urutkan menurut banyaknya dokumen yang masih menunggu verifikasi majelis"
                >
                  Keadaan
                </KepalaUrut>
                <KepalaUrut kunci="terakhir" urutan={urutTabel} onTekan={tekanUrut}>
                  Terakhir dibaca
                </KepalaUrut>
                {/* Tindakan tidak punya nilai yang masuk akal diurutkan. */}
                <th className="px-3 py-2 font-medium">Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {perkara.length === 0 && !memuat ? (
                <tr>
                  <td className="px-3 py-6 text-center text-muted-foreground" colSpan={8}>
                    {kataCari || belumLengkap
                      ? "Tidak ada perkara yang cocok dengan penyaringan ini."
                      : "Arsip masih kosong. Jalankan penarikan e-Court lebih dulu."}
                  </td>
                </tr>
              ) : null}

              {perkara.map((baris) => (
                // Kunci ada di Fragment, bukan di baris di dalamnya. React
                // membaca kunci pada elemen terluar yang dihasilkan map, dan
                // meletakkannya di dalam membuat React kehilangan jejak baris
                // saat daftar disaring atau diurutkan ulang.
                <Fragment key={baris.nomorPerkara}>
                  <tr
                    className="cursor-pointer border-t border-border hover:bg-muted/40"
                    onClick={() => void bukaRincian(baris.nomorPerkara)}
                  >
                    <td className="px-3 py-2 font-medium">{baris.nomorPerkara}</td>
                    <td className="px-3 py-2 font-mono text-xs">{baris.nomorRegister || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{baris.dokumen}</td>
                    {/* Dihitung peladen, bukan dijumlahkan di sini: yang
                        digambar harus nilai yang SAMA dengan yang diurut. */}
                    <td className="px-3 py-2 text-right tabular-nums">{baris.berkasAda}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {baris.tanpaBerkas > 0 ? (
                        <span className="font-semibold text-amber-700 dark:text-amber-300">
                          {baris.tanpaBerkas}
                        </span>
                      ) : (
                        "0"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {baris.tanpaBerkas === 0 ? <Badge variant="default">Lengkap</Badge> : null}
                        {baris.menungguMajelis > 0 ? (
                          <Badge variant="warning">{baris.menungguMajelis} menunggu majelis</Badge>
                        ) : null}
                        {baris.berkasPendaftaran > 0 ? (
                          <Badge variant="muted">{baris.berkasPendaftaran} pendaftaran</Badge>
                        ) : null}
                        {/* Dipisahkan dari "belum ada": berkas ini sengaja
                            dihapus karena masa simpan, dan TIDAK perlu ditarik
                            ulang. Menyamakannya membuat petugas menariknya lagi
                            dari e-Court tanpa sebab. */}
                        {baris.dihapusRetensi > 0 ? (
                          <Badge
                            variant="muted"
                            title="Berkas dihapus karena melewati masa simpan arsip. Catatannya tetap tersimpan."
                          >
                            {baris.dihapusRetensi} dihapus (masa simpan)
                          </Badge>
                        ) : null}
                        {/* Dipisahkan dari "belum ada": e-Court sendiri tidak
                            menyediakan berkasnya, jadi menariknya tidak mungkin
                            berhasil dan perkaranya tidak boleh terhitung kurang
                            selamanya karena itu. */}
                        {baris.tidakTersedia > 0 ? (
                          <Badge
                            variant="muted"
                            title="e-Court menjawab 404 untuk berkas ini. Ditanyakan lagi sesudah 30 hari."
                          >
                            {baris.tidakTersedia} tidak disediakan e-Court
                          </Badge>
                        ) : null}
                        {/* Tercatat pernah diunduh tetapi lenyap dari cakram.
                            Tindakannya berbeda dari "belum ada": yang ini
                            menuntut unduh ulang, dan pernah terjadi seluruh
                            arsip lenyap karena volume Docker belum di-mount. */}
                        {baris.berkasHilang > 0 ? (
                          <Badge
                            variant="danger"
                            title="Berkasnya tercatat pernah diunduh tetapi tidak ada lagi di cakram. Jalankan penarikan ulang untuk mengisinya kembali."
                          >
                            {baris.berkasHilang} berkas hilang
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                    {/* Cap waktu sungguhan - jamnya tetap ditulis. Yang berubah
                        bentuk tanggalnya, kini sama dengan layar e-Court lain.
                        Lihat capWaktuPengadilan di atas. */}
                    <td className="px-3 py-2 text-muted-foreground">
                      {capWaktuPengadilan(baris.terakhirTerlihat)}
                    </td>
                    {/* Tombol hanya muncul bila memang ada berkas yang belum
                        tersimpan. Menawarkan penarikan untuk perkara yang sudah
                        lengkap hanya mengundang permintaan yang pasti dilewati
                        jembatan - dan membuat tombolnya terasa tidak berguna. */}
                    <td className="px-3 py-2" onClick={(peristiwa) => peristiwa.stopPropagation()}>
                      <div className="flex flex-col gap-1">
                        {/* Yang tercatat kurang, ATAU yang tercatat ada tetapi
                            lenyap dari cakram. Keduanya sama-sama menuntut
                            penarikan; sebelumnya hanya yang pertama menyalakan
                            tombolnya, dan arsip yang lenyap tidak pernah dapat
                            diisi ulang dari layar ini. */}
                        {baris.tanpaBerkas > 0 || baris.berkasHilang > 0 ? (
                          <TombolTarikPerkara
                            nomorPerkara={baris.nomorPerkara}
                            onSelesai={() => void muat()}
                          />
                        ) : null}

                        {/* Dari cakram, bukan dari catatan. ZIP yang disusun
                            dari baris yang berkasnya sudah lenyap menghasilkan
                            arsip kosong - dan orang yang mengunduhnya baru tahu
                            sesudah membukanya. */}
                        {baris.adaPdfCakram + baris.adaWordCakram > 0 ? (
                          <TombolUnduhZip nomorPerkara={baris.nomorPerkara} />
                        ) : null}
                      </div>
                    </td>
                  </tr>

                  {dibuka === baris.nomorPerkara ? (
                    <tr className="border-t border-border bg-muted/20">
                      <td className="px-3 py-3" colSpan={8}>
                        {memuatRincian ? (
                          <p className="text-sm text-muted-foreground">Memuat dokumen…</p>
                        ) : rincian.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Tidak ada dokumen tercatat untuk perkara ini.
                          </p>
                        ) : (
                          <DaftarDokumen dokumen={rincian} />
                        )}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <p className="rounded bg-muted/50 p-2.5 text-xs text-muted-foreground">
          &quot;Belum ada&quot; berarti dokumennya tercatat di ALETA tetapi berkas PDF/Word-nya belum
          tersimpan di server. Jalankan penarikan lagi untuk melengkapinya &mdash; perkara yang sudah
          lengkap tidak akan diminta ulang ke e-Court. Dokumen yang e-Court sendiri jawab 404 tidak
          ikut dihitung di sini dan ditandai tersendiri: menariknya tidak mungkin berhasil.
        </p>
        {/* Bedanya ditulis, bukan didiamkan. Kolom hitungan di atas membaca
            CATATAN berkas; lencana "berkas hilang" dan tombol ZIP membaca
            CAKRAM. Keduanya biasanya sama, dan berselisih justru pada keadaan
            yang paling perlu diketahui - arsip yang lenyap sementara barisnya
            tetap ada, seperti yang pernah terjadi saat volume Docker belum
            di-mount. */}
        <p className="rounded bg-muted/50 p-2.5 text-xs text-muted-foreground">
          Kolom &quot;Berkas ada&quot; dan &quot;Belum ada&quot; dihitung dari catatan berkas, sedangkan
          lencana &quot;berkas hilang&quot; dan tombol ZIP dibuktikan ke cakram peladen. Bila keduanya
          berselisih, yang benar adalah lencananya &mdash; catatan dapat tertinggal ketika berkasnya
          lenyap dari cakram.
        </p>
      </CardContent>
      </Card>
    </div>
  );
}

/** Tabel dokumen satu perkara, muncul saat barisnya dibuka. */
/**
 * Menarik berkas satu perkara sekarang juga.
 *
 * ==========================================================================
 * MENJAWAB SEKETIKA, BUKAN MENUNGGU SELESAI
 * ==========================================================================
 *
 * Penarikan satu perkara tetap memerlukan waktu - membuka peramban, masuk ke
 * e-Court, mengunduh tiap berkas. Menahan tombolnya sampai selesai membuat
 * halaman tampak menggantung, dan proksi akan memutus permintaannya lebih
 * dulu. Karena itu tombolnya melaporkan bahwa penarikan DIMULAI, dan
 * kemajuannya diikuti di panel Penarikan berkas e-Court.
 */
function TombolTarikPerkara({
  nomorPerkara,
  onSelesai,
}: {
  nomorPerkara: string;
  onSelesai: () => void;
}) {
  const [sibuk, setSibuk] = useState(false);
  const [catatan, setCatatan] = useState("");

  const tarik = async () => {
    setSibuk(true);
    setCatatan("");
    try {
      const jawaban = await fetch(apiPath("/api/aleta-ecourt/penarikan"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tindakan: "perkara", nomorPerkara }),
      });
      const isi = await jawaban.json();

      if (!jawaban.ok) {
        setCatatan(pesanGalatPortal(isi, `HTTP ${jawaban.status}`));
        return;
      }

      const data = isi?.data ?? isi;
      if (!data?.ok) {
        const sebab: Record<string, string> = {
          penarikan_sedang_berjalan: "Penarikan lain sedang berjalan.",
          penarikan_lain_masih_berjalan: "Ada penarikan lain di luar portal.",
          nomor_perkara_kosong: "Nomor perkara kosong.",
        };
        setCatatan(sebab[String(data?.alasan)] || String(data?.message || data?.alasan || "Tidak berhasil."));
        return;
      }

      setCatatan("Penarikan dimulai.");
      onSelesai();
    } catch (kesalahan) {
      setCatatan(kesalahan instanceof Error ? kesalahan.message : "Gagal menghubungi server.");
    } finally {
      setSibuk(false);
    }
  };

  return (
    <div className="space-y-1">
      <Button size="sm" variant="outline" disabled={sibuk} onClick={() => void tarik()}>
        {sibuk ? "Memulai…" : "Tarik berkas"}
      </Button>
      {catatan ? (
        <p className="max-w-[14rem] text-xs text-muted-foreground">{catatan}</p>
      ) : null}
    </div>
  );
}

// Diekspor supaya penjaganya dapat MENGGAMBARNYA dengan baris buatan, bukan
// menyisir teks berkas ini. Tanpa itu, kembalinya formatDateTime ke kolom
// tanggal sidang tidak akan memerahkan satu pun uji.
export function DaftarDokumen({ dokumen }: { dokumen: BarisDokumen[] }) {
  return (
    <div className="overflow-x-auto rounded border border-border bg-background">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-muted/40 text-left">
          <tr>
            <th className="px-3 py-2 font-medium">Judul Dokumen</th>
            <th className="px-3 py-2 font-medium">Jenis</th>
            <th className="px-3 py-2 font-medium">Diunggah oleh</th>
            <th className="px-3 py-2 font-medium">Sidang</th>
            <th className="px-3 py-2 font-medium">Keadaan</th>
            <th className="px-3 py-2 text-right font-medium">Ukuran</th>
            <th className="px-3 py-2 font-medium">Berkas</th>
          </tr>
        </thead>
        <tbody>
          {dokumen.map((d) => {
            const status = STATUS_TERBACA[d.statusVerifikasi] ?? {
              teks: d.statusVerifikasi,
              nada: "muted" as const,
            };
            return (
              <tr key={d.documentKey} className="border-t border-border">
                <td className="px-3 py-2">
                  <div className="font-medium">{d.judulDokumen || "(tanpa judul)"}</div>
                  {d.agenda ? <div className="text-xs text-muted-foreground">{d.agenda}</div> : null}
                </td>
                <td className="px-3 py-2">{d.jenisDokumen || "—"}</td>
                <td className="px-3 py-2">{d.peranPengunggah || "—"}</td>
                {/* TANGGAL MURNI - JAMNYA KARANGAN BENTUK PENYIMPANAN
                    ====================================================
                    tanggal_sidang memang kolom datetime, tetapi jamnya SELALU
                    00:00:00: ecourtStoreService menyimpannya lewat
                    botDbService.toMysqlDate, yang memakai
                    toISOString().slice(0,19) atas tanggal tanpa jam dari
                    e-Court. Jam 00.00 yang dicetak formatDateTime karena itu
                    bukan data SIPP.

                    Lebih buruk: diukur dengan node atas "2026-10-07",
                    formatDateTime menjawab "7 Okt 2026, 00.00" di UTC,
                    "7 Okt 2026, 08.00" di Asia/Makassar, dan "6 Okt 2026,
                    20.00" di America/New_York - tanggalnya pun MUNDUR. Karena
                    peladen melukis dalam UTC dan peramban dalam WITA, kedua
                    lukisan berbeda teksnya dan React membuang lukisan peladen.

                    tanggalHariPendek membaca angka dari teksnya tanpa
                    menyentuh zona sama sekali, jadi tidak ada jam yang
                    dikarang dan tidak ada tanggal yang bergeser. */}
                <td className="px-3 py-2 text-muted-foreground">
                  {tanggalHariPendek(d.tanggalSidang, "—")}
                </td>
                <td className="px-3 py-2">
                  <Badge variant={status.nada}>{status.teks}</Badge>
                  {d.diberitahukanPada ? (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Pihak diberi tahu {formatDateTime(d.diberitahukanPada)}
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {ukuranTerbaca(d.ukuranByte)}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {d.adaPdf ? <TombolUnduh documentKey={d.documentKey} format="pdf" label="PDF" /> : null}
                    {d.adaWord ? (
                      <TombolUnduh documentKey={d.documentKey} format="word" label="Word" />
                    ) : null}
                    {!d.adaPdf && !d.adaWord ? (
                      (d.berkasHilang ?? 0) > 0 ? (
                        <span
                          className="text-xs text-amber-700 dark:text-amber-500"
                          title="Berkasnya tercatat pernah diunduh tetapi tidak ada lagi di disk. Jalankan penarikan ulang untuk mengisinya kembali."
                        >
                          berkas hilang - perlu unduh ulang
                        </span>
                      ) : d.dihapusRetensi ? (
                        <span
                          className="text-xs text-muted-foreground"
                          title="Berkas dihapus karena melewati masa simpan arsip. TIDAK boleh ditarik ulang."
                        >
                          dihapus (masa simpan)
                        </span>
                      ) : d.tidakTersediaPada ? (
                        /* Bukan "belum tersimpan": e-Court MENJAWAB, dan
                           jawabannya berkas ini tidak disediakan. Menyamakan
                           keduanya membuat petugas menunggu penarikan yang
                           tidak akan pernah menghasilkan apa pun. */
                        <span
                          className="text-xs text-muted-foreground"
                          title={`e-Court menjawab 404 pada ${formatDateTime(d.tidakTersediaPada)}${
                            d.tidakTersediaSebab ? ` (${d.tidakTersediaSebab})` : ""
                          }. Ditanyakan lagi sesudah 30 hari.`}
                        >
                          tidak disediakan e-Court
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">belum tersimpan</span>
                      )
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Tombol unduh satu berkas.
 *
 * ============================================================================
 * KENAPA TIDAK MEMAKAI TAUTAN UNDUH BIASA
 * ============================================================================
 *
 * Tautan <a download> menyimpan APA PUN yang dijawab server sebagai berkas -
 * termasuk jawaban galat berbentuk JSON. Yang terjadi di server: unduhan gagal,
 * dan yang tersimpan di folder Downloads petugas adalah "berkas.json" berisi
 * alasannya - yang tidak akan pernah dibuka siapa pun.
 *
 * Akibatnya sebab kegagalan tersembunyi sama sekali: petugas hanya melihat
 * berkas asing muncul, tanpa satu pun keterangan mengapa berkasnya tidak ada.
 *
 * Karena itu jawabannya diperiksa lebih dulu. Berkas sungguhan disimpan lewat
 * blob; jawaban galat ditampilkan sebagai kalimat.
 */
function TombolUnduh({
  documentKey,
  format,
  label,
}: {
  documentKey: string;
  format: "pdf" | "word";
  label: string;
}) {
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");

  const unduh = useCallback(async () => {
    setSibuk(true);
    setGalat("");
    try {
      const params = new URLSearchParams({ documentKey, format });
      const respons = await fetch(apiPath(`/api/aleta-ecourt/berkas?${params.toString()}`), {
        cache: "no-store",
      });

      const tipe = respons.headers.get("content-type") || "";
      if (!respons.ok || tipe.includes("application/json")) {
        const isi = await respons.json().catch(() => null);
        setGalat(
          pesanGalatPortal(isi, `HTTP ${respons.status}`).replace(/_/g, " ")
        );
        return;
      }

      const blob = await respons.blob();
      const alamat = URL.createObjectURL(blob);
      const tautan = document.createElement("a");
      tautan.href = alamat;

      // Nama berkas diambil dari jawaban server bila ada; kalau tidak, disusun
      // dari kunci dokumen supaya tetap dapat dibedakan di folder Downloads.
      const disposisi = respons.headers.get("content-disposition") || "";
      const cocok = disposisi.match(/filename\*?=(?:UTF-8''|")?([^";]+)/i);
      tautan.download = cocok
        ? decodeURIComponent(cocok[1])
        : `${documentKey}.${format === "word" ? "docx" : "pdf"}`;

      document.body.appendChild(tautan);
      tautan.click();
      tautan.remove();

      // Alamat obyek TIDAK dilepas seketika. Peramban masih membaca blobnya
      // setelah klik selesai diproses, dan melepasnya di baris yang sama
      // membatalkan sebagian unduhan tanpa pesan apa pun.
      window.setTimeout(() => URL.revokeObjectURL(alamat), 60000);
    } catch (error) {
      setGalat(error instanceof Error ? error.message : "Gagal mengunduh.");
    } finally {
      setSibuk(false);
    }
  }, [documentKey, format]);

  return (
    <span className="inline-flex flex-col gap-1">
      <Button variant="outline" size="sm" disabled={sibuk} onClick={() => void unduh()}>
        {sibuk ? "…" : label}
      </Button>
      {galat ? <span className="text-xs text-rose-600 dark:text-rose-400">{galat}</span> : null}
    </span>
  );
}
