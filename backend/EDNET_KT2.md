# EdNet-KT2 + KT3 model

This trains a Deep Knowledge Tracing (DKT) model to predict a learner's chance of answering a candidate **EdNet question ID** correctly. KT3 is preferred for each student and its explanation/lecture activity actions are encoded into the model; KT2 is used only for students missing from KT3. The variants overlap heavily, so we do not count both files for the same learner.

## Dataset layout

```text
backend/data/ednet/
  KT2/                 # per-student CSV files
  KT3/                 # richer per-student action logs
  content/questions.csv
```

Use `python download_ednet_kt3.py` to fetch the official KT3 archive from the download link documented in the [EdNet repository](https://github.com/riiid/ednet). KT3 is about 763 MB compressed and several GB extracted. The data is under a Creative Commons Attribution-NonCommercial 4.0 license for research use; it cannot be used commercially without separate permission.

## Train

```powershell
.\venv\Scripts\python.exe train_ednet_kt2.py --data-dir data/ednet --max-students 10000 --max-events 600000 --epochs 3 --output-dir models/ednet_kt23
```

The trainer keeps one sequence per student, splits students (80/10/10), and reports train and validation loss. It saves `model.pt` and metadata, including the KT2/KT3 student counts and activity features. The API automatically prefers `models/ednet_kt23` when present and otherwise uses the existing KT2 checkpoint.

## Predict

`POST /api/ednet/predict` accepts a learner's EdNet question history and candidate EdNet question IDs:

```json
{
  "history": [
    {"question_id": "q2319", "correct": true},
    {"question_id": "q2320", "correct": false}
  ],
  "candidates": ["q2321", "q2322"]
}
```

This predictor runs locally without an API connection. The current AI-generated quizzes use unrelated question IDs, and the EdNet contents file does not include question wording. Therefore EdNet cannot verify or improve factual accuracy for generated quizzes on subjects such as data mining or operating systems. The online generation prompts instead use the user's saved domain and quiz performance to personalize topic emphasis and difficulty.
