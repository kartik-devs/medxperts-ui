# 🚀 Deploy Now - Quick Fix Guide

## What Was Wrong?

Your backend is running fine on Render at `https://medxperts-backend.onrender.com`, but your frontend was trying to connect to `http://localhost:3001` instead of the production backend URL.

## What We Fixed

✅ Updated all API base URLs to use production backend
✅ Fixed CORS configuration to allow your frontend domain
✅ Updated render.yaml with correct environment variables
✅ Fixed backend PORT to match Render's actual port (10000)
✅ Added proper fallback URLs in all API calls

## Files Changed

1. `Backend/server.js` - Added frontend URL to CORS
2. `render.yaml` - Fixed PORT and added environment variables
3. `.env` - Updated default API URL to production
4. `src/contexts/search-case.js` - Fixed API base URL
5. `src/pages/Dashboard/MCPProgresspage.jsx` - Fixed API base URL
6. `src/components/ReportHistory.jsx` - Fixed API base URL
7. `src/pages/Dashboard/OperationsDashboard.jsx` - Fixed API base URL
8. `vite.config.js` - Added proxy and preview configuration

## Deploy Steps (Choose One)

### Option A: Auto-Deploy via Git (Recommended) ⭐

```bash
# 1. Commit all changes
git add .
git commit -m "Fix frontend-backend connection for production deployment"

# 2. Push to GitHub
git push origin master

# 3. Wait for Render to auto-deploy (5-10 minutes)
# Both services will automatically redeploy
```

### Option B: Manual Environment Variables Update

If you can't push to Git right now, update these in Render Dashboard:

**Backend Service (medxperts-backend):**
1. Go to https://dashboard.render.com
2. Select `medxperts-backend` service
3. Go to "Environment" tab
4. Update/Add these variables:
   - `PORT` = `10000`
   - `FRONTEND_URL` = `https://medxperts-frountend.onrender.com`
5. Click "Save Changes"
6. Service will auto-redeploy

**Frontend Service (medxperts-frountend):**
1. Select `medxperts-frountend` service
2. Go to "Environment" tab
3. Update/Add these variables:
   - `VITE_API_BASE_URL` = `https://medxperts-backend.onrender.com`
   - `FRONTEND_URL` = `https://medxperts-frountend.onrender.com`
4. Click "Save Changes"
5. Service will auto-redeploy

## Test After Deployment

### 1. Test Backend (Should work immediately)
Open in browser:
```
https://medxperts-backend.onrender.com/api/test
```

Expected response:
```json
{
  "message": "API server is running!",
  "timestamp": "2026-01-12T...",
  "env": {
    "hasRegion": true,
    "hasAccessKey": true,
    "hasSecretKey": true
  }
}
```

### 2. Test Frontend
Open in browser:
```
https://medxperts-frountend.onrender.com
```

Should load your application without errors.

### 3. Test Connection
1. Open browser DevTools (F12)
2. Go to Console tab
3. Try searching for a case
4. You should see API calls to `https://medxperts-backend.onrender.com/api/...`
5. No CORS errors should appear

### 4. Use Test Page
Open the test page we created:
```
Open test-connection.html in your browser
```

This will test:
- Backend connectivity
- CORS configuration
- Search API
- Environment setup

## Troubleshooting

### ❌ "Server Offline" or "Cannot connect to backend"

**Solution:**
1. Check backend is running: https://medxperts-backend.onrender.com/api/test
2. Clear browser cache (Ctrl+Shift+Delete)
3. Hard refresh (Ctrl+Shift+R)
4. Check browser console for errors

### ❌ CORS Error in Console

**Solution:**
1. Verify `FRONTEND_URL` is set in backend environment variables
2. Make sure it matches exactly: `https://medxperts-frountend.onrender.com`
3. Redeploy backend after changing CORS settings
4. Wait 30 seconds for service to restart

### ❌ "Access to fetch blocked by CORS policy"

**Solution:**
1. Backend needs to be redeployed with updated CORS settings
2. Check that backend logs show: `🚀 MCP API running on port 10000`
3. Verify frontend URL is in the CORS origin list

### ❌ Backend Returns 404

**Solution:**
1. Check the API endpoint URL is correct
2. Verify backend is deployed and running
3. Check backend logs in Render dashboard

### ❌ Frontend Shows Blank Page

**Solution:**
1. Check browser console for errors
2. Verify all environment variables are set in Render
3. Try rebuilding frontend: Manual Deploy → Clear build cache & deploy

## Important Notes

⚠️ **Free Tier Sleep:** Render free tier services sleep after 15 minutes of inactivity. First request may take 30 seconds to wake up.

⚠️ **URL Typo:** Your frontend URL has "frountend" (not "frontend"). This is intentional to match your actual deployment.

⚠️ **Port Change:** Backend now uses port 10000 (Render's default) instead of 3001.

⚠️ **Environment Variables:** All `VITE_*` variables must be set at build time. If you change them, you must rebuild the frontend.

## Verification Checklist

After deployment, verify:

- [ ] Backend health check returns 200 OK
- [ ] Frontend loads without errors
- [ ] Browser console shows no CORS errors
- [ ] API calls go to production backend URL
- [ ] Search functionality works
- [ ] Report history loads
- [ ] MCP progress page works

## Need Help?

If issues persist:

1. **Check Backend Logs:**
   - Go to Render Dashboard
   - Select backend service
   - Click "Logs" tab
   - Look for errors

2. **Check Frontend Logs:**
   - Go to Render Dashboard
   - Select frontend service
   - Click "Logs" tab
   - Look for build errors

3. **Check Browser Console:**
   - Press F12
   - Go to Console tab
   - Look for red errors
   - Check Network tab for failed requests

## Success Indicators

✅ Backend logs show: `🚀 MCP API running on port 10000`
✅ Frontend loads without errors
✅ API calls succeed in browser Network tab
✅ No CORS errors in console
✅ Search returns results
✅ Report history displays

---

**Ready to deploy?** Run the commands in Option A above! 🚀
