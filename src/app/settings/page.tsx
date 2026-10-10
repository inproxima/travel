import { Settings } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { SettingsView } from "@/components/settings/settings-view";

export const metadata = { title: "Settings · Waypoint" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader icon={<Settings />} accent="neutral" title="Settings" description="Your loyalty programs, saved places and defaults." />
      <SettingsView />
    </>
  );
}
