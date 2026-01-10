# MedXperts Deployment Guide - Render

## Prerequisites
- GitHub account
- Render account (sign up at https://render.com)
- Push your code to GitHub

## Deployment Steps

### 1. Push Code to GitHub
```bash
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

### 2. Deploy on Render

#### Option A: Using render.yaml (Recommended)
1. Go to https://dashboard.render.com
2. Click "New" → "Blueprint"
3. Connect your GitHub repository
4. Render will automatically detect `render.yaml` and create both services
5. Add environment variables in the Render dashboard for each service

#### Option B: Manual Setup

**Backend Service:**
1. Go to Render Dashboard → "New" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - Name: `medxperts-backend`
   - Environment: `Node`
   - Build Command: `npm install`
   - Start Command: `node Backend/server.js`
   - Instance Type: `Free`
4. Add Environment Variables:
   - `NODE_ENV` = `production`
   - `PORT` = `3001`
   - Copy all other variables from your `.env` file

**Frontend Service:**
1. Create another Web Service
2. Configure:
   - Name: `medxperts-frontend`
   - Environment: `Node`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run preview -- --host 0.0.0.0 --port $PORT`
   - Instance Type: `Free`
3. Add Environment Variables:
   - `VITE_API_BASE_URL` = `https://medxperts-backend.onrender.com`
   - Copy all VITE_* and REACT_APP_* variables from your `.env` file

### 3. Environment Variables to Set

**Backend (.env variables):**
- N8N_WEBHOOK_URL_MCP
- N8N_WEBHOOK_URL_LCP
- AWS_REGION
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY

**Frontend (.env variables):**
- VITE_API_BASE_URL (set to your backend URL)
- VITE_N8N_WEBHOOK_URL_MCP
- VITE_N8N_WEBHOOK_URL_LCP
- VITE_AWS_REGION
- VITE_AWS_ACCESS_KEY_ID
- VITE_AWS_SECRET_ACCESS_KEY
- VITE_S3_BUCKET_NAME
- REACT_APP_FIREBASE_API_KEY
- REACT_APP_FIREBASE_AUTH_DOMAIN
- REACT_APP_FIREBASE_PROJECT_ID
- REACT_APP_FIREBASE_STORAGE_BUCKET
- REACT_APP_FIREBASE_MESSAGING_SENDER_ID
- REACT_APP_FIREBASE_APP_ID
- REACT_APP_FIREBASE_MEASUREMENT_ID

### 4. Update CORS After Deployment

Once you get your frontend URL from Render, update the CORS configuration in `Backend/server.js`:
```javascript
const corsOptions = {
  origin: ['https://your-actual-frontend-url.onrender.com'],
  credentials: true
};
```

Then redeploy the backend.

### 5. Verify Deployment

Visit your frontend URL and check:
- Server status should show "Online"
- API calls should work
- Check browser console for any errors

## Important Notes

- **Free tier limitations**: Services may spin down after inactivity (takes ~30s to wake up)
- **Environment variables**: Never commit `.env` file to GitHub
- **CORS**: Make sure to update allowed origins after getting your actual URLs
- **Build time**: First deployment may take 5-10 minutes

## Troubleshooting

**Server shows offline:**
- Check backend logs in Render dashboard
- Verify VITE_API_BASE_URL is set correctly
- Check CORS configuration

**Build fails:**
- Check build logs in Render dashboard
- Verify all dependencies are in package.json
- Check Node version compatibility

**API calls fail:**
- Verify environment variables are set
- Check backend health endpoint: `https://your-backend.onrender.com/api/health`
- Review CORS settings

## URLs After Deployment

- Backend API: `https://medxperts-backend.onrender.com`
- Frontend: `https://medxperts-frontend.onrender.com`
- Health Check: `https://medxperts-backend.onrender.com/api/health`
