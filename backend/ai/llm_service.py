from groq import Groq
import os
from sqlalchemy.orm import Session
from models.rating import Rating
from models.movie import Movie

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

def generate_explanation(user_id: int, movie_title: str, genre: str, db: Session):
    try:
        liked_ratings = db.query(Rating).filter(
            Rating.user_id == user_id,
            Rating.score >= 4
        ).limit(5).all()

        liked_titles = []
        for r in liked_ratings:
            movie = db.query(Movie).filter(Movie.id == r.movie_id).first()
            if movie:
                liked_titles.append(movie.title)

        print(f"Films aimés par {user_id}: {liked_titles}")  # ← ajoute ça

        liked_str = ', '.join(liked_titles) if liked_titles else "plusieurs films"

        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {
                    "role": "user",
                    "content": f"""En une seule phrase courte en français, explique pourquoi on recommande le film "{movie_title}" (genre: {genre}) à un utilisateur qui a aimé : {liked_str}. Commence par "Nous vous recommandons ce film car..." """
                }
            ]
        )
        print(f"Explication générée: {response.choices[0].message.content}")  # ← ajoute ça
        return response.choices[0].message.content.strip()

    except Exception as e:
        print(f"Erreur LLM: {e}")  # ← déjà là
        return f"Ce film correspond à vos goûts cinématographiques."