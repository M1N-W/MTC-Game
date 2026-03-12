# run-game

Start a local HTTP server and open the MTC-Game in the default browser.

## Steps

1. **Start a local server** (pick one; prefer first available):
   - `npx --yes serve -l 3000`  
   - or `python -m http.server 3000`  
   - or `npx --yes http-server -p 3000 -c-1`

2. **Open in browser**: Navigate to `http://localhost:3000` (or the port shown by the server). Open `index.html` as the entry point (`http://localhost:3000/` or `http://localhost:3000/index.html`).

3. **Optional**: If the user wants to test the **debug build**, open `http://localhost:3000/Debug.html` after the server is running.

## Notes

- Do **not** use `file://` to open `index.html` — the service worker and some assets may fail under file protocol. Always use a local HTTP server.
- Port **3000** is the default; if it is in use, use another port (e.g. 8080) and tell the user the URL.
- Leave the server running in the background until the user stops it (Ctrl+C in the terminal).

## One-liner (for terminal)

From the project root:

```bash
npx --yes serve -l 3000
```

Then open: http://localhost:3000
