# Online quiz generation

`/api/quiz/generate` uses OpenRouter when `OPENROUTER_API_KEY` is configured,
with `openrouter/free` as its default model. It does not fall back to the local
question model. It never falls back to Gemini; without an OpenRouter key it
returns a clear configuration error.

## API key setup

1. Create an OpenRouter API key at https://openrouter.ai/.
2. Put the key in `backend/.env` as `OPENROUTER_API_KEY=...`. Do not paste the
   key into chat or commit the `.env` file.
3. `OPENROUTER_MODEL=openrouter/free` is the default; restart Flask after
   changing `.env`.

HTTP 403 means the key's project or permissions were denied. HTTP 401 means the
key was rejected. These errors must be corrected in Google AI Studio; changing
local model training will not resolve them.
