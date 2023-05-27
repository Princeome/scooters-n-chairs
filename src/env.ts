export const env = {
  shopifyApiToken: requiredString("SCOOTERSNCHAIRS_SHOPIFY_API_KEY","test"),
  logLevel: requiredString("SCOOTERSNCHAIRS_LOG_LEVEL","info"),
  phoneNumber: optionalString("SCOOTERSNCHAIRS_PHONE_NUMBER", "1-877-659-9493"),
} as const;
function requiredString(envName: string, defaultValue:string): string {
  const result = process.env[envName] ?? defaultValue;
  if (result === undefined) {
    throw new Error(`${envName} must be configured`);
  }
  return result;
}


function optionalString(envName: string, defaultValue: string): string {
  return process.env[envName] ?? defaultValue;
}
