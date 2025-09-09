# register.py
import os
import shutil
import numpy as np
import face_recognition
from models import Student, SessionLocal

UPLOAD_FOLDER = "captured_images"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def register_student_file(student_name: str, file_path: str, db):
    """
    Read image, compute face encoding, save to DB.
    Assumes one face/image for enrollment. Skips if no face found.
    """
    # Keep a copy in captured_images for auditing
    dest_name = f"{student_name}_{os.path.basename(file_path)}"
    dest_path = os.path.join(UPLOAD_FOLDER, dest_name)
    shutil.copyfile(file_path, dest_path)

    # Load & encode
    img = face_recognition.load_image_file(dest_path)
    encodings = face_recognition.face_encodings(img)

    if len(encodings) == 0:
        print(f"❌ No face detected in {file_path}")
        return {"status": "error", "message": f"No face in {file_path}"}

    face_encoding = encodings[0].astype("float32")

    # Upsert-like: if name exists, update encoding; else insert
    existing = db.query(Student).filter(Student.name == student_name).first()
    if existing:
        existing.encoding = face_encoding.tobytes()
        db.add(existing)
        db.commit()
        print(f"🔁 Updated encoding for {student_name}")
        return {"status": "updated", "student": student_name}

    student = Student(name=student_name, encoding=face_encoding.tobytes())
    db.add(student)
    db.commit()
    db.refresh(student)

    print(f"✅ Registered {student_name}")
    return {"status": "success", "student": student.name}

def bulk_register_students(students_folder="students"):
    """
    Loop through files in 'students' folder and register each as <name>.<ext>
    """
    db = SessionLocal()
    try:
        for filename in os.listdir(students_folder):
            path = os.path.join(students_folder, filename)
            if os.path.isfile(path):
                student_name = os.path.splitext(filename)[0]
                register_student_file(student_name, path, db)
    finally:
        db.close()
