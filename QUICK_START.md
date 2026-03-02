# Quick Start Guide - Security Configuration

## 🚀 Getting Started (5 minutes)

### Step 1: Copy Environment Configuration
```bash
cp .env.example .env
```

### Step 2: Update Secrets (if needed)
Edit `.env` and replace placeholder values with your own:
```bash
# Generate strong passwords (use one method):
# Linux/Mac:
openssl rand -base64 32

# Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or use online generator: https://randomkeygen.com/
```

### Step 3: Verify .env is in .gitignore
```bash
cat .gitignore | grep ".env"
# Should see: .env
```

### Step 4: Build and Run
```bash
# Build with SSL certificates
docker-compose up --build

# First time setup takes 30-60 seconds (SSL generation)
```

### Step 5: Access Application
```
# HTTPS (note: certificate is self-signed in dev, so browser will warn)
https://localhost

# To bypass certificate warning in browser:
- Click "Advanced" 
- Click "Proceed to localhost (unsafe)" or similar

# Or curl with insecure flag:
curl --insecure https://localhost
```

---

## ✅ Verification Checklist

### Environment Variables
- [ ] `.env` file exists
- [ ] `.env` is in `.gitignore`
- [ ] All required variables are set
- [ ] No secrets in `docker-compose.yml`

### Tokens & Authentication
- [ ] Login works
- [ ] User redirected to dashboard
- [ ] Can make API requests
- [ ] Logout works
- [ ] Redirected to login after logout

### HTTPS & Security
- [ ] HTTPS works on port 443
- [ ] HTTP (port 80) redirects to HTTPS
- [ ] Browser shows certificate warning (expected in dev)
- [ ] Security headers present:
  ```bash
  curl -I https://localhost 2>/dev/null | grep -i "strict-transport-security\|content-security-policy\|x-frame-options"
  ```

### Input Sanitization
- [ ] Form validation works on frontend
- [ ] Can submit wallet top-up form
- [ ] OTP validation works
- [ ] Phone number auto-formats

### Database & Services
- [ ] PostgreSQL running
- [ ] Redis running
- [ ] RabbitMQ running with custom credentials
- [ ] All services healthy:
  ```bash
  docker-compose ps
  # All should show "Up" status
  ```

---

## 🔧 Common Tasks

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f frontend
docker-compose logs -f order-gateway
```

### Reset Everything
```bash
# Remove all containers and volumes
docker-compose down -v

# Rebuild
docker-compose up --build
```

### Access Services
```bash
# Frontend
https://localhost (or http://localhost with redirect)

# Order Gateway
http://localhost:3000

# Identity Provider
http://localhost:3001

# Stock Service
http://localhost:3002

# Kitchen Queue
http://localhost:3003

# Notification Hub
http://localhost:3004

# RabbitMQ Management
http://localhost:15672
# Username: (from .env RABBITMQ_USER)
# Password: (from .env RABBITMQ_PASSWORD)

# pgAdmin
http://localhost:5050
# Email: admin@iut-dhaka.edu
# Password: (from .env PGADMIN_DEFAULT_PASSWORD)
```

### Change Environment Variables
1. Edit `.env`
2. Restart services:
   ```bash
   docker-compose restart
   # Or rebuild if environment affects build:
   docker-compose up --build
   ```

---

## 🐛 Troubleshooting

### HTTPS Certificate Warning
**Expected behavior** - Self-signed certificate in development
- Click "Advanced" → "Proceed"
- Or use `curl --insecure`

### Container Won't Start
```bash
# Check logs
docker-compose logs frontend

# Rebuild
docker-compose down
docker-compose up --build

# Increase timeout
docker-compose up --build --wait-timeout 300
```

### Port Already in Use
```bash
# Change port in docker-compose.yml
# Or kill process using the port

# Linux/Mac:
lsof -i :80        # Find process on port 80
kill -9 <PID>

# Windows:
netstat -ano | findstr :80
taskkill /PID <PID> /F
```

### Can't Connect to Database
```bash
# Check PostgreSQL is running
docker-compose logs postgres

# Check credentials in .env
cat .env | grep POSTGRES

# Reset database
docker-compose exec postgres psql -U admin -d cafeteria -c "SELECT 1"
```

### Login Not Working
```bash
# Check identity-provider logs
docker-compose logs identity-provider

# Verify JWT_SECRET is set
grep JWT_SECRET .env

# Check if backend is returning httpOnly cookies
curl -I -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

---

## 📝 Backend Integration Reminder

### ⚠️ IMPORTANT: Backend Changes Required

If you haven't implemented the backend changes yet:
1. Read [`BACKEND_INTEGRATION.md`](./BACKEND_INTEGRATION.md)
2. Update login endpoints to set httpOnly cookies
3. Add logout endpoint
4. Update auth middleware
5. Enable CORS with credentials
6. Test with curl:
   ```bash
   # Login
   curl -X POST http://localhost:3001/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"user@example.com","password":"password"}' \
     -v
   
   # Should see Set-Cookie header
   # Cookie: iut_token=eyJ...
   ```

---

## 🔐 Security Best Practices

### Do's ✅
- [x] Use strong passwords (16+ characters)
- [x] Keep `.env` local only
- [x] Rotate secrets in production
- [x] Use secrets manager in production
- [x] Validate input on backend
- [x] Use HTTPS in production
- [x] Keep dependencies updated

### Don'ts ❌
- [ ] Don't commit `.env` to git
- [ ] Don't share passwords
- [ ] Don't use default credentials in production
- [ ] Don't disable HTTPS for convenience
- [ ] Don't trust frontend validation alone
- [ ] Don't log sensitive data
- [ ] Don't hardcode secrets

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| **SECURITY.md** | Complete security guide |
| **BACKEND_INTEGRATION.md** | Backend implementation steps |
| **IMPLEMENTATION_SUMMARY.md** | Summary of all changes |
| **README.md** | Original project docs |

---

## 🆘 Need Help?

### Common Issues
1. **"Certificate verification failed"** → Use `--insecure` flag or accept browser warning
2. **"Port already in use"** → Kill existing process or change port
3. **"Unauthorized" on login** → Check backend implementation
4. **"Cannot connect to database"** → Verify PostgreSQL is running

### Getting Logs
```bash
# Frontend errors
docker-compose logs frontend | tail -50

# Backend errors
docker-compose logs order-gateway | tail -50

# All errors
docker-compose logs | grep -i error
```

### Reset Everything
```bash
# Complete reset
docker-compose down -v
rm -rf postgres_data pgadmin_data
docker-compose up --build
```

---

## ✨ You're Good to Go!

Once you've:
1. ✅ Copied `.env`
2. ✅ Updated secrets
3. ✅ Verified HTTPS works
4. ✅ Verified authentication
5. ✅ Implemented backend changes

You have a **production-ready** security setup! 🎉

For production deployment, see the **Production Deployment** section in `SECURITY.md`.

---

**Last Updated**: March 2, 2026
**Quick Start Time**: ~5 minutes
**Status**: ✅ Ready to Use
