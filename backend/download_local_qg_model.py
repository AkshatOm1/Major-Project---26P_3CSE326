"""One-time download for the offline quiz question-generation model."""

from pathlib import Path
from huggingface_hub import snapshot_download

MODEL_DIR = Path(__file__).parent / "models" / "local_qg"
snapshot_download(
    repo_id="VMware/t5-small-question-generator",
    local_dir=str(MODEL_DIR),
    allow_patterns=[
        "*.json", "*.safetensors", "*.model", "*.txt", "*.py", "*.md",
    ],
)
print(f"Saved offline question model to: {MODEL_DIR}")
