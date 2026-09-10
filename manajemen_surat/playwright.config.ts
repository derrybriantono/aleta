import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  /**
   * ==========================================================================
   * HARUS localhost, BUKAN 127.0.0.1 - DAN INILAH SEBAB E2E BERHENTI JALAN
   * ==========================================================================
   *
   * BETTER_AUTH_URL berbunyi http://localhost:3000. Bagi otentikasi,
   * "localhost" dan "127.0.0.1" adalah ASAL YANG BERBEDA sekalipun keduanya
   * menunjuk mesin yang sama - kuki sesi yang dipasang untuk yang satu tidak
   * pernah terkirim ke yang lain.
   *
   * Akibatnya masuk selalu gagal secara diam: borangnya terisi, tombolnya
   * tertekan, lalu halaman tetap di /login tanpa satu pun pesan salah. Seluruh
   * berkas e2e karena itu berhenti hijau, dan tidak ada yang menyadarinya
   * sebab uji yang tidak pernah dijalankan tidak pernah berbunyi.
   *
   * Kalau BETTER_AUTH_URL kelak diubah, alamat di sini harus ikut.
   */
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3000",
    url: "http://localhost:3000/login",
    // TIDAK memakai peladen yang kebetulan sudah hidup. Peladen itu memakai
    // basis data pengembangan siapa pun yang menyalakannya, dan uji yang
    // isinya bergantung pada isi basis data orang lain bukan uji.
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      /**
       * ======================================================================
       * ALAMAT BASIS DATA YANG SENGAJA TIDAK DAPAT DIJANGKAU
       * ======================================================================
       *
       * Aplikasi jatuh ke basis data DALAM MEMORI beserta semaiannya ketika
       * Postgres tidak terjangkau - lengkap dengan akun uji ketua/ketua123.
       *
       * Tanpa baris ini, uji memakai Postgres pengembangan di 54329 kalau
       * kebetulan menyala. Akun semaian tidak ada di sana, masuk ditolak 401,
       * dan SELURUH berkas e2e gagal pada langkah pertama - persis keadaan
       * yang membuat berkas-berkas ini berhenti dijalankan orang.
       *
       * Nomor porta di bawah dipilih supaya tidak ada yang mendengarkannya.
       * Kalau kelak ada, ujinya akan memakai basis data itu tanpa memberi tahu
       * siapa pun - jadi jangan dipakai untuk apa pun.
       */
      DATABASE_URL: "postgres://uji:uji@127.0.0.1:59999/aleta-uji-e2e",
      /**
       * ======================================================================
       * IZIN CADANGAN HARUS DINYATAKAN - DAN ITU PENJAGAAN YANG BENAR
       * ======================================================================
       *
       * npm run start menyalakan NODE_ENV=production, dan pada keadaan itu
       * cadangan dalam memori SENGAJA dimatikan: peladen sungguhan tidak boleh
       * diam-diam berjalan tanpa basis data, sebab yang diketik petugas ke
       * dalamnya akan lenyap saat container dimulai ulang tanpa seorang pun
       * tahu.
       *
       * Uji ini justru menginginkan basis data yang lenyap - ia harus bersih
       * pada tiap jalan. Karena itu izinnya dinyatakan di sini, di berkas uji,
       * dan tidak pernah di .env mana pun.
       */
      ALETA_ALLOW_IN_MEMORY_FALLBACK: "1",
      /**
       * Cetakan basis data dalam memori DITOLAK. Cetakan yang tertinggal
       * berbulan-bulan membawa sidik sandi lama, sehingga akun semaian ada
       * tetapi tidak dapat dipakai masuk - dan itulah yang membuat seluruh
       * berkas uji ini berhenti hijau tanpa sebab yang terbaca.
       */
      ALETA_TANPA_CETAKAN_INGATAN: "1",
      /**
       * Harus sama persis dengan baseURL di atas. "localhost" dan "127.0.0.1"
       * adalah asal yang berbeda bagi otentikasi, dan kuki sesi yang dipasang
       * untuk yang satu tidak pernah terkirim ke yang lain.
       */
      BETTER_AUTH_URL: "http://localhost:3000",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
