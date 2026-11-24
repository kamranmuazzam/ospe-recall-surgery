# OSPE Recall (Surgery Paper-1) — Static Web App

A high-yield, interactive active recall and exam simulation web application for **DU Final Prof MBBS Surgery Paper-1**, extracted and adapted from the Android APK (`OSPE_Recall_Surgery_P1 2.0.apk`).

Prepared originally by **Ashiqur Rahman Rakib (GSVMC-26)** / Rakib's Visual Aid (RVA). See [LICENSE](LICENSE) for full attribution and licensing.

---

## 🚀 Quick Start (Local)

Because this web app uses vanilla HTML5, CSS3, and modern JavaScript with no external build tools required, you can run it immediately using any of these methods:

### Method 1: Instant Python Local Server (Recommended)
```bash
python3 -m http.server 8080
```
Then open [http://localhost:8080](http://localhost:8080) in your web browser.

### Method 2: Node.js (npx serve)
```bash
npx serve .
```

### Method 3: Direct File Open
You can also directly double-click `index.html` in Finder or run:
```bash
open index.html
```

---

## 🌐 Deploy as a Static Website (Free)

The application is 100% self-contained and static. You can deploy it to any static host with zero build step:

### Option A: GitHub Pages
1. Push this directory to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of OSPE Recall Surgery Paper 1 web app"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```
2. In your GitHub repository:
   - Go to **Settings** > **Pages**.
   - Under **Build and deployment** > **Source**, select **Deploy from a branch**.
   - Select Branch: `main` / Folder: `/ (root)`.
   - Click **Save**. Your site will be live at `https://<your-username>.github.io/<your-repo-name>/` in ~1 minute!

### Option B: Cloudflare Pages
1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/) > **Workers & Pages**.
2. Connect your Git repository or use Direct Upload.
3. Build command: None (leave blank).
4. Output directory: `/` (or leave blank).

### Option C: Netlify Drop (Instant Drag & Drop)
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop).
2. Drag and drop this folder (`/Users/kamran/game`).
3. Netlify will deploy it immediately and give you a free live URL with HTTPS.

### Option D: Vercel
```bash
npx vercel
```
Set framework preset to **Other** and root directory to `./`.

---

## 📊 APK Analysis Summary

| Item | Details |
|------|---------|
| **Original Package** | `com.rva.osperecall.surgeryp1` |
| **APK Architecture** | Single Android WebView shell (`MainActivity.java`) loading `file:///android_asset/index.html` |
| **Frontend Stack** | Pure Vanilla HTML5, CSS3, ES6 JavaScript, Web Audio API (procedural audio chimes) |
| **Stations** | 10 Clinical OSPE Stations |
| **Cards** | 130 Two-Sided Flashcards with Image Magnifier/Pinch-Zoom |
| **Past Paper Sessions** | 19 PYQ Sessions (2015 – 2024 DU Final Prof) |
| **Clinical Media** | 281 Clinical images (X-Rays, Path Specimens, Instruments, Appliances, Photos) |
| **Offline Capability** | 100% offline via LocalStorage + Service Worker PWA support |

---

## 🩺 Key Features & Modules

1. **Dashboard**:
   - Live study analytics: Masteries, Review Counts, Streaks, XP and Career Accuracy.
   - 9 Surgical Ranks (from *Surgical Clerk* to *Professor of Surgery*).
   - Milestone ceremony: Unlocking the official `Dr.` title (removing `(Dr.)` brackets).
   - Export & Import progress JSON to sync across phones, laptops, and tablets.

2. **Active Recall Mode**:
   - High-yield dual-sided flashcards with high-resolution image zoom & pan.
   - Structured reveals: Diagnosis, Findings, Operative management, Viva pearls, and High-Yield tips.
   - Spaced Repetition ratings: **Again** (1 min), **Hard** (10 min), **Good** (1 day), **Easy** (4 days).
   - Filter by Station, PYQ Tier (Tier-1 High Yield), Starred/Bookmarked, or Due cards.

3. **Rapid Fire (30s Blitz Exam Arena)**:
   - Fast-paced timed examination simulator.
   - Leaderboard and Surgical Hall trophies.

4. **Mindmap**:
   - Visual interactive knowledge graph linking stations, topics, pathology, and key clinical signs.

5. **Revision & PYQ Directory**:
   - Comprehensive archive of 19 Past Year Question papers (2015–2024).
   - Real-time instant search across all 130 cards and 10 stations.

6. **Keyboard Shortcuts (Desktop)**:
   - `Space`: Flip Flashcard
   - `1`: Rate "Again" (Forgotten)
   - `2`: Rate "Hard" (Partial Recall)
   - `3`: Rate "Good" (Total Recall)
   - `Arrow Left` / `Arrow Right`: Previous / Next Card
   - `Esc`: Close Modals / Image Lightbox

7. **Theming & Audio**:
   - Dark Obsidian Mode and Clean Light Mode toggle.
   - Synthesized procedural sound effects with mute toggle.
