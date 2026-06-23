# Marketing site scripts

## Blog posts

WordPress stores blog posts in the database (`wp_posts`). These scripts are a **one-time bulk import** for the initial 24 scheduled articles.

| File | Purpose |
|------|---------|
| `blog-posts-seed.json` | Import payload (title, slug, excerpt, schedule, HTML body) |
| `seed-blog-posts.php` | Creates `future` posts in WordPress; skips existing slugs |
| `attach-blog-images.php` | Adds Unsplash featured images to seeded posts missing thumbnails |
| `deploy-and-seed-blog.sh` | Deploys theme templates + runs seed on production |

After seeding, manage posts in **wp-admin** (Posts → All Posts). Do not expect content to live as HTML files in the theme.

```bash
# Local / server (with WordPress loaded):
UNSPLASH_ACCESS_KEY=... wp eval-file packages/marketing/scripts/seed-blog-posts.php \
  --path=/opt/bitnami/wordpress --allow-root
```
