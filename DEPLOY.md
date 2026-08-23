# Deploy — quick config reference

## Render (backend)
- Language: **Python 3** (your screenshot shows it auto-detected Node — change this)
- Root Directory: `backend`
- Add env var `PYTHON_VERSION=3.11.9` in the Render dashboard (this is what actually pins the version — `backend/runtime.txt` alone was not enough; without it Render defaults to 3.14, which has no prebuilt `pydantic-core` wheel and fails to build)
- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Add a **Persistent Disk**, mount path `/data`
- Environment Variables:
  ```
  DATABASE_URL=<your Supabase connection string>
  ALLOWED_ORIGINS=https://<your-vercel-app>.vercel.app
  UPLOAD_DIR=/data/uploads
  CHROMA_PERSIST_DIR=/data/chroma
  MISTRAL_API_KEY=<your key>
  JWT_SECRET=<a long random string>
  CLERK_SECRET_KEY=<your key>
  GOOGLE_CLIENT_ID=<your id>
  GOOGLE_CLIENT_SECRET=<your secret>
  GOOGLE_REDIRECT_URI=https://<your-render-app>.onrender.com/api/auth/google/callback
  ```

## Vercel (frontend)
- Root Directory: leave as repo root (Next.js app is at the root)
- Framework Preset: Next.js (auto-detected)
- Environment Variables:
  ```
  NEXT_PUBLIC_API_URL=https://<your-render-app>.onrender.com
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<your key>
  CLERK_SECRET_KEY=<your key>
  NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
  NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup
  NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
  NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
  ```

## After both are deployed
- Update `GOOGLE_REDIRECT_URI` in the Google Cloud Console OAuth client to match the Render URL above.
- Update Clerk's allowed origins/redirect URLs to your Vercel domain.
