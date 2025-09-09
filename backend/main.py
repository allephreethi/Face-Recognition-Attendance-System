# main.py
from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import numpy as np
import face_recognition
import io, os, shutil, base64
from PIL import Image
from datetime import datetime, time
from zoneinfo import ZoneInfo

from models import Student, Attendance, SessionLocal, init_db
from register import bulk_register_students

# -------------------
# Constants
# -------------------
IST = ZoneInfo("Asia/Kolkata")
UPLOAD_FOLDER = "captured_images"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# -------------------
# App setup
# -------------------
app = FastAPI(title="Face Recognition Attendance")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

# -------------------
# DB dependency
# -------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# -------------------
# Root
# -------------------
@app.get("/")
def root():
    return {"message": "✅ Face Recognition Attendance Backend Running"}

# -------------------
# Startup
# -------------------
@app.on_event("startup")
def on_startup():
    init_db()
    try:
        print("📌 Bulk registering students from 'students/' folder...")
        bulk_register_students("students")
        print("✅ Bulk registration done.")
    except Exception as e:
        print(f"⚠️ Bulk registration skipped: {e}")

# -------------------
# Helper: crop face to JPEG
# -------------------
def crop_to_jpeg_bytes(rgb_image_np, face_location) -> bytes:
    top, right, bottom, left = face_location
    h, w = rgb_image_np.shape[:2]
    top = max(0, top); left = max(0, left)
    bottom = min(h, bottom); right = min(w, right)

    face_arr = rgb_image_np[top:bottom, left:right]
    if face_arr.size == 0:
        face_arr = rgb_image_np  # fallback

    img = Image.fromarray(face_arr)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85, optimize=True)
    return buf.getvalue()

# -------------------
# POST /recognize
# -------------------
@app.post("/recognize/")
async def recognize_face(file: UploadFile = File(...), db: Session = Depends(get_db)):
    # Save temp copy
    temp_path = os.path.join(UPLOAD_FOLDER, f"temp_{file.filename}")
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Load image
    img = face_recognition.load_image_file(temp_path)
    face_locations = face_recognition.face_locations(img, model="hog")
    if not face_locations:
        return {"status": "error", "message": "No face detected"}

    encodings = face_recognition.face_encodings(img, known_face_locations=face_locations)
    if not encodings:
        return {"status": "error", "message": "No face encoding found"}

    students: List[Student] = db.query(Student).all()
    if not students:
        return {"status": "error", "message": "No enrolled students in DB"}

    for encoding, loc in zip(encodings, face_locations):
        face_encoding = encoding.astype("float32")

        # Find best match
        best_match = None
        min_distance = 0.5  # adjust stricter for accuracy
        for student in students:
            known = np.frombuffer(student.encoding, dtype=np.float32)
            distance = face_recognition.face_distance([known], face_encoding)[0]
            if distance < min_distance:
                min_distance = distance
                best_match = student

        if not best_match:
            continue  # no match, try next face

        # -------------------
        # Check if attendance already marked today
        # -------------------
        now_ist = datetime.now(IST)
        today_start = datetime.combine(now_ist.date(), time(0,0,0), tzinfo=IST)
        today_end = datetime.combine(now_ist.date(), time(23,59,59,999999), tzinfo=IST)

        existing = (
            db.query(Attendance)
            .filter(Attendance.student_name == best_match.name)
            .filter(Attendance.timestamp >= today_start)
            .filter(Attendance.timestamp <= today_end)
            .first()
        )
        if existing:
            return {
                "status": "duplicate",
                "student": best_match.name,
                "time_ist": existing.timestamp.isoformat(),
                "day": existing.timestamp.strftime("%A"),
                "message": "Attendance already marked today ❌"
            }

        # -------------------
        # Mark attendance
        # -------------------
        jpeg_bytes = crop_to_jpeg_bytes(img, loc)
        attendance = Attendance(
            student_name=best_match.name,
            photo=jpeg_bytes,
            timestamp=now_ist
        )
        db.add(attendance)
        db.commit()

        return {
            "status": "success",
            "student": best_match.name,
            "time_ist": now_ist.isoformat(),
            "day": now_ist.strftime("%A"),
            "message": "Attendance marked ✅"
        }

    return {"status": "unknown", "message": "Face not recognized"}

# -------------------
# GET /attendance/list
# -------------------
@app.get("/attendance/list")
def list_attendance(limit: int = 20, db: Session = Depends(get_db)):
    rows = db.query(Attendance).order_by(Attendance.id.desc()).limit(limit).all()
    result = []
    for r in rows:
        ts_ist = r.timestamp or datetime.now(IST)
        day_name = ts_ist.strftime("%A")
        photo_b64 = base64.b64encode(r.photo).decode("utf-8") if r.photo else None
        result.append({
            "id": r.id,
            "student_name": r.student_name,
            "timestamp_ist": ts_ist.isoformat(),
            "day_ist": day_name,
            "photo_base64": photo_b64
        })
    return {"count": len(result), "items": result}

# -------------------
# GET /attendance/{id}/photo
# -------------------
@app.get("/attendance/{attendance_id}/photo")
def get_attendance_photo(attendance_id: int, db: Session = Depends(get_db)):
    row: Optional[Attendance] = db.query(Attendance).filter(Attendance.id == attendance_id).first()
    if not row or not row.photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    return StreamingResponse(io.BytesIO(row.photo), media_type="image/jpeg")

# -------------------
# GET /students
# -------------------
@app.get("/students")
def list_students(db: Session = Depends(get_db)):
    rows = db.query(Student).order_by(Student.name.asc()).all()
    return [{"id": s.id, "name": s.name} for s in rows]
