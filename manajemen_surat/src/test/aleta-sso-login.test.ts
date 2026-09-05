// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type AletaDatabase, createAletaDatabase } from "@/server/db/client";
import { buildExternalAppLaunchHtml } from "@/server/modules/external-apps/service";
import { createManagedUserInDb, lookupUserForLoginInDb } from "@/server/modules/users/service";
import { encryptCredentialSecret, hashMd5 } from "@/server/shared/security";

/**
 * Dua keluhan nyata yang diperbaiki di sini:
 *
 *   1. Masuk ke ALETA memakai akun SIPP/APS gagal, padahal pegawai lebih hafal
 *      username SIPP-nya daripada username ALETA.
 *   2. Klik kartu SIPP/APS di grid Portal tidak benar-benar masuk ke aplikasi
 *      tujuan - pengguna hanya mendarat lagi di halaman login SIPP.
 *
 * Yang dijaga di bawah ini adalah dua hal itu, plus batasan keamanannya:
 * pelebaran cara menyebut akun TIDAK boleh melebar sampai bisa masuk ke akun
 * orang lain.
 *
 * Catatan: kredensial eksternal disisipkan langsung ke tabel, bukan lewat
 * createManagedUserInDb, karena pg-mem yang dipakai test tidak mendukung
 * SAVEPOINT (transaksi bersarang). PostgreSQL asli mendukungnya.
 */
let db: AletaDatabase | null = null;
let urutan = 0;

beforeEach(async () => {
  db = await createAletaDatabase({ useInMemory: true, seed: true });
});

afterEach(async () => {
  await db?.close();
  db = null;
});

async function buatPegawai(profil: { username: string; nama: string; nip: string }) {
  urutan += 1;
  return createManagedUserInDb(db!, "usr-super", {
    username: profil.username,
    password: "rahasia123",
    email: `${profil.username}@pa.go.id`,
    whatsappNumber: `62812345${String(1000 + urutan)}`,
    name: profil.nama,
    nip: profil.nip,
    positionId: "pos-ketua",
  });
}

async function pasangKredensialSipp(userId: string, username: string, password = "sipp-rahasia") {
  const waktu = new Date().toISOString();
  urutan += 1;
  await db!.prepare(
    `INSERT INTO external_app_credentials (
      id, user_id, app_id, external_username, encrypted_password, password_md5_hash,
      is_enabled, last_verified_status, password_updated_at, created_by, updated_by,
      created_at, updated_at
    ) VALUES (?, ?, 'sipp', ?, ?, ?, 1, 'not_tested', ?, 'usr-super', 'usr-super', ?, ?)`
  ).run(
    `eac-uji-${urutan}`,
    userId,
    username,
    encryptCredentialSecret(password),
    hashMd5(password),
    waktu,
    waktu,
    waktu
  );
}

describe("login ALETA memakai identitas SIPP/APS", () => {
  it("menemukan akun lewat username SIPP walau berbeda dari username ALETA", async () => {
    const pegawai = await buatPegawai({
      username: "dbriantono",
      nama: "DERRY BRIANTONO, S.H.",
      nip: "199401022017121003",
    });
    await pasangKredensialSipp(pegawai.id, "derry briantono");

    const hasil = await lookupUserForLoginInDb(db!, { identifier: "derry briantono" });

    expect(hasil?.id).toBe(pegawai.id);
    expect(hasil?.email).toBe("dbriantono@pa.go.id");
  });

  it("tidak peduli huruf besar/kecil pada username SIPP", async () => {
    const pegawai = await buatPegawai({ username: "dbriantono", nama: "Derry", nip: "199401022017121003" });
    await pasangKredensialSipp(pegawai.id, "derry briantono");

    const hasil = await lookupUserForLoginInDb(db!, { identifier: "  DERRY BRIANTONO  " });
    expect(hasil?.username).toBe("dbriantono");
  });

  it("mendahulukan username ALETA bila keduanya cocok", async () => {
    const utama = await buatPegawai({ username: "dbriantono", nama: "Derry", nip: "199401022017121003" });
    const lain = await buatPegawai({ username: "pegawailain", nama: "Pegawai Lain", nip: "199501022017121004" });
    // Pegawai lain kebetulan memakai "dbriantono" sebagai username SIPP-nya.
    await pasangKredensialSipp(lain.id, "dbriantono");

    const hasil = await lookupUserForLoginInDb(db!, { identifier: "dbriantono" });
    expect(hasil?.id).toBe(utama.id);
  });

  it("menolak bila satu username SIPP menunjuk lebih dari satu akun", async () => {
    // Kalau ambigu, lebih baik gagal daripada mengarahkan orang ke akun
    // rekannya. Password memang tetap diperiksa, tapi identitas yang keliru
    // sudah cukup berbahaya untuk ditolak lebih awal.
    const satu = await buatPegawai({ username: "pegawaisatu", nama: "Satu", nip: "199601022017121005" });
    const dua = await buatPegawai({ username: "pegawaidua", nama: "Dua", nip: "199701022017121006" });
    await pasangKredensialSipp(satu.id, "operator");
    await pasangKredensialSipp(dua.id, "operator");

    await expect(lookupUserForLoginInDb(db!, { identifier: "operator" })).resolves.toBeNull();
  });

  it("username SIPP yang tidak terdaftar tetap ditolak", async () => {
    const pegawai = await buatPegawai({ username: "dbriantono", nama: "Derry", nip: "199401022017121003" });
    await pasangKredensialSipp(pegawai.id, "derry briantono");

    await expect(lookupUserForLoginInDb(db!, { identifier: "orang.luar" })).resolves.toBeNull();
  });

  it("NIP tetap cocok walau ditulis dengan spasi atau titik", async () => {
    const pegawai = await buatPegawai({ username: "dbriantono", nama: "Derry", nip: "199401022017121003" });

    for (const tulisan of ["199401022017121003", "1994 0102 2017 12 1003", "19940102.201712.1003"]) {
      const hasil = await lookupUserForLoginInDb(db!, { identifier: tulisan });
      expect(hasil?.id, `NIP ditulis "${tulisan}"`).toBe(pegawai.id);
    }
  });

  it("angka pendek tidak dianggap NIP", async () => {
    await buatPegawai({ username: "dbriantono", nama: "Derry", nip: "199401022017121003" });
    await expect(lookupUserForLoginInDb(db!, { identifier: "1994" })).resolves.toBeNull();
  });
});

describe("jembatan SSO ke SIPP/APS", () => {
  async function halamanJembatan(usernameSipp = "derry briantono") {
    const pegawai = await buatPegawai({
      username: `sso${urutan + 1}`,
      nama: "DERRY BRIANTONO, S.H.",
      nip: `1994010220171210${String(10 + urutan).slice(-2)}`,
    });
    await pasangKredensialSipp(pegawai.id, usernameSipp);

    return buildExternalAppLaunchHtml(db!, {
      actor: { id: pegawai.id, name: pegawai.name, isActive: true },
      appId: "sipp",
    });
  }

  it("membaca form login aplikasi tujuan, bukan menebak isinya", async () => {
    const html = await halamanJembatan();

    // Inti perbaikan: form login SIPP diambil dulu supaya token CSRF, nama
    // field, dan URL proses yang dipakai adalah milik SIPP sendiri.
    expect(html).toContain("fetch(cfg.actionUrl");
    expect(html).toContain("DOMParser");
    expect(html).toContain("input[type=hidden]");
    expect(html).toContain("input[type=password]");
  });

  it("mengirim lewat prototype agar tidak tertutup input bernama submit", async () => {
    const html = await halamanJembatan();
    expect(html).toContain("HTMLFormElement.prototype.submit.call(form)");
    expect(html).not.toContain("document.forms[0].submit()");
  });

  it("menyediakan jalur cadangan dan tombol manual bila form tidak terbaca", async () => {
    const html = await halamanJembatan();
    expect(html).toContain("function cadangan(");
    expect(html).toContain("Masuk SIPP manual");
  });

  it("berhenti dan memberi tahu bila aplikasi tujuan memakai captcha", async () => {
    const html = await halamanJembatan();
    expect(html).toContain("captcha");
    expect(html).toContain("Silakan masuk manual");
  });

  it("menyamarkan < di konfigurasi agar tag script tidak bisa ditutup lebih awal", async () => {
    const html = await halamanJembatan("</script><img src=x onerror=alert(1)>");

    const potongan = html.slice(html.indexOf("var cfg = "));
    const barisKonfigurasi = potongan.slice(0, potongan.indexOf("\n"));

    expect(barisKonfigurasi).not.toContain("</script>");
    expect(barisKonfigurasi).toContain("\\u003c/script");
    // Nama jahat juga tidak boleh lolos sebagai HTML di bagian mana pun.
    expect(html).not.toContain("<img src=x");
  });

  it("benar-benar membawa token CSRF, nama field, dan URL proses milik SIPP", async () => {
    // Uji perilaku, bukan sekadar isi teks: skrip jembatan dijalankan di jsdom
    // melawan halaman login gaya CodeIgniter yang SEMUA-nya berbeda dari
    // pengaturan panel - nama field, URL proses, plus token CSRF. Inilah
    // kombinasi yang membuat kiriman buta dipantulkan balik ke halaman login.
    const { JSDOM } = await import("jsdom");
    const html = await halamanJembatan("derry briantono");

    const halamanSipp = `<!doctype html><html><body>
      <form action="/SIPP/index.php/login/proses" method="post">
        <input type="hidden" name="sipp_csrf_token" value="tok3n-rahasia" />
        <input type="text" name="nama_user" />
        <input type="password" name="kata_sandi" />
        <button type="submit" name="masuk" value="Login">Login</button>
      </form>
    </body></html>`;

    async function jalankan(muatHalaman: () => Promise<string>) {
      const terkirim: HTMLFormElement[] = [];
      const dom = new JSDOM(html, {
        runScripts: "dangerously",
        url: "http://192.168.10.10/aleta/api/external-apps/sipp/launch",
        beforeParse(window) {
          (window as unknown as { fetch: unknown }).fetch = async () => ({
            ok: true,
            status: 200,
            text: muatHalaman,
          });
          window.HTMLFormElement.prototype.submit = function submit(this: HTMLFormElement) {
            terkirim.push(this);
          };
        },
      });

      // Beri kesempatan rantai promise di dalam skrip untuk selesai.
      for (let i = 0; i < 20; i += 1) await Promise.resolve();
      await new Promise((selesai) => setTimeout(selesai, 20));

      const status = dom.window.document.getElementById("status")?.textContent ?? "";
      const isi = terkirim[0]
        ? Object.fromEntries(
            Array.from(terkirim[0].querySelectorAll("input")).map((input) => [input.name, input.value])
          )
        : null;

      const hasil = { status, isi, aksi: terkirim[0]?.getAttribute("action") ?? "", jumlah: terkirim.length };
      dom.window.close();
      return hasil;
    }

    const normal = await jalankan(async () => halamanSipp);
    expect(normal.jumlah).toBe(1);
    // Token CSRF ikut terbawa - tanpa ini CodeIgniter menolak diam-diam.
    expect(normal.isi?.sipp_csrf_token).toBe("tok3n-rahasia");
    // Nama field diambil dari form SIPP, bukan dari tebakan pengaturan panel.
    expect(normal.isi?.nama_user).toBe("derry briantono");
    expect(normal.isi?.kata_sandi).toBe("sipp-rahasia");
    expect(normal.isi?.username).toBeUndefined();
    // Nama tombol submit ikut, karena sebagian controller memeriksanya.
    expect(normal.isi?.masuk).toBe("Login");
    // URL proses milik SIPP dipakai, bukan URL halaman login.
    expect(normal.aksi).toMatch(/\/SIPP\/index\.php\/login\/proses$/);

    // Halaman tujuan tidak terbaca -> jatuh ke pengaturan panel, bukan diam.
    const gagalBaca = await jalankan(async () => "<html><body>halaman error</body></html>");
    expect(gagalBaca.jumlah).toBe(1);
    expect(gagalBaca.isi?.username).toBe("derry briantono");
    // Halaman tanpa kotak sandi sama sekali dibedakan dari halaman yang punya
    // kotak sandi tetapi formulirnya tidak ketemu. Dulu keduanya dilaporkan
    // sama, dan justru KEADAAN KEDUA-lah yang terjadi pada SIPP - pesan yang
    // sama untuk dua sebab berbeda membuat penyebabnya tidak terlacak.
    expect(gagalBaca.status).toContain("kolom sandi tidak ditemukan");

    // Ada kotak sandi tetapi tidak ada <form> sama sekali -> sebab yang lain,
    // dan disebut dengan namanya sendiri.
    const tanpaForm = await jalankan(async () =>
      '<html><body><input type="password" name="password" /></body></html>'
    );
    expect(tanpaForm.jumlah).toBe(1);
    expect(tanpaForm.status).toContain("form login tidak ditemukan");

    // Ada captcha -> berhenti dan beri tahu, jangan kirim password sia-sia.
    const berCaptcha = await jalankan(async () =>
      halamanSipp.replace("<button", '<input type="text" name="captcha" /><button')
    );
    expect(berCaptcha.jumlah).toBe(0);
    expect(berCaptcha.status).toContain("captcha");
  });

  it("membaca form SIPP yang dibuka di dalam <tbody> - bentuk aslinya", async () => {
    // ========================================================================
    // BENTUK YANG SEBENARNYA DILAYANKAN SIPP
    // ========================================================================
    //
    // Disalin dari http://192.168.10.10/SIPP/login yang berjalan. SIPP membuka
    // <form> LANGSUNG di dalam <tbody>, dengan <tr> di dalam formulir itu.
    //
    // Aturan penataan HTML memindahkan tag <form> keluar dari tabel, sementara
    // kotak isiannya tetap tinggal di dalam sel. Akibatnya:
    //
    //     dokumen.querySelector("form input[type=password]")  -> kosong
    //     isianPassword.form                                  -> kosong
    //
    // padahal formulirnya jelas ada dan alamatnya benar. Dulu keadaan ini
    // disimpulkan sebagai "form login tidak ditemukan", lalu jatuh ke jalur
    // cadangan yang mengirim ke alamat halaman login - dan alamat itu kena
    // pengalihan 302 yang MEMBUANG isian formulirnya. Sandi tidak pernah
    // sampai, tanpa satu pun pesan kesalahan.
    const { JSDOM } = await import("jsdom");
    const html = await halamanJembatan("derry briantono");

    const halamanSippAsli = `<!doctype html><html><body>
      <div id="kotakLogin">
        <table width='100%'>
          <tbody>
            <tr><td align="center"><img src="/SIPP/resources/img/logo-login.png"></td></tr>
            <tr><td colspan="4" align="center"><strong>Sistem Informasi Penelusuran Perkara</strong></td></tr>
        <form action="http://192.168.10.10/SIPP/login/validation_credential" method="post" accept-charset="utf-8" name="login" id="login_frm"><tr><td><small>Username</small><input type="text" name="username" class="login" autofocus="autofocus" /></td></tr><tr><td><small>Password</small><input type="password" name="password" class="login" /><br /><input type="submit" class="tombol7" value="Login" /></td></tr></form>
          </tbody>
        </table>
      </div>
    </body></html>`;

    const terkirim: HTMLFormElement[] = [];
    const dom = new JSDOM(html, {
      runScripts: "dangerously",
      url: "http://192.168.10.10/aleta/api/external-apps/sipp/launch",
      beforeParse(window) {
        (window as unknown as { fetch: unknown }).fetch = async () => ({
          ok: true,
          status: 200,
          text: async () => halamanSippAsli,
        });
        window.HTMLFormElement.prototype.submit = function submit(this: HTMLFormElement) {
          terkirim.push(this);
        };
      },
    });

    for (let i = 0; i < 20; i += 1) await Promise.resolve();
    await new Promise((selesai) => setTimeout(selesai, 20));

    const isi = terkirim[0]
      ? Object.fromEntries(
          Array.from(terkirim[0].querySelectorAll("input")).map((input) => [input.name, input.value])
        )
      : null;
    const aksi = terkirim[0]?.getAttribute("action") ?? "";
    const jumlah = terkirim.length;
    dom.window.close();

    expect(jumlah).toBe(1);
    // Dikirim ke alamat PEMERIKSA SANDI milik formulir, bukan ke alamat
    // halaman login pada pengaturan panel.
    expect(aksi).toBe("http://192.168.10.10/SIPP/login/validation_credential");
    expect(aksi).not.toContain("index.php");
    expect(isi?.username).toBe("derry briantono");
    expect(isi?.password).toBe("sipp-rahasia");
  });

  it("menolak akun ALETA yang tidak aktif", async () => {
    const pegawai = await buatPegawai({ username: "nonaktif", nama: "Nonaktif", nip: "199801022017121007" });
    await pasangKredensialSipp(pegawai.id, "nonaktif");

    await expect(
      buildExternalAppLaunchHtml(db!, {
        actor: { id: pegawai.id, name: pegawai.name, isActive: false },
        appId: "sipp",
      })
    ).rejects.toThrow(/tidak aktif/i);
  });
});
