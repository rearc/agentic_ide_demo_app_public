#!/usr/bin/env node
/**
 * Check the frontend's layout in a real browser, cheaply.
 *
 * For every page state named in the states file, at every window width, it
 * reports as text whether the page scrolls sideways and where the measured
 * elements sit, saves a screenshot and the page's accessibility tree, and
 * joins the screenshots into one contact sheet, so a reviewer looks at one
 * image instead of many.
 *
 * Run from the repo root, with the app running:
 *   node .claude/skills/check-ui/scripts/check-ui.mjs [options]
 *
 * Options:
 *   --url <url>         the running app (default: the states file's `url`)
 *   --states a,b        only these states (default: all)
 *   --widths 390,1280   only these widths (default: the states file's)
 *   --aria              also print each accessibility tree
 *   --motion            keep animations (default: reduced motion, so each
 *                       state settles at once)
 *   --root <dir>        the frontend folder (default: frontend)
 *
 * The page cannot change data: every request to /api that is not a GET is
 * refused, so a state that removes a card shows it removed but saves nothing.
 */
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i].replace(/^--/, '')
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) args[key] = true
    else args[key] = argv[++i]
  }
  return args
}

const args = parseArgs(process.argv.slice(2))
const root = resolve(args.root ?? 'frontend')
// Playwright comes from the frontend's own install, not from this folder.
const { chromium } = createRequire(join(root, 'package.json'))('@playwright/test')
const config = (await import(pathToFileURL(join(root, 'e2e/ui-states.js')))).default

const url = args.url ?? config.url
const widths = args.widths ? args.widths.split(',').map(Number) : config.widths
const stateNames = args.states
  ? args.states.split(',')
  : Object.keys(config.states)
const height = config.height ?? 800
const out = join(root, 'test-results/check-ui')
mkdirSync(out, { recursive: true })

const slug = (s) => s.replace(/[^a-z0-9]+/gi, '-').toLowerCase()

async function measure(page) {
  return page.evaluate((selectors) => {
    const where = {}
    for (const [name, selector] of Object.entries(selectors)) {
      const el = document.querySelector(selector)
      const box = el?.getBoundingClientRect()
      where[name] =
        box && box.height > 0
          ? `y ${Math.round(box.y)} h ${Math.round(box.height)}`
          : 'absent'
    }
    where.overflow = document.documentElement.scrollWidth - window.innerWidth
    return where
  }, config.measure ?? {})
}

const browser = await chromium.launch()
const shots = []
try {
  for (const name of stateNames) {
    const state = config.states[name]
    if (!state) throw new Error(`No state "${name}" in e2e/ui-states.js`)
    for (const width of widths) {
      const page = await browser.newPage({
        viewport: { width, height },
        reducedMotion: args.motion ? 'no-preference' : 'reduce',
      })
      await page.route('**/api/**', (route) =>
        route.request().method() === 'GET' ? route.continue() : route.abort(),
      )
      try {
        await page.goto(url)
      } catch {
        throw new Error(
          `Could not open ${url}. Start the app (README, "Setup") or pass --url.`,
        )
      }
      await config.ready(page)
      const label = `${name} @ ${width}`
      // A state returns false where it does not apply (a control hidden at
      // that width, for example).
      if ((await state(page, width)) === false) {
        console.log(`${label}: n/a`)
        shots.push({ label: `${label}: n/a`, file: null })
        await page.close()
        continue
      }
      await page.waitForTimeout(args.motion ? 900 : 150)
      const where = await measure(page)
      const file = join(out, `${slug(name)}-${width}.png`)
      await page.screenshot({ path: file })
      const aria = await page.locator('body').ariaSnapshot()
      writeFileSync(join(out, `${slug(name)}-${width}.aria.yml`), aria)
      const flag = where.overflow > 0 ? '  <-- scrolls sideways' : ''
      const { overflow, ...rest } = where
      const parts = Object.entries(rest).map(([k, v]) => `${k} ${v}`)
      console.log(`${label}: overflow ${overflow}px | ${parts.join(' | ')}${flag}`)
      if (args.aria) console.log(aria)
      shots.push({ label, file })
      await page.close()
    }
  }

  // One image for all the screenshots: a row per state, a column per width,
  // each shot scaled into a 420 by 340 cell.
  if (shots.some((s) => s.file)) {
    const image = (s) =>
      s.file
        ? `<img src="data:image/png;base64,${readFileSync(s.file).toString('base64')}">`
        : ''
    const cells = shots
      .map((s) => `<figure>${image(s)}<figcaption>${s.label}</figcaption></figure>`)
      .join('')
    const columns = Math.min(widths.length, shots.length)
    const sheet = await browser.newPage({
      viewport: { width: columns * 436 + 16, height: 400 },
    })
    await sheet.setContent(`<style>
      body { margin: 0; padding: 8px; background: #fff; font: 12px system-ui; display: grid;
             grid-template-columns: repeat(${columns}, 428px); gap: 8px; }
      figure { margin: 0; } img { display: block; max-width: 420px; max-height: 340px; border: 1px solid #ccc; }
      figcaption { padding: 2px 0 6px; color: #333; }
    </style>${cells}`)
    const sheetFile = join(out, 'contact-sheet.png')
    await sheet.screenshot({ path: sheetFile, fullPage: true })
    console.log(`\nContact sheet: ${sheetFile}`)
    console.log(`Full-size shots and accessibility trees: ${out}`)
  }
} finally {
  await browser.close()
}
