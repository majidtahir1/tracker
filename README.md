This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Accounts

The tracker is multi-user. Sign in with a username and password at `/login`;
anyone with the URL can create an account at `/signup` (intended for a small
trusted group — there is no email verification or password reset).

- Each account gets its own settings, training block, workout history,
  measurements, photos, nutrition/recovery logs, goals, notifications, and
  WHOOP connection. The exercise catalog and programs are shared.
- Set `BETTER_AUTH_SECRET` (32+ chars) and `BETTER_AUTH_URL` in `.env`
  (see `.env.example`).
- Pre-multi-user databases were migrated to the owner account in July 2026
  via a one-time script (`prisma/migrate-multi-user.ts`, since removed —
  see git history). Fresh installs need no migration: run `npm run db:seed`
  for the catalog and sign up.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
