/**
 * Legal page copy. This is a starting template written without knowledge of the operator's
 * jurisdiction or licensing — it must be reviewed by qualified counsel before publication.
 * Replace every [bracketed] placeholder in LEGAL_ENTITY.
 */
import { env } from '@/lib/env'

export const LEGAL_ENTITY = {
  name: 'Virtual FX Trades',
  jurisdiction: 'United States',
  address: 'Niagara Chairs, 60 Jade Dr, Rochester, NY 14626, United States',
  email: env.VITE_SUPPORT_EMAIL ?? 'support@virtualfxtrades.com',
  updated: 'October 30, 2026',
}

export interface LegalSection {
  id: string
  heading: string
  paragraphs?: string[]
  bullets?: string[]
}

export interface LegalDoc {
  slug: 'terms' | 'privacy' | 'risk'
  title: string
  eyebrow: string
  summary: string
  keyPoints?: string[]
  sections: LegalSection[]
}

const { name, jurisdiction, address, email } = LEGAL_ENTITY

export const riskDisclosure: LegalDoc = {
  slug: 'risk',
  title: 'Risk Disclosure',
  eyebrow: 'Read before depositing',
  summary:
    'Using VFXT involves significant financial risk. Read this disclosure in full before you deposit any money, and do not deposit money you cannot afford to lose.',
  keyPoints: [
    'Returns are not guaranteed. Any rate, yield, multiplier, or reward shown on the platform is not a promise of payment.',
    'You can lose some or all of the money you deposit.',
    'Referral, level, and rank rewards depend on other people joining and depositing. They can fall or stop entirely.',
    'Withdrawals can be delayed, limited, or suspended.',
    'The VFXT token is not live, may never be listed, and may have no market value.',
    'Nothing on VFXT is financial, investment, legal, or tax advice.',
  ],
  sections: [
    {
      id: 'no-guarantee',
      heading: 'No guaranteed returns',
      paragraphs: [
        'Any daily rate, percentage, payout cap, lock-up multiplier, bonus, or reward displayed on the platform describes how the platform is configured to calculate credits at that time. It is not a guarantee, promise, or forecast that those amounts will be paid.',
        'Rates and rules may be changed, reduced, paused, or withdrawn at any time. Past credits are not an indication of future credits.',
        'Be especially cautious of any offer that promises high, fixed, or daily returns. Regulators in many countries warn that such offers carry a very high risk of loss.',
      ],
    },
    {
      id: 'loss-of-capital',
      heading: 'You can lose your capital',
      paragraphs: [
        'The money you deposit is at risk. You may not get back the amount you put in, and in some circumstances you may lose all of it.',
        'Balances shown in your dashboard are records kept by the platform. They are not bank deposits and are not covered by any deposit-insurance or investor-compensation scheme unless we expressly state otherwise in writing.',
      ],
    },
    {
      id: 'referral-rewards',
      heading: 'Referral, level, and rank rewards',
      paragraphs: [
        'Rewards linked to referrals, team levels, or rank thresholds depend on other participants joining and depositing. Structures that pay rewards based on recruitment can become unsustainable when new participation slows, and rewards may then fall sharply or stop.',
        'You should not recruit friends, family, or anyone else on the expectation that they or you will earn a return. You are responsible for any statements you make to people you refer.',
      ],
    },
    {
      id: 'liquidity',
      heading: 'Withdrawals and liquidity',
      bullets: [
        'Withdrawal requests are reviewed manually and may be delayed, limited, or rejected.',
        'Funds in locked or time-bound arrangements may not be withdrawable until the lock ends, or at all.',
        'Withdrawals may be suspended entirely during operational, security, legal, or financial difficulties.',
      ],
    },
    {
      id: 'token',
      heading: 'VFXT token risk',
      paragraphs: [
        'The VFXT token is not live on any public blockchain. Any VFXT balance shown on the platform is an internal record only. There is no assurance that the token will launch, be listed on any exchange, be transferable, or have any market value.',
        'Digital assets are highly volatile, can lose their entire value, and are subject to technical risks including smart-contract defects, network failure, and theft.',
      ],
    },
    {
      id: 'regulatory',
      heading: 'Regulatory risk',
      paragraphs: [
        `${name} may not be licensed or registered as an investment firm, bank, or money-services business in your country. Products of this kind may be restricted or prohibited where you live, and laws may change in ways that affect your ability to use or withdraw from the platform.`,
        'It is your responsibility to check that using VFXT is lawful in your jurisdiction.',
      ],
    },
    {
      id: 'operational',
      heading: 'Operational and security risk',
      paragraphs: [
        'Despite the controls described on our Security page, systems can fail, be attacked, or contain errors. Loss of access to your email account or password can result in loss of access to your funds.',
        'The platform depends on third-party providers, including cloud hosting, whose outages or failures are outside our control.',
      ],
    },
    {
      id: 'no-advice',
      heading: 'No advice',
      paragraphs: [
        'Nothing on the platform, in our communications, or from anyone who referred you is financial, investment, legal, or tax advice. Consider seeking advice from an independent, licensed adviser before depositing.',
      ],
    },
    {
      id: 'acknowledgement',
      heading: 'Your acknowledgement',
      paragraphs: [
        'By opening an account or depositing funds you confirm that you have read and understood this disclosure, that you are depositing only money you can afford to lose entirely, and that you are not relying on any promise of returns.',
      ],
    },
  ],
}

export const termsOfService: LegalDoc = {
  slug: 'terms',
  title: 'Terms of Service',
  eyebrow: 'Legal',
  summary: `These terms govern your use of the Virtual FX Trades platform operated by ${name}. Please read them together with our Privacy Policy and Risk Disclosure.`,
  sections: [
    {
      id: 'agreement',
      heading: 'Agreement to these terms',
      paragraphs: [
        `By creating an account or using the platform you agree to these Terms of Service. If you do not agree, do not use the platform. ${name} ("we", "us") is registered at ${address}.`,
      ],
    },
    {
      id: 'eligibility',
      heading: 'Eligibility',
      bullets: [
        'You must be at least 18 years old and have full legal capacity.',
        'You must not be located in, or a resident of, any jurisdiction where use of the platform is prohibited.',
        'You must provide accurate information and keep it up to date.',
        'You may hold only one account unless we agree otherwise in writing.',
      ],
    },
    {
      id: 'account',
      heading: 'Your account and security',
      paragraphs: [
        'You are responsible for keeping your login credentials confidential and for all activity under your account. Notify us immediately if you suspect unauthorised access.',
        'We may require email verification and additional identity checks before enabling some features or processing withdrawals.',
      ],
    },
    {
      id: 'deposits-withdrawals',
      heading: 'Deposits and withdrawals',
      bullets: [
        'Deposit and withdrawal requests are reviewed by our staff and are not final until approved and recorded in the ledger.',
        'We may reject, delay, or reverse a request where required by law, for security reasons, or where we suspect error or misuse.',
        'Funds for a pending withdrawal are reserved and cannot be used for other purposes until the request is completed or rejected.',
        'You are responsible for providing a correct withdrawal destination. Funds sent to a destination you supplied may not be recoverable.',
      ],
    },
    {
      id: 'balances',
      heading: 'Balances and records',
      paragraphs: [
        'Our ledger is the authoritative record of your balances. If we identify an error, we may correct it by recording an adjustment entry.',
        'Any rate, reward, or programme rule shown on the platform may be changed, paused, or withdrawn, as described in the Risk Disclosure.',
      ],
    },
    {
      id: 'token-referrals',
      heading: 'Token and referral features',
      paragraphs: [
        'The VFXT token and any staking, swap, or gaming features may be unavailable, experimental, or disabled. Referral and reward programmes may be modified or ended at any time. Participation does not create any entitlement to future rewards.',
      ],
    },
    {
      id: 'prohibited',
      heading: 'Prohibited use',
      bullets: [
        'Money laundering, terrorist financing, fraud, or any other unlawful activity.',
        'Using another person’s identity or account, or creating accounts to manipulate rewards.',
        'Attempting to access systems or data you are not authorised to access, or interfering with the platform.',
        'Making false or misleading statements about the platform or its returns to other people.',
      ],
    },
    {
      id: 'suspension',
      heading: 'Suspension and termination',
      paragraphs: [
        'We may suspend or close your account if you breach these terms, if required by law, or to protect users or the platform. Where lawful, we will return any balance that is properly due to you after completing required checks.',
        'You may close your account at any time by contacting support, subject to completion of pending requests.',
      ],
    },
    {
      id: 'liability',
      heading: 'Disclaimers and limitation of liability',
      paragraphs: [
        'The platform is provided "as is" and "as available". To the maximum extent permitted by law, we exclude all implied warranties and are not liable for indirect, incidental, or consequential losses, or for losses arising from market conditions, third-party services, or your failure to keep credentials secure.',
        'Nothing in these terms limits liability that cannot be limited under applicable law.',
      ],
    },
    {
      id: 'changes',
      heading: 'Changes to these terms',
      paragraphs: [
        'We may update these terms. Material changes will be notified through the platform or by email. Continuing to use the platform after the effective date means you accept the updated terms.',
      ],
    },
    {
      id: 'law',
      heading: 'Governing law and disputes',
      paragraphs: [
        `These terms are governed by the laws of ${jurisdiction}. Disputes will be subject to the exclusive jurisdiction of the courts of ${jurisdiction}, unless mandatory consumer law where you live provides otherwise.`,
      ],
    },
    {
      id: 'contact',
      heading: 'Contact',
      paragraphs: [`Questions about these terms can be sent to ${email} or through the Contact page.`],
    },
  ],
}

export const privacyPolicy: LegalDoc = {
  slug: 'privacy',
  title: 'Privacy Policy',
  eyebrow: 'Legal',
  summary: `This policy explains what personal data ${name} collects when you use VFXT, why we use it, who we share it with, and the choices you have.`,
  sections: [
    {
      id: 'controller',
      heading: 'Who is responsible',
      paragraphs: [`${name}, ${address}, is the controller of your personal data. Contact us at ${email}.`],
    },
    {
      id: 'collect',
      heading: 'Data we collect',
      bullets: [
        'Account data: your name, email address, password (stored only as a secure hash by our authentication provider), and verification status.',
        'Financial records: wallet balances, ledger entries, deposit and withdrawal requests, withdrawal destinations, and notes you add.',
        'Referral data: your referral code and the accounts linked to it.',
        'Support data: tickets and messages you send us.',
        'Technical data: device and browser information, app-integrity signals, and IP addresses recorded with certain security-sensitive actions.',
      ],
    },
    {
      id: 'use',
      heading: 'How we use it',
      bullets: [
        'To create and operate your account and process your requests (performance of contract).',
        'To prevent fraud, secure the platform, and keep audit records (legitimate interests and legal obligations).',
        'To meet legal, accounting, and regulatory requirements (legal obligation).',
        'To answer support requests and send essential service messages.',
      ],
    },
    {
      id: 'sharing',
      heading: 'Who we share it with',
      paragraphs: [
        'We do not sell your personal data. We share it only with service providers who process it on our behalf, and with authorities where the law requires it.',
      ],
      bullets: [
        'Google Firebase / Google Cloud — authentication, database, serverless functions, and hosting.',
        'Content delivery providers that serve fonts, images, and video on public pages (including Google Fonts, Unsplash, and Mixkit). Loading these pages sends your IP address to those providers.',
        'Professional advisers, auditors, and law-enforcement or regulatory bodies where legally required.',
      ],
    },
    {
      id: 'storage',
      heading: 'Cookies and local storage',
      paragraphs: [
        'We use browser storage that is strictly necessary to keep you signed in and to remember interface preferences, such as whether the sidebar is open. We do not use advertising cookies.',
      ],
    },
    {
      id: 'retention',
      heading: 'How long we keep it',
      paragraphs: [
        'We keep account and financial records for as long as your account is open and afterwards for the period required by applicable accounting, tax, and anti-money-laundering law. Ledger and audit records are retained in append-only form for integrity.',
      ],
    },
    {
      id: 'transfers',
      heading: 'International transfers',
      paragraphs: [
        'Our providers may process data in countries other than your own. Where required, we rely on appropriate safeguards such as standard contractual clauses.',
      ],
    },
    {
      id: 'rights',
      heading: 'Your rights',
      paragraphs: ['Depending on where you live, you may have the right to:'],
      bullets: [
        'Access the personal data we hold about you and receive a copy.',
        'Correct inaccurate data.',
        'Request deletion, subject to records we must keep by law.',
        'Object to or restrict certain processing.',
        'Lodge a complaint with your local data-protection authority.',
      ],
    },
    {
      id: 'security',
      heading: 'Security',
      paragraphs: [
        'We protect data with authenticated access, server-side authorisation rules, app-integrity checks, and audit logging. No system is completely secure; please keep your credentials safe.',
      ],
    },
    {
      id: 'children',
      heading: 'Children',
      paragraphs: ['VFXT is not intended for anyone under 18, and we do not knowingly collect their data.'],
    },
    {
      id: 'changes',
      heading: 'Changes to this policy',
      paragraphs: ['We will post any changes on this page and update the date above. Material changes will be notified by email or in the app.'],
    },
  ],
}

export const legalDocs = { terms: termsOfService, privacy: privacyPolicy, risk: riskDisclosure }
