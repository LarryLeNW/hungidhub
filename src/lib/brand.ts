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
  overrides?: { brandName?: string; phone?: string; email?: string },
) {
  const targetPhoneDisplay = overrides?.phone || contactPhoneDisplay;
  const targetPhone = targetPhoneDisplay.replace(/\s/g, "");
  const targetEmail = overrides?.email || contactEmail;
  const targetBrandName = overrides?.brandName || brandName;

  const normalizedContacts = contactPatterns
    .reduce(
      (current, pattern) => current.replace(pattern, targetPhoneDisplay),
      value,
    )
    .replace(/zalo\.me\/0931\s*729\s*316/g, `zalo.me/${targetPhone}`)
    .replace(/tel:0931\s*729\s*316/g, `tel:${targetPhone}`)
    .replace(/support@khotaikhoan\.net/g, targetEmail)
    .replace(/khotaikhoan\.net@gmail\.com/g, targetEmail);

  return brandPatterns.reduce(
    (current, pattern) => current.replace(pattern, targetBrandName),
    normalizedContacts,
  );
}
