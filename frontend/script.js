/* =========================
   ⚙️ CONFIGURATION API
========================= */
const API_URL = "http://localhost:8000";

/* =========================
   🔧 FONCTIONS UTILITAIRES
========================= */
function getToken() {
    return localStorage.getItem("token");
}

function getUserId() {
    return localStorage.getItem("user_id");
}

function isLoggedIn() {
    return localStorage.getItem("token") !== null;
}

async function apiCall(endpoint, method = "GET", body = null) {
    const headers = { "Content-Type": "application/json" };
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(`${API_URL}${endpoint}`, options);
    return response;
}

/* =========================
   🔒 PROTECTION DES PAGES
========================= */
const page = window.location.pathname;

if (
    page.includes("index.html") ||
    page.includes("favorites.html") ||
    page.includes("preferences.html")
) {
    if (!isLoggedIn()) {
        window.location.href = "login.html";
    }
}

if (page.includes("index.html")) {
    const prefDone = localStorage.getItem("preferences_done");
    if (!prefDone || prefDone === "false") {
        window.location.href = "preferences.html";
    }
}

/* =========================
   👤 REGISTER
========================= */
const registerForm = document.getElementById("registerForm");

if (registerForm) {
    registerForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const fullName = document.getElementById("fullName").value;
        const email = document.getElementById("registerEmail").value;
        const password = document.getElementById("registerPassword").value;
        const confirmPassword = document.getElementById("confirmPassword").value;

        if (password !== confirmPassword) {
            alert("Les mots de passe ne correspondent pas");
            return;
        }

        try {
            const response = await apiCall("/auth/register", "POST", {
                username: fullName,
                email: email,
                password: password
            });

            const data = await response.json();

            if (response.ok) {
                // Connexion automatique après inscription
                const loginResponse = await apiCall("/auth/login", "POST", {
                    email: email,
                    password: password
                });
                const loginData = await loginResponse.json();

                if (loginResponse.ok) {
                    localStorage.setItem("token", loginData.access_token);
                    localStorage.setItem("user_id", loginData.user_id);
                    localStorage.setItem("username", loginData.username);
                    window.location.href = "preferences.html";
                }
            } else {
                alert(data.detail || "Erreur lors de l'inscription");
            }
        } catch (err) {
            alert("Erreur de connexion au serveur");
        }
    });
}

/* =========================
   🔐 LOGIN
========================= */
const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async function (e) {
        e.preventDefault();

        const email = document.getElementById("loginEmail").value;
        const password = document.getElementById("loginPassword").value;

        try {
            const response = await apiCall("/auth/login", "POST", {
                email: email,
                password: password
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem("token", data.access_token);
                localStorage.setItem("user_id", data.user_id);
                localStorage.setItem("username", data.username);
                localStorage.setItem("email", data.email);
                localStorage.setItem("preferences_done", data.preferences_done);


                if (!data.preferences_done) {
                    window.location.href = "preferences.html";
                } else {
                    window.location.href = "index.html";
                }
            } else {
                alert(data.detail || "Email ou mot de passe incorrect");
            }
        } catch (err) {
            alert("Erreur de connexion au serveur");
        }
    });
}

/* =========================
   ❤️ FAVORITES
========================= */
let favorites = JSON.parse(localStorage.getItem("favoriteMovies")) || [];

function toggleFavorite(id) {
    if (favorites.includes(id)) {
        favorites = favorites.filter(f => f !== id);
    } else {
        favorites.push(id);
    }
    localStorage.setItem("favoriteMovies", JSON.stringify(favorites));
    location.reload();
}

/* =========================
   ⭐ NOTATION
========================= */
async function rateMovie(movieId, score) {
    const userId = getUserId();
    if (!userId) return;

    try {
        const response = await apiCall("/ratings/", "POST", {
            user_id: parseInt(userId),
            movie_id: movieId,
            score: score
        });

        if (response.ok) {
            alert(`Film noté ${score}/5 avec succès !`);
            // Re-entraîner le modèle après une nouvelle note
            await apiCall("/recommendations/train", "POST");
        }
    } catch (err) {
        console.error("Erreur notation:", err);
    }
}

/* =========================
   🎬 MOVIE CARD
========================= */
function movieCard(movie) {
    const isFav = favorites.includes(movie.id);
    const image = movie.image ? movie.image : "no-image.jpg";

    return `
        <div class="movie-card" onclick="window.location.href='movie.html?id=${movie.id}'">
            <button class="favorite-btn ${isFav ? "active" : ""}"
                onclick="event.stopPropagation(); toggleFavorite(${movie.id})">
                ${isFav ? "❤" : "♡"}
            </button>
            <div class="movie-poster"
                style="background-image:url('${image}')"></div>
            <div class="movie-content">
                <h3>${movie.title}</h3>
                <div class="meta">
                    ${movie.genre || ''} • ${movie.year || ''}
                    ${movie.predicted_score ? '• ⭐ ' + movie.predicted_score : ''}
                </div>
                ${movie.explanation ? `<p class="explanation">💬 ${movie.explanation}</p>` : ''}
                <div class="rating-stars" onclick="event.stopPropagation()">
                    ${[1,2,3,4,5].map(s => `
                        <span onclick="rateMovie(${movie.id}, ${s})"
                            style="cursor:pointer;font-size:18px;">★</span>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

/* =========================
   🌍 CHARGEMENT DES FILMS
========================= */
async function loadMovies() {
    try {
        const response = await apiCall("/movies/with-images/");
        const movies = await response.json();
        
        // Trier par année décroissante — films récents en premier
        return movies.sort((a, b) => (b.year || 0) - (a.year || 0));
    } catch (err) {
        console.error("Erreur chargement films:", err);
        return [];
    }
}

/* =========================
   🎯 RECOMMANDATIONS SVD
========================= */
async function loadRecommendations() {
    const userId = getUserId();
    if (!userId) return [];

    try {
        const response = await apiCall(`/recommendations/${userId}/explained`);
        const data = await response.json();
        
        // Normaliser movie_id → id
        const recommendations = data.recommendations || [];
        return recommendations.map(r => ({
            ...r,
            id: r.movie_id  // ← ajoute le champ id
        }));
    } catch (err) {
        console.error("Erreur recommandations:", err);
        return [];
    }
}

/* =========================
   🌍 HOME PAGE
========================= */
const worldMovies = document.getElementById("worldMovies");
const personalMovies = document.getElementById("personalMovies");

if (worldMovies || personalMovies) {
    (async () => {
        if (worldMovies) worldMovies.innerHTML = `<p style="color:#aaa">Chargement...</p>`;
        if (personalMovies) personalMovies.innerHTML = `<p style="color:#aaa">Chargement...</p>`;

        const movies = await loadMovies();

        // Tendances mondiales — triées par année récente
        if (worldMovies) {
            worldMovies.innerHTML = movies.slice(0, 20).map(movieCard).join("");
        }

        // Recommandations personnalisées SVD
        if (personalMovies) {
            const recommendations = await loadRecommendations();

            if (recommendations.length > 0) {
                // Trier par année décroissante
                const sorted = recommendations.sort((a, b) => (b.year || 0) - (a.year || 0));
                personalMovies.innerHTML = sorted.map(movieCard).join("");
            } else {
                // Fallback — filtrer par genres sélectionnés
                const genres = JSON.parse(localStorage.getItem("selectedGenres")) || [];
                let filtered = movies.filter(m =>
                    genres.some(g => m.genre && m.genre.includes(g))
                );
                personalMovies.innerHTML = filtered.length
                    ? filtered.slice(0, 20).map(movieCard).join("")
                    : `<div class="empty-simple"><h3>Notez des films pour obtenir des recommandations</h3></div>`;
            }
        }
        // Mettre à jour le hero slider
        if (movies.length > 0) {
            heroSlides.length = 0;
            movies.slice(0, 5).forEach(m => heroSlides.push(m));
            showHeroSlide(0);
        }
    })();
}

/* =========================
   ⭐ FAVORITES PAGE
========================= */
const favoriteMovies = document.getElementById("favoriteMovies");

if (favoriteMovies) {
    (async () => {
        const movies = await loadMovies();
        const favList = movies.filter(m => favorites.includes(m.id));

        favoriteMovies.innerHTML = favList.length
            ? favList.map(movieCard).join("")
            : `<div class="empty-simple">
                <h3>Aucun favori</h3>
                <p>Ajoutez des films depuis l'accueil</p>
               </div>`;
    })();
}

/* =========================
   🎯 PREFERENCES
========================= */
const genreOptions = [
    "Action", "Romance", "Sci-Fi", "Drama",
    "Comedy", "Horror", "Fantasy", "Thriller",
    "Animation", "Aventure"
];

let selectedGenres = [];
let selectedMovies = [];

if (page.includes("preferences.html")) {
    localStorage.removeItem("selectedGenres");
    localStorage.removeItem("selectedMovies");
}

const genresList = document.getElementById("genresList");

if (genresList) {
    genresList.innerHTML = genreOptions.map(genre => `
        <button class="genre-btn" onclick="toggleGenre('${genre}', this)">
            ${genre}
        </button>
    `).join("");
}

const prefMovies = document.getElementById("prefMovies");

if (prefMovies) {
    (async () => {
        const movies = await loadMovies();
        
        // Trier par score TMDB + année récente combinés
        const sortedMovies = movies
            .filter(m => m.year && m.year > 2000)  // films après 2000
            .sort((a, b) => {
                // Score combiné : 70% année + 30% note
                const scoreA = (a.year * 0.7) + ((a.vote_average || 0) * 0.3);
                const scoreB = (b.year * 0.7) + ((b.vote_average || 0) * 0.3);
                return scoreB - scoreA;
            })
            .slice(0, 20);
        
        prefMovies.innerHTML = sortedMovies.map(movie => `
            <div class="pref-movie" onclick="toggleMovie(${movie.id}, this)">
                <img src="${movie.image}" alt="${movie.title}">
                <span class="pref-title">${movie.title}</span>
            </div>
        `).join("");
    })();
}

function toggleGenre(genre, btn) {
    if (selectedGenres.includes(genre)) {
        selectedGenres = selectedGenres.filter(g => g !== genre);
        btn.classList.remove("active");
    } else {
        selectedGenres.push(genre);
        btn.classList.add("active");
    }
}

function toggleMovie(id, card) {
    if (selectedMovies.includes(id)) {
        selectedMovies = selectedMovies.filter(m => m !== id);
        card.classList.remove("active");
    } else {
        selectedMovies.push(id);
        card.classList.add("active");
    }
}

async function savePreferences() {
    if (selectedGenres.length === 0 && selectedMovies.length === 0) {
        alert("Veuillez choisir au moins un genre ou un film");
        return;
    }

    localStorage.setItem("selectedGenres", JSON.stringify(selectedGenres));
    localStorage.setItem("selectedMovies", JSON.stringify(selectedMovies));
    localStorage.setItem("preferences_done", "true");

    const userId = getUserId();

    if (userId) {
        // Marquer préférences comme faites
        apiCall(`/auth/preferences-done?user_id=${userId}`, "POST");

        // Noter les films en arrière-plan SANS attendre
        selectedMovies.forEach(movieId => {
            apiCall("/ratings/", "POST", {
                user_id: parseInt(userId),
                movie_id: movieId,
                score: 5
            });
        });
    }

    // Rediriger immédiatement sans attendre
    window.location.href = "index.html";
}

/* =========================
   ⚙️ SETTINGS
========================= */
function toggleSettings() {
    document.getElementById("settingsMenu").classList.toggle("show");
}

function logout() {
    localStorage.clear();
    window.location.href = "login.html";
}

function goToFavorites() {
    window.location.href = "favorites.html";
}

/* =========================
   🎞️ HERO SLIDER
========================= */
const heroImage = document.getElementById("heroImage");
const heroTitle = document.getElementById("heroTitle");
const heroDesc = document.getElementById("heroDesc");

let currentHeroSlide = 0;
let heroInterval;
let heroSlides = [];

function showHeroSlide(index) {
    if (!heroImage || heroSlides.length === 0) return;
    const movie = heroSlides[index];
    heroImage.style.backgroundImage = `url('${movie.image ||
        "https://via.placeholder.com/1920x1080?text=" +
        encodeURIComponent(movie.title)}')`;
    if (heroTitle) heroTitle.textContent = movie.title;
    if (heroDesc) heroDesc.textContent = movie.description || "";
}

function nextHeroSlide() {
    if (heroSlides.length === 0) return;
    currentHeroSlide = (currentHeroSlide + 1) % heroSlides.length;
    showHeroSlide(currentHeroSlide);
}

function prevHeroSlide() {
    if (heroSlides.length === 0) return;
    currentHeroSlide = (currentHeroSlide - 1 + heroSlides.length) % heroSlides.length;
    showHeroSlide(currentHeroSlide);
}

function startHeroSlider() {
    heroInterval = setInterval(nextHeroSlide, 4000);
}

if (heroImage) {
    startHeroSlider();
}

/* =========================
   🎨 NAVBAR SCROLL
========================= */
const navbar = document.querySelector(".topbar");

if (navbar) {
    window.addEventListener("scroll", function () {
        let opacity = Math.min(window.scrollY / 250, 0.85);
        navbar.style.background = `rgba(0,0,0,${opacity})`;
        navbar.style.backdropFilter = `blur(${opacity * 10}px)`;
        navbar.style.boxShadow = `0 10px 30px rgba(0,0,0,${opacity * 0.6})`;
    });
}
/* =========================
   🎬 MOVIE DETAIL PAGE
========================= */
const movieDetail = document.getElementById("movieDetail");

if (movieDetail) {
    (async () => {
        const params = new URLSearchParams(window.location.search);
        const movieId = parseInt(params.get("id"));

        if (!movieId) {
            movieDetail.innerHTML = `<p style="color:#aaa;text-align:center">Film non trouvé</p>`;
            return;
        }

        try {
            // Charger les détails du film
            const response = await apiCall(`/movies/${movieId}`);
            const movie = await response.json();

            // Charger la moyenne des notes
            const avgResponse = await apiCall(`/ratings/movie/${movieId}/average`);
            const avgData = avgResponse.ok ? await avgResponse.json() : null;

            // Vérifier si ce film est dans les recommandations
            const userId = getUserId();
            let explanation = null;
            let isRecommended = false;

            if (userId) {
                try {
                    const recResponse = await apiCall(`/recommendations/${userId}/explained`);
                    const recData = await recResponse.json();
                    const recommendations = recData.recommendations || [];
                    const found = recommendations.find(r => r.movie_id === movieId);
                    if (found) {
                        isRecommended = true;
                        explanation = found.explanation;
                    }
                } catch (err) {
                    console.log("Pas de recommandations disponibles");
                }
            }

            const isFav = favorites.includes(movie.id);
            const image = movie.image || "no-image.jpg";
            const average = avgData ? avgData.average_score : null;

            movieDetail.innerHTML = `
                <div class="movie-detail-container">
                    <div class="movie-detail-poster"
                        style="background-image:url('${image}')"></div>

                    <div class="movie-detail-info">

                        ${isRecommended ? `
                            <div class="recommended-badge">
                                 Recommandé pour vous
                            </div>
                        ` : ''}

                        <h1>${movie.title}</h1>
                        <div class="movie-detail-meta">
                            ${movie.genre || ''} • ${movie.year || ''}
                        </div>

                        ${average ? `
                            <div class="movie-detail-score">
                                ⭐ ${average}/5
                                <span style="color:#9ca3af;font-size:14px">
                                    (${avgData.total_ratings} notes)
                                </span>
                            </div>
                        ` : ''}

                        <p class="movie-detail-description">
                            ${movie.description || 'Aucune description disponible.'}
                        </p>

                        ${explanation ? `
                            <div class="movie-detail-explanation">
                                 ${explanation}
                            </div>
                        ` : ''}

                        <div class="movie-detail-actions">
                            <div class="btn-rate" id="starRating">
                                ${[1,2,3,4,5].map(s => `
                                    <span onclick="rateMovieDetail(${movie.id}, ${s})"
                                        id="star-${s}">★</span>
                                `).join('')}
                            </div>

                            <button class="btn-fav ${isFav ? 'active' : ''}"
                                onclick="toggleFavoriteDetail(${movie.id})">
                                ${isFav ? '❤ Retirer des favoris' : '♡ Ajouter aux favoris'}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        } catch (err) {
            movieDetail.innerHTML = `<p style="color:#aaa;text-align:center">Erreur de chargement</p>`;
        }
    })();
}

async function rateMovieDetail(movieId, score) {
    // Colorer les étoiles
    for (let i = 1; i <= 5; i++) {
        const star = document.getElementById(`star-${i}`);
        if (star) star.classList.toggle('active', i <= score);
    }
    await rateMovie(movieId, score);
}

function toggleFavoriteDetail(id) {
    toggleFavorite(id);
}
/* =========================
   ⭐ RATED MOVIES PAGE
========================= */
const ratedMovies = document.getElementById("ratedMovies");

if (ratedMovies) {
    (async () => {
        const userId = getUserId();
        if (!userId) {
            ratedMovies.innerHTML = `<p style="color:#aaa">Connectez-vous pour voir vos notes</p>`;
            return;
        }

        try {
            // Récupérer les notes de l'utilisateur
            const response = await apiCall(`/ratings/${userId}`);
            
            if (!response.ok) {
                ratedMovies.innerHTML = `<p style="color:#aaa;text-align:center">Vous n'avez pas encore noté de films</p>`;
                return;
            }

            const ratings = await response.json();

            if (ratings.length === 0) {
                ratedMovies.innerHTML = `<p style="color:#aaa;text-align:center">Vous n'avez pas encore noté de films</p>`;
                return;
            }

            // Charger les détails de chaque film
            const moviesDetails = await Promise.all(
                ratings.map(async r => {
                    const res = await apiCall(`/movies/${r.movie_id}`);
                    const movie = await res.json();
                    return { ...movie, user_score: r.score };
                })
            );

            // Filtrer les films avec image
            const withImage = moviesDetails.filter(m => m.image);

            ratedMovies.innerHTML = withImage.map(movie => `
                <div class="rated-card" onclick="window.location.href='movie.html?id=${movie.id}'" style="cursor:pointer">
                    <div class="rated-poster"
                        style="background-image:url('${movie.image}')"></div>
                    <div class="rated-info">
                        <h3>${movie.title}</h3>
                        <div class="meta">${movie.genre || ''} • ${movie.year || ''}</div>
                        <div class="rated-stars" onclick="event.stopPropagation()">
                            ${[1,2,3,4,5].map(s => `
                                <span class="${s <= movie.user_score ? 'active' : ''}"
                                    onclick="updateRating(${movie.id}, ${s}, this)">★</span>
                            `).join('')}
                        </div>
                        <div class="current-score" id="score-${movie.id}">
                            Votre note : ${movie.user_score}/5
                        </div>
                    </div>
                </div>
            `).join('');

        } catch (err) {
            ratedMovies.innerHTML = `<p style="color:#aaa;text-align:center">Erreur de chargement</p>`;
        }
    })();
}

async function updateRating(movieId, score, clickedStar) {
    // Mettre à jour visuellement les étoiles
    const container = clickedStar.parentElement;
    const stars = container.querySelectorAll('span');
    stars.forEach((s, i) => {
        s.classList.toggle('active', i < score);
    });

    // Mettre à jour le texte
    const scoreText = document.getElementById(`score-${movieId}`);
    if (scoreText) scoreText.textContent = `Votre note : ${score}/5`;

    // Envoyer au backend
    await rateMovie(movieId, score);
}

/* =========================
   👤 PROFILE PAGE
========================= */
const profileUsername = document.getElementById("profileUsername");

if (profileUsername) {
    const username = localStorage.getItem("username") || "Utilisateur";
    const userId = getUserId();

    // Nom
    document.getElementById("profileUsername").textContent = username;

    // Email
    const email = localStorage.getItem("email") || "";
    if (email && document.getElementById("profileEmail")) {
        document.getElementById("profileEmail").textContent = "📧 " + email;
    }

    // Date membre
    const today = new Date().toLocaleDateString('fr-FR', {
        month: 'long', year: 'numeric'
    });
    if (document.getElementById("profileMember")) {
        document.getElementById("profileMember").textContent = "🗓 Membre depuis " + today;
    }

    // Genres préférés
    const genres = JSON.parse(localStorage.getItem("selectedGenres")) || [];
    if (genres.length > 0 && document.getElementById("profileGenres")) {
        document.getElementById("profileGenres").innerHTML = `
            <p style="color:#9ca3af;margin-bottom:12px">Genres préférés :</p>
            ${genres.map(g => `<span class="genre-badge">${g}</span>`).join('')}
        `;
    }

    // Charger les stats
    (async () => {
        try {
            // Nombre de films notés
            const ratingsResponse = await apiCall(`/ratings/${userId}`);
            if (ratingsResponse.ok) {
                const ratings = await ratingsResponse.json();
                document.getElementById("statRatings").textContent = ratings.length;
            }

            // Nombre de favoris
            const favs = JSON.parse(localStorage.getItem("favoriteMovies")) || [];
            document.getElementById("statFavorites").textContent = favs.length;

            // Nombre de recommandations
            const recResponse = await apiCall(`/recommendations/${userId}`);
            if (recResponse.ok) {
                const recData = await recResponse.json();
                const recs = recData.recommendations || [];
                document.getElementById("statRecommendations").textContent = recs.length;
            }
        } catch (err) {
            console.error("Erreur stats:", err);
        }
    })();
}

// Variable globale pour stocker tous les films
let allMovies = [];

async function loadMovies() {
    try {
        const response = await apiCall("/movies/with-images/");
        const movies = await response.json();
        allMovies = movies.sort((a, b) => (b.year || 0) - (a.year || 0));
        return allMovies;
    } catch (err) {
        console.error("Erreur chargement films:", err);
        return [];
    }
}

function searchMovies(query) {
    const worldMoviesEl = document.getElementById("worldMovies");
    if (!worldMoviesEl) return;

    if (query.trim() === '') {
        // Afficher les 20 premiers films si recherche vide
        worldMoviesEl.innerHTML = allMovies.slice(0, 20).map(movieCard).join("");
        return;
    }

    // Filtrer par titre
    const filtered = allMovies.filter(m =>
        m.title.toLowerCase().includes(query.toLowerCase()) ||
        (m.genre && m.genre.toLowerCase().includes(query.toLowerCase()))
    );

    if (filtered.length === 0) {
        worldMoviesEl.innerHTML = `
            <div class="empty-simple">
                <h3>Aucun film trouvé pour "${query}"</h3>
                <p>Essayez un autre titre ou genre</p>
            </div>
        `;
        return;
    }

    worldMoviesEl.innerHTML = filtered.slice(0, 20).map(movieCard).join("");
}