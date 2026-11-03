/** Sends one SMS. The real provider (DLT-registered) is chosen at deployment. */
export interface SmsProvider {
  send(message: {
    to: string;
    body: string;
    dltTemplateId: string | null;
  }): Promise<{ providerMessageId: string }>;
}
