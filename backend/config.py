import os
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"), override=False)

class Config:
    BASE_DIR = BASE_DIR
    PORT = int(os.getenv("PORT", 5000))
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/edtech_db")
    JWT_SECRET = os.getenv("JWT_SECRET", "")
    if len(JWT_SECRET) < 32:
        raise RuntimeError("Set a random JWT_SECRET with at least 32 characters in backend/.env before starting the server.")
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openrouter/free")
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
