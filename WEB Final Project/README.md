# Internet Cafe - Final Project

Multi-page responsive website for a gaming cafe (HTML, CSS, JavaScript, jQuery). No backend, no build step.

## Pages
`index.html` · `services.html` · `games.html` · `team.html` · `contact.html` · `login.html` · `signup.html` · `profile.html`

## Features
- Light / dark toggle in the header, saved in localStorage (`cafe_theme`)
- Sign up / log in / profile simulated with localStorage (demo only: never store plain-text passwords in a real site)
- Form validation without HTML validation attributes (email, phone, password length and complexity, required fields)
- Game Deals page using the public CheapShark API: search, store / price / rating filters, sorting, load more, saved deals
- Live filter, autocomplete, highlight search, counters, toasts, copy buttons, lazy loading (jQuery, Assignment 6)

## Folder structure
```
index.html, services.html, games.html, team.html, contact.html,
login.html, signup.html, profile.html
css/style.css
js/utils.js    helpers: localStorage, validation rules, favourites
js/auth.js     sign up, log in, profile, header buttons
js/script.js   theme switch, menu, gallery, jQuery effects, booking form
js/games.js    Game Deals page (CheapShark API)
images/
```

## Run locally
Open `index.html` in a browser, or run `python -m http.server` in this folder and open http://localhost:8000.
