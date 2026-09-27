import Link from "next/link";
import Image from "next/image";
import styles from "./Idhub-logo.module.css";

type IdhubLogoProps = {
  href?: string;
  size?: "sm" | "md" | "lg";
  admin?: boolean;
  /** Wordmark colors: "light" for white backgrounds, "dark" for dark ones. Defaults to dark when `admin`. */
  tone?: "light" | "dark";
  /** Store name from settings; falls back to the Idhub brand. */
  name?: string;
  tagline?: string;
  className?: string;
};

/** Shared project logo used by the site chrome and intro splash. */
export function LogoMark() {
  return (
    <Image
      src="/logo.png"
      alt=""
      width={5000}
      height={5000}
      sizes="48px"
      loading="eager"
      className={styles.markImage}
    />
  );
}

export function IdhubLogo({
  href = "/",
  size = "md",
  admin = false,
  tone = admin ? "dark" : "light",
  name = "Idhub",
  tagline,
  className = "",
}: IdhubLogoProps) {
  const upper = name.toUpperCase();
  const [head, tail] = upper.startsWith("AI") && upper.length > 2 ? [upper.slice(0, 2), upper.slice(2)] : [upper, ""];
  return (
    <Link
      href={href}
      aria-label={admin ? `Trang quản trị ${upper}` : `Trang chủ ${upper}`}
      className={`${styles.logo} ${styles[size]} ${styles[tone]} ${className}`}
    >
      <span className={styles.mark} aria-hidden="true">
        <LogoMark />
      </span>
      <span className={styles.wordmark}>
        <span className={styles.name}>
          <span>{head}</span>
          {tail && <strong>{tail}</strong>}
          {admin && <span className={styles.adminBadge}>ADMIN</span>}
        </span>
        {tagline && <span className={styles.tagline}>{tagline}</span>}
      </span>
    </Link>
  );
}
