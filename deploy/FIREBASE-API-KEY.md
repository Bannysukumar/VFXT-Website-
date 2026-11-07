# Restrict the Firebase web API key (Google Cloud Console)

The web `apiKey` is public by design, but it should be locked down:

1. Open [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials?project=vfxt-a60d6)
2. Open the Browser key used by VFXT (`AIzaSy…`)
3. **Application restrictions** → HTTP referrers:
   - `https://virtualfxtrades.com/*`
   - `https://www.virtualfxtrades.com/*`
   - `http://localhost:5173/*` (dev only; remove in production-only keys)
4. **API restrictions** → Restrict key to:
   - Identity Toolkit API
   - Token Service API
   - Cloud Firestore API (if used from client)
   - Firebase Installations API
   - (optional) Cloud Storage for Firebase API
5. Save, wait a few minutes, then smoke-test login + deposit.

Also enable **Firebase App Check** with **Fraud Defense (reCAPTCHA Enterprise)** in the Firebase console and set  
`VITE_FIREBASE_APPCHECK_SITE_KEY` to the Enterprise site key before rebuilding the site.  
The web client uses `ReCaptchaEnterpriseProvider`. Leave APIs **Unenforced** until the client ships tokens in production; then enforce callables.
