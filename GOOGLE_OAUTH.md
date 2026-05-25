# Google OAuth setup (fix redirect_uri_mismatch)

## 1. Find the correct OAuth client in Google Cloud

In Coolify you have `GOOGLE_CLIENT_ID`. After deploy, check which client the server uses:

```bash
curl -sS https://luna.flowergrid.co.uk/api/auth/google/status
```

Note `clientIdSuffix` (last 20 characters). In [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**, open the OAuth 2.0 Client whose **Client ID ends with those same characters**.

`redirect_uri_mismatch` almost always means you edited a **different** OAuth client than the one in Coolify.

## 2. Authorized redirect URIs (must match exactly)

Add **only** these (fix URI 1 — it must include `/api`):

| Environment | Redirect URI |
|-------------|----------------|
| **Production** | `https://luna.flowergrid.co.uk/api/auth/google/callback` |
| **Local dev** | `http://localhost:4000/api/auth/google/callback` |

Remove wrong entries such as:

- `https://luna.flowergrid.co.uk/auth/google/callback` (missing `/api`)
- `http://localhost:4000/auth/google/callback` (missing `/api`)

Click **Save**. Changes can take a few minutes.

## 3. Authorized JavaScript origins

| Environment | Origin |
|-------------|--------|
| **Production** | `https://luna.flowergrid.co.uk` |
| **Local dev** | `http://localhost:5173` |

## 4. Coolify environment variables

```
GOOGLE_CLIENT_ID=<same client as in step 1>
GOOGLE_CLIENT_SECRET=<secret for that client>
GOOGLE_CALLBACK_URL=https://luna.flowergrid.co.uk/api/auth/google/callback
FRONTEND_URL=https://luna.flowergrid.co.uk
```

## 5. How users sign in

Users must start here (not the callback URL):

`https://luna.flowergrid.co.uk/api/auth/google`

The app **Sign up → Continue with Google** button goes to that URL automatically.

## 6. Verify

```bash
curl -sS "https://luna.flowergrid.co.uk/api/auth/google" -D - -o /dev/null | grep -i location
```

The `location` header must contain:

`redirect_uri=https%3A%2F%2Fluna.flowergrid.co.uk%2Fapi%2Fauth%2Fgoogle%2Fcallback`

That decoded URL must appear **verbatim** in Google Console for the same client ID.
