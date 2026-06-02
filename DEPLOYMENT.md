# CloudSentinel Deployment Guide

## Environment Configuration (Fix #1)

This application uses environment variables to support both development and production deployments without code changes.

### Backend Setup

1. **Create `.env` file in `backend/` folder:**
   ```bash
   cp backend/.env.example backend/.env
   ```

2. **Edit `backend/.env` and configure:**
   ```env
   # Secret Key for JWT (generate a strong random string)
   SECRET_KEY=your_secret_key_here

   # Mail Configuration (for password reset emails)
   MAIL_USERNAME=your_email@gmail.com
   MAIL_PASSWORD=your_app_password_here
   MAIL_DEFAULT_SENDER=noreply@cloudsentinel.com

   # Database Configuration
   DB_USER=root
   DB_PASSWORD=your_password
   DB_HOST=localhost
   DB_NAME=cloudsentinel_db

   # Frontend URL (CORS) - Change for production
   # Development:
   FRONTEND_URL=http://localhost:5173
   # Production (example):
   # FRONTEND_URL=https://yourdomain.com
   ```

3. **Run backend:**
   ```bash
   cd backend
   python app.py
   ```

### Frontend Setup

1. **Create `.env.local` file in `frontend/` folder (for development):**
   ```bash
   cp frontend/.env.example frontend/.env.local
   ```

2. **For production, create `.env.production`:**
   ```bash
   cp frontend/.env.example frontend/.env.production
   ```

3. **Edit `.env.local` (development):**
   ```env
   VITE_API_URL=http://localhost:5000
   ```

4. **Edit `.env.production` (production - after getting domain):**
   ```env
   VITE_API_URL=https://yourdomain.com
   ```

5. **Run frontend (development):**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

6. **Build for production:**
   ```bash
   npm run build
   ```

---

## Deployment Options

### Option 1: Render.com (Recommended for FYP - FREE)

**Benefits:** Free tier, automatic SSL, subdomain provided, GitHub integration

**Steps:**

1. Push code to GitHub repository
2. Go to [render.com](https://render.com)
3. Create account and connect GitHub
4. Deploy Backend:
   - New Web Service → Select GitHub repo
   - Name: `cloudsentinel-backend`
   - Start Command: `cd backend && pip install -r requirements.txt && python app.py`
   - Environment Variables:
     ```
     FRONTEND_URL=https://cloudsentinel-frontend.onrender.com
     (other .env variables)
     ```
   - Deploy
5. Deploy Frontend:
   - New Static Site → Select GitHub repo
   - Build Command: `cd frontend && npm install && npm run build`
   - Publish Directory: `frontend/dist`
   - Environment Variables:
     ```
     VITE_API_URL=https://cloudsentinel-backend.onrender.com
     ```
   - Deploy

**Result:** 
- Backend: `https://cloudsentinel-backend.onrender.com`
- Frontend: `https://cloudsentinel-frontend.onrender.com`
- **Cost: FREE** ✅

---

### Option 2: AWS Credentials Security (Fix #2)

**Current approach:** Long-term AWS credentials sent via HTTPS

**HTTPS Protection:** When deployed with SSL/TLS, all credentials are encrypted in transit
- Render and most cloud platforms provide FREE SSL certificates
- Data is encrypted end-to-end
- Recommended: Users create separate IAM user with limited permissions (not root keys)

**Add this warning to your UI:**
> ⚠️ Security Notice: Always use temporary AWS credentials or a separate IAM user with limited S3/IAM/EC2 permissions. Never use root account credentials.

---

### Option 3: Custom Linux Server (Advanced)

If deploying on your own server:

1. **Get Domain:** GoDaddy, Namecheap (~$5-15/year)
2. **Get SSL Certificate:** Let's Encrypt (free via Certbot)
3. **Use Nginx + Gunicorn:**
   ```bash
   # Install
   sudo apt-get install nginx gunicorn certbot python3-certbot-nginx
   
   # Generate SSL certificate
   sudo certbot certonly --standalone -d yourdomain.com
   
   # Configure Nginx to proxy Flask
   ```
4. **Environment Variables:**
   ```
   Backend .env: FRONTEND_URL=https://yourdomain.com
   Frontend .env.production: VITE_API_URL=https://yourdomain.com/api
   ```

---

## Production Checklist

- ✅ Environment variables configured
- ✅ Debug mode OFF (already fixed in app.py)
- ✅ Input validation added
- ✅ TRUNCATE commands removed
- ✅ HTTPS/SSL enabled (via deployment platform)
- ✅ AWS credentials encrypted in transit
- ⏳ AWS credentials warning added to UI (optional)

---

## Quick Deployment (FYP)

**Fastest way to publish on internet:**

1. Create GitHub repo with your code
2. Sign up on Render.com (free)
3. Deploy backend and frontend
4. Done! Your app is live with HTTPS

**Total time: ~15 minutes**
**Total cost: FREE**

---

## Troubleshooting

**Frontend can't connect to backend:**
- Check `VITE_API_URL` matches backend URL
- Check backend `FRONTEND_URL` matches frontend URL
- Ensure both are using HTTPS or both HTTP

**CORS errors:**
- Verify `FRONTEND_URL` in backend `.env` matches where frontend is deployed
- Example: If frontend is at `https://my-frontend.onrender.com`, then `FRONTEND_URL=https://my-frontend.onrender.com`

**Env variables not loading:**
- Restart the application
- For Render: redeploy (settings change requires redeploy)
- For local: ensure `.env` and `.env.local` files exist in correct directories

