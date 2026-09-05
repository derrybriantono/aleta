"use client";

import { useCallback, useState } from "react";
import { Download, Eye, FileText, Loader2, Search, TriangleAlert } from "lucide-react";

import { KehadiranSidang } from "@/components/portal/bas-kehadiran-sidang";
import { LembarIsian } from "@/components/portal/bas-lembar-isian";
import { PilihBlangko } from "@/components/portal/bas-pilih-blangko";
import { PageIntro, EmptyState } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";

/**
 * Alat Bantu Tulis BAS - layar panitera.
 *
 * ============================================================================
 * SUSUNANNYA MENGIKUTI RUANG SIDANG, BUKAN BASIS DATA
 * ============================================================================
 *
 * Urutan di layar sama dengan urutan panitera bekerja: buka perkaranya, lihat
 * berkasnya, pilih pemeriksaan apa yang berlangsung hari ini, lalu menulis.
 * Tidak ada satu pun nama variabel atau nama kolom yang muncul - mesinnya boleh
 * serumit apa pun di belakang, tetapi tidak boleh bocor ke depan.
 *
 * ============================================================================
 * YANG BELUM TERISI DIPERLIHATKAN, BUKAN DISEMBUNYIKAN
 * ============================================================================
 *
 * Penanda yang tidak dapat dipastikan dari berkas tetap tampil apa adanya, dan
 * dihitung di kepala lembar. Penanda yang hilang diam-diam menghasilkan BAS
 * bernama kosong yang baru ketahuan setelah ditandatangani.
 */

type Bagian = { ada: boolean; asal: { sistem: string; sumber: string }; galat: string; nilai: unknown };

type Selisih = { hal: string; menurut: Array<{ sistem: string; nilai: string }>; keterangan: string };

type Berkas = {
  ok: boolean;
  nomorPerkara: string;
  perkaraId: string;
  identitas: Bagian;
  paraPihak: Bagian;
  majelis: Bagian;
  panitera: Bagian;
  riwayatSidang: Bagian;
  saksiTercatat: Bagian;
  pemeriksaanSaksi: Bagian;
  putusan: Bagian;
  pertimbangan: Bagian;
  selisih: Selisih[];
  halangan: string[];
};

type Kumpulan = { kode: string; nama: string; jumlahPertanyaan: number };

type Pilihan = { perkaraId: string; nomorPerkara: string; jenisPerkara: string; tanggalDaftar: string };

/** Cerai gugat. Jenis lain menyusul setelah yang pertama terbukti dipakai. */
const JENIS_CERAI_GUGAT = "347";

function BarisBerkas({ nama, bagian }: { nama: string; bagian: Bagian }) {
  const jumlah = Array.isArray(bagian.nilai) ? bagian.nilai.length : null;
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 py-2 last:border-0">
      <div className="flex items-baseline gap-2">
        <span className={bagian.ada ? "text-sm font-medium" : "text-sm text-muted-foreground"}>{nama}</span>
        {jumlah !== null && bagian.ada ? <span className="text-xs text-muted-foreground">{jumlah}</span> : null}
      </div>
      <span className="text-right text-xs text-muted-foreground">
        {bagian.galat ? (
          <span className="text-amber-600 dark:text-amber-400">{bagian.asal.sistem} tidak terbaca</span>
        ) : bagian.ada ? (
          `${bagian.asal.sistem} · ${bagian.asal.sumber}`
        ) : (
          "belum ada"
        )}
      </span>
    </div>
  );
}

export function BasPanitera() {
  const [nomor, setNomor] = useState("");
  const [memuat, setMemuat] = useState(false);
  const [pesan, setPesan] = useState("");
  const [berkas, setBerkas] = useState<Berkas | null>(null);
  const [kumpulan, setKumpulan] = useState<Kumpulan[]>([]);
  const [kodeTerpilih, setKodeTerpilih] = useState("");
  const [pilihan, setPilihan] = useState<Pilihan[]>([]);

  /**
   * Membuka satu perkara yang sudah pasti - dipanggil setelah perkaranya
   * ditentukan, baik karena hanya satu yang cocok maupun karena petugas
   * memilihnya dari daftar.
   */
  const bukaPerkara = useCallback(
    async (perkaraId: string) => {
      setMemuat(true);
      setPesan("");
      setPilihan([]);
      setKodeTerpilih("");
      try {
        const jawaban = await fetch(
          apiPath(`/api/aleta-ecourt/berkas-perkara?perkaraId=${encodeURIComponent(perkaraId)}`),
          { cache: "no-store" }
        );
        const data = ((await jawaban.json())?.data ?? {}) as Berkas;
        if (!data?.perkaraId) {
          setPesan("Perkara tidak dapat dibuka.");
          return;
        }
        setBerkas(data);

        // Katalog pemeriksaan dan daftar blangko diambil BERSAMAAN - keduanya
        // tidak saling bergantung, dan menunggu berurutan hanya menambah jeda
        // yang terasa tepat saat panitera hendak mulai bekerja.
        const katalog = await fetch(
          apiPath(`/api/aleta-ecourt/bas/tanya-jawab?jenisPerkaraId=${JENIS_CERAI_GUGAT}`),
          { cache: "no-store" }
        );
        setKumpulan((((await katalog.json())?.data ?? {})?.kumpulan ?? []) as Kumpulan[]);
      } catch {
        setPesan("Tidak dapat menghubungi ALETA. Periksa jaringan, lalu coba lagi.");
      } finally {
        setMemuat(false);
      }
    },
    []
  );

  /**
   * Mencari perkara dari yang diketik panitera.
   *
   * Yang diketik SELALU diperlakukan sebagai nomor perkara, tidak pernah
   * sebagai id basis data. Dulu angka bulat seperti "324" ditafsirkan sebagai
   * id, sehingga yang terbuka perkara lain dari tahun yang sama sekali berbeda
   * - dan tidak ada apa pun di layar yang memberitahu bahwa penafsiran itu
   * terjadi. Petugas berhak membuka perkara yang benar-benar dimaksudnya.
   */
  const cari = useCallback(async () => {
    const teks = nomor.trim();
    if (!teks) return;
    setMemuat(true);
    setPesan("");
    setBerkas(null);
    setKodeTerpilih("");
    setKumpulan([]);
    setPilihan([]);
    try {
      const jawaban = await fetch(apiPath(`/api/aleta-ecourt/berkas-perkara?nomor=${encodeURIComponent(teks)}`), {
        cache: "no-store",
      });
      const data = ((await jawaban.json())?.data ?? {}) as Berkas & { perluDipilih?: boolean; pilihan?: Pilihan[] };

      if (data?.perluDipilih && Array.isArray(data.pilihan)) {
        setPilihan(data.pilihan);
        setPesan("");
        return;
      }

      if (!data?.perkaraId) {
        setPesan(data?.halangan?.join(" ") || "Perkara tidak ditemukan. Coba tempel nomor perkara lengkap dari SIPP.");
        return;
      }

      setBerkas(data);
      const katalog = await fetch(apiPath(`/api/aleta-ecourt/bas/tanya-jawab?jenisPerkaraId=${JENIS_CERAI_GUGAT}`), {
        cache: "no-store",
      });
      setKumpulan((((await katalog.json())?.data ?? {})?.kumpulan ?? []) as Kumpulan[]);
    } catch {
      setPesan("Tidak dapat menghubungi ALETA. Periksa jaringan, lalu coba lagi.");
    } finally {
      setMemuat(false);
    }
  }, [nomor]);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Kepaniteraan"
        title="Alat Bantu Tulis BAS"
        description="Buka perkaranya, lalu pilih pemeriksaan yang berlangsung hari ini. Nama para pihak dan keterangan yang sudah ada di SIPP terisi sendiri."
      />

      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row">
          <Input
            value={nomor}
            onChange={(event) => setNomor(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void cari();
            }}
            placeholder="Nomor perkara, misalnya 324/Pdt.G/2026/PA.Dgl"
            aria-label="Nomor perkara"
          />
          <Button onClick={() => void cari()} disabled={memuat || !nomor.trim()}>
            {memuat ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Buka perkara
          </Button>
        </CardContent>
      </Card>

      {pesan ? <EmptyState title="Belum dapat dibuka" description={pesan} /> : null}

      {pilihan.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{pilihan.length} perkara cocok</CardTitle>
            <CardDescription>
              Pilih yang Anda maksud. ALETA tidak memilihkan sendiri — nomor sepotong dapat mengenai perkara dari
              tahun yang berbeda.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {pilihan.map((item) => (
              <button
                key={item.perkaraId}
                type="button"
                onClick={() => void bukaPerkara(item.perkaraId)}
                className="flex w-full items-baseline justify-between gap-3 rounded-md border border-border/60 px-3 py-2 text-left transition hover:border-primary/50 hover:bg-muted/50"
              >
                <span className="text-sm font-medium">{item.nomorPerkara}</span>
                <span className="text-xs text-muted-foreground">
                  {[item.jenisPerkara, item.tanggalDaftar].filter(Boolean).join(" · ")}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {berkas ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{berkas.nomorPerkara || "Perkara"}</CardTitle>
                <CardDescription>Dirakit dari SIPP dan APS Badilag.</CardDescription>
              </CardHeader>
              <CardContent>
                <BarisBerkas nama="Identitas perkara" bagian={berkas.identitas} />
                <BarisBerkas nama="Para pihak" bagian={berkas.paraPihak} />
                <BarisBerkas nama="Majelis" bagian={berkas.majelis} />
                <BarisBerkas nama="Panitera pengganti" bagian={berkas.panitera} />
                <BarisBerkas nama="Riwayat sidang" bagian={berkas.riwayatSidang} />
                <BarisBerkas nama="Saksi tercatat" bagian={berkas.saksiTercatat} />
                <BarisBerkas nama="Pemeriksaan saksi" bagian={berkas.pemeriksaanSaksi} />
                <BarisBerkas nama="Putusan" bagian={berkas.putusan} />
                <BarisBerkas nama="Pertimbangan hukum" bagian={berkas.pertimbangan} />
              </CardContent>
            </Card>

            {berkas.selisih.length > 0 ? (
              <Card className="border-amber-300 dark:border-amber-500/40">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TriangleAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    Selisih antar sumber
                  </CardTitle>
                  <CardDescription>Ditampilkan apa adanya, tidak digabung diam-diam.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {berkas.selisih.map((item) => (
                    <div key={item.hal} className="space-y-1">
                      <p className="text-sm font-medium">{item.hal}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.menurut.map((m) => `${m.sistem}: ${m.nilai}`).join("  ·  ")}
                      </p>
                      <p className="text-sm">{item.keterangan}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {berkas.halangan.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Bagian yang tidak terbaca</CardTitle>
                  <CardDescription>Sisanya tetap dapat dipakai bekerja.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1">
                  {berkas.halangan.map((h) => (
                    <p key={h} className="text-sm text-muted-foreground">
                      {h}
                    </p>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pemeriksaan hari ini</CardTitle>
                <CardDescription>Pilih yang berlangsung, lalu lembarnya terbuka sudah terisi.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {kumpulan.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Daftar pemeriksaan belum terbaca dari APS Badilag.</p>
                ) : (
                  kumpulan.map((item) => (
                    <Button
                      key={item.kode}
                      variant={kodeTerpilih === item.kode ? "default" : "outline"}
                      size="sm"
                      onClick={() => setKodeTerpilih(item.kode)}
                    >
                      {item.nama}
                      <Badge variant="muted">{item.jumlahPertanyaan}</Badge>
                    </Button>
                  ))
                )}
              </CardContent>
            </Card>

            <KehadiranSidang
              perkaraId={berkas.perkaraId}
              nomorPerkara={berkas.nomorPerkara}
              riwayatSidang={berkas.riwayatSidang.nilai}
            />

            <PilihBlangko
              perkaraId={berkas.perkaraId}
              jenisPerkara={String((berkas.identitas.nilai as { jenisPerkara?: string } | null)?.jenisPerkara ?? "")}
              riwayatSidang={berkas.riwayatSidang.nilai}
            />

            {kodeTerpilih ? (
              <LembarIsian
                perkaraId={berkas.perkaraId}
                nomorPerkara={berkas.nomorPerkara}
                kode={kodeTerpilih}
                namaKumpulan={kumpulan.find((item) => item.kode === kodeTerpilih)?.nama ?? kodeTerpilih}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
