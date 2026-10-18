import type { Supplier } from '../types/accounting';

export function supplierMatchesSearch(supplier: Supplier, query: string): boolean {
  const q = query.trim().toLocaleLowerCase('tr');
  if (!q) return true;
  const haystack = [
    supplier.name,
    supplier.taxNumber,
    supplier.taxOffice,
    supplier.phone,
    supplier.email,
    supplier.address,
    supplier.notes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('tr');
  return haystack.includes(q);
}

export function validateSupplierInput(
  data: { name: string; taxNumber?: string },
  options?: { existingSuppliers: Supplier[]; editingId?: string },
): string | null {
  const name = data.name.trim();
  if (!name) return 'Tedarikçi adı zorunludur.';
  if (name.length < 2) return 'Tedarikçi adı en az 2 karakter olmalıdır.';
  const duplicate = options?.existingSuppliers.find(
    (item) =>
      item.id !== options.editingId
      && item.name.trim().toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr'),
  );
  if (duplicate) return 'Bu isimde bir tedarikçi zaten kayıtlı.';
  const tax = data.taxNumber?.trim();
  if (tax && !/^\d{10,11}$/.test(tax.replace(/\s/g, ''))) {
    return 'Vergi numarası 10 veya 11 haneli olmalıdır.';
  }
  return null;
}
