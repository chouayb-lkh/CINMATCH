import requests
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models.movie import Movie

API_KEY = "d7e60a73390bf4d7661ee56c674379f7"
BASE_URL = "https://api.themoviedb.org/3"
IMAGE_BASE = "https://image.tmdb.org/t/p/w500"

db = SessionLocal()

# Récupérer tous les films sans image
movies = db.query(Movie).filter(Movie.image == None).all()
print(f"{len(movies)} films sans image")

updated = 0
for movie in movies:
    try:
        # Chercher le film sur TMDB par titre
        response = requests.get(
            f"{BASE_URL}/search/movie",
            params={
                'api_key': API_KEY,
                'query': movie.title,
                'language': 'fr-FR'
            }
        )
        results = response.json().get('results', [])

        if results:
            poster_path = results[0].get('poster_path')
            overview = results[0].get('overview', '')

            if poster_path:
                movie.image = f"{IMAGE_BASE}{poster_path}"
                if not movie.description and overview:
                    movie.description = overview
                updated += 1

    except Exception as e:
        print(f"Erreur pour {movie.title}: {e}")

    if updated % 100 == 0 and updated > 0:
        db.commit()
        print(f"{updated} films mis à jour...")

db.commit()
print(f"\nTotal : {updated} films avec images ajoutées !")
db.close()