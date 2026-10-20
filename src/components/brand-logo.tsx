import Image from "next/image";

export function BrandLogo({ size = 56 }: { size?: number }) {
  return (
    <Image
      src="/corndog-kane-logo.png"
      alt="Logo Corndog Kane"
      width={size}
      height={size}
      className="shrink-0 rounded-full object-contain"
      style={{ width: size, height: size }}
    />
  );
}
