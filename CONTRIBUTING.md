# Contributing to SpaceGuard AI

Thank you for your interest in contributing to SpaceGuard AI.

## Development Philosophy

Before contributing, please read `AGENTS.md` for coding rules and architectural guidelines.

### Core Principles

1. **Evidence over invention** — AI reasons over evidence; AI does not invent evidence.
2. **Data provenance** — Every dataset must have a documented origin.
3. **Semantic separation** — Anomaly scores, health scores, fault probabilities, and causal confidence are distinct concepts.
4. **Graceful degradation** — The system must remain functional if any external service (Gemini, NOAA, SatNOGS) is unavailable.
5. **No false claims** — Never claim performance metrics that have not been experimentally validated.

## Getting Started

1. Fork the repository
2. Clone your fork
3. Copy `.env.example` to `.env` and configure
4. Install dependencies (see README.md)
5. Run tests before submitting

## Pull Request Process

1. Create a feature branch from `main`
2. Follow the coding standards in `AGENTS.md`
3. Add tests for new functionality
4. Update documentation if needed
5. Ensure all tests pass
6. Submit a pull request with a clear description

## Code Style

- **TypeScript** (frontend/backend): Follow ESLint + Prettier configuration
- **Python** (ML service): Follow Black + Ruff configuration
- Use strong typing everywhere
- Keep business logic out of route handlers and UI components

## Reporting Issues

Use GitHub Issues. Include:
- Clear description
- Steps to reproduce
- Expected vs actual behavior
- Environment details

## Architecture Decisions

Significant architecture changes should be discussed in an issue first and recorded in `docs/DECISIONS.md`.
