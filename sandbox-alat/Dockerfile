# Sandbox alat bantu ALETA Ai (tahap 3). Lihat pelaksana.py dan docker-compose.yml.
# Pustaka dipasang saat MEMBANGUN (jaringan hanya ada saat build); kontainer
# BERJALAN tanpa jaringan (network_mode: none).
#   python-docx  : aleta_putusan_docx.py / aleta_sidang_docx.py / aleta_komparasi_docx.py
#   LibreOffice  : konversi .rtf/.pdf (soffice --headless) oleh skrip V4.5
FROM python:3.12-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends libreoffice-writer-nogui fonts-liberation fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/* \
 && pip install --no-cache-dir python-docx==1.1.2 openpyxl==3.1.5 \
 && useradd --system --uid 10001 --home-dir /tmp --shell /usr/sbin/nologin alat
COPY pelaksana.py /opt/sandbox-alat/pelaksana.py
USER 10001
# soffice menulis profil ke HOME; HOME = folder kerja tiap tugas (pelaksana.py), /tmp = tmpfs.
ENV SANDBOX_SPOOL=/spool SANDBOX_SKRIP=/skrip SANDBOX_IZIN=/etc/sandbox-alat/izin.json SANDBOX_KERJA=/tmp HOME=/tmp
ENTRYPOINT ["python3", "-I", "-B", "/opt/sandbox-alat/pelaksana.py"]
