import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { shopConfig } from "../../../shop.config";

const { name, address, phone, email, privacy } = shopConfig;

export const metadata: Metadata = {
  title: `Privacy notice | ${name}`,
  description: `How ${name} uses the details you give when you book.`,
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy notice" updated="9 November 2026">
      <p>
        This notice explains what we do with your details when you book an appointment with {name}. We keep it short
        because we collect very little.
      </p>

      <h2>Who we are</h2>
      <p>
        {name}, {address}, is the controller of your personal data. You can reach us on {phone} or at{" "}
        <a href={`mailto:${email}`}>{email}</a>.
        {privacy.icoRegistration && <> We are registered with the Information Commissioner&apos;s Office, number {privacy.icoRegistration}.</>}
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Your name and phone number.</li>
        <li>Your email address, if you choose to give it.</li>
        <li>Your booking: the service, the date and time, and whether you came.</li>
        <li>
          A short-lived anti-abuse record: to stop misuse of online booking we keep a scrambled (hashed) version of
          the phone number used for a booking, together with the time, for 24 hours, then it is deleted automatically.
          It is not used for anything else.
        </li>
      </ul>
      <p>We do not ask for payment details online. You pay in the shop.</p>

      <h2>Why we use it</h2>
      <ul>
        <li>
          To take and manage your booking, and to tell you if it changes or we have to cancel. The law allows this
          because it is needed to provide the appointment you asked for (contract).
        </li>
        <li>
          To send you reminders before your appointment. We do this because it is in our legitimate interests, and
          yours, to keep appointments from being missed. Reminders are only ever about your booking. To stop them,
          press <strong className="font-medium text-foreground">Stop reminder messages</strong> on your booking page, or
          call or email us. We will still tell you if your booking changes or is cancelled.
        </li>
        <li>
          To stop misuse of online booking, such as someone making floods of fake bookings. We do this because it is
          in our legitimate interests, and our customers&apos;, to prevent misuse and fraud and keep the diary
          available (legitimate interests). This only uses the 24-hour anti-abuse record described above.
        </li>
      </ul>
      <p>
        We never send marketing messages. If we ever wanted to, we would ask for your separate permission first.
      </p>

      <h2>Who else handles it</h2>
      <p>We use these companies to run the website and send your booking messages. They act only on our instructions:</p>
      <ul>
        {privacy.processors.map((p) => (
          <li key={p.name}>
            <strong className="font-medium text-foreground">{p.name}</strong>: {p.role}.
          </li>
        ))}
      </ul>
      <p>
        Some of them may store or process data outside the UK. Where they do, they use safeguards recognised under UK
        law, such as the UK International Data Transfer Addendum. We do not sell your data or share it with anyone else.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your booking details for {privacy.retentionYears} years after your appointment, so we have a record
        of our diary and takings. After that we remove your name, phone number and email automatically. The 24-hour anti-abuse record is deleted after 24 hours, and the Delete my data button does not remove it because it holds no readable details.
      </p>

      <h2>Your rights</h2>
      <p>You have the right to:</p>
      <ul>
        <li>get a copy of the details we hold about you (access);</li>
        <li>have wrong details corrected (rectification);</li>
        <li>have your details deleted (erasure);</li>
        <li>ask us to limit how we use them (restriction);</li>
        <li>object to how we use them, including reminders (objection);</li>
        <li>get your details in a common electronic format to take elsewhere (data portability).</li>
      </ul>
      <p>
        To delete the details on one booking, use the{" "}
        <strong className="font-medium text-foreground">Delete my data</strong> button on that booking&apos;s page (the
        link in your confirmation message). It removes your name, phone number and email from that booking and cancels
        it if it is still upcoming. To delete everything we hold about you, or for any other request, call {phone} or
        email <a href={`mailto:${email}`}>{email}</a>. Before deleting all your bookings we check it is you by calling
        you back on the phone number they were made with. We will reply within one month.
      </p>
      <p>
        If you are unhappy with how we have handled your data, you can complain to the Information Commissioner&apos;s
        Office at <a href="https://ico.org.uk/make-a-complaint/">ico.org.uk</a> or on 0303 123 1113. We would
        appreciate the chance to put things right first.
      </p>

      <h2>Cookies</h2>
      <p>
        We only use the cookies needed for the shop owner to sign in. See our <a href="/cookies">cookie notice</a>.
      </p>
    </LegalPage>
  );
}
