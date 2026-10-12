// Electronic-consent wording shown to signers. Kept in configuration so it can be
// reviewed per jurisdiction. It deliberately makes no claim about legal validity.
export type ConsentConfig = {
  version: string;
  heading: string;
  body: string[];
  checkboxLabel: string;
};

export const DEFAULT_CONSENT: ConsentConfig = {
  version: "draft-2026-10",
  heading: "Consent to sign electronically",
  body: [
    "You are about to sign this document electronically. Your electronic signature will be applied to the document and recorded together with the date and time, your email address, and technical details of your session such as your IP address and browser.",
    "If you would prefer not to sign electronically, do not continue. Contact the sender to ask about other options.",
  ],
  checkboxLabel: "I agree to sign this document electronically.",
};
