FROM node:20-bookworm-slim

WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    fonts-liberation \
    libnss3 \
    libatk-bridge2.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libgtk-3-0 \
    procps \
    # ========================================================================
    # LibreOffice: SATU-SATUNYA cara ALETA menerbitkan PDF putusan
    # ========================================================================
    #
    # Putusan disusun ABT sebagai RTF. Tidak ada satu pun rute di ABT yang
    # menghasilkan PDF, dan tidak ada pengurai RTF di JavaScript yang dapat
    # dipercaya untuk dokumen pengadilan - tata letak yang bergeser sedikit
    # pun pada putusan berarti dokumen yang beredar berbeda dari yang
    # ditandatangani.
    #
    # Yang dipakai mesin yang SAMA dengan yang sudah dipakai ABT sendiri untuk
    # mengubah docx menjadi rtf pada anonimisasi - lihat convert_putusan di
    # models/abt/Anonimisasi.php, yang memanggil soffice. Hasilnya karena itu
    # sekeluarga dengan hasil ABT, bukan penafsiran kedua.
    #
    # Hanya writer, tanpa paket rekomendasi, dan tanpa Java: ekspor PDF tidak
    # memerlukannya. Tambahannya sekitar 300 MB pada image yang sudah 1 GB
    # karena Chromium - harga yang disebut apa adanya.
    #
    # fonts-liberation sudah terpasang di atas, dan itu penting: ia
    # metrik-sepadan dengan Times New Roman, sehingga jumlah halaman PDF-nya
    # sama dengan RTF-nya.
    libreoffice-writer \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3003
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package*.json ./

RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev --no-audit --no-fund; \
    else \
      npm install --omit=dev --no-audit --no-fund; \
    fi

COPY . .

RUN mkdir -p temp/resources/file/doc/ reports .wwebjs_auth

EXPOSE 3003

CMD ["sh", "-c", "mkdir -p temp/resources/file/doc/ && node app.js"]
