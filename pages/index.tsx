import type { GetServerSideProps } from "next";

import { DEFAULT_APP_PATH } from "@/lib/navigation/mainNav";

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: DEFAULT_APP_PATH,
    permanent: false,
  },
});

export default function Home() {
  return null;
}
