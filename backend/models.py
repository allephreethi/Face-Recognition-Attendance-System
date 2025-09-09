# models.py
from sqlalchemy import create_engine, Column, Integer, String, DateTime, LargeBinary
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime

# --- SQL Server config (edit these) ---
USERNAME = "sa"
PASSWORD = "123456"
SERVER = r"DESKTOP-E238M55\SQLEXPRESS"  # keep the raw string for backslash
DATABASE = "AttendanceDB"

# URL with ODBC Driver 17 (or 18). The double backslash is important.
DATABASE_URL = f"mssql+pyodbc://{USERNAME}:{PASSWORD}@{SERVER}/{DATABASE}?driver=ODBC+Driver+17+for+SQL+Server"

# Engine and session
engine = create_engine(DATABASE_URL, pool_pre_ping=True, fast_executemany=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# --- ORM tables ---
class Student(Base):
    __tablename__ = "Students"  # match SQL table name
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    encoding = Column(LargeBinary, nullable=False)

class Attendance(Base):
    __tablename__ = "Attendance"  # match SQL table name
    id = Column(Integer, primary_key=True, index=True)
    student_name = Column(String(100), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)  # server default also exists
    photo = Column(LargeBinary, nullable=True)

# Create tables if they don't exist (safe if already created)
def init_db():
    Base.metadata.create_all(bind=engine)
