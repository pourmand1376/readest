FROM kong:2.8.1

# Bake the Kong config template into the image so no host bind mounts are needed.
# The entrypoint substitutes $SUPABASE_ANON_KEY and $SUPABASE_SERVICE_KEY at
# container start via: eval "echo \"$(cat ~/temp.yml)\"" > ~/kong.yml
COPY kong.yml /home/kong/temp.yml
