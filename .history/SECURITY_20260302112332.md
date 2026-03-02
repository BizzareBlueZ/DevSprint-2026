# Security Configuration Guide

## Overview
This document outlines all security improvements made to the IUT Cafeteria system and how to properly configure them for production deployment.

---

## 1. Environment Variables (.env file)

### What Changed
- **Before**: Hardcoded secrets in `docker-compose.yml` (JWT secret, database password, RabbitMQ credentials)
- **After**: All secrets moved to `.env` file which is NOT committed to version control

### Setup Instructions

1. **Copy the example file**:
   ```bash
   cp .env.example .env
   ```

2. **Generate secure secrets**: 
   Replace placeholder values with strong, randomly generated secrets:
   ```bash
   # Generate a secure JWT secret (use one of these methods):
   openssl rand -base64 32      # Linux/Mac
   # Or Node.js:
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Update `.env` with production values**:
   ```env
   JWT_SECRET=<your-secure-jwt-secret-here>
   POSTGRES_PASSWORD=<strong-db-password>
   RABBITMQ_PASSWORD=<strong-rabbitmq-password>
   PGADMIN_DEFAULT_PASSWORD=<strong-password>
   ```

4. **Protect the .env file**:
   ```bash
   chmod 600 .env  # Only owner can read/write
   ```

### Important
- ⚠️ Never commit `.env` to version control
- ⚠️ Use strong, unique passwords (minimum 16 characters)
- ⚠️ In production, use AWS Secrets Manager, Hashicorp Vault, or similar

---

## 2. JWT Token Security

### What Changed
- **Before**: Tokens stored in `sessionStorage` (vulnerable to XSS)
- **After**: Tokens stored in `httpOnly` cookies (cannot be accessed by JavaScript)

### How It Works
1. Backend sets JWT in `httpOnly` cookie after login
2. Cookie is automatically sent with every request (via `withCredentials: true`)
3. Frontend cannot read token (secure against XSS)
4. Token is cleared on logout

### Backend Implementation Required
Your backend must handle this:

```javascript
// Example: Node.js/Express backend
res.cookie('iut_token', jwt, {
  httpOnly: true,      // Cannot be accessed by JavaScript
  secure: true,        // Only HTTPS in production
  sameSite: 'strict',  // CSRF protection
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
  path: '/'
});
```

### Logout Endpoint Required
```javascript
// /api/auth/logout endpoint
res.clearCookie('iut_token', {
  httpOnly: true,
  secure: true,
  sameSite: 'strict'
});
```

---

## 3. Input Sanitization

### What Changed
- **Before**: No frontend input validation (only backend)
- **After**: Frontend input sanitization + backend validation (defense in depth)

### Frontend Sanitization
All user inputs are now sanitized using the utilities in `src/utils/sanitization.js`:

- **Email**: Validates email format
- **Phone**: Removes non-digits, limits to 20 digits
- **Amount**: Ensures positive number, max 1000000
- **OTP**: Validates 4-6 digit format
- **Names**: Only allows letters, spaces, hyphens, apostrophes
- **Text**: Removes HTML tags, escapes special characters

### Usage Example
```javascript
import { sanitizeEmail, sanitizePhoneNumber, sanitizeAmount } from '../utils/sanitization'

const email = sanitizeEmail(userInput)  // Returns false if invalid
const phone = sanitizePhoneNumber(userInput)
const amount = sanitizeAmount(userInput, 10, 100000)
```

### Important
- ⚠️ Frontend sanitization is for UX and basic protection
- ✅ **Always validate on backend** - frontend can be bypassed
- ✅ Use SQL prepared statements to prevent SQL injection
- ✅ Validate all input types, lengths, and formats

---

## 4. HTTPS/TLS Configuration

### What Changed
- **Before**: HTTP only (unencrypted)
- **After**: HTTPS with automatic HTTP → HTTPS redirect

### How It Works
1. Port 80 (HTTP) redirects to port 443 (HTTPS)
2. SSL certificates configured in nginx
3. Modern TLS 1.2 and 1.3 only
4. Strong cipher suites
5. HSTS header forces HTTPS for 1 year

### Development Setup
The Docker image automatically generates self-signed certificates:
```bash
docker-compose up --build
# Certificates generated in: /etc/nginx/ssl/
```

### Production Setup

#### Option 1: Let's Encrypt (Recommended - Free)
```bash
# Create certbot service in docker-compose.yml
certbot:
  image: certbot/certbot
  volumes:
    - ./certs:/etc/letsencrypt
    - ./certbot:/var/www/certbot
  entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
  networks:
    - cafeteria-net
```

#### Option 2: Commercial Certificate
1. Obtain certificate from CA
2. Place in `/etc/nginx/ssl/cert.pem` and `/etc/nginx/ssl/key.pem`
3. Ensure certificate chain is included

### Security Headers
The nginx config includes these security headers:

| Header | Purpose |
|--------|---------|
| `Strict-Transport-Security` | Force HTTPS for 1 year |
| `Content-Security-Policy` | Prevent XSS attacks |
| `X-Content-Type-Options` | Prevent MIME sniffing |
| `X-Frame-Options` | Prevent clickjacking |
| `X-XSS-Protection` | Legacy XSS protection |
| `Referrer-Policy` | Limit referrer info |

---

## 5. RabbitMQ Security

### What Changed
- **Before**: Default credentials (`guest:guest`) in production
- **After**: Unique username and password from `.env`

### Setup Instructions

1. **Update credentials in `.env`**:
   ```env
   RABBITMQ_USER=cafeteria_admin
   RABBITMQ_PASSWORD=<generate-strong-password>
   ```

2. **Update docker-compose.yml** (Already done):
   ```yaml
   rabbitmq:
     environment:
       RABBITMQ_DEFAULT_USER: ${RABBITMQ_USER}
       RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD}
   ```

3. **Update all service configurations**:
   All services that connect to RabbitMQ now use the environment variable:
   ```
   RABBITMQ_URL=amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@rabbitmq:5672
   ```

### Using RabbitMQ
**Management UI** (after startup):
```
URL: http://localhost:15672
Username: cafeteria_admin (or your username)
Password: (as set in .env)
```

### Additional RabbitMQ Security
For production:
1. Change default guest user password
2. Set resource limits per user
3. Enable SSL/TLS for connections
4. Use network isolation (private networks)

---

## 6. Database Security

### Current Configuration
```env
POSTGRES_USER=admin
POSTGRES_PASSWORD=<from .env>
```

### Recommendations for Production
1. Use non-admin database user for application
2. Implement row-level security (RLS)
3. Enable pg_stat_statements for query monitoring
4. Regular backups with encryption
5. Use AWS RDS with automated backups

---

## 7. Additional Security Measures

### Frontend Security
- ✅ Content Security Policy (CSP)
- ✅ X-Frame-Options prevents clickjacking
- ✅ X-XSS-Protection for legacy browsers
- ✅ Input sanitization on all forms
- ✅ httpOnly cookies for tokens

### API Security
- ✅ JWT token validation on all endpoints
- ✅ Rate limiting (implement with Redis)
- ✅ Request validation and sanitization
- ✅ CORS configuration
- ✅ API versioning

### Infrastructure Security
- ✅ Environment-based configuration
- ✅ Secrets not in version control
- ✅ HTTPS enforcement
- ✅ Network isolation (Docker networks)
- ✅ Health checks on all services

---

## 8. Deployment Checklist

Before deploying to production:

- [ ] Generate strong, unique passwords for all services
- [ ] Update `.env` with production values
- [ ] Obtain and install SSL certificate (Let's Encrypt or commercial)
- [ ] Configure database backups
- [ ] Enable database encryption
- [ ] Implement rate limiting on APIs
- [ ] Set up monitoring and logging
- [ ] Configure firewall rules
- [ ] Test HTTPS redirect
- [ ] Verify all headers are present
- [ ] Run security scanning tools (OWASP ZAP, Snyk)
- [ ] Review and audit all dependencies
- [ ] Set up log aggregation
- [ ] Configure alerting for security events

---

## 9. Secrets Management Strategies

### Development
- Use `.env` file locally
- Never commit to git
- Run commands in terminal

### Production (Recommended)
1. **AWS Secrets Manager**
   ```bash
   # Retrieve secrets from AWS
   aws secretsmanager get-secret-value --secret-id cafeteria/prod
   ```

2. **HashiCorp Vault**
   ```bash
   # Authenticate and retrieve secrets
   vault login
   vault read secret/cafeteria/prod
   ```

3. **Kubernetes Secrets**
   ```yaml
   apiVersion: v1
   kind: Secret
   metadata:
     name: cafeteria-secrets
   type: Opaque
   data:
     jwt-secret: <base64-encoded>
     db-password: <base64-encoded>
   ```

---

## 10. References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [Let's Encrypt](https://letsencrypt.org/)

---

**Last Updated**: March 2, 2026
**Maintained By**: Security Team
