import { useMemo, useState } from 'react';
import type { Customer } from '../../types/business';
import type { SponsorTreeNode } from '../../utils/crm/sponsorTree';
import { buildSponsorSubtree, listUpline } from '../../utils/crm/sponsorTree';

interface SponsorTreePanelProps {
  customers: Customer[];
  rootCustomer: Customer;
  maxDepth?: number;
}

function TreeBranch({ node, defaultOpen }: { node: SponsorTreeNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? node.depth < 2);
  const hasChildren = node.children.length > 0;

  return (
    <li className={`sponsor-tree-node sponsor-tree-node--depth-${node.depth}`}>
      <button
        type="button"
        className="sponsor-tree-row"
        onClick={() => hasChildren && setOpen((v) => !v)}
        disabled={!hasChildren}
      >
        <span className="sponsor-tree-toggle">{hasChildren ? (open ? '▼' : '▶') : '·'}</span>
        <strong>{node.customer.name}</strong>
        {node.customer.greenleafNumber && (
          <span className="sponsor-tree-gl">{node.customer.greenleafNumber}</span>
        )}
        <em>{node.directCount} doğrudan · {node.downlineCount} alt hat</em>
      </button>
      {hasChildren && open && (
        <ul className="sponsor-tree-children">
          {node.children.map((child) => (
            <TreeBranch key={child.customer.id} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function SponsorTreePanel({ customers, rootCustomer, maxDepth = 5 }: SponsorTreePanelProps) {
  const tree = useMemo(
    () => buildSponsorSubtree(rootCustomer, customers, maxDepth),
    [rootCustomer, customers, maxDepth],
  );

  const upline = useMemo(
    () => listUpline(rootCustomer, customers),
    [rootCustomer, customers],
  );

  return (
    <div className="sponsor-tree-panel">
      {upline.length > 0 && (
        <div className="sponsor-tree-upline">
          <span className="sponsor-tree-upline-label">Sponsor zinciri</span>
          <ol>
            {upline.map((c) => (
              <li key={c.id}>
                {c.name}
                {c.greenleafNumber ? ` (${c.greenleafNumber})` : ''}
              </li>
            ))}
          </ol>
        </div>
      )}

      <ul className="sponsor-tree-root">
        <TreeBranch node={tree} defaultOpen />
      </ul>

      {tree.downlineCount === 0 && (
        <p className="module-hint">Bu müşterinin sponsor GL numarasına bağlı alt hat kaydı yok.</p>
      )}
    </div>
  );
}

/** CRM Merkezi: kök müşteri seçerek ağaç */
export function SponsorTreeExplorer({ customers }: { customers: Customer[] }) {
  const [rootId, setRootId] = useState('');
  const root = customers.find((c) => c.id === rootId);

  const withGl = customers.filter((c) => c.greenleafNumber);

  return (
    <div className="sponsor-tree-explorer">
      <label className="settings-field">
        <span>Kök distribütör (Greenleaf no)</span>
        <select value={rootId} onChange={(e) => setRootId(e.target.value)}>
          <option value="">Seçin</option>
          {withGl.map((c) => (
            <option key={c.id} value={c.id}>{c.name} — {c.greenleafNumber}</option>
          ))}
        </select>
      </label>
      {root && <SponsorTreePanel customers={customers} rootCustomer={root} />}
    </div>
  );
}
