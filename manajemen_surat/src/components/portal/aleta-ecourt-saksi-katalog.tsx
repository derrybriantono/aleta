"use client";

import { useCallback, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/**
 * Katalog saksi - kartu penyunting (rantai C, C4 = U8, 25 Okt 2026).
 *
 * Katalog pertanyaan dan jawaban Susun saksi per jenis perkara disimpan berversi di basis data. Perbaikan kalimat langsung
 * berlaku di ekstensi (tanpa rilis) selama saklar Fitur satker "Katalog saksi dari basis data" menyala; JSON yang tertanam
 * di ekstensi tetap menjadi cadangan. Setiap simpan harus lolos pemeriksa katalog yang sama dengan ekstensi. Versi tidak
 * pernah dihapus: yang berganti hanya versi yang aktif. Hanya Super Admin dan akun penyunting yang terdaftar.
 */

type Ringkasan = {
  kunci: string;
  judul: string;
  versiJson: number;
  sumber: "bawaan" | "basis-data";
  versiDb: number;
  adaBawaan: boolean;
  jumlahVersi: number;
  diubahNama: string;
  diubahAt: string;
};
type Versi = { versi: number; sidik: string; catatan: string; dibuatNama: string; dibuatAt: string; aktif: boolean };
type Pemeriksaan = { ok: boolean; galat: string[]; peringatan: string[]; pratinjau?: { saksi: Array<{ ke: number; baris: Array<{ butir: string; tanya: string; jawab: string }> }> } };

async function minta(alamat: string, opsi?: RequestInit) {
  const r = await fetch(apiPath(alamat), { credentials: "include", cache: "no-store", ...opsi });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message || "Permintaan ditolak.");
  return j.data;
}
const kirim = (aksi: string, isi: Record<string, unknown>) =>
  minta("/api/aleta-ecourt/saksi-katalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aksi, ...isi }) });

export function AletaEcourtSaksiKatalog() {
  const [daftar, setDaftar] = useState<Ringkasan[] | null>(null);
  const [aktif, setAktif] = useState(false);
  const [penyunting, setPenyunting] = useState("");
  const [galat, setGalat] = useState("");
  const [kabar, setKabar] = useState("");
  const [kunci, setKunci] = useState("");
  const [isi, setIsi] = useState("");
  const [dasarVersi, setDasarVersi] = useState(0);
  const [catatan, setCatatan] = useState("");
  const [riwayat, setRiwayat] = useState<Versi[]>([]);
  const [periksa, setPeriksa] = useState<Pemeriksaan | null>(null);
  const [sibuk, setSibuk] = useState(false);

  const jalankan = useCallback(async (kerja: () => Promise<void>) => {
    setSibuk(true);
    setGalat("");
    setKabar("");
    try {
      await kerja();
    } catch (e) {
      setGalat(pesanGalatPortal(e, "Permintaan katalog saksi gagal."));
    } finally {
      setSibuk(false);
    }
  }, []);

  const muatDaftar = useCallback(
    () =>
      jalankan(async () => {
        const d = await minta("/api/aleta-ecourt/saksi-katalog?bagian=daftar");
        setDaftar(d.daftar as Ringkasan[]);
        setAktif(Boolean(d.aktif));
        setPenyunting((d.penyunting as string[]).join(", "));
      }),
    [jalankan]
  );

  const buka = (k: string, versi: number) =>
    jalankan(async () => {
      const d = await minta(`/api/aleta-ecourt/saksi-katalog?bagian=isi&kunci=${encodeURIComponent(k)}&versi=${versi}`);
      setKunci(k);
      setIsi(JSON.stringify(d.isi, null, 2));
      setDasarVersi(versi);
      setPeriksa(null);
      const r = await minta(`/api/aleta-ecourt/saksi-katalog?bagian=riwayat&kunci=${encodeURIComponent(k)}`);
      setRiwayat(r.riwayat as Versi[]);
    });

  const simpan = (aktifkan: boolean) =>
    jalankan(async () => {
      const d = await kirim("simpan", { kunci, isi, catatan, dasarVersi, aktifkan });
      setKabar(`Versi ${d.versi} tersimpan${d.aktif ? " dan aktif" : " (draf, belum aktif)"}.`);
      setCatatan("");
      await buka(kunci, d.versi);
      const l = await minta("/api/aleta-ecourt/saksi-katalog?bagian=daftar");
      setDaftar(l.daftar as Ringkasan[]);
    });

  return (
    <Card id="katalog-saksi">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Katalog saksi
          {daftar ? <Badge variant={aktif ? "success" : "muted"}>{aktif ? "Basis data berlaku" : "Memakai bawaan ekstensi"}</Badge> : null}
        </CardTitle>
        <CardDescription>
          Pertanyaan dan jawaban Susun saksi per jenis perkara, berversi. Perbaikan langsung berlaku di ekstensi tanpa rilis bila saklar &quot;Katalog saksi
          dari basis data&quot; (Fitur satker) menyala; selain itu tetap memakai katalog tertanam. Hanya Super Admin dan penyunting terdaftar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button type="button" variant="outline" size="sm" onClick={() => void muatDaftar()} disabled={sibuk}>
          {sibuk ? "Memuat..." : daftar ? "Segarkan" : "Muat daftar katalog"}
        </Button>
        {galat ? <p className="text-sm text-destructive">{galat}</p> : null}
        {kabar ? <p className="text-sm">{kabar}</p> : null}

        {daftar ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1 pr-3">Katalog</th>
                  <th className="pr-3">Sumber</th>
                  <th className="pr-3">Versi basis data</th>
                  <th className="pr-3">Diubah</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {daftar.map((k) => (
                  <tr key={k.kunci} className="border-t border-border">
                    <td className="py-1 pr-3">
                      <div className="font-medium">{k.judul || k.kunci}</div>
                      <div className="text-xs text-muted-foreground">{k.kunci}</div>
                    </td>
                    <td className="pr-3">{k.sumber === "basis-data" ? "Basis data" : "Bawaan ekstensi"}</td>
                    <td className="pr-3">{k.versiDb || "-"} ({k.jumlahVersi} versi)</td>
                    <td className="pr-3">{k.diubahNama ? `${k.diubahNama}, ${k.diubahAt.slice(0, 10)}` : "-"}</td>
                    <td>
                      <Button type="button" variant="outline" size="sm" disabled={sibuk} onClick={() => void buka(k.kunci, k.versiDb)}>
                        Sunting
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {kunci ? (
          <div className="space-y-3 rounded-md border border-border p-3">
            <div className="text-sm font-medium">
              Menyunting {kunci} (dasar: {dasarVersi ? `versi basis data ${dasarVersi}` : "bawaan ekstensi"})
            </div>
            <Textarea className="font-mono text-xs" rows={18} value={isi} onChange={(e) => setIsi(e.target.value)} spellCheck={false} />
            <Input placeholder="Catatan perubahan (mis. perbaikan kalimat butir q-kenal)" value={catatan} onChange={(e) => setCatatan(e.target.value)} maxLength={500} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" disabled={sibuk} onClick={() => void jalankan(async () => setPeriksa((await kirim("periksa", { kunci, isi })) as Pemeriksaan))}>
                Periksa
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={sibuk} onClick={() => void jalankan(async () => setPeriksa((await kirim("pratinjau", { kunci, isi })) as Pemeriksaan))}>
                Pratinjau
              </Button>
              <Button type="button" size="sm" disabled={sibuk} onClick={() => void simpan(true)}>
                Simpan versi baru dan aktifkan
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={sibuk} onClick={() => void simpan(false)}>
                Simpan sebagai draf
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={sibuk}
                onClick={() =>
                  void jalankan(async () => {
                    await kirim("bawaan", { kunci });
                    setKabar("Kembali memakai katalog bawaan ekstensi (versi tetap tersimpan).");
                    await muatDaftar();
                  })
                }
              >
                Kembali ke bawaan
              </Button>
            </div>
            {periksa ? (
              <div className="space-y-1 text-sm">
                <p className={periksa.ok ? "" : "text-destructive"}>{periksa.ok ? "Lolos pemeriksaan." : "Ditolak:"}</p>
                {periksa.galat.map((g) => (
                  <p key={g} className="text-destructive">- {g}</p>
                ))}
                {periksa.peringatan.slice(0, 8).map((g) => (
                  <p key={g} className="text-muted-foreground">- {g}</p>
                ))}
                {periksa.pratinjau
                  ? periksa.pratinjau.saksi.map((s) => (
                      <div key={s.ke} className="rounded border border-border p-2">
                        <div className="font-medium">Saksi {s.ke} (contoh susunan, isian variabel dibiarkan)</div>
                        {s.baris.slice(0, 12).map((b, i) => (
                          <div key={`${b.butir}-${i}`} className="mt-1">
                            <div className="font-medium">{b.tanya}</div>
                            <div className="text-muted-foreground">{b.jawab}</div>
                          </div>
                        ))}
                      </div>
                    ))
                  : null}
              </div>
            ) : null}
            {riwayat.length ? (
              <div className="space-y-1">
                <div className="text-sm font-medium">Riwayat versi</div>
                {riwayat.map((v) => (
                  <div key={v.versi} className="flex flex-wrap items-center gap-2 text-sm">
                    <span>
                      Versi {v.versi} {v.aktif ? "(aktif)" : ""} - {v.dibuatNama || "?"}, {v.dibuatAt.slice(0, 16).replace("T", " ")} {v.catatan ? `- ${v.catatan}` : ""}
                    </span>
                    <Button type="button" variant="outline" size="sm" disabled={sibuk} onClick={() => void buka(kunci, v.versi)}>
                      Lihat
                    </Button>
                    {!v.aktif ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={sibuk}
                        onClick={() =>
                          void jalankan(async () => {
                            await kirim("aktifkan", { kunci, versi: v.versi });
                            setKabar(`Versi ${v.versi} diaktifkan.`);
                            await muatDaftar();
                            await buka(kunci, v.versi);
                          })
                        }
                      >
                        Aktifkan
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {daftar ? (
          <div className="space-y-1">
            <div className="text-sm font-medium">Akun penyunting tambahan (id pengguna, dipisah koma; Super Admin selalu boleh)</div>
            <div className="flex gap-2">
              <Input value={penyunting} onChange={(e) => setPenyunting(e.target.value)} placeholder="usr-..., usr-..." />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={sibuk}
                onClick={() =>
                  void jalankan(async () => {
                    await kirim("penyunting", { akun: penyunting.split(",").map((x) => x.trim()).filter(Boolean) });
                    setKabar("Daftar penyunting disimpan.");
                  })
                }
              >
                Simpan
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
