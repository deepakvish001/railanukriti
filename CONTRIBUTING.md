# Contributing to RailAnukriti

Thank you for your interest in contributing to RailAnukriti! This guide will help you get started with development.

## 📋 Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Code Style Guidelines](#code-style-guidelines)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)

## 🚀 Development Setup

### Prerequisites

- **Node.js**: Version 18 or higher
- **npm**: Comes with Node.js
- **Git**: For version control

### Getting Started

1. **Clone the repository**
   ```bash
   git clone <YOUR_GIT_URL>
   cd railanukriti
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   Navigate to `http://localhost:5173`

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint for code quality |

## 📁 Project Structure

```
railanukriti/
├── public/                 # Static assets
│   ├── favicon.png
│   └── robots.txt
├── src/
│   ├── assets/            # Images and media
│   ├── components/
│   │   ├── dashboard/     # Dashboard-specific components
│   │   └── ui/            # Reusable UI components (shadcn)
│   ├── data/              # Mock data and constants
│   ├── hooks/             # Custom React hooks
│   ├── integrations/      # External service integrations
│   ├── lib/               # Utility functions
│   ├── pages/             # Route pages
│   │   └── dashboard/     # Dashboard sub-pages
│   ├── types/             # TypeScript type definitions
│   ├── App.tsx            # Main app component
│   ├── index.css          # Global styles & design tokens
│   └── main.tsx           # Entry point
├── supabase/
│   ├── functions/         # Edge functions
│   └── config.toml        # Supabase configuration
└── tailwind.config.ts     # Tailwind configuration
```

## 🎨 Code Style Guidelines

### TypeScript

- **Use TypeScript** for all new files
- **Define interfaces** for component props and data structures
- **Avoid `any` type** - use proper typing or `unknown` if necessary
- **Export types** from dedicated type files

```typescript
// ✅ Good
interface TrainCardProps {
  train: Train;
  onSelect: (id: string) => void;
}

// ❌ Avoid
const TrainCard = (props: any) => { ... }
```

### React Components

- **Use functional components** with hooks
- **One component per file** for major components
- **Use named exports** for components
- **Keep components focused** - split large components

```typescript
// ✅ Good - Focused component
export const TrainStatusBadge = ({ status }: { status: TrainStatus }) => {
  return <Badge variant={getVariant(status)}>{status}</Badge>;
};

// ❌ Avoid - Doing too much in one component
```

### Styling

- **Use Tailwind CSS** classes for styling
- **Use design tokens** from `index.css` - never hardcode colors
- **Use semantic color variables** like `text-foreground`, `bg-background`
- **All colors must be HSL** format in the design system

```tsx
// ✅ Good - Using design tokens
<div className="bg-background text-foreground border-border">

// ❌ Avoid - Hardcoded colors
<div className="bg-slate-900 text-white border-gray-700">
```

### Hooks

- **Custom hooks** should start with `use` prefix
- **Keep hooks focused** on single responsibility
- **Return consistent types** from hooks

```typescript
// ✅ Good
export const useTrainData = () => {
  const [trains, setTrains] = useState<Train[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // ...
  return { trains, isLoading, refetch };
};
```

### File Naming

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `TrainCard.tsx` |
| Hooks | camelCase with `use` prefix | `useTrainData.ts` |
| Utilities | camelCase | `formatTime.ts` |
| Types | PascalCase | `railway.ts` |
| Pages | PascalCase | `Dashboard.tsx` |

### Import Organization

Organize imports in this order:

```typescript
// 1. React and external libraries
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

// 2. Internal components
import { Button } from '@/components/ui/button';
import { TrainCard } from '@/components/dashboard/TrainCard';

// 3. Hooks and utilities
import { useTrainData } from '@/hooks/useTrainData';
import { formatTime } from '@/lib/utils';

// 4. Types
import type { Train } from '@/types/railway';
```

## 📝 Commit Guidelines

Follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `style` | Code style changes (formatting) |
| `refactor` | Code refactoring |
| `perf` | Performance improvements |
| `test` | Adding or updating tests |
| `chore` | Maintenance tasks |

### Examples

```bash
feat(dashboard): add real-time train position updates
fix(auth): resolve login redirect issue
docs(readme): update installation instructions
refactor(hooks): simplify useTrainData hook
```

## 🔀 Pull Request Process

1. **Create a feature branch**
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes** following the code style guidelines

3. **Test your changes** thoroughly

4. **Commit with meaningful messages**

5. **Push to your branch**
   ```bash
   git push origin feat/your-feature-name
   ```

6. **Open a Pull Request** with:
   - Clear title describing the change
   - Description of what was changed and why
   - Screenshots for UI changes
   - Reference to related issues

### PR Checklist

- [ ] Code follows the style guidelines
- [ ] No TypeScript errors or warnings
- [ ] Components are responsive
- [ ] Dark theme is properly supported
- [ ] No hardcoded colors (using design tokens)
- [ ] New components have proper TypeScript types

## 🤝 Need Help?

- **Questions**: Open a GitHub issue with the `question` label
- **Bugs**: Open an issue with the `bug` label and reproduction steps
- **Features**: Open an issue with the `enhancement` label

---

Thank you for contributing to RailAnukriti! 🚂
