import os
import re
import json
import fitz  # PyMuPDF
from docx import Document

def extract_text_from_pdf(file_path):
    text = ""
    try:
        doc = fitz.open(file_path)
        for page in doc:
            text += page.get_text("text") + "\n"
    except Exception as e:
        print(f"Error reading PDF {file_path}: {e}")
    return text

def extract_text_from_docx(file_path):
    text = ""
    try:
        doc = Document(file_path)
        for para in doc.paragraphs:
            text += para.text + "\n"
    except Exception as e:
        print(f"Error reading DOCX {file_path}: {e}")
    return text

def extract_text_from_txt(file_path):
    text = ""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            text = f.read()
    except Exception as e:
        print(f"Error reading TXT {file_path}: {e}")
    return text

def clean_text(text):
    # Remove BOM if present
    text = text.replace('\ufeff', '')
    
    # Remove Moodle GIFT comments and category
    text = re.sub(r'// question:.*?(?:\n|$)', '', text)
    text = re.sub(r'\$CATEGORY:.*?(?:\n|$)', '', text)
    
    # Remove Moodle HTML tags
    text = re.sub(r'::Q\d+::\[html\]', '', text)
    text = re.sub(r'<[^>]+>', '', text)
    text = text.replace('{}', '')
    
    # Extract answer blocks into a separate field
    parts = re.split(r'(?i)\n\s*-\s*answer:|\n\s*answer:', text)
    question_only = parts[0].strip()
    answer_text = parts[1].strip() if len(parts) > 1 else None
    
    # Normalize excessive whitespaces and newlines
    question_only = re.sub(r'[\r\n]+', '\n', question_only)
    question_only = re.sub(r' {2,}', ' ', question_only)
    
    if answer_text:
        answer_text = re.sub(r'[\r\n]+', '\n', answer_text)
        answer_text = re.sub(r' {2,}', ' ', answer_text)
    
    return question_only, answer_text

def guess_question_type(text, default="MCQ"):
    upper_text = text.upper()
    if "TRUE" in upper_text and "FALSE" in upper_text:
        return "T/F"
    
    # Try to detect MCQ options like A), B), C) or أ), ب), ج) or a., b., c.
    mcq_pattern = r'(?m)^\s*(?:[a-eA-Eأ-ي][\.\-\)]|\[[a-eA-Eأ-ي]\])\s+'
    if re.search(mcq_pattern, text):
        return "MCQ"
        
    essay_keywords = ["اذكر", "اشرح", "بما تفسر", "علل", "عرف", "ما هي", "وضح", "كيفية", "Explain", "Discuss", "Describe"]
    for word in essay_keywords:
        if word in text:
            return "ESSAY"
            
    return default

def parse_questions_from_text(text):
    # This is a heuristic: match numbers followed by a dot, dash, or parenthesis
    # Works for both English (1., 2.) and Arabic (١., ٢.) numerals.
    # We split the text by these markers.
    
    # regex to find start of question e.g. "1.", "1-", "١.", "(1)"
    pattern = r'(?m)^\s*(?:[\d١-٩٠]+[\.\-\)]|\([\d١-٩٠]+\))\s*'
    
    # Split text by the pattern
    parts = re.split(pattern, text)
    
    questions = []
    # parts[0] is usually the header/title before the first question
    for i in range(1, len(parts)):
        raw_q = parts[i].strip()
        cleaned_q, ans_text = clean_text(raw_q)
        if len(cleaned_q) > 5:
            q_dict = {"text": cleaned_q}
            if ans_text:
                q_dict["answer"] = ans_text
            questions.append(q_dict)
            
    # If the regex didn't work well (e.g. no numbered questions), just split by double line breaks
    if len(questions) == 0:
        blocks = re.split(r'\n\s*\n', text)
        for b in blocks:
            raw_b = b.strip()
            cleaned_b, ans_text = clean_text(raw_b)
            if len(cleaned_b) > 10: # arbitrary minimum length for a question
                q_dict = {"text": cleaned_b}
                if ans_text:
                    q_dict["answer"] = ans_text
                questions.append(q_dict)
                
    return questions

def process_file(file_path):
    ext = os.path.splitext(file_path)[1].lower()
    text = ""
    if ext == '.pdf':
        text = extract_text_from_pdf(file_path)
    elif ext == '.docx':
        text = extract_text_from_docx(file_path)
    elif ext in ['.txt', '.rtf']:
        text = extract_text_from_txt(file_path)
        
    return parse_questions_from_text(text)

def crawl_archive(archive_path):
    database = []
    
    for root, dirs, files in os.walk(archive_path):
        for file in files:
            # Skip hidden and temporary files
            if file.startswith('.') or file.startswith('~'):
                continue
                
            ext = os.path.splitext(file)[1].lower()
            if ext not in ['.pdf', '.docx', '.txt', '.rtf']:
                continue
                
            file_path = os.path.join(root, file)
            
            # Determine Topic and Type
            # Usually the folder structure is something like Archive/TOPIC 1 or Archive/ESSAY/مقالى/TOPIC 1
            rel_path = os.path.relpath(file_path, archive_path)
            parts = rel_path.replace('\\', '/').split('/')
            
            # Heuristic for Type
            q_type = "MCQ"
            if "ESSAY" in parts or "مقالى" in parts or "ESSAY" in file.upper():
                q_type = "ESSAY"
                
            # Heuristic for Topic
            topic = "UNKNOWN"
            for p in parts:
                if "TOPIC" in p.upper():
                    topic = p.upper()
                    break
                    
            try:
                print(f"Processing: {file.encode('utf-8', 'replace').decode('utf-8')} | Topic: {topic} | Type: {q_type}")
            except Exception:
                pass
            
            questions = process_file(file_path)
            for q in questions:
                q['topic'] = topic
                
                # Refine Type (Check if it looks like True/False)
                final_type = q_type
                if final_type == "MCQ" and ("TRUE" in q['text'].upper() and "FALSE" in q['text'].upper()):
                    final_type = "T/F"
                    
                q['type'] = final_type
                q['source_file'] = file
                database.append(q)
                
    return database

if __name__ == "__main__":
    archive_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "Archive")
    if not os.path.exists(archive_dir):
        print(f"Archive directory not found: {archive_dir}")
        exit(1)
        
    db = crawl_archive(archive_dir)
    print(f"Total extracted questions: {len(db)}")
    
    out_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "questions_db.json")
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(db, f, ensure_ascii=False, indent=4)
    print(f"Database saved to {out_file}")
