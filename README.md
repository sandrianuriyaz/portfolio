# Sandria Portfolio

## Local

```bash
npm run dev
```

Open `http://localhost:3000`.

## Vercel Frontend + Vercel Backend

This project includes Vercel API routes in `api/`, so the backend can run on Vercel too.

Vercel environment variables:

- `OWNER_PIN`
- `BLOB_READ_WRITE_TOKEN`
- Optional: `ALLOWED_ORIGIN`

Use Vercel Blob for uploaded photos and messages. In Vercel, create/connect a Blob store, then redeploy.

## Separate Backend Hosting

If the backend is hosted separately from the frontend, edit `index.html`:

```html
<script>
  window.PORTFOLIO_API_BASE = 'https://your-backend-url.example.com';
</script>
```

Then commit and push again so the Vercel frontend uses the hosted backend.

Local backend messages are saved in `messages.json`; local uploaded images are saved in `uploads/`.
