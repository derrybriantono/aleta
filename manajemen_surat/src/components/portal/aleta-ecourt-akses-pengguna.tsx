"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/**
 * Pengecualian akses ekstensi untuk satu orang.
 *
 * ============================================================================
 * YANG DIGAMBAR HANYA SELISIHNYA
 * ============================================================================
 *
 * Kewenangan jabatan sudah diatur pada kartu di atas, dan itulah jalan
 * utamanya. Kartu ini untuk keadaan yang tidak dapat dijawab per jabatan:
 * satu orang yang perlu berbeda dari rekan sejabatannya.
 *
 * Karena itu yang terdaftar di sini hanya orang yang BENAR-BENAR dikecualikan.
 * Menggambar seluruh pegawai kali enam kemampuan berarti ratusan pengalihan
 * pada satu layar, dan di antaranya - tanpa tanda apa pun - beberapa baris
 * yang berbeda dari perannya. Justru beberapa baris itu yang perlu dibaca.
 *
 * ============================================================================
 * TIGA KEADAAN, BUKAN DUA
 * ============================================================================
 *
 * Tiap kemampuan punya tiga pilihan: ikut peran, boleh, dan tidak boleh.
 * "Ikut peran" bukan sekadar nilai awal - ia keadaan yang harus dapat
 * dikembalikan, sebab pengecualian yang tidak dapat dicabut akan membekukan
 * kewenangan orang itu pada nilai hari ini, dan perubahan pada jabatannya
 * kelak tidak akan pernah sampai kepadanya.
 */

type Kapabilitas = string;

type Pengecualian = {
  kapabilitas: Kapabilitas;
  aktif: boolean;
  alasan: string;
  berlakuSampai: string | null;
  kedaluwarsa: boolean;
  updatedAt: string;
};

type Orang = {
  userId: string;
  nama: string;
  username: string;
  labelPeran: string;
  dariPeran: Record<Kapabilitas, boolean>;
  berlaku: Record<Kapabilitas, boolean>;
  pengecualian: Pengecualian[];
};

type Keterangan = Record<Kapabilitas, { label: string; penjelasan: string }>;

/** Keadaan sebuah kemampuan bagi seseorang. */
type Keadaan = "ikut" | "boleh" | "tidak";

function keadaanSekarang(orang: Orang, kunci: Kapabilitas): Keadaan {
  const kecuali = orang.pengecualian.find((x) => x.kapabilitas === kunci && !x.kedaluwarsa);
  if (!kecuali) return "ikut";
  return kecuali.aktif ? "boleh" : "tidak";
}

function tanggalPendek(iso: string | null) {
  if (!iso) return "";
  const tanggal = new Date(iso);
  if (Number.isNaN(tanggal.getTime())) return "";
  return tanggal.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

export function AletaEcourtAksesPengguna() {
  const [keterangan, setKeterangan] = useState<Keterangan>({});
  const [daftar, setDaftar] = useState<Orang[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [boleh, setBoleh] = useState(true);

  const [kata, setKata] = useState("");
  const [hasil, setHasil] = useState<Orang[] | null>(null);
  const [mencari, setMencari] = useState(false);

  // Orang yang sedang disunting, beserta alasan dan masa berlaku yang diketik
  // untuk perubahan berikutnya. Alasan sengaja diminta SEBELUM menekan, bukan
  // sesudah: kotak yang muncul setelah perbuatan selesai akan diisi apa saja.
  const [dibuka, setDibuka] = useState<string | null>(null);
  const [alasan, setAlasan] = useState("");
  const [sampai, setSampai] = useState("");
  const [sedangSimpan, setSedangSimpan] = useState<string | null>(null);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat("");
    try {
      const jawaban = await fetch(apiPath("/api/aleta-ecourt/akses/pengguna"), { cache: "no-store" });
      const isi = await jawaban.json();
      if (jawaban.status === 403) {
        setBoleh(false);
        return;
      }
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal membaca pengecualian akses."));
      const data = isi?.data ?? isi;
      setDaftar(data?.pengecualian ?? []);
      setKeterangan(data?.keterangan ?? {});
    } catch (kesalahan) {
      setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal membaca pengecualian akses.");
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void muat();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [muat]);

  const cari = useCallback(async () => {
    const bersih = kata.trim();
    if (bersih.length < 2) {
      setGalat("Ketik sekurang-kurangnya dua huruf.");
      return;
    }
    setMencari(true);
    setGalat("");
    try {
      const jawaban = await fetch(
        apiPath("/api/aleta-ecourt/akses/pengguna?cari=" + encodeURIComponent(bersih)),
        { cache: "no-store" }
      );
      const isi = await jawaban.json();
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal mencari pegawai."));
      const data = isi?.data ?? isi;
      setHasil(data?.hasil ?? []);
      setKeterangan(data?.keterangan ?? keterangan);
    } catch (kesalahan) {
      setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal mencari pegawai.");
    } finally {
      setMencari(false);
    }
  }, [kata, keterangan]);

  const ubah = useCallback(
    async (orang: Orang, kunci: Kapabilitas, keadaan: Keadaan) => {
      const penanda = orang.userId + ":" + kunci;
      setSedangSimpan(penanda);
      setGalat("");
      try {
        const jawaban = await fetch(apiPath("/api/aleta-ecourt/akses/pengguna"), {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            userId: orang.userId,
            kapabilitas: kunci,
            aktif: keadaan === "ikut" ? null : keadaan === "boleh",
            alasan,
            berlakuSampai: sampai ? new Date(sampai + "T23:59:59").toISOString() : null,
          }),
        });
        const isi = await jawaban.json();
        if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal menyimpan pengecualian."));

        const data = isi?.data ?? isi;
        if (data?.available === false) throw new Error(data.message || "Gagal menyimpan pengecualian.");

        // Daftar yang dipakai adalah yang dikirim balik server, bukan tebakan
        // di peramban - termasuk ketika barisnya terhapus karena dikembalikan
        // ikut peran.
        setDaftar(data?.pengecualian ?? []);
        setAlasan("");
        setSampai("");
        // Hasil pencarian ikut disegarkan supaya kartu yang sedang dibuka
        // menunjukkan keadaan barunya, bukan keadaan sebelum ditekan.
        if (hasil) {
          const baru = (data?.pengecualian ?? []) as Orang[];
          setHasil(
            hasil.map((x) => {
              const segar = baru.find((y) => y.userId === x.userId);
              return segar ?? { ...x, pengecualian: x.pengecualian.filter((p) => p.kapabilitas !== kunci) };
            })
          );
        }
      } catch (kesalahan) {
        setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal menyimpan pengecualian.");
      } finally {
        setSedangSimpan(null);
      }
    },
    [alasan, sampai, hasil]
  );

  if (!boleh) return null;

  const kunciKapabilitas = Object.keys(keterangan);

  const gambarOrang = (orang: Orang) => {
    const terbuka = dibuka === orang.userId;
    return (
      <div key={orang.userId} className="rounded-md border">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
          onClick={() => setDibuka(terbuka ? null : orang.userId)}
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{orang.nama}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {orang.username} · {orang.labelPeran}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {orang.pengecualian
              .filter((x) => !x.kedaluwarsa)
              .map((x) => (
                <Badge key={x.kapabilitas} variant={x.aktif ? "success" : "danger"}>
                  {x.aktif ? "+" : "−"} {keterangan[x.kapabilitas]?.label ?? x.kapabilitas}
                </Badge>
              ))}
            <span className="text-xs text-muted-foreground">{terbuka ? "tutup" : "atur"}</span>
          </span>
        </button>

        {terbuka ? (
          <div className="space-y-3 border-t px-3 py-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor={"alasan-" + orang.userId} className="block text-xs font-medium text-muted-foreground">
                  Alasan pengecualian (wajib)
                </label>
                <Input
                  id={"alasan-" + orang.userId}
                  value={alasan}
                  onChange={(e) => setAlasan(e.target.value)}
                  placeholder="Mis. merangkap tugas kepaniteraan selama panitera cuti"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor={"sampai-" + orang.userId} className="block text-xs font-medium text-muted-foreground">
                  Berlaku sampai (boleh dikosongkan)
                </label>
                <Input
                  id={"sampai-" + orang.userId}
                  type="date"
                  value={sampai}
                  onChange={(e) => setSampai(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              {kunciKapabilitas.map((kunci) => {
                const keadaan = keadaanSekarang(orang, kunci);
                const bawaanPeran = orang.dariPeran?.[kunci] ?? false;
                const kecuali = orang.pengecualian.find((x) => x.kapabilitas === kunci);
                const sibuk = sedangSimpan === orang.userId + ":" + kunci;

                return (
                  <div
                    key={kunci}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 px-2 py-2"
                  >
                    <span className="min-w-0 text-xs">
                      <span className="block font-medium">{keterangan[kunci]?.label ?? kunci}</span>
                      <span className="block text-muted-foreground">
                        Perannya: {bawaanPeran ? "boleh" : "tidak boleh"}
                        {kecuali?.kedaluwarsa
                          ? ` · pengecualian lama berakhir ${tanggalPendek(kecuali.berlakuSampai)}`
                          : kecuali?.berlakuSampai
                            ? ` · sampai ${tanggalPendek(kecuali.berlakuSampai)}`
                            : ""}
                        {kecuali && !kecuali.kedaluwarsa && kecuali.alasan ? ` · ${kecuali.alasan}` : ""}
                      </span>
                    </span>

                    <span className="flex shrink-0 gap-1">
                      {(
                        [
                          ["ikut", "Ikut peran"],
                          ["boleh", "Boleh"],
                          ["tidak", "Tidak boleh"],
                        ] as [Keadaan, string][]
                      ).map(([nilai, label]) => (
                        <Button
                          key={nilai}
                          size="sm"
                          variant={keadaan === nilai ? "default" : "outline"}
                          disabled={sibuk || keadaan === nilai}
                          onClick={() => void ubah(orang, kunci, nilai)}
                        >
                          {label}
                        </Button>
                      ))}
                    </span>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground">
              &quot;Ikut peran&quot; menghapus pengecualiannya - orang ini kembali mengikuti
              kewenangan jabatannya, termasuk perubahan jabatan kelak. Setiap perubahan tercatat di
              jejak audit.
            </p>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pengecualian per pegawai</CardTitle>
        <CardDescription>
          Untuk satu orang yang perlu berbeda dari rekan sejabatannya. Tanpa pengecualian, setiap
          pegawai mengikuti kewenangan perannya pada tabel di atas.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {galat ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {galat}
          </p>
        ) : null}

        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1 space-y-1">
            <label htmlFor="cari-pegawai-ekstensi" className="block text-xs font-medium text-muted-foreground">
              Cari pegawai untuk diberi pengecualian
            </label>
            <Input
              id="cari-pegawai-ekstensi"
              value={kata}
              onChange={(e) => setKata(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void cari();
              }}
              placeholder="Nama atau nama pengguna"
            />
          </div>
          <Button size="sm" onClick={() => void cari()} disabled={mencari}>
            {mencari ? "Mencari..." : "Cari"}
          </Button>
          {hasil ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setHasil(null);
                setKata("");
              }}
            >
              Tutup hasil
            </Button>
          ) : null}
        </div>

        {hasil ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Hasil pencarian ({hasil.length})
            </p>
            {hasil.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Tidak ada pegawai aktif yang cocok. Super Admin dan Admin tidak dapat dikecualikan.
              </p>
            ) : (
              <div className="space-y-2">{hasil.map(gambarOrang)}</div>
            )}
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Pegawai yang dikecualikan ({daftar.length})
          </p>
          {memuat ? (
            <p className="text-sm text-muted-foreground">Memuat pengecualian...</p>
          ) : daftar.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada pengecualian. Seluruh pegawai mengikuti kewenangan perannya.
            </p>
          ) : (
            <div className="space-y-2">{daftar.map(gambarOrang)}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
