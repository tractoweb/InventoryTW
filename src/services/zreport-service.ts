import { amplifyClient } from "@/lib/amplify-config";
import { listAllPages } from "@/services/amplify-list-all";

export async function listZReports() {
  return listAllPages(amplifyClient.models.ZReport.list);
}

export async function createZReport(zreport: any) {
  return amplifyClient.models.ZReport.create(zreport);
}
