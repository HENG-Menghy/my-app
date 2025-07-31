// @/types/props.ts

export type ButtonProps = {
  name: string;
  level: "primary" | "secondary" | "warning" | "danger";
  padding: string;
  borderRadius: string;
  href?: string;
  ariaLabel?: string;
  title?: string;
  width?: string;
  onClick?: () => void;
};
