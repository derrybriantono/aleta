"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/**
 * Variabel wajib ABT sebelum CETAK - kartu admin.
 *
 * ============================================================================
 * DIUKUR, LALU DAPAT DIUBAH - DAN TETAP HANYA PERINGATAN
 * ============================================================================
 *
 * Daftarnya dari "Ukur ulang": persen perkara yang sudah diputus dan mengisi
 * variabel itu di ABT, sejak variabel itu mulai dipakai (jembatan bot,
 * baca-saja). Yang >= 90% menyala; yang 50-90% tersimpan mati supaya dapat
 * dinyalakan tanpa mengetik kodenya. Saklar yang disentuh Super Admin tidak
 * ditimpa ukur ulang berikutnya.
 *
 * Ekstensi menyebut variabel wajib yang masih kosong sebagai PERINGATAN;
 * CETAK tidak pernah ditahan.
 */

type Variabel = {
  kode: string;
  nama: string | null;
  sumber: "ukur" | "admin";
  persenTerisi: number | null;
  aktif: boolean;
  jumlahPerkara: number | null;
  jumlahTerisi: number | null;
  ditetapkanAdmin: boolean;
};

type Jenis = { jenis: string; jenisNama: string; variabel: Variabel[]; diukurPada: string | null; catatan: string };

type Jawaban = {
  daftar: Jenis[];
  bolehMenyunting: boolean;
  ambang: { wajib: number; simpan: number; minimalPerkara: number };
};

const ALAMAT = "/api/aleta-ecourt/abt-wajib";

function waktuSingkat(iso: string | null) {
  if (!iso) return "belum pernah";
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? iso : t.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export function AletaEcourtAbtWajib() {
  const [data, setData] = useState<Jawaban | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [kabar, setKabar] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [tambah, setTambah] = useState({ jenis: "", kode: "" });

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat("");
    try {
      const jawaban = await fetch(apiPath(ALAMAT), { cache: "no-store" });
      const isi = await jawaban.json().catch(() => null);
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal membaca variabel wajib ABT."));
      setData(isi?.data ?? null);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal membaca variabel wajib ABT.");
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(timer);
  }, [muat]);

  const kirim = useCallback(
    async (cara: "PUT" | "POST", badan: Record<string, unknown>, kabarBerhasil: string) => {
      setSibuk(true);
      setGalat("");
      setKabar("");
      try {
        const jawaban = await fetch(apiPath(ALAMAT), {
          method: cara,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(badan),
        });
        const isi = await jawaban.json().catch(() => null);
        if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal menyimpan."));
        await muat();
        const h = isi?.data?.hasil as { disimpan?: number; dihapus?: number; jenis?: number } | undefined;
        setKabar(h ? `${kabarBerhasil}: ${h.disimpan ?? 0} variabel dari ${h.jenis ?? 0} jenis perkara, ${h.dihapus ?? 0} dibuang.` : kabarBerhasil);
        return true;
      } catch (e) {
        setGalat(e instanceof Error ? e.message : "Gagal menyimpan.");
        return false;
      } finally {
        setSibuk(false);
      }
    },
    [muat]
  );

  const boleh = Boolean(data?.bolehMenyunting);
  const persenAmbang = Math.round((data?.ambang.wajib ?? 0.9) * 100);

  return (
    <Card id="abt-wajib">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Variabel wajib ABT sebelum CETAK
          <Badge variant="muted">peringatan, tidak menahan</Badge>
        </CardTitle>
        <CardDescription>
          Diukur dari putusan: persen perkara yang sudah diputus dan mengisi variabel itu di ABT, sejak variabel itu mulai
          dipakai. Wajib bila &ge; {persenAmbang}% dari sedikitnya {data?.ambang.minimalPerkara ?? 10} putusan. Ekstensi
          memperingatkan bila variabel wajib masih kosong atau berbunyi galat saat CETAK.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {memuat ? <p className="text-sm text-muted-foreground">Memuat...</p> : null}
        {galat ? <p className="text-sm text-rose-600 dark:text-rose-400">{galat}</p> : null}
        {kabar ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{kabar}</p> : null}

        {boleh ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              disabled={sibuk}
              onClick={() => void kirim("POST", { tindakan: "ukur-ulang" }, "Ukur ulang selesai")}
            >
              {sibuk ? "Mengukur..." : "Ukur ulang dari putusan"}
            </Button>
            <span className="text-xs text-muted-foreground">
              Membaca APS Badilag lewat ALETA Bot (baca-saja). Saklar yang pernah Anda ubah tidak ditimpa.
            </span>
          </div>
        ) : null}

        {data && data.daftar.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum ada hasil ukur. {boleh ? "Tekan Ukur ulang saat server ALETA Bot tersambung ke APS Badilag." : ""}
          </p>
        ) : null}

        {data?.daftar.map((j) => (
          <div key={j.jenis} className="rounded-lg border border-border/70 p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">{j.jenisNama}</h3>
              <span className="text-xs text-muted-foreground">Diukur {waktuSingkat(j.diukurPada)}</span>
            </div>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-1 text-left font-medium">Kode</th>
                    <th className="py-1 text-left font-medium">Nama</th>
                    <th className="py-1 text-right font-medium">Terisi</th>
                    <th className="py-1 text-left font-medium">Sumber</th>
                    <th className="py-1 text-right font-medium">Wajib</th>
                  </tr>
                </thead>
                <tbody>
                  {j.variabel.map((v) => (
                    <tr key={v.kode} className="border-t align-top">
                      <td className="py-1.5 pr-2 font-mono text-xs">#{v.kode}#</td>
                      <td className="py-1.5 pr-2">{v.nama || <span className="text-muted-foreground">-</span>}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">
                        {v.persenTerisi === null ? "-" : `${v.persenTerisi}%`}
                        {v.jumlahPerkara ? (
                          <div className="text-xs text-muted-foreground">
                            {v.jumlahTerisi}/{v.jumlahPerkara}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-1.5 pr-2 text-xs text-muted-foreground">
                        {v.sumber === "admin" ? "Super Admin" : "ukur"}
                        {v.ditetapkanAdmin && v.sumber === "ukur" ? " · saklar dipegang Super Admin" : ""}
                      </td>
                      <td className="py-1.5 text-right">
                        <Switch
                          checked={v.aktif}
                          disabled={!boleh || sibuk}
                          aria-label={`Wajib #${v.kode}#`}
                          onCheckedChange={(aktif: boolean) =>
                            void kirim("PUT", { jenis: j.jenisNama, variabel: [{ kode: v.kode, aktif }] }, "Tersimpan")
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {boleh ? (
          <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
            <h3 className="text-sm font-semibold">Tambah variabel wajib</h3>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto]">
              <Input
                value={tambah.jenis}
                onChange={(e) => setTambah({ ...tambah, jenis: e.target.value })}
                placeholder="Jenis perkara, mis. Cerai Gugat"
                aria-label="Jenis perkara"
              />
              <Input
                value={tambah.kode}
                onChange={(e) => setTambah({ ...tambah, kode: e.target.value })}
                placeholder="Kode, mis. 1214"
                aria-label="Kode variabel"
              />
              <Button
                size="sm"
                disabled={sibuk || !tambah.jenis.trim() || !tambah.kode.trim()}
                onClick={async () => {
                  const berhasil = await kirim(
                    "PUT",
                    { jenis: tambah.jenis, variabel: [{ kode: tambah.kode, aktif: true }] },
                    "Ditambahkan"
                  );
                  if (berhasil) setTambah({ jenis: tambah.jenis, kode: "" });
                }}
              >
                Tambah
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
