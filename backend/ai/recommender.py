from surprise import SVD, Dataset, Reader
from surprise.model_selection import train_test_split
from surprise import accuracy
from sqlalchemy.orm import Session
from models.rating import Rating
import pandas as pd

class RecommendationEngine:
    def __init__(self):
        self.model = SVD()
        self.trained = False

    def train(self, db: Session):
        print("Entraînement du modèle SVD...")

        # Récupérer tous les ratings depuis MySQL
        ratings = db.query(Rating).all()

        if len(ratings) < 10:
            raise Exception("Pas assez de notes pour entraîner le modèle")

        # Convertir en DataFrame
        data = pd.DataFrame([{
            'user_id': r.user_id,
            'movie_id': r.movie_id,
            'score': r.score
        } for r in ratings])

        # Créer le dataset Surprise
        reader = Reader(rating_scale=(1, 5))
        dataset = Dataset.load_from_df(
            data[['user_id', 'movie_id', 'score']],
            reader
        )

        # Entraîner sur toutes les données
        trainset = dataset.build_full_trainset()
        self.model.fit(trainset)
        self.trained = True
        print("Modèle SVD entraîné avec succès !")
        return trainset

    def get_recommendations(self, user_id: int, db: Session, n: int = 10):
        if not self.trained:
            self.train(db)

        rated_movies = db.query(Rating.movie_id).filter(
            Rating.user_id == user_id
        ).all()
        rated_movie_ids = {r.movie_id for r in rated_movies}

        from models.movie import Movie
        all_movies = db.query(Movie).filter(Movie.image != None).all()

        predictions = []
        for movie in all_movies:
            if movie.id not in rated_movie_ids:
                pred = self.model.predict(user_id, movie.id)

                year_bonus = 0
                if movie.year and movie.year > 2000:
                    year_bonus = (movie.year - 2000) * 0.01

                predictions.append({
                    "movie_id": movie.id,
                    "title": movie.title,
                    "genre": movie.genre,
                    "year": movie.year,
                    "image": movie.image,
                    "predicted_score": round(pred.est, 2),
                    "final_score": pred.est + year_bonus
                })

        predictions.sort(key=lambda x: x['final_score'], reverse=True)

        for p in predictions:
            p.pop('final_score', None)

        return predictions[:n]

# Instance globale
engine_ia = RecommendationEngine()