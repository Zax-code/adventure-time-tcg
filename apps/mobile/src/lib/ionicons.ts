import type { ComponentProps } from "react";
import Ionicons from "@react-native-vector-icons/ionicons";

export type IoniconName = NonNullable<ComponentProps<typeof Ionicons>["name"]>;
