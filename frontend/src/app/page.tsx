import { redirect } from "next/navigation";

export default function Home() {
  // Langsung arahkan siapa pun yang membuka http://localhost:3000 ke /login
  redirect("/login");
}