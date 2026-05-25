export type Category = {
  id: number;
  name: string;
  display_order: number;
};

export type LineItem = {
  id: number;
  category_id: number;
  name: string;
  projected: number;
  actual: number;
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
