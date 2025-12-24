# Humaniser Texte AI

[![Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FHumaniser-Texte-AI)

Un outil puissant pour humaniser les textes générés par IA, utilisant les technologies **Groq (Llama 3)** et **Google Gemini**.

## 🚀 Fonctionnalités

- **Humanisation IA** : Reformule les textes pour les rendre indétectables et naturels.
- **Double Moteur** :
  - `Groq Llama 3.1` (Recommandé) : Ultra-rapide et gratuit pour un usage intensif (~14k requêtes/jour).
  - `Gemini 2.5` : Pour des besoins spécifiques (Accès restreint par code admin).
- **Mode Haute Qualité** : Options pour ajuster le niveau de réécriture (Simple ou Avancé).
- **Interface Premium** : Design moderne, responsive et fluide.
- **Sécurité** : Gestion des quotas côté client pour éviter la surfacturation.

## 🛠 Installation Locale

1.  Clonez le projet :
    ```bash
    git clone https://github.com/VOTRE_USER/Humaniser-Texte-AI.git
    cd Humaniser-Texte-AI
    ```

2.  Installez les dépendances :
    ```bash
    npm install
    ```

3.  Configurez l'environnement :
    Créez un fichier `.env.local` à la racine et ajoutez vos clés (voir `.env.example`).

4.  Lancez le projet :
    ```bash
    npm run dev
    ```

## 📦 Déploiement

Ce projet est optimisé pour un déploiement sur **Vercel**.
N'oubliez pas d'ajouter les variables d'environnement sur Vercel :
- `GROQ_API_KEY`
- `GEMINI_API_KEY`
- `VITE_ADMIN_CODE` (Code secret pour protéger l'accès Gemini)

---
*Créé avec ❤️ par Anthony*
