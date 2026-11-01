"use client";

import { useCallback, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { usePortal } from "@/lib/app-state";
import { apiPath } from "@/lib/base-path";
import { LABEL_JENIS_KOREKSI, type JenisKoreksi } from "@/lib/pengukur-draf";
import { getEffectiveRoleId } from "@/lib/permissions";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import type { BarisUsulan, LaporanPengukur } from "@/server/modules/aleta-ecourt/pengukur-draf";

/**
 * Kecocokan draf putusan (P3, 1 Nov 2026) - layar kecil untuk hakim dan Super Admin.
 * Dimuat HANYA saat dibuka (tidak membebani halaman). Hakim melihat perkara majelisnya; Super Admin, ketua, dan wakil ketua
 * melihat semua hakim. Usulan memori ALETA Ai hanya untuk Super Admin dan tidak pernah berlaku sendiri.
 */

type Data = LaporanPengukur & { superAdmin: boolean; memoriTersedia: boolean; usulan: BarisUsulan[] };

const PERAN_LIHAT = ["super-admin", "hakim", "ketua", "wakil-ketua"];
const AMBIL = { credentials: "include" as const, cache: "no-store" as const };
const persen = (x: number | null) => (x === null ? "-" : `${x}%`);
const NAMA_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const namaBulan = (b: string) => {
  const [t, m] = b.split("-");
  const nama = NAMA_BULAN[Number(m) - 1];
  return nama ? `${nama} ${t}` : b;
};

export function AletaEcourtPengukurDraf() {
  const { currentUser } = usePortal();
  const tambahan = Array.isArray(currentUser?.additionalRoleIds) ? (currentUser.additionalRoleIds as unknown[]).map(String) : [];
  const peran = [String(getEffectiveRoleId(currentUser) ?? ""), String(currentUser?.roleId ?? ""), ...tambahan];
  const boleh = peran.some((p) => PERAN_LIHAT.includes(p));
  const [buka, setBuka] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [proyek, setProyek] = useState<Array<{ id: string; nama: string; memoriAktif: boolean }>>([]);
  const [proyekId, setProyekId] = useState("");
  const [dipilih, setDipilih] = useState<string[]>([]);

  const muat = useCallback(async () => {
    setSibuk(true);
    setGalat("");
    try {
      const jawab = await fetch(apiPath("/api/aleta-ecourt/pengukur-draf"), AMBIL);
      const j = await jawab.json();
      if (!jawab.ok) throw new Error(j?.error?.message || "Kecocokan draf tidak dapat dibaca.");
      setData(j.data as Data);
    } catch (e) {
      setGalat(pesanGalatPortal(e, "Kecocokan draf tidak dapat dimuat."));
    } finally {
      setSibuk(false);
    }
  }, []);

  const kirim = useCallback(async (badan: Record<string, unknown>) => {
    setSibuk(true);
    setGalat("");
    setPesan("");
    try {
      const jawab = await fetch(apiPath("/api/aleta-ecourt/pengukur-draf"), {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(badan),
      });
      const j = await jawab.json();
      if (!jawab.ok) throw new Error(j?.error?.message || "Tindakan gagal.");
      return j.data as Record<string, unknown>;
    } catch (e) {
      setGalat(pesanGalatPortal(e, "Tindakan gagal."));
      return null;
    } finally {
      setSibuk(false);
    }
  }, []);

  if (!boleh) return null;

  const bukaTutup = () => {
    const baru = !buka;
    setBuka(baru);
    if (baru && !data) void muat();
  };

  const ukurSekarang = async () => {
    const h = await kirim({ aksi: "ukur" });
    if (h) {
      await muat();
      setPesan(String(h.pesan ?? "Selesai."));
    }
  };

  const muatProyek = async () => {
    const h = await kirim({ aksi: "proyek" });
    if (h) {
      const daftar = (h.proyek as typeof proyek) ?? [];
      setProyek(daftar);
      if (!h.tersedia) setPesan("Memori proyek ALETA Ai belum tersedia di pemasangan ini. Usulan tetap tersimpan.");
      else if (!daftar.length) setPesan("Belum ada proyek ALETA Ai.");
      else setProyekId(daftar.find((p) => p.memoriAktif)?.id ?? "");
    }
  };

  const teruskan = async () => {
    const h = await kirim({ aksi: "teruskan", proyekId, ids: dipilih });
    if (h) {
      setDipilih([]);
      await muat();
      setPesan(String(h.pesan ?? ""));
    }
  };

  const tolak = async (id: string) => {
    const h = await kirim({ aksi: "tolak", id });
    if (h) await muat();
  };

  const baru = data?.usulan.filter((u) => u.status === "baru") ?? [];

  return (
    <Card id="kecocokan-draf">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Kecocokan draf putusan
          <Badge variant="outline">Otomatis</Badge>
        </CardTitle>
        <CardDescription>
          Setelah putusan diputus, draf pertimbangan dan amar dibandingkan dengan putusan akhir. Yang sering Anda ubah dicatat sebagai bahan perbaikan draf berikutnya.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <Button type="button" variant="outline" size="sm" onClick={bukaTutup} disabled={sibuk && !data}>
          {buka ? "Tutup" : "Lihat kecocokan draf"}
        </Button>
        {galat ? <p className="text-destructive">{galat}</p> : null}
        {pesan ? <p className="text-muted-foreground">{pesan}</p> : null}
        {buka && data ? (
          <div className="space-y-5">
            <p className="text-muted-foreground">
              {data.lingkup === "saya" ? "Perkara majelis Anda" : "Semua hakim"}: {data.jumlahPerkara} putusan terukur
              {data.terakhirDiukur ? `, terakhir diukur ${data.terakhirDiukur.slice(0, 16).replace("T", " ")}` : ""}.
              {data.superAdmin ? (
                <Button type="button" size="sm" className="ml-2" onClick={() => void ukurSekarang()} disabled={sibuk}>
                  Ukur sekarang
                </Button>
              ) : null}
            </p>

            {data.bulanan.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-3">Bulan</th>
                      <th className="pr-3">Putusan</th>
                      <th className="pr-3">Amar</th>
                      <th className="pr-3">Dasar hukum</th>
                      <th className="pr-3">Bagian pertimbangan</th>
                      <th>Alasan cerai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.bulanan.map((b) => (
                      <tr key={b.bulan} className="border-t border-border">
                        <td className="py-1 pr-3">{namaBulan(b.bulan)}</td>
                        <td className="pr-3">{b.perkara}</td>
                        <td className="pr-3">{persen(b.amar)}</td>
                        <td className="pr-3">{persen(b.dasar)}</td>
                        <td className="pr-3">{persen(b.bagian)}</td>
                        <td>{persen(b.huruf)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted-foreground">Belum ada putusan yang terukur. Pengukuran berjalan otomatis setelah putusan masuk dan tiap malam.</p>
            )}

            {data.tersering.length ? (
              <div className="space-y-1">
                <div className="font-medium">Koreksi tersering</div>
                <ul className="space-y-1">
                  {data.tersering.map((k) => (
                    <li key={`${k.jenis}|${k.kunci}`} className="break-words">
                      <span className="text-muted-foreground">{LABEL_JENIS_KOREKSI[k.jenis as JenisKoreksi] ?? k.jenis}:</span> {k.ringkas}{" "}
                      <span className="text-muted-foreground">
                        ({k.perkara} dari {k.dari} putusan)
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {data.perHakim.length ? (
              <div className="overflow-x-auto">
                <div className="mb-1 font-medium">Per hakim (ketua majelis)</div>
                <table className="w-full text-left">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-3">Hakim</th>
                      <th className="pr-3">Putusan</th>
                      <th className="pr-3">Amar</th>
                      <th className="pr-3">Dasar hukum</th>
                      <th>Bagian</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.perHakim.map((h) => (
                      <tr key={h.hakim} className="border-t border-border">
                        <td className="py-1 pr-3">{h.hakim}</td>
                        <td className="pr-3">{h.perkara}</td>
                        <td className="pr-3">{persen(h.amar)}</td>
                        <td className="pr-3">{persen(h.dasar)}</td>
                        <td>{persen(h.bagian)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {data.superAdmin ? (
              <div className="space-y-2">
                <div className="font-medium">Usulan memori ALETA Ai</div>
                <p className="text-muted-foreground">
                  Kebiasaan koreksi yang berulang, ditulis tanpa nama pihak dan tanpa data perkara. Tidak ada yang berlaku sebelum Anda meneruskannya dan menyetujuinya di proyek.
                </p>
                {baru.length ? (
                  <>
                    <ul className="space-y-2">
                      {baru.map((u) => (
                        <li key={u.id} className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-1"
                            aria-label="Pilih usulan"
                            checked={dipilih.includes(u.id)}
                            onChange={(e) => setDipilih((d) => (e.target.checked ? [...d, u.id] : d.filter((x) => x !== u.id)))}
                          />
                          <span className="min-w-0 flex-1 break-words">
                            {u.teks}{" "}
                            <span className="text-muted-foreground">
                              ({u.perkara} dari {u.dari} putusan)
                            </span>
                          </span>
                          <Button type="button" size="sm" variant="outline" disabled={sibuk} onClick={() => void tolak(u.id)}>
                            Tolak
                          </Button>
                        </li>
                      ))}
                    </ul>
                    <div className="flex flex-wrap items-center gap-2">
                      {proyek.length ? (
                        <NativeSelect className="max-w-xs" value={proyekId} onChange={(e) => setProyekId(e.target.value)} aria-label="Proyek tujuan">
                          <option value="">Pilih proyek tujuan</option>
                          {proyek.map((p) => (
                            <option key={p.id} value={p.id} disabled={!p.memoriAktif}>
                              {p.nama}
                              {p.memoriAktif ? "" : " (memori mati)"}
                            </option>
                          ))}
                        </NativeSelect>
                      ) : (
                        <Button type="button" size="sm" variant="outline" disabled={sibuk} onClick={() => void muatProyek()}>
                          Pilih proyek tujuan
                        </Button>
                      )}
                      <Button type="button" size="sm" disabled={sibuk || !proyekId || !dipilih.length} onClick={() => void teruskan()}>
                        Teruskan {dipilih.length ? `(${dipilih.length}) ` : ""}ke memori proyek
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">Belum ada usulan baru.</p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
