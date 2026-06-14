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
        className="bg-card rounded-xl px-4 py-2.5 mb-3 text-sm text-positive font-bold"
      >
        ✓ All paid this month
      </section>
    );
  }

  return (
    <section
      data-testid="still-to-pay"
      className="bg-card rounded-xl px-4 py-2.5 mb-3 flex justify-between items-center text-sm"
    >
      <span className="font-bold">
        {count} {count === 1 ? 'bill' : 'bills'} left
      </span>
      <span className="text-muted">{formatMoney(amount)} still to pay</span>
    </section>
  );
}
