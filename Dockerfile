# --- STAGE 1: build Vite app ---
FROM node:22-alpine AS build

# Katalog roboczy w kontenerze
WORKDIR /app

# Najpierw tylko zależności (lepszy cache)
COPY package*.json ./

# Instalacja zależności
RUN npm install

# 1) build-arg z adresem backendu
ENV VITE_API_BASE_URL=https://cardu-readoo-app.politeriver-f78bbbbd.westeurope.azurecontainerapps.io

# 2) DEBUG – wypisz wartość env w czasie builda
RUN echo ">>> BUILD: VITE_API_BASE_URL=${VITE_API_BASE_URL}"

# Skopiuj resztę projektu
COPY . .

# Zbuduj produkcyjną wersję (Vite -> dist/)
RUN npm run build

# --- STAGE 2: serwowanie przez Nginx ---
FROM nginx:alpine

# Skopiuj zbudowane pliki do katalogu serwowanego przez Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Domyślny port Nginx
EXPOSE 5173

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]