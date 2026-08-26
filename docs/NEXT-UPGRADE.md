# Text to Handwriting — Next Upgrade Roadmap

## Priority 1: True offline Android build

The current Android workflow is a TWA. A TWA still depends on the web app being available and cached. For guaranteed airplane-mode-first-launch support, create a second Android target that bundles the web assets locally in the APK.

Requirements:
- Bundle HTML/CSS/JS/assets into Android assets.
- Use a local WebView origin for the app shell.
- Keep the same JavaScript handwriting engine.
- Keep IndexedDB/localStorage inside the app sandbox.
- Support PNG/PDF generation without network access.
- Do not remove the existing TWA workflow; keep it as the lightweight release path.

## Priority 2: Offline dependency audit

Before claiming 100% offline support, remove or bundle every essential external dependency, especially CDN CSS/JS and externally hosted fonts.

Checklist:
- Tailwind/CDN dependency
- Font Awesome
- Google Fonts / remote fonts
- Remote images
- Remote JavaScript
- Remote CSS

## Priority 3: Generated page history

Generated pages should be stored newest-first in IndexedDB:
- thumbnail
- source text
- settings snapshot
- paper snapshot
- generated timestamp
- exported file metadata

Actions: open, duplicate, rename, delete, download.

## Priority 4: Multi-page documents

Add document/page model:
- document title
- ordered pages
- automatic page breaks
- page reorder
- duplicate/delete page
- multi-page PDF

## Priority 5: Mobile editor

Use a mobile-specific bottom toolbar:
- Text
- Style
- Paper
- Draw
- Export

Keep the existing desktop layout intact.

## Quality gates

Every release should be tested at 360x800, 390x844, 412x915, 430x932, 768x1024, 1366x768 and 1920x1080.

Offline test:
1. Load online.
2. Close the app.
3. Disable network.
4. Reopen.
5. Type/edit.
6. Generate.
7. Export PNG/PDF.
8. Reload while offline.
9. Confirm the document remains available.
