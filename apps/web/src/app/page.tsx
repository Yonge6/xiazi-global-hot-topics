import LocaleHome from "@/app/[locale]/page";

export const revalidate = 3600;

export default function Home() {
  return <LocaleHome params={Promise.resolve({ locale: "zh" })} />;
}
