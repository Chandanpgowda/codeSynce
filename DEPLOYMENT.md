# CodeSynce Deployment Guide

## Best Deployment Option: Railway + Vercel

### Why This Combination?
- **Vercel**: Perfect for Next.js (made by Next.js creators), auto-scaling, HTTPS
- **Railway**: Easy Node.js deployments, supports Socket.IO, MongoDB Atlas integration
- **Cost**: Free tiers available, pay-as-you-go scaling

---

## Step-by-Step Deployment

### 1. Prepare Your Code

#### A. Fix Security Issues (DO THIS FIRST)

**File: `server/index.js`**
- Change CORS from `origin: '*'` to specific origins
- Add rate limiting
- Validate all socket events

**File: `app/editor/[id]/page.tsx`**
- Remove hardcoded localhost fallback
- Use environment variable only

**File: `.env.local`**
- Generate strong NEXTAUTH_SECRET
- Remove any hardcoded credentials

#### B. Create Production Environment Files

Create `.env.production` (gitignored):
```env
# MongoDB
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/codesynce

# NextAuth
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>

# OAuth
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# AI
GOOGLE_API_KEY=your-api-key

# Socket (Railway URL - get after deployment)
NEXT_PUBLIC_SOCKET_URL=https://your-app.up.railway.app
```

### 2. Deploy Socket Server to Railway

#### A. Prepare for Railway
1. Create `railway.toml` in root:
```toml
[build]
builder = "NIXPACKS"

[deploy]
startCommand = "node server/index.js"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 10
```

2. Create `Procfile`:
```
web: node server/index.js
```

#### B. Deploy Steps
1. Push code to GitHub (already done ✓)
2. Go to https://railway.app
3. Sign up with GitHub
4. Click "New Project" → "Deploy from GitHub repo"
5. Select your repository
6. Add environment variables:
   - `MONGODB_URI`
   - `NODE_ENV=production`
   - `PORT=3001`
7. Deploy
8. Copy your Railway URL (e.g., `https://codesynce-socket.up.railway.app`)

### 3. Deploy Next.js to Vercel

#### A. Prepare for Vercel
1. Update `.env.production` with Railway URL:
   ```
   NEXT_PUBLIC_SOCKET_URL=https://codesynce-socket.up.railway.app
   ```

2. Update `next.config.js` for production:
```javascript
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['lh3.googleusercontent.com', 'avatars.githubusercontent.com'],
  },
  // Remove the CORS headers - Vercel handles this
}
```

#### B. Deploy Steps
1. Go to https://vercel.com
2. Sign up with GitHub
3. Click "Import Project" → Select your repo
4. Add environment variables:
   - `MONGODB_URI`
   - `NEXTAUTH_URL=https://your-app.vercel.app`
   - `NEXTAUTH_SECRET`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `EMAIL_HOST`
   - `EMAIL_PORT`
   - `EMAIL_USER`
   - `EMAIL_PASS`
   - `GOOGLE_API_KEY`
   - `NEXT_PUBLIC_SOCKET_URL=https://codesynce-socket.up.railway.app`
5. Deploy
6. Copy your Vercel URL

### 4. Post-Deployment Configuration

#### A. Update Google OAuth
1. Go to Google Cloud Console
2. Update authorized redirect URIs:
   - `https://your-app.vercel.app/api/auth/callback/google`

#### B. Update NextAuth URL
1. Update `NEXTAUTH_URL` in Vercel to match your actual domain

#### C. Update Socket URL
1. Update `NEXT_PUBLIC_SOCKET_URL` in Vercel with your Railway URL

---

## Security Fixes Applied

### 1. Socket Server CORS Restriction
**Before:**
```javascript
cors: { origin: '*', methods: ['GET', 'POST'] }
```

**After:**
```javascript
cors: { 
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://your-app.vercel.app' 
    : 'http://localhost:3000',
  methods: ['GET', 'POST']
}
```

### 2. Remove Hardcoded Localhost
**File: `app/editor/[id]/page.tsx`**
```typescript
// Before
const socket = io('http://localhost:3001');

// After
const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!);
```

### 3. Add Socket Event Validation
```typescript
socket.on('send-message', async (data) => {
  // Validate data
  if (!data.message || !data.projectId || !data.user) {
    return;
  }
  // Process message
});
```

### 4. Generate Strong Secret
```bash
# Generate on Windows
openssl rand -base64 32

# Or use online generator
```

---

## Cost Estimate

### Free Tier (Development/Testing)
- Vercel: Free (Hobby plan)
- Railway: Free ($5 credit/month)
- MongoDB Atlas: Free (M0 cluster)
- **Total: $0/month**

### Production (Small Team)
- Vercel: $20/month (Pro)
- Railway: $5-20/month (based on usage)
- MongoDB Atlas: $9/month (M2 cluster)
- **Total: $34-49/month**

---

## Alternative: Single Server (VPS)

If you prefer single server deployment:

### Option: DigitalOcean Droplet
1. Create $4/month Ubuntu droplet
2. Install Node.js, Nginx
3. Use PM2 to run both processes
4. Configure Nginx reverse proxy
5. **Cost: $4/month + domain**

---

## Testing Checklist

After deployment:
- [ ] Homepage loads
- [ ] Authentication works (Google OAuth, Email OTP)
- [ ] Can create projects
- [ ] Can edit files
- [ ] Chat works
- [ ] AI assistant responds
- [ ] Terminal executes code
- [ ] Multiple users can collaborate
- [ ] Real-time updates work

---

## Troubleshooting

### Socket Connection Fails
1. Check Railway logs
2. Verify `NEXT_PUBLIC_SOCKET_URL` in Vercel
3. Check CORS settings in `server/index.js`

### MongoDB Connection Issues
1. Check MongoDB Atlas IP whitelist
2. Verify connection string
3. Check Railway environment variables

### OAuth Not Working
1. Verify redirect URIs in Google Console
2. Check `NEXTAUTH_URL` matches exactly
3. Ensure `NEXTAUTH_SECRET` is set