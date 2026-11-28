# Manual checks (need real keys from Eziz)

Everything here is already covered locally with stand-ins (fake keys, a signed
Telegram login generator, codes in the dev console). These steps check the
parts only real services can: run them once real credentials exist, on a
preview deployment, never with real keys committed to the repo.

## M3 · Sign-in

### Before you start

- A deployed preview with `SITE_URL` set to its https address.
- Wrangler secrets set (see DEPLOY.md, written in M8): `BETTER_AUTH_SECRET`,
  `TELEGRAM_BOT_TOKEN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and the
  `EMAIL` send_email binding with `EMAIL_FROM`.
- `DEV_MAILBOX` must **not** be set in production (it also switches itself off
  on any non-localhost `SITE_URL`).

### Email code

1. Open `/tk/sign-in`, enter your own email, tap **Email bilen dowam et**.
2. An email arrives from `EMAIL_FROM` within a minute, in Turkmen, with a
   6-digit code. Do the same from `/ru/sign-in` and check it is in Russian.
3. Enter the code: you land on My Clav. A wrong code shows "Kod nädogry…".
4. Wait 11 minutes with a new code: it is refused (10-minute expiry).

### Telegram (Login Widget)

1. In @BotFather: `/setdomain` for the bot, set to the preview's domain
   (the widget only works on that domain).
2. Set `TELEGRAM_BOT_USERNAME` (Wrangler var) to the bot's username.
3. Open `/en/sign-in` → **Continue with Telegram** → the Telegram button shows.
   Confirm in Telegram: you land on My Clav.
4. In D1: the `user` row has email `tg-<id>@telegram.invalid`, empty `name`
   and no `image` (no real name or photo is kept).
5. **Telegram must keep our query parameters.** The return URL carries
   `state`, `next` and `fail`. If Telegram drops them, every Telegram sign-in
   fails with "Telegram sign-in failed": tell Claude, so the state can move
   into the cookie alone.
6. Sign out, then sign in with Telegram again right away: it must work. Each
   piece of signed data is accepted only once; if Telegram sends exactly the
   same data again, tell Claude.
7. Open an old callback link from browser history: it is refused.

### Google

1. In Google Cloud Console, OAuth client (Web): authorised redirect URI
   `https://<preview-domain>/api/auth/callback/google`.
2. Set the two Google secrets; **Continue with Google** now appears on the
   sign-in page and in the sheet.
3. Sign in with Google: you land on My Clav. In D1 the `user` row has your
   Google email, empty `name` and no `image`.
4. Sign out, then sign in by **email code** with the same Google address: you
   reach the same account (same saved items).

### Linking (one account, three methods)

1. Sign in by email. Profile → **Link Telegram** → confirm: Telegram shows
   "Linked". Sign out, sign in with Telegram: same saved items.
2. Profile → **Link Google**: Google shows "Linked".
3. Sign in with a fresh Telegram account, Profile → **Add email** → code: the
   email shows on Profile and email reminders can now be chosen.

### Save after sign-in

1. Signed out, open a program, tap **Save**: the sheet opens. Sign in with
   Telegram or Google from the sheet: you come back to the program, saved.
2. With JavaScript off (browser setting), tap **Save**: the sign-in page opens;
   after the code you are back on the program, and My Clav › Saved lists it.

### Delete account

1. Profile → tick the box → **Delete my account**.
2. In D1, nothing with that user id remains in `user`, `session`, `account`,
   `profiles`, `saved_items`, `tracker_items`, `share_links`.

### Locally, without real keys

- Email: codes print in the `pnpm preview` console (`[clavis mail]`).
- Telegram: open `/en/sign-in/telegram`, copy the widget's `data-auth-url`
  from DevTools, then `pnpm exec node scripts/dev-telegram-login.ts "<url>" 42`
  prints a signed link for Telegram user 42 (steps at the top of the script).
- Google: the button stays hidden until both Google secrets are set.

## M4 · Tracker and reminders

Everything else in M4 runs locally (`pnpm e2e`); only real email needs a preview.

1. Sign in by email, Profile → reminders **By email**.
2. Track a program, open it, set **your own deadline** to 7 days from today.
3. Trigger the cron once instead of waiting for 09:00 Ashgabat:
   Cloudflare dashboard → Workers → clavis → Settings → Triggers → the
   `0 4 * * *` cron → **Run** (or `wrangler dev --test-scheduled` locally and
   open `/cdn-cgi/handler/scheduled?cron=0+4+*+*+*`).
4. One email arrives, in your Profile language: "7 days left: …", with links to
   the item and to Profile. Run the trigger again: no second email.
5. Share with parents → create a link → open it in a private window: stages,
   deadlines and checklists show, your notes don't. **Stop this link**: the
   page says the link no longer works.

Locally, reminders print to the `pnpm preview` console (`[clavis mail] reminder`).

## M6 · Telegram Mini App

Locally everything runs with stand-ins (`pnpm e2e` → `tests/e2e/m6.spec.ts`,
unit tests in `tests/unit/telegram*.test.ts` and `auth.test.ts`). These steps
check the real Telegram apps.

### Before you start

- The bot from @BotFather, its token as the `TELEGRAM_BOT_TOKEN` Wrangler
  secret, and `TELEGRAM_BOT_USERNAME` set (both also used by the Login Widget, M3).
- A deployed preview on https.
- In @BotFather: `/mybots` → the bot → **Bot Settings** → **Configure Mini App**
  (or **Menu Button**) → URL `https://<preview-domain>/tg`. Optionally
  `/newapp` for a `t.me/<bot>/<app>` link with the same URL.

### Sign-in and language

1. On a phone with Telegram in **Russian**, open the bot and tap the Mini App
   button. "Открываем Clavis…" flashes, then Home opens in Russian. No sign-in
   screen appears.
2. Open My Clav: you are signed in. In D1 the new `user` row has email
   `tg-<your id>@telegram.invalid`, empty `name`, no `image`; `profiles.preferred_lang` is `ru`.
3. Profile → Language → English → Save. Close the Mini App and open it again:
   Home is in English (your Profile choice now wins over Telegram's language).
4. If you also signed in on the website with the Login Widget using the same
   Telegram account, it is the **same** account (same saved items).
5. Open `https://<preview-domain>/tg` in a normal browser: it says to open it
   from the bot, with a link to the website.

### Back button and theme

1. On Home there is no back button in Telegram's header. Open Search: a back
   arrow appears; tap it: you are back on Home. Open a program from Search,
   tap back twice: Search, then Home.
2. Switch Telegram to night mode (Settings → Chat Settings / Appearance) while
   Clavis is open: Clavis turns dark, and Telegram's header matches Clavis's
   background. Switch back: light again.
3. Profile → Theme → Light: Clavis stays light even in Telegram's night mode
   (your choice wins). Set it back to "System" to follow Telegram again.

### Share via Telegram

1. Track any program → **Share with parents** → **Create link** → **Send**.
2. Telegram's own "share to chat" picker opens (Clavis stays open behind it).
   Send it to yourself: the message has the parent link and "My applications
   on Clavis"; it opens the read-only page.

### Reminders from the bot

1. In the bot chat, press **Start** once (a bot can only write to people who
   have). Inside the Mini App, choosing Profile → reminders **In Telegram**
   also asks Telegram for that permission.
2. Track a program, set your own deadline to 7 days from today, save.
3. Run the cron (Cloudflare dashboard → Workers → clavis → Settings →
   Triggers → `0 4 * * *` → **Run**).
4. A message from the bot arrives, in your Profile language: "7 days left: …"
   with links to the item and to Profile. Run the cron again: no second message.
5. Block the bot and run the cron with a 1-day deadline: the Worker log shows
   `Telegram sendMessage 403`, and the reminder is retried on the next daily
   run (unblock the bot to receive it). The token never appears in the log.

### Locally, without a real bot

- `pnpm exec node scripts/dev-telegram-webapp.ts 100000002 ru dark` prints a
  `/tg#tgWebAppData=…` link signed with the made-up token in `.dev.vars`.
  Open it with `pnpm preview` running: you land on `/ru`, signed in, in dark.
  (A plain browser has no Telegram header, so the back button and share
  sheet are only checked by the e2e test's stand-in and on a real phone.)
- Telegram reminders print to the console (`[clavis telegram]`); nothing is sent.

### Known limit and notes for M8

- **Telegram Web** (web.telegram.org in a browser) runs Mini Apps inside a
  frame. M8's CSP must allow `frame-ancestors https://web.telegram.org` (and
  only that). Browsers that block third-party cookies may still not keep the
  sign-in there; the phone and desktop apps are not affected.
- The back button tells "first page after `/tg`" from the rest by the
  same-origin referrer, so M8's `Referrer-Policy` must keep same-origin
  referrers (`strict-origin-when-cross-origin` or `same-origin`, not `no-referrer`).
- M8's CSP hash for the inline theme script must be taken from the current
  `THEME_SCRIPT` (it now also reads Telegram's light/dark).
