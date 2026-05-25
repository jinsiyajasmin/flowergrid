# Fix Google `redirect_uri_mismatch`

## Google already told you the exact problem

Luna sends `redirect_uri` and `client_id` from environment variables (`GOOGLE_CALLBACK_URL` / production defaults, and `GOOGLE_CLIENT_ID`). **This cannot be fixed in application code** — you must register the redirect URI on **the same OAuth client** as `GOOGLE_CLIENT_ID` in Google Cloud Console.

Help page (uses your configured `GOOGLE_CLIENT_ID`): https://luna.flowergrid.co.uk/api/auth/google/help

Or inspect live values:

```bash
curl -sS https://luna.flowergrid.co.uk/api/auth/google/status
```

Use `clientId`, `callbackUrl`, and `googleConsoleEditUrl` from the JSON.

## Fix in 4 steps

1. Open `/api/auth/google/help` or `googleConsoleEditUrl` from status (or [Credentials](https://console.cloud.google.com/apis/credentials) → find the client matching `GOOGLE_CLIENT_ID`).
2. Confirm type is **Web application** (not Desktop / Android / iOS).
3. Under **Authorized redirect URIs**, add **exactly**:

   ```
   https://luna.flowergrid.co.uk/api/auth/google/callback
   ```

4. Under **Authorized JavaScript origins**, add:

   ```
   https://luna.flowergrid.co.uk
   ```

5. Click **Save** (bottom of page). Wait **10 minutes**. Test in **incognito**.

## Also check OAuth consent screen

[OAuth consent screen](https://console.cloud.google.com/auth/branding) → **Authorized domains** → add `flowergrid.co.uk` if missing.

## Coolify env (must match this client)

```
GOOGLE_CLIENT_ID=<your Web OAuth client ID from Google Console>
GOOGLE_CLIENT_SECRET=<secret for THAT client only>
GOOGLE_CALLBACK_URL=https://luna.flowergrid.co.uk/api/auth/google/callback
```

## Verify Luna + database

```bash
curl -sS https://luna.flowergrid.co.uk/api/health
curl -sS https://luna.flowergrid.co.uk/api/auth/google/status
```

Need `"database":"connected"` for sign-in to complete after Google redirects back.

## Still failing?

Create a **new** Web OAuth client, add the redirect URI above, put the **new** Client ID + Secret in Coolify, redeploy.

Reference: [Google redirect_uri_mismatch docs](https://developers.google.com/identity/protocols/oauth2/web-server#authorization-errors-redirect-uri-mismatch)
