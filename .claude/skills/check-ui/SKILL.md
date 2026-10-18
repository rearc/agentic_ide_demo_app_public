---
name: check-ui
description: Check the dashboard's frontend in a real browser after a layout or styling change - sideways overflow and element positions at several window widths as text, each page state's accessibility tree, and one contact-sheet image of every state at every width.
when_to_use: "Use after changing the frontend's layout, styling, header controls or responsive behaviour, before calling the change done, or when asked to check how the UI looks at different widths."
---

# Check the UI

A browser check that costs little to read. One command opens every page state named in `frontend/e2e/ui-states.js` at every window width there and reports:

- **As text, for every state and width:** whether the page scrolls sideways (`overflow`, in px; anything above 0 is a defect) and where each measured element sits (`y` and `h`, in px). Most layout questions are answered here, exactly, with no image: "does the header still fit at 390 px", "is the board where it was".
- **The accessibility tree** of each state (`*.aria.yml`): what a screen reader, and a Playwright locator, sees. Use it to check names, roles and what is on screen without an image.
- **One contact sheet:** every state at every width in a single image. Look at it only for questions of design (spacing, alignment, colour, hierarchy), and open a full-size shot only when the sheet is too small to judge.

## Run it

The app must be running (README, "Setup"). From the repo root:

```bash
node .claude/skills/check-ui/scripts/check-ui.mjs
node .claude/skills/check-ui/scripts/check-ui.mjs --states "library open" --widths 390,768
node .claude/skills/check-ui/scripts/check-ui.mjs --url http://localhost:5193 --aria
```

Options: `--states` and `--widths` narrow the run; `--url` points at another server; `--aria` prints the accessibility trees; `--motion` keeps animations (by default the page runs with reduced motion, so every state settles at once). Output goes to `frontend/test-results/check-ui/` (git-ignored); the contact sheet is `contact-sheet.png` there.

The check cannot change data: the script refuses every request to `/api` that is not a GET.

## Where it fits

1. **While changing the UI:** run the unit tests (`npm run test:run`) and only the end-to-end tests for the area you touch (`npx playwright test -g "<test name>"`). Use this skill with `--states` and `--widths` narrowed to what you changed, and read its text lines.
2. **When the change is ready:** run this skill in full, read every text line and look at the contact sheet once. Then the full end-to-end suite once (twice only if a drag or timing test changed), lint and the build.
3. **Only design judgement needs the image.** If a question can be answered by a number (does it overflow, did it move, is it the same height), answer it from the text.

## Add a state

A state is a function in `frontend/e2e/ui-states.js` that takes the page from first load to that state, using the same locators as the end-to-end tests (`getByRole` first). Return `false` where the state does not apply, for example a control hidden at that width. A state must not change data. To measure another element, add it to `measure` with a CSS selector.

## Reading the output

```
library open @ 768: overflow 0px | header y 0 h 207 | library y 68 h 136 | board y 207 h 628
library folded @ 768: overflow 0px | header y 0 h 71 | library absent | board y 71 h 628
```

`absent` means the element is missing or has no height. Compare lines across states and widths: two states that should look alike from the board down (here: viewing and editing with the library folded) must have the same header height and board `y` at every width.
