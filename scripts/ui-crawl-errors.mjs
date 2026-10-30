/**
 * Login as member + admin and crawl pages for React/app errors.
 * Usage: node scripts/ui-crawl-errors.mjs
 */
import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

let chromium
try {
  ;({ chromium } = require('playwright'))
} catch {
  ;({ chromium } = require(path.join(__dirname, '../node_modules/playwright')))
}

const session = JSON.parse(fs.readFileSync(path.join(__dirname, 'ui-session-7level.json'), 'utf8'))
const BASE = process.env.UI_BASE || 'http://localhost:5173'

const memberPages = [
  '/app',
  '/app/wallets',
  '/app/wallets/fund/history',
  '/app/wallets/staking/history',
  '/app/wallets/daily_roi/history',
  '/app/wallets/level_income/history',
  '/app/wallets/direct_referral/history',
  '/app/wallets/withdrawal/history',
  '/app/wallets/vfxt/history',
  '/app/deposits',
  '/app/withdrawals',
  '/app/transfer',
  '/app/staking',
  '/app/referrals',
  '/app/referrals/level/1',
  '/app/referrals/level/7',
  '/app/ranks',
  '/app/token',
  '/app/support',
  '/app/profile',
]

const adminPages = [
  '/admin',
  '/admin/settings',
  '/admin/plan',
  '/admin/withdraw',
  '/admin/deposits',
  '/admin/auto-deposits',
  '/admin/withdrawals',
  '/admin/auto-withdrawals',
  '/admin/staking',
  '/admin/crypto-wallet',
  '/admin/income/roi',
  '/admin/income/level-commission',
  '/admin/income/direct-bonus',
  '/admin/income/referral-bonus',
  '/admin/income/rank-reward',
  '/admin/income/staking-reward',
  '/admin/income/locked-maturity',
  '/admin/income/locked-bonus',
  '/admin/income/deposit-credit',
  '/admin/users',
  '/admin/affiliates',
  '/admin/tickets',
  '/admin/audit',
]

function classify(text, consoleErrors) {
  const issues = []
  if (/Unexpected Application Error/i.test(text)) issues.push('react-router-crash')
  if (/Invalid time value/i.test(text)) issues.push('invalid-time-value')
  if (/Checking session…/i.test(text) && text.length < 80) issues.push('stuck-checking-session')
  const fail = text.match(/(?:Failed to|Error:|INTERNAL|permission-denied|unauthenticated|not-found|unavailable)[^\n]{0,120}/gi)
  if (fail) {
    for (const f of fail.slice(0, 3)) {
      const s = f.replace(/\s+/g, ' ').trim()
      if (!/error boundary/i.test(s)) issues.push(s.slice(0, 140))
    }
  }
  for (const c of consoleErrors.slice(0, 5)) {
    if (/FirebaseError|TypeError|ReferenceTypeError|ReferenceError|ChunkLoadError/i.test(c)) {
      issues.push(`console:${c.slice(0, 140)}`)
    }
  }
  return [...new Set(issues)]
}

async function login(page, email, password) {
  await page.goto(`${BASE}/auth/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(600)
  await page.fill('input[type="email"], input[name="email"], #email', email)
  await page.fill('input[type="password"], input[name="password"], #password', password)
  await page.click('button[type="submit"]')
  await page.waitForTimeout(2500)
}

async function crawl(page, paths, role) {
  const out = []
  for (const p of paths) {
    const consoleErrors = []
    const onConsole = (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    }
    const onPageError = (err) => consoleErrors.push(String(err))
    page.on('console', onConsole)
    page.on('pageerror', onPageError)
    try {
      await page.goto(`${BASE}${p}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForTimeout(1800)
      const text = await page.evaluate(() => document.body?.innerText || '')
      const heading = await page.evaluate(() => document.querySelector('h1')?.textContent?.trim() || '')
      const url = page.url()
      const issues = classify(text, consoleErrors)
      out.push({
        role,
        path: p,
        finalUrl: url,
        heading,
        ok: issues.length === 0 && !/\/auth\/login/.test(url),
        issues,
        snippet: text.replace(/\s+/g, ' ').slice(0, 180),
      })
    } catch (e) {
      out.push({ role, path: p, ok: false, issues: [`nav:${e.message}`], heading: '', snippet: '' })
    } finally {
      page.off('console', onConsole)
      page.off('pageerror', onPageError)
    }
  }
  return out
}

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext()
const page = await context.newPage()

const results = []

console.log('Member login', session.leaf.email)
await login(page, session.leaf.email, session.password)
results.push(...(await crawl(page, memberPages, 'member')))

console.log('Admin login', session.root.email)
await context.clearCookies()
await page.evaluate(() => {
  try {
    sessionStorage.clear()
    localStorage.clear()
  } catch {}
})
await login(page, session.root.email, session.password)
results.push(...(await crawl(page, adminPages, 'admin')))

await browser.close()

const summary = {
  memberOk: results.filter((r) => r.role === 'member' && r.ok).length,
  memberFail: results.filter((r) => r.role === 'member' && !r.ok),
  adminOk: results.filter((r) => r.role === 'admin' && r.ok).length,
  adminFail: results.filter((r) => r.role === 'admin' && !r.ok),
  results,
}

const outPath = path.join(__dirname, 'ui-crawl-report.json')
fs.writeFileSync(outPath, JSON.stringify(summary, null, 2))
console.log(JSON.stringify({
  memberOk: summary.memberOk,
  memberFailCount: summary.memberFail.length,
  adminOk: summary.adminOk,
  adminFailCount: summary.adminFail.length,
  memberFails: summary.memberFail.map((f) => ({ path: f.path, issues: f.issues })),
  adminFails: summary.adminFail.map((f) => ({ path: f.path, issues: f.issues })),
}, null, 2))
