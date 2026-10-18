import { expenseCategoryAccount } from '../data/chartOfAccounts';
import type { CustomExpenseCategory, ExpenseCategory } from '../types/business';
import { EXPENSE_CATEGORY_LABELS, isBuiltinExpenseCategory } from '../types/business';

export const EXPENSE_CATEGORY_ADD_OPTION = '__add_new__';

export function normalizeCustomExpenseCategories(
  raw?: CustomExpenseCategory[] | null,
): CustomExpenseCategory[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && typeof item.id === 'string' && typeof item.label === 'string')
    .map((item) => ({
      id: item.id,
      label: item.label.trim(),
      accountCode: item.accountCode?.trim() || '770',
      createdAt: item.createdAt || new Date().toISOString(),
    }))
    .filter((item) => item.label.length > 0);
}

export function getExpenseCategoryLabel(
  categoryId: ExpenseCategory,
  customCategories: CustomExpenseCategory[] = [],
): string {
  if (isBuiltinExpenseCategory(categoryId)) {
    return EXPENSE_CATEGORY_LABELS[categoryId];
  }
  const custom = customCategories.find((item) => item.id === categoryId);
  return custom?.label ?? categoryId;
}

export function resolveExpenseCategoryAccount(
  categoryId: ExpenseCategory,
  customCategories: CustomExpenseCategory[] = [],
): string {
  const custom = customCategories.find((item) => item.id === categoryId);
  if (custom) return custom.accountCode;
  if (isBuiltinExpenseCategory(categoryId)) {
    return expenseCategoryAccount(categoryId);
  }
  return '770';
}

export function listExpenseCategorySelectOptions(
  customCategories: CustomExpenseCategory[] = [],
): Array<{ id: ExpenseCategory; label: string }> {
  const builtins = Object.entries(EXPENSE_CATEGORY_LABELS).map(([id, label]) => ({
    id: id as ExpenseCategory,
    label,
  }));
  const customs = customCategories.map((item) => ({ id: item.id as ExpenseCategory, label: item.label }));
  return [...builtins, ...customs];
}

export function validateNewExpenseCategoryLabel(
  label: string,
  customCategories: CustomExpenseCategory[] = [],
): string | null {
  const trimmed = label.trim();
  if (!trimmed) return 'Kategori adı zorunludur.';
  if (trimmed.length < 2) return 'Kategori adı en az 2 karakter olmalıdır.';
  const lower = trimmed.toLocaleLowerCase('tr');
  const builtinDuplicate = Object.values(EXPENSE_CATEGORY_LABELS).some(
    (name) => name.toLocaleLowerCase('tr') === lower,
  );
  if (builtinDuplicate) return 'Bu isimde hazır bir kategori zaten var.';
  const customDuplicate = customCategories.some(
    (item) => item.label.toLocaleLowerCase('tr') === lower,
  );
  if (customDuplicate) return 'Bu isimde bir kategori zaten kayıtlı.';
  return null;
}

export function createCustomExpenseCategoryId(): string {
  return `custom-${Date.now()}`;
}
