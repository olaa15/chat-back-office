import { getBusinessSettings } from "./actions";
import SettingsForm from "./SettingsForm";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const result = await getBusinessSettings();
  if (!result.ok) redirect("/dashboard");

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-semibold text-ink mb-1">Settings</h1>
      <p className="text-sm text-ink-muted mb-8">Update your business profile and bank details.</p>
      <SettingsForm settings={result.data} />
    </div>
  );
}
