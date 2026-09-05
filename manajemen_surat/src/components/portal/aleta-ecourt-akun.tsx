"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/**
 * Akun e-Court yang dipakai bergiliran.
 *
 * ============================================================================
 * MENAMBAH AKUN ADALAH DUA LANGKAH, DAN ITU DISENGAJA
 * ============================================================================
 *
 * Mendaftarkan slot di sini hanya menyediakan tempatnya. Akun baru hidup
 * setelah petugas login sekali ke slot itu dari layar login e-Court, dengan
 * captcha diisi manusia.
 *
 * ============================================================================
 * SUREL DAN SANDI BOLEH DISIMPAN. CAPTCHA TIDAK.
 * ============================================================================
 *
 * Sejak sesi e-Court kerap habis di luar jam kerja, surel dan sandi tiap akun
 * dapat disimpan tersandi di server supaya formulir login terisi sendiri. Yang
 * tersisa bagi petugas hanyalah captcha - dan captcha memang harus begitu.
 *
 * Sandi yang sudah tersimpan TIDAK dapat dilihat kembali dari layar ini, dan
 * tidak dikirim ke peramban dalam bentuk apa pun. Yang tampil hanya surelnya
 * dan keterangan bahwa sandinya ada.
 */

type Akun = {
  slot: string;
  label: string;
  aktif: boolean;
  adaSesi: boolean;
  istirahat: boolean;
  gagalTerakhir: string | null;
  alasanGagal: string;
  terakhirDipakai: boolean;
};

/** Keadaan sesi tiap akun, dibaca terpisah supaya daftarnya tetap cepat tampil. */
type KeadaanAkun = {
  slot: string;
  keadaan: "berlaku" | "kedaluwarsa" | "gerbang" | "belum_pasti" | "belum_pernah";
  label: string;
  namaPengguna: string;
  diperiksaPada: string;
  umurDetik: number | null;
  emailTersimpan: string;
  isiOtomatis: boolean;
};

const NADA_KEADAAN: Record<string, "default" | "warning" | "muted"> = {
  berlaku: "default",
  kedaluwarsa: "warning",
  gerbang: "warning",
  belum_pasti: "warning",
  belum_pernah: "muted",
};

export function AletaEcourtAkun() {
  const [akun, setAkun] = useState<Akun[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState("");

  const [slotBaru, setSlotBaru] = useState("");
  const [labelBaru, setLabelBaru] = useState("");

  const [keadaan, setKeadaan] = useState<Record<string, KeadaanAkun>>({});
  const [memeriksa, setMemeriksa] = useState(false);

  // Slot yang formulir sandinya sedang dibuka. Hanya satu pada satu waktu -
  // membuka beberapa sekaligus memperbesar peluang sandi tertulis ke akun yang
  // keliru.
  const [suntingSlot, setSuntingSlot] = useState("");
  const [isianEmail, setIsianEmail] = useState("");
  const [isianSandi, setIsianSandi] = useState("");
  const [kabar, setKabar] = useState("");

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat("");
    try {
      const jawaban = await fetch(apiPath("/api/aleta-ecourt/akun"), { cache: "no-store" });
      const isi = await jawaban.json();
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal membaca daftar akun."));

      const data = isi?.data ?? isi;
      if (!data?.available) {
        setGalat(String(data?.message || "ALETA Bot belum dapat dihubungi."));
        setAkun([]);
        return;
      }
      setAkun(Array.isArray(data.akun) ? data.akun : []);
    } catch (kesalahan) {
      setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal membaca daftar akun.");
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

  /**
   * Membaca keadaan sesi tiap akun.
   *
   * Dipisah dari muat(): daftar akun tampil seketika, keadaan sesinya menyusul.
   * Menggabungkan keduanya berarti tabel baru muncul setelah seluruh Chrome
   * selesai - dan itulah lag yang dulu terasa.
   */
  const muatKeadaan = useCallback(async (penuh: boolean) => {
    if (penuh) setMemeriksa(true);
    try {
      const jawaban = await fetch(
        apiPath(`/api/aleta-ecourt/akun?keadaan=1${penuh ? "&periksa=penuh" : ""}`),
        { cache: "no-store" }
      );
      const isi = await jawaban.json();
      if (!jawaban.ok) return;

      const data = isi?.data ?? isi;
      if (!data?.available) return;

      const peta: Record<string, KeadaanAkun> = {};
      for (const satu of (data.akun ?? []) as KeadaanAkun[]) peta[satu.slot] = satu;
      setKeadaan(peta);
    } catch {
      // Gagal membaca keadaan bukan alasan mengosongkan daftar akun.
    } finally {
      setMemeriksa(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void muatKeadaan(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [muatKeadaan]);

  /** Menyimpan surel dan sandi satu slot. */
  const simpanKredensial = useCallback(
    async (slot: string) => {
      setSibuk(slot);
      setGalat("");
      setKabar("");
      try {
        const jawaban = await fetch(apiPath("/api/aleta-ecourt/akun"), {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ slot, email: isianEmail, sandi: isianSandi }),
        });
        const isi = await jawaban.json();
        if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal menyimpan surel dan sandi."));

        const data = isi?.data ?? isi;
        if (data?.available === false) {
          setGalat(String(data?.message || "ALETA Bot belum dapat dihubungi."));
          return;
        }
        if (!data?.ok) {
          const sebab: Record<string, string> = {
            slot_tidak_sah: "Slot tidak sah.",
            email_kosong: "Surel belum diisi.",
          };
          setGalat(sebab[String(data?.alasan)] || String(data?.alasan || "Tidak berhasil."));
          return;
        }

        setKabar("Surel dan sandi tersimpan. Login berikutnya cukup mengisi captcha.");
        setSuntingSlot("");
        // Isian dikosongkan SEGERA setelah terkirim - sandi tidak perlu
        // tinggal di memori peramban lebih lama dari yang diperlukan.
        setIsianEmail("");
        setIsianSandi("");
        await muatKeadaan(false);
      } catch (kesalahan) {
        setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal menyimpan.");
      } finally {
        setSibuk("");
      }
    },
    [isianEmail, isianSandi, muatKeadaan]
  );

  /** Menghapus simpanan sandi satu slot. */
  const hapusKredensial = useCallback(
    async (slot: string) => {
      setSibuk(slot);
      setGalat("");
      setKabar("");
      try {
        const kueri = new URLSearchParams({ slot });
        const jawaban = await fetch(apiPath(`/api/aleta-ecourt/akun?${kueri.toString()}`), {
          method: "DELETE",
        });
        const isi = await jawaban.json();
        if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal menghapus simpanan."));
        setKabar("Simpanan sandi dihapus. Login berikutnya diketik manual.");
        await muatKeadaan(false);
      } catch (kesalahan) {
        setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal menghapus.");
      } finally {
        setSibuk("");
      }
    },
    [muatKeadaan]
  );

  const kirim = useCallback(
    async (muatan: Record<string, unknown>, penanda: string) => {
      setSibuk(penanda);
      setGalat("");
      try {
        const jawaban = await fetch(apiPath("/api/aleta-ecourt/akun"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(muatan),
        });
        const isi = await jawaban.json();
        if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal menyimpan."));

        const data = isi?.data ?? isi;
        if (!data?.ok) {
          const sebab: Record<string, string> = {
            slot_kosong: "Nama slot belum diisi.",
            terlalu_banyak_akun: "Paling banyak sepuluh akun.",
            akun_terakhir_tidak_dapat_dihapus:
              "Akun terakhir tidak dapat dihapus - harus ada sedikitnya satu.",
            akun_tidak_ditemukan: "Akun tidak ditemukan.",
          };
          setGalat(sebab[String(data?.alasan)] || String(data?.message || data?.alasan || "Tidak berhasil."));
        }
        await muat();
      } catch (kesalahan) {
        setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal menyimpan.");
      } finally {
        setSibuk("");
      }
    },
    [muat]
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Akun e-Court</CardTitle>
            <CardDescription>
              Beberapa akun dipakai bergiliran, sehingga sesi yang habis pada satu akun tidak
              menghentikan penarikan. Surel dan sandi boleh disimpan tersandi supaya formulir
              login terisi sendiri - captcha tetap diisi manusia.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={memeriksa || sibuk !== ""}
            onClick={() => void muatKeadaan(true)}
            title="Membuka e-Court untuk tiap akun, berurutan. Perlu beberapa detik per akun."
          >
            {memeriksa ? "Memeriksa…" : "Periksa semua sesi"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {galat ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {galat}
          </p>
        ) : null}
        {kabar ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {kabar}
          </p>
        ) : null}

        {memuat ? (
          <p className="text-sm text-muted-foreground">Memuat daftar akun…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Akun</th>
                  <th className="px-3 py-2 font-medium">Slot</th>
                  <th className="px-3 py-2 font-medium">Keadaan sesi</th>
                  <th className="px-3 py-2 font-medium">Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {akun.map((baris) => (
                  <tr key={baris.slot} className="border-t border-border">
                    <td className="px-3 py-2">
                      <span className="font-medium">{baris.label}</span>
                      {baris.terakhirDipakai ? (
                        <Badge variant="muted" className="ml-2 align-middle">
                          terakhir dipakai
                        </Badge>
                      ) : null}

                      {/* Nama pengguna resmi yang dibaca dari halaman e-Court.
                          Tanpa ini, "utama" dan "akun-2" tidak memberi tahu
                          siapa pun akun siapa yang sedang tersambung. */}
                      {keadaan[baris.slot]?.namaPengguna ? (
                        <div className="text-xs text-muted-foreground">
                          {keadaan[baris.slot].namaPengguna}
                        </div>
                      ) : null}
                      {keadaan[baris.slot]?.emailTersimpan ? (
                        <div className="text-xs text-muted-foreground">
                          {keadaan[baris.slot].emailTersimpan}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{baris.slot}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {!baris.aktif ? <Badge variant="muted">dimatikan</Badge> : null}

                        {/* Keadaan yang sudah DIPERIKSA dipakai lebih dulu.
                            "ada sesi" hanya berarti foldernya ada - dan folder
                            itu tetap ada lama setelah sesinya mati. */}
                        {keadaan[baris.slot] ? (
                          <Badge
                            variant={NADA_KEADAAN[keadaan[baris.slot].keadaan] || "muted"}
                            title={keadaan[baris.slot].label}
                          >
                            {keadaan[baris.slot].keadaan === "berlaku"
                              ? "sesi berlaku"
                              : keadaan[baris.slot].keadaan === "kedaluwarsa"
                                ? "sesi kedaluwarsa"
                                : keadaan[baris.slot].keadaan === "gerbang"
                                  ? "menunggu penegasan"
                                  : keadaan[baris.slot].keadaan === "belum_pernah"
                                    ? "belum login"
                                    : "belum diperiksa"}
                          </Badge>
                        ) : baris.adaSesi ? (
                          <Badge variant="warning">belum diperiksa</Badge>
                        ) : (
                          <Badge variant="warning">belum login</Badge>
                        )}

                        {keadaan[baris.slot]?.isiOtomatis ? (
                          <Badge variant="muted" title="Surel dan sandi tersimpan - login cukup mengisi captcha.">
                            isi otomatis
                          </Badge>
                        ) : null}
                        {baris.istirahat ? (
                          <Badge variant="danger" title={baris.alasanGagal}>
                            diistirahatkan
                          </Badge>
                        ) : null}
                      </div>
                      {baris.istirahat && baris.alasanGagal ? (
                        <p className="mt-1 text-xs text-muted-foreground">{baris.alasanGagal}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={sibuk !== ""}
                          onClick={() =>
                            void kirim(
                              { slot: baris.slot, label: baris.label, aktif: !baris.aktif },
                              baris.slot
                            )
                          }
                        >
                          {baris.aktif ? "Matikan" : "Nyalakan"}
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          disabled={sibuk !== ""}
                          onClick={() => {
                            const buka = suntingSlot === baris.slot ? "" : baris.slot;
                            setSuntingSlot(buka);
                            // Surel yang sudah tersimpan diisikan supaya tidak
                            // perlu diketik ulang. Sandi TIDAK - ia memang tidak
                            // pernah dikirim ke peramban.
                            setIsianEmail(buka ? keadaan[baris.slot]?.emailTersimpan || "" : "");
                            setIsianSandi("");
                            setKabar("");
                          }}
                        >
                          {keadaan[baris.slot]?.isiOtomatis ? "Ubah sandi" : "Simpan sandi"}
                        </Button>

                        {keadaan[baris.slot]?.isiOtomatis ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={sibuk !== ""}
                            onClick={() => {
                              if (
                                !window.confirm(
                                  `Hapus simpanan sandi akun ${baris.label}? Login berikutnya diketik manual.`
                                )
                              ) {
                                return;
                              }
                              void hapusKredensial(baris.slot);
                            }}
                          >
                            Lupakan sandi
                          </Button>
                        ) : null}

                        {akun.length > 1 ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={sibuk !== ""}
                            onClick={() => {
                              // Menghapus akun ikut menghapus sesinya - seseorang
                              // harus login ulang dengan captcha. Layak dikonfirmasi.
                              if (
                                !window.confirm(
                                  `Hapus akun "${baris.label}" beserta sesinya? Untuk memakainya lagi, seseorang harus login ulang dengan captcha.`
                                )
                              ) {
                                return;
                              }
                              void kirim({ tindakan: "hapus", slot: baris.slot }, baris.slot);
                            }}
                          >
                            Hapus
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}

                {/* Formulir sandi muncul sebagai barisnya sendiri di bawah akun
                    yang sedang disunting - bukan pada baris yang sama. Kotak
                    sandi di dalam sel tabel yang sempit terlalu mudah terisi ke
                    baris yang keliru. */}
                {akun.map((baris) =>
                  suntingSlot === baris.slot ? (
                    <tr key={`${baris.slot}-sandi`} className="border-t border-border bg-muted/30">
                      <td colSpan={4} className="px-3 py-3">
                        <p className="mb-2 text-sm font-medium">
                          Surel dan sandi untuk {baris.label}
                        </p>
                        <div className="flex flex-wrap items-end gap-2">
                          <label className="flex flex-col gap-1 text-xs">
                            Surel e-Court
                            <Input
                              type="email"
                              autoComplete="off"
                              value={isianEmail}
                              onChange={(e) => setIsianEmail(e.target.value)}
                              className="w-64"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-xs">
                            Sandi
                            <Input
                              type="password"
                              autoComplete="new-password"
                              placeholder={
                                keadaan[baris.slot]?.isiOtomatis
                                  ? "biarkan kosong untuk tidak mengubah"
                                  : ""
                              }
                              value={isianSandi}
                              onChange={(e) => setIsianSandi(e.target.value)}
                              className="w-64"
                            />
                          </label>
                          <Button
                            size="sm"
                            disabled={sibuk !== "" || !isianEmail.trim()}
                            onClick={() => void simpanKredensial(baris.slot)}
                          >
                            Simpan
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSuntingSlot("");
                              setIsianEmail("");
                              setIsianSandi("");
                            }}
                          >
                            Batal
                          </Button>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Sandi disandi di server dan tidak pernah dikirim kembali ke layar ini.
                          Setelah tersimpan, login e-Court cukup mengisi captcha. Captcha tetap
                          diisi manusia.
                        </p>
                      </td>
                    </tr>
                  ) : null
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-2 border-t pt-3">
          <label className="flex flex-col gap-1 text-xs font-medium">
            Slot baru
            <Input
              placeholder="akun-2"
              value={slotBaru}
              onChange={(peristiwa) => setSlotBaru(peristiwa.target.value)}
              className="w-40"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            Keterangan
            <Input
              placeholder="Akun Panitera"
              value={labelBaru}
              onChange={(peristiwa) => setLabelBaru(peristiwa.target.value)}
              className="w-56"
            />
          </label>
          <Button
            size="sm"
            disabled={sibuk !== "" || !slotBaru.trim()}
            onClick={() => {
              void kirim({ slot: slotBaru.trim(), label: labelBaru.trim() || slotBaru.trim(), aktif: true }, "baru");
              setSlotBaru("");
              setLabelBaru("");
            }}
          >
            Tambah akun
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Nama slot hanya huruf kecil, angka, dan tanda hubung. Setelah ditambahkan, hidupkan
          akunnya dengan login sekali dari panel Sesi e-Court di atas — pilih slotnya lebih dulu.
        </p>
      </CardContent>
    </Card>
  );
}
