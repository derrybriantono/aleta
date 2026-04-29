FROM zenika/alpine-chrome:with-puppeteer
WORKDIR /usr/src/app
USER chrome
COPY --chown=chrome:chrome package*.json ./
RUN npm install
COPY --chown=chrome:chrome . .
# Buat direktori yang diperlukan
RUN mkdir -p temp/resources/file/doc/
EXPOSE 3003
CMD ["node", "app.js"]