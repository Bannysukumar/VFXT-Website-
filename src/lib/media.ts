/**
 * Central registry of marketing imagery and background video.
 *
 * Photos: Unsplash (Unsplash License). Videos: Mixkit stock footage — check each clip's
 * license on mixkit.co before production use, or replace with self-hosted files in
 * /public/videos and point these URLs at them.
 */

const unsplash = (id: string, width = 1600) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=75`

export const images = {
  tradingChartDark: unsplash('1640340434855-6084b1f4901c'),
  tradingDesk: unsplash('1590283603385-17ffb3a7f29f'),
  laptopChart: unsplash('1614028674026-a65e31bfd27c'),
  candlesticks: unsplash('1611974789855-9c2a0a7236a3'),
  analyticsDashboard: unsplash('1551288049-bebda4e38f71', 1200),
  analyticsLaptop: unsplash('1460925895917-afdab827c52f', 1200),
  phoneMarkets: unsplash('1621761191319-c6fb62004040', 1000),
  phoneAndLaptop: unsplash('1563986768609-322da13575f3', 1200),
  blockchain: unsplash('1639762681485-074b7f938ba0'),
  cryptoDesk: unsplash('1642790106117-e829e14a795f', 1200),
  skyscrapers: unsplash('1486406146926-c627a92ad1ab'),
  teamLaptops: unsplash('1522202176988-66273c2fd55f', 1200),
  teamHighFive: unsplash('1600880292203-757bb62b4baf', 1200),
  handshake: unsplash('1521791136064-7986c2920216', 1200),
  workingLaptop: unsplash('1573164713714-d95e436ab8d6', 1200),
  supportDesk: unsplash('1553877522-43269d4ea984', 1200),
  coins: unsplash('1633158829585-23ba8f7c8caf', 1200),
  dollarBills: unsplash('1526304640581-d334cdbbf45e', 1200),
  officeTalk: unsplash('1517245386807-bb43f82c33c4', 1200),
}

const mixkit = (id: number) => `https://assets.mixkit.co/videos/${id}/${id}-720.mp4`

export const videos = {
  forexBoard: mixkit(47006),
  cryptoGraphs: mixkit(47212),
  analystRealtime: mixkit(47214),
  floatingIndicators: mixkit(14114),
  marketCloseUp: mixkit(47016),
}
