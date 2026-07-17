# DialSort

Power dialer supervisé B2B. L'agent déclenche des appels en séquence ; dès qu'un humain décroche (détection AMD Twilio), l'agent est notifié et prend l'appel directement dans le navigateur.

## Prérequis

- Node.js ≥ 20
- PostgreSQL ≥ 15
- Redis ≥ 7
- Compte Twilio avec un numéro de téléphone actif

## Installation

```bash
git clone <repo>
cd dialsort
npm install
cp .env.example .env.local
# Remplir les variables dans .env.local
```

## Base de données (local)

```bash
# Démarrer PostgreSQL
brew services start postgresql@15

# Créer la base
createdb dialsort

# Appliquer le schéma
npm run db:migrate

# (optionnel) Interface graphique
npm run db:studio
```

## Redis (local)

```bash
brew services start redis
```

## Lancement dev

```bash
npm run dev        # Next.js sur http://localhost:3001
npm run worker     # Worker d'appels Bull (dans un second terminal)
```

## Vérifications

```bash
npm run check      # TypeScript + ESLint + Prettier
npm run build      # Build de production
```

## Variables d'environnement

Voir `.env.example` pour la liste complète et les commandes de génération.

## Tunnel Twilio (webhooks en dev)

```bash
ngrok http 3001
# Copier l'URL HTTPS dans NEXT_PUBLIC_APP_URL de .env.local
```
