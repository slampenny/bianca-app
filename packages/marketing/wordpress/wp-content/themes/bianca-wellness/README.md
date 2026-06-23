# Bianca Wellness (WordPress theme)

Marketing theme aligned with [bianca-yk4e.vercel.app](https://bianca-yk4e.vercel.app/): dark B2B layout, DM Sans, stat cards, case studies, timeline mock, and compliance sections.

## Content model

- **No marketing copy in PHP templates.** The home page body is stored in the database as block markup (`Custom HTML` blocks).
- On first activation, the theme creates a **Home** page from `data/home-page-blocks.html` and sets **Settings → Reading → Your homepage displays → A static page** to that page.
- Editors change copy in **Pages → Home** (block editor). Each section is a separate **HTML** block for easy reordering and editing.

## Install

From your machine (adjust paths if needed):

```bash
cp -r packaged-themes/bianca-wellness /path/to/wordpress/wp-content/themes/bianca-wellness
```

Or symlink for local development:

```bash
ln -s "$(pwd)/packaged-themes/bianca-wellness" /path/to/wordpress/wp-content/themes/bianca-wellness
```

Then **Appearance → Themes → Activate “Bianca Wellness”**.

Assign **Appearance → Menus** to **Primary** (optional; fallback links mirror the Vercel nav anchors until you build a menu).

## Re-seed the landing page

If you deleted the Home page and need the default content again:

1. Remove the option: `wp option delete bianca_wellness_landing_seeded` (WP-CLI) or delete it from the `wp_options` table.
2. Switch to another theme and back to Bianca Wellness, **or** create a page manually and paste the contents of `data/home-page-blocks.html` into the code editor.

## Header / footer

- **Logo:** Appearance → Customize → Site Identity, or use the site title styled as “Bianca.”
- **Footer email** is a theme default (`sales@biancawellness.com`); override in `footer.php` or move to a widget area in a future revision.

## Try the App

- Fallback nav and new menus should use **`/try-the-app/`** (on-site gate), not a bare `app.*` link.
- **When the production app is online:** `/try-the-app/` redirects to `https://app.biancawellness.com`.
- **When the app is offline:** “Try the App” links go to **Book a Demo** at `/book-a-demo/` (Contact Form 7).
- URLs are centralized in `functions.php` (`BIANCA_WELLNESS_APP_URL`, `bianca_wellness_try_app_link_url()`).
- After deploy, run `php setup-try-the-app-page.php` on the server once to create the page and fix menu URLs.
