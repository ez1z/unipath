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
- **Another bot's Mini App** could open a Clavis `/tg` link inside its own
  webview with launch data signed for that bot's user. Clavis checks the
  signature against its own bot token, so the data is refused; what remains
  is that a webview the other bot already controls can show Clavis. Nothing
  more is done about it: a real launch from the Clavis bot always replaces
  the session, and `start_param` can't be required because menu-button
  launches don't carry one.

## M7 · Admin and import

Everything here runs on the local site (`pnpm preview` or `pnpm dev`) with
the demo data. No real database is touched.

### Before you start

1. Sign in once on the local site with any email (the code is in the console).
2. `pnpm make-admin you@example.com`, then open `/admin`. Your Profile
   language is the admin's language.
3. Students who open `/admin` get a plain "Not found"; signed out, `/admin`
   asks you to sign in and comes back.

### Records

1. `/admin/universities`: search "Demo", filter by country, Drafts only and
   "Not checked for 12 months" (Demo University 5 is flagged).
2. Open Demo University 2. English, Turkmen and Russian names sit side by side
   (one under another on a phone). Change the Russian name and the city, save:
   "Saved". Open the public page in Russian: the new name and city are there at
   once, without a rebuild.
3. Leave Last checked as it was and save: it becomes today. Type another date
   and save: your date stays.
4. Untick Published, empty Source and tick Published again: saving is refused
   with "Add a source before publishing", read out with the field.
5. Set Ministry status to Approved with an empty Basis: refused.
6. Programs: leave Tuition empty and save; the public page says "Cost not
   confirmed". Pathways: a bachelor's → bachelor's pair is refused.
7. Delete: a program a student tracks can't be deleted ("Unpublish it
   instead"); a new test record can, after ticking the confirmation.
8. "History" on any record opens its audit-log rows with the changed fields.

### Logo and photo

1. On a university, choose a large JPEG or PNG as Logo, then as Photo: the
   browser shrinks them (128 px, 1200 px) and uploads WebP. Save.
2. The public page shows the photo across the top and the logo by the name.
   `/files/logos/…webp` is served with `Cache-Control: … immutable`.
3. In a browser whose canvas can't encode WebP (try Safari), the upload says
   to use another browser instead of sending a PNG.
4. Old pictures stay in R2 when replaced (keys are never reused, so cached
   copies can't go stale). Clean-up is a manual R2 task, if it is ever needed.

### Queues

1. Report a mistake on any public page. `/admin/mistakes` lists it with links
   to the record and its admin form; "Fixed" and "Not a mistake" close it.
2. Report a reply three times from three accounts: it is hidden. In
   `/admin/reports`, "Keep and show" brings it back; those three reports no
   longer count, so it takes three new reports to hide it again. "Hide" keeps
   it hidden; "Delete for good" removes it (and its votes).
3. Request "Studies here" from Profile. `/admin/badges` shows the request with
   the note; Approve puts the badge on that student's posts; Remove takes it
   away. Give the Clavis team badge by account email.

### Settings and audit

1. `/admin/settings`: set 19.5 manat for a dollar and a date; program pages
   show manat beside dollars with that date. Empty the rate: dollars only.
2. `/admin/audit` lists every write above, newest first, with who made it.
   Imports and `make-admin` show as "Script".

### Imports

1. `pnpm db:import docs/examples/records.example.json --dry-run` prints the 7
   drafts it would create. Run it without `--dry-run`: they appear in `/admin`
   as drafts and nowhere on the site. Run it again: all 7 are "Skipped".
2. Break the file (an unknown country, a slug that points nowhere, an extra
   field): nothing is imported, and every problem is listed with its place.
3. `pnpm db:import file.json --sql out.sql` writes SQL and touches no database.
4. `pnpm db:import-moe list.csv` (columns: name, country, ranking source,
   position): dry run, prints matches and writes `list.review.csv` for the
   rest. `--apply` sets the matches to Approved with "QS 312"-style bases.
5. File format for people and AI assistants: `docs/data-format.md`.

### Backups

1. `pnpm db:backup` writes `backups/<today>.sql` to the local R2 bucket
   (`--print` shows it). Sessions and sign-in codes are left out.
2. The cron `0 23 * * *` (04:00 in Ashgabat) does the same in production and
   keeps the newest 30. Restoring is in DEPLOY.md (M8).

## M8 · Launch hardening

Automatic (`pnpm e2e`, m8.spec.ts): axe finds no serious issues on public and
account pages in light and dark; the CSP blocks nothing the site uses (and does
block an injected script); security headers on every kind of response; 404 in
the address's language; sitemap and robots.txt.

Needs a person, after the first deploy (DEPLOY.md):

1. **Telegram Web**: open the Mini App at web.telegram.org. It shows inside the
   frame (frame-ancestors allows only that site). Then open
   `https://clavis.example` inside some other site's `<iframe>`: the browser
   refuses.
2. **Telegram Login Widget** on `/en/sign-in/telegram`: the button shows and
   sign-in works. The browser console shows no "Content Security Policy" lines.
3. **Google sign-in** (if set up): the round trip ends signed in.
4. **Email**: a sign-in code arrives in Gmail and Mail.ru inboxes, not spam, from
   `EMAIL_FROM`.
5. **Headers**: <https://securityheaders.com> on the home page shows CSP,
   HSTS, nosniff, Referrer-Policy and Permissions-Policy.
6. **Search engines**: submit `https://clavis.example/sitemap.xml` in Google
   Search Console and Yandex Webmaster. Check that the three languages are
   listed as alternates.
7. **Screen reader** (VoiceOver on iPhone or TalkBack): Home → Search → a
   program → Track it. Every control has a name, and the order makes sense.
8. **Lighthouse** against the live site:
   `LIGHTHOUSE_ORIGIN=https://clavis.example pnpm lighthouse` (Slow 3G phone).
   Performance 90+ and first content in under 2 seconds on every page it lists.
9. **Restore drill**: restore last night's R2 backup into a new database
   (DEPLOY.md step 10) and open a few pages against it before trusting it.
