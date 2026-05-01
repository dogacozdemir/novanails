import type { ExpenseCategory } from "@/types/database";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  rent: "Kira",
  staff: "Personel",
  office: "Ofis",
  food: "Yemek",
  stationery: "Kırtasiye",
  supplies: "Malzeme",
  other: "Diğer",
};

export function expenseCategoryLabel(c: ExpenseCategory): string {
  return EXPENSE_CATEGORY_LABELS[c];
}

export const EXPENSE_CATEGORY_OPTIONS: {
  value: ExpenseCategory;
  label: string;
}[] = (
  Object.entries(EXPENSE_CATEGORY_LABELS) as [ExpenseCategory, string][]
).map(([value, label]) => ({ value, label }));
