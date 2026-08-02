import { useState } from 'react';
import EmojiPicker from './EmojiPicker';
import { CURRENCIES, CURRENCY_CODES, type Currency } from '../utils/currency';
import type { Account } from '../types';

type Props = {
  account: Account;
  onChange: (id: number, patch: Partial<Account>) => void;
  onDelete: (id: number) => void;
  confirmingDelete: boolean;
  onRequestDelete: (id: number) => void;
  onCancelDelete: () => void;
};

export default function AccountRow({
  account, onChange, onDelete, confirmingDelete, onRequestDelete, onCancelDelete,
}: Props) {
  const [name, setName] = useState(account.name);
  const [balance, setBalance] = useState(String(account.balance));
  const [pickingIcon, setPickingIcon] = useState(false);

  function commitName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === account.name) { setName(account.name); return; }
    onChange(account.id, { name: trimmed });
  }

  function commitBalance() {
    const parsed = Number(balance);
    if (balance.trim() === '' || Number.isNaN(parsed)) {
      setBalance(String(account.balance));
      return;
    }
    if (parsed === account.balance) return;
    onChange(account.id, { balance: parsed });
  }

  return (
    <div
      className="grid items-center gap-2 bg-bg rounded-lg p-2"
      style={{ gridTemplateColumns: '32px 1fr 72px 110px 28px' }}
    >
      <button
        type="button"
        onClick={() => setPickingIcon((v) => !v)}
        aria-label={`Change icon for ${account.name}`}
        className="text-xl text-center"
      >
        {account.icon}
      </button>

      <input
        type="text"
        value={name}
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        aria-label={`Name for ${account.name}`}
        className="w-full px-2 py-1 border border-highlight rounded-md bg-card text-sm"
      />

      <select
        value={account.currency}
        onChange={(e) => onChange(account.id, { currency: e.target.value as Currency })}
        aria-label={`Currency for ${account.name}`}
        className="px-1 py-1 border border-highlight rounded-md bg-card text-xs"
      >
        {CURRENCY_CODES.map((code) => (
          <option key={code} value={code}>{CURRENCIES[code].symbol} {code}</option>
        ))}
      </select>

      <input
        type="number"
        step="0.01"
        value={balance}
        onChange={(e) => setBalance(e.target.value)}
        onBlur={commitBalance}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        aria-label={`Balance for ${account.name}`}
        data-testid={`account-balance-${account.id}`}
        className={`w-full px-2 py-1 border border-highlight rounded-md bg-card text-sm text-right ${
          account.balance < 0 ? 'text-negative' : ''
        }`}
      />

      {confirmingDelete ? (
        <button
          type="button"
          onClick={() => onDelete(account.id)}
          onBlur={onCancelDelete}
          aria-label={`Confirm delete ${account.name}`}
          className="text-negative text-sm"
        >
          ✓
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onRequestDelete(account.id)}
          aria-label={`Delete ${account.name}`}
          className="text-muted text-sm hover:text-negative"
        >
          ✕
        </button>
      )}

      {pickingIcon && (
        <div className="col-span-5">
          <EmojiPicker
            onPick={(icon) => { setPickingIcon(false); onChange(account.id, { icon }); }}
            onClose={() => setPickingIcon(false)}
          />
        </div>
      )}
    </div>
  );
}
