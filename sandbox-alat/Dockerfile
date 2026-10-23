# Sandbox alat bantu ALETA Ai (tahap 3). Lihat pelaksana.py dan docker-compose.yml.
# Pustaka dipasang saat MEMBANGUN (jaringan hanya ada saat build); kontainer
# berjalan tanpa jaringan.
FROM python:3.12-slim
RUN pip install --no-cache-dir python-docx==1.1.2 openpyxl==3.1.5 \
 && useradd --system --uid 10001 --home-dir /nonexistent --shell /usr/sbin/nologin alat
COPY pelaksana.py /opt/sandbox-alat/pelaksana.py
USER 10001
ENV SANDBOX_SPOOL=/spool SANDBOX_SKRIP=/skrip SANDBOX_IZIN=/etc/sandbox-alat/izin.json SANDBOX_KERJA=/tmp
ENTRYPOINT ["python3", "-I", "-B", "/opt/sandbox-alat/pelaksana.py"]
