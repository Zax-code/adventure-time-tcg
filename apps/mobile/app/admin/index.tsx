import { Redirect } from "expo-router";

export default function AdminIndexScreen() {
  return <Redirect href={"/admin/cards" as any} />;
}
