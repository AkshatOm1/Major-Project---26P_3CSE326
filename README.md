# LearnAI Learning Assistant

A React/Vite frontend and Flask backend for study-material uploads, AI-generated notes and quizzes, tutor chat, learner analytics, and EdNet-based knowledge-tracing predictions.

## Requirements

- Node.js and npm
- Python 3.10 or later
- MongoDB (optional at runtime; the backend also keeps a local SQLite cache)
- An OpenRouter API key for online AI features

## Run locally

1. Copy `backend/.env.example` to `backend/.env` and fill in your own secrets and API key. Never commit `backend/.env`.
2. In one terminal:

   ```powershell
   cd backend
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   python app.py
   ```

3. In another terminal:

   ```powershell
   cd frontend
   npm install
   npm run dev
   ```

Open the Vite URL shown in the frontend terminal. The Vite development server proxies `/api` requests to Flask on port 5000.

## Configuration

`backend/.env.example` lists the backend settings. Use a unique random `JWT_SECRET` of at least 32 characters. Online notes, quizzes, and tutor answers require a valid OpenRouter key and internet access. Some local retrieval and EdNet prediction functionality can run without calling the AI provider.

## Notes on model files

The repository includes the small EdNet prediction checkpoint. The larger local question-generation model is intentionally not stored in Git; use `backend/download_local_qg_model.py` if you want to install it locally. User uploads and local database files are also excluded.
