from sqlalchemy import Column, Integer, Float, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base

class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    movie_id = Column(Integer, ForeignKey("movies.id"), nullable=False)
    predicted_score = Column(Float, nullable=False)
    explanation = Column(Text)
    generated_at = Column(DateTime, default=func.now())