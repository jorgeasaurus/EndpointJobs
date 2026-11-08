# Simple board and truthful JobPosting region

Approved by Jorge on 2026-11-08. Implement Approach 1 only.

## Goal

Remove redundant public copy and emit `addressRegion` only when the listing text already names one explicit US state or Swiss canton.

## UI

Remove:

- Home lead: “Daily listings for macOS, Windows, MDM, and endpoint security roles.”
- Board eyebrow “Endpoint, workplace, and client platform roles”, the second “Endpoint Jobs” heading, and the paragraph under it.
- “Daily refresh” beside the results.
- The sort control inside Advanced filters.
- Map kicker “Job geography” and heading “Locations”.
- Comparison kicker “Shortlist analysis”.
- Job detail kicker “Role overview” and the header link “Browse all roles”.

The results count becomes the board’s `h1` and keeps its current size. Sort remains the results control (`#results-sort`) and the `sort` URL parameter. The collapsed map remains the Show map / Hide map button. The job breadcrumb “All endpoint jobs” remains. The not-found page keeps “Browse all roles”.

Keep search and filter labels, placeholders, errors, privacy and account copy, the GitHub place request, active-filter chips, the coverage rail, saved jobs, auth, analytics, and the salary-only “Newest with salary” list.

## JobPosting address

`jobPostingAddress(location, addressCountry)` runs only inside `getJobPostingJsonLd`. It reads the location string. It does not read map coordinates.

- One explicit US state, and `addressCountry` is `US`: that comma part is `addressRegion`. US state codes count only when the whole part is the code.
- One explicit Swiss canton, and `addressCountry` is `CH`: that comma part is `addressRegion`. Bare “Basel” and bare “Appenzell” are not cantons.
- A trailing country name is not a locality. “Hyderabad, India” keeps locality `Hyderabad` and has no region.
- A country-only string has no `addressLocality`.
- More than one place part, or more than one region part, is ambiguous. Keep the original string as `addressLocality` and omit `addressRegion`. “New York, NY” and “Luzern, Luzern, Switzerland” are ambiguous.
- Do not add `streetAddress`, `postalCode`, or `baseSalary`.

Remote jobs and semicolon locations still omit `JobPosting`. Inactive jobs still 404. `serializeJsonLd` still escapes `<` as `\u003c`.

## Warnings that remain

`streetAddress`, `postalCode`, and `baseSalary` stay absent because the feed does not store a street, a postal code, or a pay period. City-only, country-only, and ambiguous locations also omit `addressRegion`.

## Sources

- https://developers.google.com/search/docs/appearance/structured-data/job-posting (updated 2026-09-08)
- https://schema.org/JobPosting
- https://schema.org/PostalAddress
