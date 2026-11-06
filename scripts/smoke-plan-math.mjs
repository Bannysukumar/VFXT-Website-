/**
 * Offline smoke check for VFXT plan math (mirrors server helpers).
 * Run: node scripts/smoke-plan-math.mjs
 */
const MIN = 10_000
const daily = Math.floor((MIN * 100) / 10_000) // 1%
const cap2 = MIN * 2
const cap3 = MIN * 3
const levels = [25, 20, 15, 10, 5, 5, 5]
const levelTotalBps = levels.reduce((a, b) => a + b, 0)
const levelPayout = levels.map((bps) => Math.floor((MIN * bps) / 10_000))
const directBonusCents = Math.floor((MIN * 500) / 10_000)
const directBonusVfxt = directBonusCents * 100

console.log('Daily yield on $100:', daily, 'cents/day →', daily / 100, 'USD')
console.log('200 days uncapped sum:', daily * 200, 'cents (capped at', cap2, 'or', cap3, ')')
console.log('Level commissions on $100 stake:', levelPayout, 'total bps', levelTotalBps)
console.log('Direct 5% VFXT tokens on $100:', directBonusVfxt)
console.log('Locked 300d maturity USD:', MIN * 3, 'bonus VFXT:', Math.floor((MIN * 100 * 50) / 100))

if (daily !== 100) throw new Error('expected $1/day on $100')
if (levelPayout.reduce((a, b) => a + b, 0) !== 200) throw new Error('expected $2 total level on $100')
console.log('OK — plan smoke math passed')
