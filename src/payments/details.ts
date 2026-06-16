import { getBusinessById } from "../db/queries";
import { getCountryFormat } from "../format/countryFormats";

export type PayMethod = "bank_transfer" | "stripe" | "both";

export interface BusinessPaymentInfo {
  method: PayMethod;
  payment: { label: string; value: string }[];
}

export async function getBusinessPaymentInfo(businessId: string): Promise<BusinessPaymentInfo> {
  const business = await getBusinessById(businessId);
  const country = business?.country ?? "GB";
  const bankRecord: Record<string, string | null> = {
    bank_name: business?.bank_name ?? null,
    bank_account_name: business?.bank_account_name ?? null,
    bank_account_number: business?.bank_account_number ?? null,
    bank_sort_code: business?.bank_sort_code ?? null,
    bank_routing_number: business?.bank_routing_number ?? null,
    bank_account_type: business?.bank_account_type ?? null,
    bank_institution_no: business?.bank_institution_no ?? null,
    bank_transit_no: business?.bank_transit_no ?? null,
    bank_bsb: business?.bank_bsb ?? null,
    bank_branch_code: business?.bank_branch_code ?? null,
    bank_iban: business?.bank_iban ?? null,
    bank_swift_bic: business?.bank_swift_bic ?? null,
    mobile_money_provider: business?.mobile_money_provider ?? null,
    mobile_money_number: business?.mobile_money_number ?? null,
  };
  return {
    method: (business?.invoice_payment_method as PayMethod) ?? "bank_transfer",
    payment: getCountryFormat(country).formatBankDetails(bankRecord),
  };
}
