export const brandName = "IDHUB";
export const contactPhone = "0931729316";
export const contactPhoneDisplay = "0931 729 316";
export const contactEmail = "larrylenw@gmail.com";

// (?!\.net) keeps khotaikhoan.net URLs intact — image/link domains must not be rebranded.
const brandPatterns = [
  /Kho\s*Tài\s*Khoản(?!\.net)/gi,
  /Kho\s*Tai\s*Khoan(?!\.net)/gi,
  /KhoTaiKhoan(?!\.net)/g,
];

const contactPatterns = [
  /0865\s*890\s*208/g,
  /0865890208/g,
  /0983\s*449\s*023/g,
  /0983449023/g,
];

export function replaceBrandText(
  value: string,
  overrides?: {
    brandName?: string;
    phone?: string;
    email?: string;
    zalo?: string;
    domain?: string;
  },
) {
  if (!value) return "";

  const targetPhoneDisplay = overrides?.phone || contactPhoneDisplay;
  const targetPhone = targetPhoneDisplay.replace(/\s/g, "");
  const targetEmail = overrides?.email || contactEmail;
  const targetBrandName = overrides?.brandName || brandName;
  const targetZalo = overrides?.zalo || `https://zalo.me/${targetPhone}`;

  // 1. Normalize contact phone numbers in text
  let result = contactPatterns.reduce(
    (current, pattern) => current.replace(pattern, targetPhoneDisplay),
    value,
  );

  // 2. Normalize Zalo links (strip spaces from zalo.me URLs)
  result = result
    .replace(/https?:\/\/zalo\.me\/[0-9\s]+/gi, targetZalo)
    .replace(/zalo\.me\/[0-9\s]+/gi, `zalo.me/${targetPhone}`)
    .replace(/tel:[0-9\s]+/gi, `tel:${targetPhone}`)
    .replace(/support@khotaikhoan\.net/gi, targetEmail)
    .replace(/khotaikhoan\.net@gmail\.com/gi, targetEmail)
    .replace(/https?:\/\/(?:www\.)?facebook\.com\/khotaikhoan\.net2026\/?/gi, targetZalo);

  // 3. Replace brand mentions
  return brandPatterns.reduce(
    (current, pattern) => current.replace(pattern, targetBrandName),
    result,
  );
}
