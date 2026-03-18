// Augment react-native-svg to add missing SVG text attributes
export {};

declare module "react-native-svg" {
  interface TextProps {
    dominantBaseline?: string;
  }
}
