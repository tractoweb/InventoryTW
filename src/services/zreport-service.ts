import { amplifyClient } from "@/lib/amplify-config";

export async function listZReports() {
  return amplifyClient.models.ZReport.list();
}

export async function createZReport(zreport: any) {
  return amplifyClient.models.ZReport.create(zreport);
}
