export interface CountryFormat {
  code: string;
  name: string;
  defaultCurrency: string;
  bankFields: { key: string; label: string }[];
  formatAddress(addressLines: string[]): string[];
  formatBankDetails(bank: Record<string, string | null>): { label: string; value: string }[];
}

function appendCountry(lines: string[], country: string): string[] {
  const trimmed = lines.map((l) => l.trim()).filter(Boolean);
  if (trimmed[trimmed.length - 1]?.toLowerCase() === country.toLowerCase()) return trimmed;
  return [...trimmed, country];
}

function sortCode(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 6) return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`;
  return raw;
}

function bsb(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return raw;
}

function bankRow(bank: Record<string, string | null>, key: string, label: string, fmt?: (v: string) => string): { label: string; value: string } | null {
  const v = bank[key];
  if (!v) return null;
  return { label, value: fmt ? fmt(v) : v };
}

function rows(bank: Record<string, string | null>, fields: { key: string; label: string; fmt?: (v: string) => string }[]): { label: string; value: string }[] {
  return fields.flatMap((f) => {
    const r = bankRow(bank, f.key, f.label, f.fmt);
    return r ? [r] : [];
  });
}

export const COUNTRY_FORMATS: Record<string, CountryFormat> = {
  GB: {
    code: "GB",
    name: "United Kingdom",
    defaultCurrency: "GBP",
    bankFields: [
      { key: "bank_account_name", label: "Account name" },
      { key: "bank_sort_code", label: "Sort code" },
      { key: "bank_account_number", label: "Account number" },
    ],
    formatAddress: (lines) => appendCountry(lines, "United Kingdom"),
    formatBankDetails: (bank) =>
      rows(bank, [
        { key: "bank_account_name", label: "Account name" },
        { key: "bank_sort_code", label: "Sort code", fmt: sortCode },
        { key: "bank_account_number", label: "Account number" },
        { key: "bank_iban", label: "IBAN" },
        { key: "bank_swift_bic", label: "SWIFT/BIC" },
      ]),
  },

  US: {
    code: "US",
    name: "United States",
    defaultCurrency: "USD",
    bankFields: [
      { key: "bank_account_name", label: "Account name" },
      { key: "bank_name", label: "Bank name" },
      { key: "bank_routing_number", label: "Routing number (ABA)" },
      { key: "bank_account_number", label: "Account number" },
      { key: "bank_account_type", label: "Account type" },
      { key: "bank_swift_bic", label: "SWIFT/BIC" },
    ],
    formatAddress: (lines) => appendCountry(lines, "United States"),
    formatBankDetails: (bank) =>
      rows(bank, [
        { key: "bank_account_name", label: "Account name" },
        { key: "bank_name", label: "Bank name" },
        { key: "bank_routing_number", label: "Routing number (ABA)" },
        { key: "bank_account_number", label: "Account number" },
        { key: "bank_account_type", label: "Account type" },
        { key: "bank_swift_bic", label: "SWIFT/BIC" },
      ]),
  },

  NG: {
    code: "NG",
    name: "Nigeria",
    defaultCurrency: "NGN",
    bankFields: [
      { key: "bank_account_name", label: "Account name" },
      { key: "bank_name", label: "Bank name" },
      { key: "bank_account_number", label: "Account number (NUBAN)" },
      { key: "mobile_money_provider", label: "Mobile money provider" },
      { key: "mobile_money_number", label: "Mobile money number" },
    ],
    formatAddress: (lines) => appendCountry(lines, "Nigeria"),
    formatBankDetails: (bank) => {
      const out = rows(bank, [
        { key: "bank_account_name", label: "Account name" },
        { key: "bank_name", label: "Bank name" },
        { key: "bank_account_number", label: "Account number" },
      ]);
      if (bank.mobile_money_provider || bank.mobile_money_number) {
        if (bank.mobile_money_provider)
          out.push({ label: "Mobile money provider", value: bank.mobile_money_provider });
        if (bank.mobile_money_number)
          out.push({ label: "Mobile money number", value: bank.mobile_money_number });
        if (bank.bank_account_name)
          out.push({ label: "Mobile money name", value: bank.bank_account_name });
      }
      return out;
    },
  },

  GH: {
    code: "GH",
    name: "Ghana",
    defaultCurrency: "GHS",
    bankFields: [
      { key: "bank_account_name", label: "Account name" },
      { key: "bank_name", label: "Bank name" },
      { key: "bank_branch_code", label: "Branch/sort code" },
      { key: "bank_account_number", label: "Account number" },
      { key: "mobile_money_provider", label: "Mobile money provider" },
      { key: "mobile_money_number", label: "Mobile money number" },
    ],
    formatAddress: (lines) => appendCountry(lines, "Ghana"),
    formatBankDetails: (bank) => {
      const out = rows(bank, [
        { key: "bank_account_name", label: "Account name" },
        { key: "bank_name", label: "Bank name" },
        { key: "bank_branch_code", label: "Branch/sort code" },
        { key: "bank_account_number", label: "Account number" },
      ]);
      if (bank.mobile_money_provider || bank.mobile_money_number) {
        if (bank.mobile_money_provider)
          out.push({ label: "Mobile money provider", value: bank.mobile_money_provider });
        if (bank.mobile_money_number)
          out.push({ label: "Mobile money number", value: bank.mobile_money_number });
        if (bank.bank_account_name)
          out.push({ label: "Mobile money name", value: bank.bank_account_name });
      }
      return out;
    },
  },

  CA: {
    code: "CA",
    name: "Canada",
    defaultCurrency: "CAD",
    bankFields: [
      { key: "bank_account_name", label: "Account name" },
      { key: "bank_institution_no", label: "Institution number" },
      { key: "bank_transit_no", label: "Transit number" },
      { key: "bank_account_number", label: "Account number" },
    ],
    formatAddress: (lines) => appendCountry(lines, "Canada"),
    formatBankDetails: (bank) =>
      rows(bank, [
        { key: "bank_account_name", label: "Account name" },
        { key: "bank_institution_no", label: "Institution number" },
        { key: "bank_transit_no", label: "Transit number" },
        { key: "bank_account_number", label: "Account number" },
      ]),
  },

  IE: {
    code: "IE",
    name: "Ireland",
    defaultCurrency: "EUR",
    bankFields: [
      { key: "bank_account_name", label: "Account name" },
      { key: "bank_iban", label: "IBAN" },
      { key: "bank_swift_bic", label: "BIC/SWIFT" },
    ],
    formatAddress: (lines) => appendCountry(lines, "Ireland"),
    formatBankDetails: (bank) =>
      rows(bank, [
        { key: "bank_account_name", label: "Account name" },
        { key: "bank_iban", label: "IBAN" },
        { key: "bank_swift_bic", label: "BIC/SWIFT" },
      ]),
  },

  DE: {
    code: "DE",
    name: "Germany",
    defaultCurrency: "EUR",
    bankFields: [
      { key: "bank_account_name", label: "Kontoinhaber" },
      { key: "bank_iban", label: "IBAN" },
      { key: "bank_swift_bic", label: "BIC/SWIFT" },
    ],
    formatAddress: (lines) => appendCountry(lines, "Germany"),
    formatBankDetails: (bank) =>
      rows(bank, [
        { key: "bank_account_name", label: "Kontoinhaber" },
        { key: "bank_iban", label: "IBAN" },
        { key: "bank_swift_bic", label: "BIC/SWIFT" },
      ]),
  },

  AU: {
    code: "AU",
    name: "Australia",
    defaultCurrency: "AUD",
    bankFields: [
      { key: "bank_account_name", label: "Account name" },
      { key: "bank_bsb", label: "BSB" },
      { key: "bank_account_number", label: "Account number" },
    ],
    formatAddress: (lines) => appendCountry(lines, "Australia"),
    formatBankDetails: (bank) =>
      rows(bank, [
        { key: "bank_account_name", label: "Account name" },
        { key: "bank_bsb", label: "BSB", fmt: bsb },
        { key: "bank_account_number", label: "Account number" },
      ]),
  },
};

const GENERIC: CountryFormat = {
  code: "",
  name: "",
  defaultCurrency: "GBP",
  bankFields: [
    { key: "bank_account_name", label: "Account name" },
    { key: "bank_name", label: "Bank" },
    { key: "bank_account_number", label: "Account number" },
    { key: "bank_iban", label: "IBAN" },
    { key: "bank_swift_bic", label: "SWIFT/BIC" },
  ],
  formatAddress: (lines) => lines.map((l) => l.trim()).filter(Boolean),
  formatBankDetails: (bank) =>
    rows(bank, [
      { key: "bank_account_name", label: "Account name" },
      { key: "bank_name", label: "Bank" },
      { key: "bank_account_number", label: "Account number" },
      { key: "bank_iban", label: "IBAN" },
      { key: "bank_swift_bic", label: "SWIFT/BIC" },
    ]),
};

export function getCountryFormat(code: string): CountryFormat {
  return COUNTRY_FORMATS[code.toUpperCase()] ?? GENERIC;
}
