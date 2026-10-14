"use client";

/**
 * "Tautkan semua ke SIPP" (14 Okt 2026) - tab Manajemen Akun untuk Admin.
 *
 * Alurnya: Muat pratinjau (tidak menulis apa pun) -> periksa NAMA GANDA dan
 * baris ragu -> centang -> Terapkan (satu transaksi, tercatat di audit) ->
 * Batalkan per akun bila keliru. Aturan pencocokannya di
 * lib/tautan-akun-sipp.ts; penulisnya server/modules/portal/tautan-semua-sipp.ts.
 * Tidak ada password di layar ini: petugas masuk ALETA dengan username +
 * password SIPP-nya sendiri, dicocokkan ke SIPP saat masuk.
 */

import { useCallback, useMemo, useState } from "react";

import { Link2, LoaderCircle, RefreshCw, Undo2, UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiPath } from "@/lib/base-path";
import { getRoleLabel } from "@/lib/permissions";
import type { BarisTautan, KelompokTautan, PratinjauTautan } from "@/lib/tautan-akun-sipp";
import type { RoleId } from "@/lib/types";

const SEBUT_KELOMPOK: Record<KelompokTautan, { label: string; varian: "success" | "warning" | "danger" | "muted" | "info" | "default" }> = {
  pasti: { label: "Cocok pasti", varian: "success" },
  ganda: { label: "GANDA", varian: "danger" },
  ragu: { label: "Ragu / mirip", varian: "warning" },
  "sipp-nonaktif": { label: "SIPP nonaktif", varian: "muted" },
  "tanpa-padanan": { label: "Tanpa padanan SIPP", varian: "muted" },
  sudah: { label: "Sudah bertaut", varian: "info" },
  dicabut: { label: "Pernah dicabut", varian: "muted" },
  nonaktif: { label: "Akun nonaktif", varian: "muted" },
  "super-admin": { label: "Super Admin", varian: "default" },
};

type Jawaban<T> = { ok?: boolean; data?: T; error?: { message?: string } | string };

async function baca<T>(respons: Response): Promise<T> {
  const isi = (await respons.json().catch(() => null)) as Jawaban<T> | null;
  if (!respons.ok || !isi || isi.ok === false) {
    const pesan = typeof isi?.error === "string" ? isi.error : isi?.error?.message;
    throw new Error(pesan || `ALETA menjawab ${respons.status}.`);
  }
  return isi.data as T;
}

export function TautanSippSemua() {
  const [pratinjau, setPratinjau] = useState<PratinjauTautan | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");
  /** userId -> username SIPP yang dipilih (kosong = tidak dicentang). */
  const [pilihTaut, setPilihTaut] = useState<Record<string, string>>({});
  const [pilihBuat, setPilihBuat] = useState<Record<string, boolean>>({});

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat("");
    try {
      const p = await baca<PratinjauTautan>(
        await fetch(apiPath("/api/users/tautan-sipp-semua"), { credentials: "include", cache: "no-store" })
      );
      setPratinjau(p);
      // Hanya yang PASTI dicentang lebih dulu; ganda/ragu menunggu pilihan admin.
      setPilihTaut(Object.fromEntries(p.baris.filter((b) => b.kelompok === "pasti").map((b) => [b.userId, b.usernameSipp])));
      setPilihBuat(Object.fromEntries(p.sippTanpaAkun.map((s) => [s.username, s.kelompok === "buat"])));
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Pratinjau tidak dapat dimuat.");
    } finally {
      setMemuat(false);
    }
  }, []);

  const jumlahTaut = useMemo(() => Object.values(pilihTaut).filter(Boolean).length, [pilihTaut]);
  const jumlahBuat = useMemo(() => Object.values(pilihBuat).filter(Boolean).length, [pilihBuat]);

  const terapkan = useCallback(async () => {
    if (!pratinjau) return;
    const tautkan = Object.entries(pilihTaut)
      .filter(([, u]) => u)
      .map(([userId, usernameSipp]) => ({ userId, usernameSipp }));
    const buat = Object.entries(pilihBuat)
      .filter(([, v]) => v)
      .map(([u]) => u);
    if (
      !window.confirm(
        `Tautkan ${tautkan.length} akun ALETA ke SIPP dan buat ${buat.length} akun ALETA baru (tanpa password ALETA - masuk dengan password SIPP)?`
      )
    )
      return;
    setMemuat(true);
    setGalat("");
    setPesan("");
    try {
      const hasil = await baca<{ ditautkan: unknown[]; dibuat: unknown[]; ditolak: Array<{ usernameSipp: string; sebab: string }> }>(
        await fetch(apiPath("/api/users/tautan-sipp-semua"), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ aksi: "terapkan", tautkan, buat }),
        })
      );
      setPesan(
        `Ditautkan ${hasil.ditautkan.length}, akun baru ${hasil.dibuat.length}, ditolak ${hasil.ditolak.length}` +
          (hasil.ditolak.length ? `: ${hasil.ditolak.map((d) => `${d.usernameSipp} (${d.sebab})`).join("; ")}` : ".")
      );
      await muat();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Penerapan gagal - tidak ada yang ditulis.");
    } finally {
      setMemuat(false);
    }
  }, [pratinjau, pilihTaut, pilihBuat, muat]);

  const batal = useCallback(
    async (b: BarisTautan) => {
      if (!window.confirm(`Batalkan tautan SIPP "${b.usernameSipp}" untuk ${b.nama}?`)) return;
      setMemuat(true);
      setGalat("");
      try {
        await baca(
          await fetch(apiPath("/api/users/tautan-sipp-semua"), {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ aksi: "batal", userId: b.userId }),
          })
        );
        setPesan(`Tautan ${b.nama} dibatalkan.`);
        await muat();
      } catch (e) {
        setGalat(e instanceof Error ? e.message : "Pembatalan gagal.");
      } finally {
        setMemuat(false);
      }
    },
    [muat]
  );

  const r = pratinjau?.ringkasan;

  return (
    <Card className="border-border/80" data-tautan-sipp-semua="1">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Link2 className="h-5 w-5" /> Tautkan semua ke SIPP
        </CardTitle>
        <CardDescription>
          Setiap petugas masuk ALETA dengan username dan password SIPP-nya sendiri. Password tidak pernah disalin - dicocokkan
          ke SIPP saat masuk. Pratinjau tidak menulis apa pun; hanya yang dicentang yang diterapkan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void muat()} disabled={memuat}>
            {memuat ? <LoaderCircle className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
            {pratinjau ? "Muat ulang pratinjau" : "Muat pratinjau"}
          </Button>
          {pratinjau ? (
            <Button size="sm" onClick={() => void terapkan()} disabled={memuat || jumlahTaut + jumlahBuat === 0}>
              <UserPlus className="mr-1 h-4 w-4" /> Terapkan ({jumlahTaut} tautan, {jumlahBuat} akun baru)
            </Button>
          ) : null}
        </div>
        {galat ? <p className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{galat}</p> : null}
        {pesan ? <p className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">{pesan}</p> : null}

        {r ? (
          <div className="flex flex-wrap gap-2" data-ringkasan-tautan="1">
            <Badge variant="outline">{r.akunAleta} akun ALETA</Badge>
            <Badge variant="info">{r.sudah} sudah bertaut</Badge>
            <Badge variant="success">{r.pasti} cocok pasti</Badge>
            <Badge variant="danger">{r.ganda} ganda</Badge>
            <Badge variant="warning">{r.ragu} ragu</Badge>
            <Badge variant="muted">{r["tanpa-padanan"]} tanpa padanan</Badge>
            <Badge variant="outline">
              {r.akunSipp} akun SIPP ({r.akunSippAktif} aktif)
            </Badge>
            <Badge variant="outline">{r.sippTanpaAkun} petugas SIPP tanpa akun ALETA</Badge>
          </div>
        ) : null}

        {pratinjau && pratinjau.namaGandaSipp.length > 0 ? (
          <div className="rounded-xl border border-rose-300/70 bg-rose-50/60 p-3 dark:bg-rose-950/30" data-nama-ganda-sipp="1">
            <p className="font-semibold">Nama GANDA di SIPP (satu nama dipakai lebih dari satu akun SIPP) - tidak ditautkan otomatis:</p>
            <ul className="mt-1 list-disc pl-5">
              {pratinjau.namaGandaSipp.map((g) => (
                <li key={g.nama}>
                  <strong>{g.nama}</strong>: {g.akun.map((a) => `${a.username} (${a.keadaan})`).join(", ")}
                </li>
              ))}
            </ul>
            {pratinjau.namaGandaAleta.length > 0 ? (
              <p className="mt-2">
                Nama ganda di ALETA:{" "}
                {pratinjau.namaGandaAleta.map((g) => `${g.nama} (${g.akun.map((a) => a.username).join(", ")})`).join("; ")}
              </p>
            ) : null}
          </div>
        ) : null}

        {pratinjau ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b">
                  <th className="p-2">Tautkan</th>
                  <th className="p-2">Akun ALETA</th>
                  <th className="p-2">Keadaan</th>
                  <th className="p-2">Akun SIPP</th>
                  <th className="p-2">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {pratinjau.baris.map((b) => {
                  const boleh = b.kelompok === "pasti" || b.kelompok === "ganda" || b.kelompok === "ragu";
                  const calonAktif = b.calon.filter((c) => c.aktif);
                  const dipilih = pilihTaut[b.userId] ?? "";
                  const bisaBatal = b.kelompok === "sudah" && (b.sumberTautan === "admin-massal" || b.sumberTautan === "admin-massal-baru");
                  return (
                    <tr key={b.userId} className="border-b align-top" data-kelompok-tautan={b.kelompok}>
                      <td className="p-2">
                        {boleh && calonAktif.length > 0 ? (
                          <input
                            type="checkbox"
                            aria-label={`Tautkan ${b.nama}`}
                            checked={Boolean(dipilih)}
                            onChange={(e) =>
                              setPilihTaut((lama) => ({
                                ...lama,
                                [b.userId]: e.target.checked ? (b.kelompok === "pasti" ? b.usernameSipp : dipilih || calonAktif[0].username) : "",
                              }))
                            }
                          />
                        ) : null}
                      </td>
                      <td className="p-2">
                        <div className="font-medium">{b.nama}</div>
                        <div className="text-muted-foreground">
                          {b.usernameAleta} · {getRoleLabel(b.roleId as RoleId)}
                        </div>
                      </td>
                      <td className="p-2">
                        <Badge variant={SEBUT_KELOMPOK[b.kelompok].varian}>{SEBUT_KELOMPOK[b.kelompok].label}</Badge>
                      </td>
                      <td className="p-2">
                        {(b.kelompok === "ganda" || b.kelompok === "ragu") && calonAktif.length > 0 ? (
                          <select
                            className="rounded-md border bg-background px-2 py-1"
                            value={dipilih}
                            onChange={(e) => setPilihTaut((lama) => ({ ...lama, [b.userId]: e.target.value }))}
                          >
                            <option value="">- pilih akun SIPP -</option>
                            {calonAktif.map((c) => (
                              <option key={c.username} value={c.username}>
                                {c.username} - {c.namaLengkap}
                              </option>
                            ))}
                          </select>
                        ) : (
                          b.usernameSipp || "-"
                        )}
                      </td>
                      <td className="p-2">
                        {b.sebab}
                        {b.masalah ? <div className="font-semibold text-rose-700 dark:text-rose-300">{b.masalah}</div> : null}
                        {b.kelompok !== "pasti" && b.kelompok !== "sudah" && b.calon.length > 0 ? (
                          <div className="text-muted-foreground">
                            Calon: {b.calon.map((c) => `${c.username} [${c.keadaan}${c.dasar.length ? `; ${c.dasar.join("+")}` : "; mirip"}]`).join(", ")}
                          </div>
                        ) : null}
                        {bisaBatal ? (
                          <Button variant="outline" size="sm" className="mt-1" onClick={() => void batal(b)} disabled={memuat}>
                            <Undo2 className="mr-1 h-3 w-3" /> Batalkan tautan
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {pratinjau && pratinjau.sippTanpaAkun.length > 0 ? (
          <div className="space-y-2">
            <p className="font-semibold">Petugas SIPP aktif tanpa akun ALETA - dibuatkan akun baru (username = username SIPP, tanpa password ALETA)</p>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b">
                  <th className="p-2">Buat</th>
                  <th className="p-2">Akun SIPP</th>
                  <th className="p-2">Grup SIPP</th>
                  <th className="p-2">Peran diberikan</th>
                  <th className="p-2">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {pratinjau.sippTanpaAkun.map((s) => (
                  <tr key={s.username} className="border-b align-top" data-sipp-tanpa-akun={s.kelompok}>
                    <td className="p-2">
                      {s.kelompok !== "bentrok" ? (
                        <input
                          type="checkbox"
                          aria-label={`Buat akun ${s.username}`}
                          checked={Boolean(pilihBuat[s.username])}
                          onChange={(e) => setPilihBuat((lama) => ({ ...lama, [s.username]: e.target.checked }))}
                        />
                      ) : null}
                    </td>
                    <td className="p-2">
                      <div className="font-medium">{s.namaLengkap || "-"}</div>
                      <div className="text-muted-foreground">{s.username}</div>
                    </td>
                    <td className="p-2">{s.grup.join(", ") || "-"}</td>
                    <td className="p-2">
                      {getRoleLabel(s.usulan.peranAman)}
                      {s.usulan.tinggi ? (
                        <div className="text-amber-700 dark:text-amber-300">
                          Padanan {getRoleLabel(s.usulan.peranPadanan)} - peran tinggi, tetapkan sendiri sesudahnya.
                        </div>
                      ) : null}
                    </td>
                    <td className="p-2">
                      <Badge variant={s.kelompok === "buat" ? "success" : "danger"}>{s.kelompok}</Badge> {s.sebab}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {pratinjau && pratinjau.sippAkunLain.length > 0 ? (
          <div className="text-xs text-muted-foreground">
            Akun SIPP aktif kedua milik pegawai yang sudah punya akun ALETA (tidak dibuatkan akun):{" "}
            {pratinjau.sippAkunLain.map((s) => `${s.username} -> ${s.pemilik.map((p) => p.name).join("/")}`).join("; ")}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
