# Usar la imagen oficial ligera de Node.js 20
FROM node:20-slim

# Instalar Chromium y dependencias de sistema requeridas para Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libxss1 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Configurar variables de entorno para que Puppeteer use el Chromium de sistema
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

# Directorio de trabajo
WORKDIR /usr/src/app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias de producción
RUN npm ci --only=production

# Copiar el resto del código fuente del backend
COPY . .

# Exponer el puerto por el que escucha Express (3000 por defecto)
EXPOSE 3000

# Comando de arranque del servidor
CMD [ "node", "index.js" ]
