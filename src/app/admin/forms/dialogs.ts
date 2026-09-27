import Swal, { type SweetAlertOptions } from "sweetalert2";
import styles from "../admin.module.css";

/**
 * Hộp thoại SweetAlert2 theo theme tối của trang quản trị — thay thế
 * window.confirm/window.prompt. Nút xác nhận màu đỏ cho hành động xóa,
 * màu chính cho hành động thường; Esc / bấm nền = hủy.
 */
function fire(options: SweetAlertOptions, confirmButton: string) {
  return Swal.fire({
    buttonsStyling: false,
    reverseButtons: true,
    showCancelButton: true,
    cancelButtonText: "Hủy",
    customClass: {
      popup: styles.swalPopup,
      title: styles.swalTitle,
      htmlContainer: styles.swalText,
      icon: styles.swalIcon,
      actions: styles.swalActions,
      confirmButton,
      cancelButton: styles.secondaryButton,
      input: styles.swalInput,
    },
    ...options,
  });
}

/** Xác nhận hành động nguy hiểm (xóa) — icon cảnh báo, nút đỏ, focus vào Hủy. */
export async function confirmDanger(title: string, text?: string, confirmText = "Xóa") {
  const result = await fire(
    { icon: "warning", iconColor: "#f87171", title, text, confirmButtonText: confirmText, focusCancel: true },
    styles.dangerButton,
  );
  return result.isConfirmed;
}

/** Xác nhận hành động thường (đổi quyền, duyệt…) — icon hỏi, nút màu chính. */
export async function confirmAction(title: string, text?: string, confirmText = "Xác nhận") {
  const result = await fire(
    { icon: "question", iconColor: "#38bdf8", title, text, confirmButtonText: confirmText },
    styles.primaryButton,
  );
  return result.isConfirmed;
}

/** Hỏi một chuỗi văn bản (thay window.prompt). Trả về null khi người dùng hủy. */
export async function promptText(options: {
  title: string;
  text?: string;
  initial?: string;
  placeholder?: string;
  confirmText?: string;
  multiline?: boolean;
}) {
  const result = await fire(
    {
      title: options.title,
      text: options.text,
      input: options.multiline ? "textarea" : "text",
      inputValue: options.initial ?? "",
      inputPlaceholder: options.placeholder,
      confirmButtonText: options.confirmText ?? "Xác nhận",
    },
    styles.primaryButton,
  );
  return result.isConfirmed ? String(result.value ?? "") : null;
}
