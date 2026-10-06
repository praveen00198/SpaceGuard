# SpaceGuard AI — Security

## Environment Variables
All secrets stored in `.env` (gitignored). Template in `.env.example`.

## Secret Management
- Gemini API key: backend only, never in frontend
- NASA API key: backend only
- SatNOGS token: backend only
- MongoDB credentials: backend only
- No secrets committed to Git (enforced by `.gitignore`)

## Input Validation
- All API inputs validated with Zod schemas
- ML service inputs validated with Pydantic
- Reject malformed data before processing

## Authentication & Authorization
- API rate limiting (configurable window and max)
- CORS restricted to configured origins
- Secure HTTP headers (helmet.js)

## API Security
- Rate limiting: 100 requests per 15-minute window (configurable)
- CORS: Configured to specific frontend origin
- Helmet: Security headers (X-Frame-Options, CSP, etc.)
- No API keys in error responses
- Input sanitization

## Error Sanitization
- Internal errors logged with full details
- Client error responses contain code and message only
- Stack traces never exposed to clients
- Database errors never exposed to clients

## Data Security
- Telemetry data stored locally (MongoDB)
- External API data cached server-side
- No PII in telemetry (satellite data only)
- Simulation data explicitly labeled
