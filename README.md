# Sandria Portfolio

## Local

```bash
npm run dev
```

Open `http://localhost:3000`.

## Frontend on Vercel + Backend on Render/Railway

The Vercel deploy is static. Host `server.js` separately on a Node hosting service such as Render or Railway.

Backend settings:

- Start command: `npm start`
- Environment variable: `OWNER_PIN`
- Optional environment variable: `ALLOWED_ORIGIN` set to your Vercel domain

After the backend is deployed, edit `index.html`:

```html
<script>
  window.PORTFOLIO_API_BASE = 'https://your-backend-url.example.com';
</script>
```

Then commit and push again so the Vercel frontend uses the hosted backend.

Messages are saved in `messages.json`; uploaded images are saved in `uploads/`.
