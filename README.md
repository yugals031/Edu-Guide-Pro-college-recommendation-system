# EduGuide Pro - College Recommendation System

EduGuide Pro is a complete frontend-only college recommendation platform for students from Chandigarh, Panchkula, Kalka, Baddi, Solan, and Rajpura.

## What It Uses

- HTML
- CSS
- Vanilla JavaScript
- Local JSON dataset through `fetch("./colleges.json")`
- Browser `localStorage` for user-added reviews

It does not use Node.js backend, MongoDB, Firebase, React, blockchain, Web3, MetaMask, or server-only APIs.

## Pages

- `index.html` - cinematic landing page
- `explore.html` - search, filters, and recommendation cards
- `details.html` - courses, fees, placements, hostel, transport, reviews, website, and maps
- `colleges.json` - 70+ college records
- `fallback.jpg` - local fallback image for card/detail image errors

## GitHub Pages Deployment

1. Push this folder to a GitHub repository.
2. Open the repository on GitHub.
3. Go to **Settings**.
4. Go to **Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Select the branch, usually `main`.
7. Select the root folder `/`.
8. Save.
9. Open the published GitHub Pages URL.

## Local Testing

Because the dataset is loaded with `fetch("./colleges.json")`, use a local static server instead of opening files directly:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Review Storage

Reviews added from the details page are saved in the visitor's own browser using `localStorage`. No login or remote database is required.
