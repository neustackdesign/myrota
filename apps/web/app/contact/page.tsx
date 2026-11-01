import { InfoPage } from "@/components/site/InfoPage";

export const metadata = { title: "Contact" };

export default function Contact() {
  return (
    <InfoPage kicker="Company" title="Contact">
      <p>myrota is in a closed pilot. If you are taking part, the quickest way to reach the team is through the person who invited you to the pilot.</p>
      <p>A public contact address will be published here before launch.</p>
    </InfoPage>
  );
}
