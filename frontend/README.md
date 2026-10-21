# WorkSphere Frontend

A React + TypeScript + Vite frontend starter for the WorkSphere enterprise workflow management platform.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`).

## Recent interaction fixes

- Projects period control is now a real dropdown with This week, Last week, This month, This quarter, and All time options.
- Messages now support sending non-empty messages, searching conversations, searching messages, switching the active conversation UI, and selecting a conversation from the header dropdown.
- The send button is disabled when the message field is empty.
- File attachment control explains that uploads need backend support.

## Important

This is a frontend demo. Messages and workspace data are held in local React state and reset when the page reloads. The conversation switcher is a UI demo, not yet a separate persistent inbox per person. Real-time messaging, file uploads, authentication, and database persistence require backend APIs.
