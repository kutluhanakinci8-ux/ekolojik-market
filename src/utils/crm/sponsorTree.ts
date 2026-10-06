import type { Customer } from '../../types/business';
import { normalizeGreenleafNumber } from '../customerValidation';

export interface SponsorTreeNode {
  customer: Customer;
  children: SponsorTreeNode[];
  depth: number;
  downlineCount: number;
  directCount: number;
}

function glKey(customer: Customer): string {
  return normalizeGreenleafNumber(customer.greenleafNumber ?? '') || '';
}

function sponsorGlKey(customer: Customer): string {
  return normalizeGreenleafNumber(customer.sponsorGreenleafNumber ?? '') || '';
}

/** Greenleaf sponsor GL no → müşteri eşlemesi */
export function buildGreenleafIndex(customers: Customer[]): Map<string, Customer> {
  const map = new Map<string, Customer>();
  for (const c of customers) {
    const key = glKey(c);
    if (key) map.set(key, c);
  }
  return map;
}

export function findSponsorCustomer(
  customer: Customer,
  index: Map<string, Customer>,
): Customer | undefined {
  const sponsorGl = sponsorGlKey(customer);
  if (!sponsorGl) return undefined;
  return index.get(sponsorGl);
}

function countDownline(node: SponsorTreeNode): number {
  let n = node.children.length;
  for (const child of node.children) {
    n += countDownline(child);
  }
  return n;
}

export function buildSponsorSubtree(
  root: Customer,
  customers: Customer[],
  maxDepth = 5,
): SponsorTreeNode {
  function walk(current: Customer, depth: number): SponsorTreeNode {
    const currentGl = glKey(current);
    const childrenCustomers = customers.filter((c) => {
      if (c.id === current.id) return false;
      const s = sponsorGlKey(c);
      return s && currentGl && s === currentGl;
    });

    const children = depth >= maxDepth
      ? []
      : childrenCustomers.map((c) => walk(c, depth + 1));

    const node: SponsorTreeNode = {
      customer: current,
      children,
      depth,
      directCount: children.length,
      downlineCount: 0,
    };
    node.downlineCount = countDownline(node);
    return node;
  }

  return walk(root, 0);
}

export function listUpline(
  customer: Customer,
  customers: Customer[],
  maxHops = 8,
): Customer[] {
  const index = buildGreenleafIndex(customers);
  const chain: Customer[] = [];
  let current: Customer | undefined = customer;
  const seen = new Set<string>();

  for (let i = 0; i < maxHops; i += 1) {
    if (!current) break;
    const sponsor = findSponsorCustomer(current, index);
    if (!sponsor || seen.has(sponsor.id)) break;
    seen.add(sponsor.id);
    chain.push(sponsor);
    current = sponsor;
  }
  return chain;
}
