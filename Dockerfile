# Użyj pełnego obrazu Node.js zamiast wersji slim
FROM node:18.17.0

# Ustaw katalog roboczy
WORKDIR /app

# Skopiuj package.json i package-lock.json
COPY package*.json ./

# Zainstaluj zależności, w tym aktualizację @grpc/grpc-js
RUN npm install --production && \
    npm install @grpc/grpc-js@latest @google-cloud/vision@latest


# Skopiuj resztę aplikacji
COPY . .

# Zainstaluj poppler-utils
RUN apt-get update && apt-get install -y poppler-utils

# Eksponuj port
EXPOSE 3000

# Ustaw komendę startową
CMD ["npm", "start"]
