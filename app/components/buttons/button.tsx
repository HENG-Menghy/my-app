// @/components/buttons/button.tsx

import { ButtonOrLinkProps } from "@/types/props";
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
}: ButtonOrLinkProps) => {
  let className = "";
  let rounded = borderRadius ? borderRadius : 'rounded-lg';
  if (level === "primary") {
    className = `${padding} ${rounded} ${width} cursor-pointer text-white inline-block bg-primary hover:bg-primaryHover active:bg-primaryActive transition-colors duration-75 ease-in-out`;
  }

  if (level === "secondary") {
    className = `${padding} ${rounded} ${width} cursor-pointer text-white inline-block bg-secondary hover:bg-secondaryHover active:bg-secondaryActive transition-colors duration-75 ease-in-out`;
  } 

  if (level === "warn") {
    className = `${padding} ${rounded} ${width} cursor-pointer text-white inline-block bg-warning hover:bg-warningHover active:bg-warningActive transition-colors duration-75 ease-in-out`;
  }
  
  if (level === "danger") {
    className = `${padding} ${rounded} ${width} cursor-pointer text-white inline-block bg-danger hover:bg-dangerHover active:bg-dangerActive transition-colors duration-75 ease-in-out`;
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
