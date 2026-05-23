# Self-Hosting with Docker/Podman with Compose

## Stack

| service         | Image                       | Description                                       |
| --------------- | --------------------------- | ------------------------------------------------- |
| **client**      | `ghcr.io/readest/readest`   | readest frontend                                  |
| **db**          | `supabase/postgres`         | psql db with supabase extensions                  |
| **kong**        | `kong:2.8.1`                | api gateway routing requests to supabase services |
| **auth**        | `supabase/gotrue:v2.185.0`  | auth service (email, JWT)                         |
| **rest**        | `postgrest/postgrest:v14.3` | psql rest api                                     |
| **minio**       | `minio/minio`               | s3 storage                                        |
| **minio-setup** | `minio/mc`                  | helper container to create s3 buckets             |

### Exposed ports

| Port   | Service          |
| ------ | ---------------- |
| `3000` | readest          |
| `8000` | kong API gateway |
| `9000` | MinIO S3 API     |
| `9001` | MinIO console UI |

---

## Running with Docker/Podman Compose

### 1. setup .env

```bash
cp docker/.env.example docker/.env
```

update `docker/.env`:

- update `POSTGRES_PASSWORD` to a strong password (32+ chars)
- update `JWT_SECRET` to a random secret (32+ chars)
- regenerate `ANON_KEY` and `SERVICE_ROLE_KEY` as HS256 JWTs signed with your `JWT_SECRET` (use [jwt.io](https://jwt.io/) or a similar tool):
  - `ANON_KEY` payload: `{"role": "anon"}`
  - `SERVICE_ROLE_KEY` payload: `{"role": "service_role"}`
- set `MINIO_ROOT_PASSWORD` to a strong password

### 2. Start the Stack (pull prebuilt client image)

run from the `docker/` directory:

```bash
cd docker
docker compose up -d
```

this pulls `${READEST_IMAGE}` (default: `ghcr.io/readest/readest:latest`) instead of building the client locally.
the web client now reads `SUPABASE_PUBLIC_URL`, `SUPABASE_ANON_KEY`, `API_BASE_URL`, `OBJECT_STORAGE_TYPE`, `STORAGE_FIXED_QUOTA`, and `TRANSLATION_FIXED_QUOTA` from runtime
container env, so custom self-hosted values work with pulled images.

if you prefer Docker Hub, set `READEST_IMAGE` in `docker/.env`, for example:

```env
READEST_IMAGE=docker.io/your-dockerhub-username/readest:latest
```

replace `your-dockerhub-username` with the Docker Hub namespace that publishes your `readest` image.
for official images, use the namespace configured for this repository's Docker Hub publishing secrets.

published tags:
- `latest`: published from release events
- `<release-tag>` (for example `v1.2.3`): published from release events
- `main`: rolling image from the default branch
- `sha-<commit>`: immutable commit tag

### Build locally instead of pulling

```bash
cd docker
docker compose -f compose.yaml -f compose.build.yaml up --build -d
```

### 3. Access

- Readest app: `http://localhost:3000`
- MinIO console: `http://localhost:9001` (login with `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`)

### Hot Reload (development)

to develop using the compose stack, use local builds (`compose.yaml` + `compose.build.yaml`) and set the build target on `client` to `development-stage` in `compose.build.yaml`, which runs the next.js dev server. to enable hot reload, uncomment the `volumes` block in the `client` service in `compose.yaml`:

```yaml
volumes:
  - ../:/app
  - /app/node_modules
  - /app/apps/readest-app/node_modules
  - /app/apps/readest-app/public/vendor
  - /app/apps/readest-app/.next
  - /app/packages/foliate-js/node_modules
```

the first mount overlays your local repo into the container. the remaining anonymous volumes shadow the directories that were pre-built inside the image, so the container's installed deps and vendor assets are used instead of what's on your host.

### Stop the Stack

```bash
cd docker
docker compose down
```

to also remove volumes (database and storage data):

```bash
cd docker
docker compose down -v
```

---

## Multi-device / LAN access

By default the stack binds all public-facing URLs to `localhost`, which means the app only works from the machine running Docker.  To access Readest from **other browsers or devices on your network** (e.g. a phone, a second PC, or two different browsers on the LAN), you must tell the stack your server's actual IP address.

### 1. Set `HOST_IP`

In `docker/.env`, change `HOST_IP` from `localhost` to your server's LAN IP:

```env
HOST_IP=192.168.1.100   # replace with your actual IP
```

`HOST_IP` controls three things in `compose.yaml`:
| env var | purpose |
|---|---|
| `SUPABASE_PUBLIC_URL` | URL the **browser** uses to reach the Supabase/Kong API (auth, DB) |
| `API_BASE_URL` | URL the **browser** uses to call the Readest sync & API endpoints |
| `S3_PUBLIC_ENDPOINT` | URL the **browser** uses to upload/download book files from MinIO |

### 2. Update auth redirect URLs

`HOST_IP` does **not** automatically update the GoTrue auth URLs, so email confirmation links and OAuth redirects will still point to `localhost` unless you also change these three variables in `docker/.env`:

```env
API_EXTERNAL_URL=http://192.168.1.100:8000
SITE_URL=http://192.168.1.100:3000
ADDITIONAL_REDIRECT_URLS=http://192.168.1.100:3000/**,http://192.168.1.100:8000/**
```

### 3. Restart the stack

```bash
cd docker
docker compose down && docker compose up -d
```

> **Tip:** If you're exposing Readest over the internet via a reverse proxy, replace the IP address with your domain name (e.g. `https://readest.example.com`).

---


```bash
docker build \
  --target production-stage \
  --build-arg NEXT_PUBLIC_APP_PLATFORM=web \
  -t readest-client \
  .
```

run the built image:

```bash
docker run -p 3000:3000 \
  -e SUPABASE_URL=http://host.docker.internal:8000 \
  -e SUPABASE_PUBLIC_URL=http://localhost:8000 \
  -e SUPABASE_ANON_KEY=<anon-key> \
  -e SUPABASE_ADMIN_KEY=<service-role-key> \
  -e API_BASE_URL=http://localhost:3000 \
  -e OBJECT_STORAGE_TYPE=s3 \
  -e S3_ENDPOINT=http://host.docker.internal:9000 \
  -e S3_PUBLIC_ENDPOINT=http://localhost:9000 \
  -e S3_REGION=us-east-1 \
  -e S3_BUCKET_NAME=readest-files \
  -e S3_ACCESS_KEY_ID=<minio-user> \
  -e S3_SECRET_ACCESS_KEY=<minio-password> \
  -e STORAGE_FIXED_QUOTA=1073741824 \
  -e TRANSLATION_FIXED_QUOTA=50000 \
  readest-client
```

on Linux, some Docker setups do not resolve `host.docker.internal` by default.
in that case, either replace it with your host IP or run with:
`--add-host=host.docker.internal:host-gateway`.
