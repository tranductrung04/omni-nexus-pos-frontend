export function formatVND(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  const formatted = new Intl.NumberFormat('vi-VN').format(Math.abs(safe));
  return `${safe < 0 ? '-' : ''}${formatted}\u00A0₫`;
}

export function formatDateTimeVN(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatTimeVN(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function roleLabelVN(role: string): string {
  switch (role) {
    case 'ADMIN':
      return 'Quản trị hệ thống';
    case 'STORE_ADMIN':
      return 'Chủ cửa hàng';
    case 'STORE_MANAGER':
      return 'Quản lý cửa hàng';
    case 'BRANCH_MANAGER':
      return 'Quản lý chi nhánh';
    case 'BRANCH_CASHIER':
      return 'Thu ngân';
    default:
      return role;
  }
}

export function paymentMethodLabelVN(method: string): string {
  switch (method) {
    case 'CASH':
      return 'Tiền mặt';
    case 'CARD':
      return 'Thẻ ngân hàng';
    case 'UPI':
      return 'Chuyển khoản / QR';
    default:
      return method;
  }
}

export function orderStatusLabelVN(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return 'Hoàn tất';
    case 'PARTIALLY_REFUNDED':
      return 'Hoàn một phần';
    case 'REFUNDED':
      return 'Đã hoàn tiền';
    default:
      return status;
  }
}

export function formatDateVN(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatDurationVN(
  openedAt: string | null | undefined,
  closedAt: string | null | undefined
): string {
  if (!openedAt || !closedAt) return '—';
  const start = new Date(openedAt).getTime();
  const end = new Date(closedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return '—';
  const totalMins = Math.round((end - start) / 60000);
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours === 0) return `${mins}p`;
  return `${hours}g ${String(mins).padStart(2, '0')}p`;
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number>>
) {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes('"') || str.includes(',') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvContent = [
    headers.map(escapeCell).join(','),
    ...rows.map((r) => r.map(escapeCell).join(',')),
  ].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
