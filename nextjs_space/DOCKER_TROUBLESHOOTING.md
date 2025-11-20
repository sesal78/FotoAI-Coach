# Docker Build Troubleshooting Guide

This guide helps resolve common issues when building and deploying the Foto AI Agent with Docker.

## Common Build Errors

### 1. `yarn build` Failed with Exit Code 1

**Error Message:**
```
failed to solve: process "/bin/sh -c yarn build" did not complete successfully: exit code: 1
```

**Solution:**
This has been fixed in the latest version. Make sure you have the latest code:

```bash
git pull origin master
```

The fix includes:
- Setting Next.js `output: 'standalone'` explicitly
- Properly exporting build-time environment variables
- Adding `SKIP_ENV_VALIDATION=1` flag

### 2. Missing .env File

**Error Message:**
```
⚠️  .env file not found. Creating from .env.example...
```

**Solution:**
Create and configure your `.env` file:

```bash
# Copy the example file
cp .env.example .env

# Edit with your configuration
nano .env
```

**Required variables:**
- `POSTGRES_PASSWORD` - Strong database password
- `NEXTAUTH_SECRET` - Generate with: `openssl rand -base64 32`
- `ABACUSAI_API_KEY` - Your Abacus.AI API key
- `SENDGRID_API_KEY` - Your SendGrid API key
- `OPENWEATHERMAP_API_KEY` - Your OpenWeatherMap API key
- `USER_EMAIL` - Your email address

### 3. Prisma Client Generation Failed

**Error Message:**
```
Error: Prisma Client could not be generated
```

**Solution:**
Ensure your `DATABASE_URL` is correctly formatted:

```env
DATABASE_URL=postgresql://foto:your_password@postgres:5432/foto
```

Note: Use `postgres` as the hostname (not `localhost`) inside Docker.

### 4. Port Already in Use

**Error Message:**
```
Error starting userland proxy: listen tcp 0.0.0.0:3000: bind: address already in use
```

**Solution:**
Stop any service using port 3000:

```bash
# Find the process
sudo lsof -i :3000

# Kill the process (replace PID with actual process ID)
sudo kill -9 PID

# Or change the port in docker-compose.yml
# Change: "3000:3000" to "8080:3000"
```

### 5. Database Connection Failed

**Error Message:**
```
Error: Can't reach database server at `postgres:5432`
```

**Solution:**
Ensure the database container is healthy:

```bash
# Check container status
docker compose ps

# View database logs
docker compose logs postgres

# Restart the database
docker compose restart postgres
```

### 6. Permission Denied for Uploads

**Error Message:**
```
EACCES: permission denied, mkdir '/app/public/uploads'
```

**Solution:**
The Dockerfile creates the uploads directory, but if you're mounting volumes:

```bash
# Create uploads directory with proper permissions
mkdir -p public/uploads/submissions
chmod -R 755 public/uploads
```

## Build Process

### Clean Build

If you're experiencing persistent issues, try a clean build:

```bash
# Stop and remove all containers
docker compose down -v

# Remove all images
docker compose rm -f
docker system prune -a

# Rebuild from scratch
./deploy.sh
```

### View Build Logs

To see detailed build output:

```bash
# Build with verbose output
docker compose build --progress=plain --no-cache

# View specific service logs
docker compose logs app
docker compose logs postgres
```

## Runtime Errors

### Check Application Health

```bash
# Check health endpoint
curl http://localhost:3000/api/health

# Should return:
# {"status":"healthy","timestamp":"...","database":"connected"}
```

### View Application Logs

```bash
# Follow all logs
docker compose logs -f

# Follow app logs only
docker compose logs -f app

# View last 100 lines
docker compose logs --tail=100 app
```

### Database Access

```bash
# Connect to database
docker compose exec postgres psql -U foto -d foto

# Check tables
\dt

# Exit
\q
```

## Environment Variables

### Verify Environment Variables

```bash
# Check which env vars are set in the container
docker compose exec app printenv | grep -E "DATABASE|NEXTAUTH|ABACUSAI"
```

### Missing or Invalid Variables

If API calls are failing:

1. **Check .env file exists:**
   ```bash
   cat .env
   ```

2. **Verify format** (no spaces around `=`):
   ```env
   # ✅ Correct
   API_KEY=abc123
   
   # ❌ Wrong
   API_KEY = abc123
   ```

3. **Restart containers** after .env changes:
   ```bash
   docker compose down
   docker compose up -d
   ```

## Performance Issues

### High Memory Usage

```bash
# Check resource usage
docker stats

# Increase memory limit in docker-compose.yml
services:
  app:
    deploy:
      resources:
        limits:
          memory: 2G
```

### Slow Build Times

```bash
# Use BuildKit for faster builds
export DOCKER_BUILDKIT=1

# Build specific stage
docker compose build --target builder
```

## Network Issues

### Can't Access Application

1. **Check if container is running:**
   ```bash
   docker compose ps
   ```

2. **Check port mapping:**
   ```bash
   docker compose port app 3000
   ```

3. **Check firewall:**
   ```bash
   sudo ufw status
   sudo ufw allow 3000/tcp
   ```

### External API Failures

```bash
# Test connectivity from within container
docker compose exec app curl -I https://api.openweathermap.org
docker compose exec app curl -I https://api.sendgrid.com
```

## Getting Help

### Collect Debug Information

```bash
# System info
docker --version
docker compose version
uname -a

# Container status
docker compose ps
docker compose logs --tail=50

# Disk space
df -h
docker system df
```

### Common Commands

```bash
# Restart everything
docker compose restart

# Rebuild single service
docker compose up -d --build app

# Remove and recreate
docker compose up -d --force-recreate app

# View running processes
docker compose top
```

## Prevention

### Regular Maintenance

```bash
# Backup before major changes
./backup.sh

# Update images
docker compose pull

# Clean unused resources
docker system prune -a --volumes

# Monitor system
./monitor.sh
```

### Best Practices

1. **Always backup before updates**
2. **Use strong passwords** in `.env`
3. **Keep `.env` out of git** (it's in `.gitignore`)
4. **Monitor disk space** regularly
5. **Check logs** after deployments
6. **Test health endpoint** after changes

## Still Having Issues?

1. Check the [Self-Hosting Guide](./SELF_HOSTING_GUIDE.md)
2. Review [GitHub Issues](https://github.com/sesal78/Foto-AI-Agent-DeepAgent/issues)
3. Run `./monitor.sh` for system status
4. Collect logs: `docker compose logs > debug.log`

