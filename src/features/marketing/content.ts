export const commonFaqs = [
  {
    q: 'How long do deposits take to appear?',
    a: 'Deposit requests are reviewed by finance admins. Your balance updates as soon as the request is approved and the ledger entry is written — you can follow the status from your dashboard.',
  },
  {
    q: 'Why is part of my balance shown as reserved?',
    a: 'When you request a withdrawal, funds move from available to reserved so they cannot be spent twice. They leave your wallet once the withdrawal completes, or return to available if it is rejected.',
  },
  {
    q: 'Can a retry create a duplicate transaction?',
    a: 'No. Every financial request carries an idempotency key, so repeated submissions of the same request are recognised and ignored by the server.',
  },
  {
    q: 'Is the VFXT token live?',
    a: 'Not yet. The ERC-20 contract is written and tested, but on-chain features stay disabled until the network configuration, contract verification, and execution model are reviewed.',
  },
]

/** Edit to match your real staffing before launch. */
export const supportHours = {
  timezone: 'All times in UTC',
  schedule: [
    { days: 'Monday – Friday', hours: '09:00 – 18:00' },
    { days: 'Saturday', hours: '10:00 – 14:00' },
    { days: 'Sunday & public holidays', hours: 'Closed' },
  ],
  note: 'Tickets can be opened at any time and are answered in order during support hours.',
}

/** US head office shown on the Contact page. */
export const officeLocation = {
  label: 'Head office',
  company: 'Virtual FX Trades',
  street: 'Niagara Chairs, 60 Jade Dr',
  city: 'Rochester, NY',
  postcode: '14626',
  country: 'United States',
  /** Opening hours for walk-in visits; set to null to hide. */
  visiting: 'Visits by appointment only',
}
