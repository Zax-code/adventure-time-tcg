import { Button, type ButtonProps } from "./ui/button";

export { Button, type ButtonProps } from "./ui/button";

type ToneButtonProps = Omit<ButtonProps, "tone">;

export function PrimaryButton(props: ToneButtonProps) {
  return <Button {...props} tone="primary" />;
}

export function SecondaryButton(props: ToneButtonProps) {
  return <Button {...props} tone="secondary" />;
}

export function GhostButton(props: ToneButtonProps) {
  return <Button {...props} tone="ghost" />;
}
