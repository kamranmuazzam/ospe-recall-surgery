# OSPE Recall Hub — DU Final Prof MBBS Surgery (Paper-1 & Paper-2)

A comprehensive, offline-first active recall, exam simulation, and past-paper revision system for **DU Final Prof MBBS Surgery Paper-1 & Paper-2**, extracted and adapted from Android APKs (`OSPE_Recall_Surgery_P1 2.0.apk` & `OSPE_Recall_Surgery_P2 2.0.apk`).

Curated and prepared originally by **Ashiqur Rahman Rakib (GSVMC-26)** / Rakib's Visual Aid (RVA). See [LICENSE](LICENSE) for full credits and licensing.

---

## 🌐 Live Web App

The repository is configured with GitHub Pages at:
**[https://kamranmuazzam.github.io/ospe-recall-surgery-p1/](https://kamranmuazzam.github.io/ospe-recall-surgery-p1/)**

From the main portal, students can launch either Paper-1 or Paper-2 and seamlessly switch between them using the top-bar navigation switcher.

---

## 📚 Paper Architecture

### [Surgery Paper-1 (General Surgery & Orthopaedics)](./p1/)
- **10 Clinical Stations** (60 Marks Total):
  - **ST-01**: Plain X-Rays & Emergencies (KUB calculi, bowel obstruction, pneumoperitoneum, pneumothorax)
  - **ST-02**: Contrast Radiology (Barium Swallow, Barium Meal, T-Tube Cholangiogram, IVU)
  - **ST-03**: Orthopaedics X-Rays (Clavicle, Supracondylar, Neck of Femur, Colles', Bone Tumours)
  - **ST-04**: Surgical Pathology Specimens (Ca Stomach, Cholecystectomy, Appendix, Mastectomy, Calculi)
  - **ST-05**: Surgical Instruments (Open, Laparoscopic, Orthopaedic bone instruments)
  - **ST-06**: Appliances I (Endotracheal tubes, Foley catheters, Ryle's NG tube, Chest drains)
  - **ST-07**: Clinical Photos & Pictograms (Rule of 9s Burns, Scrotal emergencies, Ulcers & Tumours)
  - **ST-08**: Clinical Scenarios & Lab Data (FAST, GOO alkalosis, DU perforation, Acute pancreatitis)
  - **ST-09**: Procedure Checklists & Counseling (Gloving, Blade assembly, IV infusion, Catheterization)
  - **ST-10**: Appliances II (Sutures, Prolene mesh, POP & bandages, IV cannulae)
- **130 Two-Sided Active Recall Flashcards**
- **19 Past Exam Pools** (2015–2026 DU Final Prof)
- **281 High-Resolution Clinical Images**

### [Surgery Paper-2 (Ophthalmology & ENT)](./p2/)
- **10 Clinical Stations** (40 Marks Total) + **Audiogram Masterclass Lab**:
  - **ST-01**: Ophthalmology Photos, Fundus & Optics (Corneal ulcers, leukocoria, fundus lesions)
  - **ST-02**: Ophthalmology Specimens & Lenses (PCIOL, trial lens sets, spherical lenses)
  - **ST-03**: Ophthalmology Instruments & Tonometers (Chalazion clamp, Ophthalmoscope, Slit-lamp)
  - **ST-04**: Drugs Used in Eye (Atropine, Tropicamide, Proparacaine, Moxifloxacin, Pred Forte)
  - **ST-05**: Ophthalmology Scenarios & Procedures (Uveitis vignettes, Light reflex, Visual fields)
  - **ST-06**: ENT Clinical Photos & Otoscopy (Tonsillitis, Rhinosporidiosis, CSOM safe/unsafe, CN VII)
  - **ST-07**: ENT Resected Specimens (Thyroidectomy, Antrochoanal polyp, Tonsillectomy)
  - **ST-08**: ENT Instruments & Diagrams (Thudichum, Lack's, Tuning fork, Tracheostomy, Luc's, IDL)
  - **ST-09**: ENT Plain & Contrast X-Rays (Achalasia, Adenoids, Foreign body, Water's PNS, Mastoid)
  - **ST-10**: ENT Audiograms & Tuning Fork Procedures (PTA otosclerosis, Carhart's notch, OME Type B)
- **106 Two-Sided Active Recall Flashcards**
- **Interactive PTA Audiogram Lab** & Tuning Fork Simulator
- **293 High-Resolution Clinical Images**

---

## 🚀 Running Locally

Because the web application is 100% static vanilla HTML5, CSS3, and ES6 JavaScript, no build steps are required.

### Instant Python Server
```bash
python3 -m http.server 8080
```
Then open [http://localhost:8080](http://localhost:8080) in your web browser.

---

## 🩺 Key Features

1. **Integrated Paper Switcher**: Toggle between Paper 1 and Paper 2 directly from the top header without losing your place.
2. **Spaced-Repetition System**: Independent SM-2 spaced repetition tracking for both papers stored locally in browser storage.
3. **30s Blitz Rapid-Fire Arena**: Fast-paced timed examination simulator with audio chimes and anonymous leaderboard ranks.
4. **Interactive Mindmap**: Station-to-station clinical topic graph for holistic conceptual revision.
5. **PWA Offline Support**: Both Paper-1 and Paper-2 register independent service workers with local precaching.
