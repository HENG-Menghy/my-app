// @/components/logo.tsx

import Image from "next/image";
import logoImg from "@/logo.png";

const Logo = ({width, height} : {width: string, height: string}) => {
  return (
    <>
      <Image
        src={logoImg}
        alt="System Logo"
        className={`${width} ${height} animate-subtle-saturate`}
        priority
      />
    </>
  );
};

export default Logo;
