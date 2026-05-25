import { create } from 'zustand';
import { Connection } from '@solana/web3.js';
import AppSettings from '@/utils/store/settingsstore.store';
import { api_key } from '@/utils/dashboard';
import { transferSol, transferToken } from '@/libs/tools/transfer/transfers';
import { recordTransferTransaction } from '@/services/appTransactions';

export type TransactionStatus = 'queued' | 'signing' | 'submitted' | 'confirming' | 'confirmed' | 'failed';

export interface EnqueueSolParams {
  kind: 'sol';
  recipient: string;
  amount: number;
}

export interface EnqueueSplParams {
  kind: 'spl';
  recipient: string;
  mint: string;
  amount: number;
  decimals: number;
  symbol?: string;
}

export type EnqueueParams = EnqueueSolParams | EnqueueSplParams;

export interface TxQueueItem {
  id: string;
  createdAt: number;
  params: EnqueueParams;
  status: TransactionStatus;
  txid?: string;
  error?: string;
}

interface TxQueueStore {
  items: Record<string, TxQueueItem>;
  enqueue: (params: EnqueueParams) => string;
  get: (id: string) => TxQueueItem | undefined;
  _setItem: (id: string, updater: (prev: TxQueueItem) => TxQueueItem) => void;
}

const createConnection = (): Connection => {
  const network = AppSettings.getState().network;
  return new Connection(`${network}${api_key}`);
};

const processItem = async (id: string, get: () => TxQueueStore['items'], setItem: TxQueueStore['_setItem']) => {
  const state = get();
  const item = state[id];
  if (!item) return;

  try {
    setItem(id, (prev) => ({ ...prev, status: 'signing' }));

    const connection = createConnection();
    let txid: string;

    if (item.params.kind === 'sol') {
      txid = (await transferSol(item.params.recipient, item.params.amount, connection)).message;

    } else {
      txid = (await transferToken(
        item.params.recipient,
        item.params.mint,
        item.params.amount,
        item.params.decimals,
        connection
      )).message;
    }


    setItem(id, (prev) => ({ ...prev, status: 'submitted', txid }));

    setItem(id, (prev) => ({ ...prev, status: 'confirming' }));
    await connection.confirmTransaction(txid, 'confirmed');

    setItem(id, (prev) => ({ ...prev, status: 'confirmed' }));

    if (item.params.kind === 'sol') {
      recordTransferTransaction({
        signature: txid,
        symbol: 'SOL',
        amount: item.params.amount,
        recipient: item.params.recipient,
        app_called: 'HeySolana',
        provider: 'native',
      });
    } else {
      recordTransferTransaction({
        signature: txid,
        mint: item.params.mint,
        symbol: item.params.symbol ?? 'SPL',
        amount: item.params.amount,
        recipient: item.params.recipient,
        app_called: 'HeySolana',
        provider: 'native',
      });
    }
  } catch (err: any) {
    const message = typeof err?.message === 'string' ? err.message.includes('Insufficient funds') ? 'Insufficient funds for Fees' : err.message : 'Transaction failed';
    setItem(id, (prev) => ({ ...prev, status: 'failed', error: message }));
  }
};

const TxQueue = create<TxQueueStore>((set, get) => ({
  items: {},
  _setItem: (id, updater) => set((state) => ({
    items: { ...state.items, [id]: updater(state.items[id]) }
  })),
  enqueue: (params) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const item: TxQueueItem = {
      id,
      createdAt: Date.now(),
      params,
      status: 'queued',
    };
    set((state) => ({ items: { ...state.items, [id]: item } }));

    // Start processing asynchronously; do not block UI
    processItem(id, () => get().items, (id, updater) => get()._setItem(id, updater));
    return id;
  },
  get: (id) => get().items[id],
}));

export default TxQueue;


