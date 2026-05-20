# Spectra Variant Images & Swatches

A next-generation Shopify app for variant image filtering and visual swatches.

## Features

### Storefront
- **Product Gallery Filtering**: Show only images for the selected variant
- **Visual Swatches**: Color and image-based variant selectors
- **Collection Swatches**: Variant swatches on collection pages
- **Zero API Calls**: All data stored in Shopify metafields for instant loading

### Admin
- **Product Editor**: Drag-and-drop variant image assignment
- **AI Auto-Assign**: Multi-language intelligent image matching
- **Bulk Operations**: Configure multiple products at once
- **Settings Manager**: Configure swatch appearance per product

## Tech Stack

- **Backend**: Node.js + TypeScript + Remix
- **Database**: SQLite (dev) / PostgreSQL (prod) with Prisma ORM
- **Admin UI**: React + Shopify Polaris
- **Storefront**: Theme App Extension (Vanilla JS for performance)

## File Structure

```
app/
├── routes/
│   ├── app._index.tsx          # Dashboard
│   ├── app.products.tsx         # Products list
│   ├── app.products.$id.tsx     # Product editor
│   ├── app.ai.tsx               # AI auto-assign
│   └── app.api.product.$productId.tsx  # API endpoints
├── models/
│   └── spectra.server.ts        # Database models & queries
├── shopify.server.ts            # Shopify auth & API
└── db.server.ts                 # Prisma client

extensions/
└── spectra-theme-extension/
    ├── extensions/
    │   ├── product-gallery.js   # Gallery filtering logic
    │   ├── variant-swatches.js  # Swatch rendering
    │   └── collection-swatches.js  # Collection page swatches
    ├── blocks/
    │   └── spectra-embed.liquid # App embed with settings
    └── snippets/
        ├── spectra-data.liquid  # Product data injection
        └── spectra-collection-data.liquid

prisma/
└── schema.prisma                # Database schema
```

## Metafield Schema

| Namespace | Key | Owner | Type | Description |
|-----------|-----|-------|------|-------------|
| `spectra` | `variant_media` | variant | `list.json` | Array of media GIDs |
| `spectra` | `global_media` | product | `list.json` | Shared media GIDs |
| `spectra` | `swatch_color_hex` | variant | `single_line_text` | Swatch color hex |
| `spectra` | `primary_option` | product | `single_line_text` | Option that drives gallery |

## Development

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Start dev server
npm run dev
```

## Deployment

```bash
# Build for production
npm run build

# Deploy to Shopify
shopify app deploy
```

## Roadmap

### Sprint 1 (Current)
- [x] Project scaffolding
- [x] Database schema
- [x] Theme extension (gallery, swatches)
- [x] Admin API routes
- [x] Product editor UI
- [ ] Manual assignment complete
- [ ] Metafield read/write to Shopify

### Sprint 2
- [ ] Swatches completion
- [ ] Admin polish
- [ ] Accessibility audit

### Sprint 3
- [ ] Bulk operations
- [ ] AI integration with Claude API
- [ ] Queue system

### Sprint 4
- [ ] Collection swatches
- [ ] Product grouping

### Sprint 5
- [ ] Bundles/AOV features
- [ ] App Store submission

## License

Proprietary
