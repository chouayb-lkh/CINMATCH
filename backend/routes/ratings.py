from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from models.rating import Rating
from models.movie import Movie

router = APIRouter()

# ===== SCHÉMA =====
class RatingCreate(BaseModel):
    user_id: int
    movie_id: int
    score: float

# ===== POST noter un film =====
@router.post("/")
def add_rating(rating_data: RatingCreate, db: Session = Depends(get_db)):
    # Vérifier que le score est entre 1 et 5
    if not 1 <= rating_data.score <= 5:
        raise HTTPException(status_code=400, detail="Le score doit être entre 1 et 5")

    # Vérifier que le film existe
    movie = db.query(Movie).filter(Movie.id == rating_data.movie_id).first()
    if not movie:
        raise HTTPException(status_code=404, detail="Film non trouvé")

    # Vérifier si l'utilisateur a déjà noté ce film
    existing = db.query(Rating).filter(
        Rating.user_id == rating_data.user_id,
        Rating.movie_id == rating_data.movie_id
    ).first()

    if existing:
        # Mettre à jour la note existante
        existing.score = rating_data.score
        db.commit()
        return {"message": "Note mise à jour avec succès"}

    # Créer une nouvelle note
    new_rating = Rating(
        user_id=rating_data.user_id,
        movie_id=rating_data.movie_id,
        score=rating_data.score
    )
    db.add(new_rating)
    db.commit()
    return {"message": "Note ajoutée avec succès"}

# ===== GET notes d'un utilisateur =====
@router.get("/{user_id}")
def get_user_ratings(user_id: int, db: Session = Depends(get_db)):
    ratings = db.query(Rating).filter(Rating.user_id == user_id).all()
    if not ratings:
        raise HTTPException(status_code=404, detail="Aucune note trouvée pour cet utilisateur")
    return ratings

# ===== GET moyenne des notes d'un film =====
@router.get("/movie/{movie_id}/average")
def get_movie_average(movie_id: int, db: Session = Depends(get_db)):
    ratings = db.query(Rating).filter(Rating.movie_id == movie_id).all()
    if not ratings:
        raise HTTPException(status_code=404, detail="Aucune note pour ce film")
    average = sum(r.score for r in ratings) / len(ratings)
    return {
        "movie_id": movie_id,
        "average_score": round(average, 2),
        "total_ratings": len(ratings)
    }