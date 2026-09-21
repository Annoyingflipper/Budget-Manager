import { stillToPay } from '../utils/stillToPay';
import { formatMoney } from '../utils/money';
import type { CategoryWithItems } from '../types';

type Props = { categories: CategoryWithItems[] };

export default function StillToPay({ categories }: Props) {
  const { count, amount } = stillToPay(categories);

  const totalItems = categories.reduce((n, c) => n + c.items.length, 0);
  if (totalItems === 0) return null;

  if (count === 0) {
    return (
      <section
        data-testid="still-to-pay"
        className="bg-card rounded-card px-4 py-2.5 mb-3 text-label text-positive"
      >
        ✓ All paid this month
      </section>
    );
  }

  return (
    <section
      data-testid="still-to-pay"
      className="bg-card rounded-card px-4 py-2.5 mb-3 flex justify-between items-center"
    >
      <span className="text-label">
        {count} {count === 1 ? 'bill' : 'bills'} left
      </span>
      <span className="text-money text-muted">{formatMoney(amount)} still to pay</span>
    </section>
  );
}
