import "server-only";
import { localFacilityDirectory, localHealthDataProvider } from "./local-provider";
import { abdmConfigured, sandboxFacilityDirectory, sandboxHealthDataProvider } from "./sandbox-provider";
import type { DataMode, FacilityDirectory, HealthDataProvider } from "./types";

export function dataMode(): DataMode {
  return process.env.DATA_MODE === "abdm_sandbox" ? "abdm_sandbox" : "local";
}

export function getHealthDataProvider(): HealthDataProvider {
  return dataMode() === "abdm_sandbox" ? sandboxHealthDataProvider : localHealthDataProvider;
}

export function getFacilityDirectory(): FacilityDirectory {
  return dataMode() === "abdm_sandbox" ? sandboxFacilityDirectory : localFacilityDirectory;
}

export function integrationStatus() {
  return {
    dataMode: dataMode(),
    abdmCredentialsPresent: abdmConfigured(),
    liveAbdmConnected: false, // never true until a real, verified sandbox implementation exists
    note:
      dataMode() === "local"
        ? "Records are stored in this app. The ABDM integration adapter is ready but not connected."
        : "ABDM sandbox mode selected, but the adapter is a stub. Requests will fail safely until implemented.",
  };
}
export * from "./types";
