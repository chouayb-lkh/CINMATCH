from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from models import user, movie, rating, recommendation
from routes import auth, movies, ratings, recommendations

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Système de Recommandation de Films")

# ===== CORS =====
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"]
)

app.include_router(auth.router, prefix="/auth", tags=["Authentification"])
app.include_router(movies.router, prefix="/movies", tags=["Films"])
app.include_router(ratings.router, prefix="/ratings", tags=["Notes"])
app.include_router(recommendations.router, prefix="/recommendations", tags=["Recommandations"])

@app.get("/")
def home():
    return {"message": "API de recommandation de films"}