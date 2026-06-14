export type Category = {
  id: number;
  name: string;
  display_order: number;
  icon: string;
};

export type LineItem = {
  id: number;
  category_id: number;
  name: string;
  projected: number;
  actual: number;
  paidOn: string | null; // ISO 'YYYY-MM-DD', or null when unpaid
};

export type Income = {
  projected: number;
  actual: number;
};

export type CategoryWithItems = Category & {
  items: LineItem[];
};

export type Budget = {
  income: Income;
  categories: CategoryWithItems[];
};

export type CategoryTotal = {
  id: number;
  name: string;
  icon: string;
  projected: number;
  actual: number;
};

export type DeltaRow = {
  id: number;
  name: string;
  icon: string;
  currentActual: number;
  prevActual: number;
  delta: number; // currentActual - prevActual, rounded to cents
};

export type MonthDelta =
  | { hasPrior: false }
  | { hasPrior: true; rows: DeltaRow[] };

export type ExportRow = {
  month: string; // 'YYYY-MM-01'
  category: string;
  item: string;
  projected: number;
  actual: number;
};
