# Driveway Guard

Local web app to monitor a driveway camera feed and warn when incoming traffic is detected.

## Project Structure

```text
driveway_guard/
  index.html
  assets/
    css/
      styles.css
    js/
      app.js
```

## Run Locally

1. Open `index.html` in a modern browser.
2. Select your camera and click **Start Camera**.
3. Use **Scan Now** or enable **Auto-Scan**.

## Recent Update (Apr 9, 2026)

- Requirement 1 completed: added mobile-responsive layout updates and mobile camera improvements.
- Mobile users now have a dedicated rear camera action and automatic rear-camera preference when available.

## Notes

- Current version uses browser camera APIs and calls an external AI endpoint from the frontend.
- For production, move API calls and credentials to a backend service.
