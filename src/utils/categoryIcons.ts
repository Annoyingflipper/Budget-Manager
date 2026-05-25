const CATEGORY_ICONS: Record<string, string> = {
  'Services':                '🛠',
  'Entertainment':           '🎬',
  'Loans':                   '🏦',
  'Taxes':                   '📋',
  'Savings or Investments':  '💎',
  'Monthly Payments':        '🧾',
  'Personal Care':           '🧴',
  'Other':                   '✨',
};

export function categoryIcon(name: string): string {
  return CATEGORY_ICONS[name] ?? '📁';
}
