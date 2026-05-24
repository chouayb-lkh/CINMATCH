from sqlalchemy import Column, Integer, String, Text
from database import Base

class Movie(Base):
    __tablename__ = "movies"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    genre = Column(String(100))
    year = Column(Integer)
    description = Column(Text)
    image = Column(String(500))