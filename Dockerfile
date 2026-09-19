# ─────────────────────────────────────────────────────────────────────────────
# Sistema Blackphone — imagen de la aplicación (Apache + PHP 8.5)
# ─────────────────────────────────────────────────────────────────────────────
FROM php:8.5-apache

# Extensiones de PHP que necesita Laravel, PostgreSQL, el manejo de imágenes y los PDF
RUN apt-get update && apt-get install -y --no-install-recommends \
        zip unzip git curl \
        libpq-dev libzip-dev libpng-dev libonig-dev \
        libjpeg62-turbo-dev libwebp-dev libfreetype6-dev libexif-dev \
    && docker-php-ext-configure gd --with-jpeg --with-webp --with-freetype \
    && docker-php-ext-install -j"$(nproc)" pdo pdo_pgsql zip gd exif \
    && apt-get purge -y --auto-remove \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Apache sirve desde public/ y deja que Laravel resuelva las rutas
RUN a2enmod rewrite headers \
 && echo 'ServerName localhost' > /etc/apache2/conf-available/servername.conf \
 && a2enconf servername \
 && sed -i 's|DocumentRoot /var/www/html|DocumentRoot /var/www/html/public|g' /etc/apache2/sites-available/000-default.conf \
 && printf '<Directory /var/www/html/public>\n    AllowOverride All\n    Require all granted\n</Directory>\n' >> /etc/apache2/apache2.conf \
 && printf 'ServerTokens Prod\nServerSignature Off\nTraceEnable Off\n' > /etc/apache2/conf-available/endurecer.conf \
 && a2enconf endurecer

# Las dependencias se instalan en la imagen: en macOS el volumen compartido vuelve lentísimo a Composer
COPY src/composer.json src/composer.lock ./
RUN composer install --no-interaction --prefer-dist --optimize-autoloader --no-scripts

# Carpetas que Laravel necesita poder escribir. El código entra por volumen en desarrollo.
RUN mkdir -p bootstrap/cache storage/logs storage/framework/cache storage/framework/sessions storage/framework/views \
    && chown -R www-data:www-data bootstrap/cache storage \
    && chmod -R 775 bootstrap/cache storage

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fsS http://localhost/up || exit 1

EXPOSE 80
