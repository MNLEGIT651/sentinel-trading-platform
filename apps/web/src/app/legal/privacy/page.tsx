import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — Sentinel Trading Platform',
  description: 'Sentinel Trading Platform Privacy Policy',
};

export default function PrivacyPage() {
  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none">
      <h1>Privacy Policy</h1>
      <p className="text-muted-foreground text-sm">Version 1.0.0 — Effective April 1, 2025</p>

      <h2>1. Introduction</h2>
      <p>
        This Privacy Policy describes how the Sentinel Trading Platform (&quot;Platform&quot;,
        &quot;we&quot;, &quot;us&quot;) collects, uses, stores, and protects your personal
        information when you use our services.
      </p>

      <h2>2. Information We Collect</h2>
      <h3>Account Information</h3>
      <p>
        When you create an account, we collect your email address and authentication credentials.
        Passwords are hashed and never stored in plain text.
      </p>

      <h3>Profile Information</h3>
      <p>
        You may optionally provide additional profile information such as risk tolerance, investment
        preferences, experience level, and trading goals. This information is used solely to
        personalize your Platform experience.
      </p>

      <h3>Usage Data</h3>
      <p>
        We collect information about how you interact with the Platform, including pages visited,
        features used, and actions taken. This helps us improve the Platform and diagnose issues.
      </p>

      <h3>Trading Data</h3>
      <p>
        If you connect a brokerage account, we access portfolio positions, order history, and
        account information through secure broker APIs. We do not store your broker credentials
        directly.
      </p>

      <h2>3. How We Use Your Information</h2>
      <p>We use your information to:</p>
      <ul>
        <li>Provide, maintain, and improve the Platform</li>
        <li>Generate personalized analytics, signals, and recommendations</li>
        <li>Authenticate your identity and secure your account</li>
        <li>Communicate important updates about the Platform or your account</li>
        <li>Monitor for security threats and unauthorized access</li>
        <li>Comply with legal obligations</li>
      </ul>

      <h2>4. Data Storage and Security</h2>
      <p>
        Your data is stored in encrypted databases hosted on secure cloud infrastructure. We
        implement industry-standard security measures including:
      </p>
      <ul>
        <li>Row-level security (RLS) ensuring users can only access their own data</li>
        <li>Encrypted data transmission via TLS/HTTPS</li>
        <li>Multi-factor authentication (MFA) support</li>
        <li>Rate limiting and abuse prevention</li>
        <li>Regular security audits and vulnerability assessments</li>
      </ul>

      <h2>5. Data Sharing</h2>
      <p>
        We do not sell, rent, or trade your personal information to third parties. We may share data
        only in the following circumstances:
      </p>
      <ul>
        <li>
          <strong>Service providers:</strong> We use trusted third-party services (e.g., hosting,
          authentication) that process data on our behalf under strict confidentiality agreements
        </li>
        <li>
          <strong>Legal requirements:</strong> When required by law, regulation, or legal process
        </li>
        <li>
          <strong>Safety:</strong> To protect the rights, property, or safety of our users or the
          public
        </li>
      </ul>

      <h2>6. Data Retention</h2>
      <p>
        We retain your data for as long as your account is active or as needed to provide services.
        Upon account deletion, we will remove your personal data within 30 days, except where
        retention is required by law.
      </p>

      <h2>7. Your Rights</h2>
      <p>You have the right to:</p>
      <ul>
        <li>Access the personal data we hold about you</li>
        <li>Request correction of inaccurate data</li>
        <li>Request deletion of your data</li>
        <li>Export your data in a portable format</li>
        <li>Withdraw consent for optional data processing</li>
      </ul>

      <h2>8. Cookies and Tracking</h2>
      <p>
        The Platform uses essential cookies for authentication and session management. We do not use
        third-party advertising or tracking cookies.
      </p>

      <h2>9. Children&apos;s Privacy</h2>
      <p>
        The Platform is not intended for use by individuals under the age of 18. We do not knowingly
        collect personal information from minors.
      </p>

      <h2>10. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify you of material changes
        by updating the version number and effective date. Continued use of the Platform after
        changes constitutes acceptance.
      </p>

      <h2>11. Contact</h2>
      <p>
        If you have questions about this Privacy Policy or wish to exercise your data rights, please
        contact us through the Platform&apos;s support channels.
      </p>
    </article>
  );
}
