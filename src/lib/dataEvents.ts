export type DataTopic =
  | 'tasks'
  | 'taskPrices'
  | 'dailyEntries'
  | 'crews'
  | 'payrollPeriods'
  | 'paymentReceipts';

const DATA_UPDATED_EVENT = 'obra:data-updated';

type DataUpdatedPayload = {
  topics: DataTopic[];
};

export const notifyDataUpdated = (topics: DataTopic[]) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<DataUpdatedPayload>(DATA_UPDATED_EVENT, {
      detail: { topics },
    })
  );
};

export const subscribeDataUpdated = (
  callback: (topics: DataTopic[]) => void
) => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<DataUpdatedPayload>;
    callback(customEvent.detail?.topics || []);
  };

  window.addEventListener(DATA_UPDATED_EVENT, listener);
  return () => window.removeEventListener(DATA_UPDATED_EVENT, listener);
};

