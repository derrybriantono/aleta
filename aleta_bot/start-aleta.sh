#!/bin/bash

cd /var/www/html/aleta_bot

# Set permission
chmod -R 755 /var/www/html/aleta_bot
chmod 644 /var/www/html/aleta_bot/app.js

# Cek apakah container berjalan
if ! docker ps -a --format '{{.Names}}' | grep -q '^aleta-bot-v2-container$'; then
    echo "Container tidak ditemukan. Menjalankan: docker compose up --build -d"
    docker compose up --build -d
else
    echo "Container ditemukan. Menjalankan: docker compose restart"
    docker compose restart
fi

# Tampilkan log
docker logs aleta-bot-v2-container -f
