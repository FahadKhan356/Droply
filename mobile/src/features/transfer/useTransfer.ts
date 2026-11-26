import { useDroplyStore } from '../../store/useDroplyStore';

export function useTransfer() {
  const {
    transfers,
    connectionState,
    startFileTransfer,
    pauseActiveTransfer,
    resumeActiveTransfer,
    cancelActiveTransfer,
    approveIncomingTransfer,
    rejectIncomingTransfer,
  } = useDroplyStore();

  const activeTransfer =
    transfers.find(
      (t) =>
        t.status === 'Transferring' ||
        t.status === 'Paused' ||
        t.status === 'Preparing' ||
        t.status === 'Verifying' ||
        t.status === 'Waiting for Approval' ||
        t.status === 'Interrupted'
    ) ||
    transfers[0] ||
    null;

  const incomingPending = transfers.find(
    (t) => t.direction === 'receive' && t.status === 'Waiting for Approval'
  );

  return {
    transfers,
    activeTransfer,
    incomingPending,
    connectionState,
    startFileTransfer,
    pauseActiveTransfer,
    resumeActiveTransfer,
    cancelActiveTransfer,
    approveIncomingTransfer,
    rejectIncomingTransfer,
  };
}
