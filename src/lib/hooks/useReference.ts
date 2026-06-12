/**
 * Reads cached reference lists (branches / warehouses / dealers / accounts) that
 * the sync engine pulls into the kv store, so selectors work offline. Refreshes
 * whenever the sync clock ticks.
 */
import { useEffect, useState } from 'react';

import { kvGet } from '@/lib/db/database';
import { useSync } from '@/lib/sync/SyncProvider';
import type { Account, Branch, Dealer, Warehouse } from '@/lib/types';

export interface Reference {
  branches: Branch[];
  warehouses: Warehouse[];
  dealers: Dealer[];
  accounts: Account[];
  loading: boolean;
}

export function useReference(): Reference {
  const { lastSyncAt } = useSync();
  const [state, setState] = useState<Reference>({
    branches: [],
    warehouses: [],
    dealers: [],
    accounts: [],
    loading: true,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      const [branches, warehouses, dealers, accounts] = await Promise.all([
        kvGet<Branch[]>('branches'),
        kvGet<Warehouse[]>('warehouses'),
        kvGet<Dealer[]>('dealers'),
        kvGet<Account[]>('accounts'),
      ]);
      if (!alive) return;
      setState({
        branches: branches ?? [],
        warehouses: warehouses ?? [],
        dealers: dealers ?? [],
        accounts: accounts ?? [],
        loading: false,
      });
    })();
    return () => {
      alive = false;
    };
  }, [lastSyncAt]);

  return state;
}
