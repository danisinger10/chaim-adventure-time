# Chaim's Adventure

This project is a single-page interactive story game using Google Gemini and Imagen APIs as well as ElevenLabs for narration.

## Moving API Keys Off the Client

Both `index.html` and `narrator.js` currently contain API keys directly in the client code. For production deployments, move these keys to a secure backend service. A typical approach:

1. **Store keys in environment variables** on your server or secrets manager.
2. **Create lightweight API endpoints** on your backend that proxy requests to Google Gemini/Imagen and ElevenLabs. These endpoints read the API keys from the environment and never expose them to the browser.
3. **Replace direct calls** in the client with `fetch` requests to your backend endpoints. The backend forwards the request to the respective API using the secret keys and returns the response to the frontend.
4. **Use HTTPS and authentication** between the client and server if needed to ensure only authorized users can trigger the API calls.

This keeps your keys safe while still allowing the game to function in the browser.
