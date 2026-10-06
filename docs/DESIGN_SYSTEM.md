# SpaceGuard AI — Design System

## Typography
- **Primary Font**: Inter (Google Fonts)
- **Monospace**: JetBrains Mono (for telemetry values, codes)
- **Heading Sizes**: 2rem, 1.5rem, 1.25rem, 1rem
- **Body**: 0.875rem (14px)
- **Small**: 0.75rem (12px)

## Colors

### Semantic Status Colors
| Status | Color | Hex | Usage |
|--------|-------|-----|-------|
| Nominal | Green | `#22c55e` | Normal operation |
| Warning | Amber | `#f59e0b` | Degraded / caution |
| Critical | Red | `#ef4444` | Critical / failure |
| Information | Blue | `#3b82f6` | Informational |
| Unknown | Gray | `#6b7280` | Insufficient data |

### Background
| Context | Color |
|---------|-------|
| Primary background | `#0f172a` (slate-900) |
| Card background | `#1e293b` (slate-800) |
| Elevated surface | `#334155` (slate-700) |
| Border | `#475569` (slate-600) |

### Text
| Context | Color |
|---------|-------|
| Primary text | `#f1f5f9` (slate-100) |
| Secondary text | `#94a3b8` (slate-400) |
| Muted text | `#64748b` (slate-500) |

## Spacing
Base unit: 4px (`0.25rem`)
- xs: 4px, sm: 8px, md: 16px, lg: 24px, xl: 32px, 2xl: 48px

## Components

### Cards
- Dark background with subtle border
- No excessive rounded corners (use border-radius: 8px)
- No glassmorphism unless serving information hierarchy

### Charts
- Use Recharts
- Dark theme with light grid lines
- Clear axis labels with units
- Anomaly markers as vertical lines or shaded regions
- Threshold lines as dashed horizontal lines
- Tooltips with value, timestamp, and source

### Status Indicators
- Colored dots (8px) for inline status
- Colored badges for severity labels
- Pulsing animation ONLY for active critical alerts

### Tables
- Compact rows for dense data
- Alternating row shading (subtle)
- Sortable columns where applicable
- Status-colored indicators in cells

## Chart Conventions
- Time on x-axis (UTC)
- Parameter value on y-axis with unit
- Baseline as dashed gray line
- Threshold as dashed red/amber line
- Anomaly regions as semi-transparent red overlay
- Legend when multiple series present

## Accessibility
- WCAG 2.1 AA contrast ratios
- Keyboard navigation for interactive elements
- Aria labels on status indicators
- Color not sole conveyor of information (icons + text)
- Focus indicators visible

## Interaction Rules
- Hover effects on clickable elements
- Loading skeletons (not spinners) for data loading
- Meaningful empty states ("No anomalies detected" not blank)
- Error states with retry options
- Tooltips for abbreviated labels
