import type { SVGProps } from "react";

import type { IconProps } from "@/components/icons";

// Third-party sign-in marks keep their brand colors, so they live apart from
// the themed icon set in icons.tsx.
function IconSvg(props: SVGProps<SVGSVGElement>) {
  return <svg aria-hidden="true" focusable="false" {...props} />;
}

export function GoogleLogoIcon({ size = 24 }: IconProps) {
  return (
    <IconSvg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M21.8 12.2c0-.7-.1-1.5-.2-2.2H12v4h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.2c1.9-1.8 3.1-4.4 3.1-7.5Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 5-.9 6.7-2.3l-3.2-2.6c-.9.6-2 1-3.5 1a5.9 5.9 0 0 1-5.6-4.1H3.1v2.7A10.1 10.1 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.4 14a6 6 0 0 1 0-3.9V7.3H3.1a10 10 0 0 0 0 9.4L6.4 14Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.9c1.6 0 3 .5 4.1 1.6L19 4.6A9.7 9.7 0 0 0 12 2a10.1 10.1 0 0 0-8.9 5.3l3.3 2.8A5.9 5.9 0 0 1 12 5.9Z"
        fill="#EA4335"
      />
    </IconSvg>
  );
}

export function AppleLogoIcon({
  size = 24,
  color = "currentColor",
}: IconProps) {
  return (
    <IconSvg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M17.1 12.5c0-2.7 2.2-4 2.3-4.1a5 5 0 0 0-3.9-2.1c-1.7-.2-3.3 1-4.1 1-.9 0-2.2-1-3.6-1-1.8 0-3.5 1.1-4.4 2.7-1.9 3.3-.5 8.2 1.3 10.9.9 1.3 2 2.8 3.4 2.7 1.4-.1 1.9-.9 3.6-.9s2.2.9 3.7.9c1.5 0 2.5-1.4 3.4-2.7a12 12 0 0 0 1.5-3.1 4.7 4.7 0 0 1-3.2-4.3ZM14.4 4.6A4.8 4.8 0 0 0 15.5 1a5 5 0 0 0-3.3 1.7A4.5 4.5 0 0 0 11 6.1a4.1 4.1 0 0 0 3.4-1.5Z" />
    </IconSvg>
  );
}

// ============================================
// NAVIGATION ICONS
// ============================================
