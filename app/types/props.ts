// @/types/props.ts

export type ButtonOrLinkProps = {
  name: string;
  level: "primary" | "secondary" | "warn" | "danger";
  padding: string;
  borderRadius?: string;
  href?: string;
  ariaLabel?: string;
  title?: string;
  width?: string;
  onClick?: () => void;
};
