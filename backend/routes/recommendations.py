from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from ai.recommender import engine_ia
from ai.llm_service import generate_explanation
from models.recommendation import Recommendation

router = APIRouter()

@router.get("/{user_id}")
def get_recommendations(user_id: int, db: Session = Depends(get_db)):
    try:
        recommendations = engine_ia.get_recommendations(user_id, db, n=50)

        if not recommendations:
            raise HTTPException(status_code=404, detail="Aucune recommandation trouvée")

        recommendations = [r for r in recommendations if r.get('image')]
        recent = [r for r in recommendations if (r.get('year') or 0) >= 2000]
        old = [r for r in recommendations if (r.get('year') or 0) < 2000]
        final = recent[:7] + old[:3]

        for rec in final:
            existing = db.query(Recommendation).filter(
                Recommendation.user_id == user_id,
                Recommendation.movie_id == rec['movie_id']
            ).first()
            if not existing:
                new_rec = Recommendation(
                    user_id=user_id,
                    movie_id=rec['movie_id'],
                    predicted_score=rec['predicted_score']
                )
                db.add(new_rec)

        db.commit()
        return {"user_id": user_id, "recommendations": final}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{user_id}/explained")
def get_recommendations_explained(user_id: int, db: Session = Depends(get_db)):
    try:
        recommendations = engine_ia.get_recommendations(user_id, db, n=50)

        if not recommendations:
            raise HTTPException(status_code=404, detail="Aucune recommandation trouvée")

        recommendations = [r for r in recommendations if r.get('image')]
        recent = [r for r in recommendations if (r.get('year') or 0) >= 2000]
        old = [r for r in recommendations if (r.get('year') or 0) < 2000]
        final = recent[:5] + old[:2]

        print("Génération des explications LLM...")
        for rec in final:
            explanation = generate_explanation(
                user_id=user_id,
                movie_title=rec['title'],
                genre=rec['genre'] or '',
                db=db
            )
            rec['explanation'] = explanation

            existing = db.query(Recommendation).filter(
                Recommendation.user_id == user_id,
                Recommendation.movie_id == rec['movie_id']
            ).first()

            if existing:
                existing.explanation = explanation
                existing.predicted_score = rec['predicted_score']
            else:
                new_rec = Recommendation(
                    user_id=user_id,
                    movie_id=rec['movie_id'],
                    predicted_score=rec['predicted_score'],
                    explanation=explanation
                )
                db.add(new_rec)

        db.commit()
        return {"user_id": user_id, "recommendations": final}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/train")
def train_model(db: Session = Depends(get_db)):
    try:
        engine_ia.train(db)
        return {"message": "Modèle SVD entraîné avec succès"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))