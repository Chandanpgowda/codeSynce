# 🚀 How to Deploy CodeSynce - Super Simple Guide

## What is Deployment?
Deployment means putting your website on the internet so everyone can access it.

---

## What You Need:
- Your code is already on GitHub ✅
- We'll use two services: **Vercel** (for website) and **Railway** (for chat server)

---

## PART 1: Deploy Chat Server (Socket Server) to Railway

### Step 1.1: Create Railway Account
1. Open your browser (Chrome, Firefox, etc.)
2. Go to: **https://railway.app**
3. Click **"Sign up"** button (top right corner)
4. Click **"Sign up with GitHub"**
5. Click **"Authorize Railway"** to give permission

**Result:** You now have a Railway account!

---

### Step 1.2: Create New Project
1. You should now see Railway dashboard
2. Look for a button that says **"New Project"** or **"+"** 
3. Click it
4. Select **"Deploy from GitHub repo"**
5. You'll see your GitHub repositories listed
6. Find **"codeSynce"** in the list
7. Click on **"codeSynce"**
8. Click **"Deploy Now"** button

**Result:** Railway starts deploying your code. This takes 2-3 minutes.

---

### Step 1.3: Wait for Deployment
- You'll see logs/scrolls of text
- This is normal - Railway is building your project
- When you see **"Build successful"** or a green checkmark ✅, it's done!

**Important:** Don't close the page until it's finished.

---

### Step 1.4: Copy Your Railway URL
1. Look at the top of your Railway project page
2. You'll see a URL like: `https://codesynce-production.up.railway.app`
3. **COPY THIS URL** - write it down somewhere safe!

---

### Step 1.5: Add Settings to Railway
1. In Railway, click **"Variables"** tab (left side menu)
2. You'll see an empty list or some variables
3. Click **"+ New Variable"** button
4. Add these variables one by one:

**Variable 1:**
- Name: `MONGODB_URI`
- Value: `mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?appName=Cluster0`
- Click **"Add"** or **"Save"**

**Variable 2:**
- Name: `NODE_ENV`
- Value: `production`
- Click **"Add"**

**Variable 3:**
- Name: `PORT`
- Value: `3001`
- Click **"Add"**

**Variable 4:**
- Name: `SOCKET_CORS_ORIGIN`
- Value: `http://localhost:3000` (we'll change this later)
- Click **"Add"**

**Variable 5:**
- Name: `NEXTAUTH_SECRET`
- Value: `dev-secret-key-change-this-in-production-1234567890`
- Click **"Add"**

5. After adding all variables, click **"Deployments"** tab
6. Click **"Redeploy"** button
7. Wait 1-2 minutes

**Result:** Railway is now configured with your settings!

---

## PART 2: Deploy Website to Vercel

### Step 2.1: Create Vercel Account
1. Open a **NEW** browser tab
2. Go to: **https://vercel.com**
3. Click **"Sign up"** (top right)
4. Click **"Continue with GitHub"**
5. Click **"Authorize Vercel"**

**Result:** You now have a Vercel account!

---

### Step 2.2: Import Your Project
1. You should see Vercel dashboard
2. Click **"Import Third-Party Project"** or **"Add New..."** button
3. You'll see your GitHub repositories
4. Find **"codeSynce"**
5. Click **"Import"** next to it

---

### Step 2.3: Configure Project
You'll see a configuration page. Most things are already filled in!

1. **Framework Preset:** Should say "Next.js" ✅
2. **Root Directory:** Leave as `.` or `./`
3. **Build Command:** `next build` (already filled)
4. **Output Directory:** `.next` (already filled)

Scroll down to **"Environment Variables"** section:

---

### Step 2.4: Add Environment Variables to Vercel

Click **"Add"** button for each variable:

**Variable 1:**
- Key: `MONGODB_URI`
- Value: `mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?appName=Cluster0`

**Variable 2:**
- Key: `NEXTAUTH_URL`
- Value: Leave empty for now (we'll add later)

**Variable 3:**
- Key: `NEXTAUTH_SECRET`
- Value: `your-generated-secret`

**Variable 4:**
- Key: `GOOGLE_CLIENT_ID`
- Value: `your-google-client-id.apps.googleusercontent.com`

**Variable 5:**
- Key: `GOOGLE_CLIENT_SECRET`
- Value: `your-google-client-secret`

**Variable 6:**
- Key: `EMAIL_HOST`
- Value: `smtp.gmail.com`

**Variable 7:**
- Key: `EMAIL_PORT`
- Value: `587`

**Variable 8:**
- Key: `EMAIL_USER`
- Value: `your-email@gmail.com`

**Variable 9:**
- Key: `EMAIL_PASS`
- Value: `your-app-password`

**Variable 10:**
- Key: `GOOGLE_API_KEY`
- Value: `your-google-gemini-api-key`

**Variable 11 (VERY IMPORTANT):**
- Key: `NEXT_PUBLIC_SOCKET_URL`
- Value: Paste your Railway URL from Step 1.4
- Example: `https://codesynce-production.up.railway.app`

---

### Step 2.5: Deploy to Vercel
1. Scroll to the bottom of the page
2. Click **"Deploy"** button
3. Wait 2-3 minutes
4. You'll see a progress bar and logs
5. When complete, you'll see **"Congratulations!"** 🎉

---

### Step 2.6: Copy Your Vercel URL
1. After deployment, you'll see your website URL
2. Example: `https://codesynce.vercel.app`
3. **COPY THIS URL**

---

## PART 3: Connect Everything Together

Now we need to tell Railway about Vercel, and Vercel about itself.

### Step 3.1: Update Railway
1. Go back to Railway (browser tab 1)
2. Click **"Variables"** tab
3. Find `SOCKET_CORS_ORIGIN` variable
4. Click the **pencil icon** (edit)
5. Change the value to your Vercel URL
   - Example: `https://codesynce.vercel.app`
6. Click **"Save"**
7. Go to **"Deployments"** tab
8. Click **"Redeploy"**
9. Wait 1-2 minutes

---

### Step 3.2: Update Vercel
1. Go to Vercel (browser tab 2)
2. Click **"Settings"** tab (top of page)
3. Click **"Environment Variables"** (left menu)
4. Find `NEXTAUTH_URL`
5. Click **"Edit"** (pencil icon)
6. Paste your Vercel URL
   - Example: `https://codesynce.vercel.app`
7. Click **"Save"**
8. Go to **"Deployments"** tab (top)
9. Click the **three dots** (⋯) on the latest deployment
10. Click **"Redeploy"**
11. Wait 2 minutes

---

## PART 4: Update Google OAuth

This allows users to sign in with Google.

### Step 4.1: Open Google Console
1. Go to: **https://console.cloud.google.com**
2. Sign in with your Google account

### Step 4.2: Find Your OAuth Settings
1. Click the **project dropdown** (top left, next to "Google Cloud")
2. Select your project
3. In left menu: **"APIs & Services"** → **"Credentials"**
4. Find your OAuth 2.0 Client ID
5. Click the **pencil icon** to edit

### Step 4.3: Add Your Website URL
1. Scroll down to **"Authorized redirect URIs"**
2. Click **"+ ADD URI"**
3. Paste this (replace with your Vercel URL):
   ```
   https://codesynce.vercel.app/api/auth/callback/google
   ```
4. Click **"SAVE"** button

---

## PART 5: Test Your Live Website!

### Step 5.1: Open Your Website
1. Go to your Vercel URL
   - Example: `https://codesynce.vercel.app`
2. You should see your CodeSynce homepage!

### Step 5.2: Test Everything
Try these features:
- ✅ Sign in with Google
- ✅ Create a new project
- ✅ Open a project
- ✅ Edit code
- ✅ Send chat messages
- ✅ Try AI assistant
- ✅ Check if terminal works

---

## 🎉 YOU DID IT!

Your website is now LIVE on the internet!

---

## Common Problems & Solutions

### Problem 0: "DEPLOYMENT_NOT_FOUND" (404) on Vercel

**What it means:** You requested a URL for a deployment that doesn't exist -- the deployment was deleted, the URL has a typo, or you're using an old preview URL (every push creates a new preview deployment; the previous one gets cleaned up).

**Solution -- check these in order:**
1. **Use the right URL.** Your production URL is the one you named at import, e.g. `https://codesynce.vercel.app` -- NOT a preview URL like `https://codesynce-abc123xyz.vercel.app`. Preview deployments are temporary and get deleted.
2. **Check the Vercel dashboard.** Open Vercel, go to your project, then the "Deployments" tab. Confirm the deployment exists and is marked "Ready" (not "Error" or "Canceled"). Copy the URL from there -- don't type it by hand.
3. **Update `NEXTAUTH_URL` in Vercel** to the exact production URL. If OAuth or NextAuth redirects to an old URL, you'll land on a deleted deployment.
4. **Be careful bookmarking/sharing.** If someone you shared with hit a stale link, they'll see this error. Use the production domain, not a preview domain.
5. **Re-connect the project if the integration was deleted.** If a GitHub push never triggered a deploy, the Vercel project may have been deleted. Go to Vercel Dashboard, "Add New", then "Project", and import your GitHub repo again.

### Problem 1: "Socket connection failed"
**Solution:**
- Double-check `NEXT_PUBLIC_SOCKET_URL` in Vercel
- Make sure it matches your Railway URL exactly
- Check Railway logs for errors
- **Important:** `NEXT_PUBLIC_*` variables are **baked in at build time**. Changing them in Vercel saves the new value, but you must click **Redeploy** (or make a new commit) for the change to take effect.

### Problem 2: "MongoDB connection error"
**Solution:**
- Verify `MONGODB_URI` is correct in both Railway and Vercel
- Check MongoDB Atlas allows connections from anywhere (or add Railway IPs)

### Problem 3: "Google sign in not working"
**Solution:**
- Verify the redirect URI in Google Console matches your Vercel URL
- Make sure there are no typos
- Check `NEXTAUTH_URL` in Vercel matches your actual URL

### Problem 4: "Page not loading"
**Solution:**
- Check Vercel deployment logs for errors
- Make sure all environment variables are added
- Try redeploying

---

## Need Help?

Tell me which step you're on and what error you see, and I'll help you fix it!

**Start with Step 1.1 and let me know when you complete each step!** 🚀