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
   open `/__scheduled?cron=0+4+*+*+*`).
4. One email arrives, in your Profile language: "7 days left: …", with links to
   the item and to Profile. Run the trigger again: no second email.
5. Share with parents → create a link → open it in a private window: stages,
   deadlines and checklists show, your notes don't. **Stop this link**: the
   page says the link no longer works.

Locally, reminders print to the `pnpm preview` console (`[clavis mail] reminder`).
