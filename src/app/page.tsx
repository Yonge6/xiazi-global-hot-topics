import LocaleHome from "@/app/[locale]/page";

export default function Home() {
  return <LocaleHome params={Promise.resolve({ locale: "zh" })} />;
}
