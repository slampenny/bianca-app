# Add new pages to production without wiping posts

`push-to-production.sh` **replaces** production content tables with your local database — **do not use it** if you want to keep all existing production posts.

## 1. Deploy only the theme

```bash
cd sites/biancawellness
chmod +x push-theme-only.sh
./push-theme-only.sh
```

This uploads **`wordpress/wp-content/themes/bianca-wellness`** only. No database import.

Ensure the theme exists locally under that path (copy from `packaged-themes/bianca-wellness` if needed).

## 2. Add the new page(s) on production (pick one)

### A. WordPress export / import (good for one page + blocks)

**On local:**

1. **Tools → Export → Pages** (or “All content” if you need attachments too).
2. Download the `.xml` file.

**On production:**

1. **Tools → Import → WordPress** (install the importer plugin if prompted).
2. Upload the XML. Map authors to an existing production user.
3. If the import creates a duplicate **Home** slug, either delete the old one first or rename the imported page slug (e.g. `home-landing`) and use Reading settings below.

### B. Copy from `data/home-page-blocks.html`

1. On production, **Pages → Add New** (or edit an existing page).
2. Switch to the **Code editor** (⋮ → Code editor).
3. Paste the contents of  
   `bianca-wellness/data/home-page-blocks.html`  
   from the theme (or from this repo).
4. Publish. Set the slug (e.g. `home` or `landing`) as you prefer.

### C. WP-CLI (if available on the server)

Export a single page from local, import on prod — only if you run WP-CLI in both places.

## 3. Point the site at the new theme + front page

1. **Appearance → Themes** → activate **Bianca Wellness**.
2. **Settings → Reading**:
   - **Your homepage displays:** **A static page**
   - **Homepage:** choose the page you imported/created.
   - **Posts page:** your existing **Blog** page (unchanged).

Production **posts** stay in the database; you only added/updated **pages** and **theme files**.

## 4. What *not* to do

- Do **not** run **`push-to-production.sh`** when you need to preserve production posts, unless you’ve reconciled the DB story first.
- Full **`wp-content` rsync** from the push script also replaces uploads/plugins/themes — use **`push-theme-only.sh`** for a narrow theme deploy.
