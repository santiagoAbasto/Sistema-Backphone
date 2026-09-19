#!/bin/sh
set -eu

# El volumen de storage llega vacío la primera vez: las carpetas se rehacen en cada arranque.
mkdir -p \
    bootstrap/cache \
    storage/app/public \
    storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs

chown -R www-data:www-data bootstrap/cache storage

# La cola y el planificador corren como www-data; Apache baja de root a www-data solo.
if [ "${1:-}" = "php" ]; then
    exec gosu www-data "$@"
fi

exec docker-php-entrypoint "$@"
