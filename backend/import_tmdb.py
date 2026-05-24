import requests
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
from models.movie import Movie


API_KEY = os.environ.get("TMDB_API_KEY")
BASE_URL = "https://api.themoviedb.org/3"

db = SessionLocal()

def get_genres():
    url = f"{BASE_URL}/genre/movie/list"
    params = {'api_key': API_KEY, 'language': 'fr-FR'}
    response = requests.get(url, params=params)
    genres = response.json()['genres']
    return {g['id']: g['name'] for g in genres}

def import_popular_movies(pages=50):
    genre_map = get_genres()
    films_importes = 0

    for page in range(1, pages + 1):
        url = f"{BASE_URL}/movie/popular"
        params = {
            'api_key': API_KEY,
            'language': 'fr-FR',
            'page': page
        }
        response = requests.get(url, params=params)
        movies = response.json().get('results', [])

        for m in movies:
            existing = db.query(Movie).filter(
                Movie.title == m['title']
            ).first()
            if existing:
                continue

            year = 0
            if m.get('release_date') and len(m['release_date']) >= 4:
                try:
                    year = int(m['release_date'][:4])
                except:
                    year = 0

            genres = [genre_map.get(gid, '') for gid in m.get('genre_ids', [])]
            genre_str = ', '.join([g for g in genres if g])

            new_movie = Movie(
                title=m['title'],
                genre=genre_str,
                year=year,
                description=m.get('overview', '')
            )
            db.add(new_movie)
            films_importes += 1

        db.commit()
        print(f"Page {page} importée — {films_importes} films ajoutés")

    print(f"\nTotal : {films_importes} nouveaux films importés !")
    db.close()

import_popular_movies(pages=50)

