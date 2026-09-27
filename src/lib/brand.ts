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

export function replaceBrandText(value: string) {
  const normalizedContacts = contactPatterns
    .reduce(
      (current, pattern) => current.replace(pattern, contactPhoneDisplay),
      value,
    )
    .replace(/zalo\.me\/0931\s*729\s*316/g, `zalo.me/${contactPhone}`)
    .replace(/tel:0931\s*729\s*316/g, `tel:${contactPhone}`)
    .replace(/support@khotaikhoan\.net/g, contactEmail)
    .replace(/khotaikhoan\.net@gmail\.com/g, contactEmail);

  return brandPatterns.reduce(
    (current, pattern) => current.replace(pattern, brandName),
    normalizedContacts,
  );
}
