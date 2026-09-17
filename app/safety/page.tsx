import { FlowShell } from '@/components/layout/FlowShell';
import { SafetyForm } from '@/components/safety/SafetyForm';

export default function SafetyPage() {
  return <FlowShell step="safety"><SafetyForm /></FlowShell>;
}
