# SpaceGuard AI — Skills

## Evaluated Skills

### 1. Anthropic Frontend Design Skill

| Field | Value |
|-------|-------|
| **Skill** | Frontend Design |
| **Repository** | https://github.com/anthropics/skills |
| **Purpose** | High-quality frontend implementation guidance |
| **Why useful** | Provides design principles for avoiding generic AI dashboard aesthetics; encourages intentional typography, color, and layout choices |
| **License** | MIT |
| **How SpaceGuard uses it** | Reference for frontend design decisions; not installed as runtime dependency |
| **Status** | EVALUATED — Used as design reference |

### 2. UI/UX Pro Max

| Field | Value |
|-------|-------|
| **Skill** | UI/UX Pro Max |
| **Repository** | Various community repositories |
| **Purpose** | Dashboard design, chart selection, UX patterns |
| **Why useful** | Guidance on scientific dashboard layouts, data-dense interfaces |
| **License** | Varies |
| **How SpaceGuard uses it** | Reference for dashboard layout patterns |
| **Status** | EVALUATED — Principles incorporated into Design System |

### 3. React + TypeScript Best Practices

| Field | Value |
|-------|-------|
| **Skill** | React/TypeScript patterns |
| **Repository** | Various (React docs, TypeScript handbook) |
| **Purpose** | Component architecture, type safety, hooks patterns |
| **Why useful** | Ensures consistent, maintainable React codebase |
| **How SpaceGuard uses it** | Adopted patterns: custom hooks for API calls, Zod for runtime validation, service layer for API clients |
| **Status** | EVALUATED — Patterns adopted |

### 4. FastAPI ML Service Patterns

| Field | Value |
|-------|-------|
| **Skill** | FastAPI + scikit-learn integration patterns |
| **Repository** | FastAPI documentation, scikit-learn documentation |
| **Purpose** | Clean ML API design, model serving, Pydantic schemas |
| **Why useful** | Establishes clean boundary between ML inference and backend |
| **How SpaceGuard uses it** | ML service API design with Pydantic validation |
| **Status** | EVALUATED — Patterns adopted |

## Skill Safety Protocol

For every external skill considered:
1. ✅ Inspect repository README and license
2. ✅ Review skill instruction files
3. ✅ Check for arbitrary code execution
4. ✅ Verify relevance to SpaceGuard
5. ✅ Document decision

No external skills are installed as runtime dependencies. All useful patterns are incorporated directly into SpaceGuard's codebase and documentation.

## Decision

**No external skill packages are installed.** All useful guidance has been incorporated into:
- `docs/DESIGN_SYSTEM.md` — frontend design patterns
- `AGENTS.md` — coding guidelines
- Project configuration files — linting, formatting, testing patterns
