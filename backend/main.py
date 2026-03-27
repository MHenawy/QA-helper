from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import os
import random
import shutil
from typing import List, Dict, Any
from scripts.parser import process_file

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_FILE = os.path.join(os.path.dirname(__file__), "questions_db.json")

def load_db():
    if not os.path.exists(DB_FILE):
        return []
    with open(DB_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_db(db_data):
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(db_data, f, ensure_ascii=False, indent=4)

class SectionRequirement(BaseModel):
    topic: str
    type: str
    count: int

class ExamRequest(BaseModel):
    requirements: List[SectionRequirement]

@app.get("/api/topics")
def get_topics():
    db = load_db()
    topics_set = set()
    types_set = set()
    topic_stats = {}
    type_counts = {}
    total_questions = len(db)
    
    for q in db:
        t = q.get("topic", "UNKNOWN")
        ty = q.get("type", "UNKNOWN")
        topics_set.add(t)
        types_set.add(ty)
        
        if t not in topic_stats:
            topic_stats[t] = {"total": 0, "types": {}}
        topic_stats[t]["total"] += 1
        
        if ty not in topic_stats[t]["types"]:
            topic_stats[t]["types"][ty] = 0
        topic_stats[t]["types"][ty] += 1
        
        if ty not in type_counts:
            type_counts[ty] = 0
        type_counts[ty] += 1
        
    return {
        "topics": list(topics_set), 
        "types": list(types_set),
        "stats": {
            "total_questions": total_questions,
            "topic_stats": topic_stats,
            "type_counts": type_counts
        }
    }

@app.get("/api/questions")
def get_questions(topic: str = None):
    db = load_db()
    if topic:
        return [q for q in db if q.get("topic") == topic]
    return db

@app.post("/api/generate")
def generate_exam(request: ExamRequest):
    db = load_db()
    exam_questions = []

    for req in request.requirements:
        # Filter matching questions
        matching = [q for q in db if q.get("topic") == req.topic and q.get("type") == req.type]
        
        if len(matching) < req.count:
            raise HTTPException(status_code=400, detail=f"Not enough questions for topic '{req.topic}' and type '{req.type}'. Requested {req.count}, only {len(matching)} available.")
        
        # Randomly sample
        selected = random.sample(matching, req.count)
        exam_questions.extend(selected)

    return {"status": "success", "exam": exam_questions}

@app.post("/api/upload")
async def upload_file(topic: str, q_type: str, file: UploadFile = File(...)):
    # Save the file temporarily
    temp_file_path = f"temp_{file.filename}"
    with open(temp_file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    try:
        # Parse the file
        new_questions = process_file(temp_file_path)
        
        # Assign user-specified topic and type
        for q in new_questions:
            q['topic'] = topic
            
            final_type = q_type
            if final_type == "AUTO":
                from scripts.parser import guess_question_type
                final_type = guess_question_type(q['text'], default="MCQ")
            elif final_type == "MCQ" and ("TRUE" in q['text'].upper() and "FALSE" in q['text'].upper()):
                final_type = "T/F"
                
            q['type'] = final_type
            q['source_file'] = file.filename
            
        # Append to DB
        db = load_db()
        db.extend(new_questions)
        save_db(db)
        
        os.remove(temp_file_path)
        return {"status": "success", "added_count": len(new_questions)}
    except Exception as e:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
