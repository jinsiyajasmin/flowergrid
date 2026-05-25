# Fix Google `redirect_uri_mismatch` (when Console “looks correct”)

## What the server sends (verified live)

Luna sends this to Google:

| Field | Value |
|-------|--------|
| **redirect_uri** | `https://luna.flowergrid.co.uk/api/auth/google/callback` |
| **client_id** | `1029944237902-3uki8e1l0dna4458q9n7umotnk40kq7g.apps.googleusercontent.com` |

If Google still shows `redirect_uri_mismatch`, the URI is **not saved on that exact client ID** in Google Cloud (or the client type is wrong).

## Diagnostic page (works after frontend rebuild)

https://luna.flowergrid.co.uk/google-oauth-setup.html

Or:

```bash
curl -sS https://luna.flowergrid.co.uk/api/auth/google/status
```

## Fix A — Edit the correct OAuth client

1. [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Open client ID **`1029944237902-3uki8e1l0dna4458q9n7umotnk40kq7g`** (search in the list — name may say “Potato App” or “Luna”; **ID must match**)
3. Type must be **Web application**
4. **Authorized redirect URIs** — exactly:

   `https://luna.flowergrid.co.uk/api/auth/google/callback`

5. **Authorized JavaScript origins**:

   `https://luna.flowergrid.co.uk`

6. **Save** → wait **10 minutes** → test in **incognito**

On Google’s error page, click **“see error details”** and compare `redirect_uri=` to the table above.

## Fix B — Create a new Web OAuth client (most reliable)

If Fix A still fails, create a **new** client:

1. Credentials → **Create credentials** → **OAuth client ID**
2. Application type: **Web application**
3. Redirect URI: `https://luna.flowergrid.co.uk/api/auth/google/callback`
4. JavaScript origin: `https://luna.flowergrid.co.uk`
5. Copy **new** Client ID + Secret into **Coolify** (replace old `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`)
6. Set `GOOGLE_CALLBACK_URL=https://luna.flowergrid.co.uk/api/auth/google/callback`
7. **Redeploy** in Coolify (restart container)
8. Add the **new** redirect URI to the **new** client only
9. Test sign-in: https://luna.flowergrid.co.uk/api/auth/google

## Coolify checklist

- [ ] `GOOGLE_CLIENT_ID` matches the client you edited in Google Console
- [ ] `GOOGLE_CLIENT_SECRET` is the secret for **that same** client (not an old one)
- [ ] `GOOGLE_CALLBACK_URL` = `https://luna.flowergrid.co.uk/api/auth/google/callback`
- [ ] Redeploy after any env change
- [ ] Do **not** set `VITE_API_BASE=http://localhost:4000`

## Common mistakes

| Mistake | Result |
|---------|--------|
| Edited a **different** OAuth client than Coolify `GOOGLE_CLIENT_ID` | `redirect_uri_mismatch` |
| Client type is **Desktop** / **Android**, not **Web** | Redirect URIs ignored |
| Redirect URI missing **`/api`** | Mismatch |
| Changed Google Console but **did not click Save** | Mismatch |
| Testing in normal tab with old Google session | Clear cookies / use incognito |
