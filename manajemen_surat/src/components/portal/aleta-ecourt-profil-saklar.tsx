"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/**
 * Profil saklar per peran - kartu admin Integrasi e-Court (butir 25, kontrak K4).
 *
 * Saklar ekstensi (tandai halaman, sisip jadwal, cetak tiga berkas, checklist,
 * sunting sekali klik di ABT) dan fitur ide yang tampil, per PERAN login.
 * Pegawai non-admin mengikuti profil perannya dan bagian "Profil saklar" di
 * popup tidak tampil baginya; Super Admin dan Admin tidak dibatasi.
 *
 * Hanya Super Admin dan Admin yang membuka dan mengubah kartu ini.
 */

type KunciSaklar = { kunci: string; label: string };
type Fitur = { kode: string; bagian: string; judul: string };
type Peran = {
  peran: string;
  label: string;
  jumlahPegawai: number;
  sumber: "admin" | "bawaan";
  saklar: Record<string, boolean> | null;
  fitur: Record<string, true> | null;
  catatan: string;
  diubahOleh: string;
  diubahPada: string | null;
  bawaan: Record<string, boolean> | null;
  tidakDibatasi: boolean;
};
type Jawaban = {
  bolehMenyunting: boolean;
  kunciSaklar: KunciSaklar[];
  daftarFitur: Fitur[];
  bagian: Record<string, string>;
  peran: Peran[];
};

const ALAMAT = "/api/aleta-ecourt/profil-saklar";

export function AletaEcourtProfilSaklar() {
  const [data, setData] = useState<Jawaban | null>(null);
  const [pilih, setPilih] = useState("hakim");
  const [saklar, setSaklar] = useState<Record<string, boolean>>({});
  const [batasiFitur, setBatasiFitur] = useState(false);
  const [fitur, setFitur] = useState<Record<string, true>>({});
  const [memuat, setMemuat] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [kabar, setKabar] = useState("");

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat("");
    try {
      const jawaban = await fetch(apiPath(ALAMAT), { cache: "no-store" });
      const isi = await jawaban.json().catch(() => null);
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal membaca profil saklar."));
      setData(isi?.data ?? null);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Gagal membaca profil saklar.");
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(timer);
  }, [muat]);

  const peran = useMemo(() => data?.peran.find((p) => p.peran === pilih) ?? null, [data, pilih]);

  // Isian mengikuti peran yang dipilih.
  useEffect(() => {
    if (!peran) return;
    setSaklar({ ...(peran.saklar ?? {}) });
    setBatasiFitur(peran.fitur !== null);
    setFitur({ ...(peran.fitur ?? {}) });
  }, [peran]);

  const kirim = useCallback(
    async (cara: "PUT" | "DELETE") => {
      setSibuk(true);
      setGalat("");
      setKabar("");
      try {
        const jawaban = await fetch(
          apiPath(cara === "DELETE" ? `${ALAMAT}?peran=${encodeURIComponent(pilih)}` : ALAMAT),
          cara === "DELETE"
            ? { method: "DELETE" }
            : {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ peran: pilih, saklar, fitur: batasiFitur ? fitur : null }),
              }
        );
        const isi = await jawaban.json().catch(() => null);
        if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal menyimpan profil saklar."));
        setData(isi?.data ?? null);
        setKabar(cara === "DELETE" ? "Profil dikembalikan ke bawaan." : "Profil saklar disimpan.");
      } catch (e) {
        setGalat(e instanceof Error ? e.message : "Gagal menyimpan profil saklar.");
      } finally {
        setSibuk(false);
      }
    },
    [pilih, saklar, fitur, batasiFitur]
  );

  const boleh = Boolean(data?.bolehMenyunting);

  return (
    <Card id="profil-saklar" className="scroll-mt-24">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Profil saklar
          <Badge variant="muted">per peran login</Badge>
        </CardTitle>
        <CardDescription>
          Saklar ekstensi dan fitur yang tampil bagi tiap peran. Pegawai mengikuti profil perannya dan tidak melihat menu
          profil saklar di popup; Super Admin dan Admin tidak dibatasi. Panitera pengganti dan juru sita dikenali dari
          jabatannya walau perannya tertulis &quot;staf&quot;.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {memuat ? <p className="text-sm text-muted-foreground">Memuat...</p> : null}
        {galat ? <p className="text-sm text-rose-600 dark:text-rose-400">{galat}</p> : null}
        {kabar ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{kabar}</p> : null}

        {data ? (
          <>
            <label className="flex max-w-sm flex-col gap-1 text-xs text-muted-foreground">
              Peran
              <NativeSelect value={pilih} onChange={(e) => setPilih(e.target.value)} aria-label="Peran yang diatur">
                {data.peran.map((p) => (
                  <option key={p.peran} value={p.peran}>
                    {p.label} ({p.jumlahPegawai} pegawai){p.sumber === "admin" ? " · diatur" : ""}
                  </option>
                ))}
              </NativeSelect>
            </label>

            {peran ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  {peran.tidakDibatasi
                    ? "Peran ini tidak dibatasi profil - ekstensi tetap memakai saklar perambannya sendiri."
                    : peran.sumber === "admin"
                      ? `Diatur ${peran.diubahOleh}${peran.diubahPada ? " · " + new Date(peran.diubahPada).toLocaleString("id-ID") : ""}.`
                      : peran.bawaan
                        ? "Memakai profil bawaan."
                        : "Belum diatur - ekstensi memakai saklar peramban."}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {data.kunciSaklar.map((k) => (
                    <label key={k.kunci} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                      <span>{k.label}</span>
                      <Switch
                        checked={saklar[k.kunci] === true}
                        disabled={!boleh || sibuk}
                        aria-label={k.label}
                        onCheckedChange={(v: boolean) => setSaklar((lama) => ({ ...lama, [k.kunci]: v }))}
                      />
                    </label>
                  ))}
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={batasiFitur}
                    disabled={!boleh || sibuk}
                    onChange={(e) => setBatasiFitur(e.target.checked)}
                  />
                  Batasi fitur ide yang tampil untuk peran ini
                </label>
                {batasiFitur ? (
                  <details className="rounded-md border p-2" open>
                    <summary className="cursor-pointer text-sm font-medium">
                      Fitur yang tampil ({Object.keys(fitur).length} dari {data.daftarFitur.length})
                    </summary>
                    <div className="mt-2 grid max-h-72 gap-1 overflow-y-auto sm:grid-cols-2">
                      {data.daftarFitur.map((f) => (
                        <label key={f.kode} className="flex items-start gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={fitur[f.kode] === true}
                            disabled={!boleh || sibuk}
                            onChange={(e) =>
                              setFitur((lama) => {
                                const baru = { ...lama };
                                if (e.target.checked) baru[f.kode] = true;
                                else delete baru[f.kode];
                                return baru;
                              })
                            }
                          />
                          <span>
                            <span className="font-mono text-muted-foreground">{f.kode}</span> {f.judul}
                          </span>
                        </label>
                      ))}
                    </div>
                  </details>
                ) : null}

                {boleh ? (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" disabled={sibuk} onClick={() => void kirim("PUT")}>
                      {sibuk ? "Menyimpan..." : "Simpan profil peran ini"}
                    </Button>
                    {peran.sumber === "admin" ? (
                      <Button size="sm" variant="outline" disabled={sibuk} onClick={() => void kirim("DELETE")}>
                        Kembalikan ke bawaan
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
