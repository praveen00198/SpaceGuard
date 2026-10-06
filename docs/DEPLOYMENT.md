# SpaceGuard AI — Deployment

## Local Development

### Prerequisites
- Node.js 20+
- Python 3.11+
- MongoDB 7+
- npm or yarn

### Setup
```bash
# 1. Clone repository
git clone <repo-url>
cd spaceguard-ai

# 2. Configure environment
cp .env.example .env
# Edit .env with your API keys

# 3. Install frontend dependencies
cd frontend && npm install

# 4. Install backend dependencies
cd ../backend && npm install

# 5. Install ML service dependencies
cd ../ml-service && pip install -r requirements.txt

# 6. Start MongoDB
mongod --dbpath /data/db

# 7. Start all services
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3: ML Service
cd ml-service && uvicorn app.main:app --reload --port 8000
```

## Docker Compose (Future)

```yaml
# docker-compose.yml will include:
# - frontend (nginx)
# - backend (node)
# - ml-service (python)
# - mongodb
```

## Production Considerations
- Use environment-specific `.env` files
- Enable production logging
- Configure MongoDB replica set
- Set up TLS/HTTPS
- Configure proper CORS origins
- Enable rate limiting
- Set up monitoring and alerting
