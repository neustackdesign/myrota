import { InfoPage } from "@/components/site/InfoPage";

export const metadata = { title: "About" };

export default function About() {
  return (
    <InfoPage kicker="Company" title="About myrota">
      <p>myrota turns the skincare you already own into a simple seven-day rota: which nights for the strong stuff, which nights to rest, and exactly what goes on tonight.</p>
      <p>It is in a closed pilot with a small group of people in Lagos and Dubai. The design is built to be honest about what it knows: unknown products stay unknown, and nothing is called compatible until a reviewer has checked it.</p>
      <h2 id="press">Press</h2>
      <p>A press kit will be published at public launch. Until then, please don&apos;t publish screenshots of the pilot.</p>
    </InfoPage>
  );
}
