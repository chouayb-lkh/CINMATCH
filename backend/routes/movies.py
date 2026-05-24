from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database import get_db
from models.movie import Movie

router = APIRouter()

class MovieCreate(BaseModel):
    title: str
    genre: str
    year: int
    description: str = None

# GET tous les films
@router.get("/")
def get_movies(db: Session = Depends(get_db)):
    movies = db.query(Movie).all()
    return movies

# GET un film par ID
@router.get("/{movie_id}")
def get_movie(movie_id: int, db: Session = Depends(get_db)):
    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not movie:
        raise HTTPException(status_code=404, detail="Film non trouvé")
    return movie

# POST ajouter un film
@router.post("/")
def create_movie(movie_data: MovieCreate, db: Session = Depends(get_db)):
    new_movie = Movie(
        title=movie_data.title,
        genre=movie_data.genre,
        year=movie_data.year,
        description=movie_data.description
    )
    db.add(new_movie)
    db.commit()
    db.refresh(new_movie)
    return {"message": "Film ajouté", "movie_id": new_movie.id}

# GET films avec images seulement
@router.get("/with-images/")
def get_movies_with_images(db: Session = Depends(get_db)):
    movies = db.query(Movie).filter(Movie.image != None).all()
    return movies