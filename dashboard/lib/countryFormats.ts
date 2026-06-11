export interface CountryFormat {
  code: string;
  name: string;
  defaultCurrency: string;
  bankFields: { key: string; label: string; type?: "text" | "select"; options?: string[] }[];
}

export const COUNTRY_FORMATS: Record<string, CountryFormat> = {
  GB: {
    code: "GB",
    name: "United Kingdom",
    defaultCurrency: "GBP",
    bankFields: [
      { key: "bank_name", label: "Bank name" },
      { key: "bank_account_name", label: "Account name" },
      { key: "bank_sort_code", label: "Sort code (e.g. 12-34-56)" },
      { key: "bank_account_number", label: "Account number (8 digits)" },
    ],
  },
  US: {
    code: "US",
    name: "United States",
    defaultCurrency: "USD",
    bankFields: [
      { key: "bank_name", label: "Bank name" },
      { key: "bank_account_name", label: "Account name" },
      { key: "bank_routing_number", label: "Routing number (ABA, 9 digits)" },
      { key: "bank_account_number", label: "Account number" },
      {
        key: "bank_account_type",
        label: "Account type",
        type: "select",
        options: ["checking", "savings"],
      },
      { key: "bank_swift_bic", label: "SWIFT/BIC (optional)" },
    ],
  },
  NG: {
    code: "NG",
    name: "Nigeria",
    defaultCurrency: "NGN",
    bankFields: [
      { key: "bank_name", label: "Bank name" },
      { key: "bank_account_name", label: "Account name" },
      { key: "bank_account_number", label: "Account number (NUBAN, 10 digits)" },
      {
        key: "mobile_money_provider",
        label: "Mobile money provider (optional)",
        type: "select",
        options: ["", "MTN MoMo", "Telecel Cash", "AirtelTigo Money"],
      },
      { key: "mobile_money_number", label: "Mobile money number (optional)" },
    ],
  },
  GH: {
    code: "GH",
    name: "Ghana",
    defaultCurrency: "GHS",
    bankFields: [
      { key: "bank_name", label: "Bank name" },
      { key: "bank_account_name", label: "Account name" },
      { key: "bank_branch_code", label: "Branch/sort code" },
      { key: "bank_account_number", label: "Account number" },
      {
        key: "mobile_money_provider",
        label: "Mobile money provider (optional)",
        type: "select",
        options: ["", "MTN MoMo", "Telecel Cash", "AirtelTigo Money"],
      },
      { key: "mobile_money_number", label: "Mobile money number (optional)" },
    ],
  },
  CA: {
    code: "CA",
    name: "Canada",
    defaultCurrency: "CAD",
    bankFields: [
      { key: "bank_name", label: "Bank name" },
      { key: "bank_account_name", label: "Account name" },
      { key: "bank_institution_no", label: "Institution number (3 digits)" },
      { key: "bank_transit_no", label: "Transit number (5 digits)" },
      { key: "bank_account_number", label: "Account number" },
    ],
  },
  IE: {
    code: "IE",
    name: "Ireland",
    defaultCurrency: "EUR",
    bankFields: [
      { key: "bank_name", label: "Bank name" },
      { key: "bank_account_name", label: "Account name" },
      { key: "bank_iban", label: "IBAN (starts IE)" },
      { key: "bank_swift_bic", label: "BIC/SWIFT" },
    ],
  },
  DE: {
    code: "DE",
    name: "Germany",
    defaultCurrency: "EUR",
    bankFields: [
      { key: "bank_name", label: "Bank name" },
      { key: "bank_account_name", label: "Kontoinhaber (account name)" },
      { key: "bank_iban", label: "IBAN (starts DE)" },
      { key: "bank_swift_bic", label: "BIC/SWIFT" },
    ],
  },
  AU: {
    code: "AU",
    name: "Australia",
    defaultCurrency: "AUD",
    bankFields: [
      { key: "bank_name", label: "Bank name" },
      { key: "bank_account_name", label: "Account name" },
      { key: "bank_bsb", label: "BSB (6 digits, e.g. 123-456)" },
      { key: "bank_account_number", label: "Account number" },
    ],
  },
};

export const COUNTRY_LIST = Object.values(COUNTRY_FORMATS).sort((a, b) =>
  a.name.localeCompare(b.name)
);

export function getCountryFormat(code: string): CountryFormat {
  return (
    COUNTRY_FORMATS[code.toUpperCase()] ?? {
      code,
      name: code,
      defaultCurrency: "GBP",
      bankFields: [
        { key: "bank_name", label: "Bank name" },
        { key: "bank_account_name", label: "Account name" },
        { key: "bank_account_number", label: "Account number" },
      ],
    }
  );
}
