import { formatMoney } from '../utils/money';

type Props = { projected: number; actual: number };

export default function BalanceCards({ projected, actual }: Props) {
  return (
    <div className="grid grid-cols-2 gap-4 pt-3 border-t">
      <div>
        <span className="text-sm text-gray-500">Projected Balance</span>
        <p className="text-xl font-medium">{formatMoney(projected)}</p>
      </div>
      <div>
        <span className="text-sm text-gray-500">Actual Balance</span>
        <p className="text-xl font-medium">{formatMoney(actual)}</p>
      </div>
    </div>
  );
}
