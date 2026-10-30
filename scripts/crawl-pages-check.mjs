/**
 * Crawl app/admin pages against a logged-in browser session is hard without Playwright.
 * This script verifies callables + creates crawl checklist; browser agent uses the JSON.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const session = JSON.parse(fs.readFileSync(path.join(__dirname, 'ui-session-7level.json'), 'utf8'))

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

const out = {
  leaf: session.leaf.email,
  root: session.root.email,
  password: session.password,
  memberPages,
  adminPages,
}
fs.writeFileSync(path.join(__dirname, 'crawl-checklist.json'), JSON.stringify(out, null, 2))
console.log(JSON.stringify({ leaf: out.leaf, root: out.root, member: memberPages.length, admin: adminPages.length }))
