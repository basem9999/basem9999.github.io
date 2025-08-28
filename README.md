# My GraphQL Profile

## Quick summary

This repository is my personal **GraphQL profile UI** built for the Reboot01 learning platform. It is a real implementation (not just a spec): a static frontend that performs signin to the platform, fetches **user-specific** data from the GraphQL API, and renders the profile sections and SVG statistics. The code is organized into small ES modules so each view/component is easy to edit.

---

## What this project actually offers

* A **login page** (`index.html`) that signs in with username/email + password to obtain a JWT from the platform.
* A **profile/home page** (`home.html`) that displays: a welcome block, top skills, project summaries, audit stats, and an SVG statistics area with at least two charts.
* Modular **view components** under `js/views/` (I wrote `welcome`, `topSkills`, `projects`, `auditsView`).
* A small GraphQL helper (`js/graphql.js`) that sends queries with the stored JWT.
* Simple CSS styling (`css/login.css`, `css/home.css`) to keep layout readable and responsive.

This is the version I built while learning GraphQL + SVG visualizations; it contains code I used to fetch, transform and display my own data from the endpoint.

---

## Project structure (exact)

```
root/
├─ css/
│  ├─ home.css          # styles for the profile page
│  └─ login.css         # styles for the login page
├─ graphql/
│  └─ user.graphql      # stored queries / fragments I used while developing
├─ icons/               # optional assets (avatars, small icons)
├─ js/
│  ├─ views/
│  │  ├─ auditsView.js  # audit ratio / audit counts view + small chart data
│  │  ├─ projects.js    # project list + prepares XP-per-project data
│  │  ├─ topSkills.js   # top skills / results rendering
│  │  └─ welcome.js     # welcome message + user basic info
│  ├─ graphql.js        # GraphQL wrapper (adds bearer auth, error handling)
│  ├─ home.js           # mounts all views and draws SVG graphs
│  └─ login.js          # signin, token storage and logout
├─ .gitignore
├─ home.html
├─ index.html
└─ README.md            # ← you are editing this file
```

---

## Files & what they actually do (short, exact)

### `index.html`

* Contains the login form (username/email + password). Submits credentials to `js/login.js`.
* Shows basic client-side validation and a friendly error message on bad credentials.

### `home.html`

* The profile page. Loads `js/home.js` which reads the stored token, fetches data and mounts views.
* Contains the `#stats` container where SVG charts are drawn.

### `css/home.css` & `css/login.css`

* Minimal responsive layout: a top bar, glass-container cards for the profile sections and a grid for the views.

### `graphql/user.graphql`

* A set of the actual queries I used while developing and testing in GraphiQL.
* Keep it for quick reference when you want to tweak which fields the app fetches.

### `js/graphql.js`

* Exported helper `graphqlFetch(query, variables)` which:

  1. Reads the token from `localStorage` (key: `jwt_token`).
  2. Adds `Authorization: Bearer <token>` if present.
  3. Performs the POST to `https://learn.reboot01.com/api/graphql-engine/v1/graphql` and handles the JSON response.

### `js/login.js`

* Exposes `signin(usernameOrEmail, password)` and `logout()`.
* `signin` builds the Basic auth header (`Authorization: Basic <base64>`) and sends POST to `https://learn.reboot01.com/api/auth/signin`.
* On success saves token in `localStorage` under `jwt_token` and navigates to `home.html`.

### `js/home.js`

* Orchestrates the page:

  * Validates token presence (if missing, redirects to login).
  * Calls several GraphQL queries to fetch `user`, `transaction`, `result`, and `progress` data.
  * Passes fetched data to each `render(container, data)` function in `js/views/`.
  * Prepares data for the two SVG charts and calls the graph rendering helpers (inline functions inside `home.js` or small helpers inside `js/views/projects.js`).

### `js/views/*.js`

* `welcome.js`: receives the `user` object and renders login/id and a welcome message.
* `topSkills.js`: computes top skills from results/objects/progress (example: counts of successful attempts) and renders a small list + mini-chart.
* `projects.js`: aggregates transactions per `objectId` (XP per project) and exposes the dataset used by the XP-over-time or XP-by-project chart.
* `auditsView.js`: computes an audit ratio from transactions or specific fields and renders the audit counts and a small visual indicator.

---

## GraphQL queries used in this project (examples I used)

**Get current user (basic info)**

```graphql
{
  user {
    id
    login
    email
  }
}
```

**Get transactions (XP entries)**

```graphql
{
  transaction(order_by: {createdAt: asc}) {
    id
    type
    amount
    createdAt
    objectId
  }
}
```

**Get results / progress to compute pass/fail**

```graphql
{
  result {
    id
    objectId
    userId
    grade
    path
  }
  progress {
    id
    objectId
    grade
    createdAt
  }
}
```

> These queries are stored (with variants) in `graphql/user.graphql` so you can copy them into GraphiQL while experimenting.

---

## Charts & SVG (what I built)

I implemented two SVG visualizations in `home.html` inside the `#stats` container:

1. **XP over time (line chart)** — built from `transaction` entries sorted by `createdAt`. I compute cumulative XP and draw a polyline within an SVG coordinate system. Points have small `<circle>` markers with `<title>` for accessibility.

2. **Project pass/fail ratio (donut or stacked bar)** — built from `result` and `progress` entries; it shows pass vs fail counts.

Both charts are produced with small helper functions in `js/views/` so they can be redrawn when new data arrives or on resize.

---

## Hosting / Deployment

This repo is a static site and can be hosted on:

* **GitHub Pages** — push repo and enable Pages in settings.
* **Netlify** — connect repo and deploy (or drag & drop a build folder for static sites).

Notes:

* Use HTTPS (both Netlify and GitHub Pages provide it). The GraphQL endpoint requires secure requests.
* If GraphQL calls are blocked by CORS, use a Netlify serverless function as a small proxy that forwards requests with the Authorization header.

---

## Security & implementation notes

* I used `localStorage` for the JWT (`jwt_token`) to keep the implementation simple. For production, avoid this because of XSS risk.
* The signin flow uses Basic auth to obtain the JWT (this is required by the platform). The token is then used as `Authorization: Bearer <token>`.
* I keep query selection minimal — only request fields I need for the UI to reduce payload size.