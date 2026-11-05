# Soon

A shared calendar for two. See when you're both free, plan the next visit, and count down to it.

- **Home** counts down to the next visit with a sunflower that opens from bud to full bloom over the last four weeks. Below it: the next trip, the next weekend you're both free, anything waiting on an answer, and the coming weekends at a glance.
- **Weekends** show both of you hour by hour (busy blocks only, never titles), plus a Free / Maybe / Can't answer per day for the things a calendar doesn't know.
- **Calendar** lets you tap a first and last day to check a trip, and lists what's in the way.
- **Proposals** go to the other person with a notification. When they say yes, the plan lands on both Google Calendars, each with its own title and privacy setting.
- **On the way**: on a visit day, the traveller taps *Leaving now* and the other person gets "on the way · there around 5:30". It uses the drive time you set, not location.

It's a home-screen web app (PWA) built with Next.js, Postgres and the Google Calendar API.

---

## Try it in demo mode

No database, no Google: just sample data laid out around today.

```bash
npm install
npm run dev
```

Open http://localhost:3000 and pick a person to look around as.

---

## Set it up for real

About 20 minutes, once.

### 1. Secrets

```bash
npm run keys
```

Copy the four lines it prints (`SESSION_SECRET`, `TOKEN_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`) somewhere safe. They go into Vercel in step 4.

### 2. Google Cloud (sign-in + calendar access)

1. Go to https://console.cloud.google.com and create a project called **Soon**.
2. **APIs & Services → Library**: enable **Google Calendar API**.
3. **Google Auth Platform → Branding** (the OAuth consent screen): app name **Soon**, your email as support and developer contact. User type: **External**.
4. **Data access → Add or remove scopes**: add
   - `.../auth/calendar.freebusy`
   - `.../auth/calendar.calendarlist.readonly`
   - `.../auth/calendar.events.owned`
5. **Audience → Publish app** so it's **In production**. Don't leave it in *Testing*: in testing, Google expires the sign-in every 7 days. You don't need Google's verification for two people; you'll each see a "Google hasn't verified this app" screen once and tap **Advanced → Go to Soon**.
6. **Clients → Create client → Web application**.
   - Authorized redirect URI: `https://YOUR-DOMAIN/api/auth/callback` (add `http://localhost:3000/api/auth/callback` too if you want to test locally).
   - Copy the **Client ID** and **Client secret**.

If your calendar lives in a Google Workspace account (e.g. a company domain), check **Admin console → Security → API controls** allows third-party apps, or mark Soon's client ID as trusted.

### 3. Database

Any Postgres works. Easiest: in Vercel, **Storage → Create → Neon** (free tier) and connect it to the project; it sets `DATABASE_URL` for you. Soon creates its tables on first run.

### 4. Deploy on Vercel

Import the repo in Vercel, then add these environment variables:

| Variable | Value |
| --- | --- |
| `SOON_PEOPLE` | `[{"id":"tachi","name":"Tachi","email":"YOUR-GOOGLE-EMAIL","home":"San Antonio"},{"id":"annie","name":"Annie","email":"HER-GOOGLE-EMAIL","home":"Austin"}]` |
| `SOON_URL` | `https://YOUR-DOMAIN` (no trailing slash) |
| `SOON_TIMEZONE` | `America/Chicago` |
| `SOON_DRIVE_MINUTES` | `105` |
| `SOON_NOTE` | The handwritten line on her welcome screen |
| `DATABASE_URL` | From step 3 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | From step 2 |
| `SESSION_SECRET`, `TOKEN_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | From step 1 |
| `VAPID_SUBJECT` | `mailto:YOUR-EMAIL` |

Only the two emails in `SOON_PEOPLE` can sign in.

### 5. On each iPhone

1. Open the site in **Safari** and sign in with Google.
2. **Share → Add to Home Screen**, then open Soon from the Home Screen.
3. Tap **Turn on notifications**. (iOS only allows web notifications for apps on the Home Screen.)

---

## How "free" is decided

Soon reads only free/busy from Google, so it never sees event titles. A day counts as **busy** when:

- Saturday or Sunday has 6+ busy hours between 9 am and 9 pm, or
- a weekday has 3+ busy hours in the evening (after 5:30 pm), or
- any day is busy 20+ hours (travel, all-day "busy" events).

Ordinary 9–5 workdays don't count, otherwise every weekday would look blocked. The rules live in `src/lib/availability.ts`.

**One Google quirk:** all-day events default to *Show as: Free*, so a trip entered as an all-day event won't block anything unless it's set to *Busy*. The **Can't** answer on any day covers this.

## Privacy

- Google refresh tokens are encrypted at rest (AES-256-GCM, `TOKEN_KEY`).
- Plans written to your calendar can be marked **private**: anyone else who can see your calendar sees "busy". People with edit access to your calendar (an assistant, say) can still open private events, so pick a neutral title too.
- Settings let each person choose which of their calendars count.

## Project map

```
src/app/            pages (home, weekend, calendar, propose, plans, settings, welcome, hello)
src/app/actions.ts  everything that changes data
src/app/api/        Google sign-in, notifications
src/lib/            availability rules, Google client, data loaders, storage (demo + Postgres)
src/components/     sunflower, dots, month picker, forms
public/sw.js        service worker for notifications and the app badge
```

## Later

Home-screen and lock-screen widgets need a native iOS app. The plan is a small companion app that reads the same data: a countdown widget with the blooming sunflower, a lock-screen ring, and a Live Activity for "on the way".
