import React from "react";
import EmptyPanel from "@/components/EmptyPanel";
import { CalendarClock } from "lucide-react";

export default function AttendancePage() {
  return <EmptyPanel title="Attendance" description="Daily check-ins, branch attendance reports, and field visit logs." icon={CalendarClock} />;
}
