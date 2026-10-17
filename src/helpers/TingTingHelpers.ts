export class TingTingHelpers {
  static generateQrCodeEMVCO(
    amount: number,
    bankBin?: string,
    accountNo?: string,
    content?: string,
    transactionId?: string,
  ): string {
    if (amount <= 0) {
      throw new Error("Số tiền phải lớn hơn 0");
    }

    const cleanBin = (bankBin ?? "").trim();
    const cleanAccount = (accountNo ?? "").trim();
    const cleanContent = (content ?? "").trim();
    const cleanTxId = (transactionId ?? "").trim();

    const tlv = (tag: string, value: string): string => {
      if (value == null || value === "") return "";

      // Độ dài theo số byte UTF-8
      const length = new TextEncoder().encode(value).length;
      return `${tag}${String(length).padStart(2, "0")}${value}`;
    };

    let payload = "000201";
    payload += "010212";

    const consumerInfoValue =
      tlv("00", cleanBin) +
      tlv("01", cleanAccount);

    const merchantAccountInfoValue =
      tlv("00", "A000000727") +
      tlv("01", consumerInfoValue) +
      tlv("02", "QRIBFTTA");

    payload += tlv("38", merchantAccountInfoValue);
    payload += "52040000";
    payload += "5303704";

    const amountStr = Math.trunc(amount).toString();
    payload += tlv("54", amountStr);
    payload += "5802VN";

    const additionalData =
      tlv("01", cleanTxId) +
      tlv("08", cleanContent);

    // Giữ nguyên logic từ code C# ban đầu
    if (cleanContent !== "") {
      payload += tlv("62", tlv("08", additionalData));
    }

    payload += "6304";

    const crc = this.calculateCrc16(payload);

    return payload + crc;
  }

  static calculateCrc16(input: string): string {
    let crc = 0xffff;
    const polynomial = 0x1021;

    for (let i = 0; i < input.length; i++) {
      const b = input.charCodeAt(i) & 0xff;
      crc ^= b << 8;

      for (let j = 0; j < 8; j++) {
        if ((crc & 0x8000) !== 0) {
          crc = ((crc << 1) ^ polynomial) & 0xffff;
        } else {
          crc = (crc << 1) & 0xffff;
        }
      }
    }

    return crc.toString(16).toUpperCase().padStart(4, "0");
  }
}