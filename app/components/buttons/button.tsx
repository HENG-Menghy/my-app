// @/components/buttons/button.tsx

import { ButtonProps } from "@/types/props";
import Link from "next/link";

const ButtonOrLink = ({
  name,
  level,
  padding,
  borderRadius,
  href,
  ariaLabel,
  title,
  width,
  onClick,
}: ButtonProps) => {
  let className = "";
  if (level === "primary") {
    className = `${padding} ${borderRadius} ${width} cursor-pointer text-white inline-block bg-primary hover:bg-primaryHover active:bg-primaryActive transition-colors duration-75 animate-subtle-saturate`;
  }

  if (level === "secondary") {
    className = `${padding} ${borderRadius} ${width} cursor-pointer text-white inline-block bg-secondary hover:bg-secondaryHover active:bg-secondaryActive transition-colors duration-75 animate-subtle-saturate`;
  } 

  if (level === "warning") {
    className = `${padding} ${borderRadius} ${width} cursor-pointer text-white inline-block bg-warning hover:bg-warningHover active:bg-warningActive transition-colors duration-75 animate-subtle-saturate`;
  }
  
  if (level === "danger") {
    className = `${padding} ${borderRadius} ${width} cursor-pointer text-white inline-block bg-danger hover:bg-dangerHover active:bg-dangerActive transition-colors duration-75 animate-subtle-saturate`;
  }

  if (href) {
    return (
      <Link
        href={href}
        aria-label={ariaLabel}
        title={title}
        className={className}
      >
        {name}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      className={className}
    >
      {name}
    </button>
  );
};

export default ButtonOrLink;
