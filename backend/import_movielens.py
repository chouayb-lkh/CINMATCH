import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models.movie import Movie
from models.rating import Rating

db = SessionLocal()

data_path = os.path.expanduser('~/.surprise_data/ml-100k/ml-100k/')

# ===== IMPORTER LES FILMS =====
print("Importation des films...")
films_importes = 0

with open(data_path + 'u.item', encoding='latin-1') as f:
    for line in f:
        parts = line.strip().split('|')
        film_id = int(parts[0])
        title = parts[1]
        
        # Extraire l'année du titre ex: "Toy Story (1995)" → 1995
        year = 0
        if '(' in title and ')' in title:
            try:
                year = int(title[-5:-1])
            except:
                year = 0

        # Genres (colonnes 5 à 23)
        genre_names = [
            'unknown', 'Action', 'Adventure', 'Animation',
            'Children', 'Comedy', 'Crime', 'Documentary',
            'Drama', 'Fantasy', 'Film-Noir', 'Horror',
            'Musical', 'Mystery', 'Romance', 'Sci-Fi',
            'Thriller', 'War', 'Western'
        ]
        genres = []
        for i, val in enumerate(parts[6:25]):
            if val == '1':
                genres.append(genre_names[i])
        genre_str = ', '.join(genres) if genres else 'Unknown'

        # Vérifier si le film existe déjà
        existing = db.query(Movie).filter(Movie.id == film_id).first()
        if not existing:
            movie = Movie(
                id=film_id,
                title=title,
                genre=genre_str,
                year=year
            )
            db.add(movie)
            films_importes += 1

db.commit()
print(f"{films_importes} films importés avec succès !")

# ===== IMPORTER LES RATINGS =====
print("Importation des ratings...")
ratings_importes = 0

with open(data_path + 'u.data', encoding='latin-1') as f:
    for line in f:
        parts = line.strip().split('\t')
        user_id = int(parts[0])
        movie_id = int(parts[1])
        score = float(parts[2])

        existing = db.query(Rating).filter(
            Rating.user_id == user_id,
            Rating.movie_id == movie_id
        ).first()
        
        if not existing:
            rating = Rating(
                user_id=user_id,
                movie_id=movie_id,
                score=score
            )
            db.add(rating)
            ratings_importes += 1

        if ratings_importes % 10000 == 0 and ratings_importes > 0:
            db.commit()
            print(f"{ratings_importes} ratings importés...")

db.commit()
print(f"{ratings_importes} ratings importés avec succès !")
db.close()