FROM supabase/postgres:15.8.1.085

# Bake init-scripts into the image so no host bind mounts are needed.
# The supabase/postgres entrypoint runs files in /docker-entrypoint-initdb.d/
# in alphabetical order on first start.
COPY init/schema.sql /docker-entrypoint-initdb.d/init-scripts/100-schema.sql
COPY roles.sql       /docker-entrypoint-initdb.d/init-scripts/99-roles.sql
COPY jwt.sql         /docker-entrypoint-initdb.d/init-scripts/99-jwt.sql

# Migrations run after init-scripts (200+ prefix ensures ordering).
COPY migrations/ /docker-entrypoint-initdb.d/migrations/
