FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production
ENV TZ=America/Lima
ENV CHROME_EXECUTABLE=/usr/bin/chromium-browser
ENV CHROME_NO_SANDBOX=true
RUN apk add --no-cache chromium tesseract-ocr tesseract-ocr-data-eng
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY scripts ./scripts
COPY migraciones ./migraciones
USER node
EXPOSE 3000
CMD ["node", "src/server.js"]
