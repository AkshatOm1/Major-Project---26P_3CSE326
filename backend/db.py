# import chromadb  # disabled temporarily - Phase 4 (RAG) not wired in yet
from pymongo import MongoClient
from sentence_transformers import SentenceTransformer
from config import Config

mongo_client = MongoClient(Config.MONGO_URI)
db = mongo_client.get_database()

# chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection = None  # ChromaDB disabled for tonight - Phase 4 not wired in yet

embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

def get_db():
    return db
