export type BankInfo = {
  bankName: string;
  accountNumber: string;
  accountName: string;
};

export const DEFAULT_BANK_INFO: BankInfo = {
  bankName: process.env.BANK_NAME || 'BIDV',
  accountNumber: (
    process.env.BANK_ACCOUNT_NUMBER ||
    process.env.CASSO_ACCOUNT_NUMBER ||
    'V3CASS111'
  )
    .split(',')[0]
    .trim(),
  accountName: process.env.BANK_ACCOUNT_NAME || 'AIHUB',
};

export function getBankInfo(): BankInfo {
  return {
    bankName: process.env.BANK_NAME || DEFAULT_BANK_INFO.bankName,
    accountNumber: (
      process.env.BANK_ACCOUNT_NUMBER ||
      process.env.CASSO_ACCOUNT_NUMBER ||
      DEFAULT_BANK_INFO.accountNumber
    )
      .split(',')[0]
      .trim(),
    accountName: process.env.BANK_ACCOUNT_NAME || DEFAULT_BANK_INFO.accountName,
  };
}
