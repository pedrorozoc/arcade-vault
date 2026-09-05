# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault — plataforma para jugar online y competir por la mayor cantidad de puntos. En estado inicial: es el scaffold por defecto de `create-next-app` (Next.js 16.3.4, App Router, React 19.2.8, TypeScript, Tailwind CSS v4), sin funcionalidad de juego implementada todavía.

## Commands

```bash
npm run dev      # servidor de desarrollo (Next.js, App Router)
npm run build    # build de producción
npm run start    # sirve el build de producción
npm run lint     # ESLint (usa eslint-config-next: core-web-vitals + typescript)
```

No hay test runner configurado todavía.

## Non-standard Next.js — read before writing code

Ver el bloque al inicio de `AGENTS.md`: esta instalación de Next.js (16.3.4) puede tener APIs y convenciones distintas a las que conoces por entrenamiento. Antes de escribir código que toque rutas, layouts, data fetching o config, revisa la guía correspondiente en `node_modules/next/dist/docs/` (carpetas `01-app`, `02-pages`, `03-architecture`, `04-community`). Presta atención a avisos de deprecación.

## Skills
Usa siempre /frontend-design para diseñar interfaces de usuario


## Architecture

- **App Router** (`app/`): `layout.tsx` es el root layout (fuentes Geist vía `next/font/google`, define `<html>`/`<body>`); `page.tsx` es la ruta `/`. Todavía no hay subrutas ni componentes compartidos — al añadir features, seguir la convención de carpetas del App Router (`app/<ruta>/page.tsx`, `layout.tsx`, etc.) documentada en `node_modules/next/dist/docs/01-app/`.
- **Alias de imports**: `@/*` mapea a la raíz del repo (`tsconfig.json`).
- **Estilos**: Tailwind v4 vía `@import "tailwindcss"` en `app/globals.css`, con tokens de tema definidos en `@theme inline` (`--color-background`, `--color-foreground`, fuentes) y soporte de dark mode por `prefers-color-scheme`. No hay `tailwind.config` — la config vive en el propio CSS (patrón de Tailwind v4).
- **`next.config.ts`**: vacío por ahora; agregar opciones ahí conforme se necesiten.

## Spec Driven Design

Este proyecto sigue un flujo de "Spec Driven Design" (ver `README.md`) basado en los comandos `/spec` y `/spec-impl`, provistos por el paquete de skills de terceros `Klerith/fernando-skills`:

```bash
npx skills@latest add Klerith/fernando-skills
```

Si esas skills no están instaladas en este entorno, instálalas antes de asumir que `/spec` o `/spec-impl` existen.
