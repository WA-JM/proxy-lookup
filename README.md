# Proxy Lookup

A lightweight web tool that looks up beneficial ownership data from SEC EDGAR proxy filings (DEF 14A).

**Live site:** `https://<your-org>.github.io/proxy-lookup/`

## What It Does

Enter a stock ticker and a person's name â the tool will:

1. Resolve the ticker to a CIK via the SEC company tickers database
2. Find the most recent DEF 14A proxy filing
3. Fetch and parse the proxy statement HTML
4. Locate beneficial ownership tables and search for the person
5. Display the results with share counts, as-of date, and the full table

All lookups happen client-side directly against the SEC EDGAR public APIs. No backend server required.

## Setup (GitHub Pages)

1. Create a new repository on GitHub (e.g., `proxy-lookup`)
2. Push this folder's contents to the `main` branch
3. Go to **Settings â Pages** and set the source to `main` branch, root (`/`)
4. The site will be live at `https://<your-org>.github.io/proxy-lookup/`

That's it â no build step, no dependencies, no server.

## Files

| File | Purpose |
|------|---------|
| `index.html` | The entire app (HTML + CSS + JS in one file) |
| `README.md` | This file |

## SEC EDGAR Notes

- The tool uses the SEC's public JSON APIs and EDGAR filing archives
- SEC requires a descriptive `User-Agent` header (configured in the code)
- Rate limit: 10 requests/second per SEC policy
- Data comes from DEF 14A filings â the most recent proxy statement on file

## Customization

The site uses W Advisors branding by default. To customize:

- **Colors:** Edit the CSS custom properties in `:root { ... }` at the top of `index.html`
- **Brand name:** Search for "W Advisors" in the HTML and replace
- **User-Agent:** Update the `User-Agent` string in the JavaScript to reflect your organization

---

*Not investment advice. Data sourced from SEC EDGAR.*
